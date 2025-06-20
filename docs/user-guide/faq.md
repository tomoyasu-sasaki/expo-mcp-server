# Expo MCP Server FAQ

## 📖 よくある質問と回答

### 基本的な使用方法

#### Q: Expo MCP Serverとは何ですか？

**A:** Expo MCP Serverは、Model Context Protocol (MCP) を使用してExpoの包括的な開発支援を提供するサーバーです。Cursor、Claude、その他のAI開発ツールと連携して、Expo関連の情報取得、コード生成、エラー診断などの機能を提供します。

**主な機能:**
- 📚 Expo documentation 検索・取得
- 🔍 API reference アクセス  
- 🛠️ SDK module 情報取得
- 💡 設定ファイル生成支援
- 🚀 EAS CLI コマンド構築
- 📝 Snack 連携コード例
- 🩺 エラー診断・解決提案
- 🎯 コンテキスト対応推奨事項

#### Q: インストール方法を教えてください

**A:** 複数のインストール方法があります：

**方法1: npm（推奨）**
```bash
# グローバルインストール
npm install -g expo-mcp-server

# ローカルインストール
npm install expo-mcp-server
```

**方法2: Docker**
```bash
# Docker Hub から取得
docker pull expo/expo-mcp-server

# 実行
docker run -p 3000:3000 expo/expo-mcp-server
```

**方法3: スタンドアローンバイナリ**
```bash
# リリースページからダウンロード
curl -O https://github.com/expo/expo-mcp-server/releases/latest/download/expo-mcp-server-linux-x64

# 実行権限付与
chmod +x expo-mcp-server-linux-x64

# 実行
./expo-mcp-server-linux-x64 --help
```

詳細は [インストールガイド](installation-guide.md) をご参照ください。

#### Q: Cursorで使用するにはどうすればよいですか？

**A:** Cursorでの設定手順：

1. **MCP設定ファイル作成**
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "expo-mcp-server",
      "args": ["--stdio"],
      "env": {}
    }
  }
}
```

2. **Cursor設定**
- Cursor → Settings → Features → Model Context Protocol
- 上記設定ファイルを指定

3. **動作確認**
- 新しいチャットで「@expo」と入力
- Expo関連の質問やタスクを実行

詳細は [Cursor IDE設定ガイド](cursor-ide-setup.md) をご参照ください。

#### Q: 利用可能なMCPツールは何ですか？

**A:** 8つの専門ツールが利用可能です：

| ツール | 機能 | 使用例 |
|--------|------|--------|
| `expo_read_document` | ドキュメント読み込み | API仕様確認 |
| `expo_search_documents` | 横断検索 | 機能の調査 |
| `expo_recommend` | 推奨事項提供 | ベストプラクティス |
| `expo_get_sdk_module` | SDK情報取得 | モジュール詳細 |
| `expo_config_templates` | 設定生成 | app.json作成 |
| `expo_eas_command_builder` | コマンド構築 | EAS操作 |
| `expo_code_examples` | コード例生成 | Snack連携 |
| `expo_error_diagnosis` | エラー診断 | 問題解決 |

詳細は [MCP ツールリファレンス](mcp-tools-reference.md) をご参照ください。

---

### インストール・設定

#### Q: Node.jsのバージョン要件はありますか？

**A:** はい、以下の要件があります：
- **Node.js**: 18.0.0 以上（推奨: 20.x LTS）
- **npm**: 8.0.0 以上

**確認方法:**
```bash
node --version  # v18.0.0 以上
npm --version   # 8.0.0 以上
```

**アップデート方法:**
```bash
# Node.js LTS版インストール
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 又は nvm 使用
nvm install --lts
nvm use --lts
```

#### Q: 設定ファイルの場所はどこですか？

**A:** 設定ファイルの優先順位：

1. **環境変数** (最優先)
2. **`mcp-config.json`** (プロジェクトルート)  
3. **`config/default.json`** (デフォルト設定)

**設定例:**
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "timeout": 30000
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 1000
  },
  "logging": {
    "level": "info",
    "file": "/var/log/expo-mcp-server.log"
  }
}
```

