import { performance } from 'perf_hooks';

describe('Performance: 基本性能確認', () => {
  test('メモリ使用量確認', () => {
    const startTime = performance.now();
    const memBefore = process.memoryUsage();
    
    // 軽い処理を実行
    const testArray = new Array(1000).fill(0).map((_, i) => i);
    const sum = testArray.reduce((a, b) => a + b, 0);
    
    const memAfter = process.memoryUsage();
    const endTime = performance.now();
    
    expect(sum).toBe(499500); // 0+1+2+...+999の和
    expect(memAfter.heapUsed).toBeGreaterThan(memBefore.heapUsed);
    
    const memUsedMB = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    const executionTime = endTime - startTime;
    
    console.log(`✅ メモリ使用量: +${memUsedMB.toFixed(2)}MB, 実行時間: ${executionTime.toFixed(2)}ms`);
    
    // パフォーマンス要件チェック
    expect(executionTime).toBeLessThan(100); // 100ms以内
    expect(memUsedMB).toBeLessThan(10); // 10MB以内
  });

  test('CPU使用時間測定', () => {
    const startTime = performance.now();
    const cpuBefore = process.cpuUsage();
    
    // CPU集約的な処理
    let result = 0;
    for (let i = 0; i < 10000; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    
    const cpuAfter = process.cpuUsage(cpuBefore);
    const endTime = performance.now();
    
    const cpuTimeMs = (cpuAfter.user + cpuAfter.system) / 1000; // マイクロ秒→ミリ秒
    const wallTimeMs = endTime - startTime;
    
    console.log(`✅ CPU時間: ${cpuTimeMs.toFixed(2)}ms, 経過時間: ${wallTimeMs.toFixed(2)}ms`);
    console.log(`✅ 計算結果: ${result.toFixed(2)}`);
    
    expect(result).toBeGreaterThan(0);
    expect(cpuTimeMs).toBeLessThan(1000); // 1秒以内
    expect(wallTimeMs).toBeLessThan(1000); // 1秒以内
  });

  test('レスポンス時間ベンチマーク', async () => {
    const iterations = 100;
    const responseTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      // 非同期処理のシミュレーション
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const endTime = performance.now();
      responseTimes.push(endTime - startTime);
    }
    
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`✅ 平均レスポンス時間: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`✅ 最小/最大: ${minResponseTime.toFixed(2)}ms / ${maxResponseTime.toFixed(2)}ms`);
    
    // パフォーマンス要件
    expect(avgResponseTime).toBeLessThan(50); // 平均50ms以内
    expect(maxResponseTime).toBeLessThan(100); // 最大100ms以内
  });

  test('並行処理性能', async () => {
    const concurrency = 10;
    const startTime = performance.now();
    
    // 並行処理のシミュレーション
    const promises = Array(concurrency).fill(0).map(async (_, index) => {
      const taskStart = performance.now();
      
      // 各タスクで軽い処理
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
      
      const taskEnd = performance.now();
      return {
        taskId: index,
        duration: taskEnd - taskStart
      };
    });
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    const avgTaskTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log(`✅ 並行処理 ${concurrency}タスク: 総時間 ${totalTime.toFixed(2)}ms`);
    console.log(`✅ 平均タスク時間: ${avgTaskTime.toFixed(2)}ms`);
    
    expect(results).toHaveLength(concurrency);
    expect(totalTime).toBeLessThan(500); // 500ms以内
    expect(avgTaskTime).toBeLessThan(100); // 平均100ms以内
  });
}); 