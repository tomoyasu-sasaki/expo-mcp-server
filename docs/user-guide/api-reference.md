# API リファレンス

## 概要

Expo MCP Server API リファレンス。Model Context Protocol (MCP) 仕様に準拠した全てのツール、リソース、プロンプトを網羅します。

## プロトコル情報

- **MCP バージョン**: 2024-11-05
- **プロトコル仕様**: [https://spec.modelcontextprotocol.io/](https://spec.modelcontextprotocol.io/)
- **トランスポート**: stdio (主要)、HTTP + SSE (フォールバック)
- **メッセージ形式**: JSON-RPC 2.0

## 認証・セキュリティ

```json
{
  "access_control": {
    "mode": "anonymous",
    "rate_limit_per_session": 2000,
    "session_timeout_minutes": 60,
    "max_concurrent_sessions": 200
  }
}
```

---

# Tools (ツール)

## expo_read_document

Expoドキュメント、APIリファレンス、ガイドの詳細内容を取得します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri",
      "description": "取得するドキュメントのURL"
    },
    "doc_type": {
      "type": "string",
      "enum": ["guide", "api", "tutorial", "reference"],
      "description": "ドキュメントタイプ（オプション）"
    }
  },
  "required": ["url"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "expo_read_document",
    "arguments": {
      "url": "https://docs.expo.dev/versions/latest/sdk/camera/",
      "doc_type": "api"
    }
  }
}
```

### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Document: Camera API\n\n[マークダウン形式のドキュメント内容]\n\n---\nSource: https://docs.expo.dev/versions/latest/sdk/camera/\nType: api\nLast Modified: 2024-12-01"
    }
  ]
}
```

## expo_search_documents

Expoエコシステム全体でコンテンツを検索します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500,
      "description": "検索クエリ"
    },
    "filters": {
      "type": "object",
      "properties": {
        "category": {
          "type": "array",
          "items": {
            "enum": ["docs", "api", "examples", "tutorials"]
          },
          "description": "検索対象カテゴリ"
        },
        "platform": {
          "type": "array",
          "items": {
            "enum": ["ios", "android", "web", "universal"]
          },
          "description": "対象プラットフォーム"
        },
        "sdk_version": {
          "type": "array",
          "items": {
            "enum": ["latest", "sdk-49", "sdk-48"]
          },
          "description": "SDK バージョン"
        },
        "module_type": {
          "type": "array",
          "items": {
            "enum": ["core", "community", "deprecated"]
          },
          "description": "モジュールタイプ"
        }
      }
    }
  },
  "required": ["query"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "expo_search_documents",
    "arguments": {
      "query": "camera permissions",
      "filters": {
        "category": ["api", "docs"],
        "platform": ["ios", "android"]
      }
    }
  }
}
```

### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Search Results for \"camera permissions\"\n\nFound 5 results:\n\n1. **Camera API - Permissions**\n   - URL: https://docs.expo.dev/versions/latest/sdk/camera/#permissions\n   - Score: 0.95\n   - Type: api\n   - Summary: Camera permission handling for iOS and Android\n\n2. **MediaLibrary Permissions**\n   - URL: https://docs.expo.dev/versions/latest/sdk/media-library/#permissions\n   - Score: 0.87\n   - Type: api\n   - Summary: Managing photo library access permissions"
    }
  ]
}
```

## expo_recommend

現在のコンテキストに基づいて関連コンテンツを推薦します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "context": {
      "type": "string",
      "minLength": 1,
      "maxLength": 1000,
      "description": "推薦の元となるコンテキスト"
    },
    "max_results": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5,
      "description": "最大結果数"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web", "universal"],
      "description": "対象プラットフォーム"
    }
  },
  "required": ["context"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "expo_recommend",
    "arguments": {
      "context": "写真撮影アプリを作っているが、撮った写真をギャラリーに保存する方法がわからない",
      "max_results": 3,
      "platform": "ios"
    }
  }
}
```

### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "# Recommendations for your context\n\nBased on: \"写真撮影アプリを作っているが、撮った写真をギャラリーに保存する方法...\"\n\n1. **MediaLibrary.saveToLibraryAsync()**\n   - URL: https://docs.expo.dev/versions/latest/sdk/media-library/#savetolibrary\n   - Relevance: 0.98\n   - Reason: 写真をデバイスのギャラリーに保存する主要メソッド\n   - Type: api\n\n2. **Camera Tutorial - Save Photo**\n   - URL: https://docs.expo.dev/tutorial/camera-save-photo/\n   - Relevance: 0.95\n   - Reason: カメラアプリでの写真保存の具体的なチュートリアル\n   - Type: tutorial"
    }
  ]
}
```

## expo_get_sdk_module