#### Q: 環境変数での設定はどうしますか？

**A:** 主要な環境変数：

```bash
# サーバー設定
export EXPO_MCP_HOST=0.0.0.0
export EXPO_MCP_PORT=3000
export EXPO_MCP_TIMEOUT=30000

# キャッシュ設定
export EXPO_MCP_CACHE_ENABLED=true
export EXPO_MCP_CACHE_TTL=3600

# ログ設定
export EXPO_MCP_LOG_LEVEL=info
export EXPO_MCP_LOG_FILE=/var/log/expo-mcp-server.log

# セキュリティ設定
export EXPO_MCP_RATE_LIMIT=100
export EXPO_MCP_API_KEY_REQUIRED=false
```

完全な設定オプションは [設定リファレンス](configuration-reference.md) をご参照ください。

---

### 使用方法・機能

#### Q: Expo Snackとの連携はどのように機能しますか？

**A:** `expo_code_examples` ツールがSnack連携を提供します：

**使用例:**
```typescript
// ツール呼び出し
{
  "tool": "expo_code_examples",
  "arguments": {
    "type": "component", 
    "description": "タブナビゲーションの例",
    "expo_sdk_version": "50.0.0",
    "include_snack": true
  }
}
```

**応答例:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "```typescript\n// タブナビゲーション実装...\n```"
    },
    {
      "type": "resource",
      "resource": {
        "uri": "snack://snack.expo.dev/@anonymous/tab-navigation-example",
        "name": "Snack で実行",
        "description": "ブラウザで即座に実行・編集可能"
      }
    }
  ]
}
```

#### Q: エラー診断機能はどのような問題を解決できますか？

**A:** `expo_error_diagnosis` ツールは幅広いExpo関連エラーを診断できます：

**対応エラー種別:**
- 🚀 ビルドエラー
- 📱 実行時エラー  
- 🔧 設定エラー
- 📦 依存関係エラー
- 🎯 TypeScriptエラー
- 🔗 ネットワークエラー

**使用例:**
```typescript
{
  "tool": "expo_error_diagnosis", 
  "arguments": {
    "error_message": "Metro bundler failed to build",
    "context": {
      "platform": "ios",
      "expo_version": "50.0.0",
      "node_version": "20.10.0"
    }
  }
}
```

**診断結果:**
- 🎯 原因分析
- 🛠️ 解決手順
- 📚 関連ドキュメント
- 💡 予防策

#### Q: カスタム設定の反映方法は？

**A:** 設定変更は複数の方法で反映できます：

**方法1: 設定ファイル更新**
```bash
# 設定変更
vim mcp-config.json

# サーバー再起動（設定反映）
expo-mcp-server --restart
```

**方法2: 環境変数（即座反映）**
```bash
# 実行時設定
EXPO_MCP_CACHE_TTL=7200 expo-mcp-server --stdio
```

**方法3: API経由（動的変更）**
```bash
# 設定更新API
curl -X POST http://localhost:3000/api/config \
  -H "Content-Type: application/json" \
  -d '{"cache": {"ttl": 7200}}'
```

---

### パフォーマンス・最適化

#### Q: レスポンスが遅い場合の対処法は？

**A:** パフォーマンス改善の手順：

**1. キャッシュ確認**
```bash
# キャッシュ統計確認
curl http://localhost:3000/metrics | grep cache

# キャッシュクリア（必要時）
curl -X POST http://localhost:3000/api/cache/clear
```

**2. 設定最適化**
```json
{
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 2000
  },
  "concurrency": {
    "maxConcurrent": 10,
    "queueSize": 100
  }
}
```

**3. システムリソース確認**
```bash
# メモリ使用量
curl http://localhost:3000/metrics | grep memory

# CPU使用率
curl http://localhost:3000/metrics | grep cpu
```

**4. ネットワーク最適化**
```bash
# 接続タイムアウト調整
export EXPO_MCP_TIMEOUT=60000

