import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const easManager: Tool = {
  name: 'expo_eas',
  description: 'Manage EAS (Expo Application Services) build, submit, and update operations',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['configure', 'build', 'submit', 'update', 'metadata'],
        default: 'configure',
        description: 'EAS operation to perform',
      },
      platform: {
        type: 'string',
        enum: ['all', 'ios', 'android'],
        default: 'all',
        description: 'Target platform for EAS operation',
      },
      profile: {
        type: 'string',
        enum: ['development', 'preview', 'production'],
        default: 'production',
        description: 'Build/Submit profile to use',
      },
      message: {
        type: 'string',
        description: 'Update message for EAS Update',
      },
      branch: {
        type: 'string',
        default: 'main',
        description: 'Branch for EAS Update',
      },
      autoPublish: {
        type: 'boolean',
        default: false,
        description: 'Automatically publish update after build',
      },
    },
    required: [],
  },
}; 