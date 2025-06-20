# Expo MCP Server

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![npm](https://img.shields.io/badge/npm-%3E%3D8.0.0-red.svg)
![Docker](https://img.shields.io/badge/docker-supported-blue.svg)
![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple.svg)

Model Context Protocol (MCP) サーバーの実装。Expo ドキュメント、API リファレンス、コミュニティリソースからコンテンツを取得・インデックス化・検索し、Cursor や他の開発者ツールでMCPプロトコル経由で利用可能にします。

## 🚀 主要機能

- **🔌 MCP Protocol 2024-11-05 準拠**: JSON-RPC 2.0 over stdio通信をサポート
- **📱 Expo エコシステム統合**: 公式ドキュメント、SDK API、EAS CLI、Snack統合
- **⚡ 高速検索**: Typesense によるタイポ耐性・ファセット検索
- **🤖 コンテキスト認識推薦**: 埋め込みモデルによる関連コンテンツ推薦
- **🐳 Docker & Multi-Arch 対応**: AMD64、ARM64 マルチプラットフォーム対応
- **🔒 セキュリティ強化**: 入力検証、レート制限、サンドボックス実行
- **📊 監視 & メトリクス**: Prometheus、Grafana統合
- **🌐 複数トランスポート**: stdio (主要)、HTTP + SSE、WebSocket (フォールバック)

## 📦 インストール

### Option 1: npm/npx (推奨)

```bash
# グローバルインストール
npm install -g expo-mcp-server

# 使用 
expo-mcp-server --stdio

# または npx で直接実行
npx expo-mcp-server --stdio
```

### Option 2: Docker

```bash
# Docker Hub から取得
docker pull expo/expo-mcp-server:latest

# stdio モード実行
docker run -i expo/expo-mcp-server:latest --stdio

# HTTP モード実行
docker run -p 3000:3000 expo/expo-mcp-server:latest --port 3000
```

### Option 3: ソースからビルド

```bash
# リポジトリクローン
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server

# 依存関係インストール & ビルド
npm install
npm run build

# 実行
npm run mcp:stdio
```

## 🛠 使用方法

### MCP モード (stdio) - メイン用途

```bash
# MCP クライアント（Cursor、Claude Desktop等）から使用
expo-mcp-server --stdio

# 設定付き実行
NODE_ENV=production LOG_LEVEL=info expo-mcp-server --stdio
```

### HTTP モード - 開発・テスト用

```bash
# HTTP API モード
expo-mcp-server --port 3000

# ブラウザで http://localhost:3000 にアクセス
```

### 開発モード

```bash
# ホットリロード付き開発モード
npm run dev

# テスト実行
npm test

# 型チェック & リント
npm run type-check
npm run lint
```

## 🔌 MCP クライアント統合

### Cursor IDE

**Docker設定 (推奨) (.cursor/mcp.json)**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "NODE_ENV=production",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=info",
        "expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

**npm設定 (代替)**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "npx",
      "args": ["expo-mcp-server", "--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Claude Desktop

**Docker設定 (推奨) (~/Library/Application Support/Claude/claude_desktop_config.json)**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "NODE_ENV=production",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=info",
        "expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

**npm設定 (代替)**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "npx",
      "args": ["expo-mcp-server", "--stdio"]
    }
  }
}
```

### その他のMCPクライアント

任意のMCP準拠クライアントで使用可能です：
```bash
# 標準的なMCP stdio接続
your-mcp-client --server "expo-mcp-server --stdio"
```

## 📚 MCP ツール一覧

| ツール名 | 説明 | 主要な使用場面 |
|---------|------|----------------|
| `expo_read_document` | Expoドキュメント・APIリファレンス取得 | 公式ドキュメント参照 |
| `expo_search_documents` | エコシステム全体コンテンツ検索 | 関連情報の横断検索 |
| `expo_recommend` | コンテキスト認識推薦 | 開発中の最適な提案 |
| `expo_get_sdk_module` | SDK モジュール詳細情報 | API仕様詳細確認 |
| `expo_config_templates` | 設定ファイル生成・検証 | プロジェクト設定 |
| `expo_eas_command_builder` | EAS CLI コマンド生成 | ビルド・デプロイ支援 |
| `expo_code_examples` | 実行可能コード例・Snack統合 | 学習・プロトタイピング |
| `expo_error_diagnosis` | エラー分析・解決策提供 | トラブルシューティング |

詳細は [MCP Tools Reference](docs/user-guide/mcp-tools-reference.md) を参照してください。

## 🐳 Docker での実行

### 単体実行

```bash
# ローカルビルド (マルチアーキテクチャ)
npm run docker:buildx