Expo SDK モジュールの詳細情報を取得します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "module_name": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "description": "SDK モジュール名"
    },
    "sdk_version": {
      "type": "string",
      "pattern": "^(latest|sdk-\\d+)$",
      "default": "latest",
      "description": "SDK バージョン"
    }
  },
  "required": ["module_name"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "expo_get_sdk_module",
    "arguments": {
      "module_name": "expo-camera",
      "sdk_version": "latest"
    }
  }
}
```

### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "# SDK Module: expo-camera (SDK 50)\n\n## Installation\n```bash\nnpx expo install expo-camera\n```\n\n## Platform Compatibility\n| Platform | Supported | Min Version | Limitations |\n|----------|-----------|-------------|-------------|\n| iOS | ✅ | 11.0 | None |\n| Android | ✅ | API 21 | None |\n| Web | ❌ | N/A | Use browser APIs |\n\n## Methods\n\n### Camera.takePictureAsync(options)\n\n**Signature:** `takePictureAsync(options?: CameraPictureOptions): Promise<CameraCapturedPicture>`\n\n**Description:** Captures a picture and returns information about the captured image\n\n**Platforms:** ios, android\n\n**Since:** SDK 1.0.0\n\n**TypeScript Example:**\n```typescript\nimport { Camera } from 'expo-camera';\n\nconst takePicture = async () => {\n  const photo = await cameraRef.current.takePictureAsync({\n    quality: 1,\n    base64: true\n  });\n  console.log(photo.uri);\n};\n```"
    }
  ]
}
```

## expo_config_templates

Expo設定ファイルの生成と検証を行います。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "template_type": {
      "type": "string",
      "enum": ["app.json", "eas.json", "metro.config.js"],
      "description": "生成する設定ファイルのタイプ"
    },
    "project_context": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "プロジェクト名"
        },
        "platforms": {
          "type": "array",
          "items": {
            "enum": ["ios", "android", "web"]
          },
          "description": "対象プラットフォーム"
        },
        "sdk_version": {
          "type": "string",
          "description": "SDK バージョン"
        }
      }
    }
  },
  "required": ["template_type"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "expo_config_templates",
    "arguments": {
      "template_type": "app.json",
      "project_context": {
        "name": "MyPhotoApp",
        "platforms": ["ios", "android"],
        "sdk_version": "50.0.0"
      }
    }
  }
}
```

## expo_eas_command_builder

EAS CLI コマンドをコンテキストに基づいて生成します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["build", "submit", "update", "credentials"],
      "description": "EAS オペレーション"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "all"],
      "description": "対象プラットフォーム"
    },
    "profile": {
      "type": "string",
      "default": "development",
      "description": "ビルドプロファイル"
    }
  },
  "required": ["operation"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "expo_eas_command_builder",
    "arguments": {
      "operation": "build",
      "platform": "ios",
      "profile": "production"
    }
  }
}
```

## expo_code_examples

実行可能なコード例とSnack統合を提供します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "pattern": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "コード例のパターン"
    },
    "language": {
      "type": "string",
      "enum": ["typescript", "javascript"],
      "default": "typescript",
      "description": "プログラミング言語"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web", "universal"],
      "description": "対象プラットフォーム"
    }
  },
  "required": ["pattern"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "expo_code_examples",
    "arguments": {
      "pattern": "camera photo capture",
      "language": "typescript",
      "platform": "universal"
    }
  }
}
```

## expo_error_diagnosis

一般的なExpoエラーの分析と解決策を提供します。

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "error_message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000,
      "description": "エラーメッセージ"
    },
    "error_type": {
      "type": "string",
      "enum": ["build", "runtime", "metro", "eas", "expo_cli"],
      "description": "エラータイプ"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web"],
      "description": "発生プラットフォーム"
    }
  },
  "required": ["error_message"]
}
```

### 使用例

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "expo_error_diagnosis",
    "arguments": {
      "error_message": "Error: Camera permissions not granted",
      "error_type": "runtime",
      "platform": "ios"
    }
  }
}
```

---

# Resources (リソース)

## expo://docs/{path}

Expoドキュメントページへの直接アクセス。

### URI Format

```
expo://docs/{path}
```

### 例

- `expo://docs/versions/latest/sdk/camera/`
- `expo://docs/tutorial/create-your-first-app/`
- `expo://docs/guides/permissions/`

### Response Format

```json
{
  "uri": "expo://docs/versions/latest/sdk/camera/",
  "mimeType": "text/markdown",
  "text": "[マークダウン形式のドキュメント内容]"
}
```

## expo://api/{module}

SDK モジュールAPIリファレンス。

### URI Format

```
expo://api/{module}?version={sdk_version}
```

### 例

- `expo://api/camera?version=latest`
- `expo://api/media-library?version=sdk-49`

## expo://examples/{category}

カテゴリ別コード例集。

### URI Format

```
expo://examples/{category}?platform={platform}&language={language}
```

### 例

