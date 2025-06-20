# Expo MCP Server バックアップ・復旧手順書

## 概要

この文書は、Expo MCP Server のデータ保護とサービス継続性を確保するためのバックアップ・復旧手順を定義します。定期的なバックアップ実行と迅速な復旧により、データ損失リスクを最小化し、サービスの可用性を維持します。

## バックアップ戦略

### 対象データ

#### 1. アプリケーションデータ 🗂️
- **設定ファイル**: `config/*.json`
- **MCP設定**: `mcp-config.json`
- **カスタムスクリプト**: `scripts/*`
- **ログファイル**: `/var/log/expo-mcp-server/*`

#### 2. 外部データストア 📊
- **Redis**: キャッシュデータ・セッション情報
- **Typesense**: 検索インデックス・ドキュメントデータ
- **ファイルシステム**: 一時ファイル・アップロードデータ

#### 3. システム設定 ⚙️
- **Docker設定**: `docker-compose.yml`, `Dockerfile`
- **監視設定**: `monitoring/*`
- **セキュリティ設定**: SSL証明書、APIキー

### バックアップ頻度

| データ種別 | 頻度 | 保持期間 | 優先度 |
|-----------|------|----------|--------|
| 設定ファイル | 毎日 | 30日 | High |
| Redis | 毎時 | 7日 | Medium |
| Typesense | 毎6時間 | 14日 | High |
| ログファイル | 毎週 | 90日 | Low |
| システム設定 | 変更時 | 無期限 | Critical |

---

## 🔄 バックアップ手順

### 1. 自動バックアップ設定

#### Docker環境でのバックアップ
```bash
#!/bin/bash
# backup-docker.sh

BACKUP_DIR="/var/backups/expo-mcp-server"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="expo-mcp-backup-${TIMESTAMP}.tar.gz"

# バックアップディレクトリ作成
mkdir -p ${BACKUP_DIR}

# コンテナ一時停止
echo "🔄 Stopping containers for backup..."
docker-compose stop

# データボリュームバックアップ
echo "📦 Creating backup archive..."
docker run --rm \
  -v expo-mcp-server_data:/source:ro \
  -v ${BACKUP_DIR}:/backup \
  alpine:latest \
  tar czf /backup/${BACKUP_FILE} -C /source .

# Redis データ保存
echo "💾 Backing up Redis data..."
docker-compose exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb ${BACKUP_DIR}/redis-${TIMESTAMP}.rdb

# Typesense データ保存
echo "🔍 Backing up Typesense data..."
docker-compose exec typesense curl -X POST "http://localhost:8108/operations/snapshot?snapshot_path=/data/backup-${TIMESTAMP}" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}"

# コンテナ再開
echo "▶️ Restarting containers..."
docker-compose start

# バックアップ検証
echo "✅ Verifying backup..."
tar -tzf ${BACKUP_DIR}/${BACKUP_FILE} > /dev/null && echo "Backup verification successful"

# 古いバックアップ削除
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.rdb" -mtime +7 -delete

echo "🎉 Backup completed: ${BACKUP_FILE}"
```

#### システム設定のバックアップ
```bash
#!/bin/bash
# backup-config.sh

CONFIG_BACKUP_DIR="/var/backups/expo-mcp-config"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p ${CONFIG_BACKUP_DIR}

# 設定ファイルバックアップ
echo "⚙️ Backing up configuration files..."
tar czf ${CONFIG_BACKUP_DIR}/config-${TIMESTAMP}.tar.gz \
  config/ \
  mcp-config.json \
  docker-compose.yml \
  Dockerfile \
  monitoring/ \
  package.json \
  scripts/

# 環境変数保存
echo "🔐 Backing up environment variables..."
printenv | grep -E '^(EXPO_|MCP_|REDIS_|TYPESENSE_)' > ${CONFIG_BACKUP_DIR}/env-${TIMESTAMP}.txt

# Git設定保存
echo "📝 Backing up Git information..."
git log --oneline -10 > ${CONFIG_BACKUP_DIR}/git-${TIMESTAMP}.log
git status --porcelain > ${CONFIG_BACKUP_DIR}/git-status-${TIMESTAMP}.txt

echo "✅ Configuration backup completed"
```

### 2. 手動バックアップ

#### 緊急時バックアップ
```bash
# 即座にバックアップ実行
./scripts/backup-emergency.sh

# 特定データのみバックアップ
./scripts/backup-selective.sh --redis --typesense
```

#### バックアップ前チェック
```bash
# ディスク容量確認
df -h /var/backups

# サービス状態確認
docker-compose ps

# 実行中のプロセス確認
docker stats --no-stream
```

---

