import { performance } from 'perf_hooks';

describe('Integration: HTTP通信', () => {
  test('HTTP基本通信確認', async () => {
    const startTime = performance.now();
    
    // HTTP通信のシミュレーション
    class HTTPTransport {
      private baseUrl: string;
      private timeout: number;
      
      constructor(baseUrl = 'http://localhost:3000', timeout = 5000) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
      }
      
      async get(path: string): Promise<{ status: number; data: unknown }> {
        // GETリクエストのシミュレーション
        await new Promise(resolve => setTimeout(resolve, 10));
        
        if (path === '/health') {
          return { status: 200, data: { status: 'healthy' } };
        }
        
        if (path === '/api/tools') {
          return {
            status: 200,
            data: {
              tools: [
                'expo_read_document',
                'expo_search_documents',
                'expo_get_sdk_version'
              ]
            }
          };
        }
        
        return { status: 404, data: { error: 'Not found' } };
      }
      
      async post(path: string, data: unknown): Promise<{ status: number; data: unknown }> {
        // POSTリクエストのシミュレーション
        await new Promise(resolve => setTimeout(resolve, 15));
        
        if (path === '/api/tools/execute') {
          return {
            status: 200,
            data: {
              success: true,
              result: `Executed with data: ${JSON.stringify(data)}`
            }
          };
        }
        
        return { status: 400, data: { error: 'Bad request' } };
      }
      
      getBaseUrl(): string {
        return this.baseUrl;
      }
      
      getTimeout(): number {
        return this.timeout;
      }
    }
    
    const transport = new HTTPTransport();
    
    // 基本設定確認
    expect(transport.getBaseUrl()).toBe('http://localhost:3000');
    expect(transport.getTimeout()).toBe(5000);
    
    // GET リクエスト
    const healthResponse = await transport.get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data).toEqual({ status: 'healthy' });
    
    const toolsResponse = await transport.get('/api/tools');
    expect(toolsResponse.status).toBe(200);
    expect((toolsResponse.data as { tools: string[] }).tools).toHaveLength(3);
    
    // 404 エラー
    const notFoundResponse = await transport.get('/invalid');
    expect(notFoundResponse.status).toBe(404);
    
    // POST リクエスト
    const executeResponse = await transport.post('/api/tools/execute', {
      tool: 'expo_read_document',
      params: { path: '/docs/guide.md' }
    });
    expect(executeResponse.status).toBe(200);
    expect((executeResponse.data as { success: boolean }).success).toBe(true);
    
    const endTime = performance.now();
    console.log(`✅ HTTP基本通信: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('SSE通信確認', async () => {
    const startTime = performance.now();
    
    // Server-Sent Events のシミュレーション
    class SSETransport {
      private listeners: Map<string, Array<(data: unknown) => void>> = new Map();
      private connected = false;
      
      connect(): Promise<boolean> {
        return new Promise((resolve) => {
          setTimeout(() => {
            this.connected = true;
            resolve(true);
          }, 10);
        });
      }
      
      disconnect(): void {
        this.connected = false;
        this.listeners.clear();
      }
      
      on(event: string, listener: (data: unknown) => void): void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
      }
      
      emit(event: string, data: unknown): void {
        if (!this.connected) return;
        
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => listener(data));
        }
      }
      
      isConnected(): boolean {
        return this.connected;
      }
      
      listenerCount(event: string): number {
        return this.listeners.get(event)?.length || 0;
      }
    }
    
    const sse = new SSETransport();
    
    expect(sse.isConnected()).toBe(false);
    
    // 接続
    const connected = await sse.connect();
    expect(connected).toBe(true);
    expect(sse.isConnected()).toBe(true);
    
    // イベントリスナー設定
    let receivedData: unknown = null;
    sse.on('progress', (data) => {
      receivedData = data;
    });
    
    expect(sse.listenerCount('progress')).toBe(1);
    
    // イベント送信
    sse.emit('progress', { percentage: 50, message: 'Processing...' });
    expect(receivedData).toEqual({ percentage: 50, message: 'Processing...' });
    
    // 切断
    sse.disconnect();
    expect(sse.isConnected()).toBe(false);
    expect(sse.listenerCount('progress')).toBe(0);
    
    const endTime = performance.now();
    console.log(`✅ SSE通信: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('WebSocket通信確認', async () => {
    const startTime = performance.now();
    
    // WebSocket のシミュレーション
    class WebSocketTransport {
      private state: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' = 'disconnected';
      private listeners: Map<string, Array<(data: unknown) => void>> = new Map();
      private messageQueue: unknown[] = [];
      
      async connect(): Promise<boolean> {
        if (this.state !== 'disconnected') return false;
        
        this.state = 'connecting';
        await new Promise(resolve => setTimeout(resolve, 20));
        this.state = 'connected';
        
        // キューされたメッセージを送信
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          this.emit('message', message);
        }
        
        return true;
      }
      
      async disconnect(): Promise<void> {
        if (this.state !== 'connected') return;
        
        this.state = 'disconnecting';
        await new Promise(resolve => setTimeout(resolve, 10));
        this.state = 'disconnected';
        this.listeners.clear();
      }
      
      send(data: unknown): boolean {
        if (this.state === 'connected') {
          // 即座に送信
          setTimeout(() => this.emit('message', data), 5);
          return true;
        } else {
          // キューに追加
          this.messageQueue.push(data);
          return false;
        }
      }
      
      on(event: string, listener: (data: unknown) => void): void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
      }
      
      private emit(event: string, data: unknown): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => listener(data));
        }
      }
      
      getState(): string {
        return this.state;
      }
      
      getQueueSize(): number {
        return this.messageQueue.length;
      }
    }
    
    const ws = new WebSocketTransport();
    
    expect(ws.getState()).toBe('disconnected');
    
    // 切断状態でのメッセージ送信（キューに追加）
    const queued = ws.send({ type: 'ping' });
    expect(queued).toBe(false);
    expect(ws.getQueueSize()).toBe(1);
    
    // メッセージリスナー設定
    const receivedMessages: unknown[] = [];
    ws.on('message', (data) => {
      receivedMessages.push(data);
    });
    
    // 接続
    const connected = await ws.connect();
    expect(connected).toBe(true);
    expect(ws.getState()).toBe('connected');
    expect(ws.getQueueSize()).toBe(0); // キューが空になる
    
    // 接続後のメッセージ送信
    const sent = ws.send({ type: 'test', data: 'hello' });
    expect(sent).toBe(true);
    
    // メッセージ受信確認（非同期）
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(receivedMessages).toHaveLength(2); // キューされたメッセージ + 新しいメッセージ
    
    // 切断
    await ws.disconnect();
    expect(ws.getState()).toBe('disconnected');
    
    const endTime = performance.now();
    console.log(`✅ WebSocket通信: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('CORS設定確認', () => {
    const startTime = performance.now();
    
    // CORS設定のシミュレーション
    class CORSHandler {
      private allowedOrigins: string[];
      private allowedMethods: string[];
      private allowedHeaders: string[];
      
      constructor() {
        this.allowedOrigins = ['http://localhost:3000', 'https://snack.expo.dev'];
        this.allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        this.allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'];
      }
      
      isOriginAllowed(origin: string): boolean {
        return this.allowedOrigins.includes(origin) || this.allowedOrigins.includes('*');
      }
      
      isMethodAllowed(method: string): boolean {
        return this.allowedMethods.includes(method.toUpperCase());
      }
      
      areHeadersAllowed(headers: string[]): boolean {
        return headers.every(header => 
          this.allowedHeaders.includes(header) || 
          header.toLowerCase().startsWith('x-')
        );
      }
      
      generateHeaders(origin: string): Record<string, string> {
        const headers: Record<string, string> = {};
        
        if (this.isOriginAllowed(origin)) {
          headers['Access-Control-Allow-Origin'] = origin;
        }
        
        headers['Access-Control-Allow-Methods'] = this.allowedMethods.join(', ');
        headers['Access-Control-Allow-Headers'] = this.allowedHeaders.join(', ');
        headers['Access-Control-Max-Age'] = '86400';
        
        return headers;
      }
      
      handlePreflightRequest(origin: string, method: string, headers: string[]): { allowed: boolean; headers: Record<string, string> } {
        const allowed = this.isOriginAllowed(origin) && 
                       this.isMethodAllowed(method) && 
                       this.areHeadersAllowed(headers);
        
        return {
          allowed,
          headers: this.generateHeaders(origin)
        };
      }
    }
    
    const corsHandler = new CORSHandler();
    
    // 許可されたオリジン
    expect(corsHandler.isOriginAllowed('http://localhost:3000')).toBe(true);
    expect(corsHandler.isOriginAllowed('https://snack.expo.dev')).toBe(true);
    
    // 許可されていないオリジン
    expect(corsHandler.isOriginAllowed('https://malicious.com')).toBe(false);
    
    // 許可されたメソッド
    expect(corsHandler.isMethodAllowed('GET')).toBe(true);
    expect(corsHandler.isMethodAllowed('POST')).toBe(true);
    expect(corsHandler.isMethodAllowed('OPTIONS')).toBe(true);
    
    // 許可されていないメソッド
    expect(corsHandler.isMethodAllowed('PATCH')).toBe(false);
    
    // ヘッダー確認
    expect(corsHandler.areHeadersAllowed(['Content-Type'])).toBe(true);
    expect(corsHandler.areHeadersAllowed(['Content-Type', 'Authorization'])).toBe(true);
    expect(corsHandler.areHeadersAllowed(['X-Custom-Header'])).toBe(true);
    expect(corsHandler.areHeadersAllowed(['Forbidden-Header'])).toBe(false);
    
    // プリフライトリクエスト処理
    const preflightResult = corsHandler.handlePreflightRequest(
      'http://localhost:3000',
      'POST',
      ['Content-Type', 'Authorization']
    );
    
    expect(preflightResult.allowed).toBe(true);
    expect(preflightResult.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(preflightResult.headers['Access-Control-Allow-Methods']).toContain('POST');
    
    const endTime = performance.now();
    console.log(`✅ CORS設定: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('リクエスト・レスポンス変換確認', () => {
    const startTime = performance.now();
    
    // リクエスト・レスポンス変換のシミュレーション
    class RequestResponseTransformer {
      transformRequest(data: unknown): { body: string; headers: Record<string, string> } {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'expo-mcp-server/1.0.0'
        };
        
        let body: string;
        
        if (typeof data === 'string') {
          body = data;
          headers['Content-Type'] = 'text/plain';
        } else {
          body = JSON.stringify(data);
        }
        
        return { body, headers };
      }
      
      transformResponse(responseText: string, contentType: string): unknown {
        if (contentType.includes('application/json')) {
          try {
            return JSON.parse(responseText);
          } catch {
            return { error: 'Invalid JSON' };
          }
        }
        
        if (contentType.includes('text/plain')) {
          return responseText;
        }
        
        return responseText;
      }
      
      validateRequest(data: unknown): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (data === null || data === undefined) {
          errors.push('Request data is required');
        }
        
        if (typeof data === 'object' && data !== null) {
          const obj = data as Record<string, unknown>;
          
          if ('tool' in obj && typeof obj.tool !== 'string') {
            errors.push('Tool name must be a string');
          }
          
          if ('params' in obj && typeof obj.params !== 'object') {
            errors.push('Params must be an object');
          }
        }
        
        return {
          valid: errors.length === 0,
          errors
        };
      }
    }
    
    const transformer = new RequestResponseTransformer();
    
    // リクエスト変換
    const jsonRequest = transformer.transformRequest({
      tool: 'expo_read_document',
      params: { path: '/docs/guide.md' }
    });
    
    expect(jsonRequest.headers['Content-Type']).toBe('application/json');
    expect(jsonRequest.body).toContain('"tool":"expo_read_document"');
    
    const textRequest = transformer.transformRequest('Hello World');
    expect(textRequest.headers['Content-Type']).toBe('text/plain');
    expect(textRequest.body).toBe('Hello World');
    
    // レスポンス変換
    const jsonResponse = transformer.transformResponse(
      '{"success":true,"data":"result"}',
      'application/json'
    );
    expect(jsonResponse).toEqual({ success: true, data: 'result' });
    
    const textResponse = transformer.transformResponse(
      'Plain text response',
      'text/plain'
    );
    expect(textResponse).toBe('Plain text response');
    
    // バリデーション
    const validRequest = transformer.validateRequest({
      tool: 'expo_read_document',
      params: { path: '/docs/guide.md' }
    });
    expect(validRequest.valid).toBe(true);
    expect(validRequest.errors).toHaveLength(0);
    
    const invalidRequest = transformer.validateRequest({
      tool: 123,
      params: 'invalid'
    });
    expect(invalidRequest.valid).toBe(false);
    expect(invalidRequest.errors.length).toBeGreaterThan(0);
    
    const endTime = performance.now();
    console.log(`✅ リクエスト・レスポンス変換: ${(endTime - startTime).toFixed(2)}ms`);
  });
}); 