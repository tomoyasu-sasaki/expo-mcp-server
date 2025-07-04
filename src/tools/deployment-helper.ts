import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const deploymentHelper: Tool = {
  name: 'expo_deploy',
  description: 'Deploy Expo apps with over-the-air updates, web deployment, and store submission',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: ['development', 'preview', 'production', 'web', 'app-stores'],
        default: 'development',
        description: 'Deployment target environment',
      },
      platform: {
        type: 'string',
        enum: ['all', 'ios', 'android', 'web'],
        default: 'all',
        description: 'Target platform for deployment',
      },
      message: {
        type: 'string',
        default: 'Update via Expo MCP',
        description: 'Deployment/update message',
      },
      branch: {
        type: 'string',
        default: 'main',
        description: 'Git branch for deployment',
      },
      webHosting: {
        type: 'string',
        enum: ['netlify', 'vercel', 'github-pages', 'aws-s3', 'firebase'],
        description: 'Web hosting platform (for web deployments)',
      },
      autoUpdate: {
        type: 'boolean',
        default: true,
        description: 'Enable automatic over-the-air updates',
      },
    },
    required: [],
  },
}; 