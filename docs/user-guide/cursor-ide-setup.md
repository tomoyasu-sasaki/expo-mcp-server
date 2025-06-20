# Cursor IDE での Expo MCP Server セットアップガイド

## 概要
このガイドでは、Cursor IDE で Expo MCP Server を設定し、効率的な Expo 開発環境を構築する方法を説明します。

## 前提条件

### システム要件
- **Cursor IDE**: 最新版（MCP サポート版）
- **Docker**: Docker Desktop 20.10+ 推奨
- **Node.js**: 18.0+ (npmアプローチの場合)

### Docker確認
```bash
# Dockerの動作確認
docker --version
docker run hello-world
```

## 設定方法

### 方法1: Docker設定 (推奨)

Docker設定は最も確実で安定した方法です。Terraform MCP Serverと同じアプローチを使用します。

#### 1. Dockerイメージの準備
```bash
# イメージをビルド（プロジェクトディレクトリで）
cd /path/to/expo-mcp-server
npm run docker:build

# または公式イメージを使用
docker pull expo/expo-mcp-server:latest
```

#### 2. Cursor設定ファイル作成/編集

**設定ファイルパス**: `~/.cursor/mcp.json`

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
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 3. 接続テスト
```bash
# Docker経由でMCPサーバー起動テスト
timeout 5s docker run -i --rm expo-mcp-server:latest --stdio || echo "Test completed"
```

### 方法2: npm/npx設定 (代替)

npmアプローチは軽量ですが、環境依存の問題が発生する可能性があります。

#### 1. パッケージインストール
```bash
# グローバルインストール
npm install -g expo-mcp-server

# または npx で直接実行（インストール不要）
```

#### 2. Cursor設定
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

## 設定確認

### 1. Cursor再起動
設定変更後、Cursor IDEを再起動してください。

### 2. MCP接続確認
1. Cursor IDEで新しいプロジェクトを開く
2. コマンドパレット（Cmd/Ctrl + Shift + P）を開く
3. "Expo" に関連するコマンドが表示されることを確認

### 3. 基本動作テスト
```typescript
// Cursorで以下のようなプロンプトを試す:
// "Show me how to set up Expo Camera in a new project"
// "Find Expo documentation about navigation"
// "Generate an example of using Expo Location API"
```

## トラブルシューティング

### Docker関連の問題

#### 問題: "docker: command not found"
**解決策**: 
```bash
# Docker Desktopのインストール確認
open /Applications/Docker.app
# または
brew install --cask docker
```

#### 問題: "Cannot connect to the Docker daemon"
**解決策**:
```bash
# Docker Desktopが起動していることを確認
docker ps
# Docker再起動
killall Docker && open /Applications/Docker.app
```

#### 問題: "image not found"
**解決策**:
```bash
# イメージ再ビルド
cd /path/to/expo-mcp-server
npm run docker:build

# イメージ確認
docker images | grep expo
```

### npm関連の問題

#### 問題: "expo-mcp-server: command not found"
**解決策**:
```bash
# パッケージの再インストール
npm uninstall -g expo-mcp-server
npm install -g expo-mcp-server

# または npx を使用
# 設定で "npx" "expo-mcp-server" に変更
```

#### 問題: "Module not found" エラー
**解決策**:
```bash
# Node.jsバージョン確認（18+必要）
node --version

# キャッシュクリア
npm cache clean --force
```

### Cursor関連の問題

#### 問題: MCPサーバーが認識されない
**解決策**:
1. 設定ファイルパスを確認: `~/.cursor/mcp.json`
2. JSON形式の正当性確認
3. Cursor完全再起動
4. ログ確認: Cursor > Developer > Toggle Developer Tools

#### 問題: "MCP tools not available"
**解決策**:
```json
// disabled フラグの確認・削除
{
  "mcpServers": {
    "expo-mcp-server": {
      // "disabled": true, <- この行を削除
      "command": "docker",
      // ...
    }
  }
}
```

## 高度な設定

### パフォーマンス最適化
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
        "-e", "NODE_ENV=production",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=warn",
        "-e", "CACHE_TTL_SECONDS=7200",
        "expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

### デバッグ設定
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "NODE_ENV=development",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=debug",
        "expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

### ローカルデータ永続化
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "$HOME/.expo-mcp-data:/app/data",
        "-e", "NODE_ENV=production",
        "-e", "MCP_MODE=stdio",
        "-e", "LOCAL_STORAGE_PATH=/app/data",
        "expo-mcp-server:latest",
        "--stdio"
      ]
    }
  }
}
```

## 使用例

### Expo プロジェクト作成支援
```typescript
// Cursorで質問:
// "Create a new Expo project with TypeScript and navigation"
// "Show me the latest Expo SDK features"
```

### API リファレンス検索
```typescript
// Cursorで質問:
// "How to use Expo Camera with custom controls?"
// "Find Expo Location API documentation"
```

### トラブルシューティング
```typescript
// Cursorで質問:
// "Fix this Expo build error: [エラーメッセージを貼り付け]"
// "Why is my Expo app crashing on iOS?"
```

## まとめ

- **推奨**: Docker設定（安定性・一貫性）
- **代替**: npm設定（軽量・高速）
- **重要**: 設定後のCursor再起動
- **確認**: MCPツールの動作テスト

追加サポートが必要な場合は、[GitHub Issues](https://github.com/expo/expo-mcp-server/issues)でお知らせください。 