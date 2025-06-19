# Cursor IDE 設定ガイド

## 概要

Cursor IDEは、AI統合機能を持つ次世代コードエディタです。Expo MCP Serverと連携することで、Expoエコシステムの豊富な情報を開発フローに統合できます。

## 前提条件

- **Cursor IDE**: 最新版（[https://cursor.sh/](https://cursor.sh/) からダウンロード）
- **expo-mcp-server**: [インストール済み](installation-guide.md)
- **Node.js**: 18.0.0以上

## Cursor IDE MCP 設定

### 1. Cursor IDE インストール確認

```bash
# Cursor IDE バージョン確認
cursor --version

# Cursor設定ディレクトリ確認
# macOS
ls ~/Library/Application\ Support/Cursor/

# Linux
ls ~/.config/Cursor/

# Windows
dir %APPDATA%\Cursor\
```

### 2. MCP 設定ファイル作成

Cursor IDE の設定ディレクトリに MCP サーバー設定を追加します：

**macOS:**
```bash
# 設定ファイル作成
mkdir -p ~/Library/Application\ Support/Cursor/mcp
cat > ~/Library/Application\ Support/Cursor/mcp/servers.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server", 
      "args": ["--stdio"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      },
      "description": "Expo ecosystem documentation and tools",
      "capabilities": ["tools", "resources", "prompts"]
    }
  }
}
EOF
```

**Linux:**
```bash
# 設定ファイル作成
mkdir -p ~/.config/Cursor/mcp
cat > ~/.config/Cursor/mcp/servers.json << 'EOF'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server",
      "args": ["--stdio"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      },
      "description": "Expo ecosystem documentation and tools", 
      "capabilities": ["tools", "resources", "prompts"]
    }
  }
}
EOF
```

**Windows:**
```powershell
# 設定ディレクトリ作成
New-Item -Path "$env:APPDATA\Cursor\mcp" -ItemType Directory -Force

# 設定ファイル作成
@'
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server.exe",
      "args": ["--stdio"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      },
      "description": "Expo ecosystem documentation and tools",
      "capabilities": ["tools", "resources", "prompts"]
    }
  }
}
'@ | Out-File -FilePath "$env:APPDATA\Cursor\mcp\servers.json" -Encoding UTF8
```

### 3. Cursor 設定ファイル更新

Cursor IDE のメイン設定ファイル（`settings.json`）にMCP設定を追加：

```json
{
  "cursor.mcp.enabled": true,
  "cursor.mcp.servers": "~/Library/Application Support/Cursor/mcp/servers.json",
  "cursor.ai.enableMCP": true,
  "cursor.ai.mcpTimeout": 30000,
  "cursor.ai.mcpRetries": 3
}
```

### 4. Cursor IDE 再起動

設定後、Cursor IDE を完全に再起動します。

## 動作確認

### 1. MCP接続状態確認

1. Cursor IDEを開く
2. `Cmd/Ctrl + Shift + P` でコマンドパレットを開く
3. "MCP: Show Connected Servers" を実行
4. "expo-mcp-server" が "Connected" と表示されることを確認

### 2. AI チャット機能でのテスト

Cursor IDE のAIチャット機能（`Cmd/Ctrl + L`）で以下を試してください：

```
@expo Expoでプッシュ通知を実装する方法
```

正常に動作すれば、最新のExpoドキュメントから詳細な実装方法が提供されます。

## 使用方法

### 1. AI コードレビュー

```typescript
// 既存のコード例
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Text>Hello Expo!</Text>
      <StatusBar style="auto" />
    </View>
  );
}
```

AIチャットで：
```
@expo このコードにナビゲーション機能を追加したい
```

### 2. エラー診断支援

```typescript
// エラーが発生するコード
import * as Camera from 'expo-camera';

const takePicture = async () => {
  const photo = await camera.takePictureAsync();
};
```

AIチャットで：
```
@expo このコードでエラーが発生します。修正方法を教えて
```

### 3. SDK マイグレーション支援

```typescript
// 古い SDK のコード
import { Permissions } from 'expo';

const getPermission = async () => {
  const { status } = await Permissions.askAsync(Permissions.CAMERA);
};
```

AIチャットで：
```
@expo このコードを最新のSDKに対応させて
```

### 4. 設定ファイル生成

プロジェクトフォルダで：
```
@expo 新しいExpoプロジェクトのapp.jsonを生成して
```

## 高度な設定

### 1. ワークスペース別設定

プロジェクトの `.vscode/settings.json` に個別設定：

```json
{
  "cursor.mcp.servers": {
    "expo-dev": {
      "command": "expo-mcp-server",
      "args": ["--stdio", "--debug"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### 2. キーボードショートカット設定

```json
{
  "key": "cmd+shift+e",
  "command": "cursor.ai.chat",
  "args": ["@expo "]
}
```

### 3. カスタムプロンプト設定

Cursor IDE でカスタムプロンプトを設定：

```json
{
  "cursor.ai.customPrompts": {
    "expo-setup": {
      "prompt": "@expo 新しいExpoプロジェクトの推奨セットアップを教えて",
      "shortcut": "cmd+shift+s"
    },
    "expo-debug": {
      "prompt": "@expo このエラーの解決方法は？",
      "shortcut": "cmd+shift+d"
    }
  }
}
```

## ワークフロー例

### 1. 新規機能実装フロー

```mermaid
graph LR
  A[要件確認] --> B[@expo 実装方法確認]
  B --> C[コード生成]
  C --> D[@expo コードレビュー]
  D --> E[テスト実装]
  E --> F[@expo テスト方法確認]
```

### 2. エラー解決フロー

```mermaid
graph LR
  A[エラー発生] --> B[@expo エラー診断]
  B --> C[解決策提案]
  C --> D[コード修正]
  D --> E[@expo 修正内容確認]
```

### 3. SDK アップデートフロー

```mermaid
graph LR
  A[SDK更新通知] --> B[@expo 変更点確認]
  B --> C[マイグレーション計画]
  C --> D[@expo 移行支援]
  D --> E[コード更新]
```

## コマンド一覧

### MCP関連コマンド

| コマンド | 説明 |
|---------|------|
| `MCP: Show Connected Servers` | 接続済みサーバー一覧 |
| `MCP: Restart Server` | サーバー再起動 |
| `MCP: Show Server Logs` | サーバーログ表示 |
| `MCP: Test Connection` | 接続テスト |

### Expo固有コマンド

| チャット例 | 説明 |
|-----------|------|
| `@expo search {query}` | ドキュメント検索 |
| `@expo module {name}` | SDK モジュール情報 |
| `@expo config {type}` | 設定ファイル生成 |
| `@expo examples {category}` | コード例取得 |
| `@expo errors {message}` | エラー診断 |

## トラブルシューティング

### 接続問題

```bash
# 1. サーバー状態確認
ps aux | grep expo-mcp-server

# 2. 手動起動テスト
expo-mcp-server --stdio

# 3. Cursor ログ確認
tail -f ~/Library/Logs/Cursor/main.log
```

### パフォーマンス問題

```json
{
  "cursor.ai.mcpTimeout": 60000,
  "cursor.ai.mcpRetries": 5,
  "cursor.ai.mcpCacheEnabled": true
}
```

### デバッグモード

```bash
# デバッグ情報有効化
DEBUG=cursor:mcp,expo-mcp:* cursor

# ログレベル調整
LOG_LEVEL=debug expo-mcp-server --stdio
```

## 効果的な使用パターン

### 1. プロジェクト初期化

```
@expo React Nativeで音楽再生アプリを作る時の推奨プロジェクト構成
```

### 2. 機能実装

```
@expo expo-avを使って音楽ファイルを再生する実装例
```

### 3. 設定最適化

```
@expo 音楽アプリ向けのapp.json最適化設定
```

### 4. デバッグ支援

```
@expo AudioプレイヤーでiOSでのみクラッシュする原因
```

### 5. パフォーマンス最適化

```
@expo 大量の音楽ファイルを効率的に処理する方法
```

## ベストプラクティス

### 1. 効果的なプロンプト

- **具体的**: "カメラ機能" より "expo-cameraで写真撮影"
- **コンテキスト含む**: 現在のコードやエラーメッセージを含める
- **目的明確**: 何を実現したいかを明確に

### 2. ワークスペース管理

- プロジェクト別にMCP設定をカスタマイズ
- 開発フェーズに応じてログレベル調整
- 不要なサーバーは無効化してパフォーマンス向上

### 3. セキュリティ

- 本番環境情報をプロンプトに含めない
- ローカル実行の原則維持
- ログファイルの定期的なクリーンアップ

## 次のステップ

- [API リファレンス](api-reference.md) - 利用可能な全機能の詳細
- [Docker デプロイメントガイド](docker-deployment.md) - 本番環境設定
- [開発者ドキュメント](developer-guide.md) - カスタマイズ・拡張方法

## サポート

- **Cursor Discord**: [https://discord.gg/cursor](https://discord.gg/cursor)
- **GitHub Issues**: [https://github.com/expo/expo-mcp-server/issues](https://github.com/expo/expo-mcp-server/issues)
- **Cursor ドキュメント**: [https://docs.cursor.sh/](https://docs.cursor.sh/)

---

*最終更新: 2024年12月* 