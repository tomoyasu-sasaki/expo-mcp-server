# Expo MCP Server OpenAPI 仕様書

## 📋 概要

Expo MCP ServerのHTTP + Server-Sent Events APIの詳細仕様をOpenAPI 3.0.3形式で定義しています。この仕様書は、REST API、WebSocket、SSE接続の全エンドポイントを網羅しています。

## 🌐 OpenAPI 3.0.3 仕様

```yaml
openapi: 3.0.3
info:
  title: Expo MCP Server API
  description: |
    Model Context Protocol (MCP) サーバーの HTTP API実装。
    Expo ドキュメント、API リファレンス、コミュニティリソースへの
    統一的なアクセスを提供します。
    
    ## 主な機能
    - MCP Protocol 2024-11-05 準拠
    - JSON-RPC 2.0 over HTTP + SSE
    - WebSocket升级支持
    - 認証・認可機能
    - レート制限・DDoS保護
    
    ## サポートされるトランスポート
    - **stdio**: JSON-RPC over stdin/stdout (primary)
    - **HTTP + SSE**: HTTP POST + Server-Sent Events
    - **WebSocket**: WebSocket upgrade from HTTP
    
  version: 1.0.0
  contact:
    name: Expo MCP Team
    email: expo-mcp@expo.dev
    url: https://github.com/expo/expo-mcp-server
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
  termsOfService: https://expo.dev/terms

servers:
  - url: http://localhost:3000
    description: Development server
  - url: https://api.expo-mcp.dev
    description: Production server
  - url: https://staging.expo-mcp.dev
    description: Staging server

paths:
  /health:
    get:
      tags:
        - Health
      summary: ヘルスチェック
      description: サーバーの健全性とステータスを確認
      operationId: healthCheck
      responses:
        '200':
          description: サーバー正常稼働中
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
              examples:
                healthy:
                  value:
                    status: "healthy"
                    timestamp: "2024-12-10T10:30:00Z"
                    version: "1.0.0"
                    uptime_seconds: 3600
                    checks:
                      database: "healthy"
                      cache: "healthy"
                      search_engine: "healthy"
        '503':
          description: サーバー異常状態
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /mcp:
    post:
      tags:
        - MCP Protocol
      summary: MCP JSON-RPC リクエスト
      description: |
        MCP Protocol JSON-RPC 2.0リクエストを処理。
        stdio通信の代替として HTTP POST を使用。
      operationId: mcpJsonRpc
      security:
        - ApiKeyAuth: []
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/JsonRpcRequest'
            examples:
              initialize:
                summary: MCP初期化
                value:
                  jsonrpc: "2.0"
                  id: 1
                  method: "initialize"
                  params:
                    protocolVersion: "2024-11-05"
                    capabilities:
                      tools: {}
                      resources: {}
              search_documents:
                summary: ドキュメント検索
                value:
                  jsonrpc: "2.0"
                  id: 2
                  method: "tools/call"
                  params:
                    name: "expo_search_documents"
                    arguments:
                      query: "navigation"
                      filters:
                        category: ["docs"]
                        platform: ["ios", "android"]
      responses:
        '200':
          description: 成功レスポンス
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/JsonRpcResponse'
              examples:
                initialize_success:
                  value:
                    jsonrpc: "2.0"
                    id: 1
                    result:
                      protocolVersion: "2024-11-05"
                      capabilities:
                        tools:
                          listChanged: true
                        resources:
                          subscribe: true
                        prompts:
                          listChanged: true
                search_success:
                  value:
                    jsonrpc: "2.0"
                    id: 2
                    result:
                      content:
                        - type: "text"
                          text: "検索結果のJSONデータ"
        '400':
          description: リクエストエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/JsonRpcError'
        '401':
          description: 認証エラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: レート制限エラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/JsonRpcError'

  /mcp/events:
    get:
      tags:
        - MCP Protocol
      summary: Server-Sent Events接続
      description: |
        MCP通知とリアルタイム更新用のSSE接続。
        WebSocketの代替として利用可能。
      operationId: mcpServerSentEvents
      security:
        - ApiKeyAuth: []
        - BearerAuth: []
      parameters:
        - name: session_id
          in: query
          required: true
          schema:
            type: string
            pattern: '^[a-zA-Z0-9_-]+$'
          description: MCPセッションID
        - name: last_event_id
          in: query
          required: false
          schema:
            type: string
          description: 最後に受信したイベントID（再接続時）
      responses:
        '200':
          description: SSE接続確立
          content:
            text/event-stream:
              schema:
                type: string
                format: event-stream
              examples:
                tool_list_changed:
                  value: |
                    event: tools/list_changed
                    id: evt_123456
                    data: {"tools": ["expo_search_documents", "expo_recommend"]}
                    
                resource_updated:
                  value: |
                    event: resources/updated
                    id: evt_123457
                    data: {"uri": "expo://docs/navigation", "content": "..."}
        '401':
          description: 認証エラー
        '403':
          description: セッション無効

  /mcp/ws:
    get:
      tags:
        - MCP Protocol
      summary: WebSocket升级
      description: |
        HTTP接続からWebSocketへのアップグレード。
        双方向リアルタイム通信用。
      operationId: mcpWebSocketUpgrade
      security:
        - ApiKeyAuth: []
        - BearerAuth: []
      parameters:
        - name: Connection
          in: header
          required: true
          schema:
            type: string
            enum: ["Upgrade"]
        - name: Upgrade
          in: header
          required: true
          schema:
            type: string
            enum: ["websocket"]
        - name: Sec-WebSocket-Key
          in: header
          required: true
          schema:
            type: string
        - name: Sec-WebSocket-Version
          in: header
          required: true
          schema:
            type: string
            enum: ["13"]
      responses:
        '101':
          description: WebSocket接続アップグレード成功
          headers:
            Connection:
              schema:
                type: string
                enum: ["Upgrade"]
            Upgrade:
              schema:
                type: string
                enum: ["websocket"]
            Sec-WebSocket-Accept:
              schema:
                type: string
        '400':
          description: アップグレード失敗
        '401':
          description: 認証エラー

  /metrics:
    get:
      tags:
        - Monitoring
      summary: Prometheusメトリクス
      description: |
        Prometheus形式のメトリクスデータを提供。
        パフォーマンス監視・アラート用。
      operationId: getMetrics
      security:
        - ApiKeyAuth: []
      responses:
        '200':
          description: Prometheusメトリクス
          content:
            text/plain:
              schema:
                type: string
                format: prometheus
              example: |
                # HELP expo_mcp_requests_total Total number of MCP requests
                # TYPE expo_mcp_requests_total counter
                expo_mcp_requests_total{method="tools/call",tool="expo_search_documents"} 1234
                
                # HELP expo_mcp_response_time_seconds MCP response time in seconds
                # TYPE expo_mcp_response_time_seconds histogram
                expo_mcp_response_time_seconds_bucket{le="0.05"} 1000
                expo_mcp_response_time_seconds_bucket{le="0.1"} 1800
                expo_mcp_response_time_seconds_bucket{le="0.5"} 2000
                expo_mcp_response_time_seconds_bucket{le="+Inf"} 2000
                expo_mcp_response_time_seconds_sum 125.5
                expo_mcp_response_time_seconds_count 2000
        '401':
          description: 認証エラー

  /admin/sessions:
    get:
      tags:
        - Administration
      summary: アクティブセッション一覧
      description: 現在アクティブなMCPセッションの一覧を取得
      operationId: getActiveSessions
      security:
        - AdminAuth: []
      responses:
        '200':
          description: セッション一覧
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessions:
                    type: array
                    items:
                      $ref: '#/components/schemas/SessionInfo'
                  total_count:
                    type: integer
                  active_count:
                    type: integer
        '401':
          description: 認証エラー
        '403':
          description: 管理者権限エラー

  /admin/sessions/{session_id}:
    delete:
      tags:
        - Administration
      summary: セッション終了
      description: 指定されたセッションを強制終了
      operationId: terminateSession
      security:
        - AdminAuth: []
      parameters:
        - name: session_id
          in: path
          required: true
          schema:
            type: string
          description: セッションID
      responses:
        '200':
          description: セッション終了成功
        '404':
          description: セッション不存在
        '401':
          description: 認証エラー
        '403':
          description: 管理者権限エラー

  /admin/cache:
    get:
      tags:
        - Administration
      summary: キャッシュ統計
      description: キャッシュの使用状況と統計情報を取得
      operationId: getCacheStats
      security:
        - AdminAuth: []
      responses:
        '200':
          description: キャッシュ統計
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CacheStats'

    delete:
      tags:
        - Administration
      summary: キャッシュクリア
      description: 全キャッシュをクリア
      operationId: clearCache
      security:
        - AdminAuth: []
      responses:
        '200':
          description: キャッシュクリア成功

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: APIキー認証
    
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT トークン認証
    
    AdminAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: 管理者用JWT認証

  schemas:
    JsonRpcRequest:
      type: object
      required:
        - jsonrpc
        - method
        - id
      properties:
        jsonrpc:
          type: string
          enum: ["2.0"]
          description: JSON-RPC版本
        method:
          type: string
          description: 呼び出すメソッド名
          examples:
            - "initialize"
            - "tools/call"
            - "resources/read"
            - "prompts/get"
        params:
          type: object
          description: メソッドパラメータ
        id:
          oneOf:
            - type: string
            - type: number
            - type: "null"
          description: リクエストID

    JsonRpcResponse:
      type: object
      required:
        - jsonrpc
        - id
      properties:
        jsonrpc:
          type: string
          enum: ["2.0"]
        result:
          type: object
          description: 成功結果
        error:
          $ref: '#/components/schemas/JsonRpcErrorObject'
        id:
          oneOf:
            - type: string
            - type: number
            - type: "null"

    JsonRpcError:
      type: object
      required:
        - jsonrpc
        - error
        - id
      properties:
        jsonrpc:
          type: string
          enum: ["2.0"]
        error:
          $ref: '#/components/schemas/JsonRpcErrorObject'
        id:
          oneOf:
            - type: string
            - type: number
            - type: "null"

    JsonRpcErrorObject:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          description: エラーコード
          examples:
            - -32700  # Parse error
            - -32600  # Invalid Request
            - -32601  # Method not found
            - -32602  # Invalid params
            - -32603  # Internal error
        message:
          type: string
          description: エラーメッセージ
        data:
          type: object
          description: 追加エラー情報

    HealthResponse:
      type: object
      required:
        - status
        - timestamp
        - version
      properties:
        status:
          type: string
          enum: ["healthy", "degraded", "unhealthy"]
          description: サーバーステータス
        timestamp:
          type: string
          format: date-time
          description: チェック実行時刻
        version:
          type: string
          description: サーバーバージョン
        uptime_seconds:
          type: integer
          minimum: 0
          description: 稼働時間（秒）
        checks:
          type: object
          description: 各コンポーネントの健全性
          properties:
            database:
              type: string
              enum: ["healthy", "degraded", "unhealthy"]
            cache:
              type: string
              enum: ["healthy", "degraded", "unhealthy"]
            search_engine:
              type: string
              enum: ["healthy", "degraded", "unhealthy"]
          additionalProperties:
            type: string

    ErrorResponse:
      type: object
      required:
        - error
        - message
        - timestamp
      properties:
        error:
          type: string
          description: エラータイプ
          examples:
            - "authentication_failed"
            - "rate_limit_exceeded"
            - "invalid_request"
        message:
          type: string
          description: エラーメッセージ
        timestamp:
          type: string
          format: date-time
        details:
          type: object
          description: 詳細エラー情報
        request_id:
          type: string
          description: リクエストID（トレーシング用）

    SessionInfo:
      type: object
      required:
        - session_id
        - created_at
        - status
      properties:
        session_id:
          type: string
          description: セッションID
        created_at:
          type: string
          format: date-time
          description: セッション作成時刻
        last_activity:
          type: string
          format: date-time
          description: 最終アクティビティ時刻
        status:
          type: string
          enum: ["active", "idle", "disconnected"]
          description: セッションステータス
        client_info:
          type: object
          description: クライアント情報
          properties:
            user_agent:
              type: string
            ip_address:
              type: string
              format: ipv4
            protocol_version:
              type: string
        request_count:
          type: integer
          minimum: 0
          description: リクエスト総数
        error_count:
          type: integer
          minimum: 0
          description: エラー総数

    CacheStats:
      type: object
      required:
        - memory_cache
        - redis_cache
        - total_requests
        - cache_hits
        - cache_misses
      properties:
        memory_cache:
          type: object
          properties:
            size_mb:
              type: number
              minimum: 0
            max_size_mb:
              type: number
              minimum: 0
            entries:
              type: integer
              minimum: 0
            hit_rate:
              type: number
              minimum: 0
              maximum: 1
        redis_cache:
          type: object
          properties:
            connected:
              type: boolean
            size_mb:
              type: number
              minimum: 0
            keys:
              type: integer
              minimum: 0
            hit_rate:
              type: number
              minimum: 0
              maximum: 1
        total_requests:
          type: integer
          minimum: 0
        cache_hits:
          type: integer
          minimum: 0
        cache_misses:
          type: integer
          minimum: 0
        hit_rate:
          type: number
          minimum: 0
          maximum: 1
          description: 全体的なキャッシュヒット率

  examples:
    SearchDocumentsRequest:
      summary: ドキュメント検索リクエスト
      value:
        jsonrpc: "2.0"
        id: "search_001"
        method: "tools/call"
        params:
          name: "expo_search_documents"
          arguments:
            query: "navigation setup"
            filters:
              category: ["docs", "tutorials"]
              platform: ["ios", "android"]
              sdk_version: ["latest"]
            sort:
              by: "relevance"
              order: "desc"
            pagination:
              page: 1
              per_page: 10

    ToolListResponse:
      summary: ツール一覧レスポンス
      value:
        jsonrpc: "2.0"
        id: "tools_list_001"
        result:
          tools:
            - name: "expo_read_document"
              description: "Expoドキュメント、APIリファレンス、ガイドを取得"
              inputSchema:
                type: "object"
                properties:
                  url:
                    type: "string"
                    format: "uri"
                required: ["url"]
            - name: "expo_search_documents"
              description: "Expoエコシステム全体でコンテンツ検索"
              inputSchema:
                type: "object"
                properties:
                  query:
                    type: "string"
                    maxLength: 500
                required: ["query"]

  headers:
    X-RateLimit-Limit:
      schema:
        type: integer
      description: リクエスト制限数（1時間あたり）
    
    X-RateLimit-Remaining:
      schema:
        type: integer
      description: 残りリクエスト数
    
    X-RateLimit-Reset:
      schema:
        type: integer
      description: 制限リセット時刻（Unix timestamp）
    
    X-Request-ID:
      schema:
        type: string
      description: リクエストID（トレーシング・ログ用）

tags:
  - name: Health
    description: ヘルスチェック・ステータス確認
  - name: MCP Protocol
    description: MCP Protocol JSON-RPC実装
  - name: Monitoring
    description: 監視・メトリクス
  - name: Administration
    description: 管理機能

externalDocs:
  description: Expo MCP Server GitHub Repository
  url: https://github.com/expo/expo-mcp-server
```

