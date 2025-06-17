#!/usr/bin/env node

/**
 * MCP Protocol stdio通信テストスクリプト
 * JSON-RPC 2.0 メッセージの送受信確認
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../dist/index.js');

console.log('🧪 MCP Protocol stdio 通信テスト開始...');

// MCP Server プロセスを起動
const server = spawn('node', [serverPath, '--stdio', '--debug'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let messageId = 1;
let responses = [];

// サーバーからのメッセージ受信
server.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📥 Received:', JSON.stringify(response, null, 2));
        responses.push(response);
        
        // initializeに対するレスポンスを受信したら、tools/listを送信
        if (response.id === 1 && !response.error) {
          sendToolsList();
        }
        
        // tools/listのレスポンスを受信したら、テスト完了
        if (response.id === 2 && !response.error) {
          console.log('✅ Tools list received successfully');
          setTimeout(() => {
            server.kill();
            console.log('🎯 テスト完了');
          }, 1000);
        }
      } catch (error) {
        console.log('📝 Non-JSON output:', line);
      }
    }
  });
});

// エラーハンドリング
server.stderr.on('data', (data) => {
  console.log('⚠️  Server stderr:', data.toString());
});

server.on('close', (code) => {
  console.log(`📊 Server process exited with code ${code}`);
  
  // テスト結果まとめ
  console.log('\n📋 テスト結果:');
  console.log(`- 受信メッセージ数: ${responses.length}`);
  
  const initResponse = responses.find(r => r.id === 1);
  const toolsResponse = responses.find(r => r.id === 2);
  
  if (initResponse && !initResponse.error) {
    console.log('✅ Initialize: 成功');
  } else {
    console.log('❌ Initialize: 失敗');
  }
  
  if (toolsResponse && !toolsResponse.error) {
    console.log('✅ Tools list: 成功');
    console.log(`   利用可能ツール数: ${toolsResponse.result?.tools?.length || 0}`);
  } else {
    console.log('❌ Tools list: 失敗');
  }
  
  process.exit(code);
});

// Initialize メッセージ送信
function sendInitialize() {
  const initMessage = {
    jsonrpc: '2.0',
    id: messageId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
      clientInfo: {
        name: 'expo-mcp-test-client',
        version: '1.0.0',
      },
    },
  };
  
  console.log('📤 Sending initialize:', JSON.stringify(initMessage, null, 2));
  server.stdin.write(JSON.stringify(initMessage) + '\n');
}

// Tools list メッセージ送信
function sendToolsList() {
  const toolsMessage = {
    jsonrpc: '2.0',
    id: messageId++,
    method: 'tools/list',
    params: {},
  };
  
  console.log('📤 Sending tools/list:', JSON.stringify(toolsMessage, null, 2));
  server.stdin.write(JSON.stringify(toolsMessage) + '\n');
}

// サーバー起動待機後にテスト開始
setTimeout(() => {
  console.log('⏱️  Server startup wait completed, sending initialize...');
  sendInitialize();
}, 2000);

// タイムアウト設定（30秒）
setTimeout(() => {
  console.log('⏰ Test timeout reached');
  server.kill();
  process.exit(1);
}, 30000); 