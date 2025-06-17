import { z } from 'zod';
import { ExpoSDKManager } from '../services/sdk-manager';
import { EasConfigManager, EasCommandResult, ConfigTemplate, ProjectContext, SnackConfig, SnackResult, OptimizationSuggestion, PluginValidationResult } from '../services/eas-config-manager';

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

const ExpoMigrationGuideInputSchema = z.object({
  from_version: z.string().regex(/^(latest|sdk-\d+)$/, 'Invalid SDK version format'),
  to_version: z.string().regex(/^(latest|sdk-\d+)$/, 'Invalid SDK version format'),
  code_snippet: z.string().max(5000, 'Code snippet too long').optional(),
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
      
      // 新しいSDK管理サービスを使用
      const sdkManager = new ExpoSDKManager();
      const module = await sdkManager.getSDKModule(input.module_name, input.sdk_version);
      
      // プラットフォーム互換性情報取得
      const compatibility = await sdkManager.getPlatformCompatibility(input.module_name, input.sdk_version);
      const permissions = await sdkManager.getPermissionRequirements(input.module_name);
      const installation = await sdkManager.generateInstallationSteps(input.module_name);

      // Part 2/2: 非推奨検出とマイグレーション情報を追加
      const deprecationWarnings = await sdkManager.detectDeprecatedAPIs(input.module_name, input.sdk_version);
      const compatibilityMatrix = await sdkManager.getCompatibilityMatrix(input.sdk_version);

      // メソッド情報をフォーマット
      const methodsText = module.methods.map(method => {
        const examplesText = method.examples.map(example => 
          `\n**${example.title}:**\n\`\`\`${example.language}\n${example.code}\n\`\`\`\n`
        ).join('');
        
        // 非推奨情報がある場合の警告
        const deprecationInfo = method.availability.deprecated ? 
          `\n⚠️ **DEPRECATED**: Since ${method.availability.deprecated}${method.availability.replacement ? ` - Use \`${method.availability.replacement}\` instead` : ''}` : '';
        
        return `### ${method.name}\n\n**Signature:** \`${method.signature}\`\n\n**Description:** ${method.description}\n\n**Platforms:** ${method.platforms.join(', ')}\n\n**Since:** ${method.availability.since}${deprecationInfo}${examplesText}`;
      }).join('\n\n');

      // 定数情報をフォーマット
      const constantsText = Object.entries(module.constants).map(([_key, constant]) =>
        `### ${constant.name}\n\n**Type:** \`${constant.type}\`\n\n**Description:** ${constant.description}\n\n**Platforms:** ${constant.platforms.join(', ')}`
      ).join('\n\n');

      // プラットフォーム互換性テーブル
      const platformTable = compatibility.map(p => 
        `| ${p.platform} | ${p.supported ? '✅' : '❌'} | ${p.minVersion || 'N/A'} | ${p.limitations?.join(', ') || 'None'} |`
      ).join('\n');

      // 非推奨警告情報
      const deprecationSection = deprecationWarnings.length > 0 ? `

## ⚠️ 非推奨警告

${deprecationWarnings.map(warning => 
  `- **${warning.warning_level.toUpperCase()}**: ${warning.message}${warning.replacement ? ` → Use \`${warning.replacement}\`` : ''}`
).join('\n')}

詳細なマイグレーション手順については、\`expo_migration_guide\` ツールを使用してください。
` : '';

      // 互換性サマリー
      const compatibilitySection = `

## 📊 互換性サマリー

**Overall Compatibility:** ${compatibilityMatrix.overall_compatibility}% for ${input.sdk_version}

**Supported Modules:** ${Object.values(compatibilityMatrix.modules).filter(m => m.supported).length}/${Object.keys(compatibilityMatrix.modules).length}
**Supported Platforms:** ${Object.values(compatibilityMatrix.platforms).filter(p => p.supported).length}/${Object.keys(compatibilityMatrix.platforms).length}
`;

      const result = `
# ${module.name} (${module.packageName})

**Version:** ${module.version} | **SDK Version:** ${module.sdkVersion}
**Type:** ${module.moduleType} | **Platforms:** ${module.platforms.join(', ')}

${module.description}

## 📱 Platform Compatibility

| Platform | Supported | Min Version | Limitations |
|----------|-----------|-------------|-------------|
${platformTable}

## 🔧 Installation

**Commands:**
${installation.commands.map(cmd => `\`${cmd}\``).join('\n')}