# 同時接続数制限
export EXPO_MCP_MAX_CONNECTIONS=50
```

詳細は [パフォーマンスチューニングガイド](performance-tuning-guide.md) をご参照ください。

#### Q: メモリ使用量を削減するには？

**A:** メモリ最適化の方法：

**1. キャッシュサイズ調整**
```json
{
  "cache": {
    "maxSize": 500,        // エントリ数削減
    "memoryLimit": "100MB" // メモリ上限設定
  }
}
```

**2. 同時実行制限**
```json
{
  "concurrency": {
    "maxConcurrent": 5,    // 同時処理数削減
    "memoryThreshold": 0.8 // メモリ閾値設定
  }
}
```

**3. ガベージコレクション最適化**
```bash
# Node.js GC オプション
node --max-old-space-size=512 --gc-interval=100 expo-mcp-server
```

**4. 定期的なメモリクリア**
```bash
# 定期再起動（cron設定例）
0 2 * * * /usr/local/bin/expo-mcp-server --restart
```

#### Q: 大量のリクエストを処理するには？

**A:** スケーリング戦略：

**1. 水平スケーリング**
```yaml
# docker-compose.yml
version: '3.8'
services:
  expo-mcp-server:
    image: expo/expo-mcp-server
    deploy:
      replicas: 3
    ports:
      - "3000-3002:3000"
```

**2. ロードバランサー設定**
```nginx
# nginx設定例
upstream expo_mcp {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://expo_mcp;
    }
}
```

**3. レート制限設定**
```json
{
  "rateLimit": {
    "windowMs": 60000,     // 1分間
    "maxRequests": 100,    // 最大100リクエスト
    "skipSuccessful": true // 成功時はカウントしない
  }
}
```

---

### トラブルシューティング

#### Q: サーバーが起動しません

**A:** 起動問題の診断手順：

**1. 基本確認**
```bash
# Node.jsバージョン確認
node --version  # 18.0.0+ 必要

# ポート使用状況確認
netstat -an | grep 3000
lsof -i :3000
```

**2. 詳細ログ確認**
```bash
# デバッグモードで起動
DEBUG=expo-mcp:* expo-mcp-server --stdio

# ログファイル確認
tail -f /var/log/expo-mcp-server.log
```

**3. 設定ファイル確認**
```bash
# 設定検証
expo-mcp-server --validate-config

# 最小設定で起動テスト
expo-mcp-server --config=minimal
```

**4. 依存関係確認**
```bash
# パッケージ整合性確認
npm ls --depth=0

# 再インストール
rm -rf node_modules package-lock.json
npm install
```

#### Q: "Connection refused" エラーが発生します

**A:** 接続問題の解決方法：

**1. サーバー状態確認**
```bash
# プロセス確認
ps aux | grep expo-mcp-server

# サービス状態確認
systemctl status expo-mcp-server
```

**2. ネットワーク設定確認**
```bash
# リッスンポート確認
netstat -tlnp | grep 3000

# ファイアウォール確認
ufw status
iptables -L
```

**3. 設定確認**
```json
{
  "server": {
    "host": "0.0.0.0",  // 0.0.0.0 で全IP許可
    "port": 3000,
    "timeout": 30000
  }
}
```

**4. 接続テスト**
```bash
# ローカル接続テスト
curl http://localhost:3000/health

# リモート接続テスト
curl http://your-server-ip:3000/health
```

#### Q: MCPツールが応答しません

**A:** MCP通信問題の対処法：

**1. MCP接続確認**
```bash
# stdio モードテスト
echo '{"method":"ping","id":1}' | expo-mcp-server --stdio

