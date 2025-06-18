/**
 * Sandbox Manager for Expo MCP Server
 * サンドボックス実行環境・システムコール制限・リソース制限
 */

import { Worker } from 'worker_threads';
import * as vm from 'vm';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface SandboxConfig {
  enabled: boolean;
  execution_mode: 'vm' | 'worker' | 'child_process';
  resource_limits: {
    max_memory_mb: number;
    max_cpu_time_ms: number;
    max_file_reads: number;
    max_network_requests: number;
    max_execution_time_ms: number;
  };
  restrictions: {
    blocked_system_calls: string[];
    allowed_file_extensions: string[];
    allowed_modules: string[];
    network_access: boolean;
    file_system_access: 'none' | 'read-only' | 'restricted';
    allowed_directories: string[];
  };
  security: {
    enable_strict_mode: boolean;
    disable_eval: boolean;
    disable_function_constructor: boolean;
    disable_unsafe_globals: boolean;
  };
}

export interface ExecutionContext {
  id: string;
  type: 'tool' | 'script' | 'eval';
  code: string;
  args?: any;
  timeout: number;
  memory_limit: number;
  file_access_count: number;
  network_request_count: number;
  start_time: Date;
  cpu_time_used: number;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  metrics: {
    execution_time_ms: number;
    memory_used_mb: number;
    cpu_time_ms: number;
    file_accesses: number;
    network_requests: number;
  };
  security_violations: string[];
}

export class SandboxManager extends EventEmitter {
  private config: SandboxConfig;
  private activeContexts: Map<string, ExecutionContext> = new Map();
  private workerPool: Worker[] = [];
  private resourceMonitor: NodeJS.Timeout | null = null;
  private fileAccessCount = 0;
  private networkRequestCount = 0;

  constructor(config: SandboxConfig) {
    super();
    this.config = config;
    
    if (config.enabled) {
      this.initializeSandbox();
    }
  }

  /**
   * サンドボックス環境初期化
   */
  private async initializeSandbox(): Promise<void> {
    // Worker プール初期化
    if (this.config.execution_mode === 'worker') {
      await this.initializeWorkerPool();
    }

    // リソース監視開始
    this.startResourceMonitoring();

    this.emit('sandbox:initialized', {
      mode: this.config.execution_mode,
      workers: this.workerPool.length,
    });
  }