- `expo://examples/camera?platform=universal&language=typescript`
- `expo://examples/navigation?platform=ios&language=javascript`

## expo://config/{type}

設定テンプレート。

### URI Format

```
expo://config/{type}?context={project_context}
```

### 例

- `expo://config/app.json?context={"name":"MyApp","platforms":["ios","android"]}`
- `expo://config/eas.json?context={"build_profiles":["development","production"]}`

## expo://eas/{command}

EAS CLI コマンドリファレンス。

### URI Format

```
expo://eas/{command}?operation={operation}&platform={platform}
```

### 例

- `expo://eas/build?operation=build&platform=ios`
- `expo://eas/submit?operation=submit&platform=android`

---

# Prompts (プロンプト)

## expo_setup_helper

新規Expoプロジェクトのセットアップを支援します。

### Arguments

```json
{
  "project_type": {
    "type": "string",
    "enum": ["blank", "tabs", "bare-workflow"],
    "description": "プロジェクトテンプレート"
  },
  "platforms": {
    "type": "array",
    "items": {
      "enum": ["ios", "android", "web"]
    },
    "description": "対象プラットフォーム"
  },
  "features": {
    "type": "array",
    "items": {
      "enum": ["navigation", "camera", "push-notifications", "location"]
    },
    "description": "必要な機能"
  }
}
```

### Response

セットアップ手順、推奨設定、必要な依存関係を含む包括的なガイド。

## expo_error_helper

エラー解決を支援します。

### Arguments

```json
{
  "error_context": {
    "type": "string",
    "description": "エラーが発生した状況"
  },
  "error_message": {
    "type": "string",
    "description": "具体的なエラーメッセージ"
  },
  "environment": {
    "type": "object",
    "properties": {
      "expo_version": {"type": "string"},
      "node_version": {"type": "string"},
      "platform": {"type": "string"}
    }
  }
}
```

### Response

エラー原因の分析、解決手順、予防策を含む詳細なガイド。

## expo_api_helper

API使用方法を案内します。

### Arguments

```json
{
  "module_name": {
    "type": "string",
    "description": "使用したいSDKモジュール"
  },
  "use_case": {
    "type": "string",
    "description": "実現したい機能や使用例"
  },
  "experience_level": {
    "type": "string",
    "enum": ["beginner", "intermediate", "advanced"],
    "description": "開発者のスキルレベル"
  }
}
```

### Response

APIの使用方法、ベストプラクティス、実装例を含むガイド。

## expo_config_analyzer

設定ファイルを分析し、最適化を提案します。

### Arguments

```json
{
  "config_content": {
    "type": "string",
    "description": "分析対象の設定ファイル内容"
  },
  "config_type": {
    "type": "string",
    "enum": ["app.json", "eas.json", "metro.config.js"],
    "description": "設定ファイルの種類"
  },
  "optimization_goals": {
    "type": "array",
    "items": {
      "enum": ["performance", "security", "build-size", "compatibility"]
    },
    "description": "最適化の目標"
  }
}
```

### Response

設定の分析結果、問題点の指摘、最適化提案を含むレポート。

---

# Error Codes

## 共通エラーコード

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | JSON-RPC パースエラー |
| -32600 | Invalid Request | 無効なリクエスト形式 |
| -32601 | Method not found | 存在しないメソッド |
| -32602 | Invalid params | 無効なパラメータ |
| -32603 | Internal error | 内部サーバーエラー |

## Expo MCP 固有エラー

| Code | Message | Description |
|------|---------|-------------|
| -32000 | Rate limit exceeded | レート制限超過 |
| -32001 | Invalid URL | 無効なURL形式 |
| -32002 | Document not found | ドキュメントが見つからない |
| -32003 | Search timeout | 検索タイムアウト |
| -32004 | Invalid module name | 無効なモジュール名 |
| -32005 | SDK version not supported | サポートされていないSDKバージョン |

---

# Rate Limits

## デフォルト制限

- **セッションあたり**: 2,000 requests/hour
- **同時セッション**: 200 sessions
- **セッションタイムアウト**: 60 minutes

## HTTP エンドポイント制限

- **GET /health**: 100 requests/minute
- **POST /mcp**: 1,000 requests/hour
- **GET /mcp/stream**: 10 connections/IP

---

# Response Times

## パフォーマンス目標

| Operation | Target Time | Max Time |
|-----------|------------|----------|
| Tool call | < 500ms | 5s |
| Resource read | < 200ms | 2s |
| Prompt generation | < 100ms | 1s |
| Search | < 1s | 10s |

---

# Changelog

## Version 1.0.0 (2024-12-01)

- Initial release
- All MCP tools, resources, and prompts implemented
- Full expo.yaml specification compliance
- HTTP + stdio transport support
- Security and rate limiting features

---

*最終更新: 2024年12月* 