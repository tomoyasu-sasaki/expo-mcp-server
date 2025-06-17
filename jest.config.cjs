module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test files
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.test.ts',
  ],
  
  // TypeScript transform
  transform: {
    '^.+\\.ts$': 'ts-jest',
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
  testTimeout: 15000,
  forceExit: true,
  detectOpenHandles: true,
  
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
}; 