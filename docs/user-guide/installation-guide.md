# Expo MCP Server インストール・セットアップガイド

## 概要

Expo MCP Serverは、ExpoエコシステムのドキュメントとツールをModel Context Protocol (MCP) を通じて提供するサーバーです。Cursor IDE、Claude Desktop、その他のMCP対応クライアントで使用できます。

## ❗ 重要なお知らせ

**2024年末以降、各MCPクライアントの設定形式が変更されています。**
必ず最新の設定形式をご使用ください。

## システム要件

### 推奨環境（Docker使用）

- **Docker**: 20.0.0以上
- **Docker Compose**: 2.0.0以上（オプション）
- **OS**: macOS、Linux、Windows（WSL2推奨）
- **メモリ**: 最低4GB、推奨8GB以上

### 代替環境（ローカルインストール）

- **Node.js**: 18.0.0以上（20.0.0以上推奨）
- **npm**: 8.0.0以上
- **OS**: macOS、Linux、Windows
- **メモリ**: 最低2GB、推奨4GB以上

## インストール方法

### 🐳 方法1: Docker使用（推奨）

Dockerを使用した方法が最も簡単で、依存関係の問題を回避できます。

#### Step 1: Dockerのインストール確認

```bash
# Dockerバージョン確認
docker --version
# 期待される出力: Docker version 20.x.x以上

# Docker動作確認
docker run hello-world
```

#### Step 2: Expo MCP Serverイメージの取得

```bash
# 公式イメージをプル（将来的に利用可能）
docker pull expo/expo-mcp-server:latest

# または、ソースからビルド（現在の推奨方法）
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server
docker build -t expo-mcp-server:latest .
```

#### Step 3: 動作確認

```bash
# MCPサーバーのテスト起動
docker run -i --rm -e MCP_MODE=stdio expo-mcp-server:latest

# 正常であれば以下のような出力が表示されます：
# 🚀 Starting Expo MCP Server...
# 📋 Environment: NODE_ENV=production
# 🔌 Starting MCP server in stdio mode...
# ✅ MCP Server ready - Listening on stdio...
```

### 📦 方法2: npm/npx使用

npm パッケージが公開された際の使用方法：

```bash
# グローバルインストール
npm install -g expo-mcp-server

# または、npxで直接実行
npx expo-mcp-server --stdio
```

### 🔧 方法3: ソースからビルド（開発者向け）

```bash
# リポジトリのクローン
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server

# 依存関係のインストール
npm install

# TypeScriptビルド
npm run build

# 動作確認
npm run test

# 実行
node dist/index.js --stdio
```

## MCP クライアント設定

### 🎯 Cursor IDE（推奨）

最新のCursor IDE設定形式（2024年末以降）：

#### Step 1: 設定ファイル作成

**macOS/Linux:**
```bash
mkdir -p ~/.cursor
cat > ~/.cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MCP_MODE=stdio",
        "expo-mcp-server:latest"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF
```

**Windows (PowerShell):**
```powershell
New-Item -Path "$env:USERPROFILE\.cursor" -ItemType Directory -Force
@'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MCP_MODE=stdio",
        "expo-mcp-server:latest"
      ],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
'@ | Out-File -FilePath "$env:USERPROFILE\.cursor\mcp.json" -Encoding UTF8
```

#### Step 2: Cursor IDE再起動

設定ファイル作成後、**Cursor IDEを完全に再起動**してください。

#### Step 3: 動作確認

1. Cursor IDEで **Settings** → **MCP** を確認
2. "expo-mcp-server" が **Connected** と表示されることを確認
3. AIチャット（`Cmd/Ctrl + L`）で以下をテスト：
   ```
   @expo Expoでプッシュ通知を実装する方法を教えて
   ```

### 📱 Claude Desktop

```bash
# macOS
mkdir -p ~/Library/Application\ Support/Claude/
cat > ~/Library/Application\ Support/Claude/claude_desktop_config.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MCP_MODE=stdio",
        "expo-mcp-server:latest"
      ]
    }
  }
}
EOF
```

## 設定の参考

本実装は以下のMCPサーバーの設定方法を参考にしています：

- **[Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server)**: Dockerベースの設定例
- **[MCP公式ドキュメント](https://modelcontextprotocol.io/)**: プロトコル仕様
- **[Cursor MCP ガイド](https://docs.cursor.com/context/model-context-protocol)**: Cursor固有の設定

## トラブルシューティング

### 🔧 一般的な問題

#### 1. Dockerイメージが見つからない

```bash
# 解決策1: ローカルビルド
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server
docker build -t expo-mcp-server:latest .

# 解決策2: イメージ名の確認
docker images | grep expo
```

#### 2. Cursor IDEで接続できない

```bash
# 設定ファイルの確認
cat ~/.cursor/mcp.json | python -m json.tool

# ファイル権限の確認
ls -la ~/.cursor/mcp.json

# Cursor の完全再起動
killall Cursor  # macOS
```

#### 3. Docker権限エラー

```bash
# Linux/macOS
sudo usermod -aG docker $USER
# ログアウト・ログインが必要

# または一時的にsudoを使用
sudo docker run -i --rm -e MCP_MODE=stdio expo-mcp-server:latest
```

### 🐛 デバッグ方法

#### 詳細ログの有効化

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MCP_MODE=stdio",
        "-e",
        "LOG_LEVEL=debug",
        "-e",
        "DEBUG=expo-mcp:*",
        "expo-mcp-server:latest"
      ]
    }
  }
}
```

#### 手動テスト

```bash
# MCPサーバーの直接テスト
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | \
  docker run -i --rm -e MCP_MODE=stdio expo-mcp-server:latest

# 期待される応答: {"jsonrpc":"2.0","id":1,"result":"pong"}
```

## パフォーマンス最適化

### メモリ使用量の制限

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
        "-e",
        "MCP_MODE=stdio",
        "expo-mcp-server:latest"
      ]
    }
  }
}
```

### キャッシュ設定

```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "MCP_MODE=stdio",
        "-e",
        "CACHE_TTL_SECONDS=7200",
        "-e",
        "CACHE_SIZE_MB=256",
        "expo-mcp-server:latest"
      ]
    }
  }
}
```

## 次のステップ

インストールが完了したら、以下のガイドを参照してください：

- **[Cursor IDE 設定ガイド](cursor-ide-setup.md)**: Cursor固有の詳細設定
- **[MCP クライアント統合](mcp-client-integration.md)**: 他のMCPクライアントでの設定
- **[API リファレンス](api-reference.md)**: 利用可能な機能の詳細
- **[FAQ](faq.md)**: よくある質問と解決策

## サポート

ご質問やお困りの点がございましたら、以下のチャンネルからお気軽にお問い合わせください：

- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **Discord**: [Expo Community](https://discord.gg/expo)
- **公式ドキュメント**: [https://docs.expo.dev/](https://docs.expo.dev/)

---

*最終更新: 2024年12月* 