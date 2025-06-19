import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
  InitializeResult,
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import { HttpTransport } from './http-transport.js';
import { ExpoTools, TOOL_SCHEMAS } from './tools.js';
import { ExpoResources, RESOURCE_SCHEMAS } from './resources.js';
import { ExpoPrompts, PROMPT_SCHEMAS } from './prompts.js';
import { ExpoMCPSecurity, IntegratedSecurityConfig } from '../security/index';
import { PerformanceMonitor } from '../services/performance-monitor.js';

/**
 * Expo MCP Server
 * MCP Protocol 2024-11-05準拠の基本実装
 */
export class ExpoMcpServer extends EventEmitter {
  private server: Server;
  private transport: StdioServerTransport | null = null;
  private httpTransport: HttpTransport | null = null;
  private performanceMonitor: PerformanceMonitor;
  private isConnected = false;
  private sessionId: string;
  private config: any;
  private signalHandlersRegistered = false;
  private security: ExpoMCPSecurity | null = null;

  constructor(config: any) {
    super();
    this.config = config;
    this.sessionId = this.generateSessionId();
    
    // パフォーマンス監視初期化
    this.performanceMonitor = new PerformanceMonitor(config);
    
    // セキュリティ機能初期化
    if (config.security) {
      this.initializeSecurity(config);
    }
    
    // MCP Server インスタンス作成
    this.server = new Server(
      {
        name: config.name || 'expo-mcp-server',
        version: config.version || '1.0.0',
      },
      {
        capabilities: this.getServerCapabilities(),
      }
    );

    this.setupMessageHandlers();
  }

