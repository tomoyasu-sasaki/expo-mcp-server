# Expo MCP Server パフォーマンスチューニングガイド

## 📊 概要

Expo MCP Serverは、高いパフォーマンスと効率性を実現するために、多層キャッシュ、並行処理、リソース最適化を組み合わせています。本ガイドでは、最適なパフォーマンスを得るためのチューニング方法を説明します。

## 🎯 パフォーマンス目標・SLA

### 応答時間目標
```yaml
latency_targets:
  stdio_communication: "P95 < 50ms"
  document_search: "P95 < 100ms"
  sdk_module_lookup: "P95 < 80ms"
  tool_execution: "P95 < 500ms"
  cache_hit_response: "P95 < 10ms"
```

### スループット目標
```yaml
throughput_targets:
  concurrent_sessions: 200
  requests_per_minute: 6000
  cache_hit_rate: ">85%"
  memory_efficiency: "<1GB RAM"
  cpu_utilization: "<80%"
```

## 🚀 アーキテクチャ最適化

### 多層キャッシュ戦略

```
┌─────────────────────────────────────────────────────────┐
│                    アプリケーション                        │
│               ┌─────────────────────┐                    │
│               │   メモリキャッシュ    │  ← 最速（10ms）      │
│               │   LRU 200MB        │                    │
│               └─────────────────────┘                    │
│                        │                                │
│               ┌─────────────────────┐                    │
│               │   Redisキャッシュ    │  ← 高速（50ms）      │
│               │   分散 1GB         │                    │
│               └─────────────────────┘                    │
│                        │                                │
│               ┌─────────────────────┐                    │
│               │   ディスクキャッシュ  │  ← 永続化（200ms）   │
│               │   圧縮 20GB        │                    │
│               └─────────────────────┘                    │
│                        │                                │
│               ┌─────────────────────┐                    │
│               │   データソース       │  ← 最遅（1000ms+）   │
│               │   API・インデックス  │                    │
│               └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 並行処理最適化

#### Worker Pooling
```typescript
// 自動実装済み - CPU集約タスクの並列化
const workerPool = {
  maxWorkers: os.cpus().length,
  taskQueue: [],
  activeWorkers: 0,
  
  async processTask(task: ProcessingTask): Promise<Result> {
    if (this.activeWorkers < this.maxWorkers) {
      return await this.spawnWorker(task);
    } else {
      return await this.queueTask(task);
    }
  }
};
```

#### 非同期処理パイプライン
```typescript
// 検索処理の並列化例
async function parallelSearch(query: string): Promise<SearchResult[]> {
  const [
    docResults,
    apiResults, 
    exampleResults
  ] = await Promise.all([
    searchDocuments(query),
    searchAPIReference(query),
    searchCodeExamples(query)
  ]);
  
  return mergeAndRank([docResults, apiResults, exampleResults]);
}
```

## ⚙️ 設定最適化

### メモリキャッシュ設定

#### 開発環境
```json
{
  "cache": {
    "memory": {
      "max_size_mb": 100,
      "ttl_seconds": 300,
      "eviction": "LRU",
      "hit_rate_target": 0.75
    }
  }
}
```

#### 本番環境（高トラフィック）
```json
{
  "cache": {
    "memory": {
      "max_size_mb": 512,
      "ttl_seconds": 600,
      "eviction": "LRU",
      "hit_rate_target": 0.90,
      "preload_popular": true
    },
    "redis": {
      "max_size_mb": 2048,
      "ttl_seconds": 3600,
      "cluster_support": true,
      "connection_pool": 20
    }
  }
}
```

### 検索エンジン最適化

#### TypeSense設定
```yaml
typesense_optimization:
  num_memory_shards: 4
  search_cutoff_ms: 100
  max_candidates: 10000
  prefix_search_cutoff_ms: 40
  filter_by_cutoff_ms: 30
  
  # インデックス最適化
  index_settings:
    default_sorting_field: "popularity"
    enable_nested_fields: true
    token_separators: ["-", "_", "/"]
