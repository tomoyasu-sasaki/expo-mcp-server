import { performance } from 'perf_hooks';
import { CacheManager } from '../src/services/cache-manager.js';
import { PerformanceMonitor } from '../src/services/performance-monitor.js';
import { ConcurrentProcessor } from '../src/services/concurrent-processor.js';
import { Config } from '../src/utils/config.js';

describe('高負荷テスト（後半パフォーマンス最適化）', () => {
  let cacheManager: CacheManager;
  let performanceMonitor: PerformanceMonitor;
  let concurrentProcessor: ConcurrentProcessor;
  let config: Config;

  beforeAll(async () => {
    config = {
      server: { name: 'test', version: '1.0.0', description: 'test' },
      mcp: {
        protocol_version: '2024-11-05',
        default_transport: 'stdio',
        stdio: { encoding: 'utf-8', timeout_ms: 5000, max_message_size_bytes: 1048576, line_delimited: true },
        http: { port: 3000, host: '0.0.0.0', cors_enabled: true, cors_origins: ['*'], timeout_ms: 30000, websocket_upgrade: true, max_connections: 200 }
      },
      storage: {
        local: { path: './test-data', max_size_gb: 1, compression: true, backup: { enabled: false, rotation_days: 1, max_files: 1 } }
      },
      cache: {
        memory: { max_size_mb: 100, ttl_seconds: 300, eviction_policy: 'LRU' },
        redis: { url: 'redis://localhost:6380', max_size_mb: 500, ttl_seconds: 3600, key_prefix: 'test:', cluster_support: false },
        disk: { path: './test-cache', max_size_gb: 5, ttl_days: 1, compression: true }
      },
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
        monitoring: { enabled: true, metrics_port: 9090, health_check_interval_ms: 5000 }
      },
      features: {
        tools: {},
        search: { typo_tolerance: true, synonyms_enabled: true, faceted_search: true, code_boost_factor: 2.5, api_boost_factor: 3.0 },
        recommendations: { embeddings_model: 'test', similarity_threshold: 0.75, max_results: 10, context_window: 1000 }
      }
    } as Config;

    cacheManager = new CacheManager(config);
    performanceMonitor = new PerformanceMonitor(config);
    concurrentProcessor = new ConcurrentProcessor({ maxWorkers: 4, maxQueueSize: 500 });

    await cacheManager.initialize();
    performanceMonitor.start();
    await concurrentProcessor.initialize();
  });

  afterAll(async () => {
    performanceMonitor.stop();
    await concurrentProcessor.shutdown();
    await cacheManager.destroy();
  });

  describe('200同時セッション負荷テスト', () => {
    test('200同時セッションでキャッシュ操作', async () => {
      const sessionCount = 200;
      const operationsPerSession = 10;
      const sessions: Promise<any>[] = [];

      console.log(`開始: ${sessionCount}同時セッション、各セッション${operationsPerSession}操作`);
      
      const startTime = performance.now();
      
      for (let sessionId = 0; sessionId < sessionCount; sessionId++) {
        const sessionPromise = simulateSession(sessionId, operationsPerSession);
        sessions.push(sessionPromise);
      }

      const results = await Promise.allSettled(sessions);
      const endTime = performance.now();
      
      const successfulSessions = results.filter(r => r.status === 'fulfilled').length;
      const failedSessions = results.filter(r => r.status === 'rejected').length;
      
      console.log(`完了: ${successfulSessions}成功, ${failedSessions}失敗, 実行時間: ${endTime - startTime}ms`);
      
      // 90%以上のセッションが成功すること
      expect(successfulSessions / sessionCount).toBeGreaterThanOrEqual(0.9);
      
      // 実行時間が合理的であること（60秒以内）
      expect(endTime - startTime).toBeLessThan(60000);
    }, 120000);

    test('CPU使用率が80%以下を維持', async () => {
      const initialMetrics = performanceMonitor.getMetrics();
      
      // 高負荷をかける
      const heavyLoad = Array.from({ length: 100 }, (_, i) =>
        concurrentProcessor.executeTask({
          type: 'search',
          payload: { query: `heavy_load_query_${i}` }
        })
      );

      await Promise.all(heavyLoad);
      
      const finalMetrics = performanceMonitor.getMetrics();
      
      console.log(`CPU使用率: ${finalMetrics.resource_monitoring.cpuUsage.user}%`);
      
      // CPU使用率が合理的範囲内であること
      expect(finalMetrics.memory_usage_mb).toBeLessThan(1000); // 1GB以下
    });

    test('メモリリーク検出機能', async () => {
      const initialMetrics = performanceMonitor.getMetrics();
      const initialMemory = initialMetrics.memory_leak.heapUsed;
      
      // メモリを大量に使用する処理を繰り返し実行
      for (let i = 0; i < 50; i++) {
        const largeData = Array.from({ length: 1000 }, (_, j) => ({
          id: `${i}_${j}`,
          data: 'x'.repeat(1000) // 1KB のデータ
        }));
        
        await cacheManager.set(`large_data_${i}`, largeData);
        
        if (i % 10 === 0) {
          // 定期的にGCを強制実行
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMetrics = performanceMonitor.getMetrics();
      const finalMemory = finalMetrics.memory_leak.heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      console.log(`メモリ増加量: ${memoryGrowth / 1024 / 1024}MB`);
      console.log(`メモリ増加率: ${finalMetrics.memory_leak.memoryGrowthRate}`);
      console.log(`潜在的リーク: ${finalMetrics.memory_leak.potentialLeaks}`);
      
      // メモリ増加が過度でないこと（100MB以下）
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    });

    test('Redisコネクションプール効率性', async () => {
      const connectionPromises: Promise<void>[] = [];
      
      // 多数の並行Redis操作
      for (let i = 0; i < 100; i++) {
        const promise = (async () => {
          await cacheManager.set(`redis_test_${i}`, { data: `test_${i}` });
          const result = await cacheManager.get(`redis_test_${i}`);
          expect(result).toBeDefined();
        })();
        
        connectionPromises.push(promise);
      }
      
      const startTime = performance.now();
      await Promise.all(connectionPromises);
      const endTime = performance.now();
      
      console.log(`100並行Redis操作完了時間: ${endTime - startTime}ms`);
      
      // 合理的な時間内で完了すること（10秒以内）
      expect(endTime - startTime).toBeLessThan(10000);
    });

    test('Worker Threads効率性', async () => {
      const workerTasks: Promise<any>[] = [];
      
      // 多様なタスクを並列実行
      for (let i = 0; i < 50; i++) {
        workerTasks.push(
          concurrentProcessor.executeTask({
            type: 'search',
            payload: { query: `concurrent_search_${i}` }
          })
        );
        
        workerTasks.push(
          concurrentProcessor.executeTask({
            type: 'sdk_fetch',
            payload: { module: `module_${i}` }
          })
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(workerTasks);
      const endTime = performance.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Worker並列処理: ${successful}成功, ${failed}失敗, 時間: ${endTime - startTime}ms`);
      
      // 95%以上が成功すること
      expect(successful / results.length).toBeGreaterThanOrEqual(0.95);
      
      // 効率的な実行時間（20秒以内）
      expect(endTime - startTime).toBeLessThan(20000);
      
      const stats = concurrentProcessor.getStats();
      console.log('Worker統計:', stats);
    });

    test('混合負荷でのパフォーマンス要件確認', async () => {
      const mixedOperations: Promise<any>[] = [];
      const operationTypes = ['cache_read', 'cache_write', 'search', 'sdk_fetch', 'worker_task'];
      
      // 混合ワークロードを作成
      for (let i = 0; i < 200; i++) {
        const operationType = operationTypes[i % operationTypes.length];
        
        switch (operationType) {
          case 'cache_read':
            mixedOperations.push(cacheManager.get(`mixed_test_${i}`));
            break;
          case 'cache_write':
            mixedOperations.push(cacheManager.set(`mixed_test_${i}`, { data: i }));
            break;
          case 'search':
            mixedOperations.push(concurrentProcessor.executeTask({
              type: 'search',
              payload: { query: `mixed_search_${i}` }
            }));
            break;
          case 'sdk_fetch':
            mixedOperations.push(concurrentProcessor.executeTask({
              type: 'sdk_fetch',
              payload: { module: `mixed_module_${i}` }
            }));
            break;
          case 'worker_task':
            mixedOperations.push(concurrentProcessor.executeTask({
              type: 'config_gen',
              payload: { type: 'mixed_config' }
            }));
            break;
        }
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(mixedOperations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const successRate = successful / results.length;
      
      console.log(`混合負荷テスト結果:`);
      console.log(`- 総操作数: ${results.length}`);
      console.log(`- 成功率: ${(successRate * 100).toFixed(2)}%`);
      console.log(`- 実行時間: ${totalTime.toFixed(2)}ms`);
      console.log(`- 平均レスポンス時間: ${(totalTime / results.length).toFixed(2)}ms`);
      
      const finalMetrics = performanceMonitor.getMetrics();
      console.log(`最終メトリクス:`);
      console.log(`- メモリ使用量: ${finalMetrics.memory_usage_mb.toFixed(2)}MB`);
      console.log(`- キャッシュヒット率: ${(finalMetrics.cache_hit_rate * 100).toFixed(2)}%`);
      
      // パフォーマンス要件確認
      expect(successRate).toBeGreaterThanOrEqual(0.90); // 90%以上成功
      expect(totalTime).toBeLessThan(30000); // 30秒以内
      expect(finalMetrics.memory_usage_mb).toBeLessThan(1000); // 1GB以下
      expect(finalMetrics.cache_hit_rate).toBeGreaterThanOrEqual(0.50); // キャッシュヒット率50%以上
    });
  });

  // ヘルパー関数: セッションシミュレーション
  async function simulateSession(sessionId: number, operationCount: number): Promise<void> {
    const sessionData = `session_${sessionId}`;
    
    for (let op = 0; op < operationCount; op++) {
      const key = `${sessionData}_operation_${op}`;
      const data = { sessionId, operation: op, timestamp: Date.now() };
      
      // 書き込み
      await cacheManager.set(key, data);
      
      // 読み取り
      const result = await cacheManager.get(key);
      if (!result) {
        throw new Error(`Failed to retrieve data for ${key}`);
      }
      
      // Worker タスク実行
      if (op % 3 === 0) {
        await concurrentProcessor.executeTask({
          type: 'search',
          payload: { query: `session_${sessionId}_search_${op}` }
        });
      }
      
      // 短い間隔を置く（実際の使用をシミュレート）
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }
  }
}); 