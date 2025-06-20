# Expo MCP Server JSON Schema 定義書

## 📋 概要

このドキュメントは、Expo MCP Serverで使用される全てのJSON Schemaを定義しています。これらのスキーマは、入力検証、設定ファイル検証、API仕様確認に使用されます。

## 🛠️ MCPツール入力スキーマ

### expo_read_document

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_read_document.json",
  "title": "Expo Read Document Tool Schema",
  "description": "Expoドキュメント、APIリファレンス、ガイドを取得するツールの入力スキーマ",
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "format": "uri",
      "description": "取得するドキュメントのURL",
      "pattern": "^https?://(docs\\.expo\\.dev|api\\.expo\\.dev|github\\.com/expo)/.*",
      "examples": [
        "https://docs.expo.dev/get-started/introduction/",
        "https://docs.expo.dev/versions/latest/sdk/camera/"
      ]
    },
    "doc_type": {
      "type": "string",
      "enum": ["guide", "api", "tutorial", "reference"],
      "description": "ドキュメントの種類",
      "default": "guide"
    },
    "format": {
      "type": "string",
      "enum": ["markdown", "html", "json"],
      "description": "取得するコンテンツの形式",
      "default": "markdown"
    },
    "include_metadata": {
      "type": "boolean",
      "description": "メタデータを含めるかどうか",
      "default": false
    }
  },
  "required": ["url"],
  "additionalProperties": false
}
```

### expo_search_documents

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_search_documents.json",
  "title": "Expo Search Documents Tool Schema",
  "description": "Expoエコシステム全体でコンテンツ検索を行うツールの入力スキーマ",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "検索クエリ",
      "minLength": 1,
      "maxLength": 500,
      "pattern": "^[a-zA-Z0-9\\s\\-_\\.\\+\\#\\@\\/\\?\\&\\=\\(\\)\\[\\]\\{\\}]+$",
      "examples": [
        "navigation",
        "push notifications",
        "expo router setup"
      ]
    },
    "filters": {
      "type": "object",
      "description": "検索フィルタ",
      "properties": {
        "category": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["docs", "api", "examples", "tutorials", "guides"]
          },
          "description": "コンテンツカテゴリ",
          "uniqueItems": true
        },
        "platform": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["ios", "android", "web", "universal"]
          },
          "description": "対象プラットフォーム",
          "uniqueItems": true
        },
        "sdk_version": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^(latest|sdk-\\d+)$",
            "examples": ["latest", "sdk-49", "sdk-48"]
          },
          "description": "Expo SDKバージョン",
          "uniqueItems": true
        },
        "module_type": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["core", "community", "deprecated", "experimental"]
          },
          "description": "モジュールタイプ",
          "uniqueItems": true
        },
        "language": {
          "type": "string",
          "enum": ["en", "ja", "es", "fr", "de"],
          "description": "言語",
          "default": "en"
        }
      },
      "additionalProperties": false
    },
    "sort": {
      "type": "object",
      "description": "ソート設定",
      "properties": {
        "by": {
          "type": "string",
          "enum": ["relevance", "popularity", "date", "title"],
          "description": "ソート基準",
          "default": "relevance"
        },
        "order": {
          "type": "string",
          "enum": ["asc", "desc"],
          "description": "ソート順序",
          "default": "desc"
        }
      },
      "additionalProperties": false
    },
    "pagination": {
      "type": "object",
      "description": "ページネーション設定",
      "properties": {
        "page": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "description": "ページ番号",
          "default": 1
        },
        "per_page": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50,
          "description": "1ページあたりの結果数",
          "default": 10
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["query"],
  "additionalProperties": false
}
```