```

### 並行処理設定

#### Cluster Mode設定
```json
{
  "cluster": {
    "enabled": true,
    "workers": "auto",  // CPU数に応じて自動
    "max_workers": 8,
    "worker_restart_delay": 1000,
    "shared_memory": true
  }
}
```

#### リクエスト制限
```json
{
  "rate_limiting": {
    "per_session_rpm": 2000,
    "burst_limit": 100,
    "queue_size": 500,
    "timeout_ms": 5000
  }
}
```

## 📈 監視・メトリクス

### パフォーマンスメトリクス

#### 実装済みメトリクス
```typescript
// 自動収集されるメトリクス
const performanceMetrics = {
  // レスポンス時間（ヒストグラム）
  'expo_mcp_stdio_latency_ms': 'MCP stdio通信レイテンシ',
  'expo_mcp_search_latency_ms': 'ドキュメント検索レイテンシ',
  'expo_mcp_tool_execution_latency_ms': 'ツール実行レイテンシ',
  
  // リソース使用量（ゲージ）
  'expo_mcp_memory_usage_mb': 'メモリ使用量',
  'expo_mcp_cpu_usage_percent': 'CPU使用率',
  'expo_mcp_cache_hit_rate': 'キャッシュヒット率',
  
  // スループット（カウンター）
  'expo_mcp_requests_total': '総リクエスト数',
  'expo_mcp_concurrent_sessions': '同時セッション数'
};
```

#### Grafanaダッシュボード
```yaml
dashboard_panels:
  - title: "応答時間分析"
    metrics: ["P95", "P99", "平均応答時間"]
    alerts: ["P95 > 100ms", "P99 > 500ms"]
  
  - title: "キャッシュ効率"
    metrics: ["ヒット率", "ミス率", "キャッシュサイズ"]
    alerts: ["ヒット率 < 85%"]
  
  - title: "システムリソース"
    metrics: ["メモリ使用量", "CPU使用率", "同時セッション"]
    alerts: ["メモリ > 1GB", "CPU > 80%"]
```

### アラート設定

#### パフォーマンス劣化アラート
```yaml
performance_alerts:
  high_latency:
    condition: "P95 latency > 100ms for 2 minutes"
    severity: "warning"
    action: "scale_up"
  
  low_cache_hit_rate:
    condition: "cache hit rate < 80% for 5 minutes"
    severity: "warning"
    action: "optimize_cache"
  
  high_memory_usage:
    condition: "memory usage > 900MB for 3 minutes"
    severity: "critical"
    action: "restart_with_more_memory"
```

## 🔧 チューニング手順

### 1. ベースライン測定

#### パフォーマンステスト実行
```bash
# 基本性能測定
npm run performance:baseline

# 負荷テスト実行
npm run test:load

# メトリクス確認
curl http://localhost:9090/metrics | grep expo_mcp_
```

#### 結果分析
```bash
# Grafanaダッシュボード確認
open http://localhost:3001/d/expo-mcp-performance

# ログ分析
docker logs expo-mcp-server | grep "PERFORMANCE"
```

### 2. ボトルネック特定

#### 一般的なボトルネック
```yaml
common_bottlenecks:
  memory_cache_miss:
    symptoms: ["低いキャッシュヒット率", "頻繁なディスクアクセス"]
    solutions: ["キャッシュサイズ増加", "TTL調整", "プリロード設定"]
  
  search_latency:
    symptoms: ["検索応答時間遅延", "TypeSenseタイムアウト"]
    solutions: ["インデックス最適化", "検索パラメータ調整"]
  
  concurrent_limit:
    symptoms: ["同時接続制限", "リクエストキューイング"]
    solutions: ["Worker数増加", "接続プール拡大"]
```

#### 診断コマンド
```bash
# メモリ使用量分析
docker stats expo-mcp-server

# ログ性能分析
docker exec expo-mcp-server npm run diagnose:performance

# キャッシュ統計確認
curl http://localhost:3000/admin/cache/stats
```

### 3. 段階的最適化

#### Phase 1: キャッシュ最適化
```json
{
  "optimization_phase_1": {
    "memory_cache_size": "200MB → 512MB",
    "redis_connection_pool": "10 → 20",
    "cache_ttl": "300s → 600s",
    "expected_improvement": "20-30% レスポンス時間短縮"
  }
}
```

#### Phase 2: 並行処理強化
```json
{
  "optimization_phase_2": {
    "worker_count": "4 → 8",
    "queue_size": "100 → 500",
    "timeout_adjustment": "5s → 10s",
    "expected_improvement": "50-100% スループット向上"
  }
}
```

#### Phase 3: インデックス最適化
```json
{
  "optimization_phase_3": {
    "search_shards": "2 → 4",
    "memory_mapping": "enabled",
    "compression": "optimized",
    "expected_improvement": "30-50% 検索速度向上"
  }
}
```

## 💡 高度な最適化

### Redis Cluster設定

#### 高可用性構成
```yaml
redis_cluster:
  nodes:
    - host: "redis-1.internal"
      port: 6379
      role: "master"
    - host: "redis-2.internal" 
      port: 6379
      role: "replica"
    - host: "redis-3.internal"
      port: 6379
      role: "master"
  
  settings:
    cluster_enabled: true
    cluster_config_file: "redis-cluster.conf"
    cluster_node_timeout: 5000
    cluster_require_full_coverage: false
