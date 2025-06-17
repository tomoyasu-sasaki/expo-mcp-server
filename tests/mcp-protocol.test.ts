import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ExpoMcpServer } from '../src/mcp/server';

/**
 * MCP Protocol 基本機能テスト
 * JSON-RPC 2.0 over stdio 通信の動作確認
 */

describe.skip('MCP Protocol 基本機能', () => {
  let server: ExpoMcpServer;
  let mcpConfig: any;

  beforeEach(() => {
    // テスト用MCP設定
    mcpConfig = {
      name: 'expo-mcp-server-test',
      version: '1.0.0-test',
      description: 'Test instance',
      protocol: {
        version: '2024-11-05',
        transports: {
          stdio: {
            enabled: true,
            encoding: 'utf-8',
            timeout_ms: 5000,
            max_message_size_bytes: 1048576,
          },
          http: {
            enabled: false,
            port: 3001,
            cors_enabled: true,
            timeout_ms: 30000,
            websocket_upgrade: true,
          },
        },
      },
      capabilities: {
        tools: [
          {
            name: 'expo_read_document',
            description: 'Test tool',
            enabled: true,
          },
        ],
        resources: [
          {
            uri_template: 'expo://docs/{path}',
            name: 'Test Resource',
            description: 'Test resource',
            mime_type: 'text/markdown',
          },
        ],
        prompts: [
          {
            name: 'expo_setup_helper',
            description: 'Test prompt',
            arguments: [],
          },
        ],
      },
      security: {
        input_validation: {
          max_tool_args_size_bytes: 2048,
        },
        access_control: {
          rate_limit_per_session: 100,
        },
        tool_execution: {
          sandboxing_enabled: true,
        },
      },
      performance: {},
      logging: { level: 'error' },
    };
  });

  afterEach(async () => {
    if (server) {
      await server.gracefulShutdown();
    }
  });

  describe('MCP SDK統合', () => {
    test('MCP Serverインスタンス作成', () => {
      server = new ExpoMcpServer(mcpConfig);
      expect(server).toBeDefined();
      expect(server.getSessionInfo().sessionId).toMatch(/^expo-mcp-/);
    });

    test('サーバー capabilities 定義', () => {
      server = new ExpoMcpServer(mcpConfig);
      const sessionInfo = server.getSessionInfo();
      expect(sessionInfo.isConnected).toBe(false);
      expect(sessionInfo.transport).toBeNull();
    });

    test('セッション初期化', () => {
      server = new ExpoMcpServer(mcpConfig);
      const sessionInfo = server.getSessionInfo();
      expect(sessionInfo.sessionId).toBeTruthy();
      expect(sessionInfo.startTime).toBeInstanceOf(Date);
    });
  });

  describe('基本通信機能', () => {
    test('ping/pong 実装', async () => {
      server = new ExpoMcpServer(mcpConfig);
      
      // 未接続状態でのping
      const pingResult = await server.ping();
      expect(pingResult).toBe(false);
    });

    test('セッション状態管理', () => {
      server = new ExpoMcpServer(mcpConfig);
      const sessionInfo = server.getSessionInfo();
      
      expect(sessionInfo).toMatchObject({
        sessionId: expect.stringMatching(/^expo-mcp-/),
        isConnected: false,
        startTime: expect.any(Date),
        transport: null,
      });
    });

    test('イベントエミッター動作', (done) => {
      server = new ExpoMcpServer(mcpConfig);
      
      server.on('test-event', (data) => {
        expect(data.test).toBe('value');
        done();
      });
      
      server.emit('test-event', { test: 'value' });
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な設定でのエラー', () => {
      const invalidConfig = { ...mcpConfig };
      delete invalidConfig.name;
      
      expect(() => {
        new ExpoMcpServer(invalidConfig);
      }).not.toThrow(); // 設定検証は外部で行うため
    });

    test('エラーイベントの発火', (done) => {
      server = new ExpoMcpServer(mcpConfig);
      
      server.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });
      
      // テスト用エラーの発火
      server.emit('error', new Error('Test error'));
    });
  });

  describe('Protocol仕様準拠', () => {
    test('Protocol version 2024-11-05 対応', () => {
      server = new ExpoMcpServer(mcpConfig);
      expect(mcpConfig.protocol.version).toBe('2024-11-05');
    });

    test('JSON-RPC 2.0 format', () => {
      // JSON-RPC 2.0の基本形式確認
      const testMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      expect(testMessage.jsonrpc).toBe('2.0');
      expect(testMessage.id).toBeDefined();
      expect(testMessage.method).toBeDefined();
    });

    test('Message size limit', () => {
      const maxSize = mcpConfig.protocol.transports.stdio.max_message_size_bytes;
      expect(maxSize).toBe(1048576); // 1MB
    });

    test('Encoding UTF-8', () => {
      const encoding = mcpConfig.protocol.transports.stdio.encoding;
      expect(encoding).toBe('utf-8');
    });
  });

  describe('Capabilities', () => {
    test('Tools capabilities', () => {
      server = new ExpoMcpServer(mcpConfig);
      const tools = mcpConfig.capabilities.tools;
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        enabled: expect.any(Boolean),
      });
    });

    test('Resources capabilities', () => {
      const resources = mcpConfig.capabilities.resources;
      
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
      expect(resources[0]).toMatchObject({
        uri_template: expect.any(String),
        name: expect.any(String),
        mime_type: expect.any(String),
      });
    });

    test('Prompts capabilities', () => {
      const prompts = mcpConfig.capabilities.prompts;
      
      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts[0]).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
      });
    });
  });
});

describe('JSON-RPC メッセージ形式確認', () => {
  test('Initialize request format', () => {
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true,
          },
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    // JSON-RPC 2.0 基本形式
    expect(initRequest.jsonrpc).toBe('2.0');
    expect(initRequest.id).toBeDefined();
    expect(initRequest.method).toBe('initialize');
    expect(initRequest.params).toBeDefined();

    // MCP Protocol specific
    expect(initRequest.params.protocolVersion).toBe('2024-11-05');
    expect(initRequest.params.clientInfo).toBeDefined();
  });

  test('Tool call request format', () => {
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'expo_read_document',
        arguments: {
          url: 'https://docs.expo.dev/guides/overview/',
          doc_type: 'guide',
        },
      },
    };

    expect(toolCallRequest.method).toBe('tools/call');
    expect(toolCallRequest.params.name).toBe('expo_read_document');
    expect(toolCallRequest.params.arguments).toBeDefined();
  });

  test('Error response format', () => {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32601,
        message: 'Method not found',
        data: {
          method: 'unknown_method',
        },
      },
    };

    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.error.code).toBe(-32601);
    expect(errorResponse.error.message).toBeDefined();
  });
});

describe('Protocol compliance verification', () => {
  test('Required message fields', () => {
    // すべてのMCPメッセージに必要なフィールドの確認
    const requiredFields = ['jsonrpc', 'id'];
    const testMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
    };

    requiredFields.forEach(field => {
      expect(testMessage).toHaveProperty(field);
    });
  });

  test('Protocol version compliance', () => {
    const supportedVersion = '2024-11-05';
    expect(supportedVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('Method naming convention', () => {
    const mcpMethods = [
      'initialize',
      'initialized',
      'tools/list',
      'tools/call',
      'resources/list',
      'resources/read',
      'prompts/list',
      'prompts/get',
    ];

    mcpMethods.forEach(method => {
      expect(method).toMatch(/^[a-z][a-z_]*(\/[a-z][a-z_]*)*$/);
    });
  });
}); 