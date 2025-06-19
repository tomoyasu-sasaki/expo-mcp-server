import { 
  ExpoSDKModule, 
  ExpoSDKMethod, 
  SDKVersionInfo, 
  PlatformCompatibility, 
  APIReference,
  ExpoCodeExample,
  ExpoSDKConstant,
  ExpoSDKType
} from '../types/document';
import { CacheManager } from './cache-manager.js';
import { PerformanceMonitor } from './performance-monitor.js';

/**
 * Migration guide for moving between SDK versions
 */
interface MigrationGuide {
  fromVersion: string;
  toVersion: string;
  breaking_changes: BreakingChange[];
  deprecated_modules: DeprecatedModule[];
  migration_steps: MigrationStep[];
  estimated_effort: 'low' | 'medium' | 'high';
  notes: string;
}

interface BreakingChange {
  module: string;
  change_type: 'method_removed' | 'method_renamed' | 'parameter_changed' | 'behavior_changed';
  description: string;
  action_required: string;
  example?: {
    before: string;
    after: string;
  };
}

interface DeprecatedModule {
  name: string;
  deprecated_since: string;
  replacement?: string;
  removal_date?: string;
  reason: string;
  migration_guide_url?: string;
}

interface MigrationStep {
  step_number: number;
  title: string;
  description: string;
  commands?: string[];
  file_changes?: string[];
  verification_steps?: string[];
}

interface DeprecationWarning {
  module: string;
  item_type: 'module' | 'method' | 'property' | 'constant';
  item_name: string;
  deprecated_since: string;
  replacement?: string;
  removal_date?: string;
  warning_level: 'info' | 'warning' | 'error';
  message: string;
  migration_url?: string;
}

interface CompatibilityMatrix {
  sdk_version: string;
  modules: Record<string, ModuleCompatibility>;
  platforms: Record<string, PlatformSupport>;
  overall_compatibility: number; // 0-100%
}

interface ModuleCompatibility {
  supported: boolean;
  version: string;
  issues?: string[];
  workarounds?: string[];
  alternative?: string;
}

interface PlatformSupport {
  supported: boolean;
  minimum_version: string;
  limitations: string[];
  known_issues: string[];
}

/**
 * Expo SDK モジュール・API管理サービス
 * Section 3.2: SDK・API管理機能 Part 1/2 + Part 2/2
 */
export class ExpoSDKManager {
  private moduleCache = new Map<string, ExpoSDKModule>();
  private versionCache = new Map<string, SDKVersionInfo>();
  private apiCache = new Map<string, APIReference>();
  private migrationCache = new Map<string, MigrationGuide>();
  private compatibilityCache = new Map<string, CompatibilityMatrix>();
  private readonly cacheExpiry = 1000 * 60 * 60; // 1時間

  // =============================================================================
  // SDK メタデータ取得実装
  // =============================================================================

  /**
   * SDK モジュール情報を取得
   */
  async getSDKModule(moduleName: string, sdkVersion: string = 'latest'): Promise<ExpoSDKModule> {
    const cacheKey = `${moduleName}@${sdkVersion}`;
    
    // キャッシュチェック
    if (this.moduleCache.has(cacheKey)) {
      const cached = this.moduleCache.get(cacheKey)!;
      if (Date.now() - cached.lastModified.getTime() < this.cacheExpiry) {
        return cached;
      }
    }

    console.log(`SDK情報取得開始: ${moduleName}@${sdkVersion}`);
    const startTime = Date.now();

    try {
      // 複数ソースから並行でデータ取得（80ms以内目標）
      const [githubInfo, npmInfo, docsInfo] = await Promise.all([
        this.fetchFromGitHub(moduleName, sdkVersion),
        this.fetchFromNpm(moduleName),
        this.fetchFromDocs(moduleName, sdkVersion)
      ]);

      const module = this.mergeModuleInfo(moduleName, sdkVersion, githubInfo, npmInfo, docsInfo);
      
      // キャッシュに保存
      this.moduleCache.set(cacheKey, module);
      
      const duration = Date.now() - startTime;
      console.log(`SDK情報取得完了: ${moduleName} (${duration}ms)`);
      
      return module;
    } catch (error) {
      console.error(`SDK情報取得エラー: ${moduleName}`, error);
      throw new Error(`Failed to fetch SDK module info: ${error}`);
    }
  }

