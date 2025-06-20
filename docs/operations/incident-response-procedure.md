# Expo MCP Server インシデント対応手順書

## 概要

この文書は、Expo MCP Server の運用中に発生する可能性のあるインシデントに対する対応手順を定義します。迅速で効果的な対応により、サービスの可用性と品質を維持することを目的とします。

## インシデント分類

### 重要度レベル

| レベル | 名称 | 影響範囲 | 対応目標時間 |
|--------|------|----------|-------------|
| **P0** | Critical | 全サービス停止 | 15分以内 |
| **P1** | High | 主要機能影響 | 1時間以内 |
| **P2** | Medium | 一部機能影響 | 4時間以内 |
| **P3** | Low | 軽微な影響 | 24時間以内 |

### インシデント種別

#### 🔥 P0 - Critical
- **MCP Server完全停止**: サーバープロセスが応答しない
- **全認証システム障害**: 全ユーザーがアクセス不能
- **データ損失**: 重要データの消失または破損
- **セキュリティ侵害**: 不正アクセスやデータ漏洩

#### ⚠️ P1 - High
- **主要機能停止**: 主要MCPツールが利用不能
- **パフォーマンス重大劣化**: レスポンス時間が5倍以上
- **大量エラー発生**: エラー率が50%を超過
- **依存サービス障害**: Redis、Typesenseなど重要サービス停止

#### 🔶 P2 - Medium
- **部分機能停止**: 一部MCPツールが利用不能
- **パフォーマンス劣化**: レスポンス時間が2-5倍
- **断続的エラー**: エラー率が10-50%
- **監視システム障害**: メトリクス収集停止

#### 🔵 P3 - Low
- **軽微な機能問題**: 特定機能の動作異常
- **軽微なパフォーマンス劣化**: レスポンス時間が1.5-2倍
- **少数エラー**: エラー率が5-10%
- **ドキュメント不備**: 情報の不正確性

---

## 🚨 エスカレーション体制

### 連絡先

```
📞 Primary On-Call: [設定必要]
📞 Secondary On-Call: [設定必要]
📞 Engineering Lead: [設定必要]
📞 Product Owner: [設定必要]

📧 Incident Channel: #expo-mcp-incidents
📧 Status Updates: #expo-mcp-status
📧 Emergency Email: incident@expo.dev
```

### エスカレーション手順

1. **初期対応者** (0-15分)
   - インシデント検知・初期評価
   - 重要度分類・初期対応
   - 必要に応じてエスカレーション

2. **On-Call Engineer** (15分-1時間)
   - 技術的調査・対応
   - 状況更新・コミュニケーション
   - 復旧作業実施

3. **Engineering Lead** (1時間以降)
   - 技術的エスカレーション
   - リソース調整・意思決定
   - 外部ベンダー連携

4. **Incident Commander** (P0のみ)
   - 全体指揮・調整
   - ステークホルダー連絡
   - 事業影響判断

---

## 🔍 検知・通知システム

### 自動検知

#### アラート設定
```yaml
# High Priority Alerts
- name: "MCP Server Down"
  condition: "up{job='expo-mcp-server'} == 0"
  threshold: "30s"
  
- name: "High Error Rate"
  condition: "rate(http_requests_total{status=~'5..'}[5m]) > 0.1"
  threshold: "2m"
  
- name: "Response Time High"
  condition: "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5"
  threshold: "5m"
  
- name: "Memory Usage Critical"
  condition: "process_resident_memory_bytes > 1e9"
  threshold: "1m"
```

#### 通知チャネル
- **Slack**: #expo-mcp-alerts (リアルタイム)
- **Email**: incident@expo.dev (P0/P1のみ)
- **PagerDuty**: 24/7 On-Call (P0のみ)
- **SMS**: 緊急連絡先 (P0のみ)

### 手動通報

#### 報告テンプレート
```
🚨 INCIDENT REPORT

Priority: [P0/P1/P2/P3]
Title: [簡潔な問題説明]
Discovery Time: [発見時刻]
Reporter: [報告者]

Symptoms:
- [観察された症状1]
- [観察された症状2]

Impact:
- [影響範囲]
- [影響ユーザー数]

Initial Actions Taken:
- [実施した初期対応]

Next Steps:
- [予定する次のアクション]
```

---

## 🔧 対応手順

### Phase 1: 初期対応 (0-15分)

#### 1.1 状況確認
```bash
# サーバー状態確認
curl -s http://localhost:3000/health | jq .

# プロセス確認
ps aux | grep expo-mcp-server

# ログ確認
tail -n 100 /var/log/expo-mcp-server/error.log

# メトリクス確認
curl http://localhost:3000/metrics
```

#### 1.2 影響範囲評価
- **ユーザー影響**: 影響ユーザー数・地域
- **機能影響**: 利用不能な機能・サービス
- **依存システム**: 影響を受ける外部システム
- **データ整合性**: データ損失・不整合の有無

#### 1.3 初期通知
```
Subject: [INCIDENT P{Level}] {Title} - {Timestamp}

Status: INVESTIGATING
Impact: {Impact Description}
ETA: {Estimated Resolution Time}
Updates: Every {Frequency}

Details:
{Technical Details}

Actions:
{Current Actions}

Next Update: {Next Update Time}
```

### Phase 2: 調査・分析 (15分-1時間)

#### 2.1 ログ分析
```bash
# エラーログ分析
grep -i error /var/log/expo-mcp-server/*.log | tail -50

# アクセスログ分析
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# アプリケーションログ
journalctl -u expo-mcp-server -f --since "10 minutes ago"
```