### expo_recommend

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_recommend.json",
  "title": "Expo Recommend Tool Schema",
  "description": "現在のコンテキストに基づく関連コンテンツ推薦ツールの入力スキーマ",
  "type": "object",
  "properties": {
    "context": {
      "type": "string",
      "description": "推薦のベースとなるコンテキスト",
      "minLength": 10,
      "maxLength": 1000,
      "examples": [
        "I'm building a navigation system for my React Native app",
        "Setting up push notifications for iOS and Android"
      ]
    },
    "max_results": {
      "type": "integer",
      "minimum": 1,
      "maximum": 20,
      "description": "最大推薦結果数",
      "default": 5
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web", "universal"],
      "description": "対象プラットフォーム",
      "default": "universal"
    },
    "experience_level": {
      "type": "string",
      "enum": ["beginner", "intermediate", "advanced"],
      "description": "ユーザーの経験レベル",
      "default": "intermediate"
    },
    "content_types": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["docs", "api", "examples", "tutorials", "libraries"]
      },
      "description": "推薦するコンテンツタイプ",
      "uniqueItems": true,
      "default": ["docs", "examples"]
    }
  },
  "required": ["context"],
  "additionalProperties": false
}
```

### expo_get_sdk_module

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_get_sdk_module.json",
  "title": "Expo SDK Module Tool Schema",
  "description": "Expo SDKモジュールの詳細情報を取得するツールの入力スキーマ",
  "type": "object",
  "properties": {
    "module_name": {
      "type": "string",
      "description": "Expo SDKモジュール名",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "minLength": 2,
      "maxLength": 50,
      "examples": [
        "camera",
        "notifications",
        "expo-router",
        "expo-location"
      ]
    },
    "sdk_version": {
      "type": "string",
      "description": "Expo SDKバージョン",
      "pattern": "^(latest|sdk-\\d+)$",
      "default": "latest",
      "examples": ["latest", "sdk-49", "sdk-48"]
    },
    "include_examples": {
      "type": "boolean",
      "description": "コード例を含めるかどうか",
      "default": true
    },
    "include_changelog": {
      "type": "boolean",
      "description": "変更履歴を含めるかどうか",
      "default": false
    },
    "platform_specific": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["ios", "android", "web"]
      },
      "description": "プラットフォーム固有情報を取得",
      "uniqueItems": true
    }
  },
  "required": ["module_name"],
  "additionalProperties": false
}
```

### expo_config_templates

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_config_templates.json",
  "title": "Expo Config Templates Tool Schema",
  "description": "Expo設定ファイルの生成と検証ツールの入力スキーマ",
  "type": "object",
  "properties": {
    "template_type": {
      "type": "string",
      "enum": ["app.json", "eas.json", "metro.config.js", "babel.config.js"],
      "description": "生成する設定ファイルのタイプ"
    },
    "project_context": {
      "type": "object",
      "description": "プロジェクトコンテキスト",
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-zA-Z0-9_-]+$",
          "minLength": 1,
          "maxLength": 50,
          "description": "プロジェクト名"
        },
        "platforms": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["ios", "android", "web"]
          },
          "description": "対象プラットフォーム",
          "uniqueItems": true,
          "minItems": 1
        },
        "sdk_version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$",
          "description": "Expo SDKバージョン",
          "examples": ["49.0.0", "48.0.0"]
        },
        "typescript": {
          "type": "boolean",
          "description": "TypeScriptを使用するかどうか",
          "default": true
        },
        "features": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["notifications", "location", "camera", "auth", "payments"]
          },
          "description": "使用予定の機能",
          "uniqueItems": true
        }
      },
      "required": ["name", "platforms"],
      "additionalProperties": false
    },
    "validation_only": {
      "type": "boolean",
      "description": "検証のみ実行（生成しない）",
      "default": false
    },
    "existing_config": {
      "type": "object",
      "description": "既存の設定ファイル（検証用）"
    }
  },
  "required": ["template_type"],
  "additionalProperties": false
}
```

### expo_eas_command_builder

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_eas_command_builder.json",
  "title": "Expo EAS Command Builder Tool Schema",
  "description": "EAS CLIコマンドをコンテキストに基づいて生成するツールの入力スキーマ",
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["build", "submit", "update", "credentials", "device", "metadata"],
      "description": "EAS操作タイプ"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "all"],
      "description": "対象プラットフォーム",
      "default": "all"
    },
    "profile": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$",
      "description": "ビルドプロファイル名",
      "default": "development",
      "examples": ["development", "preview", "production"]
    },
    "options": {
      "type": "object",
      "description": "追加オプション",
      "properties": {
        "auto_submit": {
          "type": "boolean",
          "description": "自動提出設定",
          "default": false
        },
        "clear_cache": {
          "type": "boolean",
          "description": "キャッシュクリア",
          "default": false
        },
        "local": {
          "type": "boolean",
          "description": "ローカルビルド",
          "default": false
        },
        "json": {
          "type": "boolean",
          "description": "JSON出力",
          "default": false
        }
      },
      "additionalProperties": false
    },
    "environment": {
      "type": "object",
      "description": "環境変数",
      "patternProperties": {
        "^[A-Z_][A-Z0-9_]*$": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["operation"],
  "additionalProperties": false
}
```

