import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { PerformanceMonitor, AlertRule, Alert } from '../src/services/performance-monitor.js';
import { Config } from '../src/utils/config.js';

describe('監視・メトリクス・アラートシステム', () => {
  let performanceMonitor: PerformanceMonitor;
  let config: Config;

  beforeAll(async () => {
    // テスト用設定
    config = {
      server: { name: 'test-server', version: '1.0.0', description: 'Test server', host: 'localhost', port: 3000 },
      mcp: { protocol_version: '2024-11-05', stdio: { encoding: 'utf-8', timeout_ms: 5000, max_message_size_bytes: 1048576, line_delimited: true }, http: { enabled: true, port: 3000, cors_enabled: true, timeout_ms: 30000, websocket_upgrade: true }, default_transport: 'stdio' as const },
      storage: { local_filesystem: { base_directory: './test-data', max_size_gb: 1, compression: true, backup_rotation: 3, cleanup_interval_hours: 1 } },
      cache: { memory: { max_size_mb: 50, eviction: 'lru', ttl_seconds: 300 }, redis: { enabled: false, url: 'redis://localhost:6379', max_size_mb: 100, ttl_seconds: 3600, cluster_support: false }, disk: { enabled: true, max_size_gb: 1, ttl_days: 1, compression: true } },
      security: {
        input_validation: { max_tool_args_size_bytes: 2048, max_resource_uri_length: 512, sanitize_file_paths: true, validate_json_schema: true, prevent_code_injection: true, allowed_file_extensions: ['.md'] },
        access_control: { allowed_hosts: ['test.com'], rate_limit_per_session: 2000, session_timeout_minutes: 60, require_authentication: false },
        tool_execution: { sandboxing_enabled: true, blocked_system_calls: ['exec'], resource_limits: { max_memory_mb: 256, max_cpu_time_ms: 5000, max_file_reads: 100, max_network_requests: 50 } },
        vulnerability_protection: { prompt_injection_detection: true, xss_prevention: true, path_traversal_protection: true, dos_attack_protection: true, malicious_snack_detection: true, auto_block_on_detection: true }
      },
      logging: { level: 'error', format: 'json', timestamp: true, outputs: ['console'], file: { enabled: false, path: './test.log', max_size_mb: 10, max_files: 1, max_age_days: 1, compress: true }, include_mcp_events: true, sensitive_data_masking: true, log_requests: false, log_responses: false },
      external_services: {
        expo: { api_base: 'https://api.expo.dev', docs_base: 'https://docs.expo.dev', snack_base: 'https://snack.expo.dev', timeout_ms: 10000, retry_attempts: 3, rate_limit: { requests_per_minute: 100, burst: 20 } },
        typesense: { url: 'http://localhost:8108', api_key: 'test', timeout_ms: 5000, collection_name: 'test' },
        github: { base_url: 'https://api.github.com', timeout_ms: 10000, rate_limit: { requests_per_hour: 1000 } }
      },
      performance: {
        targets: { p95_stdio_latency_ms: 50, p95_search_latency_ms: 100, p95_sdk_lookup_ms: 80, cache_hit_target_percent: 85, concurrent_sessions: 200 },
        monitoring: { enabled: true, metrics_port: 9090, health_check_interval_ms: 1000 }
      },
      features: {
        tools: {
          expo_read_document: { enabled: true, timeout_ms: 5000 },
          expo_search_documents: { enabled: true, timeout_ms: 3000 },
          expo_recommend: { enabled: true, timeout_ms: 2000 },
          expo_get_sdk_module: { enabled: true, timeout_ms: 2000 },
          expo_config_templates: { enabled: true, timeout_ms: 3000 },
          expo_eas_command_builder: { enabled: true, timeout_ms: 1000 },
          expo_code_examples: { enabled: true, timeout_ms: 4000 },
          expo_error_diagnosis: { enabled: true, timeout_ms: 3000 }
        }
      }
    };

    performanceMonitor = new PerformanceMonitor(config);
  });

  beforeEach(() => {
    performanceMonitor.reset();
  });

  afterAll(() => {
    performanceMonitor.stop();
  });

  describe('Prometheusメトリクス収集', () => {
    test('メトリクス出力が正常に生成される', async () => {
      performanceMonitor.start();
      
      // メトリクス記録
      performanceMonitor.recordStdioLatency('initialize', 25, 'success');
      performanceMonitor.recordSearchLatency('documents', 10, 85);
      performanceMonitor.recordSdkLookup('camera', 'latest', 30);
      performanceMonitor.recordToolExecution('expo_read_document', 120, 'success');
      
      // Prometheusメトリクス取得
      const metrics = await performanceMonitor.getPrometheusMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
      
      // 基本メトリクス存在確認
      expect(metrics).toContain('expo_mcp_stdio_latency_ms');
      expect(metrics).toContain('expo_mcp_search_latency_ms');
      expect(metrics).toContain('expo_mcp_sdk_lookup_latency_ms');
      expect(metrics).toContain('expo_mcp_tool_execution_latency_ms');
      expect(metrics).toContain('expo_mcp_memory_usage_mb');
      expect(metrics).toContain('expo_mcp_cpu_usage_percent');
      
      console.log('✅ Prometheusメトリクス出力確認完了');
    });

    test('カスタムラベル付きメトリクスが正常に記録される', async () => {
      performanceMonitor.start();
      
      // プラットフォーム・SDK使用状況記録
      performanceMonitor.recordPlatformUsage('ios', 'build');
      performanceMonitor.recordSdkVersionUsage('sdk-49', 'core');
      performanceMonitor.recordModuleUsage('camera', 'latest', 'ios');
      performanceMonitor.recordSecurityViolation('path_traversal', 'medium');
      
      const metrics = await performanceMonitor.getPrometheusMetrics();
      
      expect(metrics).toContain('expo_mcp_platform_usage_total');
      expect(metrics).toContain('expo_mcp_sdk_version_usage_total');
      expect(metrics).toContain('expo_mcp_module_usage_total');
      expect(metrics).toContain('expo_mcp_security_violations_total');
      
      // ラベル確認
      expect(metrics).toContain('platform="ios"');
      expect(metrics).toContain('sdk_version="sdk-49"');
      expect(metrics).toContain('module_name="camera"');
      expect(metrics).toContain('violation_type="path_traversal"');
      
      console.log('✅ カスタムラベル付きメトリクス確認完了');
    });

    test('ヒストグラムメトリクスのバケット分布が適切', async () => {
      performanceMonitor.start();
      
      // 異なるレイテンシ値を記録
      const latencies = [5, 15, 35, 75, 150, 350, 750, 1500];
      
      for (const latency of latencies) {
        performanceMonitor.recordStdioLatency('test', latency, 'success');
      }
      
      const metrics = await performanceMonitor.getPrometheusMetrics();
      
      // バケット存在確認
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="10"');
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="50"');
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="100"');
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="500"');
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="1000"');
      expect(metrics).toContain('expo_mcp_stdio_latency_ms_bucket{le="+Inf"');
      
      console.log('✅ ヒストグラムバケット分布確認完了');
    });
  });

  describe('アラートシステム', () => {
    test('しきい値超過でアラートが発火する', async () => {
      performanceMonitor.start();
      
      let alertTriggered = false;
      let triggeredAlert: Alert | null = null;
      
      performanceMonitor.on('alert_triggered', (alert: Alert) => {
        alertTriggered = true;
        triggeredAlert = alert;
      });
      
      // しきい値を超えるレイテンシを記録
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordStdioLatency('test', 60, 'success'); // 50ms閾値を超過
      }
      
      // しきい値チェック実行のため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(alertTriggered).toBe(true);
      expect(triggeredAlert).toBeDefined();
      expect(triggeredAlert?.rule.name).toBe('stdio_latency_high');
      expect(triggeredAlert?.rule.severity).toBe('high');
      
      console.log('✅ アラート発火確認完了:', triggeredAlert?.message);
    });

    test('アクティブアラート管理が正常動作', async () => {
      performanceMonitor.start();
      
      // 複数のアラートを発火
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordStdioLatency('test', 60, 'success');
      }
      
      // メモリ使用量アラート発火
      const metrics = performanceMonitor.getMetrics();
      metrics.memory_usage_mb = 1100; // 1024MB閾値を超過
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const activeAlerts = performanceMonitor.getActiveAlerts();
      
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts.some(alert => alert.rule.name === 'stdio_latency_high')).toBe(true);
      
      console.log('✅ アクティブアラート管理確認完了:', activeAlerts.length, 'alerts active');
    });

    test('アラート解決が正常動作', async () => {
      performanceMonitor.start();
      
      let alertResolved = false;
      
      performanceMonitor.on('alert_resolved', () => {
        alertResolved = true;
      });
      
      // アラート発火
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordStdioLatency('test', 60, 'success');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 正常値に戻す
      for (let i = 0; i < 20; i++) {
        performanceMonitor.recordStdioLatency('test', 20, 'success');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(alertResolved).toBe(true);
      
      console.log('✅ アラート解決確認完了');
    });

    test('アラート設定更新が機能する', () => {
      const newConfig = {
        enabled: false,
        rules: [],
        notifications: {
          console: false
        }
      };
      
      performanceMonitor.updateAlertingConfig(newConfig);
      
      // アラートが無効化されていることを確認
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordStdioLatency('test', 100, 'success');
      }
      
      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBe(0);
      
      console.log('✅ アラート設定更新確認完了');
    });
  });

  describe('メトリクスエンドポイント', () => {
    test('レスポンス時間記録メソッドが正常動作', () => {
      performanceMonitor.start();
      
      // 各種レスポンス時間記録
      performanceMonitor.recordStdioLatency('initialize', 25, 'success');
      performanceMonitor.recordSearchLatency('documents', 10, 85);
      performanceMonitor.recordSdkLookup('camera', 'latest', 30);
      performanceMonitor.recordConfigGeneration('app.json', 'medium', 150);
      performanceMonitor.recordToolExecution('expo_read_document', 120, 'success');
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.stdio_latency_ms.count).toBeGreaterThan(0);
      expect(metrics.search_latency_ms.count).toBeGreaterThan(0);
      expect(metrics.sdk_lookup_ms.count).toBeGreaterThan(0);
      expect(metrics.config_generation_ms.count).toBeGreaterThan(0);
      expect(metrics.tool_execution_ms.count).toBeGreaterThan(0);
      
      console.log('✅ レスポンス時間記録確認完了');
    });

    test('使用状況メトリクス記録が正常動作', async () => {
      performanceMonitor.start();
      
      // 使用状況記録
      performanceMonitor.recordPlatformUsage('ios', 'build');
      performanceMonitor.recordSdkVersionUsage('sdk-49', 'core');
      performanceMonitor.recordModuleUsage('camera', 'latest', 'ios');
      performanceMonitor.recordMcpSessionDuration('cursor', 'stdio', 300);
      performanceMonitor.recordMcpProtocolError('invalid_request', 'stdio');
      
      const metrics = await performanceMonitor.getPrometheusMetrics();
      
      expect(metrics).toContain('expo_mcp_platform_usage_total');
      expect(metrics).toContain('expo_mcp_sdk_version_usage_total');
      expect(metrics).toContain('expo_mcp_module_usage_total');
      expect(metrics).toContain('expo_mcp_session_duration_seconds');
      expect(metrics).toContain('expo_mcp_protocol_errors_total');
      
      console.log('✅ 使用状況メトリクス記録確認完了');
    });
  });

  describe('パフォーマンス監視統合', () => {
    test('メトリクス収集オーバーヘッドが許容範囲内', async () => {
      const startTime = performance.now();
      
      performanceMonitor.start();
      
      // 大量のメトリクス記録
      for (let i = 0; i < 1000; i++) {
        performanceMonitor.recordStdioLatency('test', Math.random() * 100, 'success');
        performanceMonitor.recordSearchLatency('test', Math.floor(Math.random() * 50), Math.random() * 200);
        performanceMonitor.recordToolExecution('test', Math.random() * 500, 'success');
      }
      
      const metricsGenTime = performance.now();
      const metrics = await performanceMonitor.getPrometheusMetrics();
      const endTime = performance.now();
      
      const recordingTime = metricsGenTime - startTime;
      const generationTime = endTime - metricsGenTime;
      
      expect(recordingTime).toBeLessThan(100); // 100ms以下
      expect(generationTime).toBeLessThan(50); // 50ms以下
      expect(metrics.length).toBeGreaterThan(0);
      
      console.log('✅ パフォーマンス監視オーバーヘッド確認完了');
      console.log(`   記録時間: ${recordingTime.toFixed(2)}ms`);
      console.log(`   生成時間: ${generationTime.toFixed(2)}ms`);
    });

    test('メモリリーク検出機能が動作', async () => {
      performanceMonitor.start();
      
      // メモリ使用量を監視
      const initialMetrics = performanceMonitor.getMetrics();
      const initialMemory = initialMetrics.memory_usage_mb;
      
      // 大量のデータを生成（メモリリークシミュレーション）
      const largeArrays = [];
      for (let i = 0; i < 100; i++) {
        largeArrays.push(new Array(10000).fill(Math.random()));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMetrics = performanceMonitor.getMetrics();
      const memoryLeak = finalMetrics.memory_leak;
      
      expect(memoryLeak).toBeDefined();
      expect(memoryLeak.heapUsed).toBeGreaterThan(0);
      expect(memoryLeak.heapTotal).toBeGreaterThan(0);
      
      console.log('✅ メモリリーク検出機能確認完了');
      console.log(`   初期メモリ: ${initialMemory.toFixed(2)}MB`);
      console.log(`   最終メモリ: ${finalMetrics.memory_usage_mb.toFixed(2)}MB`);
    });
  });

  describe('監視システム統合テスト', () => {
    test('全監視機能が連携して動作', async () => {
      performanceMonitor.start();
      
      let alertCount = 0;
      performanceMonitor.on('alert_triggered', () => alertCount++);
      
      // 様々なメトリクス記録
      performanceMonitor.recordStdioLatency('initialize', 25, 'success');
      performanceMonitor.recordSearchLatency('documents', 10, 85);
      performanceMonitor.recordToolExecution('expo_read_document', 120, 'success');
      performanceMonitor.recordPlatformUsage('ios', 'build');
      performanceMonitor.recordSecurityViolation('rate_limit', 'low');
      
      // しきい値超過でアラート発火
      for (let i = 0; i < 10; i++) {
        performanceMonitor.recordStdioLatency('test', 60, 'success');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 結果確認
      const metrics = await performanceMonitor.getPrometheusMetrics();
      const activeAlerts = performanceMonitor.getActiveAlerts();
      const performanceMetrics = performanceMonitor.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(alertCount).toBeGreaterThan(0);
      expect(performanceMetrics.total_requests).toBeGreaterThan(0);
      
      console.log('✅ 監視システム統合確認完了');
      console.log(`   アクティブアラート: ${activeAlerts.length}`);
      console.log(`   発火アラート数: ${alertCount}`);
      console.log(`   メトリクスサイズ: ${metrics.length} bytes`);
    });
  });
}); 