## 🔧 コード生成ツール

### クライアントSDK生成
```bash
# TypeScriptクライアント生成
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript-fetch \
  -o clients/typescript

# Pythonクライアント生成
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o clients/python

# Goクライアント生成
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g go \
  -o clients/go
```

### サーバーモック生成
```bash
# Prism モックサーバー起動
npx @stoplight/prism-cli mock docs/openapi.yaml

# Wiremock設定生成
npx swagger-codegen generate \
  -i docs/openapi.yaml \
  -l wiremock \
  -o mocks/wiremock
```

## 📊 API使用例

### TypeScriptクライアント例
```typescript
import { Configuration, DefaultApi } from './generated/expo-mcp-client';

// クライアント設定
const config = new Configuration({
  basePath: 'https://api.expo-mcp.dev',
  apiKey: process.env.EXPO_MCP_API_KEY,
  middleware: [
    {
      pre: async (context) => {
        context.init.headers = {
          ...context.init.headers,
          'X-Request-ID': generateRequestId(),
        };
      }
    }
  ]
});

const client = new DefaultApi(config);

// MCP リクエスト実行
async function searchDocuments(query: string) {
  try {
    const response = await client.mcpJsonRpc({
      jsonrpc: '2.0',
      id: 'search_001',
      method: 'tools/call',
      params: {
        name: 'expo_search_documents',
        arguments: {
          query,
          filters: {
            category: ['docs'],
            platform: ['ios', 'android']
          }
        }
      }
    });
    
    return response.result;
  } catch (error) {
    console.error('検索エラー:', error);
    throw error;
  }
}

// SSE接続
function connectToEvents(sessionId: string) {
  const eventSource = new EventSource(
    `https://api.expo-mcp.dev/mcp/events?session_id=${sessionId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.JWT_TOKEN}`
      }
    }
  );
  
  eventSource.addEventListener('tools/list_changed', (event) => {
    const data = JSON.parse(event.data);
    console.log('ツール一覧が更新されました:', data.tools);
  });
  
  eventSource.addEventListener('error', (error) => {
    console.error('SSE接続エラー:', error);
  });
  
  return eventSource;
}
```

### cURLコマンド例
```bash
# ヘルスチェック
curl -X GET "http://localhost:3000/health" \
  -H "Accept: application/json"

