# Expo MCP Server 🚀

[![npm version](https://badge.fury.io/js/expo-mcp-server.svg)](https://badge.fury.io/js/expo-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Expo開発を劇的に効率化するためのModel Context Protocol (MCP) サーバーです。Cursor、Claude、その他のAIアシスタントでExpo/React Nativeアプリの開発を簡単に行えます。

## ✨ 主要機能

### 🎯 Expo開発の包括的サポート
- **プロジェクト初期化**: テンプレート選択から設定まで瞬時にセットアップ
- **EAS統合**: Build、Submit、Update操作をワンコマンドで実行
- **クロスプラットフォーム**: iOS、Android、Web対応の統一開発体験
- **開発サーバー管理**: ホットリロード、トンネリング、デバッグモード制御

### 🔧 10種類の専門ツール
1. **Project Initializer**: Expoプロジェクトの瞬時セットアップ
2. **Config Generator**: app.json/app.config.js最適化設定生成
3. **Development Manager**: 開発サーバーとデバッグ環境管理
4. **Build Manager**: EASビルドとローカルビルド統合管理
5. **EAS Manager**: Expo Application Services完全統合
6. **Deployment Helper**: OTA更新、Webデプロイ、ストア申請
7. **Authentication Setup**: 認証プロバイダー統合とセキュア実装
8. **Storage Manager**: AsyncStorage、SecureStore、SQLite統合
9. **Navigation Helper**: Expo Router/React Navigation完全サポート
10. **Best Practices**: コード品質分析とパフォーマンス最適化

## 🚀 Cursorでのクイックインストール

### ワンクリックインストール
次のリンクをクリックするだけでCursorにMCPサーバーをインストールできます：

**[📱 Cursor に Expo MCP Server をインストール](cursor://anysphere.cursor-deeplink/mcp/install?name=expo&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImV4cG8tbWNwLXNlcnZlciJdLCJlbnYiOnsiTk9ERV9FTlYiOiJwcm9kdWN0aW9uIn19)**

### 手動インストール手順
1. Cursorで `Cmd+Shift+P` を押下
2. "Preferences: Open User Settings (JSON)" を選択
3. `mcpServers` セクションに以下を追加：

```json
{
  "mcpServers": {
    "expo": {
      "command": "node",
      "args": [
        "{{path}}/expo-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      },
      "disabled": false,
      "autoApprove": []
    },
  }
}
```

4. Cursorを再起動

## 🛠️ 基本的な使い方

インストール後、Cursorで以下のコマンドを使用してExpoプロジェクトの開発を開始できます：

### 新規プロジェクト作成
```
@expo 新しいTypeScriptプロジェクトをExpo Routerで作成して
```

### EASビルド設定
```
@expo EASでiOSとAndroidの本番ビルド設定を生成して
```

### 認証システム構築
```
@expo GoogleとAppleサインインの認証システムを実装して
```

### ナビゲーション設定
```
@expo タブナビゲーションとモーダル画面の構成を作成して
```

### OTA更新デプロイ
```
@expo 本番環境にOTA更新をデプロイして
```

## 📋 利用可能なツール詳細

### 1. プロジェクト初期化 (`expo_project_init`)
```typescript
// 使用例
{
  template: 'blank-typescript',
  projectName: 'MyAwesomeApp',
  packageManager: 'yarn',
  features: ['expo-router', 'expo-notifications', 'expo-auth-session'],
  platforms: ['ios', 'android', 'web']
}
```

### 2. 設定生成 (`expo_config_generate`)
```typescript
// 使用例
{
  platform: ['ios', 'android', 'web'],
  environment: 'production',
  features: ['push-notifications', 'deep-linking', 'splash-screen'],
  buildProfile: 'production'
}
```

### 3. 開発サーバー管理 (`expo_dev_server`)
```typescript
// 使用例
{
  platform: 'all',
  port: 8081,
  tunnel: true,
  devClient: true,
  host: 'lan'
}
```

### 4. ビルド管理 (`expo_build`)
```typescript
// 使用例
{
  platform: 'all',
  profile: 'production',
  local: false,
  autoSubmit: true
}
```

### 5. EAS操作 (`expo_eas`)
```typescript
// 使用例
{
  operation: 'build',
  platform: 'all',
  profile: 'production',
  message: 'v1.0.0 リリース',
  autoPublish: true
}
```

## 🎨 Expo最新機能の活用例

### Expo Router (App Directory)
```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

### EAS Update
```bash
# 開発環境へのOTA更新
eas update --branch development --message "新機能追加"

# 本番環境への自動更新
eas update --branch production --auto
```

### Expo Dev Client
```typescript
// Development builds with custom native code
{
  "plugins": [
    "expo-dev-client",
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png"
      }
    ]
  ]
}
```

## 🔧 開発者向け情報

### ローカル開発
```bash
git clone <repository-url>
cd expo-mcp-server
npm install
npm run build
npm run dev
```

### テスト実行
```bash
npm test
npm run test:coverage
```

### MCP Debug Mode
```bash
NODE_ENV=development npm start
```

## 📦 対応するExpo機能

### コア機能
- ✅ Expo SDK 50+ 完全対応
- ✅ Expo Router (App Directory)
- ✅ EAS Build & Submit
- ✅ EAS Update (OTA)
- ✅ Expo Dev Client
- ✅ Metro bundler最適化

### プラットフォーム
- ✅ iOS (React Native)
- ✅ Android (React Native)
- ✅ Web (React DOM)
- ✅ PWA対応

### ライブラリ統合
- ✅ React Navigation
- ✅ Expo Router
- ✅ Expo Authentication
- ✅ Expo Secure Store
- ✅ Expo SQLite
- ✅ Expo Notifications
- ✅ Expo Location
- ✅ Expo Camera
- ✅ Expo AV

## 🌟 Expo開発ベストプラクティス

### パフォーマンス最適化
1. **バンドルサイズ削減**: 不要なモジュールの除去
2. **画像最適化**: WebP形式とレスポンシブ画像
3. **レンダリング最適化**: FlatList、memo、useMemo活用
4. **OTA更新戦略**: 段階的ロールアウト

### セキュリティ強化
1. **SecureStore使用**: 機密データの暗号化保存
2. **証明書ピニング**: ネットワーク通信のセキュリティ
3. **コード難読化**: リリースビルドの保護
4. **権限管理**: 最小権限の原則

### 開発効率向上
1. **TypeScript活用**: 型安全性とIDE支援
2. **ESLint/Prettier**: コード品質とフォーマット統一
3. **Storybook**: コンポーネント開発
4. **E2Eテスト**: Detox/Maestroでの自動テスト

## 🤝 貢献

プルリクエストを歓迎します！以下の手順で貢献してください：

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. コミット (`git commit -m 'Add amazing feature'`)
4. プッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🆘 サポート

問題が発生した場合：

1. [Issues](https://github.com/your-username/expo-mcp-server/issues) で既存の問題を確認
2. 新しいissueを作成
3. 詳細な再現手順を含めて報告

## 🔗 関連リンク

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Documentation](https://docs.expo.dev/eas/)
- [Expo Router Documentation](https://expo.github.io/router/)
- [Model Context Protocol](https://spec.modelcontextprotocol.io/)
- [Cursor Documentation](https://docs.cursor.com/)
- [React Native Documentation](https://reactnative.dev/)

---

**Expo MCP Server** で次世代のモバイル/Web開発体験を始めましょう！ 🚀✨ 