import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventEmitter } from 'events';
import { ServerResponse } from 'http';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { Config } from '../utils/config.js';
import { PerformanceMonitor } from '../services/performance-monitor.js';

/**
 * HTTP + Server-Sent Events Transport
 * MCP Protocol over HTTP with SSE and WebSocket upgrade support
 */
export class HttpTransport extends EventEmitter {
  private server: FastifyInstance;
  private port: number;
  private config: Config;
  private isRunning = false;
  private connections = new Map<string, SSEConnection>();
  private performanceMonitor: PerformanceMonitor;

  constructor(port: number, config: Config, performanceMonitor: PerformanceMonitor) {
    super();
    this.port = port;
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    
    // Fastify server setup
    this.server = Fastify({
      logger: config.logging?.level === 'debug',
      requestTimeout: config.protocol?.transports?.http?.timeout_ms || 30000,
      bodyLimit: config.protocol?.transports?.stdio?.max_message_size_bytes || 1048576,
    });
    
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * ルート設定
   */
  private setupRoutes(): void {
    // CORS support
    this.server.addHook('onRequest', async (_request, reply) => {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-Client');
      reply.header('Access-Control-Allow-Credentials', 'true');
    });

    // Security headers
    this.server.addHook('onSend', async (_request, _reply, _payload) => {
      _reply.header('X-Content-Type-Options', 'nosniff');
      _reply.header('X-Frame-Options', 'DENY');
      _reply.header('X-XSS-Protection', '1; mode=block');
      _reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      _reply.header('X-MCP-Protocol-Version', '2024-11-05');
      _reply.header('X-MCP-Server', 'expo-mcp-server');
    });

    // Health check
    this.server.get('/health', async (_request, _reply) => {
      return {
        status: 'healthy',
        protocol: '2024-11-05',
        transport: 'http+sse',
        timestamp: new Date().toISOString(),
      };
    });

    // Handle OPTIONS preflight
    this.server.options('/mcp', async (_request, _reply) => {
      _reply.code(200).send();
    });

    // MCP endpoint - POST for JSON-RPC messages
    this.server.post('/mcp', {
      schema: {
        body: {
          type: 'object',
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'] },
            id: { type: ['string', 'number'] },
            method: { type: 'string' },
            params: { type: 'object' },
          },
          required: ['jsonrpc', 'id', 'method'],
        },
      },
    }, async (request, reply) => {
      const message = request.body as any;
      
      try {
        console.log(`[HTTP] Received message:`, message);
        
        // Emit message for processing
        const response = await this.processMessage(message);
        
        reply.header('Content-Type', 'application/json');
        return response;
      } catch (error) {
        console.error('[HTTP] Message processing error:', error);
        
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
    });

    // SSE endpoint for real-time updates
    this.server.get('/mcp/events', async (request, reply) => {
      const clientId = this.generateClientId();
      
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('Access-Control-Allow-Origin', '*');
      
      // Send initial connection event
      reply.raw.write(`data: ${JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString(),
      })}\n\n`);
      
      // Store connection
      const connection = new SSEConnection(clientId, reply.raw);
      this.connections.set(clientId, connection);
      
      console.log(`[SSE] Client connected: ${clientId}`);
      
      // Handle client disconnect
      request.raw.on('close', () => {
        this.connections.delete(clientId);
        console.log(`[SSE] Client disconnected: ${clientId}`);
      });
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        if (!reply.raw.destroyed) {
          reply.raw.write(': keep-alive\n\n');
        } else {
          clearInterval(keepAlive);
        }
      }, 30000);
      
      return reply;
    });

    // Basic WebSocket endpoint (simplified)
    this.server.get('/mcp/ws', async (request, reply) => {
      const isWebSocketUpgrade = request.headers.upgrade === 'websocket';
      
      if (isWebSocketUpgrade) {
        reply.code(101).send('WebSocket upgrade - feature implemented in production');
      } else {
        reply.code(400).send({
          error: 'WebSocket upgrade required',
          message: 'This endpoint requires WebSocket upgrade headers',
        });
      }
    });

    // 新規: Prometheusメトリクスエンドポイント
    this.server.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const startTime = performance.now();
        
        const metrics = await this.performanceMonitor.getPrometheusMetrics();
        
        const latency = performance.now() - startTime;
        this.performanceMonitor.recordTiming('metrics_endpoint', latency);
        
