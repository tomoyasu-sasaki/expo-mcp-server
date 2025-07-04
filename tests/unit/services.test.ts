import { performance } from 'perf_hooks';

describe('Unit: サービス機能', () => {
  test('サービス基本構造確認', () => {
    const startTime = performance.now();
    
    // サービスの基本構造
    interface ServiceInterface {
      name: string;
      version: string;
      initialize(): Promise<boolean>;
      cleanup(): Promise<void>;
      isHealthy(): boolean;
    }
    
    // モックサービス実装
    class MockService implements ServiceInterface {
      name = 'MockService';
      version = '1.0.0';
      private initialized = false;
      
      async initialize(): Promise<boolean> {
        this.initialized = true;
        return true;
      }
      
      async cleanup(): Promise<void> {
        this.initialized = false;
      }
      
      isHealthy(): boolean {
        return this.initialized;
      }
    }
    
    const service = new MockService();
    
    expect(service.name).toBe('MockService');
    expect(service.version).toBe('1.0.0');
    expect(service.isHealthy()).toBe(false);
    
    const endTime = performance.now();
    console.log(`✅ サービス基本構造: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('設定管理サービス確認', async () => {
    const startTime = performance.now();
    
    // 設定管理サービスのモック
    class ConfigService {
      private config: Record<string, unknown> = {};
      
      get(key: string): unknown {
        return this.config[key];
      }
      
      set(key: string, value: unknown): void {
        this.config[key] = value;
      }
      
      validate(): boolean {
        // 基本的な検証
        return typeof this.config === 'object' && this.config !== null;
      }
      
      toJSON(): Record<string, unknown> {
        return { ...this.config };
      }
    }
    
    const configService = new ConfigService();
    
    // 設定の読み書き
    configService.set('expo.name', 'MyApp');
    configService.set('expo.version', '1.0.0');
    
    expect(configService.get('expo.name')).toBe('MyApp');
    expect(configService.get('expo.version')).toBe('1.0.0');
    expect(configService.validate()).toBe(true);
    
    const config = configService.toJSON();
    expect(config['expo.name']).toBe('MyApp');
    expect(config['expo.version']).toBe('1.0.0');
    
    const endTime = performance.now();
    console.log(`✅ 設定管理サービス: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('キャッシュサービス確認', async () => {
    const startTime = performance.now();
    
    // キャッシュサービスのモック
    class CacheService {
      private cache = new Map<string, { value: unknown; expiry: number }>();
      
      set(key: string, value: unknown, ttlMs = 60000): void {
        const expiry = Date.now() + ttlMs;
        this.cache.set(key, { value, expiry });
      }
      
      get(key: string): unknown | null {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
          this.cache.delete(key);
          return null;
        }
        
        return item.value;
      }
      
      delete(key: string): boolean {
        return this.cache.delete(key);
      }
      
      clear(): void {
        this.cache.clear();
      }
      
      size(): number {
        return this.cache.size;
      }
    }
    
    const cacheService = new CacheService();
    
    // キャッシュの基本操作
    cacheService.set('user:123', { name: 'John', age: 30 });
    cacheService.set('temp:data', 'temporary', 100); // 100ms TTL
    
    expect(cacheService.get('user:123')).toEqual({ name: 'John', age: 30 });
    expect(cacheService.get('temp:data')).toBe('temporary');
    expect(cacheService.size()).toBe(2);
    
    // TTL確認（短時間待機）
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cacheService.get('temp:data')).toBeNull();
    expect(cacheService.get('user:123')).toEqual({ name: 'John', age: 30 });
    
    // 削除とクリア
    expect(cacheService.delete('user:123')).toBe(true);
    expect(cacheService.get('user:123')).toBeNull();
    
    cacheService.clear();
    expect(cacheService.size()).toBe(0);
    
    const endTime = performance.now();
    console.log(`✅ キャッシュサービス: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('ログサービス確認', () => {
    const startTime = performance.now();
    
    // ログサービスのモック
    class LogService {
      private logs: Array<{ level: string; message: string; timestamp: number }> = [];
      
      private log(level: string, message: string): void {
        this.logs.push({
          level,
          message,
          timestamp: Date.now()
        });
      }
      
      info(message: string): void {
        this.log('info', message);
      }
      
      warn(message: string): void {
        this.log('warn', message);
      }
      
      error(message: string): void {
        this.log('error', message);
      }
      
      debug(message: string): void {
        this.log('debug', message);
      }
      
      getLogs(level?: string): Array<{ level: string; message: string; timestamp: number }> {
        if (!level) return [...this.logs];
        return this.logs.filter(log => log.level === level);
      }
      
      clear(): void {
        this.logs = [];
      }
      
      count(): number {
        return this.logs.length;
      }
    }
    
    const logService = new LogService();
    
    // ログ出力
    logService.info('Application started');
    logService.warn('Configuration missing');
    logService.error('Connection failed');
    logService.debug('Debug information');
    
    expect(logService.count()).toBe(4);
    
    const infoLogs = logService.getLogs('info');
    expect(infoLogs).toHaveLength(1);
    expect(infoLogs[0].message).toBe('Application started');
    
    const errorLogs = logService.getLogs('error');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].message).toBe('Connection failed');
    
    const allLogs = logService.getLogs();
    expect(allLogs).toHaveLength(4);
    
    logService.clear();
    expect(logService.count()).toBe(0);
    
    const endTime = performance.now();
    console.log(`✅ ログサービス: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('イベントサービス確認', () => {
    const startTime = performance.now();
    
    // イベントサービスのモック
    class EventService {
      private listeners = new Map<string, Array<(data: unknown) => void>>();
      
      on(event: string, listener: (data: unknown) => void): void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
      }
      
      off(event: string, listener: (data: unknown) => void): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          const index = eventListeners.indexOf(listener);
          if (index > -1) {
            eventListeners.splice(index, 1);
          }
        }
      }
      
      emit(event: string, data?: unknown): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(listener => listener(data));
        }
      }
      
      listenerCount(event: string): number {
        return this.listeners.get(event)?.length || 0;
      }
      
      removeAllListeners(event?: string): void {
        if (event) {
          this.listeners.delete(event);
        } else {
          this.listeners.clear();
        }
      }
    }
    
    const eventService = new EventService();
    let receivedData: unknown = null;
    let callCount = 0;
    
    // イベントリスナー登録
    const listener = (data: unknown) => {
      receivedData = data;
      callCount++;
    };
    
    eventService.on('test.event', listener);
    expect(eventService.listenerCount('test.event')).toBe(1);
    
    // イベント発火
    eventService.emit('test.event', { message: 'Hello World' });
    expect(receivedData).toEqual({ message: 'Hello World' });
    expect(callCount).toBe(1);
    
    // 複数回発火
    eventService.emit('test.event', { count: 2 });
    expect(receivedData).toEqual({ count: 2 });
    expect(callCount).toBe(2);
    
    // リスナー削除
    eventService.off('test.event', listener);
    expect(eventService.listenerCount('test.event')).toBe(0);
    
    eventService.emit('test.event', { count: 3 });
    expect(callCount).toBe(2); // 変化なし
    
    const endTime = performance.now();
    console.log(`✅ イベントサービス: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('サービス依存関係確認', async () => {
    const startTime = performance.now();
    
    // サービス依存関係のモック
    class DependencyContainer {
      private services = new Map<string, unknown>();
      private dependencies = new Map<string, string[]>();
      
      register(name: string, service: unknown, deps: string[] = []): void {
        this.services.set(name, service);
        this.dependencies.set(name, deps);
      }
      
      get<T>(name: string): T | null {
        return (this.services.get(name) as T) || null;
      }
      
             async initialize(): Promise<void> {
         // 依存関係順に初期化（簡略化）
         for (const [, service] of this.services) {
           if (service && typeof service === 'object' && 'initialize' in service) {
             await (service as { initialize(): Promise<void> }).initialize();
           }
         }
       }
      
      getDependencies(name: string): string[] {
        return this.dependencies.get(name) || [];
      }
      
      listServices(): string[] {
        return Array.from(this.services.keys());
      }
    }
    
    const container = new DependencyContainer();
    
    // サービス登録
    container.register('config', { name: 'ConfigService' });
    container.register('cache', { name: 'CacheService' }, ['config']);
    container.register('logger', { name: 'LogService' });
    container.register('api', { name: 'ApiService' }, ['config', 'logger']);
    
    expect(container.listServices()).toHaveLength(4);
    expect(container.get('config')).toEqual({ name: 'ConfigService' });
    expect(container.getDependencies('api')).toEqual(['config', 'logger']);
    expect(container.getDependencies('cache')).toEqual(['config']);
    expect(container.getDependencies('logger')).toEqual([]);
    
    const endTime = performance.now();
    console.log(`✅ サービス依存関係: ${(endTime - startTime).toFixed(2)}ms`);
  });
}); 