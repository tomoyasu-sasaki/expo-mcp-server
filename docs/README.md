# Expo MCP Server Documentation

## 📚 ドキュメント概要

Expo MCP Serverのドキュメントへようこそ。このドキュメントは以下のカテゴリーに整理されています：

## ❗ 重要なお知らせ

**2024年末以降、Cursor IDEのMCP設定形式が変更されました。**

従来の設定形式では動作しないため、最新の形式を使用してください：
- 設定ファイルの場所: `~/.cursor/mcp.json` （従来の `settings.json` ではない）
- `command` フィールド: `"docker"` を推奨（npmパッケージが未公開のため）
- Dockerイメージ: `expo-mcp-server:latest` （ローカルビルド必要）

### 🚀 [ユーザーガイド](./user-guide/)
エンドユーザー向けのガイドとリファレンス

- [インストールガイド](./user-guide/installation-guide.md) - Expo MCP Serverのインストール方法
- [API リファレンス](./user-guide/api-reference.md) - 利用可能なAPIの詳細
- [MCP ツールリファレンス](./user-guide/mcp-tools-reference.md) - MCPツールの完全なリファレンス
- [Cursor IDE セットアップ](./user-guide/cursor-ide-setup.md) - Cursor IDEでの設定方法
- [MCP クライアント統合](./user-guide/mcp-client-integration.md) - MCPクライアントとの統合方法
- [FAQ](./user-guide/faq.md) - よくある質問と回答
- [コントリビューティングガイド](./user-guide/contributing-guide.md) - プロジェクトへの貢献方法

### 🔧 [運用ガイド](./operations/)
システム管理者向けの運用・保守ドキュメント

- [Dockerデプロイメント](./operations/docker-deployment.md) - Dockerを使用したデプロイ方法
- [Dockerイメージドキュメント](./operations/docker-image-documentation.md) - Dockerイメージの詳細
- [インシデント対応手順](./operations/incident-response-procedure.md) - 障害発生時の対応フロー
- [バックアップ・リカバリ手順](./operations/backup-recovery-procedure.md) - データ保護とリストア
- [メンテナンス計画](./operations/maintenance-plan.md) - 定期保守とアップデート
- [パフォーマンスチューニングガイド](./operations/performance-tuning-guide.md) - 性能最適化
- [セキュリティベストプラクティス](./operations/security-best-practices.md) - セキュリティ設定
- [コミュニティサポートフレームワーク](./operations/community-support-framework.md) - コミュニティ運営

### 📋 [技術仕様](./technical-specs/)
開発者向けの技術的な仕様と設計ドキュメント

- [MCP機能マニフェスト](./technical-specs/mcp-capability-manifest.md) - MCPプロトコル実装仕様
- [OpenAPI仕様](./technical-specs/openapi-specification.md) - REST API完全仕様
- [JSONスキーマ定義](./technical-specs/json-schema-definitions.md) - データ構造定義
- [Expo設定](./technical-specs/expo.yaml) - Expo関連設定仕様

### 📊 [実装レポート](./implementation-reports/)
開発の進捗と各フェーズの成果レポート

- [実装計画](./implementation-reports/implementation_plan.md) - 全体ロードマップ
- [Phase 2 完了レポート](./implementation-reports/phase_2_completion_report.md) - 基礎実装
- [Phase 3 完了レポート](./implementation-reports/phase_3_completion_report.md) - 高度な機能
- [Phase 4 完了レポート](./implementation-reports/phase4-section4.2-completion-report.md) - パフォーマンス最適化
- [Phase 5 完了レポート](./implementation-reports/phase-5-completion-report.md) - 統合とドキュメント
- [Phase 6 完了レポート](./implementation-reports/phase-6-completion-report.md) - 運用準備
- [Phase 7 品質チェックログ](./implementation-reports/phase7-section1-quality-check-log.md) - 最終品質確認

## 🎯 クイックナビゲーション

