import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as os from 'os';
import { EventEmitter } from 'events';

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

export class ConcurrentProcessor extends EventEmitter {
  private workers: Map<number, Worker> = new Map();
  private taskQueue: TaskData[] = [];
  private activeTasks: Map<string, { worker: Worker; startTime: number }> = new Map();
  private pendingCallbacks: Map<string, { resolve: Function; reject: Function }> = new Map();
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
    
    const worker = new Worker(__filename, {
      workerData: {
        workerId,
        config: this.config
      }
    });

    worker.on('message', (result: TaskResult) => {
      this.handleTaskResult(result);
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
    for (const [workerId, worker] of this.workers) {
      const isAvailable = ![...this.activeTasks.values()]
        .some(task => task.worker === worker);
      
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
    for (const [taskId, task] of this.activeTasks) {
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

// ワーカーコード（このファイルがワーカーとして実行された場合）
if (!isMainThread && parentPort) {
  const { workerId, config } = workerData;
  
  parentPort.on('message', async (task: TaskData) => {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (task.type) {
        case 'search':
          result = await processSearchTask(task.payload);
          break;
        case 'sdk_fetch':
          result = await processSDKFetchTask(task.payload);
          break;
        case 'config_gen':
          result = await processConfigGenTask(task.payload);
          break;
        case 'document_parse':
          result = await processDocumentParseTask(task.payload);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const taskResult: TaskResult = {
        id: task.id,
        success: true,
        data: result,
        duration: Date.now() - startTime
      };
      
      parentPort!.postMessage(taskResult);
    } catch (error) {
      const taskResult: TaskResult = {
        id: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
      
      parentPort!.postMessage(taskResult);
    }
  });
}

// ワーカータスク実装
async function processSearchTask(payload: any): Promise<any> {
  // 実際の検索処理を実装
  // この例では簡単なモックを返す
  await new Promise(resolve => setTimeout(resolve, 100));
  return {
    query: payload.query,
    results: [`Result for ${payload.query}`, `Another result for ${payload.query}`]
  };
}

async function processSDKFetchTask(payload: any): Promise<any> {
  // 実際のSDK取得処理を実装
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    module: payload.module,
    version: 'latest',
    description: `Module ${payload.module} information`
  };
}

async function processConfigGenTask(payload: any): Promise<any> {
  // 設定生成処理を実装
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    config: `Generated config for ${payload.type}`,
    valid: true
  };
}

async function processDocumentParseTask(payload: any): Promise<any> {
  // ドキュメント解析処理を実装
  await new Promise(resolve => setTimeout(resolve, 150));
  return {
    parsed: true,
    content: `Parsed content from ${payload.source}`
  };
} 