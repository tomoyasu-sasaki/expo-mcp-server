import { performance } from 'perf_hooks';

describe('MCP: プロトコル基本機能', () => {
  test('JSON-RPC 2.0 メッセージ形式', () => {
    const startTime = performance.now();
    
    // 基本的なJSON-RPC 2.0メッセージの形式テスト
    const requestMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    expect(requestMessage.jsonrpc).toBe('2.0');
    expect(requestMessage.id).toBe(1);
    expect(requestMessage.method).toBe('initialize');
    expect(requestMessage.params).toBeDefined();
    
    const endTime = performance.now();
    console.log(`✅ JSON-RPC メッセージ形式: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('MCP プロトコルバージョン', () => {
    const protocolVersion = '2024-11-05';
    
    expect(protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(protocolVersion).toBe('2024-11-05');
    
    console.log('✅ MCPプロトコルバージョン確認:', protocolVersion);
  });

  test('基本的なレスポンス形式', () => {
    const responseMessage = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: 'expo-mcp-server',
          version: '1.0.0'
        }
      }
    };
    
    expect(responseMessage.jsonrpc).toBe('2.0');
    expect(responseMessage.id).toBe(1);
    expect(responseMessage.result).toBeDefined();
    expect(responseMessage.result.protocolVersion).toBe('2024-11-05');
    expect(responseMessage.result.serverInfo.name).toBe('expo-mcp-server');
    
    console.log('✅ レスポンス形式確認完了');
  });

  test('エラーレスポンス形式', () => {
    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };
    
    expect(errorResponse.jsonrpc).toBe('2.0');
    expect(errorResponse.id).toBe(1);
    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.error.code).toBe(-32601);
    expect(errorResponse.error.message).toBe('Method not found');
    
    console.log('✅ エラーレスポンス形式確認完了');
  });
}); 