/**
 * MCP Resource 実装
 * expo.yaml仕様準拠、URI解決とMIMEタイプ対応
 */

export interface ResourceResult {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export class ExpoResources {

  /**
   * リソース URI を解決してコンテンツを取得
   */
  static async resolveResource(uri: string): Promise<ResourceResult> {
    try {
      const url = new URL(uri);
      
      if (url.protocol !== 'expo:') {
        throw new Error(`Unsupported protocol: ${url.protocol}`);
      }

      // URIパスから適切なハンドラーを選択
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const resourceType = pathSegments[0];

      switch (resourceType) {
        case 'docs':
          return await ExpoResources.handleDocsResource(pathSegments.slice(1), url.searchParams);
        
        case 'api':
          return await ExpoResources.handleApiResource(pathSegments.slice(1), url.searchParams);
        
        case 'examples':
          return await ExpoResources.handleExamplesResource(pathSegments.slice(1), url.searchParams);
        
        case 'config':
          return await ExpoResources.handleConfigResource(pathSegments.slice(1), url.searchParams);
        
        case 'eas':
          return await ExpoResources.handleEasResource(pathSegments.slice(1), url.searchParams);
        
        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }
    } catch (error) {
      throw new Error(`Failed to resolve resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * expo://docs/{path} - Expo Documentation
   */
  private static async handleDocsResource(pathSegments: string[], _params: URLSearchParams): Promise<ResourceResult> {
    const docPath = pathSegments.join('/') || 'index';
    
    // 模擬実装 - 実際にはexpo.devからドキュメント取得
    await new Promise(resolve => setTimeout(resolve, 120)); // Network latency simulation
    
    const mockDocContent = ExpoResources.generateMockDocContent(docPath);
    
    return {
      uri: `expo://docs/${docPath}`,
      mimeType: 'text/markdown',
      text: mockDocContent,
    };
  }

  /**
   * expo://api/{module} - Expo SDK API Reference
   */
  private static async handleApiResource(pathSegments: string[], params: URLSearchParams): Promise<ResourceResult> {
    const moduleName = pathSegments[0];
    if (!moduleName) {
      throw new Error('Module name is required for API resource');
    }

    const sdkVersion = params.get('version') || 'latest';
    
    // 模擬実装 - 実際にはSDK APIリファレンス取得
    await new Promise(resolve => setTimeout(resolve, 80)); // API call simulation
    
    const mockApiContent = ExpoResources.generateMockApiContent(moduleName, sdkVersion);
    
    return {
      uri: `expo://api/${moduleName}?version=${sdkVersion}`,
      mimeType: 'text/markdown',
      text: mockApiContent,
    };
  }

  /**
   * expo://examples/{category} - Code Examples
   */
  private static async handleExamplesResource(pathSegments: string[], params: URLSearchParams): Promise<ResourceResult> {
    const category = pathSegments[0] || 'general';
    const platform = params.get('platform') || 'universal';
    const language = params.get('language') || 'typescript';
    
    // 模擬実装 - 実際にはコード例データベース検索
    await new Promise(resolve => setTimeout(resolve, 200)); // Database query simulation
    
    const mockExamples = ExpoResources.generateMockExamples(category, platform, language);
    
    return {
      uri: `expo://examples/${category}?platform=${platform}&language=${language}`,
      mimeType: 'application/json',
      text: JSON.stringify(mockExamples, null, 2),
    };
  }

  /**
   * expo://config/{type} - Configuration Templates
   */
  private static async handleConfigResource(pathSegments: string[], params: URLSearchParams): Promise<ResourceResult> {
    const configType = pathSegments[0];
    if (!configType) {
      throw new Error('Configuration type is required');
    }

    const preset = params.get('preset') || 'default';
    const platform = params.get('platform') || undefined;
    
    // 模擬実装 - 実際には設定テンプレート生成エンジン
    await new Promise(resolve => setTimeout(resolve, 150)); // Template generation simulation
    
    const mockConfig = ExpoResources.generateMockConfig(configType, preset, platform);
    
    return {
      uri: `expo://config/${configType}?preset=${preset}${platform ? `&platform=${platform}` : ''}`,
      mimeType: configType === 'metro.config.js' ? 'application/javascript' : 'application/json',
      text: mockConfig,
    };
  }

  /**
   * expo://eas/{command} - EAS Commands
   */
  private static async handleEasResource(pathSegments: string[], params: URLSearchParams): Promise<ResourceResult> {
    const command = pathSegments[0];
    if (!command) {
      throw new Error('EAS command is required');
    }

    const platform = params.get('platform') || 'all';
    const profile = params.get('profile') || 'development';
    
    // 模擬実装 - 実際にはEAS CLIドキュメント参照
    await new Promise(resolve => setTimeout(resolve, 60)); // Command generation simulation
    
    const mockCommand = ExpoResources.generateMockEasCommand(command, platform, profile);
    
    return {
      uri: `expo://eas/${command}?platform=${platform}&profile=${profile}`,
      mimeType: 'text/plain',
      text: mockCommand,
    };
  }

  // =============================================================================
  // Mock Content Generators
  // =============================================================================

  private static generateMockDocContent(docPath: string): string {
    return `# Expo Documentation: ${docPath}

This is a mock documentation page for \`${docPath}\`.

## Overview

This documentation covers the implementation and usage of ${docPath} in Expo applications.

## Installation

\`\`\`bash
npx expo install ${docPath.includes('/') ? docPath.split('/')[0] : docPath}
\`\`\`

## Basic Usage

\`\`\`typescript
import { ${docPath.charAt(0).toUpperCase() + docPath.slice(1)} } from 'expo-${docPath}';

export default function App() {
  const handle${docPath.charAt(0).toUpperCase() + docPath.slice(1)} = async () => {
    const result = await ${docPath.charAt(0).toUpperCase() + docPath.slice(1)}.getInfo();
    console.log(result);
  };

  return (
    <View>
      <Button title="Use ${docPath}" onPress={handle${docPath.charAt(0).toUpperCase() + docPath.slice(1)}} />
    </View>
  );
}
\`\`\`

## Platform Support

- ✅ iOS
- ✅ Android
- ✅ Web

## API Reference

See [API documentation](expo://api/${docPath}) for detailed method signatures.

---
*Last updated: ${new Date().toISOString()}*
*Source: https://docs.expo.dev/${docPath}*`;
  }

  private static generateMockApiContent(moduleName: string, sdkVersion: string): string {
    return `# ${moduleName} API Reference

**SDK Version:** ${sdkVersion}  
**Module:** expo-${moduleName}

## Installation

\`\`\`bash
npx expo install expo-${moduleName}
\`\`\`

## Import

\`\`\`typescript
import * as ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} from 'expo-${moduleName}';
\`\`\`

## Methods

### \`get${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Async()\`

**Type:** \`() => Promise<${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Result>\`

Get information about the ${moduleName} module.

**Returns:** Promise that resolves to ${moduleName} data.

**Example:**
\`\`\`typescript
const result = await ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}.get${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Async();
console.log(result);
\`\`\`

### \`is${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Available()\`

**Type:** \`() => boolean\`

Check if ${moduleName} is available on the current platform.

**Returns:** Boolean indicating availability.

## Types

### \`${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Result\`

\`\`\`typescript
interface ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}Result {
  success: boolean;
  data?: any;
  error?: string;
}
\`\`\`

## Constants

### \`${moduleName.toUpperCase()}_VERSION\`

**Type:** \`string\`

The version of the ${moduleName} module.

## Platform Support

| Platform | Support |
|----------|---------|
| iOS      | ✅      |
| Android  | ✅      |
| Web      | ⚠️ Limited |

---
*Generated for SDK ${sdkVersion}*
*Source: https://docs.expo.dev/versions/${sdkVersion}/sdk/${moduleName}*`;
  }

  private static generateMockExamples(category: string, platform: string, language: string): any {
    return {
      category,
      platform,
      language,
      examples: [
        {
          id: `${category}-basic-${platform}`,
          title: `Basic ${category} Usage`,
          description: `Simple example showing how to use ${category} in ${platform} applications`,
          code: language === 'typescript' 
            ? `import React from 'react';
import { View, Button } from 'react-native';
import { ${category.charAt(0).toUpperCase() + category.slice(1)} } from 'expo-${category}';

export default function ${category.charAt(0).toUpperCase() + category.slice(1)}Example() {
  const handle${category.charAt(0).toUpperCase() + category.slice(1)} = async () => {
    try {
      const result = await ${category.charAt(0).toUpperCase() + category.slice(1)}.doSomething();
      console.log('Result:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button 
        title="Use ${category}" 
        onPress={handle${category.charAt(0).toUpperCase() + category.slice(1)}} 
      />
    </View>
  );
}`
            : `import React from 'react';
import { View, Button } from 'react-native';
import { ${category.charAt(0).toUpperCase() + category.slice(1)} } from 'expo-${category}';

export default function ${category.charAt(0).toUpperCase() + category.slice(1)}Example() {
  const handle${category.charAt(0).toUpperCase() + category.slice(1)} = async () => {
    try {
      const result = await ${category.charAt(0).toUpperCase() + category.slice(1)}.doSomething();
      console.log('Result:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button 
        title="Use ${category}" 
        onPress={handle${category.charAt(0).toUpperCase() + category.slice(1)}} 
      />
    </View>
  );
}`,
          snack_url: `https://snack.expo.dev/@anonymous/${category}-${platform}-example`,
          dependencies: {
            [`expo-${category}`]: 'latest',
            'expo': '~49.0.0',
            'react': '^18.0.0',
            'react-native': '0.72.6',
          },
          platforms: platform === 'universal' ? ['ios', 'android', 'web'] : [platform],
          difficulty: 'beginner',
          tags: [category, platform, 'example'],
        },
        {
          id: `${category}-advanced-${platform}`,
          title: `Advanced ${category} Implementation`,
          description: `Advanced example with error handling and configuration for ${category}`,
          code: language === 'typescript'
            ? `import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { ${category.charAt(0).toUpperCase() + category.slice(1)} } from 'expo-${category}';

interface ${category.charAt(0).toUpperCase() + category.slice(1)}State {
  isLoading: boolean;
  data: any;
  error: string | null;
}

export default function Advanced${category.charAt(0).toUpperCase() + category.slice(1)}() {
  const [state, setState] = useState<${category.charAt(0).toUpperCase() + category.slice(1)}State>({
    isLoading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    if (${category.charAt(0).toUpperCase() + category.slice(1)}.isAvailable?.()) {
      console.log('${category} is available');
    } else {
      setState(prev => ({ ...prev, error: '${category} not available on this platform' }));
    }
  };

  const executeAction = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await ${category.charAt(0).toUpperCase() + category.slice(1)}.advancedOperation({
        timeout: 5000,
        retries: 3,
      });
      setState(prev => ({ ...prev, data: result, isLoading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false 
      }));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Advanced ${category} Example</Text>
      
      {state.error && (
        <Text style={styles.error}>Error: {state.error}</Text>
      )}
      
      {state.data && (
        <Text style={styles.data}>Data: {JSON.stringify(state.data, null, 2)}</Text>
      )}
      
      <Button 
        title={state.isLoading ? 'Loading...' : 'Execute Advanced Action'}
        onPress={executeAction}
        disabled={state.isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  data: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
});`
            : `import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { ${category.charAt(0).toUpperCase() + category.slice(1)} } from 'expo-${category}';

export default function Advanced${category.charAt(0).toUpperCase() + category.slice(1)}() {
  const [state, setState] = useState({
    isLoading: false,
    data: null,
    error: null,
  });

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    if (${category.charAt(0).toUpperCase() + category.slice(1)}.isAvailable?.()) {
      console.log('${category} is available');
    } else {
      setState(prev => ({ ...prev, error: '${category} not available on this platform' }));
    }
  };

  const executeAction = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await ${category.charAt(0).toUpperCase() + category.slice(1)}.advancedOperation({
        timeout: 5000,
        retries: 3,
      });
      setState(prev => ({ ...prev, data: result, isLoading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error.message || 'Unknown error',
        isLoading: false 
      }));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Advanced ${category} Example</Text>
      
      {state.error && (
        <Text style={styles.error}>Error: {state.error}</Text>
      )}
      
      {state.data && (
        <Text style={styles.data}>Data: {JSON.stringify(state.data, null, 2)}</Text>
      )}
      
      <Button 
        title={state.isLoading ? 'Loading...' : 'Execute Advanced Action'}
        onPress={executeAction}
        disabled={state.isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
  data: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginBottom: 10,
    fontFamily: 'monospace',
  },
});`,
          snack_url: `https://snack.expo.dev/@anonymous/${category}-advanced-${platform}`,
          dependencies: {
            [`expo-${category}`]: 'latest',
            'expo': '~49.0.0',
            'react': '^18.0.0',
            'react-native': '0.72.6',
          },
          platforms: platform === 'universal' ? ['ios', 'android', 'web'] : [platform],
          difficulty: 'advanced',
          tags: [category, platform, 'advanced', 'error-handling'],
        },
      ],
      metadata: {
        total_examples: 2,
        category,
        platform,
        language,
        generated_at: new Date().toISOString(),
      },
    };
  }

  private static generateMockConfig(configType: string, preset: string, platform?: string): string {
    switch (configType) {
      case 'app.json':
        return JSON.stringify({
          expo: {
            name: 'MyExpoApp',
            slug: 'my-expo-app',
            version: '1.0.0',
            orientation: 'portrait',
            icon: './assets/icon.png',
            userInterfaceStyle: 'light',
            splash: {
              image: './assets/splash.png',
              resizeMode: 'contain',
              backgroundColor: '#ffffff',
            },
            assetBundlePatterns: ['**/*'],
            ios: {
              supportsTablet: true,
              bundleIdentifier: 'com.yourcompany.myexpoapp',
            },
            android: {
              adaptiveIcon: {
                foregroundImage: './assets/adaptive-icon.png',
                backgroundColor: '#FFFFFF',
              },
              package: 'com.yourcompany.myexpoapp',
            },
            web: {
              favicon: './assets/favicon.png',
            },
            plugins: preset === 'advanced' ? [
              'expo-camera',
              'expo-location',
              ['expo-notifications', { icon: './assets/notification-icon.png' }],
            ] : [],
          },
        }, null, 2);

      case 'eas.json':
        return JSON.stringify({
          cli: {
            version: '>= 5.2.0',
          },
          build: {
            development: {
              developmentClient: true,
              distribution: 'internal',
              ...(platform === 'ios' && { ios: { simulator: true } }),
              ...(platform === 'android' && { android: { buildType: 'apk' } }),
            },
            preview: {
              distribution: 'internal',
              ...(preset === 'advanced' && {
                env: {
                  NODE_ENV: 'staging',
                },
              }),
            },
            production: {
              ...(preset === 'advanced' && {
                env: {
                  NODE_ENV: 'production',
                },
              }),
            },
          },
          submit: {
            production: {},
          },
        }, null, 2);

      case 'metro.config.js':
        return `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

${preset === 'advanced' ? `
// Custom transformer for SVG support
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

// Custom resolver for better module resolution
config.resolver.alias = {
  '@components': './src/components',
  '@utils': './src/utils',
  '@assets': './assets',
};

// Enable source maps in production
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};
` : ''}
module.exports = config;`;

      default:
        return '{}';
    }
  }

