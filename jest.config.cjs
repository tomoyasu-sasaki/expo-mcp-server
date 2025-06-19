module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  
  // Test files
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.test.ts',
  ],
  
  // TypeScript transform with ES module support
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022',
        moduleResolution: 'node'
      }
    }],
  },
  
  // Transform ALL ES modules in node_modules (more comprehensive)
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|@xenova|@fastify|nanoid|gray-matter|marked|node-fetch)/)',
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.jsx$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    '^(\\.{1,2}/.*)\\.tsx$': '$1',
  },
  
  // Module paths
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.test.ts'],
  
  // Timeout and worker settings
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  
  // Worker settings for ES modules
  maxWorkers: 1,
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/mcp-protocol.test.ts',
  ],
  
  // Environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  
  // Experimental features for ES modules
  resolver: undefined,
}; 