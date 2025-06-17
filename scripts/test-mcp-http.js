#!/usr/bin/env node

/**
 * HTTP + SSE Transport統合テスト
 * MCP Server のHTTP transportが正常に動作することを確認
 */

import { spawn } from 'child_process';

// テスト設定
const TEST_PORT = 3002;
const SERVER_TIMEOUT = 10000; // 10秒

/**
 * HTTP リクエストヘルパー
 */
async function httpRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json() 
        : await response.text(),
    };
  } catch (error) {
    throw new Error(`HTTP request failed: ${error.message}`);
  }
}

/**
 * MCPサーバーを起動
 */
function startMcpServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting MCP Server in HTTP mode...');
    
    const server = spawn('node', ['dist/index.js', '--http', '--port', TEST_PORT.toString(), '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    let startupTimeout;
    let serverReady = false;

    // サーバー出力を監視
    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output.trim());
      
      // サーバー起動完了を検出
      if (output.includes('✅ MCP Server ready - HTTP endpoints available:') || 
          output.includes('HTTP + SSE transport started successfully') ||
          output.includes('MCP Server HTTP transport started successfully')) {
        serverReady = true;
        clearTimeout(startupTimeout);
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('[Server Error]', error.trim());
    });

    server.on('error', (error) => {
      clearTimeout(startupTimeout);
      reject(new Error(`Server spawn error: ${error.message}`));
    });

    server.on('exit', (code, signal) => {
      if (!serverReady) {
        clearTimeout(startupTimeout);
        reject(new Error(`Server exited unexpectedly with code ${code}, signal ${signal}`));
      }
    });

    // タイムアウト設定
    startupTimeout = global.setTimeout(() => {
      server.kill('SIGTERM');
      reject(new Error(`Server startup timeout after ${SERVER_TIMEOUT}ms`));
    }, SERVER_TIMEOUT);
  });
}

/**
 * テスト実行
 */
