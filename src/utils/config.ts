import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { z } from 'zod';

// =============================================================================
// Configuration Schema Validation
// =============================================================================

const ServerConfigSchema = z.object({
  name: z.string().default('expo-mcp-server'),
  version: z.string().default('1.0.0'),
  description: z.string().default('Expo MCP Server'),
});

const MCPConfigSchema = z.object({
  protocol_version: z.string().default('2024-11-05'),
  default_transport: z.enum(['stdio', 'http']).default('stdio'),
  stdio: z.object({
    encoding: z.string().default('utf-8'),
    timeout_ms: z.number().default(5000),
    max_message_size_bytes: z.number().default(1048576),
    line_delimited: z.boolean().default(true),
  }),
  http: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
    cors_enabled: z.boolean().default(true),
    cors_origins: z.array(z.string()).default(['*']),
    timeout_ms: z.number().default(30000),
    websocket_upgrade: z.boolean().default(true),
    max_connections: z.number().default(200),
  }),
});

const StorageConfigSchema = z.object({
  local: z.object({
    path: z.string().default('./data'),
    max_size_gb: z.number().default(10),
    compression: z.boolean().default(true),
    backup: z.object({
      enabled: z.boolean().default(true),
      rotation_days: z.number().default(7),
      max_files: z.number().default(10),
    }),
  }),
});

const CacheConfigSchema = z.object({
  memory: z.object({
    max_size_mb: z.number().default(200),
    ttl_seconds: z.number().default(300),
    eviction_policy: z.string().default('LRU'),
  }),
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    max_size_mb: z.number().default(1000),
    ttl_seconds: z.number().default(3600),
    key_prefix: z.string().default('expo-mcp:'),
    cluster_support: z.boolean().default(false),
  }),
  disk: z.object({
    path: z.string().default('./cache'),
    max_size_gb: z.number().default(20),
    ttl_days: z.number().default(7),
    compression: z.boolean().default(true),
  }),
});

const SecurityConfigSchema = z.object({
  input_validation: z.object({
    max_tool_args_size_bytes: z.number().default(2048),
    max_resource_uri_length: z.number().default(512),
    sanitize_file_paths: z.boolean().default(true),
    validate_json_schema: z.boolean().default(true),
    prevent_code_injection: z.boolean().default(true),
    allowed_file_extensions: z.array(z.string()).default(['.md', '.json', '.txt', '.js', '.ts']),
  }),
  access_control: z.object({
    allowed_hosts: z.array(z.string()).default([
      'docs.expo.dev',
      'api.expo.dev',
      'snack.expo.dev',
      'github.com',
      'raw.githubusercontent.com',
      'npm.expo.dev',
    ]),
    rate_limit_per_session: z.number().default(2000),
    session_timeout_minutes: z.number().default(60),
    require_authentication: z.boolean().default(false),
  }),
  tool_execution: z.object({
    sandboxing_enabled: z.boolean().default(true),
    blocked_system_calls: z.array(z.string()).default(['exec', 'spawn', 'eval', 'require']),
    resource_limits: z.object({
      max_memory_mb: z.number().default(256),
      max_cpu_time_ms: z.number().default(5000),
      max_file_reads: z.number().default(100),
      max_network_requests: z.number().default(50),
    }),
  }),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text']).default('json'),
  timestamp: z.boolean().default(true),
  outputs: z.array(z.enum(['console', 'file'])).default(['console']),
  file: z.object({
    enabled: z.boolean().default(false),
    path: z.string().default('./logs/expo-mcp-server.log'),
    max_size_mb: z.number().default(100),
    max_files: z.number().default(10),
    max_age_days: z.number().default(30),
    compress: z.boolean().default(true),
  }),
  include_mcp_events: z.boolean().default(true),
  sensitive_data_masking: z.boolean().default(true),
  log_requests: z.boolean().default(false),
  log_responses: z.boolean().default(false),
});

