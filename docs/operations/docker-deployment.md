# Docker デプロイメントガイド

## 概要

Expo MCP ServerのDocker環境での運用方法を説明します。開発環境から本番環境まで、スケーラブルで安全なデプロイメントを実現できます。

## 前提条件

- **Docker**: 20.10.0以上
- **Docker Compose**: 2.0.0以上
- **基本要件**: 2GB RAM、10GB ディスク

## クイックスタート

### 1. 基本的なDocker実行

```bash
# 最新イメージ取得
docker pull expo/expo-mcp-server:latest

# stdio モード（MCP クライアント用）
docker run -i expo/expo-mcp-server:latest --stdio

# HTTP モード（開発・テスト用）
docker run -p 3000:3000 expo/expo-mcp-server:latest --port 3000
```

### 2. Docker Compose での起動

```bash
# プロジェクトクローン
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server

# 全サービス起動
docker-compose up -d

# ログ確認
docker-compose logs -f expo-mcp-api
```

## Docker 設定

### 基本的なDockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS production

# セキュリティ設定
RUN addgroup -g 1001 -S nodejs && \
    adduser -S expo -u 1001

# 依存関係インストール
RUN apk add --no-cache dumb-init

WORKDIR /app

# アプリケーションファイルコピー
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=expo:nodejs ./dist ./dist
COPY --chown=expo:nodejs ./package.json .

# 実行時設定
USER expo
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### セキュリティ強化設定

```dockerfile
# セキュリティ強化版
FROM node:18-alpine AS security

# 脆弱性スキャン
RUN apk update && apk upgrade
RUN npm audit fix

# 非rootユーザー設定
RUN addgroup -g 1001 -S nodejs && \
    adduser -S expo -u 1001 -G nodejs

# 読み取り専用ファイルシステム
COPY --chown=expo:nodejs . /app
WORKDIR /app

# セキュリティ設定
USER expo
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node docker/health-check.cjs

# リソース制限
LABEL security.capabilities="CAP_DROP=ALL"
LABEL security.readonly="true"
```

## Docker Compose 設定

### 開発環境設定

```yaml
# docker-compose.dev.yml
version: "3.8"

services:
  expo-mcp-dev:
    build:
      context: .
      target: development
    ports:
      - "3000:3000"
      - "9229:9229"  # デバッグ用
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    volumes:
      - ./src:/app/src:ro
      - ./data:/app/data:rw
    command: ["npm", "run", "dev"]
    
  redis-dev:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning
```

### 本番環境設定

```yaml
# docker-compose.prod.yml
version: "3.8"

networks:
  expo-mcp-network:
    driver: bridge

volumes:
  redis_data:
  typesense_data:
  app_data:

services:
  expo-mcp-api:
    image: expo/expo-mcp-server:latest
    restart: unless-stopped
    networks:
      - expo-mcp-network
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - TYPESENSE_URL=http://typesense:8108
    volumes:
      - app_data:/app/data:rw
    healthcheck:
      test: ["CMD", "node", "docker/health-check.cjs"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.1'
  
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    networks:
      - expo-mcp-network
    volumes:
      - redis_data:/data
    command: redis-server --save 60 1 --maxmemory 512mb --maxmemory-policy allkeys-lru
    
  typesense:
    image: typesense/typesense:0.25.1
    restart: unless-stopped
    networks:
      - expo-mcp-network
    volumes:
      - typesense_data:/data
    environment:
      - TYPESENSE_DATA_DIR=/data
      - TYPESENSE_API_KEY=${TYPESENSE_API_KEY}
    command: '--data-dir /data --api-key=${TYPESENSE_API_KEY} --listen-port 8108'
```

## 環境変数設定

### 開発環境

```bash
# .env.development
NODE_ENV=development
MCP_MODE=http
LOG_LEVEL=debug
PORT=3000

# ローカルストレージ
LOCAL_STORAGE_PATH=/app/data
MAX_STORAGE_SIZE_GB=5

# Redis設定
REDIS_URL=redis://localhost:6379

# Typesense設定
TYPESENSE_URL=http://localhost:8108
TYPESENSE_API_KEY=development-key
```

### 本番環境

```bash
# .env.production
NODE_ENV=production
MCP_MODE=stdio
LOG_LEVEL=info

# セキュリティ設定
RATE_LIMIT_RPM=1000
SESSION_TIMEOUT_MINUTES=60
MAX_CONCURRENT_SESSIONS=200

# 外部サービス
REDIS_URL=redis://redis:6379
TYPESENSE_URL=http://typesense:8108
TYPESENSE_API_KEY=${TYPESENSE_API_KEY}

# 監視設定
MONITORING_ENABLED=true
METRICS_PORT=9090
```

## ネットワーク設定

### 内部ネットワーク

```yaml
networks:
  expo-mcp-internal:
    driver: bridge
    internal: true  # 外部アクセス遮断
    ipam:
      config:
        - subnet: 172.20.0.0/16

  expo-mcp-external:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

### Reverse Proxy設定

```yaml
# Nginx設定例
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - ./ssl:/etc/nginx/ssl:ro
  depends_on:
    - expo-mcp-api
