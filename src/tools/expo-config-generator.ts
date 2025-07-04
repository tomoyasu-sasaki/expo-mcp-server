import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const expoConfigGenerator: Tool = {
  name: 'expo_config_generate',
  description: 'Generate Expo configuration with app.json/app.config.js optimization',
  inputSchema: {
    type: 'object',
    properties: {
      platform: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['ios', 'android', 'web'],
        },
        default: ['ios', 'android', 'web'],
        description: 'Target platforms for configuration',
      },
      environment: {
        type: 'string',
        enum: ['development', 'preview', 'production'],
        default: 'development',
        description: 'Environment configuration',
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'push-notifications',
            'location-services',
            'camera-permissions',
            'microphone-permissions',
            'photo-library-permissions',
            'contacts-permissions',
            'calendar-permissions',
            'deep-linking',
            'universal-links',
            'app-store-connect',
            'google-play-console',
            'over-the-air-updates',
            'splash-screen',
            'app-icon',
            'status-bar',
            'orientation',
            'background-modes'
          ],
        },
        default: ['splash-screen', 'app-icon', 'status-bar'],
        description: 'App features to configure',
      },
      buildProfile: {
        type: 'string',
        enum: ['development', 'preview', 'production'],
        default: 'development',
        description: 'EAS Build profile to optimize for',
      },
    },
    required: [],
  },
}; 