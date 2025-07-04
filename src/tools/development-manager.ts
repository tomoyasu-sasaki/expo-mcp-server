import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const developmentManager: Tool = {
  name: 'expo_dev_server',
  description: 'Manage Expo development server with platform-specific options',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['all', 'ios', 'android', 'web'],
        default: 'all',
        description: 'Target platform for development server',
      },
      port: {
        type: 'number',
        default: 8081,
        minimum: 1024,
        maximum: 65535,
        description: 'Port number for development server',
      },
      tunnel: {
        type: 'boolean',
        default: false,
        description: 'Enable tunnel for external device access',
      },
      clear: {
        type: 'boolean',
        default: false,
        description: 'Clear Metro bundler cache on start',
      },
      devClient: {
        type: 'boolean',
        default: false,
        description: 'Start with Expo Dev Client mode',
      },
      host: {
        type: 'string',
        enum: ['lan', 'tunnel', 'localhost'],
        default: 'lan',
        description: 'Development server host type',
      },
    },
    required: [],
  },
}; 