  /**
   * 利用可能なSDKバージョン一覧取得
   */
  async getAvailableSDKVersions(): Promise<SDKVersionInfo[]> {
    const versions = ['latest', 'sdk-49', 'sdk-48', 'sdk-47'];
    const versionInfos = await Promise.all(
      versions.map(version => this.getSDKVersionInfo(version))
    );
    
    return versionInfos.sort((a, b) => 
      new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  }

  /**
   * 特定SDKバージョンの詳細情報取得
   */
  async getSDKVersionInfo(version: string): Promise<SDKVersionInfo> {
    if (this.versionCache.has(version)) {
      return this.versionCache.get(version)!;
    }

    const versionInfo = await this.fetchSDKVersionInfo(version);
    this.versionCache.set(version, versionInfo);
    return versionInfo;
  }

  // =============================================================================
  // プラットフォーム対応状況管理
  // =============================================================================

  /**
   * モジュールのプラットフォーム対応状況取得
   */
  async getPlatformCompatibility(moduleName: string, sdkVersion: string = 'latest'): Promise<PlatformCompatibility[]> {
    const module = await this.getSDKModule(moduleName, sdkVersion);
    
    const platforms: Array<'ios' | 'android' | 'web'> = ['ios', 'android', 'web'];
    return platforms.map(platform => ({
      platform,
      supported: module.platforms.includes(platform),
      minVersion: this.getMinPlatformVersion(moduleName, platform),
      limitations: this.getPlatformLimitations(moduleName, platform),
      notes: this.getPlatformNotes(moduleName, platform)
    }));
  }

  /**
   * プラットフォーム別制限事項取得
   */
  private getPlatformLimitations(moduleName: string, platform: string): string[] {
    const limitations: Record<string, Record<string, string[]>> = {
      camera: {
        web: ['カメラアクセス要HTTPS', 'ブラウザ互換性制限'],
        ios: ['Privacy Usage Description必須'],
        android: ['Camera2 API要求']
      },
      location: {
        web: ['精度制限', 'バックグラウンド無効'],
        ios: ['位置情報許可必須'],
        android: ['位置情報許可必須']
      }
    };

    return limitations[moduleName]?.[platform] || [];
  }

  private getPlatformNotes(moduleName: string, platform: string): string {
    const notes: Record<string, Record<string, string>> = {
      camera: {
        web: 'WebRTC APIを使用、ブラウザ制限あり',
        ios: 'AVFoundation使用',
        android: 'Camera2 API使用'
      }
    };

    return notes[moduleName]?.[platform] || '';
  }

  private getMinPlatformVersion(moduleName: string, platform: string): string {
    const versions: Record<string, Record<string, string>> = {
      camera: { ios: '10.0', android: '5.0', web: 'Chrome 53+' },
      location: { ios: '9.0', android: '4.4', web: 'Chrome 50+' }
    };

    return versions[moduleName]?.[platform] || '';
  }

  // =============================================================================
  // 権限要件管理
  // =============================================================================

  /**
   * モジュール権限要件取得
   */
     async getPermissionRequirements(moduleName: string, platform?: string): Promise<{
     required: string[];
     optional: string[];
     description: Record<string, string>;
   }> {
     await this.getSDKModule(moduleName); // キャッシュ更新のため
     const permissions = this.getModulePermissions(moduleName);
    
    if (platform) {
      // プラットフォーム固有権限フィルタ
      return this.filterPermissionsByPlatform(permissions, platform);
    }
    
    return permissions;
  }

  private getModulePermissions(moduleName: string) {
    const permissionMap: Record<string, any> = {
      camera: {
        required: ['CAMERA', 'RECORD_AUDIO'],
        optional: ['WRITE_EXTERNAL_STORAGE'],
        description: {
          CAMERA: 'カメラアクセス権限',
          RECORD_AUDIO: '音声録音権限',
          WRITE_EXTERNAL_STORAGE: 'ストレージ書き込み権限'
        }
      },
      location: {
        required: ['ACCESS_FINE_LOCATION'],
        optional: ['ACCESS_BACKGROUND_LOCATION'],
        description: {
          ACCESS_FINE_LOCATION: '精密位置情報権限',
          ACCESS_BACKGROUND_LOCATION: 'バックグラウンド位置情報権限'
        }
      }
    };

    return permissionMap[moduleName] || { required: [], optional: [], description: {} };
  }

  private filterPermissionsByPlatform(permissions: any, platform: string) {
    // プラットフォーム固有の権限フィルタリング
    const platformFilters: Record<string, (perm: string) => boolean> = {
      ios: (perm) => !perm.startsWith('android.'),
      android: (perm) => !perm.includes('iOS'),
      web: () => false // Web版では権限要求なし
    };

    const filter = platformFilters[platform] || (() => true);
    
    return {
      required: permissions.required.filter(filter),
      optional: permissions.optional.filter(filter),
      description: permissions.description
    };
  }

  // =============================================================================
  // インストール手順生成
  // =============================================================================

  /**
   * インストール手順生成
   */
  async generateInstallationSteps(moduleName: string, options: {
    platform?: string[];
    projectType?: 'managed' | 'bare';
    typescript?: boolean;
  } = {}): Promise<{
    commands: string[];
    configSteps: string[];
    additionalNotes: string[];
  }> {
    const module = await this.getSDKModule(moduleName);
    const { platform, projectType = 'managed', typescript = true } = options;

    const commands = [
      `npx expo install ${module.packageName}`,
      ...(module.peerDependencies && Object.keys(module.peerDependencies).length > 0 
        ? [`npx expo install ${Object.keys(module.peerDependencies).join(' ')}`]
        : [])
    ];

    const configSteps = await this.generateConfigSteps(moduleName, { platform, projectType });
    const additionalNotes = await this.generateAdditionalNotes(moduleName, { typescript, platform });

    return { commands, configSteps, additionalNotes };
  }

     private async generateConfigSteps(moduleName: string, _options: any): Promise<string[]> {
     const configSteps: Record<string, string[]> = {
      camera: [
        'app.json にカメラ権限追加:',
        '  "expo": { "plugins": ["expo-camera"] }'
      ],
      location: [
        'app.json に位置情報権限追加:',
        '  "expo": { "plugins": [["expo-location", { "locationAlwaysAndWhenInUsePermission": "アプリで位置情報を使用します" }]] }'
      ]
    };

    return configSteps[moduleName] || [];
  }

     private async generateAdditionalNotes(moduleName: string, _options: any): Promise<string[]> {
     const notes: Record<string, string[]> = {
      camera: [
        'iOS: Info.plist にカメラ使用目的の記載が必要',
        'Android: CAMERA権限の動的要求実装が必要',
        'Web: HTTPS環境でのみ動作'
      ],
      location: [
        '位置情報権限は実行時に要求される',
        'バックグラウンド位置情報は別途設定が必要'
      ]
    };

    return notes[moduleName] || [];
  }

  // =============================================================================
  // API メソッド抽出
  // =============================================================================

  /**
   * モジュールのAPIメソッド一覧取得
   */
  async getAPIMethods(moduleName: string, sdkVersion: string = 'latest'): Promise<ExpoSDKMethod[]> {
    const module = await this.getSDKModule(moduleName, sdkVersion);
    return module.methods;
  }

  /**
   * APIリファレンス取得
   */
  async getAPIReference(moduleName: string, sdkVersion: string = 'latest'): Promise<APIReference> {
    const cacheKey = `api_${moduleName}@${sdkVersion}`;
    
    if (this.apiCache.has(cacheKey)) {
      return this.apiCache.get(cacheKey)!;
    }

    const module = await this.getSDKModule(moduleName, sdkVersion);
    const apiRef = this.buildAPIReference(module);
    
    this.apiCache.set(cacheKey, apiRef);
    return apiRef;
  }

  private buildAPIReference(module: ExpoSDKModule): APIReference {
    const exports: Record<string, any> = {};

    // メソッドをexportsに追加
    module.methods.forEach(method => {
      exports[method.name] = {
        type: 'function',
        signature: method.signature,
        description: method.description
      };
    });

    // 定数をexportsに追加
    Object.entries(module.constants).forEach(([key, constant]) => {
      exports[key] = {
        type: 'constant',
        signature: `${constant.name}: ${constant.type}`,
        description: constant.description
      };
    });

    // 型をexportsに追加
    Object.entries(module.types).forEach(([key, type]) => {
      exports[key] = {
        type: type.kind,
        signature: type.definition,
        description: type.description
      };
    });

    return {
      moduleName: module.name,
      namespace: module.packageName,
      exports
    };
  }

  // =============================================================================
  // シグネチャ解析
  // =============================================================================

  /**
   * TypeScriptシグネチャ解析
   */
  async analyzeMethodSignature(method: ExpoSDKMethod): Promise<{
    parameters: any[];
    returnType: string;
    generics: string[];
    overloads: string[];
  }> {
    return {
      parameters: method.parameters.map(param => ({
        name: param.name,
        type: param.type,
        required: param.required,
        defaultValue: param.defaultValue,
        description: param.description
      })),
      returnType: method.returnType,
      generics: this.extractGenerics(method.signature),
      overloads: this.extractOverloads(method.signature)
    };
  }

  private extractGenerics(signature: string): string[] {
    const genericMatch = signature.match(/<([^>]+)>/);
    return genericMatch ? genericMatch[1].split(',').map(g => g.trim()) : [];
  }

  private extractOverloads(signature: string): string[] {
    // 複数のシグネチャ（オーバーロード）を抽出
    return [signature]; // 简化实现
  }

  // =============================================================================
  // 使用例生成
  // =============================================================================

  /**
   * コード使用例生成
   */
  async generateUsageExamples(moduleName: string, methodName?: string): Promise<ExpoCodeExample[]> {
    const module = await this.getSDKModule(moduleName);
    
    if (methodName) {
      const method = module.methods.find(m => m.name === methodName);
      return method?.examples || [];
    }
    
    return module.examples;
  }

  /**
   * Snack互換コード例生成
   */
  async generateSnackExample(moduleName: string, example: ExpoCodeExample): Promise<{
    code: string;
    dependencies: Record<string, string>;
    snackUrl: string;
  }> {
    const module = await this.getSDKModule(moduleName);
    
    const fullCode = this.buildSnackCode(module, example);
    const dependencies = {
      [module.packageName]: module.version,
      ...example.dependencies
    };
    
    const snackUrl = this.generateSnackUrl(fullCode, dependencies);
    
    return { code: fullCode, dependencies, snackUrl };
  }

  private buildSnackCode(module: ExpoSDKModule, example: ExpoCodeExample): string {
    return `import React from 'react';
import { View, Text, Button } from 'react-native';
import * as ${module.name} from '${module.packageName}';

export default function App() {
  ${example.code}
}`;
  }

  private generateSnackUrl(code: string, dependencies: Record<string, string>): string {
    // Snack URL生成（簡略化実装）
    const encoded = encodeURIComponent(JSON.stringify({ code, dependencies }));
    return `https://snack.expo.dev/@anonymous/${Date.now()}?platform=web&dependencies=${encoded}`;
  }

  // =============================================================================
  // 定数・型情報管理
  // =============================================================================

  /**
   * モジュール定数取得
   */
  async getModuleConstants(moduleName: string): Promise<Record<string, ExpoSDKConstant>> {
    const module = await this.getSDKModule(moduleName);
    return module.constants;
  }

  /**
   * モジュール型情報取得
   */
  async getModuleTypes(moduleName: string): Promise<Record<string, ExpoSDKType>> {
    const module = await this.getSDKModule(moduleName);
    return module.types;
  }

  // =============================================================================
  // データ取得 (Private Methods)
  // =============================================================================

     private async fetchFromGitHub(moduleName: string, _sdkVersion: string): Promise<any> {
    // GitHub API呼び出しシミュレーション
    await new Promise(resolve => setTimeout(resolve, 30));
    
    return {
      repositoryUrl: `https://github.com/expo/expo/tree/main/packages/${moduleName}`,
      lastModified: new Date(),
      stars: 1000,
      issues: 10
    };
  }

  private async fetchFromNpm(moduleName: string): Promise<any> {
    // npm registry API呼び出しシミュレーション  
    await new Promise(resolve => setTimeout(resolve, 25));
    
    return {
      packageName: `expo-${moduleName}`,
      version: '12.3.0',
      dependencies: { 'react-native': '^0.70.0' },
      peerDependencies: {}
    };
  }

  private async fetchFromDocs(moduleName: string, sdkVersion: string): Promise<any> {
    // ドキュメント情報取得シミュレーション
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return {
      documentationUrl: `https://docs.expo.dev/versions/${sdkVersion}/sdk/${moduleName}/`,
      description: `Expo SDK module for ${moduleName} functionality`,
      examples: []
    };
  }

  private mergeModuleInfo(moduleName: string, sdkVersion: string, ...sources: any[]): ExpoSDKModule {
    const [githubInfo, npmInfo, docsInfo] = sources;
    
    return {
      name: moduleName,
      packageName: npmInfo.packageName,
      description: docsInfo.description,
      version: npmInfo.version,
      sdkVersion,
      installation: `npx expo install ${npmInfo.packageName}`,
      platforms: this.inferPlatforms(moduleName),
      permissions: this.getModulePermissions(moduleName).required,
      dependencies: npmInfo.dependencies || {},
      peerDependencies: npmInfo.peerDependencies || {},
      methods: this.generateMethods(moduleName),
      constants: this.generateConstants(moduleName),
      types: this.generateTypes(moduleName),
      examples: this.generateExamples(moduleName),
      documentationUrl: docsInfo.documentationUrl,
      repositoryUrl: githubInfo.repositoryUrl,
      lastModified: new Date(),
      moduleType: this.inferModuleType(moduleName)
    };
  }

  private inferPlatforms(moduleName: string): Array<'ios' | 'android' | 'web' | 'universal'> {
    const platformMap: Record<string, Array<'ios' | 'android' | 'web' | 'universal'>> = {
      camera: ['ios', 'android', 'web'],
      location: ['ios', 'android', 'web'],
      notifications: ['ios', 'android'],
      haptics: ['ios', 'android'],
      constants: ['ios', 'android', 'web', 'universal']
    };
    
    return platformMap[moduleName] || ['ios', 'android'];
  }

  private inferModuleType(moduleName: string): 'core' | 'community' | 'deprecated' {
    const coreModules = ['camera', 'location', 'notifications', 'constants', 'haptics'];
    return coreModules.includes(moduleName) ? 'core' : 'community';
  }

  private generateMethods(moduleName: string): ExpoSDKMethod[] {
    const methodMap: Record<string, ExpoSDKMethod[]> = {
      camera: [
        {
          name: 'requestCameraPermissionsAsync',
          signature: 'requestCameraPermissionsAsync(): Promise<PermissionResponse>',
          description: 'カメラ権限を要求します',
          parameters: [],
          returnType: 'Promise<PermissionResponse>',
          examples: [
            {
              title: 'Basic Permission Request',
              description: 'カメラ権限を要求する基本例',
              code: 'const { status } = await Camera.requestCameraPermissionsAsync();',
              language: 'typescript',
              platforms: ['ios', 'android'],
              dependencies: { 'expo-camera': '^12.3.0' }
            }
          ],
          platforms: ['ios', 'android'],
          availability: { since: 'SDK 40' }
        }
      ]
    };
    
    return methodMap[moduleName] || [];
  }

  private generateConstants(moduleName: string): Record<string, ExpoSDKConstant> {
    const constantMap: Record<string, Record<string, ExpoSDKConstant>> = {
      camera: {
        Type: {
          name: 'Type',
          type: 'enum',
          value: { back: 0, front: 1 },
          description: 'カメラタイプ定数',
          platforms: ['ios', 'android']
        }
      }
    };
    
    return constantMap[moduleName] || {};
  }

  private generateTypes(moduleName: string): Record<string, ExpoSDKType> {
    const typeMap: Record<string, Record<string, ExpoSDKType>> = {
      camera: {
        PermissionResponse: {
          name: 'PermissionResponse',
          kind: 'interface',
          definition: 'interface PermissionResponse { status: PermissionStatus; }',
          description: '権限要求の応答型',
          properties: {
            status: { type: 'PermissionStatus', description: '権限状態', required: true }
          }
        }
      }
    };
    
    return typeMap[moduleName] || {};
  }

  private generateExamples(moduleName: string): ExpoCodeExample[] {
    const exampleMap: Record<string, ExpoCodeExample[]> = {
      camera: [
        {
          title: 'Basic Camera Usage',
          description: 'カメラの基本的な使用方法',
          code: `const [hasPermission, setHasPermission] = useState(null);
const [type, setType] = useState(Camera.Constants.Type.back);

useEffect(() => {
  (async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  })();
}, []);

return (
  <Camera style={{flex: 1}} type={type}>
    <View style={{flex: 1, backgroundColor: 'transparent'}}>
      <Button title="Flip" onPress={() => setType(type === Camera.Constants.Type.back ? Camera.Constants.Type.front : Camera.Constants.Type.back)} />
    </View>
  </Camera>
);`,
          language: 'typescript',
          platforms: ['ios', 'android'],
          dependencies: { 'expo-camera': '^12.3.0' }
        }
      ]
    };
    
    return exampleMap[moduleName] || [];
  }

  private async fetchSDKVersionInfo(version: string): Promise<SDKVersionInfo> {
    // SDK バージョン情報取得シミュレーション
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const versionMap: Record<string, SDKVersionInfo> = {
      latest: {
        version: 'SDK 49',
        releaseDate: new Date('2023-09-15'),
        status: 'latest',
        changelog: 'Latest stable release with new features',
        modules: { camera: '12.3.0', location: '15.1.0' }
      },
      'sdk-49': {
        version: 'SDK 49',
        releaseDate: new Date('2023-09-15'),
        status: 'supported',
        changelog: 'Stable release with React Native 0.72',
        modules: { camera: '12.3.0', location: '15.1.0' }
      },
      'sdk-48': {
        version: 'SDK 48',
        releaseDate: new Date('2023-06-15'),
        status: 'supported',
        supportEndsDate: new Date('2024-06-15'),
        changelog: 'Previous stable release',
        modules: { camera: '12.2.0', location: '15.0.0' }
      }
    };
    
    return versionMap[version] || versionMap.latest;
  }

  // =============================================================================
  // Section 3.2 Part 2/2: 非推奨API検出・マイグレーション機能
  // =============================================================================

  /**
   * 非推奨API検出の強化実装
   */
  async detectDeprecatedAPIs(moduleName: string, sdkVersion: string = 'latest'): Promise<DeprecationWarning[]> {
    const module = await this.getSDKModule(moduleName, sdkVersion);
    const warnings: DeprecationWarning[] = [];

    // モジュールレベルの非推奨検出
    if (module.deprecated) {
      warnings.push({
        module: moduleName,
        item_type: 'module',
        item_name: moduleName,
        deprecated_since: module.deprecated.since,
        replacement: module.deprecated.replacement,
        warning_level: 'error',
        message: `Module ${moduleName} is deprecated: ${module.deprecated.reason}`,
        migration_url: `https://docs.expo.dev/versions/latest/sdk/${moduleName}/#migration`
      });
    }

    // メソッドレベルの非推奨検出
    for (const method of module.methods) {
      if (method.availability.deprecated) {
        warnings.push({
          module: moduleName,
          item_type: 'method',
          item_name: method.name,
          deprecated_since: method.availability.deprecated,
          replacement: method.availability.replacement,
          warning_level: this.determineWarningLevel(method.availability.deprecated),
          message: `Method ${method.name} is deprecated since ${method.availability.deprecated}`,
          migration_url: method.availability.migrationUrl
        });
      }
    }

    // 定数・型レベルの非推奨検出
    for (const [constantName, constant] of Object.entries(module.constants)) {
      if (constant.deprecated) {
        warnings.push({
          module: moduleName,
          item_type: 'constant',
          item_name: constantName,
          deprecated_since: constant.deprecated.since,
          replacement: constant.deprecated.replacement,
          warning_level: 'warning',
          message: `Constant ${constantName} is deprecated: ${constant.deprecated.reason}`
        });
      }
    }

    return warnings;
  }

  /**
   * マイグレーションガイド生成
   */
  async generateMigrationGuide(fromVersion: string, toVersion: string): Promise<MigrationGuide> {
    const cacheKey = `migration_${fromVersion}_to_${toVersion}`;
    
    if (this.migrationCache.has(cacheKey)) {
      return this.migrationCache.get(cacheKey)!;
    }

    console.log(`マイグレーションガイド生成: ${fromVersion} → ${toVersion}`);

    // バージョン間の変更点を分析
    const breakingChanges = await this.analyzeBreakingChanges(fromVersion, toVersion);
    const deprecatedModules = await this.analyzeDeprecatedModules(fromVersion, toVersion);
    const migrationSteps = await this.generateMigrationSteps(fromVersion, toVersion, breakingChanges);

    const migrationGuide: MigrationGuide = {
      fromVersion,
      toVersion,
      breaking_changes: breakingChanges,
      deprecated_modules: deprecatedModules,
      migration_steps: migrationSteps,
      estimated_effort: this.estimateMigrationEffort(breakingChanges, deprecatedModules),
      notes: `Migration from ${fromVersion} to ${toVersion}. Please test thoroughly before deploying.`
    };

    this.migrationCache.set(cacheKey, migrationGuide);
    return migrationGuide;
  }

  /**
   * 互換性マトリックス取得（改善版）
   */
  async getCompatibilityMatrix(sdkVersion: string): Promise<CompatibilityMatrix> {
    const cacheKey = `compatibility_${sdkVersion}`;
    
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey)!;
    }