## 🔧 復旧手順

### 1. 緊急時復旧 (P0インシデント)

#### 完全復旧手順
```bash
#!/bin/bash
# restore-emergency.sh

BACKUP_FILE=$1
RESTORE_DIR="/tmp/expo-mcp-restore"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: $0 <backup_file>"
  exit 1
fi

echo "🚨 Emergency restore starting..."

# 現在のサービス停止
echo "⏹️ Stopping all services..."
docker-compose down

# バックアップファイル展開
echo "📦 Extracting backup..."
mkdir -p ${RESTORE_DIR}
tar xzf ${BACKUP_FILE} -C ${RESTORE_DIR}

# データ復旧
echo "💾 Restoring data volumes..."
docker volume create expo-mcp-server_data
docker run --rm \
  -v expo-mcp-server_data:/target \
  -v ${RESTORE_DIR}:/source:ro \
  alpine:latest \
  cp -r /source/. /target/

# 設定ファイル復旧
echo "⚙️ Restoring configuration..."
cp -r ${RESTORE_DIR}/config/* ./config/
cp ${RESTORE_DIR}/mcp-config.json .

# サービス再開
echo "▶️ Starting services..."
docker-compose up -d

# 復旧確認
echo "🔍 Verifying restoration..."
sleep 30
curl -f http://localhost:3000/health || echo "⚠️ Health check failed"

# 後処理
rm -rf ${RESTORE_DIR}

echo "✅ Emergency restore completed"
```

### 2. 段階的復旧

#### Phase 1: 基盤サービス復旧
```bash
# 基盤サービスのみ復旧
docker-compose up -d redis typesense

# 接続確認
redis-cli ping
curl http://localhost:8108/health
```

#### Phase 2: アプリケーション復旧
```bash
# アプリケーション復旧
docker-compose up -d expo-mcp-server

# 基本機能確認
curl http://localhost:3000/health
```

#### Phase 3: 監視システム復旧
```bash
# 監視システム復旧
docker-compose up -d prometheus grafana alertmanager

# 監視状態確認
curl http://localhost:9090/api/v1/status/tsdb
```

### 3. データ整合性確認

#### 復旧後検証
```bash
#!/bin/bash
# verify-restore.sh

echo "🔍 Starting restoration verification..."

# 基本サービス確認
echo "1. Basic service check..."
curl -s http://localhost:3000/health | jq .

# MCP機能確認
echo "2. MCP functionality check..."
echo '{"method":"ping","id":1}' | curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" -d @-

# Redis確認
echo "3. Redis check..."
redis-cli ping

# Typesense確認
echo "4. Typesense check..."
curl -s http://localhost:8108/health | jq .

# 監視システム確認
echo "5. Monitoring check..."
curl -s http://localhost:9090/-/healthy

echo "✅ Restoration verification completed"
```

---

## 📊 監視・アラート

### バックアップ監視

#### 自動監視設定
```yaml
# monitoring/backup-alerts.yml
groups:
  - name: backup_alerts
    rules:
      - alert: BackupFailed
        expr: time() - backup_last_success_timestamp > 86400
        for: 1h
        labels:
          severity: high
        annotations:
          summary: "Backup has not succeeded for 24 hours"
          
      - alert: BackupDiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/var/backups"} / node_filesystem_size_bytes{mountpoint="/var/backups"}) < 0.1
        for: 5m
        labels:
          severity: medium
        annotations:
          summary: "Backup disk space is low"
```

#### 通知設定
```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'backup-alerts'
  routes:
  - match:
      alertname: BackupFailed
    receiver: 'critical-alerts'

receivers:
- name: 'backup-alerts'
  slack_configs:
  - api_url: '${SLACK_WEBHOOK_URL}'
    channel: '#expo-mcp-backup'
    title: 'Backup Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

---

## 🔐 セキュリティ

### バックアップデータ暗号化

#### GPG暗号化
```bash
# バックアップ暗号化
gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-digest-algo SHA512 \
  --output backup-encrypted.tar.gz.gpg backup.tar.gz

# 復号化
gpg --decrypt backup-encrypted.tar.gz.gpg > backup.tar.gz
```

#### アクセス制御
```bash
# バックアップディレクトリ権限設定
chmod 700 /var/backups/expo-mcp-server
chown expo-mcp:expo-mcp /var/backups/expo-mcp-server

