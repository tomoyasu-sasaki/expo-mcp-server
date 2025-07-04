import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const authenticationSetup: Tool = {
  name: 'expo_auth',
  description: 'Set up authentication with various providers using Expo AuthSession',
  inputSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        enum: ['expo', 'google', 'apple', 'facebook', 'github', 'custom-oauth', 'email-password'],
        default: 'expo',
        description: 'Authentication provider to configure',
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'login',
            'logout',
            'signup',
            'password-reset',
            'email-verification',
            'social-login',
            'biometric-auth',
            'two-factor-auth',
            'session-management',
            'secure-storage'
          ],
        },
        default: ['login', 'logout'],
        description: 'Authentication features to implement',
      },
      storageType: {
        type: 'string',
        enum: ['secure-store', 'async-storage', 'keychain'],
        default: 'secure-store',
        description: 'Storage type for authentication tokens',
      },
      sessionTimeout: {
        type: 'number',
        default: 3600,
        description: 'Session timeout in seconds',
      },
    },
    required: [],
  },
}; 