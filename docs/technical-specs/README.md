# 技術仕様

Expo MCP Serverの技術的な仕様と設計ドキュメントです。

## 📚 目次

### 🏗️ アーキテクチャ仕様

1. **[MCP機能マニフェスト](./mcp-capability-manifest.md)**
   - Model Context Protocol (MCP) の実装仕様
   - サポートする機能一覧
   - プロトコルバージョン情報
   - 拡張機能の定義

### 🔌 API仕様

2. **[OpenAPI仕様](./openapi-specification.md)**
   - REST APIの完全な仕様定義
   - エンドポイント一覧
   - リクエスト/レスポンススキーマ
   - 認証・認可仕様
   - エラーコード定義

### 📋 データ構造

3. **[JSONスキーマ定義](./json-schema-definitions.md)**
   - すべてのデータ構造の定義
   - MCPツールのパラメータスキーマ
   - レスポンスオブジェクトの構造
   - バリデーションルール

### ⚙️ 設定仕様

4. **[Expo設定](./expo.yaml)**
   - Expo関連の設定定義
   - サポートするExpo SDK情報
   - ドキュメントクローリング設定
   - キャッシュ戦略設定

## 🔍 技術詳細

### プロトコル仕様
- **MCPバージョン**: 2024-11-05
- **トランスポート**: stdio, HTTP+SSE
- **エンコーディング**: UTF-8
- **メッセージ形式**: JSON-RPC 2.0

### API仕様
- **APIバージョン**: v1
- **認証方式**: Bearer Token / API Key
- **レート制限**: 1000 req/hour
- **タイムアウト**: 30秒

### データ形式
- **日付形式**: ISO 8601
- **文字エンコーディング**: UTF-8
- **最大ペイロードサイズ**: 10MB
- **圧縮**: gzip対応

## 📐 設計原則

1. **RESTful設計**
   - リソース指向のURL設計
   - HTTPメソッドの適切な使用
   - ステートレスな通信

2. **スキーマファースト**
   - OpenAPIによるAPI定義
   - JSONスキーマによる厳密な型定義
   - 自動バリデーション

3. **拡張性**
   - プラグイン可能なアーキテクチャ
   - バージョニング戦略
   - 後方互換性の維持

## 🧩 統合ガイド

### MCPクライアント統合
```typescript
// MCPクライアントの初期化例
const client = new MCPClient({
  transport: 'stdio',
  command: 'node',
  args: ['dist/index.js'],
  env: { NODE_ENV: 'production' }
});
```

### REST API統合
```bash
# APIリクエスト例
curl -X GET "https://api.expo-mcp.example.com/v1/tools" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: application/json"
```

## 📊 パフォーマンス特性

- **起動時間**: < 10秒
- **レスポンスタイム**: P95 < 200ms
- **同時接続数**: 最大1000
- **メモリ使用量**: < 1GB
- **CPU使用率**: < 30%（アイドル時）

## 📌 関連リンク

- [メインドキュメント](../README.md)
- [ユーザーガイド](../user-guide/)
- [運用ガイド](../operations/)
- [実装レポート](../implementation-reports/)

---

最終更新日: 2024年12月 