# Expo MCP Server Docker Image Documentation

## 📋 概要

Expo MCP ServerのDocker化された環境の詳細ドキュメントです。プロダクション対応のコンテナイメージの使用方法、設定オプション、セキュリティ強化、監視統合について説明します。

## 🐳 Docker Images

### Official Images

#### 本番用イメージ
```bash
# 最新版
docker pull expo/mcp-server:latest

# 特定バージョン
docker pull expo/mcp-server:1.0.0

# プラットフォーム指定
docker pull expo/mcp-server:latest --platform linux/amd64
docker pull expo/mcp-server:latest --platform linux/arm64
```

#### 開発用イメージ
```bash
# 開発版（デバッグツール含む）
docker pull expo/mcp-server:dev

# アルパイン版（軽量）
docker pull expo/mcp-server:alpine
```

### イメージタグ戦略
```yaml
tag_strategy:
  latest: "最新安定版"
  "1.x.x": "特定バージョン"
  stable: "安定版（latest のエイリアス）"
  dev: "開発版（追加ツール含む）"
  alpine: "軽量版（Alpine Linux）"
  debug: "デバッグ版（ソースマップ含む）"
```

## 🔧 基本使用方法

### 簡単な起動
```bash
# 基本起動（stdio モード）
docker run -it expo/mcp-server:latest

# HTTP モードで起動
docker run -p 3000:3000 expo/mcp-server:latest --mode http

# 環境変数指定
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  expo/mcp-server:latest
```

### データ永続化
```bash
# ローカルディレクトリマウント
docker run -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config:/app/config \
  expo/mcp-server:latest

# 名前付きボリューム使用
docker volume create expo-mcp-data
docker run -p 3000:3000 \
  -v expo-mcp-data:/app/data \
  expo/mcp-server:latest
```

## 🏗️ Docker Compose

### 基本構成
```yaml
# docker-compose.yml
version: '3.8'

services:
  expo-mcp-server:
    image: expo/mcp-server:latest
    container_name: expo-mcp-server
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "9090:9090"  # メトリクス
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - CACHE_TTL_SECONDS=600
      - RATE_LIMIT_RPM=2000
    volumes:
      - ./data:/app/data
      - ./config:/app/config
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - expo-mcp-network

networks:
  expo-mcp-network:
    driver: bridge
```

### 監視付き構成
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  expo-mcp-server:
    image: expo/mcp-server:latest
    container_name: expo-mcp-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - METRICS_ENABLED=true
      - PROMETHEUS_PORT=9090
    volumes:
      - expo-mcp-data:/app/data
      - ./config/production.json:/app/config/production.json:ro
    networks:
      - expo-mcp-network
    depends_on:
      - redis
      - prometheus

  redis:
    image: redis:7-alpine
    container_name: expo-mcp-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    networks:
      - expo-mcp-network

  prometheus:
    image: prom/prometheus:latest
    container_name: expo-mcp-prometheus
    restart: unless-stopped
    ports:
      - "9091:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - expo-mcp-network

  grafana:
    image: grafana/grafana:latest
    container_name: expo-mcp-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    networks:
      - expo-mcp-network
    depends_on:
      - prometheus

volumes:
  expo-mcp-data:
  redis-data:
  prometheus-data:
  grafana-data:

networks:
  expo-mcp-network:
    driver: bridge
```

### クラスター構成
```yaml
# docker-compose.cluster.yml
version: '3.8'

services:
  expo-mcp-server-1:
    image: expo/mcp-server:latest
    container_name: expo-mcp-server-1
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - CLUSTER_NODE_ID=node-1
      - REDIS_URL=redis://redis-cluster:6379
    volumes:
      - ./config/cluster.json:/app/config/production.json:ro
    networks:
      - expo-mcp-cluster
    depends_on:
      - redis-cluster
      - nginx-lb

  expo-mcp-server-2:
    image: expo/mcp-server:latest
    container_name: expo-mcp-server-2
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - CLUSTER_NODE_ID=node-2
      - REDIS_URL=redis://redis-cluster:6379
    volumes:
      - ./config/cluster.json:/app/config/production.json:ro
    networks:
      - expo-mcp-cluster
    depends_on:
      - redis-cluster
      - nginx-lb

  nginx-lb:
    image: nginx:alpine
    container_name: expo-mcp-lb
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - expo-mcp-cluster
    depends_on:
      - expo-mcp-server-1
      - expo-mcp-server-2

  redis-cluster:
    image: redis:7-alpine
    container_name: expo-mcp-redis-cluster
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    volumes:
      - redis-cluster-data:/data
    networks:
      - expo-mcp-cluster