**Configuration:**
${installation.configSteps.join('\n')}

**Additional Notes:**
${installation.additionalNotes.join('\n')}

## 🔐 Permissions

**Required:**
${permissions.required.map(p => `- \`${p}\``).join('\n') || 'None'}

**Optional:**
${permissions.optional.map(p => `- \`${p}\``).join('\n') || 'None'}

${deprecationSection}

${compatibilitySection}

## 📚 Methods

${methodsText}

## 🔢 Constants

${constantsText}

## 🔗 Links

- **Documentation:** [${module.documentationUrl}](${module.documentationUrl})
- **Repository:** [${module.repositoryUrl}](${module.repositoryUrl})
- **Last Modified:** ${module.lastModified.toISOString()}

---
*Generated by Expo MCP Server*
      `;

      return {
        content: [
          {
            type: 'text',
            text: result.trim(),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving SDK module: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * expo_config_templates - 設定テンプレート生成
   */
  static async expo_config_templates(args: any): Promise<ToolResult> {
    try {
      const input = ExpoConfigTemplatesInputSchema.parse(args);
      
      // EasConfigManagerを使用して実際のテンプレート生成
      const easConfigManager = new EasConfigManager();
      const projectContext: ProjectContext = {
        name: input.project_context?.name,
        platforms: input.project_context?.platforms,
        sdk_version: input.project_context?.sdk_version
      };

      let template: ConfigTemplate;
      
      switch (input.template_type) {
        case 'app.json':
          template = await easConfigManager.generateAppJsonTemplate(projectContext);
          break;
        case 'eas.json':
          template = await easConfigManager.generateEasJsonTemplate(projectContext);
          break;
        case 'metro.config.js':
          template = await easConfigManager.generateMetroConfigTemplate(projectContext);
          break;
        default:
          throw new Error(`Unsupported template type: ${input.template_type}`);
      }

      // フォーマット化された出力
      const validationSection = template.validation_errors.length === 0 
        ? '✅ **No validation errors found**' 
        : `❌ **Found ${template.validation_errors.length} validation errors:**\n${template.validation_errors.map(e => `- ${e}`).join('\n')}`;

      const suggestionsSection = template.suggestions.length > 0 
        ? `\n\n## 💡 Suggestions\n\n${template.suggestions.map(s => `- ${s}`).join('\n')}` 
        : '';

      const codeBlockLanguage = input.template_type === 'metro.config.js' ? 'javascript' : 'json';
      
      return {
        content: [{
          type: 'text',
          text: `# ${input.template_type} Configuration Template

## Generated Template

\`\`\`${codeBlockLanguage}
${template.content}
\`\`\`

## Validation Results

${validationSection}${suggestionsSection}

---
**Schema Version:** ${template.schema_version}  
**Generated:** ${new Date().toISOString()}`,
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
      
      // EasConfigManagerを使用して実際のコマンド生成
      const easConfigManager = new EasConfigManager();
      let commandResult: EasCommandResult;

      switch (input.operation) {
        case 'build':
          commandResult = await easConfigManager.generateBuildCommand(input.platform, input.profile);
          break;
        case 'submit':
          commandResult = await easConfigManager.generateSubmitCommand(input.platform, input.profile);
          break;
        case 'update':
          commandResult = await easConfigManager.generateUpdateCommand(input.platform, input.profile);
          break;
        case 'credentials':
          // credentials の場合は追加パラメータとして operation を指定
          commandResult = await easConfigManager.generateCredentialsCommand(input.platform, input.profile, 'configure');
          break;
        default:
          throw new Error(`Unsupported operation: ${input.operation}`);
      }

      // フラグ情報をフォーマット
      const flagsText = Object.entries(commandResult.flags).length > 0 
        ? Object.entries(commandResult.flags).map(([key, value]) => 
            `- \`--${key}\`${value !== 'true' ? `: ${value}` : ''}`
          ).join('\n')
        : 'No additional flags';

      // 前提条件をフォーマット
      const prerequisitesText = commandResult.prerequisites.length > 0 
        ? commandResult.prerequisites.map(p => `- ${p}`).join('\n')
        : 'No specific prerequisites';

      return {
        content: [{
          type: 'text',
          text: `# 🚀 EAS ${input.operation.toUpperCase()} Command

## Generated Command

\`\`\`bash
${commandResult.command}
\`\`\`

## Description

${commandResult.description}

## Prerequisites

${prerequisitesText}

## Command Flags

${flagsText}

## Additional Information

- **Estimated Time:** ${commandResult.estimated_time || 'Variable'}
- **Documentation:** [${commandResult.documentation_url}](${commandResult.documentation_url})
- **Platform:** ${input.platform}
- **Profile:** ${input.profile}

---
**Generated:** ${new Date().toISOString()}`,
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

  /**
   * expo_migration_guide - SDKバージョン間のマイグレーションガイド生成
   */
  static async expo_migration_guide(args: any): Promise<ToolResult> {
    try {
      const input = ExpoMigrationGuideInputSchema.parse(args);
      
      const sdkManager = new ExpoSDKManager();
      const migrationGuide = await sdkManager.generateMigrationGuide(input.from_version, input.to_version);
      
      // コードスニペットが提供された場合、非推奨API解析を実行
      let codeAnalysis = null;
      if (input.code_snippet) {
        codeAnalysis = await sdkManager.analyzeCodeForDeprecatedUsage(input.code_snippet, input.to_version);
      }

      // Breaking changes情報
      const breakingChangesText = migrationGuide.breaking_changes.length > 0 ? `

## 🔴 Breaking Changes

${migrationGuide.breaking_changes.map(change => `
### ${change.module} - ${change.change_type}

**Description:** ${change.description}

**Action Required:** ${change.action_required}

${change.example ? `
**Before:**
\`\`\`typescript
${change.example.before}
\`\`\`

**After:**
\`\`\`typescript
${change.example.after}
\`\`\`
` : ''}
`).join('')}` : '';

      // Deprecated modules情報
      const deprecatedModulesText = migrationGuide.deprecated_modules.length > 0 ? `

## ⚠️ Deprecated Modules

${migrationGuide.deprecated_modules.map(module => `
### ${module.name}

- **Deprecated Since:** ${module.deprecated_since}
- **Reason:** ${module.reason}
${module.replacement ? `- **Replacement:** \`${module.replacement}\`` : ''}
${module.removal_date ? `- **Removal Date:** ${module.removal_date}` : ''}
${module.migration_guide_url ? `- **Migration Guide:** [View Details](${module.migration_guide_url})` : ''}
`).join('')}` : '';

      // Migration steps
      const migrationStepsText = `

## 📋 Migration Steps

${migrationGuide.migration_steps.map(step => `
### Step ${step.step_number}: ${step.title}

${step.description}

${step.commands && step.commands.length > 0 ? `
**Commands:**
\`\`\`bash
${step.commands.join('\n')}
\`\`\`
` : ''}

${step.file_changes && step.file_changes.length > 0 ? `
**File Changes:**
${step.file_changes.map(change => `- ${change}`).join('\n')}
` : ''}

${step.verification_steps && step.verification_steps.length > 0 ? `
**Verification:**
${step.verification_steps.map(step => `- ${step}`).join('\n')}
` : ''}
`).join('')}`;

      // Code analysis結果
      const codeAnalysisText = codeAnalysis ? `

## 🔍 Code Analysis Results

${codeAnalysis.warnings.length > 0 ? `
### ⚠️ Deprecation Warnings Found

${codeAnalysis.warnings.map(warning => 
  `- **${warning.warning_level.toUpperCase()}**: ${warning.message}`
).join('\n')}
` : ''}

${codeAnalysis.suggestions.length > 0 ? `
### 💡 Suggestions

${codeAnalysis.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}
` : ''}

**Migration Required:** ${codeAnalysis.migration_required ? '✅ Yes' : '❌ No'}
` : '';

      const result = `
# Migration Guide: ${migrationGuide.fromVersion} → ${migrationGuide.toVersion}

**Estimated Effort:** ${migrationGuide.estimated_effort.toUpperCase()}
**Notes:** ${migrationGuide.notes}

${breakingChangesText}

${deprecatedModulesText}

${migrationStepsText}

${codeAnalysisText}

## 🎯 Next Steps

1. Review all breaking changes and deprecated modules above
2. Follow the migration steps in order
3. Test your application thoroughly in development
4. Update your CI/CD pipelines if needed
5. Document any custom workarounds for your team

## 📞 Support

If you encounter issues during migration:
- Check the [Expo Discord](https://chat.expo.dev) for community support
- Review the [SDK Upgrade Guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- File issues on [GitHub](https://github.com/expo/expo/issues)

---
*Generated by Expo MCP Server*
      `;

      return {
        content: [
          {
            type: 'text',
            text: result.trim(),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating migration guide: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ========== Part 2/2: Advanced EAS・設定管理機能 ==========

  /**
   * expo_snack_generator - Snack互換コード・URL生成
   */
  static async expo_snack_generator(args: any): Promise<ToolResult> {
    try {
      const input = z.object({
        modules: z.array(z.string()),
        code_pattern: z.string().optional().default('basic'),
        project_context: z.object({
          name: z.string().optional(),
          platforms: z.array(z.string()).optional(),
          sdk_version: z.string().optional()
        }).optional()
      }).parse(args);
      
      const easConfigManager = new EasConfigManager();
      
      // Snack互換コード生成
      const snackConfig: SnackConfig = await easConfigManager.generateSnackCompatibleCode(
        input.modules,
        input.code_pattern,
        input.project_context || {}
      );
      
      // Snack URL生成
      const snackResult: SnackResult = await easConfigManager.generateSnackUrl(snackConfig);
      
      return {
        content: [{
          type: 'text',
          text: `# 🚀 Snack Generated

## 📱 URLs

- **Primary URL:** [${snackResult.url}](${snackResult.url})
- **Embed URL:** [${snackResult.embed_url}](${snackResult.embed_url})
- **Web Player:** [${snackResult.web_player_url}](${snackResult.web_player_url})

## 📊 Compatibility

- **Score:** ${snackResult.compatibility_score}%
- **Platforms:** ${snackResult.platform_support.join(', ')}

## 📦 Dependencies

\`\`\`json
${JSON.stringify(snackResult.dependencies, null, 2)}
\`\`\`

## 💻 Generated Code

\`\`\`typescript
${snackConfig.code}
\`\`\``,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_snack_generator', error);
    }
  }

  /**
   * expo_plugin_validator - プラグイン設定バリデーション
   */
  static async expo_plugin_validator(args: any): Promise<ToolResult> {
    try {
      const input = z.object({
        plugin_name: z.string(),
        plugin_config: z.any().optional(),
        project_context: z.object({
          sdk_version: z.string().optional(),
          platforms: z.array(z.string()).optional()
        }).optional()
      }).parse(args);
      
      const easConfigManager = new EasConfigManager();
      
      const validation: PluginValidationResult = await easConfigManager.validatePluginConfiguration(
        input.plugin_name,
        input.plugin_config,
        input.project_context || {}
      );
      
      const statusIcon = validation.is_valid ? '✅' : '❌';
      const compatibilityIcon = validation.version_compatible ? '✅' : '⚠️';
      
      return {
        content: [{
          type: 'text',
          text: `# ${statusIcon} Plugin Validation: ${validation.plugin_name}

## 📋 Validation Results

- **Valid:** ${statusIcon} ${validation.is_valid}
- **Version Compatible:** ${compatibilityIcon} ${validation.version_compatible}
- **Platform Support:** ${validation.platform_support.join(', ')}

${validation.issues.length > 0 ? `## ❌ Issues

${validation.issues.map(issue => `- ${issue}`).join('\n')}

` : ''}${validation.suggestions.length > 0 ? `## 💡 Suggestions

${validation.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}` : ''}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_plugin_validator', error);
    }
  }

  /**
   * expo_config_optimizer - 設定最適化提案
   */
  static async expo_config_optimizer(args: any): Promise<ToolResult> {
    try {
      const input = z.object({
        config_type: z.string(),
        config_content: z.any(),
        project_context: z.object({
          name: z.string().optional(),
          platforms: z.array(z.string()).optional(),
          sdk_version: z.string().optional()
        }).optional()
      }).parse(args);
      
      const easConfigManager = new EasConfigManager();
      
      const suggestions: OptimizationSuggestion[] = await easConfigManager.generateOptimizationSuggestions(
        input.config_type,
        input.config_content,
        input.project_context || {}
      );
      
      const highPriority = suggestions.filter(s => s.priority === 'high');
      const mediumPriority = suggestions.filter(s => s.priority === 'medium');
      const lowPriority = suggestions.filter(s => s.priority === 'low');
      
      return {
        content: [{
          type: 'text',
          text: `# 🔧 Configuration Optimization

**Total Suggestions:** ${suggestions.length}

${highPriority.length > 0 ? `## 🔴 High Priority (${highPriority.length})

${highPriority.map(s => `### ${s.title}

**Category:** ${s.category}
**Description:** ${s.description}
${s.fix_command ? `**Fix:** \`${s.fix_command}\`
` : ''}${s.documentation_url ? `**Docs:** [${s.documentation_url}](${s.documentation_url})
` : ''}`).join('\n')}

` : ''}${mediumPriority.length > 0 ? `## 🟡 Medium Priority (${mediumPriority.length})

${mediumPriority.map(s => `### ${s.title}

**Category:** ${s.category}
**Description:** ${s.description}
${s.fix_command ? `**Fix:** \`${s.fix_command}\`
` : ''}${s.documentation_url ? `**Docs:** [${s.documentation_url}](${s.documentation_url})
` : ''}`).join('\n')}

` : ''}${lowPriority.length > 0 ? `## 🟢 Low Priority (${lowPriority.length})

${lowPriority.map(s => `### ${s.title}

**Category:** ${s.category}
**Description:** ${s.description}
${s.fix_command ? `**Fix:** \`${s.fix_command}\`
` : ''}${s.documentation_url ? `**Docs:** [${s.documentation_url}](${s.documentation_url})
` : ''}`).join('\n')}` : ''}`,
        }],
      };
    } catch (error) {
      return ExpoTools.createErrorResult('expo_config_optimizer', error);
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
  expo_migration_guide: {
    name: 'expo_migration_guide',
    description: 'SDKバージョン間のマイグレーションガイド生成',
    inputSchema: {
      type: 'object',
      properties: {
        from_version: { type: 'string', pattern: '^(latest|sdk-\\d+)$' },
        to_version: { type: 'string', pattern: '^(latest|sdk-\\d+)$' },
        code_snippet: { type: 'string', maxLength: 5000 },
      },
      required: ['from_version', 'to_version'],
    },
  },
  expo_snack_generator: {
    name: 'expo_snack_generator',
    description: 'Snack互換コード・URL生成',
    inputSchema: {
      type: 'object',
      properties: {
        modules: { type: 'array', items: { type: 'string' } },
        code_pattern: { type: 'string', default: 'basic' },
        project_context: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            platforms: { type: 'array', items: { enum: ['ios', 'android', 'web'] } },
            sdk_version: { type: 'string' },
          },
        },
      },
      required: ['modules'],
    },
  },
  expo_plugin_validator: {
    name: 'expo_plugin_validator',
    description: 'プラグイン設定バリデーション',
    inputSchema: {
      type: 'object',
      properties: {
        plugin_name: { type: 'string' },
        plugin_config: { type: 'object' },
        project_context: {
          type: 'object',
          properties: {
            sdk_version: { type: 'string' },
            platforms: { type: 'array', items: { enum: ['ios', 'android', 'web'] } },
          },
        },
      },
      required: ['plugin_name'],
    },
  },
  expo_config_optimizer: {
    name: 'expo_config_optimizer',
    description: '設定最適化提案',
    inputSchema: {
      type: 'object',
      properties: {
        config_type: { type: 'string', enum: ['app.json', 'eas.json', 'metro.config.js'] },
        config_content: { type: 'object' },
        project_context: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            platforms: { type: 'array', items: { enum: ['ios', 'android', 'web'] } },
            sdk_version: { type: 'string' },
          },
        },
      },
      required: ['config_type', 'config_content'],
    },
  },
} as const; 