# stdio モード
docker run -i expo-mcp-server:latest --stdio

# HTTP モード (ポートフォワーディング)
docker run -p 3000:3000 expo-mcp-server:latest --port 3000

# 永続データ付き実行
docker run -v ./data:/app/data -i expo-mcp-server:latest --stdio
```

### Docker Compose (フルスタック)

```bash
# 全サービス起動（Redis、Typesense、監視含む）
docker-compose up -d

# ログ確認
docker-compose logs -f expo-mcp-api

# 停止
docker-compose down
```

### プロダクション運用

```bash
# セキュリティ強化設定で実行
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 署名済みイメージ検証
docker trust inspect expo/expo-mcp-server:latest
```

## 🧪 テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# MCP特有テスト
npm run test:mcp

# パッケージング検証
npm run test:package

# E2E テスト
npm run test:e2e

# 負荷テスト
npm run test:load
```

## ⚙️ 設定

### 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `NODE_ENV` | `development` | 実行環境 |
| `MCP_MODE` | `stdio` | 通信モード (stdio/http) |
| `LOG_LEVEL` | `info` | ログレベル |
| `CACHE_TTL_SECONDS` | `3600` | キャッシュ有効期間 |
| `RATE_LIMIT_RPM` | `2000` | レート制限 (requests/min) |
| `LOCAL_STORAGE_PATH` | `./data` | データ保存パス |

### 設定ファイル

```bash
# デフォルト設定をコピー
cp config/default.json config/local.json

# 設定編集
vim config/local.json
```

詳細は [Installation Guide](docs/user-guide/installation-guide.md) を参照してください。

## 🚀 パフォーマンス

### パフォーマンス目標

- **📈 MCP Server起動**: < 10秒
- **⚡ JSON-RPC レスポンス**: P95 < 50ms
- **🔍 検索クエリ**: P95 < 100ms  
- **💾 メモリ使用量**: < 1GB
- **👥 同時セッション**: 200+

### チューニング

```bash
# パフォーマンス最適化設定
NODE_ENV=production \
CACHE_TTL_SECONDS=7200 \
MAX_CONCURRENT_SESSIONS=500 \
expo-mcp-server --stdio
```

詳細は [Performance Tuning Guide](docs/operations/performance-tuning-guide.md) を参照してください。

## 🔒 セキュリティ

- **🛡️ 入力検証**: JSON Schema ベース検証
- **🚫 レート制限**: セッション毎 2000 req/hour
- **🔐 サンドボックス**: ファイルアクセス制限
- **📝 監査ログ**: 全操作ログ記録
- **🔍 脆弱性スキャン**: 自動セキュリティチェック

詳細は [Security Best Practices](docs/operations/security-best-practices.md) を参照してください。

## 📊 監視

### Prometheus メトリクス

```bash
# メトリクス確認
curl http://localhost:9090/metrics
```

### Grafana ダッシュボード

- MCP セッション監視
- レスポンス時間分析  
- エラー率トラッキング
- リソース使用量

