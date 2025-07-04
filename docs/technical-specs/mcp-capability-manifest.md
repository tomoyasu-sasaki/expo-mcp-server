# Expo MCP Server Capability Manifest

## 📋 概要

Expo MCP ServerのMCP Protocol準拠capability manifestです。このマニフェストは、MCPクライアント（Cursor、Claude Desktop等）がサーバーの機能を理解・統合するために使用されます。

## 🚀 MCP Capability Manifest

### JSON形式マニフェスト
```json
{
  "$schema": "https://spec.modelcontextprotocol.io/schema/2024-11-05/manifest.json",
  "manifest_version": "2024-11-05",
  "server_info": {
    "name": "expo-mcp-server",
    "version": "1.0.0",
    "description": "Model Context Protocol (MCP) サーバーの実装。Expo ドキュメント、API リファレンス、コミュニティリソースからコンテンツを取得・インデックス化・検索し、Cursor や他の開発者ツールでMCPプロトコル経由で利用可能にします。",
    "author": "Expo DevRel Team",
    "homepage": "https://github.com/expo/expo-mcp-server",
    "license": "MIT",
    "contact": {
      "email": "expo-mcp@expo.dev",
      "url": "https://expo.dev/contact"
    }
  },
  "protocol": {
    "version": "2024-11-05",
    "specification_url": "https://spec.modelcontextprotocol.io/specification/"
  },
  "capabilities": {
    "tools": {
      "supported": true,
      "list_changed_notifications": true,
      "call_timeout_ms": 30000,
      "max_concurrent_calls": 10,
      "available_tools": [
        {
          "name": "expo_read_document",
          "description": "Expoドキュメント、APIリファレンス、ガイドを取得",
          "category": "documentation",
          "tags": ["expo", "docs", "api", "reference"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_read_document.json"
          },
          "output_format": "markdown",
          "examples": [
            {
              "description": "Expo Router ガイドを取得",
              "input": {
                "url": "https://docs.expo.dev/router/introduction/",
                "doc_type": "guide",
                "format": "markdown"
              }
            }
          ]
        },
        {
          "name": "expo_search_documents",
          "description": "Expoエコシステム全体でコンテンツ検索",
          "category": "search",
          "tags": ["expo", "search", "docs", "api", "examples"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_search_documents.json"
          },
          "output_format": "json",
          "search_capabilities": {
            "full_text_search": true,
            "semantic_search": true,
            "faceted_search": true,
            "autocomplete": true,
            "typo_tolerance": true
          },
          "examples": [
            {
              "description": "ナビゲーション関連ドキュメントを検索",
              "input": {
                "query": "navigation setup",
                "filters": {
                  "category": ["docs", "tutorials"],
                  "platform": ["ios", "android"]
                }
              }
            }
          ]
        },
        {
          "name": "expo_recommend",
          "description": "現在のコンテキストに基づく関連コンテンツ推薦",
          "category": "recommendation",
          "tags": ["expo", "recommendation", "ai", "context"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_recommend.json"
          },
          "output_format": "json",
          "ai_capabilities": {
            "context_understanding": true,
            "semantic_matching": true,
            "relevance_scoring": true,
            "personalization": false
          },
          "examples": [
            {
              "description": "ナビゲーション開発の推薦",
              "input": {
                "context": "I'm building a navigation system for my React Native app",
                "max_results": 5,
                "platform": "universal"
              }
            }
          ]
        },
        {
          "name": "expo_get_sdk_module",
          "description": "Expo SDK モジュールの詳細情報を取得",
          "category": "sdk",
          "tags": ["expo", "sdk", "module", "api"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_get_sdk_module.json"
          },
          "output_format": "json",
          "supported_versions": ["latest", "sdk-49", "sdk-48", "sdk-47"],
          "examples": [
            {
              "description": "Camera モジュール情報を取得",
              "input": {
                "module_name": "camera",
                "sdk_version": "latest",
                "include_examples": true
              }
            }
          ]
        },
        {
          "name": "expo_config_templates",
          "description": "Expo設定ファイルの生成と検証",
          "category": "configuration",
          "tags": ["expo", "config", "template", "validation"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_config_templates.json"
          },
          "output_format": "json",
          "supported_configs": ["app.json", "eas.json", "metro.config.js", "babel.config.js"],
          "examples": [
            {
              "description": "基本的なapp.json設定を生成",
              "input": {
                "template_type": "app.json",
                "project_context": {
                  "name": "my-expo-app",
                  "platforms": ["ios", "android"]
                }
              }
            }
          ]
        },
        {
          "name": "expo_eas_command_builder",
          "description": "EAS CLI コマンドをコンテキストに基づいて生成",
          "category": "build",
          "tags": ["expo", "eas", "build", "cli", "deployment"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_eas_command_builder.json"
          },
          "output_format": "text",
          "supported_operations": ["build", "submit", "update", "credentials", "device", "metadata"],
          "examples": [
            {
              "description": "プロダクションビルドコマンドを生成",
              "input": {
                "operation": "build",
                "platform": "all",
                "profile": "production"
              }
            }
          ]
        },
        {
          "name": "expo_code_examples",
          "description": "実行可能なコード例とSnack統合を提供",
          "category": "examples",
          "tags": ["expo", "code", "examples", "snack", "samples"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_code_examples.json"
          },
          "output_format": "json",
          "code_features": {
            "syntax_highlighting": true,
            "runnable_examples": true,
            "snack_integration": true,
            "dependency_management": true
          },
          "examples": [
            {
              "description": "カメラ機能のコード例を取得",
              "input": {
                "pattern": "camera capture",
                "language": "typescript",
                "include_snack": true
              }
            }
          ]
        },
        {
          "name": "expo_error_diagnosis",
          "description": "一般的なExpoエラーの分析と解決策提供",
          "category": "troubleshooting",
          "tags": ["expo", "error", "diagnosis", "troubleshooting", "support"],
          "input_schema": {
            "$ref": "https://expo.dev/schemas/mcp/tools/expo_error_diagnosis.json"
          },
          "output_format": "json",
          "error_categories": ["build", "runtime", "metro", "eas", "expo_cli", "dependency"],
          "examples": [
            {
              "description": "ビルドエラーの診断",
              "input": {
                "error_message": "Build failed with exit code 65",
                "error_type": "build",
                "platform": "ios"
              }
            }
          ]
        }
      ]
    },
    "resources": {
      "supported": true,
      "subscribe_notifications": true,
      "read_timeout_ms": 10000,
      "max_concurrent_reads": 20,
      "available_resources": [
        {
          "uri_template": "expo://docs/{path+}",
          "name": "Expo Documentation",
          "description": "Expo公式ドキュメント",
          "mime_type": "text/markdown",
          "caching": {
            "enabled": true,
            "ttl_seconds": 3600
          },
          "examples": [
            "expo://docs/get-started/introduction",
            "expo://docs/versions/latest/sdk/camera",
            "expo://docs/router/introduction"
          ]
        },
        {
          "uri_template": "expo://api/{module}",
          "name": "Expo API Reference",
          "description": "Expo SDK APIリファレンス",
          "mime_type": "application/json",
          "metadata": {
            "supports_versioning": true,
            "latest_version": "49.0.0"
          },
          "examples": [
            "expo://api/camera",
            "expo://api/notifications",
            "expo://api/location"
          ]
        },
        {
          "uri_template": "expo://examples/{category}",
          "name": "Code Examples",
          "description": "コード例とサンプル",
          "mime_type": "application/json",
          "features": {
            "runnable": true,
            "snack_compatible": true
          },
          "examples": [
            "expo://examples/navigation",
            "expo://examples/camera",
            "expo://examples/notifications"
          ]
        },
        {
          "uri_template": "expo://config/{type}",
          "name": "Configuration Templates",
          "description": "設定ファイルテンプレート",
          "mime_type": "application/json",
          "supported_types": ["app.json", "eas.json", "metro.config.js"],
          "examples": [
            "expo://config/app.json",
            "expo://config/eas.json",
            "expo://config/metro.config.js"
          ]
        },
        {
          "uri_template": "expo://eas/{command}",
          "name": "EAS Commands",
          "description": "EAS CLIコマンドリファレンス",
          "mime_type": "text/plain",
          "command_types": ["build", "submit", "update", "credentials"],
          "examples": [
            "expo://eas/build",
            "expo://eas/submit",
            "expo://eas/update"
          ]
        }
      ]
    },
    "prompts": {
      "supported": true,
      "list_changed_notifications": true,
      "get_timeout_ms": 5000,
      "max_concurrent_gets": 5,
      "available_prompts": [
        {
          "name": "expo_setup_helper",
          "description": "Expoプロジェクトセットアップ支援",
          "category": "setup",
          "parameters": [
            {
              "name": "project_type",
              "description": "プロジェクトタイプ",
              "required": true,
              "type": "string",
              "enum": ["bare", "managed", "expo-router"]
            },
            {
              "name": "platforms",
              "description": "対象プラットフォーム",
              "required": true,
              "type": "array",
              "items": {
                "enum": ["ios", "android", "web"]
              }
            }
          ],
          "examples": [
            {
              "description": "React NativeアプリのExpo Router セットアップ",
              "input": {
                "project_type": "expo-router",
                "platforms": ["ios", "android"]
              }
            }
          ]
        },
        {
          "name": "expo_error_helper",
          "description": "Expoエラー解決支援",
          "category": "troubleshooting",
          "parameters": [
            {
              "name": "error_context",
              "description": "エラーの詳細情報",
              "required": true,
              "type": "object"
            },
            {
              "name": "user_experience",
              "description": "ユーザーの経験レベル",
              "required": false,
              "type": "string",
              "enum": ["beginner", "intermediate", "advanced"]
            }
          ],
          "examples": [
            {
              "description": "ビルドエラーの解決支援",
              "input": {
                "error_context": {
                  "type": "build_error",
                  "platform": "ios",
                  "message": "Code signing error"
                },
                "user_experience": "intermediate"
              }
            }
          ]
        },
        {
          "name": "expo_api_helper",
          "description": "Expo API使用方法ガイダンス",
          "category": "api_guidance",
          "parameters": [
            {
              "name": "api_module",
              "description": "使用したいAPIモジュール",
              "required": true,
              "type": "string"
            },
            {
              "name": "use_case",
              "description": "使用したい機能・ユースケース",
              "required": true,
              "type": "string"
            },
            {
              "name": "code_style",
              "description": "コードスタイル",
              "required": false,
              "type": "string",
              "enum": ["typescript", "javascript"]
            }
          ],
          "examples": [
            {
              "description": "Camera APIを使った写真撮影機能の実装ガイド",
              "input": {
                "api_module": "expo-camera",
                "use_case": "photo capture with preview",
                "code_style": "typescript"
              }
            }
          ]
        },
        {
          "name": "expo_config_analyzer",
          "description": "Expo設定ファイル分析・最適化提案",
          "category": "configuration",
          "parameters": [
            {
              "name": "config_content",
              "description": "設定ファイルの内容",
              "required": true,
              "type": "object"
            },
            {
              "name": "analysis_type",
              "description": "分析タイプ",
              "required": false,
              "type": "string",
              "enum": ["validation", "optimization", "migration"]
            }
          ],
          "examples": [
            {
              "description": "app.json設定の最適化提案",
              "input": {
                "config_content": {
                  "expo": {
                    "name": "MyApp",
                    "version": "1.0.0"
                  }
                },
                "analysis_type": "optimization"
              }
            }
          ]
        }
      ]
    },
    "logging": {
      "supported": true,
      "level_configuration": true,
      "available_levels": ["error", "warn", "info", "debug", "trace"]
    },
    "experimental": {
      "custom_transport": false,
      "streaming_responses": true,
      "batch_requests": false
    }
  },
  "transport": {
    "stdio": {
      "supported": true,
      "default": true,
      "configuration": {
        "encoding": "utf-8",
        "line_delimited": true,
        "max_message_size_bytes": 1048576
      }
    },
    "http": {
      "supported": true,
      "configuration": {
        "default_port": 3000,
        "cors_enabled": true,
        "websocket_upgrade": true,
        "sse_support": true,
        "max_concurrent_connections": 100
      }
    }
  },
  "security": {
    "authentication": {
      "supported": true,
      "methods": ["api_key", "bearer_token"],
      "optional": true
    },
    "authorization": {
      "supported": true,
      "role_based": false,
      "resource_based": false
    },
    "input_validation": {
      "json_schema": true,
      "sanitization": true,
      "size_limits": true
    },
    "rate_limiting": {
      "per_session": true,
      "per_tool": false,
      "configurable": true
    }
  },
  "performance": {
    "caching": {
      "memory": true,
      "redis": true,
      "configurable_ttl": true
    },
    "concurrent_processing": {
      "tools": 10,
      "resources": 20,
      "prompts": 5
    },
    "response_times": {
      "target_p95_ms": {
        "tools": 500,
        "resources": 200,
        "prompts": 1000
      }
    }
  },
  "monitoring": {
    "metrics": {
      "prometheus": true,
      "custom": false
    },
    "health_check": {
      "endpoint": "/health",
      "detailed": true
    },
    "tracing": {
      "supported": false,
      "opentelemetry": false
    }
  },
  "deployment": {
    "docker": {
      "supported": true,
      "image": "expo/mcp-server:latest",
      "multi_arch": ["amd64", "arm64"]
    },
    "npm": {
      "supported": true,
      "package": "@expo/mcp-server",
      "global_install": true
    },
    "binary": {
      "supported": false,
      "platforms": []
    }
  },
  "documentation": {
    "api_reference": "https://github.com/expo/expo-mcp-server/blob/main/docs/api-reference.md",
    "user_guide": "https://github.com/expo/expo-mcp-server/blob/main/docs/installation-guide.md",
    "examples": "https://github.com/expo/expo-mcp-server/tree/main/examples",
    "changelog": "https://github.com/expo/expo-mcp-server/blob/main/CHANGELOG.md"
  },
  "support": {
    "community": {
      "github_issues": "https://github.com/expo/expo-mcp-server/issues",
      "discussions": "https://github.com/expo/expo-mcp-server/discussions"
    },
    "commercial": {
      "email": "expo-mcp@expo.dev",
      "sla": false
    }
  },
  "compliance": {
    "mcp_specification": "2024-11-05",
    "json_rpc": "2.0",
    "openapi": "3.0.3"
  }
}
```

