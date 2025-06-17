#!/usr/bin/env node

/**
 * Docker Health Check Script for Expo MCP Server
 * MCPサーバーの正常性チェック
 */

const fs = require('fs');
const path = require('path');

// ヘルスチェック設定
const HEALTH_CHECK_CONFIG = {
  timeout: 5000,
  maxMemoryMB: 1024,
  requiredFiles: [
    '/app/dist/index.js',
    '/app/package.json'
  ],
  requiredDirs: [
    '/app/data',
    '/app/cache',
    '/app/logs'
  ]
};

/**
 * メイン ヘルスチェック関数
 */
async function healthCheck() {
  try {
    console.log('🔍 Starting Expo MCP Server health check...');
    
    // 1. 必須ファイル・ディレクトリの存在確認
    await checkRequiredPaths();
    
    // 2. ディスク容量チェック
    await checkDiskSpace();
    
    // 3. メモリ使用量チェック
    await checkMemoryUsage();
    
    // 4. Node.js プロセス確認
    await checkNodeProcess();
    
    // 5. MCP 設定ファイル確認
    await checkMCPConfig();
    
    console.log('✅ Health check passed - MCP server is healthy');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

/**
 * 必須ファイル・ディレクトリ存在確認
 */
async function checkRequiredPaths() {
  console.log('📁 Checking required files and directories...');
  
  // 必須ファイル確認
  for (const filePath of HEALTH_CHECK_CONFIG.requiredFiles) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${filePath}`);
    }
  }
  
  // 必須ディレクトリ確認
  for (const dirPath of HEALTH_CHECK_CONFIG.requiredDirs) {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Required directory missing: ${dirPath}`);
    }
    
    // 書き込み権限確認
    try {
      const testFile = path.join(dirPath, '.health-check');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (err) {
      throw new Error(`Directory not writable: ${dirPath}`);
    }
  }
  
  console.log('✓ Required paths verified');
}

/**
 * ディスク容量チェック
 */
async function checkDiskSpace() {
  console.log('💾 Checking disk space...');
  
  try {
    const stats = fs.statSync('/app/data');
    const dataDir = '/app/data';
    
    // 利用可能容量の簡易チェック (Alpine Linuxでstatvfsが使えない場合の代替)
    const tempFile = path.join(dataDir, '.space-check');
    fs.writeFileSync(tempFile, Buffer.alloc(1024)); // 1KB書き込みテスト
    fs.unlinkSync(tempFile);
    
    console.log('✓ Disk space sufficient');
  } catch (err) {
    throw new Error(`Disk space check failed: ${err.message}`);
  }
}

/**
 * メモリ使用量チェック
 */
async function checkMemoryUsage() {
  console.log('🧠 Checking memory usage...');
  
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024);
  
  console.log(`Memory usage: Heap ${heapUsedMB}MB, RSS ${rssUsedMB}MB`);
  
  if (rssUsedMB > HEALTH_CHECK_CONFIG.maxMemoryMB) {
    throw new Error(`Memory usage too high: ${rssUsedMB}MB > ${HEALTH_CHECK_CONFIG.maxMemoryMB}MB`);
  }
  
  console.log('✓ Memory usage within limits');
}

/**
 * Node.js プロセス確認
 */
async function checkNodeProcess() {
  console.log('⚡ Checking Node.js process...');
  
  // Node.js バージョン確認
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (major < 18) {
    throw new Error(`Node.js version too old: ${nodeVersion} (required: 18+)`);
  }
  
  // プロセス状態確認
  if (process.pid <= 0) {
    throw new Error('Invalid process ID');
  }
  
  console.log(`✓ Node.js ${nodeVersion} process healthy (PID: ${process.pid})`);
}

/**
 * MCP設定確認
 */
async function checkMCPConfig() {
  console.log('⚙️ Checking MCP configuration...');
  
  try {
    // package.json 読み込み確認
    const packageJson = JSON.parse(fs.readFileSync('/app/package.json', 'utf8'));
    
    if (packageJson.name !== 'expo-mcp-server') {
      throw new Error('Invalid package.json');
    }
    
    // 環境変数確認
    const requiredEnvVars = ['NODE_ENV', 'MCP_MODE'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
    }
    
    console.log(`✓ MCP configuration valid (mode: ${process.env.MCP_MODE})`);
    
  } catch (err) {
    throw new Error(`MCP config check failed: ${err.message}`);
  }
}

// メイン実行
healthCheck(); 