    console.log(`互換性マトリックス生成: ${sdkVersion}`);

    const modules = await this.analyzeModuleCompatibility(sdkVersion);
    const platforms = await this.analyzePlatformSupport(sdkVersion);
    const overallCompatibility = this.calculateOverallCompatibility(modules, platforms);

    const matrix: CompatibilityMatrix = {
      sdk_version: sdkVersion,
      modules,
      platforms,
      overall_compatibility: overallCompatibility
    };

    this.compatibilityCache.set(cacheKey, matrix);
    return matrix;
  }

  /**
   * 非推奨警告システム（使用パターン解析付き）
   */
  async analyzeCodeForDeprecatedUsage(codeSnippet: string, sdkVersion: string = 'latest'): Promise<{
    warnings: DeprecationWarning[];
    suggestions: string[];
    migration_required: boolean;
  }> {
    const warnings: DeprecationWarning[] = [];
    const suggestions: string[] = [];

    // import文の解析
    const importMatches = codeSnippet.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g) || [];
    for (const importMatch of importMatches) {
      const moduleName = importMatch.match(/from\s+['"]expo-([^'"]+)['"]/)?.[1];
      if (moduleName) {
        const moduleWarnings = await this.detectDeprecatedAPIs(moduleName, sdkVersion);
        warnings.push(...moduleWarnings);
      }
    }

    // メソッド呼び出しの解析
    const methodMatches = codeSnippet.match(/(\w+)\.(\w+)\(/g) || [];
    for (const methodMatch of methodMatches) {
      const [, objectName, methodName] = methodMatch.match(/(\w+)\.(\w+)\(/) || [];
      if (objectName && methodName) {
        const deprecatedMethod = await this.checkMethodDeprecation(objectName, methodName, sdkVersion);
        if (deprecatedMethod) {
          warnings.push(deprecatedMethod);
          suggestions.push(`Consider replacing ${objectName}.${methodName}() with ${deprecatedMethod.replacement || 'the new API'}`);
        }
      }
    }

    const migrationRequired = warnings.some(w => w.warning_level === 'error');

    return {
      warnings,
      suggestions,
      migration_required: migrationRequired
    };
  }

  // =============================================================================
  // Private Helper Methods for Part 2/2
  // =============================================================================

  private determineWarningLevel(deprecatedSince: string): 'info' | 'warning' | 'error' {
    const sdkNumber = parseInt(deprecatedSince.replace('SDK ', ''));
    const currentSDK = 49; // 現在の最新SDK
    const versionDiff = currentSDK - sdkNumber;

    if (versionDiff >= 3) return 'error'; // 3バージョン以上古い場合
    if (versionDiff >= 1) return 'warning'; // 1-2バージョン古い場合
    return 'info'; // 比較的新しい非推奨
  }

  private async analyzeBreakingChanges(fromVersion: string, toVersion: string): Promise<BreakingChange[]> {
    // 実際の実装では、GitHubのchangelogやrelease notesを解析
    await new Promise(resolve => setTimeout(resolve, 100));

    const knownChanges: Record<string, BreakingChange[]> = {
      'sdk-48_to_sdk-49': [
        {
          module: 'camera',
          change_type: 'method_renamed',
          description: 'takePictureAsync renamed to takePictureAsync2',
          action_required: 'Update method calls and parameter structure',
          example: {
            before: 'await camera.takePictureAsync({ quality: 0.8 })',
            after: 'await camera.takePictureAsync2({ quality: 0.8, format: "jpeg" })'
          }
        }
      ]
    };

    const changeKey = `${fromVersion}_to_${toVersion}`;
    return knownChanges[changeKey] || [];
  }

  private async analyzeDeprecatedModules(fromVersion: string, toVersion: string): Promise<DeprecatedModule[]> {
    await new Promise(resolve => setTimeout(resolve, 50));

    // 実際の実装では、各バージョンの非推奨モジュール一覧を取得
    const deprecatedMap: Record<string, DeprecatedModule[]> = {
      'sdk-48_to_sdk-49': [
        {
          name: 'expo-legacy-camera',
          deprecated_since: 'SDK 49',
          replacement: 'expo-camera',
          removal_date: 'SDK 51',
          reason: 'Replaced with improved camera API',
          migration_guide_url: 'https://docs.expo.dev/versions/latest/sdk/camera/#migration'
        }
      ]
    };

    const changeKey = `${fromVersion}_to_${toVersion}`;
    return deprecatedMap[changeKey] || [];
  }

  private async generateMigrationSteps(fromVersion: string, toVersion: string, breakingChanges: BreakingChange[]): Promise<MigrationStep[]> {
    await new Promise(resolve => setTimeout(resolve, 75));

    const steps: MigrationStep[] = [
      {
        step_number: 1,
        title: 'Update Expo SDK',
        description: `Upgrade from ${fromVersion} to ${toVersion}`,
        commands: [
          'expo install --fix',
          `npx expo install expo@${toVersion}`
        ],
        verification_steps: ['Run expo doctor to check for issues']
      },
      {
        step_number: 2,
        title: 'Update Dependencies',
        description: 'Update related packages and dependencies',
        commands: [
          'npm update',
          'expo install --fix'
        ],
        verification_steps: ['Check package.json for version conflicts']
      }
    ];

    // Breaking changes に基づく追加ステップ
    breakingChanges.forEach((change, _index) => {
      steps.push({
        step_number: steps.length + 1,
        title: `Fix Breaking Change: ${change.module}`,
        description: change.description,
        file_changes: [`Update ${change.module} usage: ${change.action_required}`],
        verification_steps: [`Test ${change.module} functionality`]
      });
    });

    return steps;
  }

  private estimateMigrationEffort(breakingChanges: BreakingChange[], deprecatedModules: DeprecatedModule[]): 'low' | 'medium' | 'high' {
    const changeCount = breakingChanges.length + deprecatedModules.length;
    
    if (changeCount === 0) return 'low';
    if (changeCount <= 3) return 'medium';
    return 'high';
  }

  private async analyzeModuleCompatibility(sdkVersion: string): Promise<Record<string, ModuleCompatibility>> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const modules = ['camera', 'location', 'notifications', 'constants'];
    const compatibility: Record<string, ModuleCompatibility> = {};

    for (const moduleName of modules) {
      try {
        const module = await this.getSDKModule(moduleName, sdkVersion);
        compatibility[moduleName] = {
          supported: !module.deprecated,
          version: module.version,
          issues: module.deprecated ? [`Deprecated since ${module.deprecated.since}`] : [],
          workarounds: module.deprecated && module.deprecated.replacement ? 
            [`Use ${module.deprecated.replacement} instead`] : [],
          alternative: module.deprecated?.replacement
        };
      } catch {
        compatibility[moduleName] = {
          supported: false,
          version: 'unknown',
          issues: ['Module not available in this SDK version'],
          alternative: 'Check latest SDK for replacement'
        };
      }
    }

    return compatibility;
  }

  private async analyzePlatformSupport(_sdkVersion: string): Promise<Record<string, PlatformSupport>> {
    await new Promise(resolve => setTimeout(resolve, 75));

    return {
      ios: {
        supported: true,
        minimum_version: '11.0',
        limitations: ['Some features require iOS 13+'],
        known_issues: []
      },
      android: {
        supported: true,
        minimum_version: '6.0',
        limitations: ['Camera2 API required'],
        known_issues: ['Some emulators may have camera issues']
      },
      web: {
        supported: true,
        minimum_version: 'Chrome 80+',
        limitations: ['Limited camera controls', 'No background processing'],
        known_issues: ['HTTPS required for camera access']
      }
    };
  }

  private calculateOverallCompatibility(modules: Record<string, ModuleCompatibility>, platforms: Record<string, PlatformSupport>): number {
    const moduleCount = Object.keys(modules).length;
    const supportedModules = Object.values(modules).filter(m => m.supported).length;
    
    const platformCount = Object.keys(platforms).length;
    const supportedPlatforms = Object.values(platforms).filter(p => p.supported).length;

    const moduleCompatibility = (supportedModules / moduleCount) * 100;
    const platformCompatibility = (supportedPlatforms / platformCount) * 100;

    return Math.round((moduleCompatibility + platformCompatibility) / 2);
  }

  private async checkMethodDeprecation(objectName: string, methodName: string, _sdkVersion: string): Promise<DeprecationWarning | null> {
    // 実際の実装では、各モジュールのメソッドをチェック
    const deprecatedMethods: Record<string, Record<string, DeprecationWarning>> = {
      Camera: {
        takePictureAsync: {
          module: 'camera',
          item_type: 'method',
          item_name: 'takePictureAsync',
          deprecated_since: 'SDK 48',
          replacement: 'takePictureAsync2',
          warning_level: 'warning',
          message: 'takePictureAsync is deprecated, use takePictureAsync2 instead'
        }
      }
    };

    return deprecatedMethods[objectName]?.[methodName] || null;
  }
} 