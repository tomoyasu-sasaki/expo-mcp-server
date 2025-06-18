/**
 * Security Manager for Expo MCP Server
 * セキュリティ機能の統合管理
 */

import { z } from 'zod';
import * as path from 'path';
import { EventEmitter } from 'events';

// JSON Schema定義
const MCPToolRequestSchema = z.object({
  name: z.string().min(1).max(100),
  arguments: z.record(z.any()).optional(),
});

const MCPResourceRequestSchema = z.object({
  uri: z.string().url().max(512),
});

const MCPPromptRequestSchema = z.object({
  name: z.string().min(1).max(100),
  arguments: z.record(z.any()).optional(),
});

// Expo特有バリデーション
const ExpoSDKVersionSchema = z.union([
  z.literal('latest'),
  z.string().regex(/^sdk-\d+$/, 'Invalid SDK version format'),
]);

const ExpoSnackUrlSchema = z.string().url().refine(
  (url) => url.includes('snack.expo.dev') || url.includes('snack.expo.io'),
  'Invalid Snack URL'
);

const ExpoEASCommandSchema = z.object({
  operation: z.enum(['build', 'submit', 'update', 'credentials']),
  platform: z.enum(['ios', 'android', 'all']),
  profile: z.string().optional(),
});

export interface SecurityConfig {
  input_validation: {
    max_tool_args_size_bytes: number;
    max_resource_uri_length: number;
    sanitize_file_paths: boolean;
    validate_json_schema: boolean;
    prevent_code_injection: boolean;
    allowed_file_extensions: string[];
  };
  access_control: {
    allowed_hosts: string[];
    rate_limit_per_session: number;
    session_timeout_minutes: number;
    require_authentication: boolean;
  };
  tool_execution: {
    sandboxing_enabled: boolean;
    blocked_system_calls: string[];
    resource_limits: {
      max_memory_mb: number;
      max_cpu_time_ms: number;
      max_file_reads: number;
      max_network_requests: number;
    };
  };
  vulnerability_protection: {
    prompt_injection_detection: boolean;
    xss_prevention: boolean;
    path_traversal_protection: boolean;
    dos_attack_protection: boolean;
    malicious_snack_detection: boolean;
    auto_block_on_detection: boolean;
  };
}

export interface SecurityViolation {
  type: 'validation' | 'injection' | 'rate_limit' | 'unauthorized' | 'resource_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
  timestamp: Date;
  metadata?: any;
}