# MCP検索リクエスト
curl -X POST "http://localhost:3000/mcp" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jsonrpc": "2.0",
    "id": "search_001",
    "method": "tools/call",
    "params": {
      "name": "expo_search_documents",
      "arguments": {
        "query": "navigation",
        "filters": {
          "category": ["docs"],
          "platform": ["ios", "android"]
        }
      }
    }
  }'

# SSE接続
curl -N -H "Accept: text/event-stream" \
  -H "X-API-Key: your-api-key" \
  "http://localhost:3000/mcp/events?session_id=sess_123"

# メトリクス取得
curl -X GET "http://localhost:3000/metrics" \
  -H "X-API-Key: your-api-key"
```

## 🔍 API テスト

### Postman Collection
```json
{
  "info": {
    "name": "Expo MCP Server API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "apiKey",
      "value": "{{EXPO_MCP_API_KEY}}"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "Search Documents",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "X-API-Key",
            "value": "{{apiKey}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": \"search_001\",\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \"expo_search_documents\",\n    \"arguments\": {\n      \"query\": \"navigation\",\n      \"filters\": {\n        \"category\": [\"docs\"],\n        \"platform\": [\"ios\", \"android\"]\n      }\n    }\n  }\n}"
        },
        "url": "{{baseUrl}}/mcp"
      }
    }
  ]
}
```

## 📚 参考資料

### API仕様
- [OpenAPI 3.0.3 Specification](https://swagger.io/specification/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [WebSocket Protocol](https://tools.ietf.org/html/rfc6455)

### ツール・ライブラリ
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Prism Mock Server](https://stoplight.io/open-source/prism)
- [Postman](https://www.postman.com/)

---

**🔄 自動生成**: この仕様書はサーバーコードから自動生成され、CI/CDパイプラインで最新状態が維持されます。

**📧 API質問**: API仕様に関するご質問は api@expo.dev までお寄せください。 