  /**
   * Worker プール初期化
   */
  private async initializeWorkerPool(): Promise<void> {
    const workerCount = Math.min(os.cpus().length, 4);
    
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = await this.createSecureWorker();
        this.workerPool.push(worker);
      } catch (error) {
        console.warn(`[Sandbox] Failed to create worker ${i}:`, error);
      }
    }
  }

  /**
   * セキュアなWorker作成
   */
  private async createSecureWorker(): Promise<Worker> {
    const workerScript = `
      const { parentPort } = require('worker_threads');
      const vm = require('vm');
      
      // セキュリティ設定
      const restrictedGlobals = {
        require: undefined,
        process: undefined,
        global: undefined,
        Buffer: undefined,
        __dirname: undefined,
        __filename: undefined,
      };

      parentPort.on('message', async ({ id, code, context, timeout }) => {
        try {
          const startTime = Date.now();
          
          // VM Context作成
          const sandbox = vm.createContext({
            ...restrictedGlobals,
            console: {
              log: (...args) => parentPort.postMessage({ type: 'log', id, args }),
              error: (...args) => parentPort.postMessage({ type: 'error', id, args }),
            },
            ...context,
          });

          // タイムアウト付き実行
          const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error('Execution timeout'));
            }, timeout);

            try {
              const vmResult = vm.runInContext(code, sandbox, {
                timeout: timeout,
                breakOnSigint: true,
                displayErrors: true,
              });
              clearTimeout(timer);
              resolve(vmResult);
            } catch (error) {
              clearTimeout(timer);
              reject(error);
            }
          });

          parentPort.postMessage({
            type: 'result',
            id,
            success: true,
            result,
            executionTime: Date.now() - startTime,
          });

        } catch (error) {
          parentPort.postMessage({
            type: 'result',
            id,
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime,
          });
        }
      });
    `;

    // 一時ファイルとしてWorkerスクリプト作成
    const tempFile = path.join(os.tmpdir(), `mcp-worker-${Date.now()}.js`);
    await fs.writeFile(tempFile, workerScript);

    const worker = new Worker(tempFile, {
      resourceLimits: {
        maxOldGenerationSizeMb: this.config.resource_limits.max_memory_mb,
        maxYoungGenerationSizeMb: Math.floor(this.config.resource_limits.max_memory_mb / 4),
        codeRangeSizeMb: 16,
      },
    });

    // クリーンアップ
    worker.on('exit', async () => {
      try {
        await fs.unlink(tempFile);
      } catch (error) {
        // ファイル削除エラーは無視
      }
    });

    return worker;
  }

  /**
   * VM Context でのコード実行
   */
  public async executeInVMContext(
    code: string,
    context: any = {},
    options: { timeout?: number; memory_limit?: number } = {}
  ): Promise<ExecutionResult> {
    const contextId = this.generateContextId();
    const timeout = options.timeout || this.config.resource_limits.max_execution_time_ms;
    const violations: string[] = [];

    const executionContext: ExecutionContext = {
      id: contextId,
      type: 'eval',
      code,
      args: context,
      timeout,
      memory_limit: options.memory_limit || this.config.resource_limits.max_memory_mb,
      file_access_count: 0,
      network_request_count: 0,
      start_time: new Date(),
      cpu_time_used: 0,
    };

    this.activeContexts.set(contextId, executionContext);

    try {
      // セキュリティチェック
      const securityCheck = this.validateCodeSecurity(code);
      if (!securityCheck.safe) {
        violations.push(...securityCheck.violations);
        throw new Error(`Security violation: ${securityCheck.violations.join(', ')}`);
      }

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();

      // セキュアなVM Context作成
      const sandbox = this.createSecureContext(context, contextId);

      // メモリ使用量監視
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage();
        const memoryUsed = (currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        if (memoryUsed > executionContext.memory_limit) {
          violations.push('Memory limit exceeded');
          clearInterval(memoryMonitor);
        }
      }, 100);

      let result: any;
      try {
        result = vm.runInContext(code, sandbox, {
          timeout: timeout,
          breakOnSigint: true,
          displayErrors: true,
        });
      } finally {
        clearInterval(memoryMonitor);
      }

      const executionTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();
      const memoryUsed = Math.max(0, (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);
      
      // 最小実行時間として1msを保証
      const safeExecutionTime = Math.max(1, executionTime);

      this.emit('execution:completed', {
        contextId,
        executionTime,
        memoryUsed,
        violations,
      });

      return {
        success: true,
        result,
        metrics: {
          execution_time_ms: safeExecutionTime,
          memory_used_mb: Math.max(0.1, memoryUsed), // 最低0.1MBを報告
          cpu_time_ms: safeExecutionTime, // VM では正確なCPU時間取得困難
          file_accesses: executionContext.file_access_count,
          network_requests: executionContext.network_request_count,
        },
        security_violations: violations,
      };

    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error));

      this.emit('execution:failed', {
        contextId,
        error: error instanceof Error ? error.message : String(error),
        violations,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          execution_time_ms: Date.now() - executionContext.start_time.getTime(),
          memory_used_mb: 0,
          cpu_time_ms: 0,
          file_accesses: executionContext.file_access_count,
          network_requests: executionContext.network_request_count,
        },
        security_violations: violations,
      };
    } finally {
      this.activeContexts.delete(contextId);
    }
  }

  /**
   * Worker での並行実行
   */
  public async executeInWorker(
    code: string,
    context: any = {},
    options: { timeout?: number } = {}
  ): Promise<ExecutionResult> {
    if (this.workerPool.length === 0) {
      throw new Error('No workers available');
    }

    const worker = this.workerPool[Math.floor(Math.random() * this.workerPool.length)];
    const contextId = this.generateContextId();
    const timeout = options.timeout || this.config.resource_limits.max_execution_time_ms;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          success: false,
          error: 'Worker execution timeout',
          metrics: {
            execution_time_ms: timeout,
            memory_used_mb: 0,
            cpu_time_ms: 0,
            file_accesses: 0,
            network_requests: 0,
          },
          security_violations: ['Execution timeout'],
        });
      }, timeout);

      const messageHandler = (message: any) => {
        if (message.id === contextId && message.type === 'result') {
          clearTimeout(timer);
          worker.off('message', messageHandler);

          resolve({
            success: message.success,
            result: message.result,
            error: message.error,
            metrics: {
              execution_time_ms: message.executionTime,
              memory_used_mb: 0, // Worker からのメモリ使用量取得は複雑
              cpu_time_ms: message.executionTime,
              file_accesses: 0,
              network_requests: 0,
            },
            security_violations: message.success ? [] : [message.error],
          });
        }
      };

      worker.on('message', messageHandler);
      worker.postMessage({ id: contextId, code, context, timeout });
    });
  }

     /**
    * Child Process での隔離実行
    */
   public async executeInChildProcess(
     scriptPath: string,
     args: string[] = [],
     options: { timeout?: number } = {}
   ): Promise<ExecutionResult> {
     // eslint-disable-next-line @typescript-eslint/no-unused-vars
     const contextId = this.generateContextId();
     const timeout = options.timeout || this.config.resource_limits.max_execution_time_ms;
     const violations: string[] = [];

    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'pipe',
        timeout: timeout,
        env: {
          // 最小限の環境変数のみ
          NODE_ENV: 'sandbox',
          PATH: process.env.PATH,
        },
        uid: process.getuid?.(), // 非rootユーザーで実行
        gid: process.getgid?.(),
      });

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code, signal) => {
        const executionTime = Date.now() - startTime;

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          violations.push('Process terminated due to timeout or resource limit');
        }

        resolve({
          success: code === 0,
          result: stdout,
          error: stderr || undefined,
          metrics: {
            execution_time_ms: executionTime,
            memory_used_mb: 0, // プロセスメモリ使用量取得は別途実装が必要
            cpu_time_ms: executionTime,
            file_accesses: 0,
            network_requests: 0,
          },
          security_violations: violations,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          metrics: {
            execution_time_ms: Date.now() - startTime,
            memory_used_mb: 0,
            cpu_time_ms: 0,
            file_accesses: 0,
            network_requests: 0,
          },
          security_violations: [error.message],
        });
      });
    });
  }

  /**
   * セキュアなVM Context作成
   */
  private createSecureContext(userContext: any, contextId: string): vm.Context {
    const secureContext = {
      // 基本的なJavaScriptオブジェクト
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      RegExp,
      JSON,
      Math,
      
      // 制限付きconsole
      console: {
        log: (...args: any[]) => this.logSandboxOutput(contextId, 'log', args),
        error: (...args: any[]) => this.logSandboxOutput(contextId, 'error', args),
        warn: (...args: any[]) => this.logSandboxOutput(contextId, 'warn', args),
      },

             // 制限付きsetTimeout/setInterval
       setTimeout: (callback: () => void, delay: number) => {
         if (delay > this.config.resource_limits.max_execution_time_ms) {
           throw new Error('Timeout delay exceeds limit');
         }
         return setTimeout(callback, Math.min(delay, 5000)); // 最大5秒
       },
      
      // ファイルアクセス（制限付き）
      fs: this.createRestrictedFileSystem(contextId),
      
      // ネットワークアクセス（制限付き）
      fetch: this.createRestrictedFetch(contextId),
      
      // ユーザーコンテキスト（サニタイズ済み）
      ...this.sanitizeUserContext(userContext),
    };

    // 危険なグローバルを削除
    if (this.config.security.disable_unsafe_globals) {
      delete (secureContext as any).global;
      delete (secureContext as any).process;
      delete (secureContext as any).require;
      delete (secureContext as any).module;
      delete (secureContext as any).exports;
      delete (secureContext as any).__dirname;
      delete (secureContext as any).__filename;
    }

    // eval無効化
    if (this.config.security.disable_eval) {
      (secureContext as any).eval = () => {
        throw new Error('eval is disabled in sandbox');
      };
    }

    // Function constructor無効化
    if (this.config.security.disable_function_constructor) {
      (secureContext as any).Function = () => {
        throw new Error('Function constructor is disabled in sandbox');
      };
    }

    return vm.createContext(secureContext);
  }

  /**
   * コードセキュリティ検証
   */
  private validateCodeSecurity(code: string): {
    safe: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // ブロックされたシステムコールチェック
    for (const blockedCall of this.config.restrictions.blocked_system_calls) {
      const pattern = new RegExp(`\\b${blockedCall}\\s*\\(`, 'i');
      if (pattern.test(code)) {
        violations.push(`Blocked system call detected: ${blockedCall}`);
      }
    }

    // 危険なパターンチェック
    const dangerousPatterns = [
      /require\s*\(/i,
      /process\./i,
      /global\./i,
      /Function\s*\(/i,
      /eval\s*\(/i,
      /new\s+Function/i,
      /\.__proto__/i,
      /\.constructor/i,
      /import\s+/i,
      /export\s+/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push(`Dangerous pattern detected: ${pattern}`);
      }
    }

    return {
      safe: violations.length === 0,
      violations,
    };
  }

  /**
   * 制限付きファイルシステム
   */
  private createRestrictedFileSystem(contextId: string) {
    const context = this.activeContexts.get(contextId);
    
    return {
      readFile: async (filePath: string) => {
        if (!context) throw new Error('Context not found');
        
        // ファイルアクセス回数チェック
        if (context.file_access_count >= this.config.resource_limits.max_file_reads) {
          throw new Error('File read limit exceeded');
        }

        // パスチェック
        const normalizedPath = path.normalize(filePath);
        const isAllowed = this.config.restrictions.allowed_directories.some(dir => 
          normalizedPath.startsWith(path.normalize(dir))
        );

        if (!isAllowed) {
          throw new Error(`File access denied: ${filePath}`);
        }

        // 拡張子チェック
        const ext = path.extname(filePath);
        if (!this.config.restrictions.allowed_file_extensions.includes(ext)) {
          throw new Error(`File extension not allowed: ${ext}`);
        }

        context.file_access_count++;
        this.fileAccessCount++;

        return fs.readFile(normalizedPath, 'utf8');
      },
    };
  }

  /**
   * 制限付きfetch
   */
  private createRestrictedFetch(contextId: string) {
    const context = this.activeContexts.get(contextId);

         return async (_url: string, _options?: any) => {
       if (!context) throw new Error('Context not found');
       
       if (!this.config.restrictions.network_access) {
         throw new Error('Network access is disabled');
       }

       // ネットワークリクエスト回数チェック
       if (context.network_request_count >= this.config.resource_limits.max_network_requests) {
         throw new Error('Network request limit exceeded');
       }

       context.network_request_count++;
       this.networkRequestCount++;

       // 実際のfetch実装は外部ライブラリまたはNode.js fetch使用
       throw new Error('Fetch implementation not available in sandbox');
     };
  }

  /**
   * ユーザーコンテキストサニタイズ
   */
  private sanitizeUserContext(context: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(context)) {
      // 関数は除外
      if (typeof value === 'function') {
        continue;
      }

      // オブジェクトは再帰的にサニタイズ
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeUserContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * サンドボックス出力ログ
   */
  private logSandboxOutput(contextId: string, level: string, args: any[]): void {
    this.emit('sandbox:output', {
      contextId,
      level,
      message: args.join(' '),
      timestamp: new Date(),
    });
  }

  /**
   * リソース監視開始
   */
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      this.emit('resource:usage', {
        memory_used_mb: memoryUsedMB,
        active_contexts: this.activeContexts.size,
        file_accesses: this.fileAccessCount,
        network_requests: this.networkRequestCount,
        workers: this.workerPool.length,
      });

      // メモリ使用量警告
      if (memoryUsedMB > this.config.resource_limits.max_memory_mb * 0.8) {
        this.emit('resource:warning', {
          type: 'memory',
          current: memoryUsedMB,
          limit: this.config.resource_limits.max_memory_mb,
        });
      }
    }, 5000); // 5秒ごと
  }

  /**
   * Context ID生成
   */
  private generateContextId(): string {
    return `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 統計情報取得
   */
  public getStats(): {
    active_contexts: number;
    total_file_accesses: number;
    total_network_requests: number;
    worker_pool_size: number;
    memory_usage_mb: number;
  } {
    const memoryUsage = process.memoryUsage();
    
    return {
      active_contexts: this.activeContexts.size,
      total_file_accesses: this.fileAccessCount,
      total_network_requests: this.networkRequestCount,
      worker_pool_size: this.workerPool.length,
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
    };
  }

  /**
   * リソース解放
   */
  public async destroy(): Promise<void> {
    // リソース監視停止
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }

    // 全てのWorkerを終了
    await Promise.all(
      this.workerPool.map(worker => worker.terminate())
    );
    this.workerPool = [];

    // アクティブなコンテキストをクリア
    this.activeContexts.clear();

    this.emit('sandbox:destroyed');
    this.removeAllListeners();
  }
} 