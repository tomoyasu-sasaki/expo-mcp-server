const logger = console; // Use console logging for now

export interface EasCommandResult {
  command: string;
  description: string;
  prerequisites: string[];
  flags: Record<string, string>;
  estimated_time?: string;
  documentation_url?: string;
}

export interface ConfigTemplate {
  content: string;
  validation_errors: string[];
  suggestions: string[];
  config_type: string;
  schema_version?: string;
}

export interface ProjectContext {
  name?: string;
  platforms?: string[];
  sdk_version?: string;
  bundle_identifier?: string;
  package_name?: string;
  build_profile?: string;
}

export interface SnackConfig {
  dependencies: Record<string, string>;
  code: string;
  name: string;
  description?: string;
  platforms?: string[];
  sdkVersion?: string;
}

export interface SnackResult {
  url: string;
  embed_url: string;
  web_player_url: string;
  dependencies: Record<string, string>;
  compatibility_score: number;
  platform_support: string[];
}

export interface OptimizationSuggestion {
  category: 'performance' | 'security' | 'compatibility' | 'maintainability';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fix_command?: string;
  documentation_url?: string;
}

export interface PluginValidationResult {
  plugin_name: string;
  is_valid: boolean;
  version_compatible: boolean;
  platform_support: string[];
  issues: string[];
  suggestions: string[];
}

