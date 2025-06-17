# Expo MCP Server

Model Context Protocol (MCP) サーバーの実装。Expo ドキュメント、API リファレンス、コミュニティリソースからコンテンツを取得・インデックス化・検索し、Cursor や他の開発者ツールでMCPプロトコル経由で利用可能にします。

## 🚀 機能

- **MCP Protocol 2024-11-05 準拠**: JSON-RPC 2.0 over stdio通信をサポート
- **Expo エコシステム統合**: 公式ドキュメント、SDK API、EAS CLI
- **高速検索**: Typesense によるタイポ耐性・ファセット検索
- **コンテキスト認識推薦**: 埋め込みモデルによる関連コンテンツ推薦
- **Docker対応**: 本番環境対応のコンテナ化
- **複数トランスポート**: stdio (主要)、HTTP + SSE (フォールバック)

## 📋 要件

- **Node.js**: 18+ 
- **npm**: 8+
- **Docker**: 20+ (オプション)
- **Docker Compose**: 2+ (オプション)

## 🛠 インストール

### 1. リポジトリクローン

```bash
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server
```

### 2. 依存関係インストール

```bash
npm install
```

### 3. 環境設定

```bash
cp .env.example .env
# 必要に応じて .env ファイルを編集
```

### 4. ビルド

```bash
npm run build
```

## 🚀 使用方法

### MCP (stdio モード)

```bash
# MCP クライアント（Cursor等）から使用
npm run mcp:stdio
```

### HTTP モード

```bash
# 開発・テスト用
npm run mcp:http
```

### 開発モード

```bash
# ホットリロード付き開発モード
npm run dev
```

## 🐳 Docker での実行

### 単体実行

```bash
# Docker イメージビルド
npm run docker:build

# MCP stdio モード
npm run docker:mcp

# HTTP モード
npm run docker:run
```

### Docker Compose

```bash
# 全サービス起動（Redis、Typesense含む）
docker-compose up -d
```

## 🧪 テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# MCP特有テスト
npm run test:mcp

# 型チェック
npm run type-check

# リント
npm run lint
```

## 📚 MCP ツール

| ツール名 | 説明 |
|---------|------|
| `expo_read_document` | Expoドキュメント・APIリファレンス取得 |
| `expo_search_documents` | エコシステム全体コンテンツ検索 |
| `expo_recommend` | コンテキスト認識推薦 |
| `expo_get_sdk_module` | SDK モジュール詳細情報 |
| `expo_config_templates` | 設定ファイル生成・検証 |
| `expo_eas_command_builder` | EAS CLI コマンド生成 |
| `expo_code_examples` | 実行可能コード例・Snack統合 |
| `expo_error_diagnosis` | エラー分析・解決策提供 |

## 🔧 開発

### ディレクトリ構造

```
expo-mcp-server/
├── src/                 # ソースコード
├── tests/               # テスト
├── docs/                # ドキュメント
├── config/              # 設定ファイル
├── docker/              # Docker関連
└── dist/                # ビルド出力
```

### スクリプト

- `npm run dev`: 開発モード
- `npm run build`: ビルド
- `npm run test`: テスト実行
- `npm run lint`: リント
- `npm run type-check`: 型チェック

## 📖 ドキュメント

- [API Reference](docs/api.md)
- [MCP Integration Guide](docs/mcp-integration.md)
- [Docker Deployment](docs/docker.md)
- [Contributing](docs/contributing.md)

## 🤝 貢献

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License - see [LICENSE](LICENSE) file for details.

## 🏗 開発状況

このプロジェクトは開発中です。[implementation_plan.md](implementation_plan.md) で進捗を確認できます。

---

**Expo DevRel Team** | [GitHub](https://github.com/expo/expo-mcp-server) | [Issues](https://github.com/expo/expo-mcp-server/issues) 