const ConfigSchema = z.object({
  server: ServerConfigSchema,
  mcp: MCPConfigSchema,
  storage: StorageConfigSchema,
  cache: CacheConfigSchema,
  security: SecurityConfigSchema,
  logging: LoggingConfigSchema,
  external_services: z.object({
    expo: z.object({
      api_base: z.string().default('https://api.expo.dev'),
      docs_base: z.string().default('https://docs.expo.dev'),
      snack_base: z.string().default('https://snack.expo.dev'),
      timeout_ms: z.number().default(10000),
      retry_attempts: z.number().default(3),
      rate_limit: z.object({
        requests_per_minute: z.number().default(100),
        burst: z.number().default(20),
      }),
    }),
    typesense: z.object({
      url: z.string().default('http://localhost:8108'),
      api_key: z.string().default('xyz'),
      timeout_ms: z.number().default(5000),
      collection_name: z.string().default('expo_docs'),
    }),
    github: z.object({
      base_url: z.string().default('https://api.github.com'),
      timeout_ms: z.number().default(10000),
      rate_limit: z.object({
        requests_per_hour: z.number().default(1000),
      }),
    }),
  }),
  performance: z.object({
    targets: z.object({
      p95_stdio_latency_ms: z.number().default(50),
      p95_search_latency_ms: z.number().default(100),
      p95_sdk_lookup_ms: z.number().default(80),
      cache_hit_target_percent: z.number().default(85),
      concurrent_sessions: z.number().default(200),
    }),
    monitoring: z.object({
      enabled: z.boolean().default(true),
      metrics_port: z.number().default(9090),
      health_check_interval_ms: z.number().default(30000),
    }),
  }),
  features: z.object({
    tools: z.record(z.object({
      enabled: z.boolean().default(true),
      timeout_ms: z.number().default(5000),
    })),
    search: z.object({
      typo_tolerance: z.boolean().default(true),
      synonyms_enabled: z.boolean().default(true),
      faceted_search: z.boolean().default(true),
      code_boost_factor: z.number().default(2.5),
      api_boost_factor: z.number().default(3.0),
    }),
    recommendations: z.object({
      embeddings_model: z.string().default('all-MiniLM-L6-v2'),
      similarity_threshold: z.number().default(0.75),
      max_results: z.number().default(10),
      context_window: z.number().default(1000),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

// =============================================================================
// CLI Options Interface
// =============================================================================

export interface CLIOptions {
  stdio?: boolean;
  port?: number;
  'cache-size'?: number;
  debug?: boolean;
  config?: string;
  help?: boolean;
  version?: boolean;
}

// =============================================================================
// Configuration Manager Class
// =============================================================================

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor() {
    this.configPath = this.resolveConfigPath();
    this.config = this.loadConfiguration();
  }

  /**
   * Parse CLI options from process.argv
   */
  public static parseCLIOptions(): CLIOptions {
    const args = process.argv.slice(2);
    const options: CLIOptions = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--stdio':
          options.stdio = true;
          break;
        case '--port':
          options.port = parseInt(args[++i], 10);
          break;
        case '--cache-size':
          options['cache-size'] = parseInt(args[++i], 10);
          break;
        case '--debug':
          options.debug = true;
          break;
        case '--config':
          options.config = args[++i];
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
        case '--version':
        case '-v':
          options.version = true;
          break;
      }
    }

    return options;
  }

  /**
   * Display CLI help information
   */
  public static displayHelp(): void {
    console.log(`
Expo MCP Server - Model Context Protocol server for Expo ecosystem

USAGE:
  expo-mcp-server [OPTIONS]

OPTIONS:
  --stdio                Force stdio mode (default for MCP)
  --port <number>        Override HTTP port (stdio mode ignores this)
  --cache-size <number>  Memory cache size in MB (default: 200)
  --debug                Enable debug logging
  --config <path>        Custom config file path
  --help, -h             Show this help message
  --version, -v          Show version information

EXAMPLES:
  expo-mcp-server --stdio                    # MCP stdio mode (default)
  expo-mcp-server --port 3000               # HTTP mode on port 3000
  expo-mcp-server --debug --cache-size 512  # Debug mode with 512MB cache
  expo-mcp-server --config ./my-config.json # Custom configuration

ENVIRONMENT VARIABLES:
  NODE_ENV               Environment (development|production|test)
  MCP_MODE              Transport mode (stdio|http|both)
  LOG_LEVEL             Logging level (debug|info|warn|error)
  
For full documentation, visit: https://github.com/expo/mcp-server
`);
  }

  /**
   * Display version information
   */
  public static displayVersion(): void {
    const packageJson = this.loadPackageJson();
    console.log(`Expo MCP Server v${packageJson.version}`);
    console.log(`Node.js ${process.version}`);
    console.log(`Platform: ${process.platform}`);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Config {
    return this.config;
  }

  /**
   * Apply CLI options to configuration
   */
  public applyCLIOptions(options: CLIOptions): void {
    if (options.stdio) {
      this.config.mcp.default_transport = 'stdio';
    }

    if (options.port) {
      this.config.mcp.http.port = options.port;
      if (!options.stdio) {
        this.config.mcp.default_transport = 'http';
      }
    }

    if (options['cache-size']) {
      this.config.cache.memory.max_size_mb = options['cache-size'];
    }

    if (options.debug) {
      this.config.logging.level = 'debug';
      this.config.logging.log_requests = true;
      this.config.logging.log_responses = true;
    }

    if (options.config) {
      this.configPath = resolve(options.config);
      this.config = this.loadConfiguration();
    }
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { valid: boolean; errors?: string[] } {
    try {
      ConfigSchema.parse(this.config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { valid: false, errors };
      }
      return { valid: false, errors: [error instanceof Error ? error.message : 'Unknown validation error'] };
    }
  }

  /**
   * Resolve configuration file path based on environment and CLI options
   */
  private resolveConfigPath(): string {
    const env = process.env.NODE_ENV || 'development';
    const basePath = process.cwd();
    
    // Priority order for config file resolution:
    // 1. Explicit config from CLI (handled in applyCLIOptions)
    // 2. Environment-specific config
    // 3. Default config
    const configPaths = [
      join(basePath, `config/${env}.json`),
      join(basePath, 'config/default.json'),
      join(basePath, 'mcp-config.json'),
    ];

    for (const path of configPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new Error(`No configuration file found. Searched paths: ${configPaths.join(', ')}`);
  }

  /**
   * Load and merge configuration from file and environment variables
   */
  private loadConfiguration(): Config {
    // Load base configuration from file
    let fileConfig = {};
    
    if (existsSync(this.configPath)) {
      try {
        const configContent = readFileSync(this.configPath, 'utf-8');
        fileConfig = JSON.parse(configContent);
      } catch (error) {
        throw new Error(`Failed to parse configuration file ${this.configPath}: ${error}`);
      }
    }

    // Load default configuration
    const defaultConfigPath = join(process.cwd(), 'config/default.json');
    let defaultConfig = {};
    
    if (existsSync(defaultConfigPath)) {
      try {
        const defaultContent = readFileSync(defaultConfigPath, 'utf-8');
        defaultConfig = JSON.parse(defaultContent);
      } catch (error) {
        console.warn(`Failed to load default configuration: ${error}`);
      }
    }

    // Merge configurations: default < file < environment variables
    const mergedConfig = this.deepMerge(defaultConfig, fileConfig);
    const envConfig = this.loadEnvironmentVariables();
    const finalConfig = this.deepMerge(mergedConfig, envConfig);

    // Validate and return configuration
    try {
      return ConfigSchema.parse(finalConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Configuration validation errors:');
        error.errors.forEach(err => {
          console.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      }
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentVariables(): Partial<Config> {
    const env = process.env;
    
    // Helper function to filter out undefined values
    const cleanObject = (obj: any): any => {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const cleanedNested = cleanObject(value);
            if (Object.keys(cleanedNested).length > 0) {
              cleaned[key] = cleanedNested;
            }
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    };
    
    const envConfig = {
      mcp: {
        default_transport: env.MCP_MODE as 'stdio' | 'http' || undefined,
        stdio: {
          timeout_ms: env.MCP_STDIO_TIMEOUT_MS ? parseInt(env.MCP_STDIO_TIMEOUT_MS, 10) : undefined,
        },
        http: {
          port: env.MCP_PORT ? parseInt(env.MCP_PORT, 10) : undefined,
          host: env.MCP_HOST,
        },
      },
      storage: {
        local: {
          path: env.LOCAL_STORAGE_PATH,
          max_size_gb: env.MAX_STORAGE_SIZE_GB ? parseInt(env.MAX_STORAGE_SIZE_GB, 10) : undefined,
        },
      },
      cache: {
        memory: {
          max_size_mb: env.MEMORY_CACHE_SIZE_MB ? parseInt(env.MEMORY_CACHE_SIZE_MB, 10) : undefined,
          ttl_seconds: env.CACHE_TTL_SECONDS ? parseInt(env.CACHE_TTL_SECONDS, 10) : undefined,
        },
        redis: {
          url: env.REDIS_URL,
        },
      },
      external_services: {
        expo: {
          api_base: env.EXPO_API_BASE,
          docs_base: env.EXPO_DOCS_BASE,
          snack_base: env.EXPO_SNACK_BASE,
          rate_limit: {
            requests_per_minute: env.RATE_LIMIT_RPM ? parseInt(env.RATE_LIMIT_RPM, 10) : undefined,
          },
        },
        typesense: {
          url: env.TYPESENSE_URL,
          api_key: env.TYPESENSE_API_KEY,
        },
        github: {
          base_url: env.GITHUB_BASE_URL,
        },
      },
      logging: {
        level: env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined,
        file: {
          path: env.LOG_FILE_PATH,
          max_size_mb: env.LOG_MAX_SIZE_MB ? parseInt(env.LOG_MAX_SIZE_MB, 10) : undefined,
          max_files: env.LOG_MAX_FILES ? parseInt(env.LOG_MAX_FILES, 10) : undefined,
          max_age_days: env.LOG_MAX_AGE_DAYS ? parseInt(env.LOG_MAX_AGE_DAYS, 10) : undefined,
        },
        log_requests: env.LOG_REQUESTS === 'true' ? true : env.LOG_REQUESTS === 'false' ? false : undefined,
        log_responses: env.LOG_RESPONSES === 'true' ? true : env.LOG_RESPONSES === 'false' ? false : undefined,
      },
      security: {
        access_control: {
          rate_limit_per_session: env.RATE_LIMIT_PER_SESSION ? parseInt(env.RATE_LIMIT_PER_SESSION, 10) : undefined,
          session_timeout_minutes: env.SESSION_TIMEOUT_MINUTES ? parseInt(env.SESSION_TIMEOUT_MINUTES, 10) : undefined,
        },
      },
      performance: {
        targets: {
          concurrent_sessions: env.MAX_CONCURRENT_SESSIONS ? parseInt(env.MAX_CONCURRENT_SESSIONS, 10) : undefined,
        },
        monitoring: {
          enabled: env.MONITORING_ENABLED === 'true' ? true : env.MONITORING_ENABLED === 'false' ? false : undefined,
          metrics_port: env.METRICS_PORT ? parseInt(env.METRICS_PORT, 10) : undefined,
          health_check_interval_ms: env.HEALTH_CHECK_INTERVAL_MS ? parseInt(env.HEALTH_CHECK_INTERVAL_MS, 10) : undefined,
        },
      },
    };

    return cleanObject(envConfig);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Load package.json for version information
   */
  private static loadPackageJson(): { version: string } {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageContent = readFileSync(packagePath, 'utf-8');
      return JSON.parse(packageContent);
    } catch {
      return { version: '1.0.0' };
    }
  }
} 