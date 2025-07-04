import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const expoBestPractices: Tool = {
  name: 'expo_best_practices',
  description: 'Analyze Expo code and provide best practices recommendations for performance, security, and maintainability',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['general', 'performance', 'security', 'deployment', 'eas', 'navigation', 'storage', 'ui-ux'],
        default: 'general',
        description: 'Category of best practices to analyze',
      },
      codeSnippet: {
        type: 'string',
        description: 'Code snippet to analyze for best practices',
      },
      platform: {
        type: 'string',
        enum: ['all', 'ios', 'android', 'web'],
        default: 'all',
        description: 'Platform-specific best practices',
      },
      analysisDepth: {
        type: 'string',
        enum: ['basic', 'detailed', 'comprehensive'],
        default: 'detailed',
        description: 'Depth of analysis to perform',
      },
      includeExamples: {
        type: 'boolean',
        default: true,
        description: 'Include code examples in recommendations',
      },
    },
    required: [],
  },
}; 