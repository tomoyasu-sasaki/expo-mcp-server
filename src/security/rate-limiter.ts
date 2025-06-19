/**
 * Rate Limiter and Access Control for Expo MCP Server
 * レート制限・セッション管理・IP制限・権限システム
 */

import { EventEmitter } from 'events';

export interface RateLimitConfig {
  requests_per_hour: number;
  session_timeout_minutes: number;
  max_concurrent_sessions: number;
  ip_whitelist: string[];
  ip_blacklist: string[];
  enable_ip_blocking: boolean;
}

export interface SessionInfo {
  sessionId: string;
  requestCount: number;
  lastRequest: Date;
  createdAt: Date;
  clientIP?: string;
  userAgent?: string;
  permissions: string[];
  blocked: boolean;
}

export interface PermissionConfig {
  roles: {
    [roleName: string]: {
      permissions: string[];
      description: string;
    };
  };
  default_role: string;
  require_authentication: boolean;
}

export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private permissions: PermissionConfig;
  private sessions: Map<string, SessionInfo> = new Map();
  private ipRequests: Map<string, { count: number; lastReset: Date }> = new Map();
  private blockedIPs: Set<string> = new Set();
  private whitelistedIPs: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig, permissions: PermissionConfig) {
    super();
    this.config = config;
    this.permissions = permissions;
    this.initializeIPSets();
    this.startCleanupTimer();
  }

  /**
   * IP セット初期化
   */
  private initializeIPSets(): void {
    this.config.ip_whitelist.forEach(ip => this.whitelistedIPs.add(ip));
    this.config.ip_blacklist.forEach(ip => this.blockedIPs.add(ip));
  }

  /**
   * クリーンアップタイマー開始
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
      this.resetIPCounters();
    }, 60000); // 1分ごと
  }

  /**
   * レート制限チェック
   */
  public checkRateLimit(sessionId: string, clientIP?: string): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    reason?: string;
  } {
    // IP ブロック チェック
    if (clientIP && this.isIPBlocked(clientIP)) {
      this.emit('rate_limit:blocked', { sessionId, clientIP, reason: 'IP blocked' });
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
        reason: 'IP address is blocked',
      };
    }

    // IP ホワイトリスト チェック
    if (clientIP && this.whitelistedIPs.has(clientIP)) {
      return {
        allowed: true,
        remaining: this.config.requests_per_hour,
        resetTime: new Date(Date.now() + 60 * 60 * 1000),
      };
    }

    // セッション レート制限
    const session = this.getOrCreateSession(sessionId, clientIP);
    
    if (session.blocked) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 60 * 1000),
        reason: 'Session is blocked',
      };
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 1時間以内のリクエスト数をカウント
    if (session.lastRequest < hourAgo) {
      session.requestCount = 0;
    }

    if (session.requestCount >= this.config.requests_per_hour) {
      this.emit('rate_limit:exceeded', { sessionId, clientIP, requestCount: session.requestCount });
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(session.lastRequest.getTime() + 60 * 60 * 1000),
        reason: 'Rate limit exceeded',
      };
    }

    // IP レート制限
    if (clientIP) {
      const ipLimitResult = this.checkIPRateLimit(clientIP);
      if (!ipLimitResult.allowed) {
        return ipLimitResult;
      }
    }

    // リクエストカウント更新
    session.requestCount++;
    session.lastRequest = now;
    
    const remaining = this.config.requests_per_hour - session.requestCount;

    this.emit('rate_limit:request', { sessionId, clientIP, requestCount: session.requestCount });

    return {
      allowed: true,
      remaining,
      resetTime: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  /**
   * IP レート制限チェック
   */
  private checkIPRateLimit(clientIP: string): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    reason?: string;
  } {
    const ipLimit = this.config.requests_per_hour * 2; // IP単位では2倍まで許可
    const ipData = this.ipRequests.get(clientIP);
    const now = new Date();

    if (!ipData) {
      this.ipRequests.set(clientIP, { count: 1, lastReset: now });
      return {
        allowed: true,
        remaining: ipLimit - 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }

    // 1時間経過していればリセット
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (ipData.lastReset < hourAgo) {
      ipData.count = 1;
      ipData.lastReset = now;
      return {
        allowed: true,
        remaining: ipLimit - 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000),
      };
    }

    if (ipData.count >= ipLimit) {
      this.emit('rate_limit:ip_exceeded', { clientIP, requestCount: ipData.count });
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(ipData.lastReset.getTime() + 60 * 60 * 1000),
        reason: 'IP rate limit exceeded',
      };
    }

    ipData.count++;
    return {
      allowed: true,
      remaining: ipLimit - ipData.count,
      resetTime: new Date(now.getTime() + 60 * 60 * 1000),
    };
  }

  /**
   * セッション管理
   */
  private getOrCreateSession(sessionId: string, clientIP?: string): SessionInfo {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        requestCount: 0,
        lastRequest: new Date(),
        createdAt: new Date(),
        clientIP,
        permissions: [this.permissions.default_role],
        blocked: false,
      };
      
      this.sessions.set(sessionId, session);
      this.emit('session:created', { sessionId, clientIP });
    }

    return session;
  }

  /**
   * セッションタイムアウトチェック
   */
  public checkSessionTimeout(sessionId: string): {
    valid: boolean;
    timeoutAt?: Date;
    reason?: string;
  } {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    const now = new Date();
    const timeoutMs = this.config.session_timeout_minutes * 60 * 1000;
    const timeoutAt = new Date(session.lastRequest.getTime() + timeoutMs);

    if (now > timeoutAt) {
      this.sessions.delete(sessionId);
      this.emit('session:timeout', { sessionId });
      return { valid: false, timeoutAt, reason: 'Session timeout' };
    }

    return { valid: true, timeoutAt };
  }

  /**
   * 権限チェック
   */
  public checkPermission(sessionId: string, requiredPermission: string): {
    allowed: boolean;
    userPermissions: string[];
    reason?: string;
  } {
    if (!this.permissions.require_authentication) {
      return { allowed: true, userPermissions: ['anonymous'] };
    }

    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        allowed: false,
        userPermissions: [],
        reason: 'Session not found',
      };
    }

    // セッションの権限を展開
    const allPermissions = new Set<string>();
    
    for (const roleName of session.permissions) {
      const role = this.permissions.roles[roleName];
      if (role) {
        role.permissions.forEach(perm => allPermissions.add(perm));
      }
    }

    const userPermissions = Array.from(allPermissions);
    const allowed = allPermissions.has(requiredPermission) || allPermissions.has('*');

    if (!allowed) {
      this.emit('permission:denied', { sessionId, requiredPermission, userPermissions });
    }

    return { allowed, userPermissions, reason: allowed ? undefined : 'Permission denied' };
  }

  /**
   * IP ブロック管理
   */
  public isIPBlocked(clientIP: string): boolean {
    return this.config.enable_ip_blocking && this.blockedIPs.has(clientIP);
  }

  public blockIP(clientIP: string, reason?: string): void {
    this.blockedIPs.add(clientIP);
    this.emit('ip:blocked', { clientIP, reason });
  }

  public unblockIP(clientIP: string): void {
    this.blockedIPs.delete(clientIP);
    this.emit('ip:unblocked', { clientIP });
  }

  public addToWhitelist(clientIP: string): void {
    this.whitelistedIPs.add(clientIP);
    this.emit('ip:whitelisted', { clientIP });
  }

  public removeFromWhitelist(clientIP: string): void {
    this.whitelistedIPs.delete(clientIP);
    this.emit('ip:whitelist_removed', { clientIP });
  }

  /**
   * セッション ブロック/アンブロック
   */
  public blockSession(sessionId: string, reason?: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.blocked = true;
      this.emit('session:blocked', { sessionId, reason });
    }
  }

  public unblockSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.blocked = false;
      this.emit('session:unblocked', { sessionId });
    }
  }

  /**
   * 権限管理
   */
  public grantPermission(sessionId: string, roleName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.permissions.includes(roleName)) {
      session.permissions.push(roleName);
      this.emit('permission:granted', { sessionId, roleName });
    }
    return true;
  }

  public revokePermission(sessionId: string, roleName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.permissions.indexOf(roleName);
    if (index > -1) {
      session.permissions.splice(index, 1);
      this.emit('permission:revoked', { sessionId, roleName });
    }
    return true;
  }

  /**
   * クリーンアップ処理
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const timeoutMs = this.config.session_timeout_minutes * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastRequest.getTime() > timeoutMs) {
        this.sessions.delete(sessionId);
        this.emit('session:expired', { sessionId });
      }
    }
  }

  private resetIPCounters(): void {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const [ip, data] of this.ipRequests.entries()) {
      if (data.lastReset < hourAgo) {
        this.ipRequests.delete(ip);
      }
    }
  }

  /**
   * 統計情報取得
   */
  public getStats(): {
    activeSessions: number;
    totalRequests: number;
    blockedIPs: number;
    whitelistedIPs: number;
    averageRequestsPerSession: number;
  } {
    const activeSessions = this.sessions.size;
    const totalRequests = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.requestCount, 0);
    
    return {
      activeSessions,
      totalRequests,
      blockedIPs: this.blockedIPs.size,
      whitelistedIPs: this.whitelistedIPs.size,
      averageRequestsPerSession: activeSessions > 0 ? totalRequests / activeSessions : 0,
    };
  }

  /**
   * リソース解放
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
    this.ipRequests.clear();
    this.blockedIPs.clear();
    this.whitelistedIPs.clear();
    this.removeAllListeners();
  }
} 