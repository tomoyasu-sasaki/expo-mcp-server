import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const storageManager: Tool = {
  name: 'expo_storage',
  description: 'Configure storage solutions including AsyncStorage, SecureStore, SQLite, and FileSystem',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['async-storage', 'secure-store', 'sqlite', 'file-system', 'mmkv'],
        default: 'async-storage',
        description: 'Storage type to configure',
      },
      features: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'basic-storage',
            'encrypted-storage',
            'offline-sync',
            'cache-management',
            'file-upload-download',
            'image-caching',
            'data-migration',
            'backup-restore',
            'compression',
            'indexing'
          ],
        },
        default: ['basic-storage'],
        description: 'Storage features to implement',
      },
      databaseSchema: {
        type: 'object',
        description: 'Database schema for SQLite (if applicable)',
      },
      cacheSize: {
        type: 'number',
        default: 50,
        description: 'Cache size in MB',
      },
      encryptionLevel: {
        type: 'string',
        enum: ['none', 'basic', 'advanced'],
        default: 'basic',
        description: 'Encryption level for sensitive data',
      },
    },
    required: [],
  },
}; 