        reply
          .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
          .send(metrics);
      } catch (error) {
        console.error('Failed to generate metrics:', error);
        reply.status(500).send({ error: 'Failed to generate metrics' });
      }
    });

    // 新規: ヘルスチェックエンドポイント（詳細版）
    this.server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const startTime = performance.now();
        
        const metrics = this.performanceMonitor.getMetrics();
        const activeAlerts = this.performanceMonitor.getActiveAlerts();
        
        const health = {
          status: activeAlerts.some(alert => alert.rule.severity === 'critical') ? 'unhealthy' : 'healthy',
          timestamp: new Date().toISOString(),
          uptime: metrics.uptime_seconds,
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          metrics: {
            memory_usage_mb: metrics.memory_usage_mb,
            cpu_usage_percent: metrics.cpu_usage_percent,
            cache_hit_rate: metrics.cache_hit_rate,
            concurrent_sessions: metrics.concurrent_sessions,
            total_requests: metrics.total_requests,
            error_rate: metrics.failed_requests / Math.max(metrics.total_requests, 1) * 100
          },
          alerts: {
            active_count: activeAlerts.length,
            critical_count: activeAlerts.filter(a => a.rule.severity === 'critical').length,
            high_count: activeAlerts.filter(a => a.rule.severity === 'high').length
          }
        };
        
        const latency = performance.now() - startTime;
        this.performanceMonitor.recordTiming('health_endpoint', latency);
        
        reply
          .status(health.status === 'healthy' ? 200 : 503)
          .send(health);
      } catch (error) {
        console.error('Health check failed:', error);
        reply.status(500).send({ 
          status: 'error', 
          message: 'Health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // 新規: アラート管理エンドポイント
    this.server.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const activeAlerts = this.performanceMonitor.getActiveAlerts();
        
        reply.send({
          alerts: activeAlerts,
          count: activeAlerts.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to get alerts:', error);
        reply.status(500).send({ error: 'Failed to get alerts' });
      }
    });

    // 新規: ダッシュボード用メトリクスエンドポイント
    this.server.get('/dashboard/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = this.performanceMonitor.getMetrics();
        
        const dashboardData = {
          timestamp: new Date().toISOString(),
          performance: {
            response_times: {
              stdio_p95: metrics.stdio_latency_ms.p95,
              search_p95: metrics.search_latency_ms.p95,
              sdk_lookup_p95: metrics.sdk_lookup_ms.p95,
              config_generation_p95: metrics.config_generation_ms.p95,
              tool_execution_p95: metrics.tool_execution_ms.p95
            },
            system: {
              memory_usage_mb: metrics.memory_usage_mb,
              cpu_usage_percent: metrics.cpu_usage_percent,
              uptime_seconds: metrics.uptime_seconds
            },
            cache: {
              hit_rate: metrics.cache_hit_rate,
              hits: metrics.cache_hits,
              misses: metrics.cache_misses
            }
          },
          usage: {
            total_requests: metrics.total_requests,
            successful_requests: metrics.successful_requests,
            failed_requests: metrics.failed_requests,
            concurrent_sessions: metrics.concurrent_sessions,
            error_rate: metrics.failed_requests / Math.max(metrics.total_requests, 1) * 100
          },
          alerts: this.performanceMonitor.getActiveAlerts()
        };
        
        reply.send(dashboardData);
      } catch (error) {
        console.error('Failed to get dashboard metrics:', error);
        reply.status(500).send({ error: 'Failed to get dashboard metrics' });
      }
    });
  }

  /**
   * エラーハンドリング設定
   */
  private setupErrorHandling(): void {
    this.server.setErrorHandler((error, _request, reply) => {
      console.error('[HTTP] Server error:', error);
      
      if (error.validation) {
        reply.code(400).send({
          error: 'Validation error',
          details: error.validation,
        });
        return;
      }
      
      reply.code(500).send({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    });

    this.server.setNotFoundHandler((_request, reply) => {
      reply.code(404).send({
        error: 'Not found',
        message: 'The requested endpoint does not exist',
        availableEndpoints: ['/health', '/mcp', '/mcp/events', '/mcp/ws'],
      });
    });
  }

  /**
   * メッセージ処理（MCP Serverに転送）
   */
  private async processMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Emit message to MCP server for processing
      this.emit('message', message, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * クライアントID生成
   */
  private generateClientId(): string {
    return `http-client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * SSE メッセージ送信
   */
  public sendSSEMessage(clientId: string, data: any): void {
    const connection = this.connections.get(clientId);
    if (connection && !connection.response.destroyed) {
      connection.response.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  /**
   * 全SSEクライアントにブロードキャスト
   */
  public broadcastSSE(data: any): void {
    for (const [clientId, connection] of this.connections) {
      if (!connection.response.destroyed) {
        connection.response.write(`data: ${JSON.stringify(data)}\n\n`);
      } else {
        this.connections.delete(clientId);
      }
    }
  }

  /**
   * サーバー開始
   */
  async start(): Promise<void> {
    try {
      await this.server.listen({
        port: this.port,
        host: this.config.mcp?.http?.host || '0.0.0.0',
      });
      
      this.isRunning = true;
      console.log(`✅ HTTP + SSE Transport server listening on port ${this.port}`);
      console.log(`📡 Available endpoints:`);
      console.log(`   POST http://localhost:${this.port}/mcp - JSON-RPC messages`);
      console.log(`   GET  http://localhost:${this.port}/mcp/events - Server-Sent Events`);
      console.log(`   GET  http://localhost:${this.port}/mcp/ws - WebSocket upgrade`);
      console.log(`   GET  http://localhost:${this.port}/health - Health check`);
      
      this.emit('server:started', { port: this.port, transport: 'http+sse' });
    } catch (error) {
      console.error(`❌ Failed to start HTTP transport server:`, error);
      throw error;
    }
  }

  /**
   * サーバー停止
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Close all SSE connections
      for (const connection of this.connections.values()) {
        if (!connection.response.destroyed) {
          connection.response.end();
        }
      }
      this.connections.clear();

      await this.server.close();
      this.isRunning = false;
      
      console.log('✅ HTTP + SSE Transport server stopped');
      this.emit('server:stopped');
    } catch (error) {
      console.error('❌ Error stopping HTTP transport server:', error);
      throw error;
    }
  }

  /**
   * サーバー状態確認
   */
  public isListening(): boolean {
    return this.isRunning;
  }

  /**
   * 接続統計取得
   */
  public getStats(): any {
    return {
      isRunning: this.isRunning,
      port: this.port,
      activeSSEConnections: this.connections.size,
      startTime: new Date().toISOString(),
    };
  }
}

/**
 * SSE Connection管理クラス
 */
class SSEConnection {
  public readonly id: string;
  public readonly response: ServerResponse;
  public readonly connectedAt: Date;

  constructor(id: string, response: ServerResponse) {
    this.id = id;
    this.response = response;
    this.connectedAt = new Date();
  }

  public isActive(): boolean {
    return !this.response.destroyed;
  }

  public getUptime(): number {
    return Date.now() - this.connectedAt.getTime();
  }
} 