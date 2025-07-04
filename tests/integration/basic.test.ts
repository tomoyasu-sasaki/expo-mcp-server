import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration: 基本動作確認', () => {
  test('プロジェクト構造確認', () => {
    const startTime = performance.now();
    
    // 重要なファイルの存在確認
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/mcp/server.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
    
    const endTime = performance.now();
    console.log(`✅ プロジェクト構造確認: ${(endTime - startTime).toFixed(2)}ms`);
  });

  test('package.json設定確認', () => {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    expect(packageJson.name).toBe('expo-mcp-server');
    expect(packageJson.version).toBeDefined();
    expect(packageJson.main).toBeDefined();
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.dependencies).toBeDefined();
    
    console.log('✅ package.json設定確認完了');
  });

  test('TypeScript設定確認', () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
    const tsconfig = JSON.parse(tsconfigContent);
    
    expect(tsconfig.compilerOptions).toBeDefined();
    expect(tsconfig.compilerOptions.target).toBeDefined();
    expect(tsconfig.compilerOptions.module).toBeDefined();
    expect(tsconfig.compilerOptions.outDir).toBeDefined();
    
    console.log('✅ TypeScript設定確認完了');
  });

  test('ビルド成果物確認', () => {
    const distPath = path.join(process.cwd(), 'dist');
    
    if (fs.existsSync(distPath)) {
      const distFiles = fs.readdirSync(distPath);
      expect(distFiles.length).toBeGreaterThan(0);
      console.log('✅ ビルド成果物確認:', distFiles.length, 'ファイル');
    } else {
      console.log('⚠️ dist ディレクトリが存在しません（ビルド未実行）');
    }
  });
}); 