async function runTests() {
  console.log('🧪 Starting HTTP Transport Integration Tests...\n');
  
  let server;
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  try {
    // サーバー起動
    server = await startMcpServer();
    console.log('✅ MCP Server started successfully\n');

         // 少し待機してサーバーが完全に起動するのを待つ
     await new Promise(resolve => global.setTimeout(resolve, 2000));

    // テスト1: Health Check
    console.log('📋 Test 1: Health Check');
    try {
      const health = await httpRequest(`http://localhost:${TEST_PORT}/health`);
      
      if (health.status === 200 && health.data.status === 'healthy') {
        console.log('✅ Health check passed');
        results.passed++;
      } else {
        throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      results.failed++;
    }
    results.tests.push('Health Check');

    // テスト2: CORS Headers
    console.log('\n📋 Test 2: CORS Headers');
    try {
      const cors = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, { method: 'OPTIONS' });
      
      const hasCorsHeaders = cors.headers['access-control-allow-origin'] && 
                            cors.headers['access-control-allow-methods'];
      
      if (cors.status === 200 && hasCorsHeaders) {
        console.log('✅ CORS headers test passed');
        results.passed++;
      } else {
        throw new Error(`CORS headers missing or invalid: ${JSON.stringify(cors.headers)}`);
      }
    } catch (error) {
      console.error('❌ CORS headers test failed:', error.message);
      results.failed++;
    }
    results.tests.push('CORS Headers');

    // テスト3: JSON-RPC Initialize
    console.log('\n📋 Test 3: JSON-RPC Initialize Message');
    try {
      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initMessage),
      });

      if (response.status === 200 && 
          response.data.jsonrpc === '2.0' && 
          response.data.result && 
          response.data.result.protocolVersion === '2024-11-05') {
        console.log('✅ Initialize message test passed');
        console.log('📊 Server capabilities:', Object.keys(response.data.result.capabilities));
        results.passed++;
      } else {
        throw new Error(`Invalid initialize response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ Initialize message test failed:', error.message);
      results.failed++;
    }
    results.tests.push('JSON-RPC Initialize');

    // テスト4: Tools List
    console.log('\n📋 Test 4: Tools List');
    try {
      const toolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      };

      const response = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toolsMessage),
      });

      if (response.status === 200 && 
          response.data.jsonrpc === '2.0' && 
          response.data.result && 
          Array.isArray(response.data.result.tools)) {
        console.log(`✅ Tools list test passed (${response.data.result.tools.length} tools)`);
        response.data.result.tools.forEach(tool => {
          console.log(`   - ${tool.name}: ${tool.description}`);
        });
        results.passed++;
      } else {
        throw new Error(`Invalid tools list response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ Tools list test failed:', error.message);
      results.failed++;
    }
    results.tests.push('Tools List');

    // テスト5: Resources List
    console.log('\n📋 Test 5: Resources List');
    try {
      const resourcesMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/list',
        params: {},
      };

      const response = await httpRequest(`http://localhost:${TEST_PORT}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resourcesMessage),
      });

      if (response.status === 200 && 
          response.data.jsonrpc === '2.0' && 
          response.data.result && 
          Array.isArray(response.data.result.resources)) {
        console.log(`✅ Resources list test passed (${response.data.result.resources.length} resources)`);
        response.data.result.resources.forEach(resource => {
          console.log(`   - ${resource.name}: ${resource.uri}`);
        });
        results.passed++;
      } else {
        throw new Error(`Invalid resources list response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ Resources list test failed:', error.message);
      results.failed++;
    }
    results.tests.push('Resources List');

    // テスト6: SSE Endpoint
    console.log('\n📋 Test 6: Server-Sent Events Endpoint');
    try {
      const sseResponse = await httpRequest(`http://localhost:${TEST_PORT}/mcp/events`);
      
      if (sseResponse.status === 200 && 
          sseResponse.headers['content-type'] === 'text/event-stream') {
        console.log('✅ SSE endpoint test passed');
        results.passed++;
      } else {
        throw new Error(`Invalid SSE response: ${JSON.stringify(sseResponse)}`);
      }
    } catch (error) {
      console.error('❌ SSE endpoint test failed:', error.message);
      results.failed++;
    }
    results.tests.push('SSE Endpoint');

    // テスト7: WebSocket Upgrade
    console.log('\n📋 Test 7: WebSocket Upgrade');
    try {
      const wsResponse = await httpRequest(`http://localhost:${TEST_PORT}/mcp/ws`, {
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
        },
      });
      
      if (wsResponse.status === 101) {
        console.log('✅ WebSocket upgrade test passed');
        results.passed++;
      } else {
        throw new Error(`Invalid WebSocket response: ${JSON.stringify(wsResponse)}`);
      }
    } catch (error) {
      console.error('❌ WebSocket upgrade test failed:', error.message);
      results.failed++;
    }
    results.tests.push('WebSocket Upgrade');

    // テスト8: Security Headers
    console.log('\n📋 Test 8: Security Headers');
    try {
      const securityResponse = await httpRequest(`http://localhost:${TEST_PORT}/health`);
      
      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'x-mcp-protocol-version',
        'x-mcp-server',
      ];
      
      const missingHeaders = requiredHeaders.filter(header => !securityResponse.headers[header]);
      
      if (missingHeaders.length === 0) {
        console.log('✅ Security headers test passed');
        results.passed++;
      } else {
        throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
      }
    } catch (error) {
      console.error('❌ Security headers test failed:', error.message);
      results.failed++;
    }
    results.tests.push('Security Headers');

    // テスト結果サマリー
    console.log('\n' + '='.repeat(50));
    console.log('📊 HTTP Transport Integration Test Results');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📋 Total:  ${results.tests.length}`);
    
    if (results.failed === 0) {
      console.log('\n🎉 All tests passed! HTTP Transport is working correctly.');
    } else {
      console.log(`\n⚠️  ${results.failed} test(s) failed. Please check the implementation.`);
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    results.failed++;
  } finally {
    // サーバー停止
    if (server) {
      console.log('\n🛑 Stopping MCP Server...');
      server.kill('SIGTERM');
      
             // サーバー停止を待つ
       await new Promise((resolve) => {
         server.on('exit', resolve);
         global.setTimeout(resolve, 5000); // 最大5秒待機
       });
    }
  }

  // 終了コード
  process.exit(results.failed > 0 ? 1 : 0);
}

// テスト実行
runTests().catch((error) => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
}); 