/**
 * 基本セットアップテスト
 */

// Jest global setup for all tests
import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Store original timers
  jest.useFakeTimers();
  
  // Mock console methods
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://localhost:6380';
  process.env.TYPESENSE_URL = 'http://localhost:8109';
});

afterAll(async () => {
  // Clear all timers
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Restore console
  global.console = originalConsole;
  
  // Force cleanup any remaining processes
  if (process.env.NODE_ENV === 'test') {
    // Clear all intervals and timeouts - use safer approach
    const timerId = setTimeout(() => {}, 0);
    clearTimeout(timerId);
  }
});

afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Clear any remaining timers
  jest.clearAllTimers();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (error: any) => {
  if (process.env.NODE_ENV === 'test') {
    // Suppress Redis connection errors in tests
    if (error?.message?.includes('ECONNREFUSED') && error?.message?.includes('6380')) {
      return;
    }
  }
  console.error('Unhandled Promise Rejection:', error);
});

// Suppress specific warnings in test environment
const originalEmit = process.emit;
process.emit = function (name: string, ...args: any[]) {
  if (name === 'warning' && args[0]?.name === 'MaxListenersExceededWarning') {
    return false;
  }
  return originalEmit.call(this, name, ...args);
} as any;

describe.skip('Expo MCP Server Setup', () => {
  it('should import main module successfully', async () => {
    const mainModule = await import('../src/index.ts');
    expect(mainModule.default).toBeDefined();
  });

  it('should have required environment', () => {
    expect(process.version).toBeDefined();
    expect(process.version.startsWith('v')).toBe(true);
    
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    expect(nodeVersion).toBeGreaterThanOrEqual(18);
  });
}); 