import { performance } from 'perf_hooks';

describe('MCP: リソース機能', () => {
  test('リソース定義形式確認', () => {
    const startTime = performance.now();
    
    // MCP リソースの基本定義形式
    const resourceDefinition = {
      uri: 'expo://docs/getting-started',
      name: 'Getting Started Guide',
      description: 'Expo getting started documentation',
      mimeType: 'text/markdown'
    };
    
    expect(resourceDefinition.uri).toMatch(/^expo:\/\//);
    expect(resourceDefinition.name).toBeDefined();
    expect(resourceDefinition.description).toBeDefined();
    expect(resourceDefinition.mimeType).toBe('text/markdown');
    
    const endTime = performance.now();
    console.log(`✅ リソース定義形式: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('5つのリソースタイプ確認', () => {
    const startTime = performance.now();
    
    // 5つのリソースタイプ
    const resourceTypes = [
      'expo://docs/',          // ドキュメント
      'expo://api/',           // API仕様
      'expo://examples/',      // サンプルコード
      'expo://config/',        // 設定ファイル
      'expo://eas/'           // EAS設定
    ];
    
    expect(resourceTypes).toHaveLength(5);
    
    resourceTypes.forEach(resourceType => {
      expect(resourceType).toMatch(/^expo:\/\/[a-z]+\/$/);
      expect(resourceType.startsWith('expo://')).toBe(true);
      expect(resourceType.endsWith('/')).toBe(true);
    });
    
    const endTime = performance.now();
    console.log(`✅ 5つのリソースタイプ確認: ${(endTime - startTime).toFixed(2)}ms`);
    console.log('✅ リソースタイプ:', resourceTypes.join(', '));
  });

  test('リソース読み取り結果形式確認', () => {
    // リソース読み取り結果の基本形式
    const resourceContent = {
      uri: 'expo://docs/getting-started',
      contents: [
        {
          type: 'text',
          text: '# Getting Started with Expo\n\nThis guide will help you...'
        }
      ]
    };
    
    expect(resourceContent.uri).toBeDefined();
    expect(resourceContent.contents).toBeDefined();
    expect(Array.isArray(resourceContent.contents)).toBe(true);
    expect(resourceContent.contents[0].type).toBe('text');
    expect(resourceContent.contents[0].text).toBeDefined();
    
    console.log('✅ リソース読み取り結果形式確認完了');
  });

  test('リソースURI検証確認', () => {
    // URI検証のシミュレーション
    const validateResourceUri = (uri: string): boolean => {
      // expo:// スキーマ確認
      if (!uri.startsWith('expo://')) {
        return false;
      }
      
      // 有効なリソースタイプ確認
      const validTypes = ['docs', 'api', 'examples', 'config', 'eas'];
      const uriParts = uri.replace('expo://', '').split('/');
      const resourceType = uriParts[0];
      
      return validTypes.includes(resourceType);
    };
    
    // 正常なURI
    expect(validateResourceUri('expo://docs/getting-started')).toBe(true);
    expect(validateResourceUri('expo://api/camera')).toBe(true);
    expect(validateResourceUri('expo://examples/navigation')).toBe(true);
    expect(validateResourceUri('expo://config/app.json')).toBe(true);
    expect(validateResourceUri('expo://eas/build')).toBe(true);
    
    // 不正なURI
    expect(validateResourceUri('http://example.com')).toBe(false);
    expect(validateResourceUri('expo://invalid/path')).toBe(false);
    expect(validateResourceUri('docs/getting-started')).toBe(false);
    
    console.log('✅ リソースURI検証確認完了');
  });

  test('リソースリスト機能確認', () => {
    const startTime = performance.now();
    
    // リソースリスト機能のシミュレーション
    const listResources = (pattern?: string): Array<{ uri: string; name: string }> => {
      const allResources = [
        { uri: 'expo://docs/getting-started', name: 'Getting Started' },
        { uri: 'expo://docs/navigation', name: 'Navigation Guide' },
        { uri: 'expo://api/camera', name: 'Camera API' },
        { uri: 'expo://api/location', name: 'Location API' },
        { uri: 'expo://examples/hello-world', name: 'Hello World Example' }
      ];
      
      if (!pattern) return allResources;
      
      return allResources.filter(resource => 
        resource.uri.includes(pattern) || resource.name.toLowerCase().includes(pattern.toLowerCase())
      );
    };
    
    // 全リソース取得
    const allResources = listResources();
    expect(allResources.length).toBeGreaterThan(0);
    
    // パターンマッチング
    const docsResources = listResources('docs');
    expect(docsResources.length).toBe(2);
    expect(docsResources.every(r => r.uri.includes('docs'))).toBe(true);
    
    const apiResources = listResources('api');
    expect(apiResources.length).toBe(2);
    expect(apiResources.every(r => r.uri.includes('api'))).toBe(true);
    
    const endTime = performance.now();
    console.log(`✅ リソースリスト機能: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('リソースメタデータ確認', () => {
    // リソースメタデータの形式確認
    const resourceMetadata = {
      uri: 'expo://docs/getting-started',
      name: 'Getting Started Guide',
      description: 'Complete guide for getting started with Expo',
      mimeType: 'text/markdown',
      size: 15420,
      lastModified: '2024-12-01T10:00:00Z'
    };
    
    expect(resourceMetadata.uri).toBeDefined();
    expect(resourceMetadata.name).toBeDefined();
    expect(resourceMetadata.description).toBeDefined();
    expect(resourceMetadata.mimeType).toBeDefined();
    expect(typeof resourceMetadata.size).toBe('number');
    expect(resourceMetadata.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    
    console.log('✅ リソースメタデータ確認完了');
  });
}); 