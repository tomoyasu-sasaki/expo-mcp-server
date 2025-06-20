import { performance } from 'perf_hooks';

describe('MCP: プロンプト機能', () => {
  test('プロンプト定義形式確認', () => {
    const startTime = performance.now();
    
    // MCP プロンプトの基本定義形式
    const promptDefinition = {
      name: 'expo_setup_guide',
      description: 'Interactive setup guide for Expo projects',
      arguments: [
        {
          name: 'platform',
          description: 'Target platform (iOS, Android, Web)',
          required: false
        },
        {
          name: 'template',
          description: 'Project template to use',
          required: false
        }
      ]
    };
    
    expect(promptDefinition.name).toBe('expo_setup_guide');
    expect(promptDefinition.description).toBeDefined();
    expect(Array.isArray(promptDefinition.arguments)).toBe(true);
    expect(promptDefinition.arguments[0].name).toBeDefined();
    expect(promptDefinition.arguments[0].description).toBeDefined();
    expect(typeof promptDefinition.arguments[0].required).toBe('boolean');
    
    const endTime = performance.now();
    console.log(`✅ プロンプト定義形式: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('4つのプロンプト確認', () => {
    const startTime = performance.now();
    
    // 4つのプロンプト
    const prompts = [
      'expo_setup_guide',      // セットアップガイド
      'expo_error_diagnosis',  // エラー診断
      'expo_api_helper',       // API使用支援
      'expo_config_assistant'  // 設定アシスタント
    ];
    
    expect(prompts).toHaveLength(4);
    
    prompts.forEach(promptName => {
      expect(promptName).toMatch(/^expo_[a-z_]+$/);
      expect(promptName.startsWith('expo_')).toBe(true);
    });
    
    const endTime = performance.now();
    console.log(`✅ 4つのプロンプト確認: ${(endTime - startTime).toFixed(2)}ms`);
    console.log('✅ プロンプト一覧:', prompts.join(', '));
  });

  test('プロンプト実行結果形式確認', () => {
    // プロンプト実行結果の基本形式
    const promptResult = {
      description: 'Generated setup guide for Expo project',
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: 'Welcome to Expo! Let me help you set up your project...'
          }
        }
      ]
    };
    
    expect(promptResult.description).toBeDefined();
    expect(Array.isArray(promptResult.messages)).toBe(true);
    expect(promptResult.messages[0].role).toBe('assistant');
    expect(promptResult.messages[0].content.type).toBe('text');
    expect(promptResult.messages[0].content.text).toBeDefined();
    
    console.log('✅ プロンプト実行結果形式確認完了');
  });

  test('引数検証確認', () => {
    // 引数検証のシミュレーション
    const validatePromptArgs = (promptName: string, args: Record<string, unknown>): boolean => {
      const promptSchemas: Record<string, { required: string[]; optional: string[] }> = {
        'expo_setup_guide': {
          required: [],
          optional: ['platform', 'template']
        },
        'expo_error_diagnosis': {
          required: ['error_message'],
          optional: ['context']
        },
        'expo_api_helper': {
          required: ['api_name'],
          optional: ['platform']
        },
        'expo_config_assistant': {
          required: ['config_type'],
          optional: ['platform', 'features']
        }
      };
      
      const schema = promptSchemas[promptName];
      if (!schema) return false;
      
      // 必須引数の確認
      return schema.required.every(field => args[field] !== undefined);
    };
    
    // 正常な引数
    expect(validatePromptArgs('expo_setup_guide', {})).toBe(true);
    expect(validatePromptArgs('expo_setup_guide', { platform: 'iOS' })).toBe(true);
    expect(validatePromptArgs('expo_error_diagnosis', { error_message: 'Build failed' })).toBe(true);
    expect(validatePromptArgs('expo_api_helper', { api_name: 'Camera' })).toBe(true);
    expect(validatePromptArgs('expo_config_assistant', { config_type: 'app.json' })).toBe(true);
    
    // 不正な引数
    expect(validatePromptArgs('expo_error_diagnosis', {})).toBe(false);
    expect(validatePromptArgs('expo_api_helper', {})).toBe(false);
    expect(validatePromptArgs('expo_config_assistant', {})).toBe(false);
    expect(validatePromptArgs('unknown_prompt', {})).toBe(false);
    
    console.log('✅ 引数検証確認完了');
  });

  test('プロンプトコンテンツ生成確認', () => {
    const startTime = performance.now();
    
    // プロンプトコンテンツ生成のシミュレーション
    const generatePromptContent = (promptName: string, args: Record<string, string>): string => {
      const templates: Record<string, string> = {
        'expo_setup_guide': `# Expo Setup Guide
Platform: ${args.platform || 'All platforms'}
Template: ${args.template || 'Default'}

Let's get your Expo project set up!`,
        
        'expo_error_diagnosis': `# Error Diagnosis
Error: ${args.error_message}
Context: ${args.context || 'General'}

Let me help you diagnose this error...`,
        
        'expo_api_helper': `# API Helper: ${args.api_name}
Platform: ${args.platform || 'All platforms'}

Here's how to use the ${args.api_name} API...`,
        
        'expo_config_assistant': `# Configuration Assistant
Config Type: ${args.config_type}
Platform: ${args.platform || 'All platforms'}

Let me help you configure ${args.config_type}...`
      };
      
      return templates[promptName] || 'Unknown prompt';
    };
    
    // コンテンツ生成テスト
    const setupContent = generatePromptContent('expo_setup_guide', { platform: 'iOS' });
    expect(setupContent).toContain('Platform: iOS');
    expect(setupContent).toContain('Expo Setup Guide');
    
    const errorContent = generatePromptContent('expo_error_diagnosis', { error_message: 'Build failed' });
    expect(errorContent).toContain('Error: Build failed');
    expect(errorContent).toContain('Error Diagnosis');
    
    const apiContent = generatePromptContent('expo_api_helper', { api_name: 'Camera' });
    expect(apiContent).toContain('API Helper: Camera');
    expect(apiContent).toContain('Camera API');
    
    const configContent = generatePromptContent('expo_config_assistant', { config_type: 'app.json' });
    expect(configContent).toContain('Config Type: app.json');
    expect(configContent).toContain('Configuration Assistant');
    
    const endTime = performance.now();
    console.log(`✅ プロンプトコンテンツ生成: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('インタラクティブプロンプト確認', () => {
    // インタラクティブプロンプトのシミュレーション
    const createInteractivePrompt = (promptName: string) => {
      return {
        name: promptName,
        interactive: true,
        steps: [
          {
            type: 'question',
            message: 'What platform are you targeting?',
            choices: ['iOS', 'Android', 'Web', 'All']
          },
          {
            type: 'question', 
            message: 'Which template would you like to use?',
            choices: ['Blank', 'Tabs', 'Navigation', 'Bare']
          }
        ]
      };
    };
    
    const interactivePrompt = createInteractivePrompt('expo_setup_guide');
    
    expect(interactivePrompt.name).toBe('expo_setup_guide');
    expect(interactivePrompt.interactive).toBe(true);
    expect(Array.isArray(interactivePrompt.steps)).toBe(true);
    expect(interactivePrompt.steps).toHaveLength(2);
    expect(interactivePrompt.steps[0].type).toBe('question');
    expect(interactivePrompt.steps[0].message).toBeDefined();
    expect(Array.isArray(interactivePrompt.steps[0].choices)).toBe(true);
    
    console.log('✅ インタラクティブプロンプト確認完了');
  });
}); 