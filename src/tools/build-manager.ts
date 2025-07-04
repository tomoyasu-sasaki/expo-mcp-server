import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const buildManager: Tool = {
  name: 'expo_build',
  description: 'Manage Expo builds with EAS Build and local build options',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['all', 'ios', 'android'],
        default: 'all',
        description: 'Target platform for build',
      },
      profile: {
        type: 'string',
        enum: ['development', 'preview', 'production'],
        default: 'development',
        description: 'Build profile to use from eas.json',
      },
      local: {
        type: 'boolean',
        default: false,
        description: 'Build locally instead of using EAS Build',
      },
      buildType: {
        type: 'string',
        enum: ['apk', 'app-bundle', 'archive'],
        description: 'Specific build type (platform dependent)',
      },
      clearCache: {
        type: 'boolean',
        default: false,
        description: 'Clear build cache before building',
      },
      autoSubmit: {
        type: 'boolean',
        default: false,
        description: 'Automatically submit to app stores after build',
      },
    },
    required: [],
  },
}; 