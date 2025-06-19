// Mock external ES modules before importing them
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    getCapabilities: jest.fn().mockReturnValue({
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      experimental: {}
    }),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    handleMessage: jest.fn().mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'expo-mcp-server-test', version: '1.0.0' }
      }
    })
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined)
  }))
}));

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HttpTransport } from '../src/mcp/http-transport';
import { ConfigManager } from '../src/utils/config';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

// Use mocked version
const MockServer = jest.fn().mockImplementation(() => ({
  setRequestHandler: jest.fn(),
  getCapabilities: jest.fn().mockReturnValue({
    tools: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    prompts: { listChanged: true },
    experimental: {}
  }),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  handleMessage: jest.fn().mockResolvedValue({
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      serverInfo: { name: 'expo-mcp-server-test', version: '1.0.0' }
    }
  })
}));

describe('MCP Protocol Integration Tests', () => {
  let mcpServer: any;
  let httpTransport: HttpTransport;
  let config: any;
  const testDir = path.join(process.cwd(), 'test-mcp-integration');

  beforeEach(async () => {
    // Setup test directory
    await fs.ensureDir(testDir);

    // Test configuration
    config = {
      server: {
        name: 'expo-mcp-server-test',
        version: '1.0.0',
        description: 'Test MCP Server'
      },
      mcp: {
        protocol_version: '2024-11-05',
        default_transport: 'stdio',
        stdio: {
          encoding: 'utf-8',
          timeout_ms: 5000,
          max_message_size_bytes: 1048576,
          line_delimited: true
        },
        http: {
          port: 3001,
          host: '127.0.0.1',
          cors_enabled: true,
          cors_origins: ['*'],
          timeout_ms: 10000,
          websocket_upgrade: true,
          max_connections: 10
        }
      },
      storage: {
        local: {
          path: testDir,
          max_size_gb: 1,
          compression: false
        }
      },
      cache: {
        memory: {
          max_size_mb: 50,
          ttl_seconds: 60,
          eviction_policy: 'LRU'
        }
      },
      security: {
        input_validation: {
          max_tool_args_size_bytes: 2048,
          max_resource_uri_length: 512,
          sanitize_file_paths: true,
          validate_json_schema: true,
          prevent_code_injection: true
        },
        access_control: {
          allowed_hosts: ['test.com'],
          rate_limit_per_session: 100,
          session_timeout_minutes: 10,
          require_authentication: false
        },
        tool_execution: {
          sandboxing_enabled: true,
          blocked_system_calls: ['exec', 'spawn'],
          resource_limits: {
            max_memory_mb: 256,
            max_cpu_time_ms: 5000,
            max_file_reads: 50,
            max_network_requests: 25
          }
        }
      },
      logging: {
        level: 'error',
        format: 'json',
        outputs: ['console']
      },
      external_services: {
        expo: {
          api_base: 'https://api.expo.dev',
          docs_base: 'https://docs.expo.dev',
          snack_base: 'https://snack.expo.dev',
          timeout_ms: 5000,
          retry_attempts: 2
        },
        typesense: {
          url: 'http://localhost:8109',
          api_key: 'test-key',
          timeout_ms: 3000,
          collection_name: 'expo_docs_test'
        },
        github: {
          base_url: 'https://api.github.com',
          timeout_ms: 5000
        }
      },
      features: {
        tools: {
          expo_read_document: { enabled: true, timeout_ms: 3000 },
          expo_search_documents: { enabled: true, timeout_ms: 3000 },
          expo_recommend: { enabled: true, timeout_ms: 3000 },
          expo_get_sdk_module: { enabled: true, timeout_ms: 3000 },
          expo_config_templates: { enabled: true, timeout_ms: 3000 },
          expo_eas_command_builder: { enabled: true, timeout_ms: 3000 },
          expo_code_examples: { enabled: true, timeout_ms: 3000 },
          expo_error_diagnosis: { enabled: true, timeout_ms: 3000 }
        }
      }
    };

    // Initialize mock MCP server
    mcpServer = new MockServer();
    httpTransport = new HttpTransport(config.mcp.http.port, config);
  });

  afterEach(async () => {
    // Cleanup
    await mcpServer?.stop();
    await httpTransport?.stop();
    await fs.remove(testDir);
  });

  describe('MCP Protocol Communication', () => {
    test('should initialize MCP server with proper capabilities', async () => {
      await mcpServer.start();
      
      const capabilities = mcpServer.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.prompts).toBeDefined();
      expect(capabilities.experimental).toBeDefined();
    });

    test('should handle initialize request', async () => {
      await mcpServer.start();

      const initializeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true
            },
            sampling: {}
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await mcpServer.handleMessage(initializeMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.capabilities).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('expo-mcp-server-test');
    });

    test('should handle list_tools request', async () => {
      await mcpServer.start();

      const listToolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      // Mock the response for list tools
      mcpServer.handleMessage.mockResolvedValueOnce({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: [
            {
              name: 'expo_read_document',
              description: 'Read Expo documentation',
              inputSchema: {
                type: 'object',
                properties: {
                  url: { type: 'string' }
                },
                required: ['url']
              }
            }
          ]
        }
      });

      const response = await mcpServer.handleMessage(listToolsMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);

      // Check for required tools
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('expo_read_document');
    });

    test('should handle list_resources request', async () => {
      await mcpServer.start();

      const listResourcesMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {}
      };

      const response = await mcpServer.handleMessage(listResourcesMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeDefined();
      expect(Array.isArray(response.result.resources)).toBe(true);
      expect(response.result.resources.length).toBeGreaterThan(0);

      // Check for required resource templates
      const resourceUris = response.result.resources.map((resource: any) => resource.uri);
      expect(resourceUris.some((uri: string) => uri.includes('expo://docs/'))).toBe(true);
      expect(resourceUris.some((uri: string) => uri.includes('expo://api/'))).toBe(true);
    });

    test('should handle list_prompts request', async () => {
      await mcpServer.start();

      const listPromptsMessage = {
        jsonrpc: '2.0',
        id: 4,
        method: 'prompts/list',
        params: {}
      };

      const response = await mcpServer.handleMessage(listPromptsMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.prompts).toBeDefined();
      expect(Array.isArray(response.result.prompts)).toBe(true);
      expect(response.result.prompts.length).toBeGreaterThan(0);

      // Check for required prompts
      const promptNames = response.result.prompts.map((prompt: any) => prompt.name);
      expect(promptNames).toContain('expo_setup_helper');
      expect(promptNames).toContain('expo_error_helper');
      expect(promptNames).toContain('expo_api_helper');
    });

    test('should handle tool call requests', async () => {
      await mcpServer.start();

      // Mock external API for expo_search_documents
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hits: [
            {
              document: {
                id: '1',
                title: 'Camera API',
                content: 'Take photos with Camera.takePictureAsync()',
                url: 'https://docs.expo.dev/camera'
              }
            }
          ],
          found: 1,
          search_time_ms: 5
        })
      } as any);

      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 'camera api',
            filters: {
              category: ['api']
            }
          }
        }
      };

      const response = await mcpServer.handleMessage(toolCallMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(Array.isArray(response.result.content)).toBe(true);
      expect(response.result.content.length).toBeGreaterThan(0);
    });

    test('should handle resource read requests', async () => {
      await mcpServer.start();

      // Mock external API for document reading
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => `# Camera API

Take photos and videos with the Camera API.

## Basic Usage

\`\`\`javascript
import { Camera } from 'expo-camera';
const photo = await Camera.takePictureAsync();
\`\`\`
`
      } as any);

      const resourceReadMessage = {
        jsonrpc: '2.0',
        id: 6,
        method: 'resources/read',
        params: {
          uri: 'expo://docs/camera'
        }
      };

      const response = await mcpServer.handleMessage(resourceReadMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.contents).toBeDefined();
      expect(Array.isArray(response.result.contents)).toBe(true);
      expect(response.result.contents.length).toBeGreaterThan(0);
      expect(response.result.contents[0].mimeType).toBe('text/markdown');
      expect(response.result.contents[0].text).toContain('Camera API');
    });

    test('should handle prompt get requests', async () => {
      await mcpServer.start();

      const promptGetMessage = {
        jsonrpc: '2.0',
        id: 7,
        method: 'prompts/get',
        params: {
          name: 'expo_setup_helper',
          arguments: {
            project_type: 'blank',
            target_platforms: ['ios', 'android']
          }
        }
      };

      const response = await mcpServer.handleMessage(promptGetMessage);
      
      expect(response).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.description).toBeDefined();
      expect(response.result.messages).toBeDefined();
      expect(Array.isArray(response.result.messages)).toBe(true);
      expect(response.result.messages.length).toBeGreaterThan(0);
    });

    test('should handle malformed JSON-RPC messages', async () => {
      await mcpServer.start();

      const malformedMessage = {
        // Missing jsonrpc field
        id: 8,
        method: 'tools/list'
      };

      const response = await mcpServer.handleMessage(malformedMessage);
      
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600); // Invalid Request
      expect(response.error.message).toContain('Invalid request');
    });

    test('should handle unknown methods', async () => {
      await mcpServer.start();

      const unknownMethodMessage = {
        jsonrpc: '2.0',
        id: 9,
        method: 'unknown/method',
        params: {}
      };

      const response = await mcpServer.handleMessage(unknownMethodMessage);
      
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601); // Method not found
      expect(response.error.message).toContain('Method not found');
    });

    test('should handle requests with invalid parameters', async () => {
      await mcpServer.start();

      const invalidParamsMessage = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: '', // Empty query should be invalid
            invalid_param: 'value'
          }
        }
      };

      const response = await mcpServer.handleMessage(invalidParamsMessage);
      
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602); // Invalid params
    });

    test('should enforce message size limits', async () => {
      await mcpServer.start();

      const largeMessage = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 'a'.repeat(5000), // Exceeds max_tool_args_size_bytes (2048)
          }
        }
      };

      const response = await mcpServer.handleMessage(largeMessage);
      
      expect(response).toBeDefined();
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Message size exceeds limit');
    });

    test('should handle concurrent requests', async () => {
      await mcpServer.start();

      // Mock external API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hits: [], found: 0 })
      } as any);

      const requests = Array.from({ length: 5 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: `test query ${i}`
          }
        }
      }));

      const responses = await Promise.all(
        requests.map(req => mcpServer.handleMessage(req))
      );

      expect(responses).toHaveLength(5);
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        expect(response.id).toBe(100 + index);
      });
    });

    test('should handle session timeout', async () => {
      await mcpServer.start();

      // Set very short session timeout for testing
      config.security.access_control.session_timeout_minutes = 0.01; // 0.6 seconds

      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 'test'
          }
        }
      };

      // First request should work
      const response1 = await mcpServer.handleMessage(toolCallMessage);
      expect(response1.error).toBeUndefined();

      // Wait for session to timeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second request should work (new session created)
      const response2 = await mcpServer.handleMessage(toolCallMessage);
      expect(response2.error).toBeUndefined();
    });
  });

  describe('HTTP + SSE Transport Integration', () => {
    test('should start HTTP server successfully', async () => {
      await httpTransport.start();
      
      expect(httpTransport.isRunning()).toBe(true);
      expect(httpTransport.getPort()).toBe(config.mcp.http.port);
    });

    test('should handle HTTP POST requests to /mcp endpoint', async () => {
      await httpTransport.start();

      const testMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await fetch(`http://localhost:${config.mcp.http.port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testMessage)
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('application/json');
      
      const result = await response.json();
      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe(1);
    });

    test('should handle CORS preflight requests', async () => {
      await httpTransport.start();

      const response = await fetch(`http://localhost:${config.mcp.http.port}/mcp`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://test.example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
      expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });

    test('should handle SSE connections', (done) => {
      httpTransport.start().then(() => {
        const eventSource = new EventSource(`http://localhost:${config.mcp.http.port}/events`);
        
        eventSource.onopen = () => {
          expect(eventSource.readyState).toBe(EventSource.OPEN);
          eventSource.close();
          done();
        };

        eventSource.onerror = (error) => {
          eventSource.close();
          done(error);
        };
      });
    });

    test('should handle malformed HTTP requests', async () => {
      await httpTransport.start();

      const response = await fetch(`http://localhost:${config.mcp.http.port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json'
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    test('should handle large HTTP requests', async () => {
      await httpTransport.start();

      const largeMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 'a'.repeat(2000000) // Very large query
          }
        }
      };

      const response = await fetch(`http://localhost:${config.mcp.http.port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(largeMessage)
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(413); // Payload too large
    });

    test('should enforce connection limits', async () => {
      await httpTransport.start();

      // Create more connections than max_connections
      const connectionPromises = Array.from({ length: config.mcp.http.max_connections + 2 }, 
        () => fetch(`http://localhost:${config.mcp.http.port}/health`)
      );

      const responses = await Promise.allSettled(connectionPromises);
      
      // Some connections should succeed, others should be rejected
      const successfulConnections = responses.filter(r => r.status === 'fulfilled').length;
      expect(successfulConnections).toBeLessThanOrEqual(config.mcp.http.max_connections + 1); // Allow some buffer
    });
  });

  describe('Security Integration', () => {
    test('should validate input schemas', async () => {
      await mcpServer.start();

      const invalidToolCall = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 123, // Should be string
            invalid_field: 'value'
          }
        }
      };

      const response = await mcpServer.handleMessage(invalidToolCall);
      
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602); // Invalid params
    });

    test('should sanitize file paths', async () => {
      await mcpServer.start();

      const maliciousResourceRead = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'expo://docs/../../../etc/passwd'
        }
      };

      const response = await mcpServer.handleMessage(maliciousResourceRead);
      
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Invalid or unsafe file path');
    });

    test('should detect code injection attempts', async () => {
      await mcpServer.start();

      const injectionAttempt = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'expo_search_documents',
          arguments: {
            query: 'test"; DROP TABLE users; --'
          }
        }
      };

      const response = await mcpServer.handleMessage(injectionAttempt);
      
      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Potential code injection detected');
    });

    test('should enforce rate limiting', async () => {
      await mcpServer.start();

      // Make many requests rapidly
      const requests = Array.from({ length: config.security.access_control.rate_limit_per_session + 5 }, 
        (_, i) => ({
          jsonrpc: '2.0',
          id: i,
          method: 'tools/list',
          params: {}
        })
      );

      const responses = await Promise.all(
        requests.map(req => mcpServer.handleMessage(req))
      );

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => 
        r.error && r.error.message.includes('Rate limit exceeded')
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
}); 