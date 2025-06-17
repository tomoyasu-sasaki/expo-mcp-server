/**
 * MCP Prompt 実装
 * expo.yaml仕様準拠、プロンプトテンプレート生成
 */

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptResult {
  description: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

export class ExpoPrompts {

  /**
   * プロンプトを取得して実行
   */
  static async getPrompt(name: string, args?: Record<string, string>): Promise<PromptResult> {
    switch (name) {
      case 'expo_setup_helper':
        return await ExpoPrompts.expo_setup_helper(args);
      
      case 'expo_error_helper':
        return await ExpoPrompts.expo_error_helper(args);
      
      case 'expo_api_helper':
        return await ExpoPrompts.expo_api_helper(args);
      
      case 'expo_config_analyzer':
        return await ExpoPrompts.expo_config_analyzer(args);
      
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  /**
   * expo_setup_helper - Expoプロジェクトセットアップ支援プロンプト
   */
  static async expo_setup_helper(args?: Record<string, string>): Promise<PromptResult> {
    const projectType = args?.project_type || 'blank';
    const targetPlatforms = args?.target_platforms || 'ios,android';
    
    if (!projectType) {
      throw new Error('project_type argument is required');
    }

    const platforms = targetPlatforms.split(',').map(p => p.trim());
    
    const setupPrompt = ExpoPrompts.generateSetupPrompt(projectType, platforms);
    
    return {
      description: `Expo project setup assistance for ${projectType} project targeting ${platforms.join(', ')}`,
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: setupPrompt.systemPrompt,
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: setupPrompt.userPrompt,
          },
        },
      ],
    };
  }

  /**
   * expo_error_helper - Expoエラー解決支援プロンプト
   */
  static async expo_error_helper(args?: Record<string, string>): Promise<PromptResult> {
    const errorMessage = args?.error_message;
    const context = args?.context || 'general';
    
    if (!errorMessage) {
      throw new Error('error_message argument is required');
    }

    const errorPrompt = ExpoPrompts.generateErrorPrompt(errorMessage, context);
    
    return {
      description: `Expo error resolution assistance for: ${errorMessage.substring(0, 100)}...`,
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: errorPrompt.systemPrompt,
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: errorPrompt.userPrompt,
          },
        },
      ],
    };
  }

  /**
   * expo_api_helper - Expo API使用支援プロンプト
   */
  static async expo_api_helper(args?: Record<string, string>): Promise<PromptResult> {
    const moduleName = args?.module_name;
    const useCase = args?.use_case || 'basic usage';
    
    if (!moduleName) {
      throw new Error('module_name argument is required');
    }

    const apiPrompt = ExpoPrompts.generateApiPrompt(moduleName, useCase);
    
    return {
      description: `Expo API assistance for ${moduleName} module - ${useCase}`,
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: apiPrompt.systemPrompt,
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: apiPrompt.userPrompt,
          },
        },
      ],
    };
  }

  /**
   * expo_config_analyzer - Expo設定分析・最適化提案プロンプト
   */
  static async expo_config_analyzer(args?: Record<string, string>): Promise<PromptResult> {
    const configContent = args?.config_content;
    const targetEnvironment = args?.target_environment || 'development';
    
    if (!configContent) {
      throw new Error('config_content argument is required');
    }

    const configPrompt = ExpoPrompts.generateConfigPrompt(configContent, targetEnvironment);
    
    return {
      description: `Expo configuration analysis and optimization for ${targetEnvironment} environment`,
      messages: [
        {
          role: 'system',
          content: {
            type: 'text',
            text: configPrompt.systemPrompt,
          },
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: configPrompt.userPrompt,
          },
        },
      ],
    };
  }

  // =============================================================================
  // Prompt Generators
  // =============================================================================

  private static generateSetupPrompt(projectType: string, platforms: string[]) {
    return {
      systemPrompt: `You are an expert Expo developer assistant helping users set up new Expo projects. Your role is to:

1. Guide users through the optimal setup process for their specific project type and target platforms
2. Recommend appropriate dependencies and configurations
3. Provide best practices for project structure and development workflow
4. Suggest relevant Expo SDK modules based on common use cases
5. Help with initial configuration for deployment and testing

**Project Context:**
- Project Type: ${projectType}
- Target Platforms: ${platforms.join(', ')}

**Your expertise covers:**
- Expo CLI and EAS CLI usage
- SDK module selection and configuration
- Platform-specific considerations
- Development and production build setup
- Common troubleshooting for new projects

Provide clear, actionable guidance with code examples when appropriate. Focus on current best practices and official Expo recommendations.`,

      userPrompt: `I want to create a new Expo project with the following requirements:

**Project Type:** ${projectType}
**Target Platforms:** ${platforms.join(', ')}

Please help me with:

1. **Initial Setup Commands**: What commands should I run to create this project?

2. **Recommended Dependencies**: What Expo SDK modules and other packages would be most useful for this type of project?

3. **Configuration**: What should I configure in app.json/app.config.js for these platforms?

4. **Project Structure**: How should I organize my files and folders for this project type?

5. **Development Workflow**: What's the recommended development and testing approach?

6. **Deployment Preparation**: What should I consider early on for eventual app store deployment?

${projectType === 'bare' ? '\nAdditional considerations for bare workflow setup and native code management?' : ''}
${platforms.includes('web') ? '\nSpecific considerations for web platform support?' : ''}
${platforms.includes('ios') && platforms.includes('android') ? '\nBest practices for cross-platform development?' : ''}

Please provide specific, actionable steps with code examples where helpful.`,
    };
  }

  private static generateErrorPrompt(errorMessage: string, context: string) {
    return {
      systemPrompt: `You are an expert Expo developer and debugging specialist. Your role is to:

1. Analyze Expo/React Native error messages and identify root causes
2. Provide step-by-step solutions with clear explanations
3. Recommend preventive measures to avoid similar issues
4. Suggest debugging techniques and tools
5. Help users understand the underlying concepts to prevent future problems

**Error Context:** ${context}

**Your expertise covers:**
- Metro bundler and build system issues
- Platform-specific compilation errors
- Expo SDK module integration problems
- EAS Build and development client issues
- Runtime errors and debugging techniques
- Configuration and dependency conflicts

Always provide:
- Multiple solution approaches when possible
- Verification steps to confirm the fix
- Prevention strategies
- Links to relevant documentation when appropriate`,

      userPrompt: `I'm encountering the following error in my Expo project:

**Error Message:**
\`\`\`
${errorMessage}
\`\`\`

**Context:** ${context}

Please help me:

1. **Understand the Error**: What is causing this error and why did it occur?

2. **Immediate Solution**: What steps should I take to fix this right now?

3. **Root Cause Analysis**: What underlying issue might have led to this error?

4. **Verification**: How can I confirm that the fix worked properly?

5. **Prevention**: What can I do to prevent this error from happening again?

6. **Alternative Solutions**: Are there other approaches to fix this issue?

Please provide specific commands, code changes, or configuration updates as needed. If this is a common error, please mention any known gotchas or additional considerations.`,
    };
  }

  private static generateApiPrompt(moduleName: string, useCase: string) {
    return {
      systemPrompt: `You are an expert Expo SDK developer specializing in helping developers effectively use Expo APIs and modules. Your role is to:

1. Provide comprehensive guidance on Expo SDK module usage
2. Share best practices for API integration and error handling
3. Demonstrate proper TypeScript usage and type safety
4. Explain platform-specific considerations and limitations
5. Suggest performance optimizations and testing strategies

**Module Focus:** ${moduleName}
**Use Case:** ${useCase}

**Your expertise covers:**
- Complete API surface and method signatures
- Platform support and limitations
- Permission requirements and user privacy
- Performance considerations and optimization
- Error handling and edge cases
- Integration with other Expo modules
- Testing and debugging approaches

Provide practical, production-ready code examples with proper error handling and TypeScript types. Always mention platform compatibility, permissions, and potential gotchas.`,

      userPrompt: `I want to implement ${moduleName} in my Expo project for the following use case:

**Use Case:** ${useCase}

Please help me with:

1. **Installation & Setup**: How do I properly install and configure ${moduleName}?

2. **Basic Implementation**: What's the minimal code needed to get started?

3. **Advanced Usage**: How can I use more advanced features for my specific use case?

4. **Error Handling**: What errors should I anticipate and how should I handle them?

5. **Platform Considerations**: Are there any platform-specific differences or limitations?

6. **Permissions & Privacy**: What permissions do I need and how should I handle user privacy?

7. **Best Practices**: What are the recommended patterns and practices for this module?

8. **Testing**: How can I test this functionality during development?

Please provide TypeScript code examples that are production-ready with proper error handling. Also mention any dependencies, configuration requirements, or potential gotchas I should be aware of.`,
    };
  }

  private static generateConfigPrompt(configContent: string, targetEnvironment: string) {
    return {
      systemPrompt: `You are an expert Expo configuration specialist and architect. Your role is to:

1. Analyze Expo configuration files (app.json, eas.json, etc.) for optimization opportunities
2. Ensure configurations follow current best practices and security guidelines
3. Identify potential issues or conflicts in configuration
4. Recommend environment-specific optimizations
5. Suggest improvements for performance, security, and maintainability

**Target Environment:** ${targetEnvironment}

**Your expertise covers:**
- app.json/app.config.js optimization
- EAS Build configuration (eas.json)
- Metro bundler configuration
- Platform-specific configuration options
- Security and privacy best practices
- Performance optimization settings
- CI/CD and deployment configuration
- Troubleshooting configuration issues

Provide specific, actionable recommendations with explanations of the benefits and potential trade-offs. Always consider the target environment when making suggestions.`,

      userPrompt: `Please analyze my Expo configuration and provide optimization recommendations:

**Target Environment:** ${targetEnvironment}

**Configuration:**
\`\`\`json
${configContent}
\`\`\`

Please help me with:

1. **Configuration Analysis**: What issues or suboptimal settings do you see in this configuration?

2. **Environment Optimization**: How should this configuration be optimized for ${targetEnvironment}?

3. **Security Review**: Are there any security concerns or improvements in this configuration?

4. **Performance Optimization**: What changes could improve build times, app performance, or bundle size?

5. **Best Practices**: What current Expo best practices am I missing?

6. **Platform-Specific**: Are there platform-specific optimizations I should consider?

7. **Missing Configuration**: What important configuration options might I be missing?

8. **Future-Proofing**: How can I structure this configuration for easier maintenance and updates?

Please provide specific configuration changes with explanations of why each change is beneficial. If there are trade-offs involved, please explain them clearly.`,
    };
  }
}

