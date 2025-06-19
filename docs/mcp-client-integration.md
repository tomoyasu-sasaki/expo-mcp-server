# MCP クライアント統合ガイド

## 概要

Expo MCP ServerはModel Context Protocol (MCP) 仕様に準拠しており、Claude、Cursor、その他のMCP対応クライアントと統合できます。このガイドでは、主要なMCPクライアントでの設定方法を説明します。

## MCP プロトコルについて

Model Context Protocol (MCP) は、AIアシスタントが外部のツールやデータソースにアクセスするための標準プロトコルです。

### 主な特徴

- **JSON-RPC 2.0**: 標準的なメッセージング形式
- **stdio/HTTP トランスポート**: 複数の通信方式をサポート
- **ツール・リソース・プロンプト**: 3つの主要機能カテゴリ
- **セキュリティ**: サンドボックス実行と権限制御

## Claude Desktop との統合

### 1. Claude Desktop インストール

[Claude Desktop](https://claude.ai/desktop) をダウンロードしてインストールします。

### 2. MCP 設定ファイル作成

Claude Desktop の設定ディレクトリに MCP 設定を追加します：

**macOS/Linux:**
```bash
# 設定ディレクトリ確認
ls ~/Library/Application\ Support/Claude/

# MCP 設定ファイル作成
cat > ~/Library/Application\ Support/Claude/mcp_servers.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server",
      "args": ["--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
```

**Windows:**
```powershell
# 設定ディレクトリ確認
ls $env:APPDATA\Claude\

# MCP 設定ファイル作成
@'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server.exe",
      "args": ["--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
'@ | Out-File -FilePath "$env:APPDATA\Claude\mcp_servers.json" -Encoding UTF8
```

### 3. Claude Desktop 再起動

設定後、Claude Desktop を再起動します。正常に接続されると、チャット画面でExpo関連の質問に詳細な回答が得られます。

### 4. 動作確認

Claude Desktop で以下の質問を試してください：

```
Expoでカメラ機能を実装する方法を教えて
```

正常に統合されていれば、MCPサーバーから最新のドキュメントとコード例が提供されます。

## Cursor IDE との統合

### 1. Cursor MCP 設定

Cursor IDE での MCP 設定は専用のガイド [Cursor IDE 設定ガイド](cursor-ide-setup.md) を参照してください。

### 2. 基本設定例

```json
{
  "mcp": {
    "servers": {
      "expo": {
        "command": "expo-mcp-server",
        "args": ["--stdio"],
        "description": "Expo documentation and tools"
      }
    }
  }
}
```

## その他のMCPクライアント

### Cline (VSCode拡張)

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "npx",
      "args": ["expo-mcp-server", "--stdio"],
      "env": {}
    }
  }
}
```

### 汎用MCPクライアント設定

任意のMCP対応クライアントで使用する場合の標準設定：

```json
{
  "name": "expo-mcp-server",
  "description": "Expo documentation, SDK modules, and development tools",
  "command": "expo-mcp-server",
  "args": ["--stdio"],
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": true
  },
  "transport": "stdio"
}
```

## HTTP統合（開発・テスト用）

stdio以外に、HTTP + Server-Sent Events による統合も可能です。

### 1. HTTPサーバー起動

```bash
expo-mcp-server --port 3000
```

### 2. HTTP エンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `GET /health` | ヘルスチェック |
| `POST /mcp` | MCP JSON-RPC メッセージ |
| `GET /mcp/stream` | Server-Sent Events |
| `GET /mcp/tools` | 利用可能ツール一覧 |
| `GET /mcp/resources` | 利用可能リソース一覧 |

### 3. HTTP クライアント例

```javascript
// MCP ツール呼び出し例
const response = await fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'expo_search_documents',
      arguments: {
        query: 'camera permissions'
      }
    }
  })
});