volumes:
  redis-cluster-data:

networks:
  expo-mcp-cluster:
    driver: bridge
```

## ⚙️ 環境変数

### 必須環境変数
```bash
# 基本設定
NODE_ENV=production              # 実行環境
MCP_MODE=http                    # 動作モード（stdio/http）
LOG_LEVEL=info                   # ログレベル

# ネットワーク設定
HTTP_PORT=3000                   # HTTPポート
METRICS_PORT=9090                # メトリクスポート

# セキュリティ設定
API_KEY_REQUIRED=true            # API認証要求
JWT_SECRET=your-secret-key       # JWT秘密鍵
RATE_LIMIT_RPM=2000             # レート制限（分間）
```

### オプション環境変数
```bash
# キャッシュ設定
CACHE_TTL_SECONDS=600           # キャッシュTTL
MEMORY_CACHE_SIZE_MB=256        # メモリキャッシュサイズ
REDIS_URL=redis://localhost:6379  # Redis接続URL

# パフォーマンス設定
MAX_CONCURRENT_REQUESTS=100     # 最大同時リクエスト数
REQUEST_TIMEOUT_MS=30000        # リクエストタイムアウト
WORKER_PROCESSES=auto           # ワーカープロセス数

# 監視設定
METRICS_ENABLED=true            # メトリクス有効化
HEALTH_CHECK_INTERVAL=30        # ヘルスチェック間隔（秒）
DEBUG_MODE=false                # デバッグモード

# ストレージ設定
DATA_DIRECTORY=/app/data        # データディレクトリ
LOG_DIRECTORY=/app/logs         # ログディレクトリ
MAX_LOG_SIZE_MB=100            # ログファイル最大サイズ
```

## 🔒 セキュリティ設定

### セキュリティ強化
```dockerfile
# セキュリティ強化Dockerfile例
FROM node:18-alpine

# セキュリティアップデート
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001 -G nodejs

# アプリケーションディレクトリ
WORKDIR /app

# 依存関係コピー（セキュリティスキャン済み）
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# アプリケーションコード
COPY --chown=mcpuser:nodejs . .

# 権限設定
RUN chmod -R 755 /app && \
    chmod -R 644 /app/config && \
    mkdir -p /app/data /app/logs && \
    chown -R mcpuser:nodejs /app/data /app/logs

# セキュリティ設定
USER mcpuser
EXPOSE 3000 9090

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# セキュアエントリーポイント
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### Docker セキュリティオプション
```bash
# セキュリティ強化実行
docker run -d \
  --name expo-mcp-server \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --tmpfs /app/logs:rw,noexec,nosuid,size=256m \
  --security-opt no-new-privileges:true \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --user 1001:1001 \
  -p 3000:3000 \
  -v expo-mcp-data:/app/data:rw \
  expo/mcp-server:latest
```

## 📊 監視・メトリクス

### Prometheus設定
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'expo-mcp-server'
    static_configs:
      - targets: ['expo-mcp-server:9090']
    scrape_interval: 15s
    metrics_path: '/metrics'
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana ダッシュボード設定
```yaml
# monitoring/grafana/provisioning/dashboards/default.yml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

### ログ設定
```yaml
# Docker Compose ログ設定
services:
  expo-mcp-server:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
        labels: "service=expo-mcp-server"
        tag: "{{.ImageName}}/{{.Name}}/{{.ID}}"
```

## 🚀 本番デプロイメント

### プロダクション起動スクリプト
```bash
#!/bin/bash
# scripts/deploy-production.sh

