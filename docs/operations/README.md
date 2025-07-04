# 運用ガイド

Expo MCP Serverの運用・保守に関するドキュメントです。

## 📚 目次

### 🚀 デプロイメント

1. **[Dockerデプロイメント](./docker-deployment.md)**
   - Dockerコンテナのセットアップ
   - docker-composeによる構成
   - 環境変数の設定
   - ヘルスチェックの設定

2. **[Dockerイメージドキュメント](./docker-image-documentation.md)**
   - イメージの構成
   - ビルドプロセス
   - マルチアーキテクチャ対応
   - セキュリティ強化

### 🛡️ セキュリティ・信頼性

3. **[セキュリティベストプラクティス](./security-best-practices.md)**
   - セキュリティ設定
   - 認証・認可
   - 脆弱性対策
   - 監査ログ

4. **[インシデント対応手順](./incident-response-procedure.md)**
   - インシデントレベル定義（P0-P3）
   - エスカレーションフロー
   - 対応プレイブック
   - 事後分析プロセス

5. **[バックアップ・リカバリ手順](./backup-recovery-procedure.md)**
   - バックアップ戦略
   - 自動バックアップ設定
   - リストア手順
   - 災害復旧計画

### 🔧 保守・最適化

6. **[メンテナンス計画](./maintenance-plan.md)**
   - 定期保守スケジュール
   - アップデート手順
   - ヘルスチェック項目
   - パフォーマンス監視

7. **[パフォーマンスチューニングガイド](./performance-tuning-guide.md)**
   - パフォーマンス指標
   - チューニングパラメータ
   - キャッシュ戦略
   - スケーリング方法

### 🤝 サポート体制

8. **[コミュニティサポートフレームワーク](./community-support-framework.md)**
   - サポートチャネル
   - エスカレーションパス
   - SLA定義
   - ナレッジベース管理

## 🎯 運用フロー

### 初期セットアップ
1. [Dockerデプロイメント](./docker-deployment.md)で環境構築
2. [セキュリティベストプラクティス](./security-best-practices.md)に従って設定
3. [バックアップ・リカバリ手順](./backup-recovery-procedure.md)でバックアップ設定

### 日常運用
1. [メンテナンス計画](./maintenance-plan.md)に従って定期保守
2. [パフォーマンスチューニングガイド](./performance-tuning-guide.md)で性能監視
3. 問題発生時は[インシデント対応手順](./incident-response-procedure.md)に従う

### サポート対応
1. [コミュニティサポートフレームワーク](./community-support-framework.md)でユーザーサポート
2. インシデント履歴の管理と改善

## 📊 運用指標

- **可用性目標**: 99.9%（月間ダウンタイム: 43.83分以内）
- **レスポンスタイム**: P95 < 200ms
- **バックアップRPO**: 1時間
- **リカバリRTO**: 4時間

## 📌 関連リンク

- [メインドキュメント](../README.md)
- [ユーザーガイド](../user-guide/)
- [技術仕様](../technical-specs/)
- [実装レポート](../implementation-reports/)

---

最終更新日: 2024年12月 