```

```nginx
# nginx.conf
server {
    listen 80;
    server_name mcp.yourdomain.com;
    
    location / {
        proxy_pass http://expo-mcp-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 永続化・バックアップ

### データボリューム設定

```yaml
volumes:
  # アプリケーションデータ
  expo_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/expo-mcp/data

  # Redis データ
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/expo-mcp/redis

  # Typesense データ
  typesense_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/expo-mcp/typesense
```

### バックアップスクリプト

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/expo-mcp/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# データディレクトリバックアップ
tar -czf "$BACKUP_DIR/app_data_$DATE.tar.gz" /opt/expo-mcp/data

# Redis データバックアップ
docker exec expo-mcp-redis redis-cli BGSAVE
sleep 5
cp /opt/expo-mcp/redis/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Typesense データバックアップ
tar -czf "$BACKUP_DIR/typesense_$DATE.tar.gz" /opt/expo-mcp/typesense

# 古いバックアップ削除（7日以上）
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $DATE"
```

## 監視・ログ設定

### Prometheus監視

```yaml
# 監視スタック追加
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana:/etc/grafana/provisioning:ro
```

### ログ設定

```yaml
# ログ設定
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"
    
# Fluentd設定例
fluentd:
  image: fluent/fluentd:latest
  volumes:
    - ./fluentd/conf:/fluentd/etc:ro
  depends_on:
    - expo-mcp-api
```

## スケーリング

### 水平スケーリング

```yaml
# docker-compose.scale.yml
services:
  expo-mcp-api:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        
  nginx-loadbalancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - expo-mcp-api
```

### オートスケーリング

```bash
# Docker Swarm使用
docker swarm init
docker stack deploy -c docker-compose.scale.yml expo-mcp

# スケール調整
docker service scale expo-mcp_expo-mcp-api=5
```

## セキュリティ設定

### コンテナセキュリティ

```yaml
services:
  expo-mcp-api:
    security_opt:
      - no-new-privileges:true
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    tmpfs:
      - /tmp
      - /app/tmp
```

### ネットワークセキュリティ

```yaml
# ファイアウォール設定
networks:
  default:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: "false"
      com.docker.network.bridge.enable_ip_masquerade: "true"
```

## トラブルシューティング

### コンテナヘルスチェック

```bash
# ヘルスチェック確認
docker ps --format "table {{.Names}}\t{{.Status}}"

# 詳細ヘルス情報
docker inspect expo-mcp-server | grep -A 10 "Health"

# ログ確認
docker logs -f expo-mcp-server
```

### パフォーマンス監視

```bash
# リソース使用量
docker stats expo-mcp-server

# プロセス監視
docker exec expo-mcp-server ps aux

# ネットワーク監視
docker exec expo-mcp-server netstat -tulpn
```

### 一般的な問題

#### 1. メモリ不足

```yaml
# メモリ制限調整
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 512M
```

#### 2. ディスク容量不足

```bash
# ディスク使用量確認
docker system df

# 不要データ削除
docker system prune -a
```

#### 3. ネットワーク接続問題

```bash
# ネットワーク確認
docker network ls
docker network inspect expo-mcp-network

# 接続テスト
docker exec expo-mcp-server ping redis
```

## 本番環境デプロイ

### デプロイスクリプト

```bash
#!/bin/bash
# deploy.sh

set -e

echo "Starting deployment..."

# 最新イメージ取得
docker-compose pull

# ゼロダウンタイムアップデート
docker-compose up -d --no-deps expo-mcp-api

# ヘルスチェック待機
echo "Waiting for health check..."
sleep 30

# 旧コンテナ削除
docker-compose up -d --remove-orphans

echo "Deployment completed successfully"
```

### CI/CD パイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t expo/expo-mcp-server:${{ github.sha }} .
          docker tag expo/expo-mcp-server:${{ github.sha }} expo/expo-mcp-server:latest
      
      - name: Deploy to production
        run: |
          docker-compose -f docker-compose.prod.yml up -d
```

## 運用チェックリスト

### 日次チェック

- [ ] コンテナヘルスステータス確認
- [ ] リソース使用量確認  
- [ ] エラーログ確認
- [ ] バックアップ完了確認

### 週次チェック

- [ ] セキュリティアップデート適用
- [ ] パフォーマンスメトリクス分析
- [ ] ディスク容量確認
- [ ] バックアップ復旧テスト

### 月次チェック

- [ ] 依存関係アップデート
- [ ] 監視アラート見直し
- [ ] 容量計画見直し
- [ ] ディザスタリカバリテスト

## サポート

- **Docker Hub**: [https://hub.docker.com/r/expo/expo-mcp-server](https://hub.docker.com/r/expo/expo-mcp-server)
- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **Docker ドキュメント**: [https://docs.docker.com/](https://docs.docker.com/)

---

*最終更新: 2024年12月* 