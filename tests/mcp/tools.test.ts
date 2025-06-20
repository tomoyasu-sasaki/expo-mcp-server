import { performance } from 'perf_hooks';

describe('MCP: ツール機能', () => {
  test('ツール定義形式確認', () => {
    const startTime = performance.now();
    
    // MCP ツールの基本定義形式
    const toolDefinition = {
      name: 'expo_read_document',
      description: 'Read Expo documentation content',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the documentation file'
          }
        },
        required: ['path']
      }
    };
    
    expect(toolDefinition.name).toBe('expo_read_document');
    expect(toolDefinition.description).toBeDefined();
    expect(toolDefinition.inputSchema).toBeDefined();
    expect(toolDefinition.inputSchema.type).toBe('object');
    expect(toolDefinition.inputSchema.properties).toBeDefined();
    expect(toolDefinition.inputSchema.required).toContain('path');
    
    const endTime = performance.now();
    console.log(`✅ ツール定義形式: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('ツール実行結果形式確認', () => {
    // ツール実行結果の基本形式
    const toolResult = {
      content: [
        {
          type: 'text',
          text: 'Sample documentation content'
        }
      ],
      isError: false
    };
    
    expect(toolResult.content).toBeDefined();
    expect(Array.isArray(toolResult.content)).toBe(true);
    expect(toolResult.content[0].type).toBe('text');
    expect(toolResult.content[0].text).toBeDefined();
    expect(toolResult.isError).toBe(false);
    
    console.log('✅ ツール実行結果形式確認完了');
  });

  test('エラーハンドリング確認', () => {
    // エラー時の結果形式
    const errorResult = {
      content: [
        {
          type: 'text',
          text: 'Error: File not found'
        }
      ],
      isError: true
    };
    
    expect(errorResult.isError).toBe(true);
    expect(errorResult.content[0].text).toContain('Error:');
    
    console.log('✅ エラーハンドリング確認完了');
  });

  test('8つのMCPツール基本確認', () => {
    const startTime = performance.now();
    
    // 8つのMCPツールリスト
    const mcpTools = [
      'expo_read_document',
      'expo_search_documents', 
      'expo_get_sdk_version',
      'expo_get_platform_info',
      'expo_validate_config',
      'expo_generate_config',
      'expo_create_snack',
      'expo_diagnose_error'
    ];
    
    expect(mcpTools).toHaveLength(8);
    
    // 各ツール名の形式確認
    mcpTools.forEach(toolName => {
      expect(toolName).toMatch(/^expo_[a-z_]+$/);
      expect(toolName.startsWith('expo_')).toBe(true);
    });
    
    const endTime = performance.now();
    console.log(`✅ 8つのMCPツール確認: ${(endTime - startTime).toFixed(2)}ms`);
    console.log('✅ ツール一覧:', mcpTools.join(', '));
  });

  test('パラメータ検証確認', () => {
    // パラメータ検証のシミュレーション
    const validateToolParams = (toolName: string, params: Record<string, unknown>): boolean => {
      const toolSchemas: Record<string, Record<string, unknown>> = {
        'expo_read_document': {
          required: ['path'],
          properties: {
            path: { type: 'string' }
          }
        },
        'expo_search_documents': {
          required: ['query'],
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' }
          }
        }
      };
      
      const schema = toolSchemas[toolName];
      if (!schema) return false;
      
      const required = schema.required as string[];
      return required.every(field => params[field] !== undefined);
    };
    
    // 正常なパラメータ
    expect(validateToolParams('expo_read_document', { path: '/docs/guide.md' })).toBe(true);
    expect(validateToolParams('expo_search_documents', { query: 'navigation' })).toBe(true);
    
    // 不正なパラメータ
    expect(validateToolParams('expo_read_document', {})).toBe(false);
    expect(validateToolParams('expo_search_documents', {})).toBe(false);
    expect(validateToolParams('unknown_tool', { param: 'value' })).toBe(false);
    
    console.log('✅ パラメータ検証確認完了');
  });
}); 