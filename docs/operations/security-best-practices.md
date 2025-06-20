# Expo MCP Server セキュリティベストプラクティス

## 📋 概要

Expo MCP Serverは、エンタープライズレベルのセキュリティを実現するため、多層防御アプローチを採用しています。本ガイドでは、安全な運用のためのベストプラクティスを説明します。

## 🛡️ アーキテクチャセキュリティ

### 多層防御戦略

```
┌─────────────────────────────────────────────────────────┐
│                    ネットワーク層                         │
│  ├── HTTPS/TLS 1.3 暗号化                              │
│  ├── ファイアウォール・DDoS保護                          │
│  └── ネットワークセグメンテーション                       │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                   アプリケーション層                        │
│  ├── レート制限・スロットリング                          │
│  ├── 入力検証・サニタイゼーション                         │
│  ├── セッション管理・タイムアウト                         │
│  └── アクセス制御・認証                                 │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                      コンテナ層                          │
│  ├── 非rootユーザー実行                                │
│  ├── 読み取り専用ファイルシステム                         │
│  ├── 最小権限設定                                      │
│  └── セキュリティスキャン                               │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                      ホスト層                          │
│  ├── OS レベルセキュリティ                              │
│  ├── ログ監視・SIEM連携                                │
│  ├── 侵入検知・防止システム                             │
│  └── 定期的セキュリティ監査                             │
└─────────────────────────────────────────────────────────┘
```

## 🔐 認証・認可

### MCPプロトコルセキュリティ

#### セッション管理
```json
{
  "session": {
    "timeout_minutes": 60,
    "max_concurrent_sessions": 5,
    "idle_timeout_minutes": 15,
    "session_rotation": true
  }
}
```

#### アクセス制御設定
```yaml
access_control:
  allowed_hosts:
    - docs.expo.dev
    - api.expo.dev
    - snack.expo.dev
    - github.com/expo
    - npm.expo.dev
  
  blocked_hosts:
    - "*malicious-site.com"
    - "localhost"  # 本番環境
    - "127.0.0.1"  # 本番環境
  
  rate_limits:
    per_session: 2000
    per_minute: 100
    burst_limit: 20
```

### 認証の実装

#### 基本認証（開発環境）
```bash
# 環境変数設定
export MCP_AUTH_ENABLED=true
export MCP_AUTH_METHOD=basic
export MCP_USERNAME=your_username
export MCP_PASSWORD=your_secure_password
```

#### トークンベース認証（本番環境）
```bash
# JWT認証設定
export MCP_AUTH_METHOD=jwt
export MCP_JWT_SECRET=your_256_bit_secret
export MCP_JWT_EXPIRY=3600  # 1時間
```

## 🚧 入力検証・サニタイゼーション

### 実装済み検証機能

#### JSON Schema検証
```typescript
// 自動適用される検証
const toolSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      maxLength: 500,
      pattern: "^[a-zA-Z0-9\\s\\-_\\.\\/\\?\\&\\=]+$"
    }
  },
  required: ["query"],
  additionalProperties: false
};
```

#### SQLインジェクション防止
```typescript
// パラメータ化クエリ自動使用
const searchQuery = `
  SELECT * FROM documents 
  WHERE content MATCH ? 
  AND category = ? 
  LIMIT ?
`;
// プリペアドステートメント使用
await db.execute(searchQuery, [userQuery, category, limit]);
```

#### XSS防止
```typescript
// 自動エスケープ処理
import { escape } from 'html-escaper';

function sanitizeOutput(content: string): string {
  return escape(content)
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}
```

#### パストラバーサル防止
```typescript
// 安全なパス解決
import path from 'path';

function validatePath(userPath: string): boolean {
  const normalized = path.normalize(userPath);
  return !normalized.includes('../') && 
         !normalized.startsWith('/') &&
         !normalized.includes('\\');
}
```

## 🔒 データ保護

### 機密情報管理

#### 環境変数暗号化
```bash
# 機密情報は必ず環境変数で管理
export REDIS_PASSWORD=$(echo "your_password" | base64)
export TYPESENSE_API_KEY=$(vault kv get -field=api_key secret/typesense)
```

#### ログ機密情報マスキング
```typescript
// 自動適用されるマスキング
const sensitiveFields = [
  'password', 'token', 'key', 'secret', 
  'credential', 'authorization'
];

function maskSensitiveData(logData: any): any {
  // 機密情報を自動マスキング
  return JSON.parse(JSON.stringify(logData, (key, value) => {
    return sensitiveFields.some(field => 
      key.toLowerCase().includes(field)
    ) ? '***MASKED***' : value;
  }));
}
```

### データ暗号化

#### 保存時暗号化
```yaml
encryption:
  algorithm: "AES-256-GCM"
  key_derivation: "PBKDF2"
  iterations: 100000
  salt_length: 32
```

#### 転送時暗号化
```yaml
tls_config:
  min_version: "1.3"
  cipher_suites:
    - "TLS_AES_256_GCM_SHA384"
    - "TLS_CHACHA20_POLY1305_SHA256"
  certificate_validation: "strict"
```

## 🔍 脅威検知・監視

### セキュリティイベント監視