# バックアップファイル権限
chmod 600 /var/backups/expo-mcp-server/*.tar.gz
```

### リモートバックアップ

#### S3バックアップ
```bash
#!/bin/bash
# backup-s3.sh

AWS_BUCKET="expo-mcp-backups"
BACKUP_FILE=$1

# S3アップロード
aws s3 cp ${BACKUP_FILE} s3://${AWS_BUCKET}/$(date +%Y)/$(date +%m)/ \
  --server-side-encryption AES256 \
  --storage-class STANDARD_IA

# 古いバックアップ削除
aws s3 rm s3://${AWS_BUCKET}/ --recursive \
  --exclude "*" \
  --include "*.tar.gz" \
  --older-than $(date -d '30 days ago' +%Y-%m-%d)
```

---

## 🧪 テスト・検証

### バックアップテスト

#### 定期テスト
```bash
#!/bin/bash
# test-backup-restore.sh

TEST_BACKUP="test-backup-$(date +%Y%m%d).tar.gz"

echo "🧪 Starting backup/restore test..."

# テスト用バックアップ作成
./scripts/backup-docker.sh test

# テスト環境で復旧実行
docker-compose -f docker-compose.test.yml down
./scripts/restore-emergency.sh ${TEST_BACKUP}

# 機能確認
./scripts/verify-restore.sh

# テスト環境クリーンアップ
docker-compose -f docker-compose.test.yml down
rm -f ${TEST_BACKUP}

echo "✅ Backup/restore test completed"
```

### 災害復旧テスト

#### 月次災害復旧演習
```bash
#!/bin/bash
# disaster-recovery-drill.sh

echo "🔥 Disaster Recovery Drill Starting..."

# 1. 現在の状態記録
echo "📊 Recording current state..."
docker-compose ps > /tmp/dr-state-before.txt

# 2. 災害シミュレーション
echo "💥 Simulating disaster..."
docker-compose down
docker volume rm expo-mcp-server_data

# 3. 復旧実行
echo "🚑 Executing recovery..."
LATEST_BACKUP=$(ls -t /var/backups/expo-mcp-server/*.tar.gz | head -1)
./scripts/restore-emergency.sh ${LATEST_BACKUP}

# 4. 確認
echo "🔍 Verifying recovery..."
docker-compose ps > /tmp/dr-state-after.txt
./scripts/verify-restore.sh

# 5. レポート作成
echo "📋 Creating drill report..."
cat << EOF > /tmp/dr-drill-report.txt
Disaster Recovery Drill Report
Date: $(date)
Backup used: ${LATEST_BACKUP}
Recovery time: [Manual input required]
Issues encountered: [Manual input required]
EOF

echo "✅ Disaster recovery drill completed"
```

---

## 📋 運用手順

### 日常運用

#### 日次チェック
```bash
# バックアップ状況確認
ls -la /var/backups/expo-mcp-server/ | tail -5

# ディスク使用量確認
df -h /var/backups

# バックアップログ確認
tail -20 /var/log/expo-mcp-backup.log
```

#### 週次チェック
```bash
# バックアップ整合性確認
./scripts/verify-backup-integrity.sh

# 古いバックアップクリーンアップ
./scripts/cleanup-old-backups.sh

# バックアップサイズ監視
du -sh /var/backups/expo-mcp-server/
```

### 緊急時対応

#### RTO/RPO目標
- **RTO (Recovery Time Objective)**: 4時間
- **RPO (Recovery Point Objective)**: 1時間

#### エスカレーション
1. **バックアップ失敗**: 24時間以内に解決
2. **復旧失敗**: 即座にエスカレーション
3. **データ損失**: 緊急事態宣言

---

## 📊 メトリクス・KPI

### バックアップ品質指標

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| バックアップ成功率 | 99.5% | 日次レポート |
| 復旧時間 | <4時間 | 災害復旧演習 |
| データ整合性 | 100% | 週次検証 |
| ディスク使用効率 | <80% | 日次監視 |

### 改善アクション

#### 継続的改善
- 月次復旧演習実施
- 四半期バックアップ戦略見直し
- 年次災害復旧計画更新

---

## 📚 関連資料

### 手順書
- [インシデント対応手順書](incident-response-procedure.md)
- [監視・アラート設定](monitoring-setup.md)
- [セキュリティ対応手順](security-response.md)

### スクリプト
- `scripts/backup-docker.sh`: Docker環境バックアップ
- `scripts/backup-config.sh`: 設定ファイルバックアップ
- `scripts/restore-emergency.sh`: 緊急復旧
- `scripts/verify-restore.sh`: 復旧検証

### 連絡先
- **バックアップ責任者**: [設定必要]
- **システム管理者**: [設定必要]
- **緊急連絡先**: backup-emergency@expo.dev

---

**更新履歴**:
- v1.0.0 (2024-12-20): 初版作成
- 次回レビュー予定: 2025-01-20

**作成者**: Expo DevRel Team  
**承認者**: [Infrastructure Lead Name] 