## 🎯 クライアント統合例

### Cursor IDE 設定
```json
{
  "mcpServers": {
    "expo": {
      "command": "npx",
      "args": ["@expo/mcp-server", "--stdio"],
      "env": {
        "EXPO_MCP_CACHE_SIZE": "512",
        "EXPO_MCP_LOG_LEVEL": "info"
      },
      "capabilities": {
        "tools": true,
        "resources": true,
        "prompts": true
      }
    }
  }
}
```

### Claude Desktop 設定
```json
{
  "mcpServers": {
    "expo-mcp-server": {
      "command": "node",
      "args": ["/path/to/expo-mcp-server/dist/index.js", "--stdio"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### VS Code Extension設定
```json
{
  "mcp.servers": [
    {
      "name": "Expo MCP Server",
      "transport": "stdio",
      "command": "npx @expo/mcp-server --stdio",
      "capabilities": [
        "tools",
        "resources", 
        "prompts"
      ],
      "config": {
        "timeout": 30000,
        "retries": 3
      }
    }
  ]
}
```

## 🔧 機能検証スクリプト

### Capability Testing
```typescript
// capability-test.ts
import { MCPClient } from '@modelcontextprotocol/client';

async function testCapabilities() {
  const client = new MCPClient();
  
  // 初期化
  const initResult = await client.initialize({
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  });
  
  console.log('Server capabilities:', initResult.capabilities);
  
  // ツール一覧取得
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));
  
  // リソース一覧取得
  const resources = await client.listResources();
  console.log('Available resources:', resources.resources.map(r => r.uri));
  
  // プロンプト一覧取得
  const prompts = await client.listPrompts();
  console.log('Available prompts:', prompts.prompts.map(p => p.name));
  
  // ツール実行テスト
  const searchResult = await client.callTool({
    name: 'expo_search_documents',
    arguments: {
      query: 'navigation',
      filters: {
        category: ['docs']
      }
    }
  });
  
  console.log('Search completed:', searchResult.isError ? 'Failed' : 'Success');
}

