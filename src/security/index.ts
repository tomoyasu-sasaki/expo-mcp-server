/**
 * Security Integration for Expo MCP Server
 * セキュリティ機能の統合とMCPサーバーへの組み込み
 */

import { SecurityManager, SecurityConfig, SecurityViolation } from './security-manager';
import { RateLimiter, RateLimitConfig, PermissionConfig, SessionInfo } from './rate-limiter';
import { EventEmitter } from 'events';

export interface IntegratedSecurityConfig {
  security: SecurityConfig;
  rateLimit: RateLimitConfig;
  permissions: PermissionConfig;
  logging: {
    logViolations: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface SecurityCheckResult {
  allowed: boolean;
  violations: string[];
  metadata?: {
    sessionInfo?: SessionInfo;
    rateLimitInfo?: any;
    securityStats?: any;
  };
}

export class ExpoMCPSecurity extends EventEmitter {
  private securityManager: SecurityManager;
  private rateLimiter: RateLimiter;
  private config: IntegratedSecurityConfig;

  constructor(config: IntegratedSecurityConfig) {
    super();
    this.config = config;
    
    // セキュリティマネージャー初期化
    this.securityManager = new SecurityManager(config.security);
    
    // レート制限マネージャー初期化
    this.rateLimiter = new RateLimiter(config.rateLimit, config.permissions);
    
    this.setupEventForwarding();
  }

  /**
   * イベント転送設定
   */
  private setupEventForwarding(): void {
    // SecurityManager のイベントを転送
    this.securityManager.on('security:violation', (violation: SecurityViolation) => {
      this.emit('security:violation', violation);
      
      if (this.config.logging.logViolations) {
        console.warn('[Security] Violation detected:', violation);
      }
    });

    this.securityManager.on('security:critical', (violation: SecurityViolation) => {
      this.emit('security:critical', violation);
      console.error('[Security] CRITICAL violation:', violation);
    });

    // RateLimiter のイベントを転送
    this.rateLimiter.on('rate_limit:exceeded', (data) => {
      this.emit('rate_limit:exceeded', data);
      console.warn('[Security] Rate limit exceeded:', data);
    });

    this.rateLimiter.on('session:timeout', (data) => {
      this.emit('session:timeout', data);
      if (this.config.logging.logLevel === 'debug') {
        console.log('[Security] Session timeout:', data);
      }
    });

    this.rateLimiter.on('ip:blocked', (data) => {
      this.emit('ip:blocked', data);
      console.warn('[Security] IP blocked:', data);
    });

    this.rateLimiter.on('permission:denied', (data) => {
      this.emit('permission:denied', data);
      console.warn('[Security] Permission denied:', data);
    });
  }

  /**
   * MCP ツール呼び出しのセキュリティチェック
   */
  public async validateToolCall(
    sessionId: string,
    toolName: string,
    toolArgs: any,
    clientIP?: string
  ): Promise<SecurityCheckResult> {
    const violations: string[] = [];

    try {
      // 1. レート制限チェック
      const rateLimitResult = this.rateLimiter.checkRateLimit(sessionId, clientIP);
      if (!rateLimitResult.allowed) {
        violations.push(`Rate limit: ${rateLimitResult.reason}`);
        return {
          allowed: false,
          violations,
          metadata: { rateLimitInfo: rateLimitResult },
        };
      }

      // 2. セッションタイムアウトチェック
      const sessionResult = this.rateLimiter.checkSessionTimeout(sessionId);
      if (!sessionResult.valid) {
        violations.push(`Session: ${sessionResult.reason}`);
        return { allowed: false, violations };
      }

      // 3. 権限チェック
      const permissionResult = this.rateLimiter.checkPermission(sessionId, 'tool:execute');
      if (!permissionResult.allowed) {
        violations.push(`Permission: ${permissionResult.reason}`);
        return { allowed: false, violations };
      }

      // 4. JSON Schema バリデーション
      const toolData = { name: toolName, arguments: toolArgs };
      const schemaResult = this.securityManager.validateJsonSchema(toolData, 'tool');
      if (!schemaResult.valid) {
        violations.push(...(schemaResult.errors || ['JSON Schema validation failed']));
      }

      // 5. メッセージサイズ制限
      const sizeResult = this.securityManager.validateMessageSize(toolArgs, 'tool_args');
      if (!sizeResult.valid) {
        violations.push(`Message size exceeded: ${sizeResult.size}/${sizeResult.limit} bytes`);
      }

      // 6. コードインジェクション防止
      const injectionResult = this.securityManager.preventCodeInjection(toolArgs);
      if (!injectionResult.safe) {
        violations.push(...injectionResult.violations);
      }

      // 7. Expo特有バリデーション
      if (this.isExpoSpecificTool(toolName)) {
        const expoResult = this.securityManager.validateExpoSpecific(toolArgs);
        if (!expoResult.valid) {
          violations.push(...expoResult.violations);
        }
      }

      // 8. 高度な脅威検出
      const threatAnalysis = this.securityManager.detectAdvancedThreats(
        JSON.stringify(toolArgs),
        { type: 'tool_arg', source: `tool:${toolName}` }
      );
      
      if (threatAnalysis.overall_risk === 'high' || threatAnalysis.overall_risk === 'critical') {
        const threatDescriptions = threatAnalysis.threats.map(t => t.description);
        violations.push(`Advanced threats: ${threatDescriptions.join(', ')}`);
      }

      const allowed = violations.length === 0;

      return {
        allowed,
        violations,
        metadata: {
          rateLimitInfo: rateLimitResult,
          sessionInfo: this.getSessionInfo(sessionId),
          securityStats: this.securityManager.getSecurityStats(),
        },
      };

    } catch (error) {
      violations.push(`Security check error: ${error instanceof Error ? error.message : error}`);
      return { allowed: false, violations };
    }
  }

  /**
   * MCP リソース読み取りのセキュリティチェック
   */
  public async validateResourceRead(
    sessionId: string,
    resourceUri: string,
    clientIP?: string
  ): Promise<SecurityCheckResult> {
    const violations: string[] = [];

    try {
      // 1. レート制限チェック
      const rateLimitResult = this.rateLimiter.checkRateLimit(sessionId, clientIP);
      if (!rateLimitResult.allowed) {
        violations.push(`Rate limit: ${rateLimitResult.reason}`);
        return { allowed: false, violations };
      }

      // 2. JSON Schema バリデーション
      const resourceData = { uri: resourceUri };
      const schemaResult = this.securityManager.validateJsonSchema(resourceData, 'resource');
      if (!schemaResult.valid) {
        violations.push(...(schemaResult.errors || ['Resource schema validation failed']));
      }

      // 3. URI サイズ制限
      const sizeResult = this.securityManager.validateMessageSize(resourceUri, 'resource_uri');
      if (!sizeResult.valid) {
        violations.push(`URI size exceeded: ${sizeResult.size}/${sizeResult.limit} bytes`);
      }

      // 4. ファイルパスサニタイゼーション（ファイルベースのリソースの場合）
      if (this.isFileBasedResource(resourceUri)) {
        const pathResult = this.securityManager.sanitizeFilePath(resourceUri);
        if (!pathResult.safe) {
          violations.push(...pathResult.violations);
        }
      }

      // 5. ホストホワイトリストチェック
      if (this.isExternalResource(resourceUri)) {
        const hostResult = this.validateHostWhitelist(resourceUri);
        if (!hostResult.allowed) {
          violations.push('Host not in whitelist');
        }
      }

      return {
        allowed: violations.length === 0,
        violations,
        metadata: {
          rateLimitInfo: rateLimitResult,
          sessionInfo: this.getSessionInfo(sessionId),
        },
      };

    } catch (error) {
      violations.push(`Resource validation error: ${error instanceof Error ? error.message : error}`);
      return { allowed: false, violations };
    }
  }

  /**
   * MCP プロンプト取得のセキュリティチェック
   */
  public async validatePromptGet(
    sessionId: string,
    promptName: string,
    promptArgs: any,
    clientIP?: string
  ): Promise<SecurityCheckResult> {
    const violations: string[] = [];

    try {
      // 1. レート制限チェック
      const rateLimitResult = this.rateLimiter.checkRateLimit(sessionId, clientIP);
      if (!rateLimitResult.allowed) {
        violations.push(`Rate limit: ${rateLimitResult.reason}`);
        return { allowed: false, violations };
      }

      // 2. JSON Schema バリデーション
      const promptData = { name: promptName, arguments: promptArgs };
      const schemaResult = this.securityManager.validateJsonSchema(promptData, 'prompt');
      if (!schemaResult.valid) {
        violations.push(...(schemaResult.errors || ['Prompt schema validation failed']));
      }

      // 3. コードインジェクション防止
      const injectionResult = this.securityManager.preventCodeInjection(promptArgs);
      if (!injectionResult.safe) {
        violations.push(...injectionResult.violations);
      }

      return {
        allowed: violations.length === 0,
        violations,
        metadata: {
          rateLimitInfo: rateLimitResult,
          sessionInfo: this.getSessionInfo(sessionId),
        },
      };

    } catch (error) {
      violations.push(`Prompt validation error: ${error instanceof Error ? error.message : error}`);
      return { allowed: false, violations };
    }
  }

  /**
   * HTTP リクエストのセキュリティチェック
   */
  public async validateHttpRequest(
    sessionId: string,
    request: any,
    clientIP?: string
  ): Promise<SecurityCheckResult> {
    const violations: string[] = [];

    try {
      // 1. IP ブロックチェック
      if (clientIP && this.rateLimiter.isIPBlocked(clientIP)) {
        violations.push('IP address is blocked');
        return { allowed: false, violations };
      }

      // 2. レート制限チェック
      const rateLimitResult = this.rateLimiter.checkRateLimit(sessionId, clientIP);
      if (!rateLimitResult.allowed) {
        violations.push(`Rate limit: ${rateLimitResult.reason}`);
        return { allowed: false, violations };
      }

      // 3. リクエストサイズ制限
      const sizeResult = this.securityManager.validateMessageSize(request, 'general');
      if (!sizeResult.valid) {
        violations.push(`Request size exceeded: ${sizeResult.size}/${sizeResult.limit} bytes`);
      }

      return {
        allowed: violations.length === 0,
        violations,
        metadata: {
          rateLimitInfo: rateLimitResult,
          sessionInfo: this.getSessionInfo(sessionId),
        },
      };

    } catch (error) {
      violations.push(`HTTP validation error: ${error instanceof Error ? error.message : error}`);
      return { allowed: false, violations };
    }
  }

  /**
   * セッション情報取得
   */
  private getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.rateLimiter['sessions']?.get(sessionId);
  }

  /**
   * Expo特有ツールチェック
   */
  private isExpoSpecificTool(toolName: string): boolean {
    return toolName.startsWith('expo_');
  }

  /**
   * ファイルベースリソースチェック
   */
  private isFileBasedResource(uri: string): boolean {
    return uri.startsWith('file://') || uri.includes('/') && !uri.startsWith('http');
  }

  /**
   * 外部リソースチェック
   */
  private isExternalResource(uri: string): boolean {
    return uri.startsWith('http://') || uri.startsWith('https://');
  }

  /**
   * ホストホワイトリストチェック
   */
  private validateHostWhitelist(uri: string): { allowed: boolean; host?: string } {
    try {
      const url = new URL(uri);
      const host = url.hostname;
      const allowedHosts = this.config.security.access_control.allowed_hosts;
      
      const allowed = allowedHosts.some(allowedHost => {
        // 完全一致またはサブドメイン一致
        return host === allowedHost || host.endsWith('.' + allowedHost);
      });

      return { allowed, host };
    } catch (error) {
      return { allowed: false };
    }
  }

  /**
   * 管理者用メソッド - IP ブロック
   */
  public blockIP(clientIP: string, reason?: string): void {
    this.rateLimiter.blockIP(clientIP, reason);
  }

  public unblockIP(clientIP: string): void {
    this.rateLimiter.unblockIP(clientIP);
  }

  /**
   * 管理者用メソッド - セッション管理
   */
  public blockSession(sessionId: string, reason?: string): void {
    this.rateLimiter.blockSession(sessionId, reason);
  }

  public unblockSession(sessionId: string): void {
    this.rateLimiter.unblockSession(sessionId);
  }

  /**
   * 統計情報取得
   */
  public getSecurityStats(): {
    security: any;
    rateLimit: any;
  } {
    return {
      security: this.securityManager.getSecurityStats(),
      rateLimit: this.rateLimiter.getStats(),
    };
  }

  /**
   * リソース解放
   */
  public destroy(): void {
    this.rateLimiter.destroy();
    this.removeAllListeners();
  }
}

// 型エクスポート
export type { SecurityConfig, SecurityViolation } from './security-manager';
export { SecurityManager } from './security-manager';
export type { RateLimitConfig, PermissionConfig, SessionInfo } from './rate-limiter';
export { RateLimiter } from './rate-limiter'; 