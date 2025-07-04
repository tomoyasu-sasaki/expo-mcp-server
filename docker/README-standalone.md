# Expo MCP Server - 単一コンテナ構成

## 概要

通常のマルチコンテナ構成とは異なり、すべてのサービス（Node.js、Redis、Typesense）を1つのコンテナで実行するシンプルな構成です。

## 使用方法

### 1. 単一コンテナでの起動

```bash
# 単一コンテナ版でビルド＆起動
docker-compose -f docker-compose.standalone.yml up --build

# バックグラウンド実行
docker-compose -f docker-compose.standalone.yml up -d --build
```

### 2. アクセス

- **MCP HTTP API**: http://localhost:3000
- **Redis** (必要時): localhost:6379  
- **Typesense** (必要時): http://localhost:8108

### 3. 停止

```bash
docker-compose -f docker-compose.standalone.yml down
```

## メリット

✅ **シンプル**: 1つのコンテナで完結  
✅ **高速起動**: 依存関係の複雑さがない  
✅ **リソース効率**: オーバーヘッドが少ない  
✅ **開発効率**: デバッグが簡単  
✅ **設定が簡単**: 複雑なネットワーク設定不要  

## デメリット

❌ **スケーラビリティ**: 個別サービスのスケーリングができない  
❌ **障害の影響範囲**: 1つのサービス障害で全体が停止  
❌ **メンテナンス**: 個別アップデートが困難  
❌ **リソース制御**: 細かいリソース制御ができない  

## 構成概要

```
expo-mcp-standalone コンテナ
├── supervisord (プロセス管理)
├── Redis (ポート6379)
├── Typesense (ポート8108)  
└── Node.js MCP Server (ポート3000)
```

## 推奨用途

- **開発環境**: 手軽に開発を始めたい場合
- **テスト環境**: CI/CDでの簡単なテスト実行
- **プロトタイピング**: 概念実証やデモ
- **小規模運用**: リソースが限られた環境

## 本格運用の場合

スケーラビリティや可用性が重要な本格運用では、標準のマルチコンテナ構成（`docker-compose.yml`）を推奨します。

```bash
# 本格運用版
docker-compose up -d
``` 