testCapabilities().catch(console.error);
```

## 📊 互換性マトリックス

### MCPクライアント互換性
```yaml
client_compatibility:
  cursor_ide:
    version: ">=0.42.0"
    status: "fully_supported"
    features: ["tools", "resources", "prompts", "notifications"]
    
  claude_desktop:
    version: ">=1.0.0"
    status: "fully_supported"
    features: ["tools", "resources", "prompts"]
    
  vscode_extension:
    version: ">=0.1.0"
    status: "beta"
    features: ["tools", "resources"]
    
  custom_clients:
    mcp_sdk_js:
      version: ">=1.0.0"
      status: "fully_supported"
    mcp_sdk_python:
      version: ">=1.0.0"
      status: "partially_supported"
      limitations: ["prompts not tested"]
```

### プロトコルバージョン対応
```yaml
protocol_versions:
  "2024-11-05":
    status: "fully_supported"
    features: "all"
  "2024-10-07":
    status: "deprecated"
    features: "limited"
    migration_guide: "docs/migration-guide.md"
```

## 🚀 自動検証

### CI/CDパイプライン
```yaml
# .github/workflows/capability-validation.yml
name: MCP Capability Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate-manifest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate MCP Manifest
        run: |
          npx @modelcontextprotocol/cli validate \
            --manifest docs/mcp-capability-manifest.json \
            --server-command "npm run mcp:stdio"
      
      - name: Test Tool Execution
        run: |
          npm run test:capability-tools
      
      - name: Test Resource Access
        run: |
          npm run test:capability-resources
      
      - name: Test Prompt Generation
        run: |
          npm run test:capability-prompts
```

## 📚 参考資料

### MCP仕様
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/specification/)
- [MCP Capability Manifest Schema](https://spec.modelcontextprotocol.io/schema/2024-11-05/manifest.json)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

### クライアント統合
- [Cursor MCP Integration](https://docs.cursor.com/mcp)
- [Claude Desktop MCP Setup](https://docs.anthropic.com/claude/desktop/mcp)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)

---

**🔄 自動同期**: このマニフェストはサーバー実装と自動同期されます。

**📧 統合サポート**: MCP統合に関するサポートは mcp-integration@expo.dev までお寄せください。 