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
    'node_modules/(?!(@modelcontextprotocol|@xenova|@fastify|nanoid|gray-matter|marked|node-fetch|sharp|onnxruntime-node)/)',
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.jsx$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    '^(\\.{1,2}/.*)\\.tsx$': '$1',
    // Mock problematic ES modules
    '^@xenova/transformers$': '<rootDir>/tests/__mocks__/xenova-transformers.js',
    '^@modelcontextprotocol/sdk$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk.js',
    '^@modelcontextprotocol/sdk/(.*)$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk.js',
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
  
  // Optimized timeout and worker settings for CI
  testTimeout: 8000,  // Reduced for faster execution
  forceExit: true,
  detectOpenHandles: false,  // Disabled for performance
  verbose: false,  // Reduce output verbosity
  silent: false,   // Allow important outputs
  
  // Optimized worker settings
  maxWorkers: '75%',  // Use 75% of available CPUs for faster execution
  
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