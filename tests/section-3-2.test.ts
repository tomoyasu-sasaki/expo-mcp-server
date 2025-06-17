/**
 * Section 3.2: SDK・API管理機能 テスト
 * 完了条件: Expo SDK情報取得・バージョン管理・API解析機能が正常動作する
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ExpoSDKManager } from '../src/services/sdk-manager';
import { ExpoTools } from '../src/mcp/tools';

describe('Section 3.2: SDK・API管理機能', () => {
  let sdkManager: ExpoSDKManager;

  beforeEach(() => {
    sdkManager = new ExpoSDKManager();
  });

  // =============================================================================
  // SDK モジュール管理テスト
  // =============================================================================

  describe('SDK モジュール管理', () => {
    test('SDK メタデータ取得実装 - camera モジュール', async () => {
      const startTime = Date.now();
      const module = await sdkManager.getSDKModule('camera', 'latest');
      const duration = Date.now() - startTime;

      // 80ms以内の取得速度確認
      expect(duration).toBeLessThan(80);

      // 基本情報確認
      expect(module.name).toBe('camera');
      expect(module.packageName).toBe('expo-camera');
      expect(module.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(module.sdkVersion).toBe('latest');
      expect(module.moduleType).toBe('core');

      // プラットフォーム対応確認
      expect(module.platforms).toContain('ios');
      expect(module.platforms).toContain('android');
      expect(module.platforms.length).toBeGreaterThan(0);

      // メソッド存在確認
      expect(module.methods).toBeDefined();
      expect(module.methods.length).toBeGreaterThan(0);

      // インストール手順確認
      expect(module.installation).toContain('npx expo install');
      expect(module.installation).toContain('expo-camera');
    });

    test('バージョン管理実装 - 複数SDKバージョン対応', async () => {
      const versions = ['latest', 'sdk-49', 'sdk-48'];
      
      for (const version of versions) {
        const module = await sdkManager.getSDKModule('camera', version);
        expect(module.sdkVersion).toBe(version);
        expect(module.version).toMatch(/^\d+\.\d+\.\d+$/);
      }

      // SDKバージョン一覧取得
      const availableVersions = await sdkManager.getAvailableSDKVersions();
      expect(availableVersions).toBeDefined();
      expect(availableVersions.length).toBeGreaterThan(0);
      
      // 最新版が最初に来ることを確認
      expect(availableVersions[0].status).toBe('latest');
    });

    test('プラットフォーム対応状況管理', async () => {
      const compatibility = await sdkManager.getPlatformCompatibility('camera', 'latest');
      
      expect(compatibility).toHaveLength(3); // ios, android, web
      
      const platforms = compatibility.map(c => c.platform);
      expect(platforms).toContain('ios');
      expect(platforms).toContain('android');
      expect(platforms).toContain('web');

      // iOS対応確認
      const iosCompat = compatibility.find(c => c.platform === 'ios');
      expect(iosCompat?.supported).toBe(true);
      expect(iosCompat?.minVersion).toBeDefined();

      // Android対応確認
      const androidCompat = compatibility.find(c => c.platform === 'android');
      expect(androidCompat?.supported).toBe(true);
      expect(androidCompat?.minVersion).toBeDefined();
    });

    test('権限要件管理', async () => {
      const permissions = await sdkManager.getPermissionRequirements('camera');
      
      expect(permissions.required).toContain('CAMERA');
      expect(permissions.description.CAMERA).toBeDefined();
      expect(permissions.description.CAMERA).toContain('カメラ');

      // プラットフォーム別権限フィルタ
      const iosPermissions = await sdkManager.getPermissionRequirements('camera', 'ios');
      const webPermissions = await sdkManager.getPermissionRequirements('camera', 'web');
      
      expect(Array.isArray(iosPermissions.required)).toBe(true);
      expect(webPermissions.required).toHaveLength(0); // Web版では権限要求なし
    });

    test('インストール手順生成', async () => {
      const installation = await sdkManager.generateInstallationSteps('camera', {
        platform: ['ios', 'android'],
        projectType: 'managed',
        typescript: true
      });

      expect(installation.commands).toContain('npx expo install expo-camera');
      expect(installation.configSteps.length).toBeGreaterThan(0);
      expect(installation.additionalNotes.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // API リファレンス処理テスト
  // =============================================================================

  describe('API リファレンス処理', () => {
    test('API メソッド抽出', async () => {
      const methods = await sdkManager.getAPIMethods('camera', 'latest');
      
      expect(methods.length).toBeGreaterThan(0);
      
      const permissionMethod = methods.find(m => m.name.includes('Permission'));
      expect(permissionMethod).toBeDefined();
      expect(permissionMethod?.signature).toContain('Promise');
      expect(permissionMethod?.parameters).toBeDefined();
      expect(permissionMethod?.returnType).toContain('Promise');
      expect(permissionMethod?.platforms.length).toBeGreaterThan(0);
    });

    test('シグネチャ解析', async () => {
      const methods = await sdkManager.getAPIMethods('camera', 'latest');
      const method = methods[0];
      
      const analysis = await sdkManager.analyzeMethodSignature(method);
      
      expect(analysis.parameters).toBeDefined();
      expect(analysis.returnType).toBeDefined();
      expect(analysis.generics).toBeDefined();
      expect(analysis.overloads).toBeDefined();
    });

    test('使用例生成', async () => {
      const examples = await sdkManager.generateUsageExamples('camera');
      
      expect(examples.length).toBeGreaterThan(0);
      
      const example = examples[0];
      expect(example.title).toBeDefined();
      expect(example.code).toBeDefined();
      expect(example.language).toMatch(/^(typescript|javascript)$/);
      expect(example.platforms.length).toBeGreaterThan(0);
      expect(example.dependencies).toBeDefined();
    });

    test('Snack互換コード例生成', async () => {
      const examples = await sdkManager.generateUsageExamples('camera');
      const example = examples[0];
      
      const snackExample = await sdkManager.generateSnackExample('camera', example);
      
      expect(snackExample.code).toContain('import React');
      expect(snackExample.code).toContain('expo-camera');
      expect(snackExample.dependencies['expo-camera']).toBeDefined();
      expect(snackExample.snackUrl).toContain('snack.expo.dev');
    });

    test('定数・型情報管理', async () => {
      const constants = await sdkManager.getModuleConstants('camera');
      const types = await sdkManager.getModuleTypes('camera');

      expect(Object.keys(constants).length).toBeGreaterThanOrEqual(0);
      expect(Object.keys(types).length).toBeGreaterThanOrEqual(0);

      if (Object.keys(constants).length > 0) {
        const firstConstant = Object.values(constants)[0];
        expect(firstConstant.name).toBeDefined();
        expect(firstConstant.type).toBeDefined();
        expect(firstConstant.description).toBeDefined();
      }

      if (Object.keys(types).length > 0) {
        const firstType = Object.values(types)[0];
        expect(firstType.name).toBeDefined();
        expect(firstType.kind).toMatch(/^(interface|type|enum|class)$/);
        expect(firstType.definition).toBeDefined();
      }
    });
  });

  // =============================================================================
  // バージョン互換性管理テスト
  // =============================================================================

  describe('バージョン互換性管理', () => {
    test('SDK バージョン追跡', async () => {
      const versionInfo = await sdkManager.getSDKVersionInfo('sdk-49');
      
      expect(versionInfo.version).toBe('SDK 49');
      expect(versionInfo.status).toMatch(/^(latest|supported|deprecated|unsupported)$/);
      expect(versionInfo.releaseDate).toBeInstanceOf(Date);
      expect(versionInfo.modules).toBeDefined();
      expect(Object.keys(versionInfo.modules).length).toBeGreaterThan(0);
    });

    test('互換性マトリックス', async () => {
      const compatibility = await sdkManager.getPlatformCompatibility('camera', 'sdk-49');
      
      expect(compatibility).toHaveLength(3);
      
      for (const compat of compatibility) {
        expect(compat.platform).toMatch(/^(ios|android|web)$/);
        expect(typeof compat.supported).toBe('boolean');
        
        if (compat.limitations) {
          expect(Array.isArray(compat.limitations)).toBe(true);
        }
      }
    });

    test('非推奨API検出', async () => {
      const module = await sdkManager.getSDKModule('camera', 'latest');
      
      // 非推奨情報が存在する場合の検証
      if (module.deprecated) {
        expect(module.deprecated.reason).toBeDefined();
        expect(module.deprecated.since).toBeDefined();
      }

      // メソッドレベルの非推奨検出
      for (const method of module.methods) {
        if (method.availability.deprecated) {
          expect(method.availability.deprecated).toMatch(/^SDK \d+$/);
        }
      }
    });

    // =============================================================================
    // Part 2/2: 新機能テスト
    // =============================================================================

    test('非推奨API検出の強化実装', async () => {
      const warnings = await sdkManager.detectDeprecatedAPIs('camera', 'latest');
      
      expect(Array.isArray(warnings)).toBe(true);
      
      for (const warning of warnings) {
        expect(warning.module).toBe('camera');
        expect(['module', 'method', 'property', 'constant']).toContain(warning.item_type);
        expect(warning.item_name).toBeDefined();
        expect(warning.deprecated_since).toBeDefined();
        expect(['info', 'warning', 'error']).toContain(warning.warning_level);
        expect(warning.message).toBeDefined();
      }
    });

    test('マイグレーションガイド生成', async () => {
      const migrationGuide = await sdkManager.generateMigrationGuide('sdk-48', 'sdk-49');
      
      expect(migrationGuide.fromVersion).toBe('sdk-48');
      expect(migrationGuide.toVersion).toBe('sdk-49');
      expect(Array.isArray(migrationGuide.breaking_changes)).toBe(true);
      expect(Array.isArray(migrationGuide.deprecated_modules)).toBe(true);
      expect(Array.isArray(migrationGuide.migration_steps)).toBe(true);
      expect(['low', 'medium', 'high']).toContain(migrationGuide.estimated_effort);
      expect(migrationGuide.notes).toBeDefined();

      // マイグレーションステップの詳細検証
      for (const step of migrationGuide.migration_steps) {
        expect(typeof step.step_number).toBe('number');
        expect(step.title).toBeDefined();
        expect(step.description).toBeDefined();
      }
    });

    test('互換性マトリックス取得（改善版）', async () => {
      const matrix = await sdkManager.getCompatibilityMatrix('sdk-49');
      
      expect(matrix.sdk_version).toBe('sdk-49');
      expect(typeof matrix.modules).toBe('object');
      expect(typeof matrix.platforms).toBe('object');
      expect(typeof matrix.overall_compatibility).toBe('number');
      expect(matrix.overall_compatibility).toBeGreaterThanOrEqual(0);
      expect(matrix.overall_compatibility).toBeLessThanOrEqual(100);

             // モジュール互換性詳細検証
       for (const [_moduleName, moduleCompat] of Object.entries(matrix.modules)) {
         expect(typeof moduleCompat.supported).toBe('boolean');
         expect(moduleCompat.version).toBeDefined();
         if (moduleCompat.issues) {
           expect(Array.isArray(moduleCompat.issues)).toBe(true);
         }
       }

      // プラットフォーム互換性詳細検証
      for (const [platformName, platformSupport] of Object.entries(matrix.platforms)) {
        expect(['ios', 'android', 'web']).toContain(platformName);
        expect(typeof platformSupport.supported).toBe('boolean');
        expect(platformSupport.minimum_version).toBeDefined();
        expect(Array.isArray(platformSupport.limitations)).toBe(true);
        expect(Array.isArray(platformSupport.known_issues)).toBe(true);
      }
    });

    test('非推奨警告システム（コード解析）', async () => {
      const testCode = `
        import { Camera } from 'expo-camera';
        
        const takePicture = async () => {
          const result = await Camera.takePictureAsync({ quality: 0.8 });
          return result;
        };
      `;

      const analysis = await sdkManager.analyzeCodeForDeprecatedUsage(testCode, 'latest');
      
      expect(Array.isArray(analysis.warnings)).toBe(true);
      expect(Array.isArray(analysis.suggestions)).toBe(true);
      expect(typeof analysis.migration_required).toBe('boolean');

      // 警告詳細検証
      for (const warning of analysis.warnings) {
        expect(warning.module).toBeDefined();
        expect(['module', 'method', 'property', 'constant']).toContain(warning.item_type);
        expect(['info', 'warning', 'error']).toContain(warning.warning_level);
        expect(warning.message).toBeDefined();
      }

      // 提案の検証
      for (const suggestion of analysis.suggestions) {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  // =============================================================================
  // MCP ツール統合テスト
  // =============================================================================

  describe('MCP ツール統合テスト', () => {
    test('expo_get_sdk_module ツール統合確認', async () => {
      const result = await ExpoTools.expo_get_sdk_module({
        module_name: 'camera',
        sdk_version: 'latest'
      });

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const text = result.content[0].text!;
      expect(text).toContain('# camera (expo-camera)');
      expect(text).toContain('📱 Platform Compatibility');
      expect(text).toContain('📊 互換性サマリー');
      expect(text).toContain('🔐 Permissions');
      expect(text).toContain('📚 Methods');
      expect(text).toContain('🔧 Installation');
    });

    test('高度なSDK情報フォーマット確認', async () => {
      const result = await ExpoTools.expo_get_sdk_module({
        module_name: 'camera',
        sdk_version: 'latest'
      });

      const text = result.content[0].text!;
      
      // プラットフォーム互換性テーブル確認
      expect(text).toMatch(/\| Platform \| Supported \| Min Version \| Limitations \|/);
      expect(text).toMatch(/\| ios \| [✅❌] \|/);
      expect(text).toMatch(/\| android \| [✅❌] \|/);
      expect(text).toMatch(/\| web \| [✅❌] \|/);

      // メソッド詳細確認
      expect(text).toContain('**Signature:**');
      expect(text).toContain('**Since:**');
      expect(text).toContain('**Platforms:**');

      // ドキュメンテーションリンク確認
      expect(text).toContain('**Documentation:**');
      expect(text).toContain('**Repository:**');
      expect(text).toContain('https://docs.expo.dev');
      expect(text).toContain('https://github.com/expo/expo');
    });

    test('エラーハンドリング確認', async () => {
      const result = await ExpoTools.expo_get_sdk_module({
        module_name: 'invalid-module!@#',
        sdk_version: 'latest'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid module name format');
    });
  });

  // =============================================================================
  // 動作確認・テスト（機能テスト）
  // =============================================================================

  describe('動作確認・テスト（機能テスト）', () => {
    test('SDK情報取得速度確認 (80ms以内)', async () => {
      const modules = ['camera', 'location', 'notifications'];
      
      for (const moduleName of modules) {
        const startTime = Date.now();
        await sdkManager.getSDKModule(moduleName, 'latest');
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(80);
      }
    });

    test('全プラットフォーム対応確認', async () => {
      const modules = ['camera', 'location'];
      
      for (const moduleName of modules) {
        const compatibility = await sdkManager.getPlatformCompatibility(moduleName);
        
        const supportedPlatforms = compatibility
          .filter(c => c.supported)
          .map(c => c.platform);
        
        expect(supportedPlatforms.length).toBeGreaterThan(0);
        
        // 少なくともモバイルプラットフォームはサポート
        expect(
          supportedPlatforms.includes('ios') || 
          supportedPlatforms.includes('android')
        ).toBe(true);
      }
    });

    test('バージョン互換性確認', async () => {
      const versions = ['latest', 'sdk-49', 'sdk-48'];
      
      for (const version of versions) {
        const versionInfo = await sdkManager.getSDKVersionInfo(version);
        expect(versionInfo.version).toContain('SDK');
        expect(versionInfo.status).toMatch(/^(latest|supported|deprecated|unsupported)$/);
      }
    });

    test('API情報精度確認', async () => {
      const module = await sdkManager.getSDKModule('camera', 'latest');
      
      // 基本情報精度確認
      expect(module.name).toBe('camera');
      expect(module.packageName).toBe('expo-camera');
      expect(module.description).toContain('camera');

      // メソッド情報精度確認
      expect(module.methods.length).toBeGreaterThan(0);
      
      for (const method of module.methods) {
        expect(method.name).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
        expect(method.signature).toContain(method.name);
        expect(method.description).toBeDefined();
        expect(method.platforms.length).toBeGreaterThan(0);
      }

      // プラットフォーム情報精度確認
      expect(module.platforms.every(p => 
        ['ios', 'android', 'web', 'universal'].includes(p)
      )).toBe(true);
    });

    test('実装漏れチェック: SDK-49, SDK-48 対応確認', async () => {
      const requiredVersions = ['sdk-49', 'sdk-48'];
      
      for (const version of requiredVersions) {
        const module = await sdkManager.getSDKModule('camera', version);
        expect(module.sdkVersion).toBe(version);
        
        const versionInfo = await sdkManager.getSDKVersionInfo(version);
        expect(versionInfo.modules).toBeDefined();
        expect(Object.keys(versionInfo.modules).length).toBeGreaterThan(0);
      }
    });
  });
}); 