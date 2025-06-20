# MCP クライアント統合ガイド

## 概要

Expo MCP ServerはModel Context Protocol (MCP) 仕様に準拠しており、Cursor、Claude Desktop、その他のMCP対応クライアントと統合できます。このガイドでは、主要なMCPクライアントでの設定方法を説明します。

## MCP プロトコルについて

Model Context Protocol (MCP) は、AIアシスタントが外部のツールやデータソースにアクセスするための標準プロトコルです。

### 主な特徴

- **JSON-RPC 2.0**: 標準的なメッセージング形式
- **stdio/HTTP トランスポート**: 複数の通信方式をサポート
- **ツール・リソース・プロンプト**: 3つの主要機能カテゴリ
- **セキュリティ**: サンドボックス実行と権限制御

## Cursor IDE との統合（推奨）

### 1. 最新設定形式（2024年末以降）

**重要**: Cursor IDEのMCP設定形式が変更されました。最新の形式をご使用ください。

#### Docker ベース設定（推奨）

**設定ファイルの場所**: `~/.cursor/mcp.json` または `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### 設定手順

1. **Dockerイメージの取得**:
   ```bash
   docker pull expo/expo-mcp-server:latest
   ```

2. **設定ファイル作成**:
   ```bash
   mkdir -p ~/.cursor
   # 上記のJSON設定を ~/.cursor/mcp.json に保存
   ```

3. **Cursor IDE 再起動**: 完全に再起動してください

4. **動作確認**: Settings → MCP で接続状況を確認

#### 代替設定方法

**NPX ベース（npm パッケージ公開時）**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "npx",
      "args": ["-y", "expo-mcp-server", "--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**ローカルビルド使用時**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "node",
      "args": [
        "/absolute/path/to/expo-mcp-server/dist/index.js",
        "--stdio"
      ],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

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
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
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
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
'@ | Out-File -FilePath "$env:APPDATA\Claude\claude_desktop_config.json" -Encoding UTF8
```

### 3. Claude Desktop 再起動

設定後、Claude Desktop を再起動します。正常に接続されると、チャット画面でExpo関連の質問に詳細な回答が得られます。

### 4. 動作確認

Claude Desktop で以下の質問を試してください：

```
Expoでカメラ機能を実装する方法を教えて
```

正常に統合されていれば、MCPサーバーから最新のドキュメントとコード例が提供されます。

## その他のMCPクライアント

### VS Code （MCP 拡張機能使用時）

```json
{
  "mcp.servers": [
    {
      "name": "expo-mcp-server",
      "transport": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
      "description": "Expo documentation and tools"
    }
  ]
}
```

### 汎用MCPクライアント設定

任意のMCP対応クライアントで使用する場合の標準設定：

```json
{
  "name": "expo-mcp-server",
  "description": "Expo documentation, SDK modules, and development tools",
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "expo/expo-mcp-server:latest",
    "--stdio"
  ],
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
# Dockerでの起動
docker run -p 3000:3000 expo/expo-mcp-server:latest --port 3000

# または、ローカルビルドでの起動
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

### 3. HTTP クライアント設定例

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "url": "http://localhost:3000/mcp",
      "transport": "sse"
    }
  }
}
```

## トラブルシューティング

### 共通問題の解決

#### 1. 接続エラー

```bash
# 1. Dockerの状態確認
docker --version
docker ps

# 2. イメージの存在確認
docker images | grep expo-mcp-server

# 3. 手動テスト
docker run -i --rm expo/expo-mcp-server:latest --stdio
```

#### 2. 設定ファイルの検証

```bash
# JSON構文チェック
cat ~/.cursor/mcp.json | python -m json.tool

# ファイル権限確認
ls -la ~/.cursor/mcp.json
```

#### 3. ログの確認

**Cursor IDE**: View → Output → Cursor MCP
**Claude Desktop**: アプリケーションログを確認

### Docker関連の問題

#### イメージが見つからない

```bash
# 解決策1: 公式イメージをプル
docker pull expo/expo-mcp-server:latest

# 解決策2: ローカルビルド
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server
docker build -t expo/expo-mcp-server:latest .
```

#### 権限エラー

```bash
# Linux/macOS での解決
sudo usermod -aG docker $USER
# ログアウト・ログインが必要

# または、sudoを使用（一時的）
sudo docker run -i --rm expo/expo-mcp-server:latest --stdio
```

### パフォーマンスの最適化

#### メモリ使用量の制限

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--memory=512m",
        "--cpus=1.0",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

#### キャッシュの設定

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
      "env": {
        "CACHE_TTL_SECONDS": "7200",
        "CACHE_SIZE_MB": "256"
      }
    }
  }
}
```

## ベストプラクティス

### 1. セキュリティ

- Dockerコンテナは非rootユーザーで実行
- 必要最小限の権限で実行
- 本番環境情報をプロンプトに含めない

### 2. パフォーマンス

- キャッシュの適切な設定
- 同時実行数の制限
- リソース使用量の監視

### 3. エラーハンドリング

- タイムアウト設定の調整
- リトライ機能の活用
- 適切なログレベル設定

## 高度な設定

### 複数クライアント対応

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--name=expo-mcp-shared",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ]
    },
    "expo-mcp-dev": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:dev",
        "--stdio",
        "--debug"
      ]
    }
  }
}
```

### 環境別設定

**開発環境**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "expo/expo-mcp-server:dev",
        "--stdio",
        "--log-level",
        "debug"
      ],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "expo-mcp:*"
      }
    }
  }
}
```

**本番環境**:
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--read-only",
        "--memory=256m",
        "expo/expo-mcp-server:latest",
        "--stdio"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "warn"
      }
    }
  }
}
```

## 設定確認チェックリスト

### Cursor IDE
- [ ] Docker または Node.js がインストール済み
- [ ] 設定ファイルが `~/.cursor/mcp.json` に配置
- [ ] JSON形式が正しい
- [ ] Cursor IDE を完全再起動
- [ ] Settings → MCP で接続確認
- [ ] AIチャットで `@expo` 機能テスト

### Claude Desktop
- [ ] Docker がインストール済み
- [ ] 設定ファイルが正しい場所に配置
- [ ] JSON形式が正しい
- [ ] Claude Desktop を再起動
- [ ] チャットでExpo関連質問をテスト

## 次のステップ

- [Cursor IDE 設定ガイド](cursor-ide-setup.md) - Cursor固有の詳細設定
- [API リファレンス](api-reference.md) - 詳細なAPI仕様
- [FAQ](faq.md) - よくある質問と回答

## サポート

- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **Discord**: [Expo Community Discord](https://discord.gg/expo)
- **MCP 公式ドキュメント**: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)

---

*最終更新: 2024年12月* 