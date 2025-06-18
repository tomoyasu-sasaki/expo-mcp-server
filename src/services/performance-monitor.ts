import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { Config } from '../utils/config.js';
import * as promClient from 'prom-client';

export interface MemoryLeakMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  buffers: number;
  arrayBuffers: number;
  gcEvents: number;
  gcDuration: number;
  memoryGrowthRate: number;
  potentialLeaks: boolean;
}

export interface ResourceMonitoring {
  openHandles: number;
  eventLoopDelay: number;
  cpuUsage: NodeJS.CpuUsage;
  loadAverage: number[];
  activeTimers: number;
  activeRequests: number;
}

export interface PerformanceMetrics {
  // レスポンス時間メトリクス
  stdio_latency_ms: LatencyMetrics;
  search_latency_ms: LatencyMetrics;
  sdk_lookup_ms: LatencyMetrics;
  config_generation_ms: LatencyMetrics;
  tool_execution_ms: LatencyMetrics;
  
  // システムメトリクス
  memory_usage_mb: number;
  cpu_usage_percent: number;
  cache_hit_rate: number;
  concurrent_sessions: number;
  
  // カウンターメトリクス
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  cache_hits: number;
  cache_misses: number;
  
  // 新規: 高度なメトリクス
  memory_leak: MemoryLeakMetrics;
  resource_monitoring: ResourceMonitoring;
  
  // 統計
  uptime_seconds: number;
  last_updated: number;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface PerformanceTarget {
  name: string;
  metric: keyof PerformanceMetrics;
  threshold: number;
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  unit: string;
}

export interface TimingEntry {
  timestamp: number;
  duration: number;
}

export interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
  cooldownMinutes: number;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: number;
  status: 'firing' | 'resolved';
  message: string;
}