// =============================================================================
// Prompt Schema Exports (for server registration)
// =============================================================================

export const PROMPT_SCHEMAS = [
  {
    name: 'expo_setup_helper',
    description: 'Expoプロジェクトセットアップ支援プロンプト',
    arguments: [
      {
        name: 'project_type',
        description: 'プロジェクトタイプ（blank, tabs, bare workflow）',
        required: true,
      },
      {
        name: 'target_platforms',
        description: '対象プラットフォーム',
        required: false,
      },
    ] as PromptArgument[],
  },
  {
    name: 'expo_error_helper',
    description: 'Expoエラー解決支援プロンプト',
    arguments: [
      {
        name: 'error_message',
        description: 'エラーメッセージ',
        required: true,
      },
      {
        name: 'context',
        description: '発生時のコンテキスト（ビルド中、実行中等）',
        required: false,
      },
    ] as PromptArgument[],
  },
  {
    name: 'expo_api_helper',
    description: 'Expo API使用支援プロンプト',
    arguments: [
      {
        name: 'module_name',
        description: '使用したいExpo SDKモジュール',
        required: true,
      },
      {
        name: 'use_case',
        description: '使用目的・実現したい機能',
        required: false,
      },
    ] as PromptArgument[],
  },
  {
    name: 'expo_config_analyzer',
    description: 'Expo設定分析・最適化提案プロンプト',
    arguments: [
      {
        name: 'config_content',
        description: '現在のapp.jsonまたはeas.json内容',
        required: true,
      },
      {
        name: 'target_environment',
        description: '対象環境（development, preview, production）',
        required: false,
      },
    ] as PromptArgument[],
  },
] as const; 