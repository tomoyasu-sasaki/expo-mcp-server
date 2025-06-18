import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export interface TaskData {
  id: string;
  type: 'search' | 'sdk_fetch' | 'config_gen' | 'document_parse';
  payload: any;
  timeout?: number;
}

export interface TaskResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface WorkerPoolConfig {
  maxWorkers: number;
  maxQueueSize: number;
  taskTimeoutMs: number;
  workerTimeoutMs: number;
  enableGC: boolean;
}

type TaskCallback = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

export class ConcurrentProcessor extends EventEmitter {
  private workers: Map<number, Worker> = new Map();
  private taskQueue: TaskData[] = [];
  private activeTasks: Map<string, { worker: Worker; startTime: number }> = new Map();
  private pendingCallbacks: Map<string, TaskCallback> = new Map();
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private config: WorkerPoolConfig;
  private isInitialized = false;
  private nextWorkerId = 0;
  private stats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageExecutionTime: 0,
    currentQueueSize: 0,
    activeWorkers: 0
  };

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    super();
    
    this.config = {
      maxWorkers: config.maxWorkers || Math.min(os.cpus().length, 4),
      maxQueueSize: config.maxQueueSize || 200,
      taskTimeoutMs: config.taskTimeoutMs || 30000,
      workerTimeoutMs: config.workerTimeoutMs || 120000,
      enableGC: config.enableGC || true,
      ...config
    };
  }

  /**
   * ワーカープール初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 初期ワーカーを作成
      for (let i = 0; i < Math.min(this.config.maxWorkers, 2); i++) {
        await this.createWorker();
      }

      // 定期的なヘルスチェック開始
      this.startHealthCheck();
      
      this.isInitialized = true;
      console.log(`ConcurrentProcessor initialized with ${this.workers.size} workers`);
    } catch (error) {
      console.error('Failed to initialize ConcurrentProcessor:', error);
      throw error;
    }
  }

  /**
   * タスクを非同期実行
   */
  async executeTask<T = any>(taskData: Omit<TaskData, 'id'>): Promise<T> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // キューサイズチェック
    if (this.taskQueue.length >= this.config.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    const task: TaskData = {
      id: this.generateTaskId(),
      ...taskData
    };

    this.stats.totalTasks++;
    this.stats.currentQueueSize = this.taskQueue.length;

    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(task.id, { resolve, reject });
      this.taskQueue.push(task);
      
      // タスクタイムアウト設定
      const timeout = setTimeout(() => {
        this.handleTaskTimeout(task.id);
      }, task.timeout || this.config.taskTimeoutMs);
      
      this.taskTimeouts.set(task.id, timeout);

      // すぐに処理を試行
      this.processQueue();
    });
  }

  /**
   * バッチ処理実行
   */
  async executeBatch<T = any>(tasks: Array<Omit<TaskData, 'id'>>): Promise<T[]> {
    const promises = tasks.map(task => this.executeTask<T>(task));
    return Promise.all(promises);
  }

  /**
   * 並列検索実行（複数クエリ）
   */
  async executeParallelSearch(queries: string[]): Promise<any[]> {
    const tasks = queries.map(query => ({
      type: 'search' as const,
      payload: { query }
    }));
    
    return this.executeBatch(tasks);
  }

  /**
   * SDKモジュール並列取得
   */
  async fetchSDKModulesParallel(modules: string[]): Promise<any[]> {
    const tasks = modules.map(module => ({
      type: 'sdk_fetch' as const,
      payload: { module }
    }));
    
    return this.executeBatch(tasks);
  }

  /**
   * ワーカー作成
   */
  private async createWorker(): Promise<Worker> {
    const workerId = this.nextWorkerId++;
    
    try {
      // ワーカーファイルのパスを取得（例外が発生する可能性あり）
      const workerPath = this.getWorkerPath();
      
      // デバッグ用ログ
      console.log(`Creating worker ${workerId} with path: ${workerPath}`);
      
      const worker = new Worker(workerPath, {
        workerData: {
          workerId,
          config: this.config
        }
      });

      worker.on('message', (result: TaskResult | { type: string; workerId: number }) => {
        if ('type' in result && result.type === 'worker_ready') {
          console.log(`Worker ${result.workerId} is ready`);
        } else {
          this.handleTaskResult(result as TaskResult);
        }
      });

      worker.on('error', (error) => {
        console.error(`Worker ${workerId} error:`, error);
        this.removeWorker(workerId);
      });

      worker.on('exit', (code) => {
        console.log(`Worker ${workerId} exited with code ${code}`);
        this.removeWorker(workerId);
      });

      this.workers.set(workerId, worker);
      this.stats.activeWorkers = this.workers.size;
      
      return worker;
    } catch (error) {
      console.error(`Failed to create worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * ワーカーファイルのパスを取得
   */
  private getWorkerPath(): string {
    // Node.js Worker threadsはTypeScriptを直接実行できないため、
    // 常にコンパイル済みJavaScriptファイルのパスを返す
    
    let currentFileName: string;
    let currentDirName: string;
    
    try {
      // ESモジュール環境でimport.meta.urlが利用可能な場合
      if (typeof import.meta !== 'undefined' && import.meta.url) {
        currentFileName = fileURLToPath(import.meta.url);
        currentDirName = dirname(currentFileName);
      } else {
        // CommonJS環境での__filename/__dirnameの検出を試行
        throw new Error('ESM import.meta.url not available, trying CommonJS');
      }
    } catch {
                    // CommonJS環境での__filename/__dirnameを試行
       try {
         // CommonJS環境でのグローバル変数を動的に確認
         const globalThis = global as any;
         if (globalThis.__filename && globalThis.__dirname) {
           currentFileName = globalThis.__filename;
           currentDirName = globalThis.__dirname;
         } else {
           throw new Error('CommonJS __filename/__dirname not available');
         }
       } catch {
         // 最後のフォールバック: より堅牢なパス推測
         // 現在実行中のモジュールのパスを推測
         const stackTrace = new Error().stack;
         const callerMatch = stackTrace?.match(/at.*\((.+):(\d+):(\d+)\)/);
         
         if (callerMatch && callerMatch[1]) {
           currentFileName = callerMatch[1];
           currentDirName = dirname(currentFileName);
         } else {
           // 最終フォールバック: servicesディレクトリを推測
           currentFileName = 'unknown';
           currentDirName = path.join(process.cwd(), 'src', 'services');
         }
       }
    }
    
    // 実行時のファイル拡張子をチェック
    const currentFileExtension = path.extname(currentFileName);
    const isCompiledJS = currentFileExtension === '.js';
    
    // 複数の可能なパスを試行（優先順位順）
    const possiblePaths = [
      // 同じディレクトリ内（最優先 - 通常のコンパイル済み環境）
      path.join(currentDirName, 'concurrent-processor-worker.js'),
      // 現在のディレクトリがsrcの場合、distディレクトリの対応する場所
      currentDirName.includes('src/services') 
        ? path.join(currentDirName.replace('src/services', 'dist/services'), 'concurrent-processor-worker.js')
        : null,
      // プロジェクトルートからのdistパス
      path.join(process.cwd(), 'dist', 'services', 'concurrent-processor-worker.js'),
      // 開発環境でのsrcディレクトリからの相対パス（ビルドされたファイルを探す）
      path.join(process.cwd(), 'src', 'services', 'concurrent-processor-worker.js'),
      // NodeModulesやカスタムビルド出力の可能性
      path.resolve(process.cwd(), 'lib/services/concurrent-processor-worker.js'),
      path.resolve(process.cwd(), 'build/services/concurrent-processor-worker.js')
    ].filter(Boolean) as string[]; // nullを除外
    
    // 存在するパスを検索
    for (const workerPath of possiblePaths) {
      if (fs.existsSync(workerPath)) {
        console.log(`Found worker file at: ${workerPath}`);
        return workerPath;
      }
    }
    
    // すべてのパスで見つからない場合のエラー
    const pathList = possiblePaths.map(p => `  - ${p} (exists: ${fs.existsSync(p)})`).join('\n');
    const environmentInfo = isCompiledJS ? 'production/compiled' : 'development (ts-node)';
    
    throw new Error(
      `Worker file not found. Searched paths:\n${pathList}\n\n` +
      `Environment: ${environmentInfo}\n` +
      `Current file: ${currentFileName}\n` +
      `Current directory: ${currentDirName}\n` +
      `Process cwd: ${process.cwd()}\n\n` +
      'Troubleshooting steps:\n' +
      '1. Run "npm run build" to compile TypeScript files\n' +
      '2. Ensure the worker file exists in one of the searched locations\n' +
      '3. Check that the file is named "concurrent-processor-worker.js"\n' +
      '4. Verify that Node.js can access the file (permissions)\n' +
      '5. For development: ensure the compiled output directory structure matches src/'
    );
  }

  /**
   * キュー処理
   */
  private processQueue(): void {
    // 利用可能なワーカーがあるかチェック
    const availableWorker = this.findAvailableWorker();
    if (!availableWorker && this.workers.size < this.config.maxWorkers) {
      // 新しいワーカーを作成
      this.createWorker().then(() => this.processQueue());
      return;
    }

    if (!availableWorker || this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift()!;
    this.activeTasks.set(task.id, {
      worker: availableWorker,
      startTime: Date.now()
    });

    this.stats.currentQueueSize = this.taskQueue.length;
    
    availableWorker.postMessage(task);
  }

  /**
   * 利用可能なワーカーを検索
   */
  private findAvailableWorker(): Worker | null {
    const workers = Array.from(this.workers.values());
    for (const worker of workers) {
      const activeTasks = Array.from(this.activeTasks.values());
      const isAvailable = !activeTasks.some(task => task.worker === worker);
      
      if (isAvailable) {
        return worker;
      }
    }
    return null;
  }

  /**
   * タスク結果処理
   */
  private handleTaskResult(result: TaskResult): void {
    const callback = this.pendingCallbacks.get(result.id);
    const activeTask = this.activeTasks.get(result.id);
    const timeout = this.taskTimeouts.get(result.id);

    if (timeout) {
      clearTimeout(timeout);
      this.taskTimeouts.delete(result.id);
    }

    if (callback) {
      this.pendingCallbacks.delete(result.id);
      
      if (result.success) {
        this.stats.completedTasks++;
        callback.resolve(result.data);
      } else {
        this.stats.failedTasks++;
        callback.reject(new Error(result.error || 'Task failed'));
      }
    }

    if (activeTask) {
      this.activeTasks.delete(result.id);
      
      // 平均実行時間を更新
      const executionTime = result.duration;
      this.stats.averageExecutionTime = 
        (this.stats.averageExecutionTime * (this.stats.completedTasks - 1) + executionTime) / 
        this.stats.completedTasks;
    }

    // 次のタスクを処理
    this.processQueue();
  }

  /**
   * タスクタイムアウト処理
   */
  private handleTaskTimeout(taskId: string): void {
    const callback = this.pendingCallbacks.get(taskId);
    const activeTask = this.activeTasks.get(taskId);

    if (callback) {
      this.pendingCallbacks.delete(taskId);
      this.stats.failedTasks++;
      callback.reject(new Error('Task timeout'));
    }

    if (activeTask) {
      this.activeTasks.delete(taskId);
      // ワーカーが応答しない場合は再起動
      this.restartWorker(activeTask.worker);
    }

    this.taskTimeouts.delete(taskId);
  }

  /**
   * ワーカー削除
   */
  private removeWorker(workerId: number): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.workers.delete(workerId);
      this.stats.activeWorkers = this.workers.size;
      
      // 必要に応じて新しいワーカーを作成
      if (this.workers.size < 1) {
        this.createWorker();
      }
    }
  }

  /**
   * ワーカー再起動
   */
  private async restartWorker(worker: Worker): Promise<void> {
    try {
      await worker.terminate();
      await this.createWorker();
    } catch (error) {
      console.error('Failed to restart worker:', error);
    }
  }

  /**
   * ヘルスチェック開始
   */
  private startHealthCheck(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 30秒ごと
  }

  /**
   * ヘルスチェック実行
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    
    // 長時間実行中のタスクをチェック
    const activeTaskEntries = Array.from(this.activeTasks.entries());
    for (const [taskId, task] of activeTaskEntries) {
      if (now - task.startTime > this.config.workerTimeoutMs) {
        console.warn(`Long running task detected: ${taskId}`);
        this.handleTaskTimeout(taskId);
      }
    }

    // ワーカーの最小数を維持
    if (this.workers.size < 1) {
      await this.createWorker();
    }

    // GC実行（有効な場合）
    if (this.config.enableGC && global.gc) {
      global.gc();
    }
  }

  /**
   * タスクID生成
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 統計取得
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * 終了処理
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down ConcurrentProcessor...');
    
    // 全てのタイムアウトをクリア
    const timeouts = Array.from(this.taskTimeouts.values());
    for (const timeout of timeouts) {
      clearTimeout(timeout);
    }
    this.taskTimeouts.clear();
    
    // 全てのワーカーを終了
    const shutdownPromises = Array.from(this.workers.values()).map(worker => 
      worker.terminate()
    );
    
    await Promise.all(shutdownPromises);
    
    this.workers.clear();
    this.taskQueue.length = 0;
    this.activeTasks.clear();
    this.pendingCallbacks.clear();
    
    console.log('ConcurrentProcessor shutdown complete');
  }
}

 