  private static generateMockEasCommand(command: string, platform: string, profile: string): string {
    const platformFlag = platform === 'all' ? '--platform all' : `--platform ${platform}`;
    const profileFlag = profile !== 'development' ? ` --profile ${profile}` : '';
    
    const baseCommand = `eas ${command} ${platformFlag}${profileFlag}`;
    
    return `# EAS ${command.toUpperCase()} Command

## Basic Command
\`\`\`bash
${baseCommand}
\`\`\`

## Description
${command === 'build' ? 'Build your app for distribution or development' :
  command === 'submit' ? 'Submit your app to app stores' :
  command === 'update' ? 'Publish an over-the-air update' :
  command === 'credentials' ? 'Manage app credentials and certificates' :
  `Execute ${command} operation`}

## Available Flags
${command === 'build' ? `
- \`--platform\`: Target platform (ios, android, all)
- \`--profile\`: Build profile (development, preview, production)
- \`--clear-cache\`: Clear build cache
- \`--local\`: Build locally
- \`--non-interactive\`: Run in non-interactive mode
- \`--wait\`: Wait for build to complete
` : command === 'submit' ? `
- \`--platform\`: Target platform (ios, android, all)
- \`--profile\`: Submit profile
- \`--latest\`: Submit latest build
- \`--id\`: Submit specific build ID
- \`--path\`: Submit binary from local path
` : command === 'update' ? `
- \`--branch\`: Target branch
- \`--message\`: Update message
- \`--republish\`: Republish existing update
- \`--platform\`: Target platform (ios, android, all)
- \`--auto\`: Automatically determine update strategy
` : `
- \`--platform\`: Target platform (ios, android)
- \`--clear\`: Clear credentials
- \`--non-interactive\`: Run in non-interactive mode
`}

## Prerequisites
1. EAS CLI installed: \`npm install -g eas-cli\`
2. Logged in: \`eas login\`
3. Project configured: \`eas build:configure\`${command === 'submit' ? '\n4. Valid build available for submission' : ''}

## Example Usage
\`\`\`bash
# ${command === 'build' ? 'Development build for iOS' :
    command === 'submit' ? 'Submit to TestFlight' :
    command === 'update' ? 'Publish update to production' :
    'Manage iOS credentials'}
${command === 'build' ? 'eas build --platform ios --profile development' :
  command === 'submit' ? 'eas submit --platform ios --latest' :
  command === 'update' ? 'eas update --branch production --message "Bug fixes"' :
  'eas credentials --platform ios'}

# ${command === 'build' ? 'Production build for all platforms' :
    command === 'submit' ? 'Submit to both app stores' :
    command === 'update' ? 'Republish last update' :
    'Clear Android credentials'}
${command === 'build' ? 'eas build --platform all --profile production' :
  command === 'submit' ? 'eas submit --platform all --latest' :
  command === 'update' ? 'eas update --republish' :
  'eas credentials --platform android --clear'}
\`\`\`

---
Generated for platform: ${platform}, profile: ${profile}
EAS CLI Documentation: https://docs.expo.dev/eas/`;
  }
}

// =============================================================================
// Resource Schema Exports (for server registration)
// =============================================================================

export const RESOURCE_SCHEMAS = [
  {
    uri: 'expo://docs/{path}',
    name: 'Expo Documentation',
    description: 'Expo公式ドキュメント',
    mimeType: 'text/markdown',
  },
  {
    uri: 'expo://api/{module}',
    name: 'Expo SDK API Reference',
    description: 'Expo SDK APIリファレンス',
    mimeType: 'text/markdown',
  },
  {
    uri: 'expo://examples/{category}',
    name: 'Code Examples',
    description: '実行可能なコード例とSnackリンク',
    mimeType: 'application/json',
  },
  {
    uri: 'expo://config/{type}',
    name: 'Configuration Templates',
    description: 'Expo設定ファイルテンプレート',
    mimeType: 'application/json',
  },
  {
    uri: 'expo://eas/{command}',
    name: 'EAS Commands',
    description: 'EAS CLI コマンドリファレンス',
    mimeType: 'text/plain',
  },
] as const; 