```

### 動的スケーリング

#### Auto Scaling設定
```yaml
auto_scaling:
  metrics:
    - name: "cpu_utilization"
      target: 70
      scale_up_threshold: 80
      scale_down_threshold: 30
    
    - name: "memory_utilization"
      target: 75
      scale_up_threshold: 85
      scale_down_threshold: 40
  
  scaling_policy:
    min_instances: 2
    max_instances: 10
    scale_up_cooldown: 300
    scale_down_cooldown: 600
```

### コンテンツ最適化

#### 圧縮設定
```json
{
  "content_optimization": {
    "gzip_compression": true,
    "brotli_compression": true,
    "json_minification": true,
    "response_streaming": true,
    "compression_level": 6
  }
}
```

#### CDN統合
```yaml
cdn_config:
  provider: "CloudFlare"
  cache_rules:
    - pattern: "/docs/*"
      ttl: 3600
      compression: true
    - pattern: "/api/*"
      ttl: 1800
      compression: true
```

## 🎪 環境別設定

### 開発環境
```json
{
  "environment": "development",
  "performance": {
    "cache_size_mb": 100,
    "workers": 2,
    "debug_mode": true,
    "performance_logging": true
  }
}
```

### ステージング環境
```json
{
  "environment": "staging", 
  "performance": {
    "cache_size_mb": 256,
    "workers": 4,
    "load_testing": true,
    "metrics_collection": true
  }
}
```

### 本番環境
```json
{
  "environment": "production",
  "performance": {
    "cache_size_mb": 512,
    "workers": 8,
    "optimization_mode": "aggressive",
    "monitoring": "full"
  }
}
```

## 📊 パフォーマンステスト

### 負荷テストシナリオ

#### 基本負荷テスト
```bash
# 単一ユーザー性能テスト
npm run test:performance:single

# 100同時ユーザーテスト
npm run test:performance:concurrent -- --users=100

# エンデュランステスト（12時間）
npm run test:performance:endurance -- --duration=12h
```

#### カスタム負荷テスト
```javascript
// 負荷テスト設定例
const loadTestConfig = {
  scenarios: {
    search_heavy: {
      users: 50,
      duration: '10m',
      search_requests_per_minute: 1200
    },
    api_lookup_heavy: {
      users: 30,
      duration: '15m', 
      api_requests_per_minute: 800
    }
  }
};
```

### ベンチマーク結果例

#### 最適化前後比較
```yaml
performance_comparison:
  before_optimization:
    avg_response_time: 250ms
    p95_response_time: 800ms
    cache_hit_rate: 65%
    memory_usage: 800MB
    
  after_optimization:
    avg_response_time: 120ms
    p95_response_time: 350ms
    cache_hit_rate: 88%
    memory_usage: 600MB
    
  improvement:
    response_time: "52% faster"
    p95_latency: "56% faster" 
    cache_efficiency: "35% better"
    memory_efficiency: "25% better"
```

## 🔍 トラブルシューティング

### 一般的なパフォーマンス問題

#### メモリリーク
```bash
# メモリ使用量監視
watch -n 5 'docker stats --no-stream expo-mcp-server'

# ヒープダンプ生成
docker exec expo-mcp-server node --inspect=0.0.0.0:9229 dist/index.js

# メモリプロファイリング
npm run profile:memory
```

#### CPU使用率高騰
```bash
# CPU プロファイリング
npm run profile:cpu

# プロセス分析
docker exec expo-mcp-server top -p $(pgrep node)
```

#### キャッシュ効率低下
```bash
# キャッシュ統計確認
curl http://localhost:3000/admin/cache/stats

# キャッシュキー分析
redis-cli --scan --pattern "expo:*" | head -20
```

## 📚 パフォーマンス最適化リソース

### 参考資料
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling)
- [Redis Performance Tuning](https://redis.io/topics/memory-optimization)
- [TypeSense Performance Guide](https://typesense.org/docs/0.24.1/guide/performance.html)
- [Docker Performance Tuning](https://docs.docker.com/config/containers/resource_constraints/)

### 監視ツール
- **Grafana**: パフォーマンスダッシュボード
- **Prometheus**: メトリクス収集
- **New Relic**: APM監視（オプション）
- **DataDog**: インフラ監視（オプション）

---

**📈 継続的改善**: パフォーマンスは継続的な監視と改善が必要です。定期的にメトリクスを確認し、ボトルネックを特定して最適化を実施してください。

**💬 サポート**: パフォーマンスに関する質問は performance@expo.dev までお寄せください。 