#### 2.2 システムリソース確認
```bash
# CPU・メモリ使用率
top -p $(pgrep expo-mcp-server)

# ディスク使用量
df -h
du -sh /var/lib/expo-mcp-server/*

# ネットワーク接続
netstat -anp | grep 3000
```

#### 2.3 依存サービス確認
```bash
# Redis接続確認
redis-cli ping

# Typesense接続確認
curl http://localhost:8108/health

# データベース接続確認
pg_isready -h localhost -p 5432
```

### Phase 3: 復旧作業 (1-4時間)

#### 3.1 一般的な復旧手順

##### サービス再起動
```bash
# 安全な再起動
sudo systemctl reload expo-mcp-server

# 強制再起動（最後の手段）
sudo systemctl restart expo-mcp-server

# 設定反映確認
expo-mcp-server --validate-config
```

##### ロールバック
```bash
# 前バージョンへのロールバック
docker tag expo-mcp-server:current expo-mcp-server:rollback-$(date +%Y%m%d%H%M)
docker pull expo-mcp-server:v0.9.x
docker tag expo-mcp-server:v0.9.x expo-mcp-server:current
docker-compose up -d
```

##### データ復旧
```bash
# バックアップからの復旧
./scripts/restore-backup.sh --from=backup-20241219.tar.gz --verify

# キャッシュクリア
redis-cli FLUSHALL
rm -rf /tmp/expo-mcp-cache/*
```

#### 3.2 パフォーマンス問題対応
```bash
# スケールアップ
docker-compose up -d --scale expo-mcp-server=3

# キャッシュ最適化
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 不要プロセス停止
pkill -f "unused-service"
```

### Phase 4: 検証・監視 (復旧後)

#### 4.1 動作確認
```bash
# 基本機能テスト
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"ping","id":1}'

# 主要機能テスト
./scripts/health-check-comprehensive.sh

# 負荷テスト
ab -n 100 -c 10 http://localhost:3000/health
```

#### 4.2 継続監視
```bash
# リアルタイム監視
watch -n 5 'curl -s http://localhost:3000/metrics | grep -E "(up|error_rate|response_time)"'

# アラート状態確認
curl -s http://alertmanager:9093/api/v1/alerts
```

---

## 📊 インシデント記録

### インシデント報告書テンプレート

```markdown
# インシデント報告書

## 基本情報
- **インシデントID**: INC-YYYYMMDD-XXX
- **発生日時**: YYYY-MM-DD HH:MM:SS UTC
- **解決日時**: YYYY-MM-DD HH:MM:SS UTC
- **影響時間**: X時間Y分
- **重要度**: P{Level}
- **対応者**: [Name]

## 概要
[インシデントの簡潔な説明]

## 影響
### ユーザー影響
- 影響ユーザー数: XXX
- 影響地域: [Region]
- 利用不能機能: [Functions]

### ビジネス影響
- 推定損失: [Amount]
- SLA違反: [Yes/No]
- 外部への影響: [Description]

## タイムライン
| 時刻 | 事象 | 対応者 |
|------|------|--------|
| HH:MM | [Event] | [Person] |
| HH:MM | [Action] | [Person] |

## 根本原因
### 直接的原因
[技術的な原因の詳細]

### 間接的原因
[組織的・プロセス的な原因]

## 対応アクション
### 即時対応
- [ ] [Action 1] - [Assignee] - [Due Date]
- [ ] [Action 2] - [Assignee] - [Due Date]

### 予防策
- [ ] [Prevention 1] - [Assignee] - [Due Date]
- [ ] [Prevention 2] - [Assignee] - [Due Date]

## 学習事項
### 良かった点
- [What went well]

### 改善点
- [What could be improved]

## 承認
- **技術責任者**: [Name] - [Date]
- **プロダクト責任者**: [Name] - [Date]
```

---

## 🔄 事後対応

### 復旧後確認事項
1. **機能確認**: 全主要機能の動作確認
2. **パフォーマンス確認**: 応答時間・スループット確認
3. **データ整合性確認**: データの完全性確認
4. **監視状況確認**: アラート・メトリクス正常性確認

### ポストモーテム
- **実施時期**: インシデント解決後48時間以内
- **参加者**: 対応チーム全員
- **議題**: 
  - 時系列の整理
  - 根本原因分析
  - 対応プロセスの評価
  - 改善アクションの定義

### 改善アクション追跡
- **責任者**: Engineering Lead
- **頻度**: 週次レビュー
- **完了目標**: 1ヶ月以内

---

## 📚 参考情報

### 関連ドキュメント
- [システム運用マニュアル](operation-manual.md)
- [監視・アラート設定](monitoring-setup.md)
- [バックアップ・復旧手順](backup-recovery.md)
- [セキュリティ対応手順](security-response.md)

### 緊急時コマンド集
```bash
# 即座にサービス停止
sudo systemctl stop expo-mcp-server

# 緊急メンテナンスモード
echo "maintenance" > /var/www/status

# 全ログ収集
./scripts/collect-debug-logs.sh

# システム状態スナップショット
./scripts/system-snapshot.sh
```

### 外部連絡先
- **クラウドプロバイダー**: [Support Contact]
- **CDNプロバイダー**: [Support Contact]
- **監視サービス**: [Support Contact]
- **セキュリティチーム**: security@expo.dev

---

**更新履歴**:
- v1.0.0 (2024-12-20): 初版作成
- 次回レビュー予定: 2025-01-20

**作成者**: Expo DevRel Team  
**承認者**: [Engineering Lead Name] 