詳細は [Docker Deployment Guide](docs/operations/docker-deployment.md#monitoring) を参照してください。

## 🔧 開発

### ディレクトリ構造

```
expo-mcp-server/
├── src/                 # ソースコード
│   ├── mcp/            # MCP プロトコル実装
│   ├── services/       # コアサービス
│   ├── security/       # セキュリティ機能
│   └── utils/          # ユーティリティ
├── tests/              # テスト
├── docs/               # ドキュメント
├── config/             # 設定ファイル
├── docker/             # Docker関連
├── monitoring/         # 監視設定
└── dist/               # ビルド出力
```

### 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# リント & フォーマット
npm run lint:fix

# 型チェック
npm run type-check

# セキュリティ監査
npm audit
```

### コントリビューション

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

詳細は [Contributing Guide](docs/user-guide/contributing-guide.md) を参照してください。

## 📖 ドキュメント

完全なドキュメントは [docs/README.md](docs/README.md) をご覧ください。

### ユーザーガイド
- [📥 Installation Guide](docs/user-guide/installation-guide.md) - インストール・セットアップ
- [🔌 MCP Client Integration](docs/user-guide/mcp-client-integration.md) - クライアント統合方法
- [⚙️ Cursor IDE Setup](docs/user-guide/cursor-ide-setup.md) - Cursor IDE設定
- [🛠️ MCP Tools Reference](docs/user-guide/mcp-tools-reference.md) - ツール詳細
- [📚 API Reference](docs/user-guide/api-reference.md) - API仕様書

### 運用ガイド
- [🐳 Docker Deployment](docs/operations/docker-deployment.md) - Docker運用ガイド
- [🔒 Security Best Practices](docs/operations/security-best-practices.md) - セキュリティガイド
- [⚡ Performance Tuning](docs/operations/performance-tuning-guide.md) - パフォーマンス最適化
- [🚨 Incident Response](docs/operations/incident-response-procedure.md) - インシデント対応
- [💾 Backup & Recovery](docs/operations/backup-recovery-procedure.md) - バックアップ手順

### 技術仕様書
- [🔌 MCP Capability Manifest](docs/technical-specs/mcp-capability-manifest.md) - MCP機能一覧
- [🌐 OpenAPI Specification](docs/technical-specs/openapi-specification.md) - HTTP API仕様
- [📋 JSON Schema Definitions](docs/technical-specs/json-schema-definitions.md) - スキーマ定義
- [⚙️ Expo Config](docs/technical-specs/expo.yaml) - Expo設定仕様

## ❓ トラブルシューティング

### 一般的な問題

**Q: MCP Server が起動しない**
```bash
# ログレベルを上げて詳細確認
LOG_LEVEL=debug expo-mcp-server --stdio
```

**Q: パフォーマンスが遅い**
```bash
# キャッシュ設定確認
curl http://localhost:3000/health
```

**Q: Docker接続できない**
```bash
# ヘルスチェック確認
docker exec expo-mcp-server node health-check.cjs
```

より詳細な解決方法は [FAQ](docs/user-guide/faq.md) を参照してください。

## 📄 ライセンス

MIT License - [LICENSE](LICENSE) ファイルを参照してください。

## 🤝 サポート & コミュニティ

- **🐛 バグ報告**: [GitHub Issues](https://github.com/expo/expo-mcp-server/issues)
- **💡 機能提案**: [GitHub Discussions](https://github.com/expo/expo-mcp-server/discussions)
- **📧 お問い合わせ**: devrel@expo.dev
- **🌐 公式サイト**: [expo.dev](https://expo.dev)

## 🏗 開発状況

このプロジェクトは **Phase 7 Section 7.2** まで進行中です。  
詳細な進捗は [Implementation Plan](docs/implementation-reports/implementation_plan.md) で確認できます。

**達成率**: 98% (CI/CD パイプライン、スタンドアローンバイナリが残存)

---

**🚀 Made with ❤️ by Expo DevRel Team**  
[GitHub](https://github.com/expo/expo-mcp-server) | [Issues](https://github.com/expo/expo-mcp-server/issues) | [Docs](docs/)

[![npm](https://img.shields.io/npm/v/expo-mcp-server)](https://www.npmjs.com/package/expo-mcp-server)
[![Docker](https://img.shields.io/docker/v/expo/expo-mcp-server)](https://hub.docker.com/r/expo/expo-mcp-server)
[![GitHub Stars](https://img.shields.io/github/stars/expo/expo-mcp-server)](https://github.com/expo/expo-mcp-server/stargazers) 