export class SecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private sessionLimits: Map<string, {
    requestCount: number;
    lastRequest: Date;
    createdAt: Date;
  }> = new Map();
  private violationLog: SecurityViolation[] = [];
  private blockedIPs: Set<string> = new Set();
  private whitelist: Set<string> = new Set();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: SecurityConfig) {
    super();
    this.config = config;
    this.initializeWhitelist();
    this.startCleanupTimer();
  }

  /**
   * ホワイトリスト初期化
   */
  private initializeWhitelist(): void {
    this.config.access_control.allowed_hosts.forEach(host => {
      this.whitelist.add(host);
    });
  }

  /**
   * 定期クリーンアップタイマー開始
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupViolationLog();
    }, 60000); // 1分ごと
  }

  /**
   * クリーンアップタイマー停止
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.removeAllListeners();
  }

  /**
   * JSON Schema バリデーション
   */
  public validateJsonSchema(data: any, schemaType: 'tool' | 'resource' | 'prompt'): {
    valid: boolean;
    errors?: string[];
  } {
    try {
      let schema: z.ZodSchema;
      
      switch (schemaType) {
        case 'tool':
          schema = MCPToolRequestSchema;
          break;
        case 'resource':
          schema = MCPResourceRequestSchema;
          break;
        case 'prompt':
          schema = MCPPromptRequestSchema;
          break;
        default:
          return { valid: false, errors: ['Invalid schema type'] };
      }

      if (!this.config.input_validation.validate_json_schema) {
        return { valid: true };
      }

      const result = schema.safeParse(data);
      
      if (result.success) {
        return { valid: true };
      } else {
        const errors = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        
        this.logViolation({
          type: 'validation',
          severity: 'medium',
          message: `JSON Schema validation failed: ${errors.join(', ')}`,
          source: 'validateJsonSchema',
          timestamp: new Date(),
          metadata: { schemaType, data, errors },
        });
        
        return { valid: false, errors };
      }
    } catch (error) {
      this.logViolation({
        type: 'validation',
        severity: 'high',
        message: `JSON Schema validation error: ${error}`,
        source: 'validateJsonSchema',
        timestamp: new Date(),
        metadata: { schemaType, data, error: error instanceof Error ? error.message : error },
      });
      
      return { valid: false, errors: ['Validation error occurred'] };
    }
  }

  /**
   * ファイルパスサニタイゼーション
   */
  public sanitizeFilePath(filePath: string): {
    sanitized: string;
    safe: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    let sanitized = filePath;

    if (!this.config.input_validation.sanitize_file_paths) {
      return { sanitized, safe: true, violations: [] };
    }

    // パストラバーサル防止
    if (filePath.includes('../') || filePath.includes('..\\')) {
      violations.push('Path traversal attempt detected');
      sanitized = sanitized.replace(/\.\.[/\\]/g, '');
    }

    // 絶対パス防止
    if (path.isAbsolute(filePath)) {
      violations.push('Absolute path not allowed');
      sanitized = path.basename(filePath);
    }

    // 危険な文字除去
    // TODO: Fix linter error with control character regex
    const dangerousChars = /[<>:"|?*]/g; // Simplified without control chars due to linter
    if (dangerousChars.test(sanitized)) {
      violations.push('Dangerous characters detected');
      sanitized = sanitized.replace(dangerousChars, '');
    }

    // ファイル拡張子チェック
    const ext = path.extname(sanitized).toLowerCase();
    if (ext && !this.config.input_validation.allowed_file_extensions.includes(ext)) {
      violations.push(`File extension '${ext}' not allowed`);
    }

    // 隠しファイル防止
    if (path.basename(sanitized).startsWith('.')) {
      violations.push('Hidden files not allowed');
      sanitized = path.basename(sanitized).substring(1);
    }

    const safe = violations.length === 0;

    if (!safe) {
      this.logViolation({
        type: 'validation',
        severity: 'high',
        message: `File path sanitization: ${violations.join(', ')}`,
        source: 'sanitizeFilePath',
        timestamp: new Date(),
        metadata: { originalPath: filePath, sanitizedPath: sanitized, violations },
      });
    }

    return { sanitized, safe, violations };
  }

  /**
   * コードインジェクション防止
   */
  public preventCodeInjection(input: string | object): {
    safe: boolean;
    violations: string[];
    sanitized?: string;
  } {
    const violations: string[] = [];

    if (!this.config.input_validation.prevent_code_injection) {
      return { safe: true, violations: [] };
    }

    const inputString = typeof input === 'string' ? input : JSON.stringify(input);

    // JavaScriptインジェクション検出
    const jsPatterns = [
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /<script[^>]*>/i,
      /require\s*\(/i,
      /import\s+/i,
      /process\./i,
      /global\./i,
      /window\./i,
      /document\./i,
    ];

    // SQLインジェクション検出
    const sqlPatterns = [
      /(\bor\b|\band\b).*=.*('|")/i,
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+.*set/i,
      /exec\s*\(/i,
      /sp_\w+/i,
    ];

    // Command injection検出
    const cmdPatterns = [
      /;\s*(rm|del|format|shutdown)/i,
      /\|\s*(curl|wget|nc|netcat)/i,
      /`[^`]*`/,
      /\$\([^)]*\)/,
      /&&|\|\||;/,
    ];

    const allPatterns = [...jsPatterns, ...sqlPatterns, ...cmdPatterns];

    for (const pattern of allPatterns) {
      if (pattern.test(inputString)) {
        violations.push(`Potential code injection detected: ${pattern}`);
      }
    }

    // Expoプロジェクト特有の危険パターン
    const expoPatterns = [
      /expo\s+eject/i,
      /\.expo\/.*secret/i,
      /eas\.json.*credentials/i,
    ];

    for (const pattern of expoPatterns) {
      if (pattern.test(inputString)) {
        violations.push(`Expo security violation: ${pattern}`);
      }
    }

    const safe = violations.length === 0;

    if (!safe) {
      this.logViolation({
        type: 'injection',
        severity: 'critical',
        message: `Code injection attempt: ${violations.join(', ')}`,
        source: 'preventCodeInjection',
        timestamp: new Date(),
        metadata: { input: inputString.substring(0, 200), violations },
      });
    }

    return {
      safe,
      violations,
      sanitized: safe ? inputString : this.sanitizeForCodeInjection(inputString),
    };
  }

  /**
   * コードインジェクション用サニタイゼーション
   */
  private sanitizeForCodeInjection(input: string): string {
    return input
      .replace(/[<>'"`;]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\s*\(/gi, '')
      .substring(0, 1000); // 長さ制限
  }

  /**
   * Expo特有バリデーション
   */
  public validateExpoSpecific(data: {
    sdkVersion?: string;
    snackUrl?: string;
    easCommand?: any;
  }): {
    valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // SDK版数バリデーション
    if (data.sdkVersion) {
      const sdkResult = ExpoSDKVersionSchema.safeParse(data.sdkVersion);
      if (!sdkResult.success) {
        violations.push(`Invalid SDK version: ${data.sdkVersion}`);
      }
    }

    // Snack URLバリデーション
    if (data.snackUrl) {
      const snackResult = ExpoSnackUrlSchema.safeParse(data.snackUrl);
      if (!snackResult.success) {
        violations.push(`Invalid Snack URL: ${data.snackUrl}`);
      }
    }

    // EAS コマンドバリデーション
    if (data.easCommand) {
      const easResult = ExpoEASCommandSchema.safeParse(data.easCommand);
      if (!easResult.success) {
        violations.push(`Invalid EAS command: ${JSON.stringify(data.easCommand)}`);
      }
    }

    const valid = violations.length === 0;

    if (!valid) {
      this.logViolation({
        type: 'validation',
        severity: 'medium',
        message: `Expo validation failed: ${violations.join(', ')}`,
        source: 'validateExpoSpecific',
        timestamp: new Date(),
        metadata: { data, violations },
      });
    }

    return { valid, violations };
  }

  /**
   * メッセージサイズ制限チェック
   */
  public validateMessageSize(data: any, type: 'tool_args' | 'resource_uri' | 'general'): {
    valid: boolean;
    size: number;
    limit: number;
  } {
    const serialized = JSON.stringify(data);
    const size = Buffer.byteLength(serialized, 'utf8');

    let limit: number;
    switch (type) {
      case 'tool_args':
        limit = this.config.input_validation.max_tool_args_size_bytes;
        break;
      case 'resource_uri':
        limit = this.config.input_validation.max_resource_uri_length;
        break;
      default:
        limit = 10 * 1024 * 1024; // 10MB default
    }

    const valid = size <= limit;

    if (!valid) {
      this.logViolation({
        type: 'validation',
        severity: 'medium',
        message: `Message size limit exceeded: ${size} > ${limit} bytes`,
        source: 'validateMessageSize',
        timestamp: new Date(),
        metadata: { size, limit, type },
      });
    }

    return { valid, size, limit };
  }

  /**
   * セキュリティ違反をログに記録
   */
  private logViolation(violation: SecurityViolation): void {
    this.violationLog.push(violation);
    this.emit('security:violation', violation);

    // 重大な違反の場合は即座に通知
    if (violation.severity === 'critical') {
      this.emit('security:critical', violation);
    }

    // ログサイズ制限
    if (this.violationLog.length > 1000) {
      this.violationLog = this.violationLog.slice(-500);
    }
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const timeoutMs = this.config.access_control.session_timeout_minutes * 60 * 1000;

    for (const [sessionId, session] of this.sessionLimits.entries()) {
      if (now.getTime() - session.lastRequest.getTime() > timeoutMs) {
        this.sessionLimits.delete(sessionId);
      }
    }
  }

  /**
   * 違反ログのクリーンアップ
   */
  private cleanupViolationLog(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.violationLog = this.violationLog.filter(v => v.timestamp > oneHourAgo);
  }

  /**
   * 高度な脆弱性検出
   */
  public detectAdvancedThreats(
    input: string,
    context: {
      type: 'prompt' | 'tool_arg' | 'resource_uri' | 'snack_url' | 'file_path';
      source?: string;
    }
  ): {
    threats: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
      description: string;
      blocked: boolean;
    }>;
    sanitized_input?: string;
    overall_risk: 'low' | 'medium' | 'high' | 'critical';
  } {
    const threats: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
      description: string;
      blocked: boolean;
    }> = [];

    let sanitizedInput = input;
    
    try {
      // 1. プロンプトインジェクション検出（すべてのコンテキストで実行）
      if (this.config.vulnerability_protection.prompt_injection_detection) {
        const promptThreat = this.detectPromptInjection(input);
        if (promptThreat && promptThreat.confidence > 0.3) {
          threats.push(promptThreat);
        }
      }

      // 2. XSS攻撃検出・サニタイゼーション
      if (this.config.vulnerability_protection.xss_prevention) {
        const xssThreat = this.detectXSSThreats(input);
        if (xssThreat.confidence > 0.3) {
          threats.push(xssThreat);
          if (xssThreat.blocked) {
            sanitizedInput = this.sanitizeXSSInput(input);
          }
        }
      }

      // 3. パストラバーサル検出（すべてのコンテキストで実行）
      if (this.config.vulnerability_protection.path_traversal_protection) {
        const pathThreat = this.detectPathTraversalAdvanced(input);
        if (pathThreat.confidence > 0.3) {
          threats.push(pathThreat);
        }
      }

      // 4. DoS攻撃検出
      if (this.config.vulnerability_protection.dos_attack_protection) {
        const dosThreat = this.detectDoSPatterns(input);
        if (dosThreat.confidence > 0.3) {
          threats.push(dosThreat);
        }
      }

      // 5. 悪意のあるSnack検出
      if (this.config.vulnerability_protection.malicious_snack_detection && context.type === 'snack_url') {
        const snackThreat = this.detectMaliciousSnackAdvanced(input);
        if (snackThreat.confidence > 0.3) {
          threats.push(snackThreat);
        }
      }

      // 全体リスク算出
      const overallRisk = this.calculateOverallRisk(threats);

      // 高リスク検出時のログ
      if (overallRisk === 'high' || overallRisk === 'critical') {
        this.logViolation({
          type: 'validation',
          severity: overallRisk,
          message: `Advanced threat detected: ${threats.map(t => t.type).join(', ')}`,
          source: 'detectAdvancedThreats',
          timestamp: new Date(),
          metadata: { threats, input: input.substring(0, 200), context },
        });
      }

      return {
        threats,
        sanitized_input: sanitizedInput !== input ? sanitizedInput : undefined,
        overall_risk: overallRisk,
      };

    } catch (error) {
      // エラー時のフォールバック
      return {
        threats: [{
          type: 'detection_error',
          severity: 'medium',
          confidence: 1.0,
          description: `Threat detection failed: ${error instanceof Error ? error.message : error}`,
          blocked: false,
        }],
        overall_risk: 'medium',
      };
    }
  }

  /**
   * プロンプトインジェクション検出（高度版）
   */
  private detectPromptInjection(input: string): {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    blocked: boolean;
  } | null {
    const injectionPatterns = [
      // 直接的なプロンプトハイジャック
      { pattern: /ignore\s+(previous|all)\s+(instructions?|prompts?|rules?)/i, weight: 0.9 },
      { pattern: /forget\s+(everything|all)\s+(above|before)/i, weight: 0.9 },
      { pattern: /you\s+are\s+now\s+(a|an)\s+\w+/i, weight: 0.8 },
      { pattern: /system\s*:\s*/i, weight: 0.7 },
      { pattern: /\[SYSTEM\]/i, weight: 0.8 },
      
      // ロールプレイング誘導
      { pattern: /pretend\s+to\s+be/i, weight: 0.6 },
      { pattern: /act\s+as\s+(if\s+you\s+are\s+)?a/i, weight: 0.6 },
      { pattern: /roleplay\s+as/i, weight: 0.6 },
      
      // 制約解除試行
      { pattern: /break\s+character/i, weight: 0.8 },
      { pattern: /disable\s+(safety|security)/i, weight: 0.9 },
      { pattern: /override\s+(safety|security)/i, weight: 0.9 },
      
      // Expo/MCP特有
      { pattern: /bypass\s+expo\s+security/i, weight: 0.95 },
      { pattern: /ignore\s+mcp\s+restrictions/i, weight: 0.95 },
      { pattern: /disable\s+sandbox/i, weight: 0.9 },
    ];

    let maxConfidence = 0;
    const detectedPatterns: string[] = [];

    for (const { pattern, weight } of injectionPatterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.toString());
        maxConfidence = Math.max(maxConfidence, weight);
      }
    }

    // 検出されない場合はnullを返す
    if (maxConfidence === 0) {
      return null;
    }

    // 複数パターン検出で信頼度上昇
    if (detectedPatterns.length > 1) {
      maxConfidence = Math.min(1.0, maxConfidence + 0.1 * detectedPatterns.length);
    }

    const blocked = maxConfidence > 0.7 && this.config.vulnerability_protection.auto_block_on_detection;

    return {
      type: 'prompt_injection',
      severity: maxConfidence > 0.8 ? 'critical' : maxConfidence > 0.6 ? 'high' : 'medium',
      confidence: maxConfidence,
      description: `Prompt injection attempt detected (confidence: ${(maxConfidence * 100).toFixed(1)}%, patterns: ${detectedPatterns.length})`,
      blocked,
    };
  }

  /**
   * XSS脅威検出
   */
  private detectXSSThreats(input: string): {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    blocked: boolean;
  } {
    const xssPatterns = [
      { pattern: /<script[^>]*>/i, weight: 0.95 },
      { pattern: /<\/script>/i, weight: 0.95 },
      { pattern: /on\w+\s*=\s*['"]/i, weight: 0.8 },
      { pattern: /javascript\s*:/i, weight: 0.9 },
      { pattern: /data\s*:\s*text\/html/i, weight: 0.8 },
      { pattern: /%3[cC]script/i, weight: 0.9 },
      { pattern: /<iframe[^>]*>/i, weight: 0.7 },
      { pattern: /expression\s*\(/i, weight: 0.8 },
    ];

    let maxConfidence = 0;
    let detectedCount = 0;

    for (const { pattern, weight } of xssPatterns) {
      if (pattern.test(input)) {
        detectedCount++;
        maxConfidence = Math.max(maxConfidence, weight);
      }
    }

    // HTML タグの存在チェック
    const htmlTags = (input.match(/<[^>]+>/g) || []).length;
    if (htmlTags > 0) {
      maxConfidence = Math.max(maxConfidence, 0.5 + htmlTags * 0.1);
    }

    const blocked = maxConfidence > 0.6 && this.config.vulnerability_protection.auto_block_on_detection;

    return {
      type: 'xss_attack',
      severity: maxConfidence > 0.8 ? 'high' : maxConfidence > 0.5 ? 'medium' : 'low',
      confidence: maxConfidence,
      description: `XSS attack pattern detected (${detectedCount} patterns, ${htmlTags} HTML tags)`,
      blocked,
    };
  }

  /**
   * 高度なパストラバーサル検出
   */
  private detectPathTraversalAdvanced(filePath: string): {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    blocked: boolean;
  } {
    const traversalPatterns = [
      { pattern: /\.\.[/\\]/g, weight: 0.9 },
      { pattern: /%2e%2e[/\\]/gi, weight: 0.9 },
      { pattern: /%252e%252e/gi, weight: 0.95 },
      { pattern: /\.{3,}/g, weight: 0.8 },
      { pattern: /\/etc\/|\/proc\/|\/sys\//gi, weight: 0.95 },
      { pattern: /C:\\Windows\\|C:\\System32\\/gi, weight: 0.95 },
    ];

    let maxConfidence = 0;
    const violations: string[] = [];

    for (const { pattern, weight } of traversalPatterns) {
      const matches = filePath.match(pattern);
      if (matches) {
        violations.push(`Pattern: ${pattern}, Matches: ${matches.length}`);
        maxConfidence = Math.max(maxConfidence, weight);
      }
    }

    // 絶対パスチェック
    if (filePath.startsWith('/') || /^[A-Za-z]:[/\\]/.test(filePath)) {
      violations.push('Absolute path detected');
      maxConfidence = Math.max(maxConfidence, 0.7);
    }

    const blocked = maxConfidence > 0.7 && this.config.vulnerability_protection.auto_block_on_detection;

    return {
      type: 'path_traversal',
      severity: maxConfidence > 0.8 ? 'high' : maxConfidence > 0.5 ? 'medium' : 'low',
      confidence: maxConfidence,
      description: `Path traversal attempt: ${violations.join(', ')}`,
      blocked,
    };
  }

  /**
   * DoS攻撃パターン検出
   */
  private detectDoSPatterns(input: string): {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    blocked: boolean;
  } {
    let confidence = 0;
    const issues: string[] = [];

    // サイズチェック
    const sizeMB = Buffer.byteLength(input, 'utf8') / (1024 * 1024);
    if (sizeMB > 10) {
      issues.push(`Large input: ${sizeMB.toFixed(2)}MB`);
      confidence = Math.max(confidence, 0.8);
    }

    // 反復パターン
    const repetitivePattern = /(.{10,}?)\1{5,}/g;
    if (repetitivePattern.test(input)) {
      issues.push('Repetitive patterns detected');
      confidence = Math.max(confidence, 0.7);
    }

    // 大量の特殊文字
    const specialChars = (input.match(/[^\w\s]/g) || []).length;
    if (specialChars > input.length * 0.5) {
      issues.push(`High special character ratio: ${(specialChars / input.length * 100).toFixed(1)}%`);
      confidence = Math.max(confidence, 0.6);
    }

    const blocked = confidence > 0.7 && this.config.vulnerability_protection.auto_block_on_detection;

    return {
      type: 'dos_attack',
      severity: confidence > 0.8 ? 'critical' : confidence > 0.6 ? 'high' : 'medium',
      confidence,
      description: `DoS attack indicators: ${issues.join(', ')}`,
      blocked,
    };
  }

  /**
   * 高度な悪意のあるSnack検出
   */
  private detectMaliciousSnackAdvanced(snackUrl: string): {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    blocked: boolean;
  } {
    let confidence = 0;
    const issues: string[] = [];

    try {
      const url = new URL(snackUrl);

      // 不正なドメイン
      if (!url.hostname.includes('snack.expo')) {
        issues.push('Non-Expo Snack domain');
        confidence = Math.max(confidence, 0.9);
      }

      // 疑わしいパラメータ
      for (const [key, value] of url.searchParams.entries()) {
        if (/<script|javascript:|on\w+=/i.test(value)) {
          issues.push(`XSS in parameter ${key}`);
          confidence = Math.max(confidence, 0.95);
        }
        
        if (value.length > 500) {
          issues.push(`Oversized parameter ${key}`);
          confidence = Math.max(confidence, 0.6);
        }
      }

      // URLの異常な長さ
      if (snackUrl.length > 1000) {
        issues.push(`Long URL: ${snackUrl.length} chars`);
        confidence = Math.max(confidence, 0.7);
      }

    } catch (error) {
      issues.push('Invalid URL format');
      confidence = 1.0;
    }

    const blocked = confidence > 0.8 && this.config.vulnerability_protection.auto_block_on_detection;

    return {
      type: 'malicious_snack',
      severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      confidence,
      description: `Malicious Snack indicators: ${issues.join(', ')}`,
      blocked,
    };
  }

  /**
   * XSS入力サニタイゼーション
   */
  private sanitizeXSSInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * 全体リスク算出
   */
  private calculateOverallRisk(threats: Array<{severity: string}>): 'low' | 'medium' | 'high' | 'critical' {
    if (threats.length === 0) return 'low';

    const severities = threats.map(t => t.severity);
    
    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * セキュリティ統計取得
   */
  public getSecurityStats(): {
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    activeSessions: number;
    blockedIPs: number;
  } {
    const violationsByType: Record<string, number> = {};
    const violationsBySeverity: Record<string, number> = {};

    this.violationLog.forEach(v => {
      violationsByType[v.type] = (violationsByType[v.type] || 0) + 1;
      violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] || 0) + 1;
    });

    return {
      totalViolations: this.violationLog.length,
      violationsByType,
      violationsBySeverity,
      activeSessions: this.sessionLimits.size,
      blockedIPs: this.blockedIPs.size,
    };
  }
} 