### expo_code_examples

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_code_examples.json",
  "title": "Expo Code Examples Tool Schema",
  "description": "実行可能なコード例とSnack統合を提供するツールの入力スキーマ",
  "type": "object",
  "properties": {
    "pattern": {
      "type": "string",
      "description": "コード例のパターンまたは機能名",
      "minLength": 1,
      "maxLength": 100,
      "examples": [
        "camera capture",
        "navigation stack",
        "push notifications setup"
      ]
    },
    "language": {
      "type": "string",
      "enum": ["typescript", "javascript"],
      "description": "プログラミング言語",
      "default": "typescript"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web", "universal"],
      "description": "対象プラットフォーム",
      "default": "universal"
    },
    "complexity": {
      "type": "string",
      "enum": ["basic", "intermediate", "advanced"],
      "description": "コード例の複雑さ",
      "default": "basic"
    },
    "include_snack": {
      "type": "boolean",
      "description": "Snackリンクを含めるかどうか",
      "default": true
    },
    "dependencies": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9@/_-]+$"
      },
      "description": "必要な依存関係",
      "uniqueItems": true
    }
  },
  "required": ["pattern"],
  "additionalProperties": false
}
```

### expo_error_diagnosis

#### スキーマ定義
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/tools/expo_error_diagnosis.json",
  "title": "Expo Error Diagnosis Tool Schema",
  "description": "一般的なExpoエラーの分析と解決策提供ツールの入力スキーマ",
  "type": "object",
  "properties": {
    "error_message": {
      "type": "string",
      "description": "エラーメッセージ",
      "minLength": 5,
      "maxLength": 2000,
      "examples": [
        "Metro bundler failed to start",
        "Build failed with exit code 65"
      ]
    },
    "error_type": {
      "type": "string",
      "enum": ["build", "runtime", "metro", "eas", "expo_cli", "dependency"],
      "description": "エラーの種類"
    },
    "platform": {
      "type": "string",
      "enum": ["ios", "android", "web"],
      "description": "エラーが発生したプラットフォーム"
    },
    "context": {
      "type": "object",
      "description": "エラー発生時のコンテキスト",
      "properties": {
        "expo_version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$",
          "description": "Expo SDKバージョン"
        },
        "node_version": {
          "type": "string",
          "pattern": "^v?\\d+\\.\\d+\\.\\d+$",
          "description": "Node.jsバージョン"
        },
        "platform_version": {
          "type": "string",
          "description": "プラットフォームバージョン（iOS/Android）"
        },
        "command": {
          "type": "string",
          "description": "実行していたコマンド",
          "maxLength": 200
        },
        "stack_trace": {
          "type": "string",
          "description": "スタックトレース",
          "maxLength": 5000
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["error_message"],
  "additionalProperties": false
}
```

## ⚙️ 設定ファイルスキーマ

### MCP Configuration Schema

