import { z } from 'zod';

/**
 * MCP Tool 実装
 * expo.yaml仕様準拠、JSON Schema バリデーション付き
 */

// =============================================================================
// Input Schema Definitions (Zod)
// =============================================================================

const ExpoReadDocumentInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
  doc_type: z.enum(['guide', 'api', 'tutorial', 'reference']).optional(),
});

const ExpoSearchDocumentsInputSchema = z.object({
  query: z.string().min(1).max(500, 'Query too long'),
  filters: z.object({
    category: z.array(z.enum(['docs', 'api', 'examples', 'tutorials'])).optional(),
    platform: z.array(z.enum(['ios', 'android', 'web', 'universal'])).optional(),
    sdk_version: z.array(z.enum(['latest', 'sdk-49', 'sdk-48'])).optional(),
    module_type: z.array(z.enum(['core', 'community', 'deprecated'])).optional(),
  }).optional(),
});

const ExpoRecommendInputSchema = z.object({
  context: z.string().min(1).max(1000, 'Context too long'),
  max_results: z.number().int().min(1).max(10).default(5),
  platform: z.enum(['ios', 'android', 'web', 'universal']).optional(),
});

const ExpoGetSdkModuleInputSchema = z.object({
  module_name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid module name format'),
  sdk_version: z.string().regex(/^(latest|sdk-\d+)$/, 'Invalid SDK version format').default('latest'),
});

const ExpoConfigTemplatesInputSchema = z.object({
  template_type: z.enum(['app.json', 'eas.json', 'metro.config.js']),
  project_context: z.object({
    name: z.string().optional(),
    platforms: z.array(z.enum(['ios', 'android', 'web'])).optional(),
    sdk_version: z.string().optional(),
  }).optional(),
});

const ExpoEasCommandBuilderInputSchema = z.object({
  operation: z.enum(['build', 'submit', 'update', 'credentials']),
  platform: z.enum(['ios', 'android', 'all']),
  profile: z.string().default('development'),
});

const ExpoCodeExamplesInputSchema = z.object({
  pattern: z.string().min(1).max(100, 'Pattern too long'),
  language: z.enum(['typescript', 'javascript']).default('typescript'),
  platform: z.enum(['ios', 'android', 'web', 'universal']).optional(),
});

const ExpoErrorDiagnosisInputSchema = z.object({
  error_message: z.string().min(1).max(2000, 'Error message too long'),
  error_type: z.enum(['build', 'runtime', 'metro', 'eas', 'expo_cli']).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
});

