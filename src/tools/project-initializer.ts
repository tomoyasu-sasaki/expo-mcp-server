import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const projectInitializer: Tool = {
  name: 'expo_project_init',
  description: 'Initialize new Expo project with optimized setup and templates',
  inputSchema: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        enum: ['blank', 'blank-typescript', 'tabs', 'navigation', 'bare-minimum'],
        default: 'blank',
        description: 'Expo project template to use',
      },
      projectName: {
        type: 'string',
        default: 'MyExpoApp',
        description: 'Name of the project',
      },
      packageManager: {
        type: 'string',
        enum: ['npm', 'yarn', 'pnpm', 'bun'],
        default: 'npm',
        description: 'Package manager to use',
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'expo-router',
            'typescript',
            'expo-dev-client',
            'react-navigation',
            'expo-location',
            'expo-camera',
            'expo-notifications',
            'expo-auth-session',
            'expo-secure-store',
            'expo-sqlite',
            'expo-file-system',
            'expo-av',
            'expo-image-picker'
          ],
        },
        default: ['typescript', 'expo-router'],
        description: 'Additional features to include in the project',
      },
      platforms: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['ios', 'android', 'web'],
        },
        default: ['ios', 'android', 'web'],
        description: 'Target platforms for the project',
      },
    },
    required: [],
  },
}; 