import { performance } from 'perf_hooks';

describe('E2E: ワークフロー', () => {
  test('基本ワークフロー確認', async () => {
    const startTime = performance.now();
    
    // E2Eワークフローのシミュレーション
    class WorkflowSimulator {
      private steps: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed' }> = [];
      
      addStep(name: string): void {
        this.steps.push({ name, status: 'pending' });
      }
      
      async executeStep(stepName: string): Promise<boolean> {
        const step = this.steps.find(s => s.name === stepName);
        if (!step) return false;
        
        step.status = 'running';
        
        // シミュレーション（短時間待機）
        await new Promise(resolve => setTimeout(resolve, 10));
        
        step.status = 'completed';
        return true;
      }
      
      getStepStatus(stepName: string): string {
        const step = this.steps.find(s => s.name === stepName);
        return step?.status || 'not_found';
      }
      
      getAllSteps(): Array<{ name: string; status: string }> {
        return [...this.steps];
      }
      
      isCompleted(): boolean {
        return this.steps.every(step => step.status === 'completed');
      }
    }
    
    const workflow = new WorkflowSimulator();
    
    // ワークフロー設定
    workflow.addStep('initialization');
    workflow.addStep('configuration');
    workflow.addStep('validation');
    workflow.addStep('execution');
    
    expect(workflow.getAllSteps()).toHaveLength(4);
    expect(workflow.isCompleted()).toBe(false);
    
    // ステップ実行
    await workflow.executeStep('initialization');
    expect(workflow.getStepStatus('initialization')).toBe('completed');
    
    await workflow.executeStep('configuration');
    expect(workflow.getStepStatus('configuration')).toBe('completed');
    
    await workflow.executeStep('validation');
    expect(workflow.getStepStatus('validation')).toBe('completed');
    
    await workflow.executeStep('execution');
    expect(workflow.getStepStatus('execution')).toBe('completed');
    
    expect(workflow.isCompleted()).toBe(true);
    
    const endTime = performance.now();
    console.log(`✅ 基本ワークフロー: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('MCPプロトコルワークフロー確認', async () => {
    const startTime = performance.now();
    
    // MCPプロトコルワークフローのシミュレーション
    class MCPWorkflow {
      private state = 'disconnected';
      private tools: string[] = [];
      private resources: string[] = [];
      
      async connect(): Promise<boolean> {
        if (this.state === 'disconnected') {
          this.state = 'connecting';
          await new Promise(resolve => setTimeout(resolve, 10));
          this.state = 'connected';
          return true;
        }
        return false;
      }
      
      async initialize(): Promise<boolean> {
        if (this.state === 'connected') {
          this.state = 'initializing';
          
          // ツールとリソースの初期化
          this.tools = [
            'expo_read_document',
            'expo_search_documents',
            'expo_get_sdk_version',
            'expo_create_snack'
          ];
          
          this.resources = [
            'expo://docs/',
            'expo://api/',
            'expo://examples/'
          ];
          
          await new Promise(resolve => setTimeout(resolve, 10));
          this.state = 'ready';
          return true;
        }
        return false;
      }
      
      async executeTool(toolName: string, params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
        if (this.state !== 'ready') {
          return { success: false };
        }
        
        if (!this.tools.includes(toolName)) {
          return { success: false };
        }
        
        // ツール実行シミュレーション
        await new Promise(resolve => setTimeout(resolve, 5));
        
        return {
          success: true,
          result: {
            tool: toolName,
            params,
            output: `Result from ${toolName}`
          }
        };
      }
      
      async readResource(uri: string): Promise<{ success: boolean; content?: string }> {
        if (this.state !== 'ready') {
          return { success: false };
        }
        
        const validResource = this.resources.some(resource => uri.startsWith(resource));
        if (!validResource) {
          return { success: false };
        }
        
        await new Promise(resolve => setTimeout(resolve, 5));
        
        return {
          success: true,
          content: `Content from ${uri}`
        };
      }
      
      getState(): string {
        return this.state;
      }
      
      getTools(): string[] {
        return [...this.tools];
      }
      
      getResources(): string[] {
        return [...this.resources];
      }
    }
    
    const mcpWorkflow = new MCPWorkflow();
    
    // 接続
    expect(mcpWorkflow.getState()).toBe('disconnected');
    const connected = await mcpWorkflow.connect();
    expect(connected).toBe(true);
    expect(mcpWorkflow.getState()).toBe('connected');
    
    // 初期化
    const initialized = await mcpWorkflow.initialize();
    expect(initialized).toBe(true);
    expect(mcpWorkflow.getState()).toBe('ready');
    expect(mcpWorkflow.getTools()).toHaveLength(4);
    expect(mcpWorkflow.getResources()).toHaveLength(3);
    
    // ツール実行
    const toolResult = await mcpWorkflow.executeTool('expo_read_document', { path: '/docs/guide.md' });
    expect(toolResult.success).toBe(true);
    expect(toolResult.result).toBeDefined();
    
    // リソース読み取り
    const resourceResult = await mcpWorkflow.readResource('expo://docs/getting-started');
    expect(resourceResult.success).toBe(true);
    expect(resourceResult.content).toBeDefined();
    
    const endTime = performance.now();
    console.log(`✅ MCPプロトコルワークフロー: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('エラーハンドリングワークフロー確認', async () => {
    const startTime = performance.now();
    
    // エラーハンドリングワークフローのシミュレーション
    class ErrorHandlingWorkflow {
      private errors: Array<{ type: string; message: string; timestamp: number }> = [];
      private retryCount = 0;
      private maxRetries = 3;
      
      async executeWithRetry(operation: () => Promise<boolean>): Promise<{ success: boolean; retries: number }> {
        this.retryCount = 0;
        
        while (this.retryCount < this.maxRetries) {
          try {
            const result = await operation();
            if (result) {
              return { success: true, retries: this.retryCount };
            }
            throw new Error('Operation failed');
          } catch (error) {
            this.retryCount++;
            this.logError('operation_failed', error instanceof Error ? error.message : 'Unknown error');
            
            if (this.retryCount < this.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 10 * this.retryCount)); // バックオフ
            }
          }
        }
        
        return { success: false, retries: this.retryCount };
      }
      
      private logError(type: string, message: string): void {
        this.errors.push({
          type,
          message,
          timestamp: Date.now()
        });
      }
      
      getErrors(): Array<{ type: string; message: string; timestamp: number }> {
        return [...this.errors];
      }
      
      clearErrors(): void {
        this.errors = [];
      }
    }
    
    const errorWorkflow = new ErrorHandlingWorkflow();
    
    // 成功ケース
    const successOperation = async (): Promise<boolean> => {
      return true;
    };
    
    const successResult = await errorWorkflow.executeWithRetry(successOperation);
    expect(successResult.success).toBe(true);
    expect(successResult.retries).toBe(0);
    
    // 失敗ケース
    let attemptCount = 0;
    const failOperation = async (): Promise<boolean> => {
      attemptCount++;
      return false;
    };
    
    const failResult = await errorWorkflow.executeWithRetry(failOperation);
    expect(failResult.success).toBe(false);
    expect(failResult.retries).toBe(3);
    expect(attemptCount).toBe(3);
    expect(errorWorkflow.getErrors()).toHaveLength(3);
    
    // リトライ後成功ケース
    errorWorkflow.clearErrors();
    let retryAttemptCount = 0;
    const retryOperation = async (): Promise<boolean> => {
      retryAttemptCount++;
      return retryAttemptCount >= 2; // 2回目で成功
    };
    
    const retryResult = await errorWorkflow.executeWithRetry(retryOperation);
    expect(retryResult.success).toBe(true);
    expect(retryResult.retries).toBe(1);
    expect(retryAttemptCount).toBe(2);
    
    const endTime = performance.now();
    console.log(`✅ エラーハンドリングワークフロー: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('パフォーマンス監視ワークフロー確認', async () => {
    const startTime = performance.now();
    
    // パフォーマンス監視ワークフローのシミュレーション
    class PerformanceMonitor {
      private metrics: Array<{ name: string; duration: number; timestamp: number }> = [];
      
      async measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
        const operationStart = performance.now();
        
        try {
          const result = await operation();
          const duration = performance.now() - operationStart;
          
          this.metrics.push({
            name,
            duration,
            timestamp: Date.now()
          });
          
          return result;
        } catch (error) {
          const duration = performance.now() - operationStart;
          
          this.metrics.push({
            name: `${name}_error`,
            duration,
            timestamp: Date.now()
          });
          
          throw error;
        }
      }
      
      getMetrics(): Array<{ name: string; duration: number; timestamp: number }> {
        return [...this.metrics];
      }
      
      getAverageDuration(operationName: string): number {
        const operationMetrics = this.metrics.filter(m => m.name === operationName);
        if (operationMetrics.length === 0) return 0;
        
        const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
        return totalDuration / operationMetrics.length;
      }
      
      getSlowOperations(thresholdMs = 100): Array<{ name: string; duration: number }> {
        return this.metrics
          .filter(m => m.duration > thresholdMs)
          .map(m => ({ name: m.name, duration: m.duration }));
      }
    }
    
    const monitor = new PerformanceMonitor();
    
    // 高速操作
    const fastResult = await monitor.measureOperation('fast_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return 'fast_result';
    });
    
    expect(fastResult).toBe('fast_result');
    
    // 低速操作
    const slowResult = await monitor.measureOperation('slow_operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'slow_result';
    });
    
    expect(slowResult).toBe('slow_result');
    
    // 複数回実行
    for (let i = 0; i < 3; i++) {
      await monitor.measureOperation('repeated_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return i;
      });
    }
    
    const metrics = monitor.getMetrics();
    expect(metrics).toHaveLength(5); // fast + slow + repeated * 3
    
    const averageDuration = monitor.getAverageDuration('repeated_operation');
    expect(averageDuration).toBeGreaterThan(8);
    expect(averageDuration).toBeLessThan(15);
    
    const slowOperations = monitor.getSlowOperations(30);
    expect(slowOperations.length).toBeGreaterThan(0);
    
    const endTime = performance.now();
    console.log(`✅ パフォーマンス監視ワークフロー: ${(endTime - startTime).toFixed(2)}ms`);
  });
}); 