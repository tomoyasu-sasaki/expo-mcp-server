import { HttpTransport } from '../src/mcp/http-transport';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe.skip('HTTP Transport', () => {
  let transport: HttpTransport;
  const testPort = 3001; // 通常のテストとは別ポート
  const mockConfig = {
    mcp: {
      http: {
        host: 'localhost',
      },
    },
    security: {
      access_control: {
        cors_origins: ['http://localhost:*'],
        rate_limit_per_session: 100,
      },
    },
    logging: {
      level: 'error', // テスト中はエラーログのみ
    },
  };

  beforeEach(() => {
    transport = new HttpTransport(testPort, mockConfig);
  });

  afterEach(async () => {
    if (transport.isListening()) {
      await transport.stop();
    }
  });

  describe('Server Startup', () => {
    it('should start HTTP server on specified port', async () => {
      await transport.start();
      
      expect(transport.isListening()).toBe(true);
      
      const stats = transport.getStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.port).toBe(testPort);
      expect(stats.activeSSEConnections).toBe(0);
    });

    it('should stop HTTP server gracefully', async () => {
      await transport.start();
      expect(transport.isListening()).toBe(true);
      
      await transport.stop();
      expect(transport.isListening()).toBe(false);
    });

    it('should emit server:started event', async () => {
      const startedHandler = jest.fn();
      transport.on('server:started', startedHandler);
      
      await transport.start();
      
      expect(startedHandler).toHaveBeenCalledWith({
        port: testPort,
        transport: 'http+sse',
      });
    });

    it('should emit server:stopped event', async () => {
      const stoppedHandler = jest.fn();
      transport.on('server:stopped', stoppedHandler);
      
      await transport.start();
      await transport.stop();
      
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe('HTTP Endpoints', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('should respond to health check', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.protocol).toBe('2024-11-05');
      expect(data.transport).toBe('http+sse');
      expect(data.timestamp).toBeDefined();
    });

    it('should handle CORS preflight requests', async () => {
      const response = await fetch(`http://localhost:${testPort}/mcp`, {
        method: 'OPTIONS',
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should validate JSON-RPC messages', async () => {
      const invalidMessage = {
        invalid: 'message',
      };
      
      const response = await fetch(`http://localhost:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidMessage),
      });
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should handle valid JSON-RPC messages', async () => {
      const messageHandler = jest.fn((message: any, callback: (error: any, response: any) => void) => {
        callback(null, {
          jsonrpc: '2.0',
          id: message.id,
          result: { success: true },
        });
      });
      
      transport.on('message', messageHandler);
      
      const mcpMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      };
      
      const response = await fetch(`http://localhost:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpMessage),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(1);
      expect(data.result.success).toBe(true);
      expect(messageHandler).toHaveBeenCalledWith(mcpMessage, expect.any(Function));
    });

    it('should handle message processing errors', async () => {
      const messageHandler = jest.fn((message: any, callback: (error: any, response: any) => void) => {
        callback(new Error('Processing failed'), null);
      });
      
      transport.on('message', messageHandler);
      
      const mcpMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      };
      
      const response = await fetch(`http://localhost:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mcpMessage),
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.jsonrpc).toBe('2.0');
      expect(data.id).toBe(1);
      expect(data.error.code).toBe(-32603);
      expect(data.error.message).toBe('Internal error');
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`http://localhost:${testPort}/unknown`);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Not found');
      expect(data.availableEndpoints).toContain('/health');
      expect(data.availableEndpoints).toContain('/mcp');
    });
  });

  describe('Server-Sent Events Basic', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('should establish SSE connection', async () => {
      const response = await fetch(`http://localhost:${testPort}/mcp/events`);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });
  });

  describe('WebSocket Upgrade', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it.skip('should respond to WebSocket upgrade request', async () => {
      // WebSocket upgrade cannot be properly tested with fetch
      // Requires proper WebSocket client for testing
      expect(true).toBe(true);
    });

    it('should reject non-WebSocket requests', async () => {
      const response = await fetch(`http://localhost:${testPort}/mcp/ws`);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('WebSocket upgrade required');
    });
  });

  describe('Security Headers', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('should include security headers in responses', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('X-MCP-Protocol-Version')).toBe('2024-11-05');
      expect(response.headers.get('X-MCP-Server')).toBe('expo-mcp-server');
    });

    it('should include CORS headers', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await transport.start();
    });

    it('should track connection stats', async () => {
      const stats = transport.getStats();
      
      expect(stats.isRunning).toBe(true);
      expect(stats.port).toBe(testPort);
      expect(stats.activeSSEConnections).toBe(0);
      expect(stats.startTime).toBeDefined();
    });
  });
}); 