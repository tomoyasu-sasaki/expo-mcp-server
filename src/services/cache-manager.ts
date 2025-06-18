import { LRUCache } from 'lru-cache';
import { createClient, RedisClientType } from 'redis';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { Config } from '../utils/config.js';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
}

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  skipMemory?: boolean;
  skipRedis?: boolean;
  skipDisk?: boolean;
}

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  evictionRunIntervalMs: number;
}

export interface AdvancedCacheOptions extends CacheOptions {
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  refreshCallback?: () => Promise<any>;
}

export class CacheManager {
  private memoryCache: LRUCache<string, CacheEntry>;
  private redisClient: RedisClientType | null = null;
  private redisPool: RedisClientType[] = [];
  private poolConfig: ConnectionPoolConfig;
  private diskCachePath: string;
  private config: Config['cache'];
  private metrics: CacheMetrics;
  private isInitialized = false;
  
  // 新規: 高度なリソース管理
  private activeConnections = 0;
  private connectionQueue: Array<{ resolve: Function; reject: Function }> = [];
  private cleanupInterval?: NodeJS.Timeout;
  private compressionStats = { compressed: 0, uncompressed: 0, ratio: 0 };

  constructor(config: Config) {
    this.config = config.cache;
    this.diskCachePath = this.config.disk.path;
    
    // コネクションプール設定
    this.poolConfig = {
      min: 2,
      max: 10,
      acquireTimeoutMs: 5000,
      idleTimeoutMs: 30000,
      evictionRunIntervalMs: 60000
    };
    
    // メモリキャッシュ初期化（LRU, 200MB）
    this.memoryCache = new LRUCache<string, CacheEntry>({
      max: Math.floor((this.config.memory.max_size_mb * 1024 * 1024) / 1000),
      maxSize: this.config.memory.max_size_mb * 1024 * 1024,
      sizeCalculation: (value) => this.calculateEntrySize(value),
      ttl: this.config.memory.ttl_seconds * 1000,
      allowStale: false,
      updateAgeOnGet: true,
      dispose: (value, key, reason) => {
        this.metrics.evictions++;
        if (reason === 'evict') {
          console.debug(`Memory cache evicted: ${key}`);
        }
      }
    });

    // メトリクス初期化
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0
    };
  }

  /**
   * 新規: エントリサイズ計算（より正確）
   */
  private calculateEntrySize(entry: CacheEntry): number {
    const baseSize = JSON.stringify(entry).length;
    const overhead = 100; // オブジェクトオーバーヘッド概算
    return baseSize + overhead;
  }

  /**
   * 初期化処理（強化版）
   */
  async initialize(): Promise<void> {
    try {
      await this.initializeRedisPool();
      await this.initializeDiskCache();
      await this.startAdvancedCleanup();
      
      this.isInitialized = true;
      console.log('Advanced CacheManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CacheManager:', error);
      throw error;
    }
  }

  /**
   * 新規: Redisコネクションプール初期化
   */
  private async initializeRedisPool(): Promise<void> {
    try {
      // 最小接続数を確保
      for (let i = 0; i < this.poolConfig.min; i++) {
        const client = createClient({ url: this.config.redis.url });
        
        client.on('error', (err) => {
          console.error(`Redis pool client ${i} error:`, err);
          this.removeFromPool(client);
        });
        
        client.on('ready', () => {
          console.log(`Redis pool client ${i} ready`);
        });
        
        await client.connect();
        this.redisPool.push(client);
      }
      
      this.redisClient = this.redisPool[0]; // フォールバック用
      console.log(`Redis connection pool initialized with ${this.redisPool.length} connections`);
    } catch (error) {
      console.warn('Failed to initialize Redis pool, continuing without Redis cache:', error);
      this.redisPool = [];
      this.redisClient = null;
    }
  }

  /**
   * 新規: プールからRedis接続を取得
   */
  private async acquireRedisConnection(): Promise<RedisClientType | null> {
    if (this.redisPool.length === 0) return null;
    
    // 利用可能な接続を探す
    for (const client of this.redisPool) {
      if (client.isReady) {
        this.activeConnections++;
        return client;
      }
    }
    
    // プールに空きがあれば新しい接続を作成
    if (this.redisPool.length < this.poolConfig.max) {
      try {
        const client = createClient({ url: this.config.redis.url });
        await client.connect();
        this.redisPool.push(client);
        this.activeConnections++;
        return client;
      } catch (error) {
        console.error('Failed to create new Redis connection:', error);
        return null;
      }
    }
    
    // 接続待ちのキューに追加
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionQueue = this.connectionQueue.filter(item => item !== queueItem);
        reject(new Error('Redis connection acquisition timeout'));
      }, this.poolConfig.acquireTimeoutMs);
      
      const queueItem = {
        resolve: (client: RedisClientType | null) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject
      };
      
      this.connectionQueue.push(queueItem);
    });
  }

  /**
   * 新規: Redis接続をプールに返却
   */
  private releaseRedisConnection(client: RedisClientType): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    
    // キューから待機中のリクエストがあれば処理
    if (this.connectionQueue.length > 0) {
      const queueItem = this.connectionQueue.shift();
      if (queueItem && client.isReady) {
        this.activeConnections++;
        queueItem.resolve(client);
        return;
      }
    }
  }

  /**
   * 新規: プールから接続を削除
   */
  private removeFromPool(client: RedisClientType): void {
    const index = this.redisPool.indexOf(client);
    if (index > -1) {
      this.redisPool.splice(index, 1);
      this.activeConnections = Math.max(0, this.activeConnections - 1);
    }
  }

  /**
   * 新規: 高度なクリーンアップタスク開始
   */
  private async startAdvancedCleanup(): Promise<void> {
    this.cleanupInterval = setInterval(async () => {
      await this.performAdvancedCleanup();
    }, this.poolConfig.evictionRunIntervalMs);
  }

  /**
   * 新規: 高度なクリーンアップ実行
   */
  private async performAdvancedCleanup(): Promise<void> {
    try {
      // メモリキャッシュの統計更新
      this.updateMemoryMetrics();
      
      // Redisプールの健全性チェック
      await this.checkRedisPoolHealth();
      
      // ディスクキャッシュのクリーンアップ
      await this.cleanupDiskCache();
      
      // 圧縮統計の更新
      this.updateCompressionStats();
      
      console.debug('Advanced cleanup completed', {
        memoryEntries: this.memoryCache.size,
        redisPoolSize: this.redisPool.length,
        compressionRatio: this.compressionStats.ratio
      });
    } catch (error) {
      console.error('Advanced cleanup failed:', error);
    }
  }

  /**
   * 新規: メモリメトリクス更新
   */
  private updateMemoryMetrics(): void {
    this.metrics.memoryUsage = this.memoryCache.calculatedSize || 0;
  }

  /**
   * 新規: Redisプール健全性チェック
   */
  private async checkRedisPoolHealth(): Promise<void> {
    const healthyClients: RedisClientType[] = [];
    
    for (const client of this.redisPool) {
      try {
        if (client.isReady) {
          await client.ping();
          healthyClients.push(client);
        }
      } catch (error) {
        console.warn('Unhealthy Redis client detected, removing from pool:', error);
        try {
          await client.disconnect();
        } catch (disconnectError) {
          console.error('Failed to disconnect unhealthy client:', disconnectError);
        }
      }
    }
    
    this.redisPool = healthyClients;
    
    // 最小接続数を維持
    if (this.redisPool.length < this.poolConfig.min) {
      await this.replenishRedisPool();
    }
  }

  /**
   * 新規: Redisプール補充
   */
  private async replenishRedisPool(): Promise<void> {
    const needed = this.poolConfig.min - this.redisPool.length;
    
    for (let i = 0; i < needed; i++) {
      try {
        const client = createClient({ url: this.config.redis.url });
        await client.connect();
        this.redisPool.push(client);
      } catch (error) {
        console.error('Failed to replenish Redis pool:', error);
        break;
      }
    }
  }

  /**
   * 新規: 圧縮統計更新
   */
  private updateCompressionStats(): void {
    if (this.compressionStats.compressed + this.compressionStats.uncompressed > 0) {
      this.compressionStats.ratio = 
        this.compressionStats.compressed / 
        (this.compressionStats.compressed + this.compressionStats.uncompressed);
    }
  }

  /**
   * キャッシュからデータ取得
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = this.generateCacheKey(key);
    
    try {
      // 1. メモリキャッシュから取得
      if (!options.skipMemory) {
        const memoryResult = await this.getFromMemory<T>(cacheKey);
        if (memoryResult !== null) {
          this.metrics.hits++;
          this.updateMetrics();
          return memoryResult;
        }
      }

      // 2. Redisキャッシュから取得
      if (!options.skipRedis && this.redisClient) {
        const redisResult = await this.getFromRedis<T>(cacheKey);
        if (redisResult !== null) {
          // メモリキャッシュにも保存
          if (!options.skipMemory) {
            await this.setToMemory(cacheKey, redisResult, options.ttl || this.config.memory.ttl_seconds);
          }
          this.metrics.hits++;
          this.updateMetrics();
          return redisResult;
        }
      }

      // 3. ディスクキャッシュから取得
      if (!options.skipDisk) {
        const diskResult = await this.getFromDisk<T>(cacheKey);
        if (diskResult !== null) {
          // 上位キャッシュにも保存
          if (!options.skipRedis && this.redisClient) {
            await this.setToRedis(cacheKey, diskResult, options.ttl || this.config.redis.ttl_seconds);
          }
          if (!options.skipMemory) {
            await this.setToMemory(cacheKey, diskResult, options.ttl || this.config.memory.ttl_seconds);
          }
          this.metrics.hits++;
          this.updateMetrics();
          return diskResult;
        }
      }

      this.metrics.misses++;
      this.updateMetrics();
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.metrics.misses++;
      this.updateMetrics();
      return null;
    }
  }

  /**
   * キャッシュにデータ設定
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = this.generateCacheKey(key);
    
    try {
      let success = true;

      // メモリキャッシュに保存
      if (!options.skipMemory) {
        success = await this.setToMemory(cacheKey, data, options.ttl || this.config.memory.ttl_seconds) && success;
      }

      // Redisキャッシュに保存
      if (!options.skipRedis && this.redisClient) {
        success = await this.setToRedis(cacheKey, data, options.ttl || this.config.redis.ttl_seconds) && success;
      }

      // ディスクキャッシュに保存
      if (!options.skipDisk) {
        success = await this.setToDisk(cacheKey, data, options.ttl || this.config.disk.ttl_days * 24 * 60 * 60, options.compress) && success;
      }

      if (success) {
        this.metrics.sets++;
        this.updateMetrics();
      }

      return success;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * メモリキャッシュから取得
   */
  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (entry && this.isValidEntry(entry)) {
      return entry.data as T;
    }
    return null;
  }

  /**
   * メモリキャッシュに設定
   */
  private async setToMemory<T>(key: string, data: T, ttlSeconds: number): Promise<boolean> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      };
      this.memoryCache.set(key, entry);
      return true;
    } catch (error) {
      console.error('Memory cache set error:', error);
      return false;
    }
  }

  /**
   * Redisキャッシュから取得
   */
  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const redisKey = `${this.config.redis.key_prefix}${key}`;
      const result = await this.redisClient.get(redisKey);
      if (result) {
        const entry: CacheEntry<T> = JSON.parse(result);
        if (this.isValidEntry(entry)) {
          return entry.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * Redisキャッシュに設定
   */
  private async setToRedis<T>(key: string, data: T, ttlSeconds: number): Promise<boolean> {
    if (!this.redisClient) return false;

    try {
      const redisKey = `${this.config.redis.key_prefix}${key}`;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      };
      await this.redisClient.setEx(redisKey, ttlSeconds, JSON.stringify(entry));
      return true;
    } catch (error) {
      console.error('Redis cache set error:', error);
      return false;
    }
  }

  /**
   * ディスクキャッシュから取得
   */
  private async getFromDisk<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getDiskCacheFilePath(key);
      if (await fs.pathExists(filePath)) {
        const fileData = await fs.readFile(filePath);
        
        // まず文字列としてパース試行（圧縮判定のため）
        let dataString: string;
        try {
          // gzipかどうか判定（gzipヘッダーチェック）
          if (fileData[0] === 0x1f && fileData[1] === 0x8b) {
            dataString = gunzipSync(fileData).toString();
          } else {
            dataString = fileData.toString();
          }
        } catch {
          dataString = fileData.toString();
        }
        
        const entry: CacheEntry<T> = JSON.parse(dataString);
        
        if (this.isValidEntry(entry)) {
          return entry.data;
        } else {
          // 期限切れファイルを削除
          await fs.remove(filePath);
        }
      }
      return null;
    } catch (error) {
      console.error('Disk cache get error:', error);
      return null;
    }
  }

  /**
   * ディスクキャッシュに設定
   */
  private async setToDisk<T>(key: string, data: T, ttlSeconds: number, compress = true): Promise<boolean> {
    try {
      const filePath = this.getDiskCacheFilePath(key);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000,
        compressed: compress
      };

      let fileData: Buffer;
      if (compress && this.config.disk.compression) {
        fileData = gzipSync(JSON.stringify(entry));
      } else {
        fileData = Buffer.from(JSON.stringify(entry));
      }

      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, fileData);
      return true;
    } catch (error) {
      console.error('Disk cache set error:', error);
      return false;
    }
  }

  /**
   * エントリの有効性チェック
   */
  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < entry.ttl;
  }

  /**
   * キャッシュキー生成
   */
  private generateCacheKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * ディスクキャッシュファイルパス取得
   */
  private getDiskCacheFilePath(key: string): string {
    const hashedKey = this.generateCacheKey(key);
    const dir = hashedKey.substring(0, 2);
    const file = hashedKey.substring(2);
    return path.join(this.diskCachePath, dir, `${file}.cache`);
  }

  /**
   * メトリクス更新
   */
  private updateMetrics(): void {
    this.metrics.memoryUsage = this.memoryCache.calculatedSize || 0;
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
  }

  /**
   * メトリクス取得
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 期限切れエントリクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      // ディスクキャッシュクリーンアップ
      await this.cleanupDiskCache();
      
      // Redisは自動期限切れを使用
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * ディスクキャッシュクリーンアップ
   */
  private async cleanupDiskCache(): Promise<void> {
    try {
      const files = await this.getAllDiskCacheFiles();
      let cleanedCount = 0;

      for (const filePath of files) {
        try {
          const fileData = await fs.readFile(filePath);
          
          // 圧縮判定とデータ展開
          let dataString: string;
          try {
            if (fileData[0] === 0x1f && fileData[1] === 0x8b) {
              dataString = gunzipSync(fileData).toString();
            } else {
              dataString = fileData.toString();
            }
          } catch {
            dataString = fileData.toString();
          }
          
          const entry: CacheEntry = JSON.parse(dataString);

          if (!this.isValidEntry(entry)) {
            await fs.remove(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // 破損ファイルを削除
          await fs.remove(filePath);
          cleanedCount++;
        }
      }

      console.log(`Cleaned up ${cleanedCount} expired disk cache files`);
    } catch (error) {
      console.error('Disk cache cleanup error:', error);
    }
  }

  /**
   * 全ディスクキャッシュファイル取得
   */
  private async getAllDiskCacheFiles(): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const dirs = await fs.readdir(this.diskCachePath);
      
      for (const dir of dirs) {
        const dirPath = path.join(this.diskCachePath, dir);
        if ((await fs.stat(dirPath)).isDirectory()) {
          const dirFiles = await fs.readdir(dirPath);
          for (const file of dirFiles) {
            if (file.endsWith('.cache')) {
              files.push(path.join(dirPath, file));
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to get disk cache files:', error);
    }

    return files;
  }

  /**
   * キャッシュクリア
   */
  async clear(): Promise<void> {
    try {
      // メモリキャッシュクリア
      this.memoryCache.clear();

      // Redisキャッシュクリア
      if (this.redisClient) {
        const keys = await this.redisClient.keys(`${this.config.redis.key_prefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      }

      // ディスクキャッシュクリア
      await fs.emptyDir(this.diskCachePath);

      console.log('All caches cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * 終了処理
   */
  async destroy(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      console.log('CacheManager destroyed');
    } catch (error) {
      console.error('Cache destroy error:', error);
    }
  }
} 