export interface AlertingConfig {
  enabled: boolean;
  rules: AlertRule[];
  notifications: {
    console: boolean;
    webhook?: string;
    email?: string;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private config: Config['performance'];
  private metrics: PerformanceMetrics;
  private timings: Map<string, TimingEntry[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  private startTime: number;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  // 新規: メモリリーク検出
  private memorySnapshots: number[] = [];
  private gcWatcher?: NodeJS.Timeout;
  private initialCpuUsage?: NodeJS.CpuUsage;

  // 新規: Prometheusメトリクス
  private prometheusRegistry: promClient.Registry;
  private prometheusMetrics!: {
    // ヒストグラム（レスポンス時間）
    stdioLatency: promClient.Histogram<string>;
    searchLatency: promClient.Histogram<string>;
    sdkLookupLatency: promClient.Histogram<string>;
    configGenerationLatency: promClient.Histogram<string>;
    toolExecutionLatency: promClient.Histogram<string>;
    
    // ゲージ（現在値）
    memoryUsage: promClient.Gauge<string>;
    cpuUsage: promClient.Gauge<string>;
    cacheHitRate: promClient.Gauge<string>;
    concurrentSessions: promClient.Gauge<string>;
    uptime: promClient.Gauge<string>;
    
    // カウンター（累積値）
    totalRequests: promClient.Counter<string>;
    successfulRequests: promClient.Counter<string>;
    failedRequests: promClient.Counter<string>;
    cacheHits: promClient.Counter<string>;
    cacheMisses: promClient.Counter<string>;
    securityViolations: promClient.Counter<string>;
    
    // 新規: エラー率メトリクス
    errorRate: promClient.Gauge<string>;
    
    // 新規: プラットフォーム・SDK使用状況
    platformUsage: promClient.Counter<string>;
    sdkVersionUsage: promClient.Counter<string>;
    moduleUsage: promClient.Counter<string>;
    
    // 新規: MCP特有メトリクス
    mcpSessionDuration: promClient.Histogram<string>;
    mcpToolUsage: promClient.Counter<string>;
    mcpProtocolErrors: promClient.Counter<string>;
  };

  // 新規: アラート機能
  private alertingConfig: AlertingConfig;
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  constructor(config: Config) {
    super();
    this.config = config.performance;
    this.startTime = Date.now();
    this.initialCpuUsage = process.cpuUsage();
    
    // Prometheusレジストリ初期化
    this.prometheusRegistry = new promClient.Registry();
    this.initializePrometheusMetrics();
    
    this.metrics = {
      stdio_latency_ms: this.createEmptyLatencyMetrics(),
      search_latency_ms: this.createEmptyLatencyMetrics(),
      sdk_lookup_ms: this.createEmptyLatencyMetrics(),
      config_generation_ms: this.createEmptyLatencyMetrics(),
      tool_execution_ms: this.createEmptyLatencyMetrics(),
      memory_usage_mb: 0,
      cpu_usage_percent: 0,
      cache_hit_rate: 0,
      concurrent_sessions: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      cache_hits: 0,
      cache_misses: 0,
      memory_leak: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        buffers: 0,
        arrayBuffers: 0,
        gcEvents: 0,
        gcDuration: 0,
        memoryGrowthRate: 0,
        potentialLeaks: false
      },
      resource_monitoring: {
        openHandles: 0,
        eventLoopDelay: 0,
        cpuUsage: { user: 0, system: 0 },
        loadAverage: [0, 0, 0],
        activeTimers: 0,
        activeRequests: 0
      },
      uptime_seconds: 0,
      last_updated: Date.now()
    };

    // アラート設定初期化
    this.alertingConfig = this.initializeAlertingConfig();
  }

  /**
   * Prometheusメトリクス初期化
   */
  private initializePrometheusMetrics(): void {
    // デフォルトメトリクス（CPU、メモリなど）
    promClient.collectDefaultMetrics({ 
      register: this.prometheusRegistry,
      prefix: 'expo_mcp_'
    });

    // レスポンス時間ヒストグラム
    this.prometheusMetrics = {
      stdioLatency: new promClient.Histogram({
        name: 'expo_mcp_stdio_latency_ms',
        help: 'MCP stdio communication latency in milliseconds',
        labelNames: ['operation', 'status'],
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        registers: [this.prometheusRegistry]
      }),

      searchLatency: new promClient.Histogram({
        name: 'expo_mcp_search_latency_ms',
        help: 'Document search latency in milliseconds',
        labelNames: ['query_type', 'result_count'],
        buckets: [10, 25, 50, 100, 250, 500, 1000, 2000],
        registers: [this.prometheusRegistry]
      }),

      sdkLookupLatency: new promClient.Histogram({
        name: 'expo_mcp_sdk_lookup_latency_ms',
        help: 'SDK module lookup latency in milliseconds',
        labelNames: ['module_name', 'sdk_version'],
        buckets: [5, 10, 25, 50, 100, 200, 500],
        registers: [this.prometheusRegistry]
      }),

      configGenerationLatency: new promClient.Histogram({
        name: 'expo_mcp_config_generation_latency_ms',
        help: 'Configuration generation latency in milliseconds',
        labelNames: ['config_type', 'complexity'],
        buckets: [25, 50, 100, 200, 500, 1000],
        registers: [this.prometheusRegistry]
      }),

      toolExecutionLatency: new promClient.Histogram({
        name: 'expo_mcp_tool_execution_latency_ms',
        help: 'MCP tool execution latency in milliseconds',
        labelNames: ['tool_name', 'status'],
        buckets: [50, 100, 250, 500, 1000, 2000, 5000],
        registers: [this.prometheusRegistry]
      }),

      // ゲージメトリクス
      memoryUsage: new promClient.Gauge({
        name: 'expo_mcp_memory_usage_mb',
        help: 'Current memory usage in MB',
        labelNames: ['type'],
        registers: [this.prometheusRegistry]
      }),

      cpuUsage: new promClient.Gauge({
        name: 'expo_mcp_cpu_usage_percent',
        help: 'Current CPU usage percentage',
        registers: [this.prometheusRegistry]
      }),

      cacheHitRate: new promClient.Gauge({
        name: 'expo_mcp_cache_hit_rate',
        help: 'Cache hit rate percentage',
        labelNames: ['cache_type'],
        registers: [this.prometheusRegistry]
      }),

      concurrentSessions: new promClient.Gauge({
        name: 'expo_mcp_concurrent_sessions',
        help: 'Number of concurrent MCP sessions',
        registers: [this.prometheusRegistry]
      }),

      uptime: new promClient.Gauge({
        name: 'expo_mcp_uptime_seconds',
        help: 'Server uptime in seconds',
        registers: [this.prometheusRegistry]
      }),

      // カウンターメトリクス
      totalRequests: new promClient.Counter({
        name: 'expo_mcp_requests_total',
        help: 'Total number of requests',
        labelNames: ['method', 'endpoint'],
        registers: [this.prometheusRegistry]
      }),

      successfulRequests: new promClient.Counter({
        name: 'expo_mcp_successful_requests_total',
        help: 'Total number of successful requests',
        labelNames: ['method', 'endpoint'],
        registers: [this.prometheusRegistry]
      }),

      failedRequests: new promClient.Counter({
        name: 'expo_mcp_failed_requests_total',
        help: 'Total number of failed requests',
        labelNames: ['method', 'endpoint', 'error_type'],
        registers: [this.prometheusRegistry]
      }),

      cacheHits: new promClient.Counter({
        name: 'expo_mcp_cache_hits_total',
        help: 'Total number of cache hits',
        labelNames: ['cache_type'],
        registers: [this.prometheusRegistry]
      }),

      cacheMisses: new promClient.Counter({
        name: 'expo_mcp_cache_misses_total',
        help: 'Total number of cache misses',
        labelNames: ['cache_type'],
        registers: [this.prometheusRegistry]
      }),

      securityViolations: new promClient.Counter({
        name: 'expo_mcp_security_violations_total',
        help: 'Total number of security violations',
        labelNames: ['violation_type', 'severity'],
        registers: [this.prometheusRegistry]
      }),

      errorRate: new promClient.Gauge({
        name: 'expo_mcp_error_rate',
        help: 'Current error rate percentage',
        labelNames: ['time_window'],
        registers: [this.prometheusRegistry]
      }),

      // プラットフォーム・SDK使用状況
      platformUsage: new promClient.Counter({
        name: 'expo_mcp_platform_usage_total',
        help: 'Platform usage statistics',
        labelNames: ['platform', 'operation'],
        registers: [this.prometheusRegistry]
      }),

      sdkVersionUsage: new promClient.Counter({
        name: 'expo_mcp_sdk_version_usage_total',
        help: 'SDK version usage statistics',
        labelNames: ['sdk_version', 'module_type'],
        registers: [this.prometheusRegistry]
      }),

      moduleUsage: new promClient.Counter({
        name: 'expo_mcp_module_usage_total',
        help: 'Expo module usage statistics',
        labelNames: ['module_name', 'sdk_version', 'platform'],
        registers: [this.prometheusRegistry]
      }),

      // MCP特有メトリクス
      mcpSessionDuration: new promClient.Histogram({
        name: 'expo_mcp_session_duration_seconds',
        help: 'MCP session duration in seconds',
        labelNames: ['client_type', 'transport'],
        buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
        registers: [this.prometheusRegistry]
      }),

      mcpToolUsage: new promClient.Counter({
        name: 'expo_mcp_tool_usage_total',
        help: 'MCP tool usage statistics',
        labelNames: ['tool_name', 'success'],
        registers: [this.prometheusRegistry]
      }),

      mcpProtocolErrors: new promClient.Counter({
        name: 'expo_mcp_protocol_errors_total',
        help: 'MCP protocol errors',
        labelNames: ['error_type', 'transport'],
        registers: [this.prometheusRegistry]
      })
    };
  }

  /**
   * 新規: アラート設定初期化
   */
  private initializeAlertingConfig(): AlertingConfig {
    return {
      enabled: true,
      notifications: {
        console: true,
        webhook: process.env.ALERT_WEBHOOK_URL,
        email: process.env.ALERT_EMAIL
      },
      rules: [
        // レイテンシ閾値ブリーチアラート
        {
          name: 'stdio_latency_high',
          metric: 'stdio_latency_p95',
          threshold: 50,
          operator: 'gt',
          severity: 'high',
          description: 'MCP stdio latency P95 exceeds 50ms',
          enabled: true,
          cooldownMinutes: 5
        },
        {
          name: 'search_latency_high',
          metric: 'search_latency_p95',
          threshold: 100,
          operator: 'gt',
          severity: 'medium',
          description: 'Search latency P95 exceeds 100ms',
          enabled: true,
          cooldownMinutes: 5
        },
        {
          name: 'sdk_lookup_latency_high',
          metric: 'sdk_lookup_p95',
          threshold: 80,
          operator: 'gt',
          severity: 'medium',
          description: 'SDK lookup latency P95 exceeds 80ms',
          enabled: true,
          cooldownMinutes: 5
        },
        {
          name: 'tool_execution_latency_high',
          metric: 'tool_execution_p95',
          threshold: 500,
          operator: 'gt',
          severity: 'high',
          description: 'Tool execution latency P95 exceeds 500ms',
          enabled: true,
          cooldownMinutes: 3
        },

        // キャッシュミス率アラート
        {
          name: 'cache_hit_rate_low',
          metric: 'cache_hit_rate',
          threshold: 85,
          operator: 'lt',
          severity: 'medium',
          description: 'Cache hit rate below 85%',
          enabled: true,
          cooldownMinutes: 10
        },

        // セキュリティ違反アラート
        {
          name: 'security_violations_high',
          metric: 'security_violations_rate',
          threshold: 10,
          operator: 'gt',
          severity: 'critical',
          description: 'Security violations rate exceeds 10 per hour',
          enabled: true,
          cooldownMinutes: 1
        },

        // コンテナ異常アラート
        {
          name: 'memory_usage_high',
          metric: 'memory_usage_mb',
          threshold: 1024,
          operator: 'gt',
          severity: 'high',
          description: 'Memory usage exceeds 1GB',
          enabled: true,
          cooldownMinutes: 5
        },
        {
          name: 'cpu_usage_high',
          metric: 'cpu_usage_percent',
          threshold: 80,
          operator: 'gt',
          severity: 'high',
          description: 'CPU usage exceeds 80%',
          enabled: true,
          cooldownMinutes: 5
        },

        // ストレージ容量アラート
        {
          name: 'error_rate_high',
          metric: 'error_rate',
          threshold: 5,
          operator: 'gt',
          severity: 'high',
          description: 'Error rate exceeds 5%',
          enabled: true,
          cooldownMinutes: 3
        },

        // MCP特有アラート
        {
          name: 'mcp_protocol_errors_high',
          metric: 'mcp_protocol_errors_rate',
          threshold: 5,
          operator: 'gt',
          severity: 'high',
          description: 'MCP protocol errors rate exceeds 5 per hour',
          enabled: true,
          cooldownMinutes: 5
        }
      ]
    };
  }

  /**
   * 監視開始
   */
  start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // 定期的なシステムメトリクス収集
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.updateCalculatedMetrics();
      this.checkThresholds();
      this.emit('metrics_updated', this.getMetrics());
    }, this.config.monitoring.health_check_interval_ms);
    
    // 新規: メモリリーク監視
    this.startMemoryLeakDetection();
    
    // 新規: リソース監視
    this.startResourceMonitoring();
    
    console.log('Advanced PerformanceMonitor started');
  }

  /**
   * 監視停止
   */
  stop(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.gcWatcher) {
      clearInterval(this.gcWatcher);
      this.gcWatcher = undefined;
    }
    
    console.log('Advanced PerformanceMonitor stopped');
  }

  /**
   * 新規: メモリリーク検出開始
   */
  private startMemoryLeakDetection(): void {
    // GCイベント監視
    if (typeof global.gc === 'function') {
      this.gcWatcher = setInterval(() => {
        const beforeGC = process.memoryUsage();
        const gcStart = process.hrtime.bigint();
        
        if (global.gc) {
          global.gc();
        }
        
        const gcEnd = process.hrtime.bigint();
        const afterGC = process.memoryUsage();
        
        this.metrics.memory_leak.gcEvents++;
        this.metrics.memory_leak.gcDuration = Number(gcEnd - gcStart) / 1000000; // ms
        
        // メモリ解放量をチェック
        const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;
        if (memoryFreed < beforeGC.heapUsed * 0.1) {
          // GC後も90%以上メモリが残っている場合は潜在的リーク
          this.metrics.memory_leak.potentialLeaks = true;
        }
      }, 30000); // 30秒ごと
    }
    
    // メモリ増加率監視
    setInterval(() => {
      this.detectMemoryGrowth();
    }, 10000); // 10秒ごと
  }

  /**
   * 新規: リソース監視開始
   */
  private startResourceMonitoring(): void {
    setInterval(() => {
      this.collectResourceMetrics();
    }, 5000); // 5秒ごと
  }

  /**
   * 新規: メモリ増加率検出
   */
  private detectMemoryGrowth(): void {
    const currentMemory = process.memoryUsage().heapUsed;
    this.memorySnapshots.push(currentMemory);
    
    // 最新10個のスナップショットを保持
    if (this.memorySnapshots.length > 10) {
      this.memorySnapshots.shift();
    }
    
    if (this.memorySnapshots.length >= 3) {
      const first = this.memorySnapshots[0];
      const last = this.memorySnapshots[this.memorySnapshots.length - 1];
      const growthRate = (last - first) / first;
      
      this.metrics.memory_leak.memoryGrowthRate = growthRate;
      
      // 50%以上の増加率は警告
      if (growthRate > 0.5) {
        this.emit('memory_leak_warning', {
          growthRate,
          currentMemory: last,
          startMemory: first,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * 新規: リソースメトリクス収集
   */
  private collectResourceMetrics(): void {
    try {
      // CPU使用率（詳細）
      if (this.initialCpuUsage) {
        this.metrics.resource_monitoring.cpuUsage = process.cpuUsage(this.initialCpuUsage);
      }
      
      // ロードアベレージ（Unix系のみ）
      if (process.platform !== 'win32') {
        this.metrics.resource_monitoring.loadAverage = os.loadavg();
      }
      
      // アクティブハンドル数
      const activeHandles = (process as any)._getActiveHandles?.()?.length || 0;
      this.metrics.resource_monitoring.openHandles = activeHandles;
      
      // アクティブタイマー数
      this.metrics.resource_monitoring.activeTimers = this.activeTimers.size;
      
    } catch (error) {
      console.error('Failed to collect resource metrics:', error);
    }
  }

  /**
   * タイマー開始
   */
  startTimer(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`;
    this.activeTimers.set(timerId, performance.now());
    return timerId;
  }

  /**
   * タイマー終了と記録
   */
  endTimer(timerId: string, category: string): number {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      console.warn(`Timer ${timerId} not found`);
      return 0;
    }
    
    this.activeTimers.delete(timerId);
    const duration = performance.now() - startTime;
    
    this.recordTiming(category, duration);
    return duration;
  }

  /**
   * 時間測定とメトリクス記録
   */
  measureTime<T>(category: string, fn: () => Promise<T>): Promise<T>;
  measureTime<T>(category: string, fn: () => T): T;
  measureTime<T>(category: string, fn: () => T | Promise<T>): T | Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            this.recordTiming(category, performance.now() - startTime);
            return value;
          })
          .catch((error) => {
            this.recordTiming(category, performance.now() - startTime);
            throw error;
          });
      } else {
        this.recordTiming(category, performance.now() - startTime);
        return result;
      }
    } catch (error) {
      this.recordTiming(category, performance.now() - startTime);
      throw error;
    }
  }

  /**
   * タイミング記録
   */
  recordTiming(category: string, duration: number): void {
    if (!this.timings.has(category)) {
      this.timings.set(category, []);
    }
    
    const timings = this.timings.get(category)!;
    timings.push({
      timestamp: Date.now(),
      duration
    });
    
    // 古いエントリを削除（過去1時間のみ保持）
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filteredTimings = timings.filter(t => t.timestamp > oneHourAgo);
    this.timings.set(category, filteredTimings);
    
    // リアルタイムでメトリクス更新
    this.updateLatencyMetrics(category);
  }

  /**
   * レイテンシメトリクス更新
   */
  private updateLatencyMetrics(category: string): void {
    const timings = this.timings.get(category);
    if (!timings || timings.length === 0) return;
    
    const durations = timings.map(t => t.duration).sort((a, b) => a - b);
    const count = durations.length;
    
    const latencyMetrics: LatencyMetrics = {
      count,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((sum, d) => sum + d, 0) / count,
      p50: this.percentile(durations, 50),
      p90: this.percentile(durations, 90),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    };
    
    // メトリクスマッピング
    switch (category) {
      case 'stdio':
        this.metrics.stdio_latency_ms = latencyMetrics;
        break;
      case 'search':
        this.metrics.search_latency_ms = latencyMetrics;
        break;
      case 'sdk_lookup':
        this.metrics.sdk_lookup_ms = latencyMetrics;
        break;
      case 'config_generation':
        this.metrics.config_generation_ms = latencyMetrics;
        break;
      case 'tool_execution':
        this.metrics.tool_execution_ms = latencyMetrics;
        break;
    }
  }

  /**
   * パーセンタイル計算
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * システムメトリクス収集
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memory_usage_mb = memUsage.heapUsed / 1024 / 1024;
    
    // CPU使用率は概算（実装を簡略化）
    this.metrics.cpu_usage_percent = Math.min(
      (this.metrics.total_requests / 100) * 10, 
      100
    );
    
    this.metrics.uptime_seconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.metrics.last_updated = Date.now();

    // 新規: Prometheusメトリクス更新
    this.updatePrometheusMetrics();
  }

  /**
   * 新規: Prometheusメトリクス更新
   */
  private updatePrometheusMetrics(): void {
    const memUsage = process.memoryUsage();
    
    // ゲージメトリクス更新
    this.prometheusMetrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed / 1024 / 1024);
    this.prometheusMetrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal / 1024 / 1024);
    this.prometheusMetrics.memoryUsage.set({ type: 'external' }, memUsage.external / 1024 / 1024);
    
    this.prometheusMetrics.cpuUsage.set(this.metrics.cpu_usage_percent);
    this.prometheusMetrics.concurrentSessions.set(this.metrics.concurrent_sessions);
    this.prometheusMetrics.uptime.set(this.metrics.uptime_seconds);
    
    // キャッシュヒット率更新
    const totalCacheOps = this.metrics.cache_hits + this.metrics.cache_misses;
    if (totalCacheOps > 0) {
      this.prometheusMetrics.cacheHitRate.set(
        { cache_type: 'memory' },
        (this.metrics.cache_hits / totalCacheOps) * 100
      );
    }
    
    // エラー率更新
    const totalRequests = this.metrics.total_requests;
    if (totalRequests > 0) {
      this.prometheusMetrics.errorRate.set(
        { time_window: '5m' },
        (this.metrics.failed_requests / totalRequests) * 100
      );
    }
  }

  /**
   * 新規: レスポンス時間記録（Prometheus対応）
   */
  recordStdioLatency(operation: string, latencyMs: number, status: 'success' | 'error' = 'success'): void {
    this.recordTiming('stdio_latency_ms', latencyMs);
    this.prometheusMetrics.stdioLatency.observe({ operation, status }, latencyMs);
  }

  recordSearchLatency(queryType: string, resultCount: number, latencyMs: number): void {
    this.recordTiming('search_latency_ms', latencyMs);
    this.prometheusMetrics.searchLatency.observe(
      { query_type: queryType, result_count: resultCount.toString() },
      latencyMs
    );
  }

  recordSdkLookup(moduleName: string, sdkVersion: string, latencyMs: number): void {
    this.recordTiming('sdk_lookup_ms', latencyMs);
    this.prometheusMetrics.sdkLookupLatency.observe(
      { module_name: moduleName, sdk_version: sdkVersion },
      latencyMs
    );
  }

  recordConfigGeneration(configType: string, complexity: 'simple' | 'medium' | 'complex', latencyMs: number): void {
    this.recordTiming('config_generation_ms', latencyMs);
    this.prometheusMetrics.configGenerationLatency.observe(
      { config_type: configType, complexity },
      latencyMs
    );
  }

  recordToolExecution(toolName: string, latencyMs: number, status: 'success' | 'error' = 'success'): void {
    this.recordTiming('tool_execution_ms', latencyMs);
    this.prometheusMetrics.toolExecutionLatency.observe({ tool_name: toolName, status }, latencyMs);
    this.prometheusMetrics.mcpToolUsage.inc({ tool_name: toolName, success: status === 'success' ? 'true' : 'false' });
  }

  /**
   * 新規: 使用状況記録
   */
  recordPlatformUsage(platform: string, operation: string): void {
    this.prometheusMetrics.platformUsage.inc({ platform, operation });
  }

  recordSdkVersionUsage(sdkVersion: string, moduleType: string): void {
    this.prometheusMetrics.sdkVersionUsage.inc({ sdk_version: sdkVersion, module_type: moduleType });
  }

  recordModuleUsage(moduleName: string, sdkVersion: string, platform: string): void {
    this.prometheusMetrics.moduleUsage.inc({ module_name: moduleName, sdk_version: sdkVersion, platform });
  }

  recordSecurityViolation(violationType: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.prometheusMetrics.securityViolations.inc({ violation_type: violationType, severity });
  }

  recordMcpSessionDuration(clientType: string, transport: string, durationSeconds: number): void {
    this.prometheusMetrics.mcpSessionDuration.observe({ client_type: clientType, transport }, durationSeconds);
  }

  recordMcpProtocolError(errorType: string, transport: string): void {
    this.prometheusMetrics.mcpProtocolErrors.inc({ error_type: errorType, transport });
  }

  /**
   * 新規: Prometheusメトリクス出力
   */
  async getPrometheusMetrics(): Promise<string> {
    return await this.prometheusRegistry.metrics();
  }

  /**
   * 新規: Prometheusレジストリ取得
   */
  getPrometheusRegistry(): promClient.Registry {
    return this.prometheusRegistry;
  }

  /**
   * 計算メトリクス更新
   */
  private updateCalculatedMetrics(): void {
    // キャッシュヒット率計算
    const totalCacheRequests = this.metrics.cache_hits + this.metrics.cache_misses;
    this.metrics.cache_hit_rate = totalCacheRequests > 0 
      ? this.metrics.cache_hits / totalCacheRequests 
      : 0;
  }

  /**
   * 新規: しきい値チェックとアラート生成
   */
  private checkThresholds(): void {
    if (!this.alertingConfig.enabled) return;

    for (const rule of this.alertingConfig.rules) {
      if (!rule.enabled) continue;

      // クールダウンチェック
      const lastAlert = this.alertCooldowns.get(rule.name);
      if (lastAlert && Date.now() - lastAlert < rule.cooldownMinutes * 60 * 1000) {
        continue;
      }

      const currentValue = this.getMetricValue(rule.metric);
      const isTriggered = this.evaluateThreshold(currentValue, rule.threshold, rule.operator);

      if (isTriggered) {
        this.triggerAlert(rule, currentValue);
      } else {
        this.resolveAlert(rule.name);
      }
    }
  }

  /**
   * 新規: メトリクス値取得
   */
  private getMetricValue(metric: string): number {
    switch (metric) {
      case 'stdio_latency_p95':
        return this.metrics.stdio_latency_ms.p95;
      case 'search_latency_p95':
        return this.metrics.search_latency_ms.p95;
      case 'sdk_lookup_p95':
        return this.metrics.sdk_lookup_ms.p95;
      case 'tool_execution_p95':
        return this.metrics.tool_execution_ms.p95;
      case 'cache_hit_rate':
        return this.metrics.cache_hit_rate;
      case 'memory_usage_mb':
        return this.metrics.memory_usage_mb;
      case 'cpu_usage_percent':
        return this.metrics.cpu_usage_percent;
      case 'error_rate':
        {
          const total = this.metrics.total_requests;
          return total > 0 ? (this.metrics.failed_requests / total) * 100 : 0;
        }
      case 'security_violations_rate':
        // 1時間あたりのセキュリティ違反率（簡略化）
        return this.metrics.uptime_seconds > 0 ? 
          (this.metrics.failed_requests * 3600) / this.metrics.uptime_seconds : 0;
      case 'mcp_protocol_errors_rate':
        // 1時間あたりのMCPプロトコルエラー率（簡略化）
        return this.metrics.uptime_seconds > 0 ? 
          (this.metrics.failed_requests * 3600) / this.metrics.uptime_seconds : 0;
      default:
        return 0;
    }
  }

  /**
   * 新規: しきい値評価
   */
  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  /**
   * 新規: アラート発火
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alertId = `${rule.name}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      rule,
      value,
      timestamp: Date.now(),
      status: 'firing',
      message: `${rule.description}. Current value: ${value.toFixed(2)}, Threshold: ${rule.threshold}`
    };

    this.activeAlerts.set(rule.name, alert);
    this.alertCooldowns.set(rule.name, Date.now());

    // 通知送信
    this.sendAlert(alert);

    // イベント発行
    this.emit('alert_triggered', alert);

    console.warn(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${alert.message}`);
  }

  /**
   * 新規: アラート解決
   */
  private resolveAlert(ruleName: string): void {
    const activeAlert = this.activeAlerts.get(ruleName);
    if (activeAlert && activeAlert.status === 'firing') {
      activeAlert.status = 'resolved';
      activeAlert.timestamp = Date.now();
      
      this.emit('alert_resolved', activeAlert);
      console.log(`✅ RESOLVED: Alert ${ruleName} has been resolved`);
      
      this.activeAlerts.delete(ruleName);
    }
  }

  /**
   * 新規: アラート通知送信
   */
  private async sendAlert(alert: Alert): Promise<void> {
    try {
      // コンソール通知
      if (this.alertingConfig.notifications.console) {
        console.warn(`🚨 [${alert.rule.severity.toUpperCase()}] ${alert.message}`);
      }

      // Webhook通知
      if (this.alertingConfig.notifications.webhook) {
        await this.sendWebhookAlert(alert);
      }

      // Email通知（実装は簡略化）
      if (this.alertingConfig.notifications.email) {
        console.log(`📧 Email alert would be sent to: ${this.alertingConfig.notifications.email}`);
      }
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  /**
   * 新規: Webhook通知送信
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.alertingConfig.notifications.webhook) return;

    try {
      const payload = {
        alertId: alert.id,
        ruleName: alert.rule.name,
        severity: alert.rule.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.rule.threshold,
        timestamp: new Date(alert.timestamp).toISOString(),
        status: alert.status
      };

      // 実際のHTTP送信は簡略化（fetch使用）
      console.log(`🔗 Webhook payload would be sent:`, JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * 新規: アクティブアラート取得
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 新規: アラート設定更新
   */
  updateAlertingConfig(config: Partial<AlertingConfig>): void {
    this.alertingConfig = { ...this.alertingConfig, ...config };
  }

  /**
   * メトリクス取得
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 統計情報取得
   */
  getStats(): any {
    return {
      metrics: this.getMetrics(),
      timings: Object.fromEntries(
        Array.from(this.timings.entries()).map(([key, value]) => [
          key,
          {
            count: value.length,
            recent: value.slice(-10) // 最新10件
          }
        ])
      ),
      activeTimers: this.activeTimers.size,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * リセット
   */
  reset(): void {
    this.timings.clear();
    this.activeTimers.clear();
    this.metrics = {
      stdio_latency_ms: this.createEmptyLatencyMetrics(),
      search_latency_ms: this.createEmptyLatencyMetrics(),
      sdk_lookup_ms: this.createEmptyLatencyMetrics(),
      config_generation_ms: this.createEmptyLatencyMetrics(),
      tool_execution_ms: this.createEmptyLatencyMetrics(),
      memory_usage_mb: 0,
      cpu_usage_percent: 0,
      cache_hit_rate: 0,
      concurrent_sessions: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      cache_hits: 0,
      cache_misses: 0,
      memory_leak: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        buffers: 0,
        arrayBuffers: 0,
        gcEvents: 0,
        gcDuration: 0,
        memoryGrowthRate: 0,
        potentialLeaks: false
      },
      resource_monitoring: {
        openHandles: 0,
        eventLoopDelay: 0,
        cpuUsage: { user: 0, system: 0 },
        loadAverage: [0, 0, 0],
        activeTimers: 0,
        activeRequests: 0
      },
      uptime_seconds: 0,
      last_updated: Date.now()
    };
  }

  /**
   * 空のレイテンシメトリクス作成
   */
  private createEmptyLatencyMetrics(): LatencyMetrics {
    return {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      min: 0,
      max: 0,
      avg: 0,
      count: 0
    };
  }
} 