#### メイン設定スキーマ
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/mcp/config.json",
  "title": "Expo MCP Server Configuration Schema",
  "description": "Expo MCP Serverのメイン設定ファイルスキーマ",
  "type": "object",
  "properties": {
    "$schema": {
      "type": "string",
      "format": "uri"
    },
    "name": {
      "type": "string",
      "description": "サーバー名",
      "default": "expo-mcp-server"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "サーバーバージョン"
    },
    "description": {
      "type": "string",
      "description": "サーバーの説明"
    },
    "protocol": {
      "type": "object",
      "description": "MCPプロトコル設定",
      "properties": {
        "version": {
          "type": "string",
          "enum": ["2024-11-05"],
          "description": "MCPプロトコルバージョン"
        },
        "transports": {
          "type": "object",
          "properties": {
            "stdio": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                },
                "encoding": {
                  "type": "string",
                  "enum": ["utf-8"],
                  "default": "utf-8"
                },
                "timeout_ms": {
                  "type": "integer",
                  "minimum": 1000,
                  "maximum": 30000,
                  "default": 5000
                },
                "max_message_size_bytes": {
                  "type": "integer",
                  "minimum": 1024,
                  "maximum": 10485760,
                  "default": 1048576
                }
              },
              "additionalProperties": false
            },
            "http": {
              "type": "object",
              "properties": {
                "enabled": {
                  "type": "boolean",
                  "default": true
                },
                "port": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 65535,
                  "default": 3000
                },
                "cors_enabled": {
                  "type": "boolean",
                  "default": true
                },
                "timeout_ms": {
                  "type": "integer",
                  "minimum": 1000,
                  "maximum": 60000,
                  "default": 30000
                },
                "websocket_upgrade": {
                  "type": "boolean",
                  "default": true
                }
              },
              "additionalProperties": false
            }
          },
          "additionalProperties": false
        }
      },
      "required": ["version", "transports"],
      "additionalProperties": false
    },
    "security": {
      "type": "object",
      "description": "セキュリティ設定",
      "properties": {
        "input_validation": {
          "type": "object",
          "properties": {
            "max_tool_args_size_bytes": {
              "type": "integer",
              "minimum": 512,
              "maximum": 10240,
              "default": 2048
            },
            "max_resource_uri_length": {
              "type": "integer",
              "minimum": 100,
              "maximum": 2048,
              "default": 512
            },
            "sanitize_file_paths": {
              "type": "boolean",
              "default": true
            },
            "validate_json_schema": {
              "type": "boolean",
              "default": true
            },
            "prevent_code_injection": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": false
        },
        "access_control": {
          "type": "object",
          "properties": {
            "allowed_hosts": {
              "type": "array",
              "items": {
                "type": "string",
                "format": "hostname"
              },
              "description": "許可されたホスト"
            },
            "rate_limit_per_session": {
              "type": "integer",
              "minimum": 100,
              "maximum": 10000,
              "default": 2000
            },
            "session_timeout_minutes": {
              "type": "integer",
              "minimum": 5,
              "maximum": 240,
              "default": 60
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "performance": {
      "type": "object",
      "description": "パフォーマンス設定",
      "properties": {
        "cache": {
          "type": "object",
          "properties": {
            "memory": {
              "type": "object",
              "properties": {
                "max_size_mb": {
                  "type": "integer",
                  "minimum": 50,
                  "maximum": 2048,
                  "default": 200
                },
                "ttl_seconds": {
                  "type": "integer",
                  "minimum": 60,
                  "maximum": 3600,
                  "default": 300
                }
              },
              "additionalProperties": false
            }
          },
          "additionalProperties": false
        },
        "targets": {
          "type": "object",
          "properties": {
            "p95_stdio_latency_ms": {
              "type": "integer",
              "minimum": 10,
              "maximum": 1000,
              "default": 50
            },
            "p95_search_latency_ms": {
              "type": "integer",
              "minimum": 50,
              "maximum": 5000,
              "default": 100
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["name", "version", "protocol"],
  "additionalProperties": false
}
```

## 📊 APIレスポンススキーマ

### 検索結果スキーマ
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://expo.dev/schemas/api/search_result.json",
  "title": "Search Result Schema",
  "description": "検索結果のレスポンススキーマ",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "検索クエリ"
    },
    "total_count": {
      "type": "integer",
      "minimum": 0,
      "description": "総結果数"
    },
    "page": {
      "type": "integer",
      "minimum": 1,
      "description": "現在のページ"
    },
    "per_page": {
      "type": "integer",
      "minimum": 1,
      "description": "1ページあたりの結果数"
    },
    "search_time_ms": {
      "type": "number",
      "minimum": 0,
      "description": "検索実行時間（ミリ秒）"
    },
    "results": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/SearchResultItem"
      },
      "description": "検索結果アイテム"
    },
    "facets": {
      "type": "object",
      "description": "ファセット情報",
      "properties": {
        "categories": {
          "type": "object",
          "patternProperties": {
            "^[a-z]+$": {
              "type": "integer",
              "minimum": 0
            }
          }
        },
        "platforms": {
          "type": "object",
          "patternProperties": {
            "^[a-z]+$": {
              "type": "integer",
              "minimum": 0
            }
          }
        }
      },
      "additionalProperties": false
    }
  },
  "definitions": {
    "SearchResultItem": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "結果ID"
        },
        "title": {
          "type": "string",
          "description": "タイトル"
        },
        "url": {
          "type": "string",
          "format": "uri",
          "description": "URL"
        },
        "content": {
          "type": "string",
          "description": "コンテンツ抜粋"
        },
        "category": {
          "type": "string",
          "enum": ["docs", "api", "examples", "tutorials"],
          "description": "カテゴリ"
        },
        "platform": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["ios", "android", "web", "universal"]
          },
          "description": "対応プラットフォーム"
        },
        "sdk_version": {
          "type": "string",
          "description": "対応SDKバージョン"
        },
        "score": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "関連度スコア"
        },
        "highlighted": {
          "type": "object",
          "description": "ハイライト情報",
          "properties": {
            "title": {
              "type": "string"
            },
            "content": {
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "required": ["id", "title", "url", "category", "score"],
      "additionalProperties": false
    }
  },
  "required": ["query", "total_count", "results"],
  "additionalProperties": false
}
```

## 🔧 スキーマ検証ツール

### 実装例
```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// スキーマ検証クラス
export class SchemaValidator {
  private ajv: Ajv;
  
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      strict: false,
      removeAdditional: true
    });
    addFormats(this.ajv);
    
    // カスタムフォーマット追加
    this.ajv.addFormat('hostname', {
      type: 'string',
      validate: (data: string) => /^[a-zA-Z0-9.-]+$/.test(data)
    });
  }
  
  validateToolInput(toolName: string, input: any): ValidationResult {
    const schema = this.getToolSchema(toolName);
    const validate = this.ajv.compile(schema);
    const valid = validate(input);
    
    return {
      valid,
      errors: validate.errors || [],
      sanitizedInput: valid ? input : null
    };
  }
  
  private getToolSchema(toolName: string): object {
    // スキーマ定義を返す
    const schemas = {
      'expo_read_document': expoReadDocumentSchema,
      'expo_search_documents': expoSearchDocumentsSchema,
      // ... 他のスキーマ
    };
    
    return schemas[toolName] || {};
  }
}
```

## 📚 参考資料

### JSON Schema仕様
- [JSON Schema Draft-07](https://json-schema.org/draft-07/schema)
- [JSON Schema Validation](https://json-schema.org/draft-07/json-schema-validation.html)
- [AJV Documentation](https://ajv.js.org/)

### MCP Protocol仕様
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/specification/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

---

**🔄 自動更新**: このスキーマ定義書は、ソースコードの変更に応じて自動更新されます。

**📧 フィードバック**: スキーマに関するご質問や改善提案は schema@expo.dev までお寄せください。 