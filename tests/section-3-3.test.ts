import { EasConfigManager, ProjectContext } from '../src/services/eas-config-manager';

describe('Section 3.3: EAS・設定管理機能 Part 1/2', () => {
  let easConfigManager: EasConfigManager;

  beforeEach(() => {
    easConfigManager = new EasConfigManager();
  });

  describe('EAS コマンドビルダー', () => {
    test('ビルドコマンド生成実装', async () => {
      const result = await easConfigManager.generateBuildCommand('ios', 'development');
      
      expect(result).toBeDefined();
      expect(result.command).toContain('eas build');
      expect(result.command).toContain('--platform ios');
      expect(result.description).toContain('Build for ios');
      expect(result.prerequisites).toContain('Install EAS CLI: npm install -g eas-cli');
      expect(result.estimated_time).toBeDefined();
      expect(result.documentation_url).toBe('https://docs.expo.dev/build/setup/');
      
      // 開発ビルドの特有フラグ確認
      expect(result.flags).toHaveProperty('development-client', 'true');
    });

    test('サブミットコマンド生成実装', async () => {
      const result = await easConfigManager.generateSubmitCommand('ios', 'production');
      
      expect(result).toBeDefined();
      expect(result.command).toContain('eas submit');
      expect(result.command).toContain('--platform ios');
      expect(result.description).toContain('Submit ios app to App Store');
      expect(result.prerequisites).toContain('App Store Connect account');
      expect(result.documentation_url).toBe('https://docs.expo.dev/submit/introduction/');
      
      // サブミット特有フラグ確認
      expect(result.flags).toHaveProperty('latest', 'true');
    });

    test('アップデートコマンド生成実装', async () => {
      const result = await easConfigManager.generateUpdateCommand('all', 'production');
      
      expect(result).toBeDefined();
      expect(result.command).toContain('eas update');
      expect(result.description).toContain('Publish OTA update');
      expect(result.prerequisites).toContain('EAS Update configured in app.json');
      expect(result.documentation_url).toBe('https://docs.expo.dev/eas-update/introduction/');
      expect(result.estimated_time).toBe('30 seconds - 2 minutes');
      
      // アップデート特有フラグ確認
      expect(result.flags).toHaveProperty('auto', 'true');
    });

    test('認証情報管理コマンド生成', async () => {
      const result = await easConfigManager.generateCredentialsCommand('ios', 'production', 'configure');
      
      expect(result).toBeDefined();
      expect(result.command).toContain('eas credentials');
      expect(result.command).toContain('--platform ios');
      expect(result.description).toContain('Manage ios credentials - configure');
      expect(result.prerequisites).toContain('Apple Developer account');
      expect(result.documentation_url).toBe('https://docs.expo.dev/app-signing/app-credentials/');
    });

    test('フラグ・オプション管理', async () => {
      const additionalFlags = { 'non-interactive': 'true', 'clear-cache': 'true' };
      const result = await easConfigManager.generateBuildCommand('android', 'production', additionalFlags);
      
      expect(result.flags).toHaveProperty('non-interactive', 'true');
      expect(result.flags).toHaveProperty('clear-cache', 'true');
      expect(result.command).toContain('--non-interactive');
      expect(result.command).toContain('--clear-cache');
    });
  });

  describe('設定ファイル生成', () => {
    const projectContext: ProjectContext = {
      name: 'TestApp',
      platforms: ['ios', 'android', 'web'],
      sdk_version: 'sdk-49',
      bundle_identifier: 'com.test.app',
      package_name: 'com.test.app'
    };

    test('app.json テンプレート生成', async () => {
      const result = await easConfigManager.generateAppJsonTemplate(projectContext);
      
      expect(result).toBeDefined();
      expect(result.config_type).toBe('app.json');
      expect(result.schema_version).toBe('49.0.0');
      expect(result.validation_errors).toBeDefined();
      expect(result.suggestions).toBeDefined();
      
      // 生成されたJSONの検証
      const config = JSON.parse(result.content);
      expect(config.expo.name).toBe('TestApp');
      expect(config.expo.slug).toBe('testapp');
      expect(config.expo.sdkVersion).toBe('49');
      expect(config.expo.ios.bundleIdentifier).toBe('com.test.app');
      expect(config.expo.android.package).toBe('com.test.app');
      expect(config.expo.web).toBeDefined(); // web プラットフォーム設定
      expect(config.expo.extra.eas.projectId).toBe('your-project-id');
    });

    test('eas.json テンプレート生成', async () => {
      const result = await easConfigManager.generateEasJsonTemplate(projectContext);
      
      expect(result).toBeDefined();
      expect(result.config_type).toBe('eas.json');
      expect(result.schema_version).toBe('5.9.0');
      
      // 生成されたJSONの検証
      const config = JSON.parse(result.content);
      expect(config.cli.version).toBe('>= 5.9.0');
      expect(config.build.development).toBeDefined();
      expect(config.build.preview).toBeDefined();
      expect(config.build.production).toBeDefined();
      expect(config.build.development.developmentClient).toBe(true);
      expect(config.build.production.ios.resourceClass).toBe('m-medium');
      expect(config.build.production.android.resourceClass).toBe('large');
      expect(config.submit.production).toBeDefined();
    });

    test('metro.config.js テンプレート生成', async () => {
      const result = await easConfigManager.generateMetroConfigTemplate(projectContext);
      
      expect(result).toBeDefined();
      expect(result.config_type).toBe('metro.config.js');
      expect(result.schema_version).toBe('0.80.0');
      
      // 生成されたコードの検証
      expect(result.content).toContain('getDefaultConfig');
      expect(result.content).toContain('module.exports = config');
      expect(result.content).toContain('web'); // web プラットフォーム対応
      expect(result.content).toContain('resolver.platforms');
    });

    test('設定バリデーション確認', async () => {
      // 不完全なプロジェクトコンテキストでテスト
      const incompleteContext: ProjectContext = {};
      const result = await easConfigManager.generateAppJsonTemplate(incompleteContext);
      
      expect(result.validation_errors).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      
      // 推奨事項確認
      expect(result.suggestions.some(s => s.includes('Set EAS project ID'))).toBe(true);
    });
  });

  describe('パフォーマンス・品質確認', () => {
    test('EAS コマンド生成応答時間確認', async () => {
      const startTime = Date.now();
      await easConfigManager.generateBuildCommand('ios', 'development');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(200); // 200ms以内
    });

    test('設定ファイル生成応答時間確認', async () => {
      const projectContext: ProjectContext = {
        name: 'PerfTestApp',
        platforms: ['ios', 'android'],
        sdk_version: 'latest'
      };
      
      const startTime = Date.now();
      await easConfigManager.generateAppJsonTemplate(projectContext);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
    });

    test('全プラットフォーム対応確認', async () => {
      // iOS
      const iosResult = await easConfigManager.generateBuildCommand('ios', 'production');
      expect(iosResult.prerequisites).toContain('Apple Developer account required');
      
      // Android
      const androidResult = await easConfigManager.generateBuildCommand('android', 'production');
      expect(androidResult.prerequisites).toContain('Android package name configured');
      
      // All platforms
      const allResult = await easConfigManager.generateBuildCommand('all', 'production');
      expect(allResult.estimated_time).toBe('8-15 minutes');
    });
  });

  describe('エラーハンドリング確認', () => {
    test('無効なプラットフォーム処理', async () => {
      await expect(async () => {
        await easConfigManager.generateBuildCommand('invalid' as any, 'development');
      }).rejects.toThrow();
    });

    test('無効な設定タイプ処理', async () => {
      await expect(async () => {
        // @ts-expect-error - Testing invalid input
        await easConfigManager.generateAppJsonTemplate({ name: null });
      }).not.toThrow(); // エラーではなく、適切なデフォルト値を使用する
    });
  });

  describe('実装漏れチェック', () => {
    test('EAS全機能対応確認', async () => {
      // Build
      const buildResult = await easConfigManager.generateBuildCommand('ios', 'development');
      expect(buildResult.command).toBeDefined();
      
      // Submit
      const submitResult = await easConfigManager.generateSubmitCommand('android', 'production');
      expect(submitResult.command).toBeDefined();
      
      // Update
      const updateResult = await easConfigManager.generateUpdateCommand('all', 'preview');
      expect(updateResult.command).toBeDefined();
      
      // Credentials
      const credentialsResult = await easConfigManager.generateCredentialsCommand('ios', 'production', 'configure');
      expect(credentialsResult.command).toBeDefined();
    });

    test('設定ファイル全種類対応確認', async () => {
      const projectContext: ProjectContext = {
        name: 'CompleteApp',
        platforms: ['ios', 'android', 'web']
      };
      
      // app.json
      const appJson = await easConfigManager.generateAppJsonTemplate(projectContext);
      expect(appJson.config_type).toBe('app.json');
      
      // eas.json
      const easJson = await easConfigManager.generateEasJsonTemplate(projectContext);
      expect(easJson.config_type).toBe('eas.json');
      
      // metro.config.js
      const metroConfig = await easConfigManager.generateMetroConfigTemplate(projectContext);
      expect(metroConfig.config_type).toBe('metro.config.js');
    });
  });

  // ========== Part 2/2: Advanced Features Tests ==========

  describe('Snack統合機能', () => {
    test('Snack互換コード生成', async () => {
      const snackConfig = await easConfigManager.generateSnackCompatibleCode(
        ['camera', 'location'],
        'basic',
        { 
          name: 'SnackTest',
          platforms: ['ios', 'android', 'web'],
          sdk_version: 'latest'
        }
      );
      
      expect(snackConfig).toBeDefined();
      expect(snackConfig.code).toContain('import Camera from');
      expect(snackConfig.code).toContain('import Location from');
      expect(snackConfig.dependencies).toBeDefined();
      expect(snackConfig.dependencies['expo']).toBeDefined();
      expect(snackConfig.name).toBe('SnackTest Example');
      expect(snackConfig.platforms).toEqual(['ios', 'android', 'web']);
    });

    test('依存関係解決', async () => {
      const dependencies = await easConfigManager.resolveDependencies(
        ['camera', 'constants'],
        'sdk-49'
      );
      
      expect(dependencies).toBeDefined();
      expect(dependencies['expo']).toBe('~49.0.0');
      expect(dependencies['expo-camera']).toBe('~49.1.0');
      expect(dependencies['expo-constants']).toBe('~49.1.0');
    });

    test('プラットフォーム別コード生成', async () => {
      const code = await easConfigManager.generatePlatformSpecificCode(
        'basic',
        ['camera'],
        ['ios', 'android', 'web']
      );
      
      expect(code).toContain('Platform.OS === \'ios\'');
      expect(code).toContain('Platform.OS === \'android\'');
      expect(code).toContain('Platform.OS === \'web\'');
      expect(code).toContain('import Camera from \'expo-camera\'');
    });

    test('Snack URL生成', async () => {
      const snackConfig = {
        dependencies: { 'expo': '~49.0.0' },
        code: 'console.log("test");',
        name: 'Test Snack',
        platforms: ['ios', 'android', 'web'],
        sdkVersion: '49.0.0'
      };
      
      const snackResult = await easConfigManager.generateSnackUrl(snackConfig);
      
      expect(snackResult).toBeDefined();
      expect(snackResult.url).toContain('https://snack.expo.dev');
      expect(snackResult.embed_url).toContain('embedded');
      expect(snackResult.web_player_url).toContain('platform=web');
      expect(snackResult.compatibility_score).toBeGreaterThan(0);
      expect(snackResult.compatibility_score).toBeLessThanOrEqual(100);
      expect(snackResult.platform_support).toEqual(['ios', 'android', 'web']);
    });
  });

  describe('プラグイン設定バリデーション', () => {
    test('プラグイン設定バリデーション実装', async () => {
      const validation = await easConfigManager.validatePluginConfiguration(
        'expo-camera',
        { cameraPermission: 'Allow app to access camera' },
        { sdk_version: 'sdk-49', platforms: ['ios', 'android'] }
      );
      
      expect(validation).toBeDefined();
      expect(validation.plugin_name).toBe('expo-camera');
      expect(validation.version_compatible).toBe(true);
      expect(validation.platform_support).toEqual(['ios', 'android']);
      expect(validation.is_valid).toBe(true);
    });

    test('非互換プラグインのバリデーション', async () => {
      const validation = await easConfigManager.validatePluginConfiguration(
        'unknown-plugin',
        {},
        { sdk_version: 'sdk-47', platforms: ['ios', 'android', 'web'] }
      );
      
      expect(validation).toBeDefined();
      expect(validation.plugin_name).toBe('unknown-plugin');
      // 不明なプラグインは互換性チェックでfalseになる
      expect(validation.version_compatible).toBe(false);
      expect(validation.platform_support).toEqual(['ios', 'android', 'web']);
    });
  });

  describe('設定最適化提案', () => {
    test('app.json最適化提案生成', async () => {
      const config = {
        expo: {
          name: 'TestApp',
          slug: 'testapp'
          // iconとassetBundlePatternsが欠けている
        }
      };
      
      const suggestions = await easConfigManager.generateOptimizationSuggestions(
        'app.json',
        config,
        { name: 'TestApp', platforms: ['ios', 'android'] }
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // 高優先度の提案があることを確認
      const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
      expect(highPrioritySuggestions.length).toBeGreaterThan(0);
      
      // アイコン設定の提案があることを確認
      const iconSuggestion = suggestions.find(s => s.title.includes('App Icon'));
      expect(iconSuggestion).toBeDefined();
      expect(iconSuggestion?.category).toBe('maintainability');
    });

    test('eas.json最適化提案生成', async () => {
      const config = {
        build: {
          production: {
            ios: {
              resourceClass: 'default'
            }
          }
        }
      };
      
      const suggestions = await easConfigManager.generateOptimizationSuggestions(
        'eas.json',
        config,
        { platforms: ['ios'] }
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // リソースクラス最適化の提案があることを確認
      const resourceClassSuggestion = suggestions.find(s => s.title.includes('Resource Class'));
      expect(resourceClassSuggestion).toBeDefined();
      expect(resourceClassSuggestion?.category).toBe('performance');
    });

    test('metro.config.js最適化提案生成', async () => {
      const config = 'const { getDefaultConfig } = require("expo/metro-config");';
      
      const suggestions = await easConfigManager.generateOptimizationSuggestions(
        'metro.config.js',
        config,
        { platforms: ['ios', 'android', 'web'] }
      );
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Web対応の提案があることを確認
      const webSuggestion = suggestions.find(s => s.title.includes('Web Platform'));
      expect(webSuggestion).toBeDefined();
      expect(webSuggestion?.category).toBe('compatibility');
      expect(webSuggestion?.priority).toBe('high');
    });

    test('汎用最適化提案（SDK更新）', async () => {
      const suggestions = await easConfigManager.generateOptimizationSuggestions(
        'app.json',
        { expo: { name: 'Test' } },
        { sdk_version: 'sdk-47' } // 古いバージョン
      );
      
      expect(suggestions).toBeDefined();
      
      // SDK更新の提案があることを確認
      const sdkUpdateSuggestion = suggestions.find(s => s.title.includes('SDK Version'));
      expect(sdkUpdateSuggestion).toBeDefined();
      expect(sdkUpdateSuggestion?.category).toBe('security');
      expect(sdkUpdateSuggestion?.priority).toBe('high');
    });
  });

  describe('統合テスト（Part 2/2）', () => {
    test('完全ワークフロー: Snack生成からURL生成まで', async () => {
      // 1. Snack互換コード生成
      const snackConfig = await easConfigManager.generateSnackCompatibleCode(
        ['camera'],
        'basic',
        { 
          name: 'CameraDemo',
          platforms: ['ios', 'android'],
          sdk_version: 'latest'
        }
      );
      
      expect(snackConfig.code).toContain('Camera');
      expect(snackConfig.dependencies['expo-camera']).toBeDefined();
      
      // 2. Snack URL生成
      const snackResult = await easConfigManager.generateSnackUrl(snackConfig);
      
      expect(snackResult.url).toContain('https://snack.expo.dev');
      expect(snackResult.compatibility_score).toBeGreaterThan(80); // 高い互換性
    });

    test('設定最適化から実装まで', async () => {
      // 1. 問題のある設定
      const problematicConfig = {
        expo: {
          name: 'TestApp'
          // 多くの設定が欠けている
        }
      };
      
      // 2. 最適化提案取得
      const suggestions = await easConfigManager.generateOptimizationSuggestions(
        'app.json',
        problematicConfig,
        { name: 'TestApp', platforms: ['ios', 'android', 'web'] }
      );
      
      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      
      // 3. 改良版設定テンプレート生成
      const improvedTemplate = await easConfigManager.generateAppJsonTemplate({
        name: 'TestApp',
        platforms: ['ios', 'android', 'web']
      });
      
      expect(improvedTemplate.validation_errors.length).toBe(0);
      expect(improvedTemplate.content).toContain('icon');
      expect(improvedTemplate.content).toContain('splash');
    });

    test('パフォーマンステスト: Part 2/2機能の応答時間', async () => {
      const startTime = Date.now();
      
      // 並行実行でパフォーマンステスト
      const promises = [
        easConfigManager.generateSnackCompatibleCode(['camera'], 'basic', {}),
        easConfigManager.validatePluginConfiguration('expo-camera', {}, {}),
        easConfigManager.generateOptimizationSuggestions('app.json', { expo: {} }, {})
      ];
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(1000); // 1秒以内
      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined(); // Snack config
      expect(results[1]).toBeDefined(); // Plugin validation
      expect(results[2]).toBeDefined(); // Optimization suggestions
    });
  });
}); 