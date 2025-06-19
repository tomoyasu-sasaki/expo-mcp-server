# Expo MCP Server インストール・セットアップガイド

## 概要

Expo MCP Serverは、Model Context Protocol (MCP) 経由でExpoエコシステムの情報にアクセスできるサーバーです。このガイドでは、システム要件の確認からサーバーの起動まで、ステップバイステップで説明します。

## システム要件

### 必須要件

| 項目 | バージョン | 確認コマンド |
|------|-----------|-------------|
| Node.js | 18.0.0以上 | `node --version` |
| npm | 8.0.0以上 | `npm --version` |

### オプション要件

| 項目 | バージョン | 用途 |
|------|-----------|------|
| Docker | 20.0.0以上 | コンテナ実行 |
| Docker Compose | 2.0.0以上 | 開発環境構築 |

## インストール方法

### 方法1: npm インストール（推奨）

```bash
# グローバルインストール
npm install -g expo-mcp-server

# インストール確認
expo-mcp-server --version
```

### 方法2: ソースからビルド

```bash
# 1. リポジトリクローン
git clone https://github.com/expo/expo-mcp-server.git
cd expo-mcp-server

# 2. 依存関係インストール
npm install

# 3. TypeScript コンパイル・ビルド
npm run build

# 4. 動作確認
npm run start --help
```

### 方法3: Docker イメージ使用

```bash
# 最新イメージ取得
docker pull expo/expo-mcp-server:latest

# 動作確認
docker run expo/expo-mcp-server:latest --help
```

## 設定ファイル準備

### 基本設定作成

```bash
# 設定ディレクトリ作成
mkdir -p ~/.expo-mcp

# デフォルト設定ファイル生成
expo-mcp-server --generate-config > ~/.expo-mcp/config.json
```

### 環境変数設定

```bash
# 環境変数ファイル作成
cat > ~/.expo-mcp/.env << 'EOF'
# MCP Server 設定
NODE_ENV=production
MCP_MODE=stdio
LOG_LEVEL=info

# ローカルストレージ設定  
LOCAL_STORAGE_PATH=~/.expo-mcp/data
MAX_STORAGE_SIZE_GB=5

# キャッシュ設定
CACHE_TTL_SECONDS=3600
RATE_LIMIT_RPM=1000

# 外部サービス（オプション）
# REDIS_URL=redis://localhost:6379
# TYPESENSE_URL=http://localhost:8108
EOF
```

## 起動確認

### stdio モード（MCP クライアント用）

```bash
# MCP プロトコル起動
expo-mcp-server --stdio

# 正常起動の場合、JSON-RPC メッセージ待機状態になります
# Ctrl+C で終了
```

### HTTP モード（開発・テスト用）

```bash
# HTTP サーバー起動
expo-mcp-server --port 3000

# ブラウザで確認
# http://localhost:3000/health
```

### 動作テスト

```bash
# MCP 通信テスト
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | expo-mcp-server --stdio

# 期待される応答:
# {"jsonrpc":"2.0","id":1,"result":"pong"}
```

## トラブルシューティング

### よくある問題

#### 1. Node.js バージョンエラー

```bash
# エラーメッセージ例
error: The engine "node" is incompatible with this module

# 解決方法
nvm install 18
nvm use 18
npm install -g expo-mcp-server
```

#### 2. 権限エラー

```bash
# エラーメッセージ例
Error: EACCES: permission denied

# 解決方法（npm グローバルディレクトリ変更）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### 3. ポート競合エラー

```bash
# エラーメッセージ例
Error: listen EADDRINUSE: address already in use :::3000

# 解決方法
expo-mcp-server --port 3001
# または実行中のプロセス確認
lsof -ti:3000
```

#### 4. メモリ不足エラー

```bash
# エラーメッセージ例
FATAL ERROR: Ineffective mark-compacts near heap limit

# 解決方法（Node.js メモリ上限変更）
export NODE_OPTIONS="--max-old-space-size=4096"
expo-mcp-server --stdio
```

### ログ確認

```bash
# ログファイルの場所
~/.expo-mcp/logs/

# デバッグモード起動
DEBUG=expo-mcp:* expo-mcp-server --stdio

# 詳細ログ出力
LOG_LEVEL=debug expo-mcp-server --stdio
```

## 次のステップ

インストールが完了したら、以下のガイドを参照してください：

- [MCP クライアント統合ガイド](mcp-client-integration.md) - Claude、Cursor等のMCPクライアントとの連携
- [Cursor IDE 設定ガイド](cursor-ide-setup.md) - Cursor IDEでの具体的な設定方法
- [Docker デプロイメントガイド](docker-deployment.md) - 本番環境でのDocker実行
- [API リファレンス](api-reference.md) - 利用可能なツール・リソース・プロンプトの詳細

## サポート

- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **Discord**: [Expo Community Discord](https://discord.gg/expo)
- **ドキュメント**: [https://docs.expo.dev/](https://docs.expo.dev/)

---

*最終更新: 2024年12月* 