  /**
   * セッションID生成
   */
  private generateSessionId(): string {
    return `expo-mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * セキュリティ機能初期化
   */
  private initializeSecurity(config: any): void {
    const securityConfig: IntegratedSecurityConfig = {
      security: config.security,
      rateLimit: {
        requests_per_hour: config.security.access_control.rate_limit_per_session || 2000,
        session_timeout_minutes: config.security.access_control.session_timeout_minutes || 60,
        max_concurrent_sessions: 200,
        ip_whitelist: [],
        ip_blacklist: [],
        enable_ip_blocking: true,
      },
      permissions: {
        roles: {
          anonymous: {
            permissions: ['tool:execute', 'resource:read', 'prompt:get'],
            description: 'Default anonymous user permissions',
          },
          authenticated: {
            permissions: ['*'],
            description: 'Full access for authenticated users',
          },
        },
        default_role: 'anonymous',
        require_authentication: config.security.access_control.require_authentication || false,
      },
      logging: {
        logViolations: true,
        logLevel: 'warn',
      },
    };

    this.security = new ExpoMCPSecurity(securityConfig);

    // セキュリティイベントハンドリング
    this.security.on('security:violation', (violation) => {
      this.emit('security:violation', violation);
    });

    this.security.on('security:critical', (violation) => {
      this.emit('security:critical', violation);
      console.error('[MCP Security] CRITICAL:', violation);
    });

    this.security.on('rate_limit:exceeded', (data) => {
      this.emit('rate_limit:exceeded', data);
    });
  }

  /**
   * サーバー capabilities 定義
   */
  private getServerCapabilities(): ServerCapabilities {
    return {
      tools: {
        listChanged: true,
      },
      resources: {
        subscribe: true,
        listChanged: true,
      },
      prompts: {
        listChanged: true,
      },
      logging: {},
    };
  }

  /**
   * MCP メッセージハンドラーのセットアップ
   */
  private setupMessageHandlers(): void {
    // Initialize ハンドラー
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.log(`[Session: ${this.sessionId}] Initialize request received:`, request.params);
      
      const result: InitializeResult = {
        protocolVersion: '2024-11-05',
        capabilities: this.getServerCapabilities(),
        serverInfo: {
          name: this.config.name || 'expo-mcp-server',
          version: this.config.version || '1.0.0',
        },
      };

      this.emit('session:initialized', { sessionId: this.sessionId, clientInfo: request.params });
      return result;
    });

    // Tools list ハンドラー
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log(`[Session: ${this.sessionId}] List tools request`);
      return {
        tools: this.getAvailableTools(),
      };
    });

    // Resources list ハンドラー
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      console.log(`[Session: ${this.sessionId}] List resources request`);
      return {
        resources: this.getAvailableResources(),
      };
    });

    // Prompts list ハンドラー
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      console.log(`[Session: ${this.sessionId}] List prompts request`);
      return {
        prompts: this.getAvailablePrompts(),
      };
    });

    // Tool call ハンドラー（セキュリティチェック統合）
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log(`[Session: ${this.sessionId}] Tool call:`, request.params.name);
      
      // セキュリティチェック
      if (this.security) {
        const securityResult = await this.security.validateToolCall(
          this.sessionId,
          request.params.name,
          request.params.arguments
        );
        
        if (!securityResult.allowed) {
          throw new Error(`Security violation: ${securityResult.violations.join(', ')}`);
        }
      }
      
      // Phase 3で具体的なツール実装
      return this.executeToolPlaceholder(request.params.name, request.params.arguments);
    });

    // Resource read ハンドラー（セキュリティチェック統合）
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      console.log(`[Session: ${this.sessionId}] Resource read:`, request.params.uri);
      
      // セキュリティチェック
      if (this.security) {
        const securityResult = await this.security.validateResourceRead(
          this.sessionId,
          request.params.uri
        );
        
        if (!securityResult.allowed) {
          throw new Error(`Security violation: ${securityResult.violations.join(', ')}`);
        }
      }
      
      // Phase 3で具体的なリソース実装
      return this.readResourcePlaceholder(request.params.uri);
    });

    // Prompt get ハンドラー（セキュリティチェック統合）
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      console.log(`[Session: ${this.sessionId}] Prompt get:`, request.params.name);
      
      // セキュリティチェック
      if (this.security) {
        const securityResult = await this.security.validatePromptGet(
          this.sessionId,
          request.params.name,
          request.params.arguments
        );
        
        if (!securityResult.allowed) {
          throw new Error(`Security violation: ${securityResult.violations.join(', ')}`);
        }
      }
      
      // Phase 3で具体的なプロンプト実装
      return this.getPromptPlaceholder(request.params.name, request.params.arguments);
    });

    // エラーハンドリング
    this.server.onerror = (error) => {
      console.error(`[Session: ${this.sessionId}] MCP Server error:`, error);
      this.emit('error', error);
    };
  }

  /**
   * 利用可能なツール一覧を返す
   */
  private getAvailableTools(): Tool[] {
    return Object.values(TOOL_SCHEMAS).map(schema => ({
      name: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    }));
  }

  /**
   * 利用可能なリソース一覧を返す
   */
  private getAvailableResources(): Resource[] {
    return RESOURCE_SCHEMAS.map(schema => ({
      uri: schema.uri,
      name: schema.name,
      description: schema.description,
      mimeType: schema.mimeType,
    }));
  }

  /**
   * 利用可能なプロンプト一覧を返す
   */
  private getAvailablePrompts(): Prompt[] {
    return PROMPT_SCHEMAS.map(schema => ({
      name: schema.name,
      description: schema.description,
      arguments: schema.arguments.map(arg => ({
        name: arg.name,
        description: arg.description,
        required: arg.required,
      })),
    }));
  }

  /**
   * ツール入力スキーマを取得（Phase 3で詳細実装）
   */
  private getToolInputSchema(toolName: string): any {
    // 基本的なスキーマプレースホルダー
    const schemas: Record<string, any> = {
      expo_read_document: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          doc_type: { type: 'string', enum: ['guide', 'api', 'tutorial', 'reference'] },
        },
        required: ['url'],
      },
      expo_search_documents: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: 500 },
          filters: { type: 'object' },
        },
        required: ['query'],
      },
    };

    return schemas[toolName] || {
      type: 'object',
      properties: {},
    };
  }

  /**
   * ツール実行
   */
  private async executeToolPlaceholder(toolName: string, args: any): Promise<any> {
    console.log(`[Session: ${this.sessionId}] Executing tool: ${toolName} with args:`, args);
    
    try {
      // 対応するツールメソッドを呼び出し
      const result = await (ExpoTools as any)[toolName](args);
      return result;
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Tool execution error:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * リソース読み取り
   */
  private async readResourcePlaceholder(uri: string): Promise<any> {
    console.log(`[Session: ${this.sessionId}] Reading resource: ${uri}`);
    
    try {
      const result = await ExpoResources.resolveResource(uri);
      return {
        contents: [result],
      };
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Resource read error:`, error);
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Resource read failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  /**
   * プロンプト取得
   */
  private async getPromptPlaceholder(name: string, args: any): Promise<any> {
    console.log(`[Session: ${this.sessionId}] Getting prompt: ${name} with args:`, args);
    
    try {
      const result = await ExpoPrompts.getPrompt(name, args);
      return result;
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Prompt get error:`, error);
      return {
        description: `Prompt "${name}" execution failed`,
        messages: [
          {
            role: 'system',
            content: {
              type: 'text',
              text: `Prompt execution failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          },
        ],
      };
    }
  }

  /**
   * Stdio transport でサーバー開始
   */
  async startStdio(): Promise<void> {
    try {
      this.transport = new StdioServerTransport();
      
      console.log(`[Session: ${this.sessionId}] Starting MCP Server with stdio transport...`);
      
      await this.server.connect(this.transport);
      this.isConnected = true;
      
      console.log(`[Session: ${this.sessionId}] MCP Server connected successfully via stdio`);
      this.emit('server:connected', { sessionId: this.sessionId, transport: 'stdio' });
      
      // プロセス終了時のクリーンアップ
      this.registerSignalHandlers();
      
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Failed to start MCP Server:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * HTTP + SSE transport でサーバー開始
   */
  async startHttp(port: number = 3000): Promise<void> {
    try {
      this.httpTransport = new HttpTransport(port, this.config, this.performanceMonitor);
      
      console.log(`[Session: ${this.sessionId}] Starting MCP Server with HTTP + SSE transport...`);
      console.log(`[Session: ${this.sessionId}] Port: ${port}`);
      
      // HTTP transportのメッセージを処理
      this.httpTransport.on('message', async (message: any, callback: (error: any, response: any) => void) => {
        try {
          const response = await this.processHttpMessage(message);
          callback(null, response);
        } catch (error) {
          callback(error, null);
        }
      });

      await this.httpTransport.start();
      this.isConnected = true;
      
      console.log(`[Session: ${this.sessionId}] MCP Server HTTP transport started successfully`);
      this.emit('server:connected', { sessionId: this.sessionId, transport: 'http+sse', port });
      
      // プロセス終了時のクリーンアップ
      this.registerSignalHandlers();
      
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Failed to start MCP Server HTTP transport:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * HTTPメッセージを処理
   */
  private async processHttpMessage(message: any): Promise<any> {
    console.log(`[Session: ${this.sessionId}] Processing HTTP message: ${message.method}`);
    
    try {
      // 基本的なJSON-RPC応答を返す
      if (message.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: this.getServerCapabilities(),
            serverInfo: {
              name: this.config.name || 'expo-mcp-server',
              version: this.config.version || '1.0.0',
            },
          },
        };
      } else if (message.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: this.getAvailableTools(),
          },
        };
      } else if (message.method === 'resources/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            resources: this.getAvailableResources(),
          },
        };
      } else if (message.method === 'prompts/list') {
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            prompts: this.getAvailablePrompts(),
          },
        };
      } else if (message.method === 'tools/call') {
        const result = await this.executeToolPlaceholder(
          message.params?.name || 'unknown',
          message.params?.arguments || {}
        );
        return {
          jsonrpc: '2.0',
          id: message.id,
          result,
        };
      } else {
        // 未実装のメソッド
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method '${message.method}' is not implemented yet`,
          },
        };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Ping/Pong サポート（接続チェック）
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }
      
      // MCP Protocol では ping/pong は通常のリクエスト/レスポンスで実装
      console.log(`[Session: ${this.sessionId}] Ping check - Server is responsive`);
      return true;
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Ping failed:`, error);
      return false;
    }
  }

  /**
   * セッション状態取得
   */
  getSessionInfo(): any {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      startTime: new Date(),
      transport: this.transport ? 'stdio' : null,
    };
  }

  /**
   * グレースフルシャットダウン
   */
  async gracefulShutdown(signal?: string): Promise<void> {
    console.log(`[Session: ${this.sessionId}] Graceful shutdown initiated${signal ? ` (${signal})` : ''}`);
    
    try {
      this.isConnected = false;
      
      // シグナルハンドラーを削除
      this.unregisterSignalHandlers();
      
      // HTTP transport停止
      if (this.httpTransport) {
        await this.httpTransport.stop();
        console.log(`[Session: ${this.sessionId}] HTTP Transport stopped`);
      }
      
      // MCP Server停止
      if (this.server) {
        await this.server.close();
        console.log(`[Session: ${this.sessionId}] MCP Server closed`);
      }
      
      this.emit('server:disconnected', { sessionId: this.sessionId, signal });
      
      console.log(`[Session: ${this.sessionId}] Shutdown completed`);
      process.exit(0);
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Error during shutdown:`, error);
      process.exit(1);
    }
  }

  /**
   * 再接続処理
   */
  async reconnect(): Promise<void> {
    console.log(`[Session: ${this.sessionId}] Attempting to reconnect...`);
    
    try {
      if (this.isConnected) {
        await this.gracefulShutdown();
      }
      
      // 新しいセッションIDで再開
      this.sessionId = this.generateSessionId();
      await this.startStdio();
      
      console.log(`[Session: ${this.sessionId}] Reconnection successful`);
      this.emit('server:reconnected', { sessionId: this.sessionId });
    } catch (error) {
      console.error(`[Session: ${this.sessionId}] Reconnection failed:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * シグナルハンドラー: SIGINT処理
   */
  private handleSigint = () => {
    this.gracefulShutdown('SIGINT');
  };

  /**
   * シグナルハンドラー: SIGTERM処理
   */
  private handleSigterm = () => {
    this.gracefulShutdown('SIGTERM');
  };

  /**
   * プロセスシグナルハンドラーを登録
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      // 既存ハンドラーを削除
      this.unregisterSignalHandlers();
    }

    process.on('SIGINT', this.handleSigint);
    process.on('SIGTERM', this.handleSigterm);
    this.signalHandlersRegistered = true;
    
    console.log(`[Session: ${this.sessionId}] Process signal handlers registered`);
  }

  /**
   * プロセスシグナルハンドラーを削除
   */
  private unregisterSignalHandlers(): void {
    if (this.signalHandlersRegistered) {
      process.removeListener('SIGINT', this.handleSigint);
      process.removeListener('SIGTERM', this.handleSigterm);
      this.signalHandlersRegistered = false;
      
      console.log(`[Session: ${this.sessionId}] Process signal handlers unregistered`);
    }
  }
} 