# HTTP モードテスト
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","id":1}'
```

**2. Cursor設定確認**
```json
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
```

**3. ログレベル変更**
```bash
# 詳細ログ有効化
export EXPO_MCP_LOG_LEVEL=debug
expo-mcp-server --stdio
```

**4. ツール個別テスト**
```bash
# 特定ツールテスト
expo-mcp-server --test-tool expo_read_document
```

#### Q: エラーコードの意味を知りたい

**A:** 主要エラーコードと対処法：

| コード | 意味 | 対処法 |
|--------|------|--------|
| `ECONNREFUSED` | 接続拒否 | サーバー起動確認 |
| `ETIMEDOUT` | タイムアウト | timeout設定増加 |
| `EADDRINUSE` | ポート使用中 | ポート変更または停止 |
| `MODULE_NOT_FOUND` | モジュール不足 | npm install実行 |
| `PERMISSION_DENIED` | 権限不足 | sudo実行または権限変更 |
| `VALIDATION_ERROR` | 設定エラー | 設定ファイル確認 |
| `RATE_LIMITED` | レート制限 | リクエスト頻度調整 |
| `AUTH_REQUIRED` | 認証必要 | APIキー設定 |

**詳細診断:**
```bash
# エラー詳細表示
expo-mcp-server --verbose --debug
```

---

### セキュリティ

#### Q: セキュリティ設定のベストプラクティスは？

**A:** セキュリティ強化の推奨設定：

**1. アクセス制御**
```json
{
  "security": {
    "rateLimit": {
      "enabled": true,
      "windowMs": 60000,
      "maxRequests": 100
    },
    "cors": {
      "enabled": true,
      "allowedOrigins": ["https://cursor.sh"]
    }
  }
}
```

**2. 入力検証**
```json
{
  "validation": {
    "strict": true,
    "maxInputSize": "1MB",
    "allowedFileTypes": [".md", ".json", ".ts"]
  }
}
```

**3. ログ・監視**
```json
{
  "logging": {
    "level": "info",
    "auditLog": true,
    "securityEvents": true
  }
}
```

**4. 定期的セキュリティチェック**
```bash
# 脆弱性スキャン
npm audit

# セキュリティ更新
npm update
```

詳細は [セキュリティベストプラクティス](security-best-practices.md) をご参照ください。

#### Q: APIキーは必要ですか？

**A:** APIキーは任意ですが、本番環境では推奨します：

**設定方法:**
```json
{
  "security": {
    "apiKeyRequired": true,
    "apiKeys": [
      "your-secure-api-key-here"
    ]
  }
}
```

**使用方法:**
```bash
# HTTPヘッダーで送信
curl -H "X-API-Key: your-secure-api-key-here" \
  http://localhost:3000/api/search
```

**APIキー生成:**
```bash
# セキュアなAPIキー生成
openssl rand -hex 32
```

---

### Docker・デプロイメント

#### Q: Dockerでの実行方法は？

**A:** Docker環境での実行手順：

**1. 基本実行**
```bash
# イメージ取得・実行
docker run -p 3000:3000 expo/expo-mcp-server

# バックグラウンド実行
docker run -d -p 3000:3000 --name expo-mcp expo/expo-mcp-server
```

**2. 設定ファイル使用**
```bash
# ローカル設定ファイルをマウント
docker run -p 3000:3000 \
  -v $(pwd)/mcp-config.json:/app/mcp-config.json \
  expo/expo-mcp-server
```

**3. 環境変数使用**
```bash
# 環境変数で設定
docker run -p 3000:3000 \
  -e EXPO_MCP_PORT=3000 \
  -e EXPO_MCP_LOG_LEVEL=info \
  expo/expo-mcp-server
```

**4. Docker Compose使用**
```yaml
version: '3.8'
services:
  expo-mcp-server:
    image: expo/expo-mcp-server
    ports:
      - "3000:3000"
    environment:
      - EXPO_MCP_LOG_LEVEL=info
    volumes:
      - ./config:/app/config
      - logs:/var/log
volumes:
  logs:
```

詳細は [Docker デプロイメントガイド](docker-deployment.md) をご参照ください。

#### Q: 本番環境での推奨設定は？

**A:** 本番環境の推奨構成：

**1. 基本設定**
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "timeout": 30000
  },
  "logging": {
    "level": "warn",
    "file": "/var/log/expo-mcp-server.log",
    "rotation": true
  },
  "cache": {
    "enabled": true,
    "ttl": 3600,
    "maxSize": 2000
  },
  "security": {
    "rateLimit": {
      "enabled": true,
      "maxRequests": 200
    }
  }
}
```

**2. システム設定**
```bash
# サービス登録
sudo systemctl enable expo-mcp-server
sudo systemctl start expo-mcp-server

# ログローテーション
sudo logrotate -f /etc/logrotate.d/expo-mcp-server

# 監視設定
# Prometheus、Grafana等の設定
```

**3. セキュリティ強化**
```bash
# ファイアウォール設定
sudo ufw allow 3000/tcp

# SSL終端（nginx等）
# リバースプロキシ設定
```

---

### サポート・コミュニティ

#### Q: 問題が解決しない場合は？

**A:** サポートリソース：

**1. ドキュメント確認**
- 📚 [インストールガイド](installation-guide.md)
- 🔧 [設定リファレンス](configuration-reference.md)  
- 🛠️ [トラブルシューティング](troubleshooting.md)
- 🔍 [MCP ツールリファレンス](mcp-tools-reference.md)

**2. 問題報告**
- 🐛 [GitHub Issues](https://github.com/expo/expo-mcp-server/issues)
- 📧 Email: support@expo.dev
- 💬 Discord: [Expo Community](https://discord.gg/expo)

**3. 情報提供時の推奨事項**
```bash
# システム情報収集
expo-mcp-server --system-info

# ログ収集
expo-mcp-server --collect-logs

# 設定情報（機密情報除く）
expo-mcp-server --config-dump --sanitize
```

#### Q: 機能リクエストはどこに送ればよいですか？

**A:** 機能リクエストの方法：

**1. GitHub Discussions**
- 💡 [Feature Requests](https://github.com/expo/expo-mcp-server/discussions)
- 📝 テンプレートに従って詳細記載

**2. 記載推奨事項**
- 📋 機能の詳細説明
- 🎯 使用ケース・動機
- 💻 実装例・イメージ
- 📊 優先度・緊急度

**3. コミュニティフィードバック**
- 👍 既存リクエストへの投票
- 💬 ディスカッション参加
- 🤝 実装協力の申し出

#### Q: コントリビューションするには？

**A:** 貢献方法：

**1. 開発への参加**
- 📖 [貢献ガイドライン](contributing-guide.md)確認
- 🍴 リポジトリをFork
- 🔧 機能実装・バグ修正
- 📤 Pull Request作成

**2. ドキュメント改善**
- 📝 ドキュメント修正・追加
- 🌐 翻訳サポート
- 📚 チュートリアル作成

**3. コミュニティサポート**
- ❓ 質問への回答
- 🐛 バグ報告
- 💡 改善提案

---

## 📞 サポート連絡先

### 緊急時サポート
- **重要な問題**: support@expo.dev
- **セキュリティ問題**: security@expo.dev
- **緊急バグ**: [GitHub Issues](https://github.com/expo/expo-mcp-server/issues) (critical ラベル)

### コミュニティサポート
- **Discord**: [Expo Community](https://discord.gg/expo) (#mcp-server チャンネル)
- **Forums**: [Expo Forums](https://forums.expo.dev)
- **GitHub Discussions**: [expo-mcp-server discussions](https://github.com/expo/expo-mcp-server/discussions)

### ドキュメント・リソース
- **公式ドキュメント**: [docs/](/)
- **API リファレンス**: [api-reference.md](api-reference.md)
- **例・チュートリアル**: [examples/](https://github.com/expo/expo-mcp-server/tree/main/examples)

---

**最終更新**: 2024-12-20  
**バージョン**: v1.0.0

このFAQでカバーされていない問題がある場合は、お気軽に [GitHub Issues](https://github.com/expo/expo-mcp-server/issues) でお知らせください。コミュニティと開発チームがサポートいたします！ 