const result = await response.json();
console.log(result.result);
```

## 利用可能な機能

### ツール (Tools)

| ツール名 | 説明 | 主な用途 |
|----------|------|----------|
| `expo_read_document` | ドキュメント取得 | 特定ページの詳細取得 |
| `expo_search_documents` | ドキュメント検索 | キーワード・フィルタ検索 |
| `expo_recommend` | コンテンツ推薦 | 関連情報の自動提案 |
| `expo_get_sdk_module` | SDK モジュール詳細 | APIリファレンス取得 |
| `expo_config_templates` | 設定ファイル生成 | app.json, eas.json等 |
| `expo_eas_command_builder` | EAS CLI コマンド生成 | ビルド・デプロイコマンド |
| `expo_code_examples` | コード例取得 | 実行可能なサンプル |
| `expo_error_diagnosis` | エラー診断 | 問題解決の提案 |

### リソース (Resources)

| リソース URI | 説明 |
|-------------|------|
| `expo://docs/{path}` | ドキュメントページ |
| `expo://api/{module}` | API リファレンス |
| `expo://examples/{category}` | コード例集 |
| `expo://config/{type}` | 設定テンプレート |
| `expo://eas/{command}` | EAS CLI リファレンス |

### プロンプト (Prompts)

| プロンプト名 | 説明 |
|-------------|------|
| `expo_setup_helper` | セットアップ支援 |
| `expo_error_helper` | エラー解決支援 |
| `expo_api_helper` | API 使用方法案内 |
| `expo_config_analyzer` | 設定ファイル分析 |

## トラブルシューティング

### 接続エラー

```bash
# 1. サーバーが起動しているか確認
ps aux | grep expo-mcp-server

# 2. stdio モードでの直接テスト
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | expo-mcp-server --stdio

# 3. 設定ファイルの構文確認
python -m json.tool mcp_servers.json
```

### 権限エラー

```bash
# MCP サーバーの実行権限確認
which expo-mcp-server
expo-mcp-server --version

# パス設定確認
echo $PATH | grep expo-mcp-server
```

### パフォーマンス問題

```bash
# デバッグモードで詳細ログ確認
DEBUG=expo-mcp:* expo-mcp-server --stdio

# リソース使用量監視
top -p $(pgrep expo-mcp-server)
```

## ベストプラクティス

### 1. セキュリティ

- 本番環境では必要最小限の権限で実行
- ネットワークアクセスの制限
- ログの適切な管理

### 2. パフォーマンス

- キャッシュの適切な設定
- 同時実行数の制限
- リソース使用量の監視

### 3. エラーハンドリング

- タイムアウト設定
- リトライ機能の活用
- 適切なエラーログ出力

## 高度な設定

### 環境別設定

```bash
# 開発環境
NODE_ENV=development expo-mcp-server --stdio

# ステージング環境  
NODE_ENV=staging expo-mcp-server --stdio

# 本番環境
NODE_ENV=production expo-mcp-server --stdio
```

### カスタムキャッシュ設定

```bash
# キャッシュ無効化
CACHE_TTL_SECONDS=0 expo-mcp-server --stdio

# 長期キャッシュ
CACHE_TTL_SECONDS=86400 expo-mcp-server --stdio
```

### ログレベル調整

```bash
# エラーのみ
LOG_LEVEL=error expo-mcp-server --stdio

# 詳細ログ
LOG_LEVEL=debug expo-mcp-server --stdio
```

## 次のステップ

- [Cursor IDE 設定ガイド](cursor-ide-setup.md) - Cursor固有の設定
- [API リファレンス](api-reference.md) - 詳細なAPI仕様
- [Docker デプロイメントガイド](docker-deployment.md) - 本番環境設定

## サポート

- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **MCP 仕様**: [https://spec.modelcontextprotocol.io/](https://spec.modelcontextprotocol.io/)
- **Claude MCP ガイド**: [https://claude.ai/mcp](https://claude.ai/mcp)

---

*最終更新: 2024年12月* 