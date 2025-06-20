import { performance } from 'perf_hooks';
import * as fs from 'fs';

describe('テスト環境セットアップ', () => {
  beforeAll(() => {
    console.log('🧪 テストスイート開始 - ' + new Date().toISOString());
  });

  afterAll(() => {
    console.log('✅ テストスイート完了 - ' + new Date().toISOString());
  });

  test('Node.js環境確認', () => {
    expect(process.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(Number(process.version.slice(1).split('.')[0])).toBeGreaterThanOrEqual(18);
    console.log('✅ Node.js バージョン:', process.version);
  });

  test('TypeScript設定確認', () => {
    const startTime = performance.now();
    const configFile = fs.readFileSync('./tsconfig.json', 'utf8');
    const config = JSON.parse(configFile);
    const endTime = performance.now();

    expect(config).toBeDefined();
    expect(config.compilerOptions).toBeDefined();
    expect(endTime - startTime).toBeLessThan(100); // 100ms以内

    console.log('✅ TypeScript設定読み込み:', `${(endTime - startTime).toFixed(2)}ms`);
  });

  test('Jest環境確認', () => {
    expect(jest).toBeDefined();
    expect(expect).toBeDefined();
    expect(describe).toBeDefined();
    expect(test).toBeDefined();

    console.log('✅ Jest環境正常動作確認');
  });
}); 