import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigManager } from '../src/utils/config';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Utility Functions Unit Tests', () => {
  const testConfigDir = join(process.cwd(), 'test-utils-config');
  const originalEnv = process.env;
  const originalArgv = process.argv;
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Create test config directory
    if (!existsSync(testConfigDir)) {
      mkdirSync(testConfigDir, { recursive: true });
    }

    // Reset environment
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true, force: true });
    }

    // Restore environment
    process.env = originalEnv;
    process.argv = originalArgv;
    process.chdir(originalCwd);
  });

  describe('ConfigManager Static Methods', () => {
    test('should parse CLI options with all flags', () => {
      process.argv = [
        'node',
        'expo-mcp-server',
        '--stdio',
        '--port', '4000',
        '--cache-size', '512',
        '--debug',
        '--config', './custom-config.json',
        '--help',
        '--version'
      ];

      const options = ConfigManager.parseCLIOptions();

      expect(options).toEqual({
        stdio: true,
        port: 4000,
        'cache-size': 512,
        debug: true,
        config: './custom-config.json',
        help: true,
        version: true
      });
    });

    test('should parse CLI options with short flags', () => {
      process.argv = ['node', 'expo-mcp-server', '-h', '-v'];
      const options = ConfigManager.parseCLIOptions();

      expect(options.help).toBe(true);
      expect(options.version).toBe(true);
    });

    test('should parse CLI options with mixed flags', () => {
      process.argv = [
        'node',
        'expo-mcp-server',
        '--stdio',
        '-h',
        '--port', '3001'
      ];

      const options = ConfigManager.parseCLIOptions();

      expect(options).toEqual({
        stdio: true,
        help: true,
        port: 3001
      });
    });

    test('should handle empty CLI options', () => {
      process.argv = ['node', 'expo-mcp-server'];
      const options = ConfigManager.parseCLIOptions();

      expect(options).toEqual({});
    });

    test('should display help information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ConfigManager.displayHelp();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expo MCP Server')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--stdio')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--port')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('--debug')
      );
      
      consoleSpy.mockRestore();
    });

    test('should display version information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      ConfigManager.displayVersion();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expo MCP Server')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Node.js')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('ConfigManager Instance Methods', () => {
    test('should load default configuration when no specific config exists', () => {
      // Create a default config
      const defaultConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { local: { path: './data', max_size_gb: 10 } },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { level: 'info', format: 'json' },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: true }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig, null, 2)
      );

      process.chdir(testConfigDir);
      process.env.NODE_ENV = 'production';

      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.server.name).toBe('test-server');
      expect(config.mcp.default_transport).toBe('stdio');
      expect(config.cache.memory.max_size_mb).toBe(200);
    });

    test('should override default config with environment-specific config', () => {
      // Create default config
      const defaultConfig = {
        server: { name: 'default-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { local: { path: './data', max_size_gb: 10 } },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { level: 'info', format: 'json' },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: true }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      // Create development-specific config
      const devConfig = {
        server: { name: 'dev-server' },
        logging: { level: 'debug' },
        cache: {
          memory: { max_size_mb: 100 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(defaultConfig, null, 2)
      );
      writeFileSync(
        join(testConfigDir, 'config', 'development.json'),
        JSON.stringify(devConfig, null, 2)
      );

      process.chdir(testConfigDir);
      process.env.NODE_ENV = 'development';

      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.server.name).toBe('dev-server');
      expect(config.mcp.default_transport).toBe('stdio');
      expect(config.logging.level).toBe('debug');
      expect(config.cache.memory.max_size_mb).toBe(100);
    });

    test('should override config with environment variables', () => {
      // Create base config
      const baseConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { local: { path: './data', max_size_gb: 10 } },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { level: 'info', format: 'json' },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: true }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(baseConfig, null, 2)
      );

      // Set environment variables
      process.env.MCP_MODE = 'http';
      process.env.MCP_PORT = '4000';
      process.env.MEMORY_CACHE_SIZE_MB = '512';
      process.env.LOG_LEVEL = 'debug';

      process.chdir(testConfigDir);

      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.mcp.default_transport).toBe('http');
      expect(config.mcp.http.port).toBe(4000);
      expect(config.cache.memory.max_size_mb).toBe(512);
      expect(config.logging.level).toBe('debug');
    });

    test('should handle boolean environment variables correctly', () => {
      const baseConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { local: { path: './data', max_size_gb: 10 } },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { 
          level: 'info', 
          format: 'json',
          log_requests: false, 
          log_responses: false 
        },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: false }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(baseConfig, null, 2)
      );

      process.env.LOG_REQUESTS = 'true';
      process.env.LOG_RESPONSES = 'false';
      process.env.MONITORING_ENABLED = 'true';

      process.chdir(testConfigDir);

      const configManager = new ConfigManager();
      const config = configManager.getConfig();

      expect(config.logging.log_requests).toBe(true);
      expect(config.logging.log_responses).toBe(false);
      expect(config.performance.monitoring.enabled).toBe(true);
    });

    test('should apply CLI options correctly', () => {
      const baseConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { local: { path: './data', max_size_gb: 10 } },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { level: 'info', format: 'json' },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: true }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(baseConfig, null, 2)
      );

      process.chdir(testConfigDir);

      const configManager = new ConfigManager();
      
      // Test CLI options
      configManager.applyCLIOptions({
        stdio: true,
        port: 4500,
        'cache-size': 1024,
        debug: true
      });

      const config = configManager.getConfig();

      expect(config.mcp.default_transport).toBe('stdio');
      expect(config.mcp.http.port).toBe(4500);
      expect(config.cache.memory.max_size_mb).toBe(1024);
      expect(config.logging.level).toBe('debug');
      expect(config.logging.log_requests).toBe(true);
      expect(config.logging.log_responses).toBe(true);
    });

    test('should validate correct configuration', () => {
      const validConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: {
          protocol_version: '2024-11-05',
          default_transport: 'stdio',
          stdio: { encoding: 'utf-8', timeout_ms: 5000 },
          http: { port: 3000, host: '0.0.0.0' }
        },
        storage: { 
          local: { 
            path: './data', 
            max_size_gb: 10,
            backup: { enabled: true, rotation_days: 7, max_files: 10 }
          }
        },
        cache: {
          memory: { max_size_mb: 200, ttl_seconds: 300 },
          redis: { url: 'redis://localhost:6379', ttl_seconds: 3600 },
          disk: { path: './cache', ttl_days: 7 }
        },
        security: {
          input_validation: { max_tool_args_size_bytes: 2048 },
          access_control: { rate_limit_per_session: 2000 },
          tool_execution: { sandboxing_enabled: true }
        },
        logging: { level: 'info', format: 'json' },
        external_services: {
          expo: { api_base: 'https://api.expo.dev' },
          typesense: { url: 'http://localhost:8108' },
          github: { base_url: 'https://api.github.com' }
        },
        performance: {
          targets: { concurrent_sessions: 200 },
          monitoring: { enabled: true }
        },
        features: {
          tools: {},
          search: { typo_tolerance: true },
          recommendations: { max_results: 10 }
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(validConfig, null, 2)
      );

      process.chdir(testConfigDir);

      const configManager = new ConfigManager();
      const validation = configManager.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    test('should detect invalid configuration', () => {
      const invalidConfig = {
        server: { name: 'test-server' }, // missing version
        mcp: {
          protocol_version: '2024-11-05',
          default_transport: 'invalid_transport', // invalid value
          stdio: { encoding: 'utf-8', timeout_ms: 'invalid' }, // invalid type
          http: { port: 'invalid_port', host: '0.0.0.0' } // invalid type
        }
      };

      mkdirSync(join(testConfigDir, 'config'), { recursive: true });
      writeFileSync(
        join(testConfigDir, 'config', 'default.json'),
        JSON.stringify(invalidConfig, null, 2)
      );

      process.chdir(testConfigDir);

      const configManager = new ConfigManager();
      const validation = configManager.validateConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('ConfigManager Error Handling', () => {
    test('should throw error when no configuration file is found', () => {
      process.chdir(testConfigDir);

      expect(() => {
        new ConfigManager();
      }).toThrow('No configuration file found');
    });

    test('should throw error for malformed JSON configuration', () => {
      writeFileSync(
        join(testConfigDir, 'mcp-config.json'),
        '{ invalid json }'
      );

      process.chdir(testConfigDir);

      expect(() => {
        new ConfigManager();
      }).toThrow('Failed to parse configuration file');
    });

    test('should handle missing config directory gracefully', () => {
      // Create only mcp-config.json without config directory
      const validConfig = {
        server: { name: 'test-server', version: '1.0.0' },
        mcp: { 
          protocol_version: '2024-11-05',
          default_transport: 'stdio' 
        }
      };

      writeFileSync(
        join(testConfigDir, 'mcp-config.json'),
        JSON.stringify(validConfig, null, 2)
      );

      process.chdir(testConfigDir);

      expect(() => {
        const configManager = new ConfigManager();
        configManager.getConfig();
      }).not.toThrow();
    });
  });
}); 