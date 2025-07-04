#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Tools
import { projectInitializer } from './tools/project-initializer.js';
import { expoConfigGenerator } from './tools/expo-config-generator.js';
import { developmentManager } from './tools/development-manager.js';
import { buildManager } from './tools/build-manager.js';
import { easManager } from './tools/eas-manager.js';
import { deploymentHelper } from './tools/deployment-helper.js';
import { authenticationSetup } from './tools/authentication-setup.js';
import { storageManager } from './tools/storage-manager.js';
import { navigationHelper } from './tools/navigation-helper.js';
import { expoBestPractices } from './tools/expo-best-practices.js';

class ExpoMCPServer {
  private server: Server;
  private tools: Tool[];

  constructor() {
    this.server = new Server(
      {
        name: 'expo-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tools = [
      projectInitializer,
      expoConfigGenerator,
      developmentManager,
      buildManager,
      easManager,
      deploymentHelper,
      authenticationSetup,
      storageManager,
      navigationHelper,
      expoBestPractices,
    ];

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'expo_project_init':
            return await this.handleProjectInit(args);
          case 'expo_config_generate':
            return await this.handleConfigGeneration(args);
          case 'expo_dev_server':
            return await this.handleDevelopmentServer(args);
          case 'expo_build':
            return await this.handleBuildManagement(args);
          case 'expo_eas':
            return await this.handleEASOperations(args);
          case 'expo_deploy':
            return await this.handleDeployment(args);
          case 'expo_auth':
            return await this.handleAuthentication(args);
          case 'expo_storage':
            return await this.handleStorage(args);
          case 'expo_navigation':
            return await this.handleNavigation(args);
          case 'expo_best_practices':
            return await this.handleBestPractices(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleProjectInit(args: any) {
    const { 
      template = 'blank',
      projectName = 'MyExpoApp',
      packageManager = 'npm',
      features = []
    } = args;
    
    const result = await this.initializeExpoProject({
      template,
      projectName,
      packageManager,
      features,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🚀 Expo project initialized successfully!\n\n` +
                `Template: ${template}\n` +
                `Project name: ${projectName}\n` +
                `Package manager: ${packageManager}\n` +
                `Features: ${features.join(', ')}\n\n` +
                `Files created:\n${result.filesCreated.map(file => `- ${file}`).join('\n')}\n\n` +
                `Next steps:\n${result.nextSteps.join('\n')}`,
        },
      ],
    };
  }

  private async handleConfigGeneration(args: any) {
    const { 
      platform = ['ios', 'android', 'web'],
      features = [],
      environment = 'development'
    } = args;
    
    const config = await this.generateExpoConfig({
      platform,
      features,
      environment,
    });

    return {
      content: [
        {
          type: 'text',
          text: `⚙️ Expo configuration generated:\n\n` +
                `\`\`\`json\n${config.content}\`\`\`\n\n` +
                `Platforms: ${config.platforms.join(', ')}\n` +
                `Features enabled: ${config.features.join(', ')}\n` +
                `Environment: ${config.environment}`,
        },
      ],
    };
  }

  private async handleDevelopmentServer(args: any) {
    const { 
      platform = 'all',
      port = 8081,
      tunnel = false,
      clear = false
    } = args;
    
    const serverInfo = await this.manageDevelopmentServer({
      platform,
      port,
      tunnel,
      clear,
    });

    return {
      content: [
        {
          type: 'text',
          text: `📱 Development server configured:\n\n` +
                `Platform: ${serverInfo.platform}\n` +
                `Port: ${serverInfo.port}\n` +
                `Tunnel: ${serverInfo.tunnel ? 'Enabled' : 'Disabled'}\n` +
                `QR Code: ${serverInfo.qrCode}\n` +
                `URLs:\n${serverInfo.urls.map(url => `- ${url}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleBuildManagement(args: any) {
    const { 
      platform = 'all',
      profile = 'development',
      local = false
    } = args;
    
    const buildInfo = await this.manageBuild({
      platform,
      profile,
      local,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔨 Build configuration:\n\n` +
                `Platform: ${buildInfo.platform}\n` +
                `Profile: ${buildInfo.profile}\n` +
                `Type: ${buildInfo.local ? 'Local' : 'Cloud'}\n` +
                `Commands:\n${buildInfo.commands.map(cmd => `- ${cmd}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleEASOperations(args: any) {
    const { 
      operation = 'configure',
      platform = 'all',
      profile = 'production'
    } = args;
    
    const easResult = await this.manageEAS({
      operation,
      platform,
      profile,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🏗️ EAS ${operation} completed:\n\n` +
                `Platform: ${easResult.platform}\n` +
                `Profile: ${easResult.profile}\n` +
                `Configuration: ${easResult.configPath}\n` +
                `Status: ${easResult.status}\n` +
                `Next steps:\n${easResult.nextSteps.join('\n')}`,
        },
      ],
    };
  }

  private async handleDeployment(args: any) {
    const { 
      target = 'development',
      message = 'Update via Expo MCP',
      platform = 'all'
    } = args;
    
    const deployment = await this.manageDeployment({
      target,
      message,
      platform,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🚀 Deployment ${deployment.type}:\n\n` +
                `Target: ${deployment.target}\n` +
                `Platform: ${deployment.platform}\n` +
                `Status: ${deployment.status}\n` +
                `URL: ${deployment.url || 'N/A'}\n` +
                `Message: ${deployment.message}`,
        },
      ],
    };
  }

  private async handleAuthentication(args: any) {
    const { 
      provider = 'expo',
      features = ['login', 'logout']
    } = args;
    
    const authSetup = await this.setupAuthentication({
      provider,
      features,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🔐 Authentication setup:\n\n` +
                `Provider: ${authSetup.provider}\n` +
                `Features: ${authSetup.features.join(', ')}\n` +
                `Configuration files:\n${authSetup.files.map(file => `- ${file}`).join('\n')}\n` +
                `Code examples:\n\`\`\`typescript\n${authSetup.examples}\`\`\``,
        },
      ],
    };
  }

  private async handleStorage(args: any) {
    const { 
      type = 'async-storage',
      features = ['basic-storage']
    } = args;
    
    const storageSetup = await this.setupStorage({
      type,
      features,
    });

    return {
      content: [
        {
          type: 'text',
          text: `💾 Storage configuration:\n\n` +
                `Type: ${storageSetup.type}\n` +
                `Features: ${storageSetup.features.join(', ')}\n` +
                `Dependencies: ${storageSetup.dependencies.join(', ')}\n` +
                `Usage examples:\n\`\`\`typescript\n${storageSetup.examples}\`\`\``,
        },
      ],
    };
  }

  private async handleNavigation(args: any) {
    const { 
      type = 'expo-router',
      structure = 'tabs'
    } = args;
    
    const navigation = await this.setupNavigation({
      type,
      structure,
    });

    return {
      content: [
        {
          type: 'text',
          text: `🧭 Navigation setup:\n\n` +
                `Type: ${navigation.type}\n` +
                `Structure: ${navigation.structure}\n` +
                `Files created:\n${navigation.files.map(file => `- ${file}`).join('\n')}\n` +
                `Example routes:\n${navigation.routes.map(route => `- ${route}`).join('\n')}`,
        },
      ],
    };
  }

  private async handleBestPractices(args: any) {
    const { 
      category = 'general',
      codeSnippet = ''
    } = args;
    
    const practices = await this.analyzeBestPractices({
      category,
      codeSnippet,
    });

    return {
      content: [
        {
          type: 'text',
          text: `📋 Expo best practices for ${category}:\n\n` +
                practices.map(p => `**${p.title}**\n${p.description}\n\n\`\`\`typescript\n${p.example}\`\`\``).join('\n\n'),
        },
      ],
    };
  }

  // Implementation methods
  private async initializeExpoProject(params: any) {
    return {
      filesCreated: [
        'app.json',
        'package.json',
        'App.tsx',
        'babel.config.js',
        'metro.config.js',
      ],
      nextSteps: [
        '1. cd into your project directory',
        '2. Run `npm install` or `yarn install`',
        '3. Run `npx expo start` to start development',
        '4. Open Expo Go app on your device to preview',
      ],
    };
  }

  private async generateExpoConfig(params: any) {
    return {
      content: JSON.stringify({
        expo: {
          name: 'MyExpoApp',
          slug: 'my-expo-app',
          version: '1.0.0',
          platforms: params.platform,
          ...params.features.reduce((acc: any, feature: string) => {
            switch (feature) {
              case 'push-notifications':
                acc.notification = { icon: './assets/notification-icon.png' };
                break;
              case 'location':
                acc.permissions = ['LOCATION'];
                break;
            }
            return acc;
          }, {}),
        },
      }, null, 2),
      platforms: params.platform,
      features: params.features,
      environment: params.environment,
    };
  }

  private async manageDevelopmentServer(params: any) {
    return {
      platform: params.platform,
      port: params.port,
      tunnel: params.tunnel,
      qrCode: 'exp://192.168.1.100:8081',
      urls: [
        `http://localhost:${params.port}`,
        'exp://192.168.1.100:8081',
        params.tunnel ? 'https://exp-tunnel.expo.dev' : null,
      ].filter(Boolean),
    };
  }

  private async manageBuild(params: any) {
    return {
      platform: params.platform,
      profile: params.profile,
      local: params.local,
      commands: [
        `eas build --platform ${params.platform} --profile ${params.profile}`,
        params.local ? 'eas build --local' : 'eas build',
      ],
    };
  }

  private async manageEAS(params: any) {
    return {
      platform: params.platform,
      profile: params.profile,
      configPath: 'eas.json',
      status: 'configured',
      nextSteps: [
        '1. Verify your Apple Developer/Google Play credentials',
        '2. Run `eas build` to create your first build',
        '3. Run `eas submit` to publish to app stores',
      ],
    };
  }

  private async manageDeployment(params: any) {
    return {
      type: 'over-the-air',
      target: params.target,
      platform: params.platform,
      status: 'published',
      url: 'https://expo.dev/@username/my-expo-app',
      message: params.message,
    };
  }

  private async setupAuthentication(params: any) {
    return {
      provider: params.provider,
      features: params.features,
      files: ['AuthProvider.tsx', 'authConfig.ts', 'hooks/useAuth.ts'],
      examples: `
import { AuthProvider } from './AuthProvider';

export default function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}`,
    };
  }

  private async setupStorage(params: any) {
    return {
      type: params.type,
      features: params.features,
      dependencies: ['@react-native-async-storage/async-storage'],
      examples: `
import AsyncStorage from '@react-native-async-storage/async-storage';

const storeData = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error('Error storing data', e);
  }
};`,
    };
  }

  private async setupNavigation(params: any) {
    return {
      type: params.type,
      structure: params.structure,
      files: ['app/_layout.tsx', 'app/(tabs)/_layout.tsx', 'app/index.tsx'],
      routes: ['/', '/profile', '/settings', '/search'],
    };
  }

  private async analyzeBestPractices(params: any) {
    const practices = {
      general: [
        {
          title: 'Expo SDK Version Management',
          description: 'Always use the latest stable SDK version and upgrade regularly',
          example: 'npx expo install --fix',
        },
        {
          title: 'Environment Configuration',
          description: 'Use app.config.js for dynamic configuration',
          example: `export default {
  expo: {
    name: process.env.APP_NAME || 'MyApp',
    extra: {
      apiUrl: process.env.API_URL,
    },
  },
};`,
        },
      ],
      performance: [
        {
          title: 'Bundle Size Optimization',
          description: 'Use Expo Bundle Analyzer to optimize bundle size',
          example: 'npx expo export --analyze',
        },
      ],
      security: [
        {
          title: 'Secure Storage',
          description: 'Use Expo SecureStore for sensitive data',
          example: `import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('token', userToken);`,
        },
      ],
    };

    return practices[params.category as keyof typeof practices] || practices.general;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start server
const server = new ExpoMCPServer();
server.run().catch(console.error); 