### 新規ユーザー
1. [システム要件確認](./user-guide/installation-guide.md#システム要件)
2. [Dockerインストール](./user-guide/installation-guide.md#方法1-docker使用推奨)
3. [Cursor IDE設定](./user-guide/cursor-ide-setup.md)
4. [動作確認](./user-guide/cursor-ide-setup.md#動作確認)

### 既存ユーザー（設定更新）
1. [新しい設定形式の確認](./user-guide/cursor-ide-setup.md#❗-重要-設定形式について)
2. [設定ファイルの移行](./user-guide/cursor-ide-setup.md#docker-ベース設定推奨)
3. [トラブルシューティング](./user-guide/cursor-ide-setup.md#トラブルシューティング)

### 開発者・管理者
1. [技術仕様の確認](./technical-specs/)
2. [Docker運用ガイド](./operations/docker-deployment.md)
3. [パフォーマンス最適化](./operations/performance-tuning-guide.md)
4. [セキュリティ設定](./operations/security-best-practices.md)

## 📝 最新の調査・修正内容

### Cursor MCP 設定の修正（2024年12月）

以下の問題を特定・修正しました：

#### 発見した問題
1. **設定形式の変更**: 2024年末以降、Cursor IDEのMCP設定が変更
2. **commandフィールドの誤り**: `"expo-mcp-server"` は未公開のnpmパッケージ
3. **Dockerエントリーポイントの問題**: `--stdio` 引数が正しく処理されない
4. **ドキュメントの乖離**: 公式ドキュメントと実装の不一致

#### 修正内容
1. **設定ファイルの場所**: `~/.cursor/mcp.json` に統一
2. **Dockerベース設定**: `command: "docker"` に変更
3. **環境変数による制御**: `MCP_MODE=stdio` で動作モード指定
4. **完全なドキュメント更新**: 最新形式に対応

#### 正しい設定例
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MCP_MODE=stdio",
        "expo-mcp-server:latest"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### 参考にした実装
- [Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server): Dockerベースの設定例
- [Cursor MCP 公式ドキュメント](https://docs.cursor.com/context/model-context-protocol): 最新の設定形式
- [MCP プロトコル仕様](https://modelcontextprotocol.io/introduction): プロトコル詳細

## 🛠️ 技術詳細

### アーキテクチャ
- **プロトコル**: Model Context Protocol (MCP) 2024-11-05
- **トランスポート**: stdio（推奨）、HTTP+SSE
- **コンテナ**: Docker（マルチアーキテクチャ対応）
- **ランタイム**: Node.js 18+

### 機能概要
- **ツール**: 8種類のExpo関連ツール
- **リソース**: 5種類のドキュメント・設定リソース
- **プロンプト**: 4種類の支援プロンプト
- **キャッシュ**: Redis・Typesense統合（オプション）

### パフォーマンス
- **起動時間**: <1秒（Docker）
- **メモリ使用量**: ~50MB（基本）
- **レスポンス時間**: <100ms（平均）
- **同時接続**: 100接続対応

## 🔗 外部リソース

- **Expo 公式ドキュメント**: [https://docs.expo.dev/](https://docs.expo.dev/)
- **Model Context Protocol**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)
- **Cursor IDE**: [https://cursor.sh/](https://cursor.sh/)
- **Docker Hub**: [https://hub.docker.com/](https://hub.docker.com/)（将来の公式イメージ用）

## 📞 サポート

### コミュニティサポート
- **GitHub Issues**: [リポジトリ](https://github.com/expo/expo-mcp-server/issues)
- **Discord**: [Expo Community](https://discord.gg/expo)
- **Stack Overflow**: `expo-mcp-server` タグ

### ドキュメント貢献
- [コントリビューティングガイド](./user-guide/contributing-guide.md)
- [ドキュメント改善提案](https://github.com/expo/expo-mcp-server/issues/new?template=documentation.md)

---

**更新情報**: このドキュメントは定期的に更新されます。重要な変更については GitHub Releases でお知らせします。

*最終更新: 2024年12月 - Cursor MCP設定修正対応* 