set -euo pipefail

# 設定
IMAGE_NAME="expo/mcp-server:latest"
CONTAINER_NAME="expo-mcp-server"
DATA_VOLUME="expo-mcp-data"
CONFIG_DIR="./config"

echo "🚀 Expo MCP Server プロダクションデプロイ開始..."

# 既存コンテナ停止・削除
if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "📥 既存コンテナを停止中..."
    docker stop ${CONTAINER_NAME}
    docker rm ${CONTAINER_NAME}
fi

# 最新イメージプル
echo "📦 最新イメージをプル中..."
docker pull ${IMAGE_NAME}

# データボリューム作成（存在しない場合）
if ! docker volume ls | grep -q ${DATA_VOLUME}; then
    echo "💾 データボリューム作成中..."
    docker volume create ${DATA_VOLUME}
fi

# プロダクション起動
echo "🏃 コンテナ起動中..."
docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=128m \
    --tmpfs /app/logs:rw,noexec,nosuid,size=256m \
    --security-opt no-new-privileges:true \
    --cap-drop=ALL \
    --cap-add=NET_BIND_SERVICE \
    --user 1001:1001 \
    -p 3000:3000 \
    -p 9090:9090 \
    -v ${DATA_VOLUME}:/app/data:rw \
    -v ${CONFIG_DIR}/production.json:/app/config/production.json:ro \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e METRICS_ENABLED=true \
    ${IMAGE_NAME}

# ヘルスチェック
echo "🔍 ヘルスチェック実行中..."
sleep 10

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ デプロイ成功！サーバーが正常稼働中です"
    docker logs --tail 10 ${CONTAINER_NAME}
else
    echo "❌ デプロイ失敗！ログを確認してください"
    docker logs ${CONTAINER_NAME}
    exit 1
fi
```

### Kubernetes デプロイメント
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: expo-mcp-server
  namespace: expo-mcp
  labels:
    app: expo-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: expo-mcp-server
  template:
    metadata:
      labels:
        app: expo-mcp-server
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: expo-mcp-server
        image: expo/mcp-server:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: expo-mcp-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        - name: config-volume
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: expo-mcp-data-pvc
      - name: config-volume
        configMap:
          name: expo-mcp-config

---
apiVersion: v1
kind: Service
metadata:
  name: expo-mcp-server-service
  namespace: expo-mcp
spec:
  selector:
    app: expo-mcp-server
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: LoadBalancer
```

## 🔧 トラブルシューティング

### 一般的な問題

#### コンテナ起動失敗
```bash
# ログ確認
docker logs expo-mcp-server

# 詳細ログ
docker logs -f expo-mcp-server

# コンテナ内確認
docker exec -it expo-mcp-server sh
```

#### パフォーマンス問題
```bash
# リソース使用量確認
docker stats expo-mcp-server

# プロセス確認
docker exec expo-mcp-server ps aux

# メトリクス確認
curl http://localhost:9090/metrics
```

#### ネットワーク問題
```bash
# ポート確認
docker port expo-mcp-server

# ネットワーク確認
docker network ls
docker inspect expo-mcp-network
```

### 診断コマンド
```bash
# ヘルスチェック
curl -f http://localhost:3000/health

# 設定確認
docker exec expo-mcp-server cat /app/config/production.json

# データベース接続確認
docker exec expo-mcp-server curl -f http://redis:6379/ping

# ログレベル変更
docker exec expo-mcp-server \
  sed -i 's/LOG_LEVEL=info/LOG_LEVEL=debug/' /app/.env
```

## 📚 参考資料

### Docker関連
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

### 監視・運用
- [Prometheus Docker](https://prometheus.io/docs/prometheus/latest/installation/)
- [Grafana Docker](https://grafana.com/docs/grafana/latest/installation/docker/)
- [Container Monitoring](https://docs.docker.com/config/containers/logging/)

---

**🔄 自動更新**: このドキュメントはDockerイメージのリリースと同期して更新されます。

**🐳 サポート**: Docker関連の質問は docker@expo.dev までお寄せください。 