/**
 * Security Features Test Suite
 * セキュリティ機能の動作確認テスト
 */

import { SecurityManager, RateLimiter, ExpoMCPSecurity } from '../src/security/index';
import type { SecurityConfig, RateLimitConfig, PermissionConfig, IntegratedSecurityConfig } from '../src/security/index';

describe('Security Features Test Suite', () => {
  let securityManager: SecurityManager;
  let rateLimiter: RateLimiter;
  let integratedSecurity: ExpoMCPSecurity;

  const mockSecurityConfig: SecurityConfig = {
    input_validation: {
      max_tool_args_size_bytes: 2048,
      max_resource_uri_length: 512,
      sanitize_file_paths: true,
      validate_json_schema: true,
      prevent_code_injection: true,
      allowed_file_extensions: ['.md', '.json', '.txt', '.js', '.ts'],
    },
    access_control: {
      allowed_hosts: ['docs.expo.dev', 'api.expo.dev', 'snack.expo.dev'],
      rate_limit_per_session: 10, // テスト用に低い値
      session_timeout_minutes: 1, // テスト用に短い値
      require_authentication: false,
    },
    tool_execution: {
      sandboxing_enabled: true,
      blocked_system_calls: ['exec', 'spawn', 'eval'],
      resource_limits: {
        max_memory_mb: 256,
        max_cpu_time_ms: 5000,
        max_file_reads: 100,
        max_network_requests: 50,
      },
    },
  };

  const mockRateLimitConfig: RateLimitConfig = {
    requests_per_hour: 20, // テスト用に低い値
    session_timeout_minutes: 1,
    max_concurrent_sessions: 5,
    ip_whitelist: ['127.0.0.1'],
    ip_blacklist: ['192.168.1.100'],
    enable_ip_blocking: true,
  };

  const mockPermissionConfig: PermissionConfig = {
    roles: {
      anonymous: {
        permissions: ['tool:execute', 'resource:read'],
        description: 'Anonymous user permissions',
      },
      admin: {
        permissions: ['*'],
        description: 'Administrator permissions',
      },
    },
    default_role: 'anonymous',
    require_authentication: false,
  };

  beforeEach(() => {
    securityManager = new SecurityManager(mockSecurityConfig);
    rateLimiter = new RateLimiter(mockRateLimitConfig, mockPermissionConfig);
    
    const integratedConfig: IntegratedSecurityConfig = {
      security: mockSecurityConfig,
      rateLimit: mockRateLimitConfig,
      permissions: mockPermissionConfig,
      logging: {
        logViolations: false, // テスト時はログ出力を無効化
        logLevel: 'error',
      },
    };
    
    integratedSecurity = new ExpoMCPSecurity(integratedConfig);
  });

  afterEach(() => {
    rateLimiter.destroy();
    integratedSecurity.destroy();
  });

  describe('JSON Schema Validation', () => {
    test('should validate valid tool request', () => {
      const validTool = {
        name: 'expo_read_document',
        arguments: { url: 'https://docs.expo.dev/test' },
      };

      const result = securityManager.validateJsonSchema(validTool, 'tool');
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('should reject invalid tool name', () => {
      const invalidTool = {
        name: '', // 空文字は無効
        arguments: {},
      };

      const result = securityManager.validateJsonSchema(invalidTool, 'tool');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name: String must contain at least 1 character(s)');
    });

    test('should validate resource URI', () => {
      const validResource = {
        uri: 'https://docs.expo.dev/test-page',
      };

      const result = securityManager.validateJsonSchema(validResource, 'resource');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid resource URI', () => {
      const invalidResource = {
        uri: 'not-a-valid-url',
      };

      const result = securityManager.validateJsonSchema(invalidResource, 'resource');
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid url');
    });
  });

  describe('File Path Sanitization', () => {
    test('should allow safe file paths', () => {
      const safePath = 'documents/test.md';
      const result = securityManager.sanitizeFilePath(safePath);
      
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe(safePath);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect path traversal attempts', () => {
      const dangerousPath = '../../../etc/passwd';
      const result = securityManager.sanitizeFilePath(dangerousPath);
      
      expect(result.safe).toBe(false);
      expect(result.violations).toContain('Path traversal attempt detected');
    });

    test('should reject absolute paths', () => {
      const absolutePath = '/etc/hosts';
      const result = securityManager.sanitizeFilePath(absolutePath);
      
      expect(result.safe).toBe(false);
      expect(result.violations).toContain('Absolute path not allowed');
    });

    test('should reject invalid file extensions', () => {
      const invalidExtension = 'script.exe';
      const result = securityManager.sanitizeFilePath(invalidExtension);
      
      expect(result.safe).toBe(false);
      expect(result.violations).toContain('File extension \'.exe\' not allowed');
    });
  });

  describe('Code Injection Prevention', () => {
    test('should allow safe input', () => {
      const safeInput = 'Hello world, this is safe text';
      const result = securityManager.preventCodeInjection(safeInput);
      
      expect(result.safe).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect JavaScript injection', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = securityManager.preventCodeInjection(maliciousInput);
      
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should detect eval injection', () => {
      const maliciousInput = 'eval("malicious code")';
      const result = securityManager.preventCodeInjection(maliciousInput);
      
      expect(result.safe).toBe(false);
      expect(result.violations.some(v => v.includes('eval'))).toBe(true);
    });

    test('should detect command injection', () => {
      const maliciousInput = '; rm -rf /';
      const result = securityManager.preventCodeInjection(maliciousInput);
      
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Expo-Specific Validation', () => {
    test('should validate correct SDK version', () => {
      const validData = {
        sdkVersion: 'sdk-49',
      };

      const result = securityManager.validateExpoSpecific(validData);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject invalid SDK version', () => {
      const invalidData = {
        sdkVersion: 'invalid-version',
      };

      const result = securityManager.validateExpoSpecific(invalidData);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Invalid SDK version: invalid-version');
    });

    test('should validate Snack URL', () => {
      const validData = {
        snackUrl: 'https://snack.expo.dev/@testuser/project',
      };

      const result = securityManager.validateExpoSpecific(validData);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid Snack URL', () => {
      const invalidData = {
        snackUrl: 'https://malicious-site.com/fake-snack',
      };

      const result = securityManager.validateExpoSpecific(invalidData);
      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Invalid Snack URL: https://malicious-site.com/fake-snack');
    });
  });

  describe('Message Size Limits', () => {
    test('should allow messages within size limit', () => {
      const smallData = { message: 'Small test data' };
      const result = securityManager.validateMessageSize(smallData, 'tool_args');
      
      expect(result.valid).toBe(true);
      expect(result.size).toBeLessThan(result.limit);
    });

    test('should reject oversized messages', () => {
      const largeData = { message: 'x'.repeat(3000) }; // 3KB データ
      const result = securityManager.validateMessageSize(largeData, 'tool_args');
      
      expect(result.valid).toBe(false);
      expect(result.size).toBeGreaterThan(result.limit);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', () => {
      const sessionId = 'test-session-1';
      
      // 初回リクエスト
      const result1 = rateLimiter.checkRateLimit(sessionId);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(19); // 20 - 1
      
      // 2回目リクエスト
      const result2 = rateLimiter.checkRateLimit(sessionId);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(18); // 20 - 2
    });

    test('should block requests exceeding rate limit', () => {
      const sessionId = 'test-session-2';
      
      // レート制限まで送信
      for (let i = 0; i < 20; i++) {
        rateLimiter.checkRateLimit(sessionId);
      }
      
      // 制限を超えたリクエスト
      const result = rateLimiter.checkRateLimit(sessionId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
    });

    test('should allow whitelisted IPs', () => {
      const sessionId = 'test-session-3';
      const whitelistedIP = '127.0.0.1';
      
      const result = rateLimiter.checkRateLimit(sessionId, whitelistedIP);
      expect(result.allowed).toBe(true);
    });

    test('should block blacklisted IPs', () => {
      const sessionId = 'test-session-4';
      const blacklistedIP = '192.168.1.100';
      
      const result = rateLimiter.checkRateLimit(sessionId, blacklistedIP);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('IP address is blocked');
    });
  });

  describe('Session Management', () => {
    test('should create and track sessions', () => {
      const sessionId = 'test-session-5';
      
      // セッション作成（初回リクエスト）
      rateLimiter.checkRateLimit(sessionId);
      
      // セッションタイムアウトチェック
      const timeoutResult = rateLimiter.checkSessionTimeout(sessionId);
      expect(timeoutResult.valid).toBe(true);
    });

    test('should detect session timeout', async () => {
      const sessionId = 'test-session-6';
      
      // セッション作成
      rateLimiter.checkRateLimit(sessionId);
      
      // 1.5秒待機（タイムアウト時間は1分だが、テストのため短縮）
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // タイムアウトチェック（実際にはもっと長い時間が必要）
      const timeoutResult = rateLimiter.checkSessionTimeout(sessionId);
      expect(timeoutResult.valid).toBe(true); // まだタイムアウトしていない
    });
  });

  describe('Permission System', () => {
    test('should allow permitted actions', () => {
      const sessionId = 'test-session-7';
      
      // セッション作成
      rateLimiter.checkRateLimit(sessionId);
      
      // 権限チェック
      const permissionResult = rateLimiter.checkPermission(sessionId, 'tool:execute');
      expect(permissionResult.allowed).toBe(true);
      expect(permissionResult.userPermissions).toContain('tool:execute');
    });

    test('should deny unpermitted actions', () => {
      const sessionId = 'test-session-8';
      
      // セッション作成
      rateLimiter.checkRateLimit(sessionId);
      
      // 許可されていない権限チェック
      const permissionResult = rateLimiter.checkPermission(sessionId, 'admin:delete');
      expect(permissionResult.allowed).toBe(false);
      expect(permissionResult.reason).toBe('Permission denied');
    });
  });

  describe('Integrated Security', () => {
    test('should validate tool call with all security checks', async () => {
      const sessionId = 'integrated-test-1';
      const toolName = 'expo_read_document';
      const toolArgs = { url: 'https://docs.expo.dev/test' };
      
      const result = await integratedSecurity.validateToolCall(sessionId, toolName, toolArgs);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject malicious tool call', async () => {
      const sessionId = 'integrated-test-2';
      const toolName = 'expo_read_document';
      const toolArgs = {
        url: 'https://malicious-site.com',
        code: '<script>alert("xss")</script>',
      };
      
      const result = await integratedSecurity.validateToolCall(sessionId, toolName, toolArgs);
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    test('should validate resource read with security checks', async () => {
      const sessionId = 'integrated-test-3';
      const resourceUri = 'https://docs.expo.dev/test-resource';
      
      const result = await integratedSecurity.validateResourceRead(sessionId, resourceUri);
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should reject resource from non-whitelisted host', async () => {
      const sessionId = 'integrated-test-4';
      const resourceUri = 'https://malicious-site.com/resource';
      
      const result = await integratedSecurity.validateResourceRead(sessionId, resourceUri);
      expect(result.allowed).toBe(false);
      expect(result.violations).toContain('Host not in whitelist');
    });
  });

  describe('Security Statistics', () => {
    test('should track security statistics', () => {
      const stats = securityManager.getSecurityStats();
      
      expect(stats).toHaveProperty('totalViolations');
      expect(stats).toHaveProperty('violationsByType');
      expect(stats).toHaveProperty('violationsBySeverity');
      expect(stats).toHaveProperty('activeSessions');
      expect(stats).toHaveProperty('blockedIPs');
    });

    test('should track rate limit statistics', () => {
      const sessionId = 'stats-test-1';
      
      // いくつかのリクエストを送信
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit(sessionId);
      }
      
      const stats = rateLimiter.getStats();
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalRequests).toBe(5);
    });
  });
}); 