// =============================================================================
// Tool Implementations
// =============================================================================

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export class ExpoTools {
  
  /**
   * expo_read_document - ドキュメント取得
   */
  static async expo_read_document(args: any): Promise<ToolResult> {
    try {
      const input = ExpoReadDocumentInputSchema.parse(args);
      
      // URL からドキュメント取得（模擬実装）
      const response = await ExpoTools.fetchDocument(input.url, input.doc_type);
      
      return {
        content: [{
          type: 'text',
          text: `# Document: ${response.title}\n\n${response.markdown}\n\n---\nSource: ${input.url}\nType: ${input.doc_type || 'auto-detected'}\nLast Modified: ${response.lastModified}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_read_document', error);
    }
  }

  /**
   * expo_search_documents - ドキュメント検索
   */
  static async expo_search_documents(args: any): Promise<ToolResult> {
    try {
      const input = ExpoSearchDocumentsInputSchema.parse(args);
      
      // 検索実行（模擬実装）
      const results = await ExpoTools.searchDocuments(input.query, input.filters);
      
      const resultText = results.map((result, index) => 
        `${index + 1}. **${result.title}**\n   - URL: ${result.url}\n   - Score: ${result.score}\n   - Type: ${result.type}\n   - Summary: ${result.summary}\n`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `# Search Results for "${input.query}"\n\nFound ${results.length} results:\n\n${resultText}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_search_documents', error);
    }
  }

  /**
   * expo_recommend - コンテンツ推薦
   */
  static async expo_recommend(args: any): Promise<ToolResult> {
    try {
      const input = ExpoRecommendInputSchema.parse(args);
      
      // 推薦実行（模擬実装）
      const recommendations = await ExpoTools.getRecommendations(input.context, input.max_results, input.platform);
      
      const recText = recommendations.map((rec, index) => 
        `${index + 1}. **${rec.title}**\n   - URL: ${rec.url}\n   - Relevance: ${rec.relevance_score}\n   - Reason: ${rec.reason}\n   - Type: ${rec.content_type}\n`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `# Recommendations for your context\n\nBased on: "${input.context.substring(0, 100)}..."\n\n${recText}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_recommend', error);
    }
  }

  /**
   * expo_get_sdk_module - SDK モジュール情報取得
   */
  static async expo_get_sdk_module(args: any): Promise<ToolResult> {
    try {
      const input = ExpoGetSdkModuleInputSchema.parse(args);
      
      // SDK モジュール情報取得（模擬実装）
      const moduleInfo = await ExpoTools.getSdkModuleInfo(input.module_name, input.sdk_version);
      
      const methodsText = moduleInfo.methods.map(method => 
        `### ${method.name}\n\n**Signature:** \`${method.signature}\`\n\n**Description:** ${method.description}\n\n**Example:**\n\`\`\`typescript\n${method.example}\n\`\`\`\n`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `# ${moduleInfo.name} SDK Module\n\n**Description:** ${moduleInfo.description}\n\n**Installation:** \`${moduleInfo.installation}\`\n\n**Platforms:** ${moduleInfo.platforms.join(', ')}\n\n**Permissions:** ${moduleInfo.permissions.join(', ')}\n\n## Methods\n\n${methodsText}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_get_sdk_module', error);
    }
  }

  /**
   * expo_config_templates - 設定テンプレート生成
   */
  static async expo_config_templates(args: any): Promise<ToolResult> {
    try {
      const input = ExpoConfigTemplatesInputSchema.parse(args);
      
      // 設定テンプレート生成（模擬実装）
      const template = await ExpoTools.generateConfigTemplate(input.template_type, input.project_context);
      
      return {
        content: [{
          type: 'text',
          text: `# ${input.template_type} Configuration Template\n\n\`\`\`json\n${template.content}\n\`\`\`\n\n## Validation Results\n\n${template.validation_errors.length === 0 ? '✅ No errors found' : `❌ Found ${template.validation_errors.length} errors:\n${template.validation_errors.map(e => `- ${e}`).join('\n')}`}\n\n## Suggestions\n\n${template.suggestions.map(s => `- ${s}`).join('\n')}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_config_templates', error);
    }
  }

  /**
   * expo_eas_command_builder - EAS コマンド生成
   */
  static async expo_eas_command_builder(args: any): Promise<ToolResult> {
    try {
      const input = ExpoEasCommandBuilderInputSchema.parse(args);
      
      // EAS コマンド生成（模擬実装）
      const commandInfo = await ExpoTools.buildEasCommand(input.operation, input.platform, input.profile);
      
      return {
        content: [{
          type: 'text',
          text: `# EAS ${input.operation} Command\n\n**Command:**\n\`\`\`bash\n${commandInfo.command}\n\`\`\`\n\n**Description:** ${commandInfo.description}\n\n**Prerequisites:**\n${commandInfo.prerequisites.map(p => `- ${p}`).join('\n')}\n\n**Flags:**\n${Object.entries(commandInfo.flags).map(([key, value]) => `- \`--${key}\`: ${value}`).join('\n')}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_eas_command_builder', error);
    }
  }

  /**
   * expo_code_examples - コード例取得
   */
  static async expo_code_examples(args: any): Promise<ToolResult> {
    try {
      const input = ExpoCodeExamplesInputSchema.parse(args);
      
      // コード例取得（模擬実装）
      const examples = await ExpoTools.getCodeExamples(input.pattern, input.language, input.platform);
      
      const examplesText = examples.map((example, index) => 
        `## Example ${index + 1}: ${example.description}\n\n**Snack URL:** ${example.snack_url}\n\n**Platforms:** ${example.platforms.join(', ')}\n\n**Dependencies:**\n\`\`\`json\n${JSON.stringify(example.dependencies, null, 2)}\n\`\`\`\n\n**Code:**\n\`\`\`${input.language}\n${example.code}\n\`\`\`\n`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `# Code Examples for "${input.pattern}"\n\n${examplesText}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_code_examples', error);
    }
  }

  /**
   * expo_error_diagnosis - エラー診断
   */
  static async expo_error_diagnosis(args: any): Promise<ToolResult> {
    try {
      const input = ExpoErrorDiagnosisInputSchema.parse(args);
      
      // エラー診断（模擬実装）
      const diagnosis = await ExpoTools.diagnoseError(input.error_message, input.error_type, input.platform);
      
      const solutionsText = diagnosis.solutions.map((solution, index) => 
        `### Solution ${index + 1} (Confidence: ${Math.round(solution.confidence * 100)}%)\n\n**Description:** ${solution.description}\n\n**Steps:**\n${solution.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n`
      ).join('\n');

      // Include extracted module information if available
      const moduleInfo = diagnosis.extracted_module ? 
        `\n\n**Detected Module:** ${diagnosis.extracted_module}` : '';

      return {
        content: [{
          type: 'text',
          text: `# Error Diagnosis\n\n**Error Type:** ${diagnosis.error_type}${moduleInfo}\n\n**Likely Causes:**\n${diagnosis.likely_causes.map(cause => `- ${cause}`).join('\n')}\n\n## Solutions\n\n${solutionsText}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_error_diagnosis', error);
    }
  }

  // =============================================================================
  // Helper Methods (Mock Implementations)
  // =============================================================================

  private static async fetchDocument(url: string, _docType?: string) {
    // 模擬実装 - 実際にはHTTPリクエスト、キャッシュ確認、Markdownパースを行う
    await new Promise(resolve => setTimeout(resolve, 100)); // Network latency simulation
    
    return {
      title: `Expo Document from ${new URL(url).pathname}`,
      markdown: `# Sample Document\n\nThis is a mock document fetched from ${url}.\n\n## Installation\n\n\`\`\`bash\nnpx expo install example-module\n\`\`\`\n\n## Usage\n\n\`\`\`typescript\nimport { ExampleModule } from 'example-module';\n\nconst result = ExampleModule.doSomething();\n\`\`\``,
      lastModified: new Date().toISOString(),
      platforms: ['ios', 'android', 'web'],
      sdkVersion: 'latest',
    };
  }

  private static async searchDocuments(query: string, _filters?: any) {
    // 模擬実装 - 実際にはTypesense検索、ファセット適用、スコア計算を行う
    await new Promise(resolve => setTimeout(resolve, 80)); // Search latency simulation
    
    return [
      {
        title: `${query} API Reference`,
        url: `https://docs.expo.dev/versions/latest/sdk/${query.toLowerCase()}`,
        score: 0.95,
        type: 'api',
        summary: `Complete API reference for ${query} module`,
      },
      {
        title: `${query} Tutorial`,
        url: `https://docs.expo.dev/tutorial/${query.toLowerCase()}`,
        score: 0.87,
        type: 'tutorial',
        summary: `Step-by-step guide to using ${query}`,
      },
    ];
  }

  private static async getRecommendations(_context: string, _maxResults: number, _platform?: string) {
    // 模擬実装 - 実際には埋め込みベクトル、コサイン類似度計算を行う
    await new Promise(resolve => setTimeout(resolve, 150)); // ML inference simulation
    
    return [
      {
        title: 'Related SDK Module',
        url: 'https://docs.expo.dev/versions/latest/sdk/related-module',
        relevance_score: 0.89,
        reason: 'Similar functionality mentioned in context',
        content_type: 'api',
      },
      {
        title: 'Best Practices Guide',
        url: 'https://docs.expo.dev/guides/best-practices',
        relevance_score: 0.76,
        reason: 'Common patterns for your use case',
        content_type: 'guide',
      },
    ];
  }

  private static async getSdkModuleInfo(moduleName: string, _sdkVersion: string) {
    // 模擬実装 - 実際にはGitHub API、npm registry、キャッシュから情報取得
    await new Promise(resolve => setTimeout(resolve, 60)); // API call simulation
    
    return {
      name: moduleName,
      description: `Expo SDK module for ${moduleName} functionality`,
      installation: `npx expo install expo-${moduleName}`,
      platforms: ['ios', 'android', 'web'],
      permissions: [`${moduleName.toUpperCase()}_PERMISSION`],
      methods: [
        {
          name: `get${moduleName}Info`,
          signature: `get${moduleName}Info(): Promise<${moduleName}Info>`,
          description: `Get information about ${moduleName}`,
          example: `const info = await ${moduleName}.get${moduleName}Info();\nconsole.log(info);`,
        },
      ],
      constants: {},
      types: {},
    };
  }

  private static async generateConfigTemplate(templateType: string, projectContext?: any) {
    // 模擬実装 - 実際にはテンプレートエンジン、バリデーション、設定最適化を行う
    await new Promise(resolve => setTimeout(resolve, 200)); // Template generation simulation
    
    const templates = {
      'app.json': {
        expo: {
          name: projectContext?.name || 'MyExpoApp',
          slug: (projectContext?.name || 'my-expo-app').toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          orientation: 'portrait',
          platforms: projectContext?.platforms || ['ios', 'android'],
          splash: {
            image: './assets/splash.png',
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
          },
        },
      },
      'eas.json': {
        cli: { version: '>= 5.2.0' },
        build: {
          development: {
            developmentClient: true,
            distribution: 'internal',
          },
          preview: {
            distribution: 'internal',
          },
          production: {},
        },
      },
      'metro.config.js': `const { getDefaultConfig } = require('expo/metro-config');\n\nconst config = getDefaultConfig(__dirname);\n\nmodule.exports = config;`,
    };

    return {
      content: JSON.stringify(templates[templateType as keyof typeof templates] || {}, null, 2),
      validation_errors: [],
      suggestions: ['Consider adding app icons', 'Configure splash screen', 'Set up app store metadata'],
    };
  }

  private static async buildEasCommand(operation: string, platform: string, profile: string) {
    // 模擬実装 - 実際にはEAS CLI ドキュメント、フラグ仕様に基づくコマンド生成
    await new Promise(resolve => setTimeout(resolve, 50)); // Command generation simulation
    
    const platformFlag = platform === 'all' ? '--platform all' : `--platform ${platform}`;
    const profileFlag = profile !== 'development' ? `--profile ${profile}` : '';
    
    return {
      command: `eas ${operation} ${platformFlag} ${profileFlag}`.trim(),
      description: `${operation} your app for ${platform} using ${profile} profile`,
      prerequisites: [
        'EAS CLI installed globally',
        'Project configured with eas.json',
        'Expo account logged in',
      ],
      flags: {
        platform: `Target platform(s): ${platform}`,
        profile: `Build profile: ${profile}`,
        'non-interactive': 'Run in non-interactive mode',
      },
    };
  }

  private static async getCodeExamples(pattern: string, language: string, platform?: string) {
    // 模擬実装 - 実際にはコード例データベース、Snack API連携
    await new Promise(resolve => setTimeout(resolve, 300)); // Code generation simulation
    
    return [
      {
        code: `import { ${pattern} } from 'expo-${pattern.toLowerCase()}';\n\nexport default function App() {\n  const handlePress = async () => {\n    const result = await ${pattern}.doSomething();\n    console.log(result);\n  };\n\n  return (\n    <View>\n      <Button title="Use ${pattern}" onPress={handlePress} />\n    </View>\n  );\n}`,
        language,
        snack_url: `https://snack.expo.dev/@anonymous/${pattern.toLowerCase()}-example`,
        dependencies: {
          [`expo-${pattern.toLowerCase()}`]: 'latest',
          'expo': '~49.0.0',
        },
        platforms: platform ? [platform] : ['ios', 'android', 'web'],
        description: `Basic ${pattern} usage example`,
      },
    ];
  }

  private static async diagnoseError(errorMessage: string, errorType?: string, _platform?: string) {
    // 模擬実装 - 実際にはエラーパターン照合、解決策データベース検索
    await new Promise(resolve => setTimeout(resolve, 250)); // Error analysis simulation
    
    // Extract module names from error message for more context-aware diagnosis
    const moduleMatch = errorMessage.match(/(expo-[a-zA-Z-]+)/);
    const extractedModule = moduleMatch ? moduleMatch[1] : null;
    
    return {
      error_type: errorType || 'general',
      extracted_module: extractedModule,
      likely_causes: [
        'Missing dependency or incorrect installation',
        'Platform-specific configuration issue',
        'Expo SDK version mismatch',
      ],
      solutions: [
        {
          description: 'Reinstall dependencies and clear cache',
          confidence: 0.85,
          steps: [
            'Run npm install or yarn install',
            'Clear Expo cache with expo start --clear',
            'Restart development server',
          ],
        },
        {
          description: 'Check platform compatibility',
          confidence: 0.72,
          steps: [
            'Verify module supports target platform',
            'Check app.json platform configuration',
            'Update to latest Expo SDK if needed',
          ],
        },
      ],
    };
  }

  private static createErrorResult(toolName: string, error: any): ToolResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `❌ Error in ${toolName}: ${errorMessage}`,
      }],
      isError: true,
    };
  }
}

// =============================================================================
// Tool Schema Exports (for server registration)
// =============================================================================

export const TOOL_SCHEMAS = {
  expo_read_document: {
    name: 'expo_read_document',
    description: 'Expoドキュメント、APIリファレンス、ガイドを取得',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        doc_type: { type: 'string', enum: ['guide', 'api', 'tutorial', 'reference'] },
      },
      required: ['url'],
    },
  },
  expo_search_documents: {
    name: 'expo_search_documents',
    description: 'Expoエコシステム全体でコンテンツ検索',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 500 },
        filters: {
          type: 'object',
          properties: {
            category: { type: 'array', items: { enum: ['docs', 'api', 'examples', 'tutorials'] } },
            platform: { type: 'array', items: { enum: ['ios', 'android', 'web', 'universal'] } },
            sdk_version: { type: 'array', items: { enum: ['latest', 'sdk-49', 'sdk-48'] } },
            module_type: { type: 'array', items: { enum: ['core', 'community', 'deprecated'] } },
          },
        },
      },
      required: ['query'],
    },
  },
  expo_recommend: {
    name: 'expo_recommend',
    description: '現在のコンテキストに基づく関連コンテンツ推薦',
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'string', maxLength: 1000 },
        max_results: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        platform: { type: 'string', enum: ['ios', 'android', 'web', 'universal'] },
      },
      required: ['context'],
    },
  },
  expo_get_sdk_module: {
    name: 'expo_get_sdk_module',
    description: 'Expo SDK モジュールの詳細情報を取得',
    inputSchema: {
      type: 'object',
      properties: {
        module_name: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
        sdk_version: { type: 'string', pattern: '^(latest|sdk-\\d+)$', default: 'latest' },
      },
      required: ['module_name'],
    },
  },
  expo_config_templates: {
    name: 'expo_config_templates',
    description: 'Expo設定ファイルの生成と検証',
    inputSchema: {
      type: 'object',
      properties: {
        template_type: { type: 'string', enum: ['app.json', 'eas.json', 'metro.config.js'] },
        project_context: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            platforms: { type: 'array', items: { enum: ['ios', 'android', 'web'] } },
            sdk_version: { type: 'string' },
          },
        },
      },
      required: ['template_type'],
    },
  },
  expo_eas_command_builder: {
    name: 'expo_eas_command_builder',
    description: 'EAS CLI コマンドをコンテキストに基づいて生成',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['build', 'submit', 'update', 'credentials'] },
        platform: { type: 'string', enum: ['ios', 'android', 'all'] },
        profile: { type: 'string', default: 'development' },
      },
      required: ['operation', 'platform'],
    },
  },
  expo_code_examples: {
    name: 'expo_code_examples',
    description: '実行可能なコード例とSnack統合を提供',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', maxLength: 100 },
        language: { type: 'string', enum: ['typescript', 'javascript'], default: 'typescript' },
        platform: { type: 'string', enum: ['ios', 'android', 'web', 'universal'] },
      },
      required: ['pattern'],
    },
  },
  expo_error_diagnosis: {
    name: 'expo_error_diagnosis',
    description: '一般的なExpoエラーの分析と解決策提供',
    inputSchema: {
      type: 'object',
      properties: {
        error_message: { type: 'string', maxLength: 2000 },
        error_type: { type: 'string', enum: ['build', 'runtime', 'metro', 'eas', 'expo_cli'] },
        platform: { type: 'string', enum: ['ios', 'android', 'web'] },
      },
      required: ['error_message'],
    },
  },
} as const; 