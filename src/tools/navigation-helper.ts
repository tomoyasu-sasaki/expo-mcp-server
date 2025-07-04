import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const navigationHelper: Tool = {
  name: 'expo_navigation',
  description: 'Set up navigation with Expo Router or React Navigation',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['expo-router', 'react-navigation', 'stack', 'tabs', 'drawer'],
        default: 'expo-router',
        description: 'Navigation library/pattern to use',
      },
      structure: {
        type: 'string',
        enum: ['tabs', 'stack', 'drawer', 'modal', 'nested', 'auth-flow'],
        default: 'tabs',
        description: 'Navigation structure pattern',
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'deep-linking',
            'push-navigation',
            'modal-navigation',
            'tab-navigation',
            'drawer-navigation',
            'authentication-flow',
            'onboarding-flow',
            'lazy-loading',
            'navigation-guards',
            'breadcrumb-navigation'
          ],
        },
        default: ['deep-linking', 'tab-navigation'],
        description: 'Navigation features to implement',
      },
      screens: {
        type: 'array',
        items: {
          type: 'string',
        },
        default: ['Home', 'Profile', 'Settings'],
        description: 'Screen names to generate',
      },
    },
    required: [],
  },
}; 