export class EasConfigManager {
  private cache: Map<string, any> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  /**
   * EAS ビルドコマンド生成
   */
  async generateBuildCommand(platform: string, profile: string, additionalFlags?: Record<string, string>): Promise<EasCommandResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating EAS build command for platform: ${platform}, profile: ${profile}`);
      
      const baseCommand = this.buildBaseCommand('build', platform, profile);
      const flags = this.buildCommandFlags('build', platform, profile, additionalFlags);
      const prerequisites = this.getBuildPrerequisites(platform);
      
      const result: EasCommandResult = {
        command: `eas build ${baseCommand} ${this.formatFlags(flags)}`.trim(),
        description: `Build ${platform === 'all' ? 'for all platforms' : `for ${platform}`} using ${profile} profile`,
        prerequisites,
        flags,
        estimated_time: this.estimateBuildTime(platform, profile),
        documentation_url: `https://docs.expo.dev/build/setup/`
      };

      logger.info(`Build command generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate build command:', error);
      throw error;
    }
  }

  /**
   * EAS サブミットコマンド生成
   */
  async generateSubmitCommand(platform: string, profile: string, additionalFlags?: Record<string, string>): Promise<EasCommandResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating EAS submit command for platform: ${platform}, profile: ${profile}`);
      
      const baseCommand = this.buildBaseCommand('submit', platform, profile);
      const flags = this.buildCommandFlags('submit', platform, profile, additionalFlags);
      const prerequisites = this.getSubmitPrerequisites(platform);
      
      const result: EasCommandResult = {
        command: `eas submit ${baseCommand} ${this.formatFlags(flags)}`.trim(),
        description: `Submit ${platform} app to ${platform === 'ios' ? 'App Store' : 'Google Play Store'} using ${profile} profile`,
        prerequisites,
        flags,
        estimated_time: this.estimateSubmitTime(platform),
        documentation_url: `https://docs.expo.dev/submit/introduction/`
      };

      logger.info(`Submit command generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate submit command:', error);
      throw error;
    }
  }

  /**
   * EAS アップデートコマンド生成
   */
  async generateUpdateCommand(platform: string, profile: string, additionalFlags?: Record<string, string>): Promise<EasCommandResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating EAS update command for platform: ${platform}, profile: ${profile}`);
      
      const baseCommand = this.buildBaseCommand('update', platform, profile);
      const flags = this.buildCommandFlags('update', platform, profile, additionalFlags);
      const prerequisites = this.getUpdatePrerequisites();
      
      const result: EasCommandResult = {
        command: `eas update ${baseCommand} ${this.formatFlags(flags)}`.trim(),
        description: `Publish OTA update ${platform === 'all' ? 'for all platforms' : `for ${platform}`} using ${profile} profile`,
        prerequisites,
        flags,
        estimated_time: this.estimateUpdateTime(),
        documentation_url: `https://docs.expo.dev/eas-update/introduction/`
      };

      logger.info(`Update command generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate update command:', error);
      throw error;
    }
  }

  /**
   * EAS 認証情報管理コマンド生成
   */
  async generateCredentialsCommand(platform: string, profile: string, operation: string, additionalFlags?: Record<string, string>): Promise<EasCommandResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating EAS credentials command for platform: ${platform}, operation: ${operation}`);
      
      const flags = this.buildCredentialsFlags(platform, operation, additionalFlags);
      const prerequisites = this.getCredentialsPrerequisites(platform, operation);
      
      const result: EasCommandResult = {
        command: `eas credentials ${this.formatFlags(flags)}`.trim(),
        description: `Manage ${platform} credentials - ${operation}`,
        prerequisites,
        flags,
        estimated_time: this.estimateCredentialsTime(operation),
        documentation_url: `https://docs.expo.dev/app-signing/app-credentials/`
      };

      logger.info(`Credentials command generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate credentials command:', error);
      throw error;
    }
  }

  /**
   * app.json テンプレート生成
   */
  async generateAppJsonTemplate(projectContext: ProjectContext): Promise<ConfigTemplate> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating app.json template for project: ${projectContext.name}`);
      
      const template: any = {
        expo: {
          name: projectContext.name || "ExpoApp",
          slug: this.generateSlug(projectContext.name),
          version: "1.0.0",
          orientation: "portrait",
          icon: "./assets/icon.png",
          userInterfaceStyle: "light",
          splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
          },
          assetBundlePatterns: [
            "**/*"
          ],
          ios: this.generateIosConfig(projectContext),
          android: this.generateAndroidConfig(projectContext),
          web: this.generateWebConfig(projectContext),
          extra: {
            eas: {
              projectId: "your-project-id"
            }
          },
          runtimeVersion: {
            policy: "sdkVersion"
          },
          updates: {
            url: "https://u.expo.dev/your-project-id"
          }
        }
      };

      // SDK バージョン設定
      if (projectContext.sdk_version && projectContext.sdk_version !== 'latest') {
        template.expo.sdkVersion = projectContext.sdk_version.replace('sdk-', '');
      }

      const content = JSON.stringify(template, null, 2);
      const validationResult = this.validateAppJson(template);
      
      const result: ConfigTemplate = {
        content,
        validation_errors: validationResult.errors,
        suggestions: validationResult.suggestions,
        config_type: 'app.json',
        schema_version: '49.0.0'
      };

      logger.info(`app.json template generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate app.json template:', error);
      throw error;
    }
  }

  /**
   * eas.json テンプレート生成
   */
  async generateEasJsonTemplate(projectContext: ProjectContext): Promise<ConfigTemplate> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating eas.json template for project: ${projectContext.name}`);
      
      const template = {
        cli: {
          version: ">= 5.9.0"
        },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal",
            ios: {
              resourceClass: "m-medium"
            },
            android: {
              resourceClass: "medium"
            }
          },
          preview: {
            distribution: "internal",
            ios: {
              resourceClass: "m-medium"
            },
            android: {
              resourceClass: "medium"
            }
          },
          production: {
            ios: {
              resourceClass: "m-medium"
            },
            android: {
              resourceClass: "large"
            }
          }
        },
        submit: {
          production: this.generateSubmitConfig(projectContext)
        }
      };

      const content = JSON.stringify(template, null, 2);
      const validationResult = this.validateEasJson(template);
      
      const result: ConfigTemplate = {
        content,
        validation_errors: validationResult.errors,
        suggestions: validationResult.suggestions,
        config_type: 'eas.json',
        schema_version: '5.9.0'
      };

      logger.info(`eas.json template generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate eas.json template:', error);
      throw error;
    }
  }

  /**
   * metro.config.js テンプレート生成
   */
  async generateMetroConfigTemplate(projectContext: ProjectContext): Promise<ConfigTemplate> {
    const startTime = Date.now();
    
    try {
      logger.info(`Generating metro.config.js template for project: ${projectContext.name}`);
      
      const template = `// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Customize the config before returning it.
${this.generateMetroCustomizations(projectContext)}

module.exports = config;`;

      const validationResult = this.validateMetroConfig(template);
      
      const result: ConfigTemplate = {
        content: template,
        validation_errors: validationResult.errors,
        suggestions: validationResult.suggestions,
        config_type: 'metro.config.js',
        schema_version: '0.80.0'
      };

      logger.info(`metro.config.js template generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate metro.config.js template:', error);
      throw error;
    }
  }

  // ========== Part 2/2: Advanced Features ==========

  /**
   * Snack互換コード生成
   */
  async generateSnackCompatibleCode(
    moduleNames: string[], 
    codePattern: string, 
    projectContext: ProjectContext
  ): Promise<SnackConfig> {
    const startTime = Date.now();
    logger.info(`Generating Snack-compatible code for modules: ${moduleNames.join(', ')}`);
    
    try {
      // 依存関係解決
      const dependencies = await this.resolveDependencies(moduleNames, projectContext.sdk_version);
      
      // プラットフォーム別コード生成
      const generatedCode = await this.generatePlatformSpecificCode(
        codePattern, 
        moduleNames, 
        projectContext.platforms || ['ios', 'android', 'web']
      );
      
      const snackConfig: SnackConfig = {
        dependencies,
        code: generatedCode,
        name: `${projectContext.name || 'ExpoApp'} Example`,
        description: `Example using ${moduleNames.join(', ')} modules`,
        platforms: projectContext.platforms || ['ios', 'android', 'web'],
        sdkVersion: this.mapSDKVersionForSnack(projectContext.sdk_version)
      };
      
      logger.info(`Snack-compatible code generated in ${Date.now() - startTime}ms`);
      return snackConfig;
    } catch (error) {
      logger.error('Failed to generate Snack-compatible code:', error);
      throw error;
    }
  }

  /**
   * 依存関係解決
   */
  async resolveDependencies(moduleNames: string[], sdkVersion?: string): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {};
    const expoDependencies: Record<string, string> = {};
    
    // 基本のExpo SDKバージョン
    const targetSDKVersion = sdkVersion || 'latest';
    const sdkVersionNumber = this.getSDKVersionNumber(targetSDKVersion);
    
    // Expo SDK核心依存関係
    dependencies['expo'] = `~${sdkVersionNumber}.0.0`;
    
    for (const moduleName of moduleNames) {
      const moduleInfo = await this.getModuleDependencyInfo(moduleName, targetSDKVersion);
      
      if (moduleInfo.isExpoModule) {
        // Expo公式モジュール
        expoDependencies[moduleInfo.packageName] = moduleInfo.version;
      } else {
        // サードパーティモジュール
        dependencies[moduleInfo.packageName] = moduleInfo.version;
      }
      
      // 必要な追加依存関係
      if (moduleInfo.peerDependencies) {
        Object.assign(dependencies, moduleInfo.peerDependencies);
      }
    }
    
    // Expo依存関係をマージ
    Object.assign(dependencies, expoDependencies);
    
    // Snack互換性チェック
    return this.filterSnackCompatibleDependencies(dependencies);
  }

  /**
   * プラットフォーム別コード生成
   */
  async generatePlatformSpecificCode(
    pattern: string, 
    moduleNames: string[], 
    platforms: string[]
  ): Promise<string> {
    const imports = moduleNames.map(name => {
      const importName = this.getModuleImportName(name);
      return `import ${importName} from 'expo-${name}';`;
    }).join('\n');
    
    const platformChecks = platforms.map(platform => {
      switch (platform) {
        case 'ios':
          return `  // iOS specific code\n  if (Platform.OS === 'ios') {\n    console.log('Running on iOS');\n  }`;
        case 'android':
          return `  // Android specific code\n  if (Platform.OS === 'android') {\n    console.log('Running on Android');\n  }`;
        case 'web':
          return `  // Web specific code\n  if (Platform.OS === 'web') {\n    console.log('Running on Web');\n  }`;
        default:
          return '';
      }
    }).filter(Boolean).join('\n\n');
    
    return `import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
${imports}

export default function App() {
  React.useEffect(() => {
${platformChecks}
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Expo ${moduleNames.join(' + ')} Example
      </Text>
      <Text style={styles.platform}>
        Platform: {Platform.OS}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  platform: {
    fontSize: 14,
    color: '#666',
  },
});`;
  }

  /**
   * Snack URL生成
   */
  async generateSnackUrl(snackConfig: SnackConfig): Promise<SnackResult> {
    const startTime = Date.now();
    logger.info(`Generating Snack URL for: ${snackConfig.name}`);
    
    try {
      // Snack API へのリクエスト準備（模擬実装）
      const snackData = {
        files: {
          'App.js': {
            type: 'CODE',
            contents: snackConfig.code
          },
          'package.json': {
            type: 'CODE',
            contents: JSON.stringify({
              dependencies: snackConfig.dependencies
            }, null, 2)
          }
        },
        name: snackConfig.name,
        description: snackConfig.description || '',
        sdkVersion: snackConfig.sdkVersion || '49.0.0'
      };
      
      // 実際の実装では、ここでSnack APIにPOSTリクエストを送信
      logger.info(`Prepared Snack data with ${Object.keys(snackData.files).length} files`);
      
      // SnackのURL生成（実際にはAPI呼び出し）
      const snackId = this.generateSnackId(snackConfig);
      const baseUrl = 'https://snack.expo.dev';
      
      // 互換性スコア計算
      const compatibilityScore = await this.calculateSnackCompatibility(snackConfig);
      
      const result: SnackResult = {
        url: `${baseUrl}/${snackId}`,
        embed_url: `${baseUrl}/embedded/${snackId}`,
        web_player_url: `${baseUrl}/${snackId}?platform=web`,
        dependencies: snackConfig.dependencies,
        compatibility_score: compatibilityScore,
        platform_support: snackConfig.platforms || ['ios', 'android', 'web']
      };
      
      logger.info(`Snack URL generated in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to generate Snack URL:', error);
      throw error;
    }
  }

  /**
   * プラグイン設定バリデーション
   */
  async validatePluginConfiguration(
    pluginName: string, 
    pluginConfig: any, 
    projectContext: ProjectContext
  ): Promise<PluginValidationResult> {
    const startTime = Date.now();
    logger.info(`Validating plugin configuration: ${pluginName}`);
    
    try {
      const pluginInfo = await this.getPluginInfo(pluginName);
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // バージョン互換性チェック
      const versionCompatible = this.checkPluginVersionCompatibility(
        pluginInfo, 
        projectContext.sdk_version
      );
      
      if (!versionCompatible) {
        issues.push(`Plugin ${pluginName} may not be compatible with SDK ${projectContext.sdk_version}`);
        suggestions.push('Consider updating to a compatible version or SDK version');
      }
      
      // プラットフォーム対応確認
      const platformSupport = this.getPluginPlatformSupport(pluginInfo, projectContext.platforms);
      const unsupportedPlatforms = (projectContext.platforms || []).filter(
        platform => !platformSupport.includes(platform)
      );
      
      if (unsupportedPlatforms.length > 0) {
        issues.push(`Plugin ${pluginName} does not support: ${unsupportedPlatforms.join(', ')}`);
        suggestions.push('Consider platform-specific alternatives or conditional usage');
      }
      
      // 設定バリデーション
      const configValidation = this.validatePluginConfigSchema(pluginInfo, pluginConfig);
      issues.push(...configValidation.errors);
      suggestions.push(...configValidation.suggestions);
      
      const result: PluginValidationResult = {
        plugin_name: pluginName,
        is_valid: issues.length === 0,
        version_compatible: versionCompatible,
        platform_support: platformSupport,
        issues,
        suggestions
      };
      
      logger.info(`Plugin validation completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      logger.error('Failed to validate plugin configuration:', error);
      throw error;
    }
  }

  /**
   * 設定最適化提案
   */
  async generateOptimizationSuggestions(
    configType: string, 
    configContent: any, 
    projectContext: ProjectContext
  ): Promise<OptimizationSuggestion[]> {
    const startTime = Date.now();
    logger.info(`Generating optimization suggestions for: ${configType}`);
    
    try {
      const suggestions: OptimizationSuggestion[] = [];
      
      switch (configType) {
        case 'app.json':
          suggestions.push(...this.analyzeAppJsonOptimizations(configContent, projectContext));
          break;
        case 'eas.json':
          suggestions.push(...this.analyzeEasJsonOptimizations(configContent, projectContext));
          break;
        case 'metro.config.js':
          suggestions.push(...this.analyzeMetroOptimizations(configContent, projectContext));
          break;
      }
      
      // 汎用最適化提案
      suggestions.push(...this.getGeneralOptimizations(projectContext));
      
      // 優先度順にソート
      suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      logger.info(`Generated ${suggestions.length} optimization suggestions in ${Date.now() - startTime}ms`);
      return suggestions;
    } catch (error) {
      logger.error('Failed to generate optimization suggestions:', error);
      throw error;
    }
  }

  // ========== Private Helper Methods ==========

  private buildBaseCommand(operation: string, platform: string, profile: string): string {
    const parts: string[] = [];
    
    // Submit操作では'all'プラットフォームでも明示的に指定
    if (platform && platform !== 'all') {
      parts.push(`--platform ${platform}`);
    } else if (platform === 'all' && operation === 'submit') {
      parts.push(`--platform all`);
    }
    
    if (profile && profile !== 'development') {
      parts.push(`--profile ${profile}`);
    }
    
    return parts.join(' ');
  }

  private buildCommandFlags(operation: string, platform: string, profile: string, additionalFlags?: Record<string, string>): Record<string, string> {
    const flags: Record<string, string> = {};
    
    // プラットフォーム検証
    const validPlatforms = ['ios', 'android', 'all'];
    if (platform && !validPlatforms.includes(platform)) {
      throw new Error(`Invalid platform: ${platform}. Valid platforms are: ${validPlatforms.join(', ')}`);
    }
    
    // 基本フラグ
    if (platform && platform !== 'all') {
      flags.platform = platform;
    }
    if (profile) {
      flags.profile = profile;
    }
    
    // オペレーション別フラグ
    switch (operation) {
      case 'build':
        if (profile === 'development') {
          flags['development-client'] = 'true';
        }
        break;
      case 'submit':
        flags.latest = 'true';
        break;
      case 'update':
        flags.auto = 'true';
        break;
    }
    
    // 追加フラグ
    if (additionalFlags) {
      Object.assign(flags, additionalFlags);
    }
    
    return flags;
  }

  private buildCredentialsFlags(platform: string, operation: string, additionalFlags?: Record<string, string>): Record<string, string> {
    const flags: Record<string, string> = {
      platform: platform
    };
    
    // オペレーション別フラグ
    switch (operation) {
      case 'configure':
        // 既存の認証情報を設定
        break;
      case 'reset':
        flags.clear = 'true';
        break;
      case 'validate':
        flags.check = 'true';
        break;
    }
    
    if (additionalFlags) {
      Object.assign(flags, additionalFlags);
    }
    
    return flags;
  }

  private formatFlags(flags: Record<string, string>): string {
    return Object.entries(flags)
      .map(([key, value]) => {
        if (value === 'true') {
          return `--${key}`;
        }
        return `--${key} ${value}`;
      })
      .join(' ');
  }

  private getBuildPrerequisites(platform: string): string[] {
    const common = [
      'Install EAS CLI: npm install -g eas-cli',
      'Login to Expo account: eas login',
      'Initialize EAS: eas build:configure'
    ];
    
    if (platform === 'ios' || platform === 'all') {
      common.push('Apple Developer account required');
      common.push('iOS bundle identifier configured');
    }
    
    if (platform === 'android' || platform === 'all') {
      common.push('Android package name configured');
      common.push('Keystore configured (for production)');
    }
    
    return common;
  }

  private getSubmitPrerequisites(platform: string): string[] {
    const common = [
      'App successfully built with EAS',
      'Store credentials configured'
    ];
    
    if (platform === 'ios') {
      common.push('App Store Connect account');
      common.push('App Store listing created');
      common.push('iOS distribution certificate');
    }
    
    if (platform === 'android') {
      common.push('Google Play Console account');
      common.push('App listing created in Google Play');
      common.push('Upload keystore configured');
    }
    
    return common;
  }

  private getUpdatePrerequisites(): string[] {
    return [
      'EAS Update configured in app.json',
      'Runtime version properly set',
      'Update URL configured',
      'EAS CLI logged in'
    ];
  }

  private getCredentialsPrerequisites(platform: string, operation: string): string[] {
    const common = [
      'EAS CLI installed and logged in',
      'Project configured for EAS'
    ];
    
    if (platform === 'ios') {
      common.push('Apple Developer account');
      if (operation === 'configure') {
        common.push('Development/Distribution certificates');
        common.push('Provisioning profiles');
      }
    }
    
    if (platform === 'android') {
      if (operation === 'configure') {
        common.push('Keystore file or credentials');
      }
    }
    
    return common;
  }

  private estimateBuildTime(platform: string, profile: string): string {
    if (platform === 'all') return '8-15 minutes';
    if (profile === 'development') return '3-8 minutes';
    if (platform === 'ios') return '4-10 minutes';
    if (platform === 'android') return '5-12 minutes';
    return '5-10 minutes';
  }

  private estimateSubmitTime(platform: string): string {
    if (platform === 'ios') return '1-3 minutes';
    if (platform === 'android') return '1-2 minutes';
    return '1-3 minutes';
  }

  private estimateUpdateTime(): string {
    return '30 seconds - 2 minutes';
  }

  private estimateCredentialsTime(operation: string): string {
    if (operation === 'configure') return '2-5 minutes';
    if (operation === 'reset') return '30 seconds - 1 minute';
    return '1-3 minutes';
  }

  private generateSlug(name?: string): string {
    if (!name) return 'expo-app';
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateIosConfig(projectContext: ProjectContext): any {
    const config: any = {
      bundleIdentifier: projectContext.bundle_identifier || "com.example.app"
    };
    
    if (projectContext.platforms?.includes('ios')) {
      config.supportsTablet = true;
    }
    
    return config;
  }

  private generateAndroidConfig(projectContext: ProjectContext): any {
    const config: any = {
      package: projectContext.package_name || "com.example.app",
      versionCode: 1
    };
    
    if (projectContext.platforms?.includes('android')) {
      config.adaptiveIcon = {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      };
    }
    
    return config;
  }

  private generateWebConfig(projectContext: ProjectContext): any {
    if (!projectContext.platforms?.includes('web')) return undefined;
    
    return {
      favicon: "./assets/favicon.png"
    };
  }

  private generateSubmitConfig(projectContext: ProjectContext): any {
    const config: any = {};
    
    if (projectContext.platforms?.includes('ios')) {
      config.ios = {
        appleId: "your-apple-id@example.com",
        ascAppId: "1234567890",
        appleTeamId: "YOUR_TEAM_ID"
      };
    }
    
    if (projectContext.platforms?.includes('android')) {
      config.android = {
        serviceAccountKeyPath: "./service-account-key.json",
        track: "internal"
      };
    }
    
    return config;
  }

  private generateMetroCustomizations(projectContext: ProjectContext): string {
    const customizations: string[] = [];
    
    if (projectContext.platforms?.includes('web')) {
      customizations.push(`// Enable web support
config.resolver.platforms = ['ios', 'android', 'native', 'web'];`);
    }
    
    customizations.push(`// Add custom resolver options
// config.resolver.alias = {
//   '@components': './src/components',
//   '@utils': './src/utils',
// };`);
    
    customizations.push(`// Configure transformer options
// config.transformer.minifierConfig = {
//   keep_fnames: true,
//   mangle: {
//     keep_fnames: true,
//   },
// };`);
    
    return customizations.join('\n\n');
  }

  private validateAppJson(template: any): { errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // 必須フィールド検証
    if (!template.expo?.name) {
      errors.push('Missing required field: expo.name');
    }
    if (!template.expo?.slug) {
      errors.push('Missing required field: expo.slug');
    }
    
    // 推奨事項
    if (!template.expo?.icon) {
      suggestions.push('Add app icon: expo.icon');
    }
    if (!template.expo?.splash) {
      suggestions.push('Configure splash screen: expo.splash');
    }
    if (!template.expo?.extra?.eas?.projectId || template.expo.extra.eas.projectId === 'your-project-id') {
      suggestions.push('Set EAS project ID for builds: expo.extra.eas.projectId');
    }
    
    return { errors, suggestions };
  }

  private validateEasJson(template: any): { errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // 必須フィールド検証
    if (!template.build) {
      errors.push('Missing required field: build');
    }
    if (!template.cli?.version) {
      suggestions.push('Specify EAS CLI version: cli.version');
    }
    
    // プロファイル検証
    if (template.build && !template.build.production) {
      suggestions.push('Add production build profile');
    }
    
    return { errors, suggestions };
  }

  private validateMetroConfig(template: string): { errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // 基本構文検証
    if (!template.includes('getDefaultConfig')) {
      errors.push('Missing getDefaultConfig import');
    }
    if (!template.includes('module.exports')) {
      errors.push('Missing module.exports');
    }
    
    // 推奨事項
    if (!template.includes('resolver.alias')) {
      suggestions.push('Consider adding path aliases for better imports');
    }
    
    return { errors, suggestions };
  }

  // ========== Part 2/2: Helper Methods ==========

  private mapSDKVersionForSnack(sdkVersion?: string): string {
    if (!sdkVersion || sdkVersion === 'latest') {
      return '49.0.0';
    }
    const match = sdkVersion.match(/sdk-(\d+)/);
    return match ? `${match[1]}.0.0` : '49.0.0';
  }

  private getSDKVersionNumber(sdkVersion: string): string {
    if (sdkVersion === 'latest') return '49';
    const match = sdkVersion.match(/sdk-(\d+)/);
    return match ? match[1] : '49';
  }

  private async getModuleDependencyInfo(moduleName: string, sdkVersion: string): Promise<any> {
    // 模擬実装 - 実際にはExpo APIまたはnpm registryから取得
    const isExpoModule = ['camera', 'location', 'notifications', 'constants', 'media-library'].includes(moduleName);
    const version = isExpoModule ? `~${this.getSDKVersionNumber(sdkVersion)}.1.0` : 'latest';
    
    return {
      packageName: isExpoModule ? `expo-${moduleName}` : moduleName,
      version,
      isExpoModule,
      peerDependencies: isExpoModule ? {} : { 'react': '>=18.0.0', 'react-native': '>=0.70.0' }
    };
  }

  private filterSnackCompatibleDependencies(dependencies: Record<string, string>): Record<string, string> {
    // Snackでサポートされていない依存関係を除外
    const unsupportedPackages = ['@react-native-async-storage/async-storage', 'react-native-sqlite-storage'];
    const filtered: Record<string, string> = {};
    
    for (const [pkg, version] of Object.entries(dependencies)) {
      if (!unsupportedPackages.includes(pkg)) {
        filtered[pkg] = version;
      }
    }
    
    return filtered;
  }

  private getModuleImportName(moduleName: string): string {
    // camelCaseに変換
    return moduleName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
                    .replace(/^[a-z]/, letter => letter.toUpperCase());
  }

  private generateSnackId(snackConfig: SnackConfig): string {
    // 実際にはSnack APIを呼び出してIDを取得
    const hash = Buffer.from(snackConfig.name + Date.now()).toString('base64')
                       .replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    return hash;
  }

  private async calculateSnackCompatibility(snackConfig: SnackConfig): Promise<number> {
    let score = 100;
    
    // 依存関係の数でスコア調整
    const depCount = Object.keys(snackConfig.dependencies).length;
    if (depCount > 10) score -= 20;
    else if (depCount > 5) score -= 10;
    
    // プラットフォーム対応でスコア調整
    const platforms = snackConfig.platforms || [];
    if (platforms.includes('web')) score += 5;
    if (platforms.length < 3) score -= 15;
    
    // SDKバージョンでスコア調整
    if (snackConfig.sdkVersion && snackConfig.sdkVersion.startsWith('48')) {
      score -= 10; // 古いバージョン
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private async getPluginInfo(pluginName: string): Promise<any> {
    // 模擬実装 - 実際にはExpo plugin registryから取得
    const pluginDatabase: Record<string, any> = {
      'expo-camera': {
        supportedSDKVersions: ['47', '48', '49'],
        platforms: ['ios', 'android'],
        configSchema: {
          cameraPermission: 'string',
          microphonePermission: 'string'
        }
      },
      'expo-location': {
        supportedSDKVersions: ['47', '48', '49'],
        platforms: ['ios', 'android', 'web'],
        configSchema: {
          locationAlwaysAndWhenInUsePermission: 'string'
        }
      }
    };
    
    return pluginDatabase[pluginName] || {
      supportedSDKVersions: ['49'],
      platforms: ['ios', 'android', 'web'],
      configSchema: {}
    };
  }

  private checkPluginVersionCompatibility(pluginInfo: any, sdkVersion?: string): boolean {
    if (!sdkVersion) return true;
    const versionNumber = this.getSDKVersionNumber(sdkVersion);
    return pluginInfo.supportedSDKVersions.includes(versionNumber);
  }

  private getPluginPlatformSupport(pluginInfo: any, _requestedPlatforms?: string[]): string[] {
    return pluginInfo.platforms || ['ios', 'android', 'web'];
  }

  private validatePluginConfigSchema(pluginInfo: any, config: any): { errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    
    // 簡単なスキーマ検証
    for (const [key, expectedType] of Object.entries(pluginInfo.configSchema || {})) {
      if (config && config[key] !== undefined) {
        const actualType = typeof config[key];
        if (actualType !== expectedType) {
          errors.push(`Property ${key} should be ${expectedType}, got ${actualType}`);
        }
      } else {
        suggestions.push(`Consider setting ${key} property`);
      }
    }
    
    return { errors, suggestions };
  }

  private analyzeAppJsonOptimizations(config: any, _projectContext: ProjectContext): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // アセット最適化
    if (!config.expo?.assetBundlePatterns) {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'Asset Bundle Patterns Optimization',
        description: 'Configure assetBundlePatterns to reduce bundle size',
        fix_command: 'Add "assetBundlePatterns": ["**/*"] to expo config',
        documentation_url: 'https://docs.expo.dev/versions/latest/config/app/#assetbundlepatterns'
      });
    }
    
    // アイコン設定
    if (!config.expo?.icon) {
      suggestions.push({
        category: 'maintainability',
        priority: 'high',
        title: 'Missing App Icon',
        description: 'Add app icon for better user experience',
        fix_command: 'Add "icon": "./assets/icon.png" to expo config',
        documentation_url: 'https://docs.expo.dev/versions/latest/config/app/#icon'
      });
    }
    
    return suggestions;
  }

  private analyzeEasJsonOptimizations(config: any, projectContext: ProjectContext): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // リソースクラス最適化
    if (config.build?.production?.ios?.resourceClass === 'default') {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'iOS Build Resource Class',
        description: 'Consider using m-medium for faster builds',
        fix_command: 'Set resourceClass to "m-medium" in eas.json',
        documentation_url: 'https://docs.expo.dev/build-reference/infrastructure/'
      });
    }
    
    // プラットフォーム特化最適化
    if (projectContext.platforms?.includes('android') && !config.build?.production?.android?.buildType) {
      suggestions.push({
        category: 'performance',
        priority: 'medium',
        title: 'Android Build Type Optimization',
        description: 'Configure buildType for Android builds',
        fix_command: 'Add buildType: "apk" or "app-bundle" to android profile',
        documentation_url: 'https://docs.expo.dev/build-reference/apk/'
      });
    }
    
    return suggestions;
  }

  private analyzeMetroOptimizations(config: any, projectContext: ProjectContext): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // Web対応
    if (!config.includes('web') && projectContext.platforms?.includes('web')) {
      suggestions.push({
        category: 'compatibility',
        priority: 'high',
        title: 'Web Platform Support',
        description: 'Add web platform support to Metro config',
        fix_command: 'Add resolver.platforms array including "web"',
        documentation_url: 'https://docs.expo.dev/guides/customizing-metro/'
      });
    }
    
    return suggestions;
  }

  private getGeneralOptimizations(projectContext: ProjectContext): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    // SDK更新提案
    if (projectContext.sdk_version && projectContext.sdk_version !== 'latest') {
      const currentVersion = this.getSDKVersionNumber(projectContext.sdk_version);
      if (parseInt(currentVersion) < 49) {
        suggestions.push({
          category: 'security',
          priority: 'high',
          title: 'SDK Version Update',
          description: `Consider upgrading from SDK ${currentVersion} to latest for security and features`,
          fix_command: 'expo install --fix',
          documentation_url: 'https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/'
        });
      }
    }
    
    return suggestions;
  }
} 