#### 実装済みアラート
```yaml
security_alerts:
  rate_limit_exceeded:
    threshold: 2000
    window: "1h"
    action: "block_session"
  
  suspicious_patterns:
    patterns:
      - "javascript:"
      - "<script"
      - "UNION SELECT"
      - "../"
    action: "block_and_alert"
  
  authentication_failures:
    threshold: 5
    window: "15m"
    action: "temporary_ban"
```

#### Prometheusメトリクス
```typescript
// セキュリティメトリクス自動収集
const securityViolations = new Counter({
  name: 'expo_mcp_security_violations_total',
  help: 'Total number of security violations',
  labelNames: ['type', 'severity']
});

const authenticationAttempts = new Counter({
  name: 'expo_mcp_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['result', 'method']
});
```

### ログ監視

#### セキュリティログ形式
```json
{
  "timestamp": "2024-12-10T10:30:00Z",
  "level": "SECURITY",
  "event_type": "SUSPICIOUS_ACTIVITY",
  "severity": "HIGH",
  "session_id": "sess_123456",
  "user_agent": "***MASKED***",
  "ip_address": "192.168.1.***",
  "details": {
    "violation_type": "SQL_INJECTION_ATTEMPT",
    "blocked": true,
    "payload": "***SANITIZED***"
  }
}
```

## ⚙️ 設定セキュリティ

### 安全な設定例

#### 本番環境設定
```json
{
  "security": {
    "input_validation": {
      "max_tool_args_size_bytes": 2048,
      "max_resource_uri_length": 512,
      "sanitize_file_paths": true,
      "validate_json_schema": true,
      "prevent_code_injection": true
    },
    "access_control": {
      "require_authentication": true,
      "rate_limit_per_session": 1000,
      "session_timeout_minutes": 30,
      "max_concurrent_sessions": 3
    },
    "tool_execution": {
      "sandboxing_enabled": true,
      "resource_limits": {
        "max_memory_mb": 128,
        "max_cpu_time_ms": 3000,
        "max_file_reads": 50,
        "max_network_requests": 25
      }
    }
  }
}
```

#### Docker セキュリティ設定
```dockerfile
# セキュリティ強化済みDockerfile
FROM node:18-alpine

# セキュリティアップデート
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 読み取り専用ファイルシステム
USER nextjs
COPY --chown=nextjs:nodejs . .

# セキュリティヘッダー
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 非特権実行
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

## 🚨 インシデント対応

### 脅威対応手順

#### 1. 検知・分析フェーズ
```bash
# アラート確認
docker logs expo-mcp-server | grep "SECURITY"

# メトリクス確認
curl http://localhost:9090/metrics | grep security_violations

# アクティブセッション確認
curl http://localhost:3000/admin/sessions
```

#### 2. 封じ込めフェーズ
```bash
# 疑わしいセッション終了
curl -X DELETE http://localhost:3000/admin/sessions/{session_id}

# 一時的IPブロック
docker exec expo-mcp-server iptables -A INPUT -s {suspicious_ip} -j DROP

# サービス緊急停止（必要時）
docker-compose down
```

#### 3. 復旧・改善フェーズ
```bash
# ログ分析・レポート生成
docker exec expo-mcp-server npm run security:report

# セキュリティパッチ適用
docker-compose pull && docker-compose up -d

# 設定見直し・強化
vim config/production.json
```

## 📊 セキュリティ監査

### 定期監査チェックリスト

#### 月次チェック
- [ ] 依存関係脆弱性スキャン実行
- [ ] セキュリティログレビュー
- [ ] アクセス権限見直し
- [ ] セキュリティメトリクス分析
- [ ] 設定ファイル安全性確認

#### 四半期チェック
- [ ] ペネトレーションテスト実行
- [ ] セキュリティポリシー見直し
- [ ] インシデント対応手順検証
- [ ] 暗号化設定更新確認
- [ ] バックアップ整合性確認

### 自動セキュリティスキャン

#### 実装方法
```bash
# 脆弱性スキャン
npm audit --audit-level=high

# Dockerセキュリティスキャン
docker scout cves expo-mcp-server:latest

# 静的コード解析
npm run security:scan
```

## 🔧 セキュリティツール

### 推奨ツール

#### 開発時
- **ESLint Security Plugin**: 静的コード解析
- **npm audit**: 依存関係脆弱性チェック
- **OWASP ZAP**: Webアプリケーション脆弱性スキャン

#### 運用時
- **Prometheus + Grafana**: セキュリティメトリクス監視
- **ELK Stack**: ログ分析・SIEM
- **Falco**: ランタイム脅威検知

## 📚 セキュリティリソース

### 参考資料
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Node.js Security Best Practices](https://nodejs.org/en/security/)
- [MCP Protocol Security Guidelines](https://spec.modelcontextprotocol.io/specification/security/)

### コミュニティサポート
- セキュリティ問題報告: security@expo.dev
- 脆弱性報告プロセス: [SECURITY.md](../SECURITY.md)
- セキュリティアップデート: [GitHub Security Advisories](https://github.com/expo/expo-mcp-server/security/advisories)

---

**⚠️ 重要**: セキュリティは継続的なプロセスです。定期的にこのガイドを見直し、最新の脅威に対応した設定を維持してください。

**📧 お問い合わせ**: セキュリティに関する質問や報告は security@expo.dev までご連絡ください。 