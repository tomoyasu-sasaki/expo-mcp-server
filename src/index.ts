#!/usr/bin/env node

/**
 * Expo MCP Server
 * Model Context Protocol サーバーの実装
 */

import { Command } from 'commander';
import { ConfigManager, CLIOptions } from './utils/config';
import { ExpoMcpServer } from './mcp/server';

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('expo-mcp-server')
    .description('Expo MCP Server - Model Context Protocol implementation for Expo ecosystem')
    .version('1.0.0');

  program
    .option('--stdio', 'Use stdio transport (default for MCP)')
    .option('--http', 'Use HTTP + SSE transport instead of stdio')
    .option('--port <port>', 'HTTP port (only used with --http)', '3000')
    .option('--debug', 'Enable debug logging', false)
    .option('--config <path>', 'Custom config file path')
    .option('--cache-size <size>', 'Memory cache size in MB', '200');

  program.parse();

  const options = program.opts() as CLIOptions;

  try {
    console.log('🚀 Expo MCP Server starting...');
    
    // 設定読み込み
    const configManager = new ConfigManager();
    configManager.applyCLIOptions(options);
    
    const validation = configManager.validateConfig();
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:');
      validation.errors?.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    const config = configManager.getConfig();
    
    // デバッグ情報表示
    if (options.debug) {
      console.log('📋 CLI Options:', options);
      console.log('📊 Configuration:', JSON.stringify(config, null, 2));
    }

    // MCP Config変換（既存の設定構造をMCP用に変換）
    const mcpConfig = {
      name: config.server.name,
      version: config.server.version,
      description: config.server.description,
      protocol: {
        version: config.mcp.protocol_version,
        transports: {
          stdio: {
            enabled: config.mcp.default_transport === 'stdio' || options.stdio,
            encoding: config.mcp.stdio.encoding,
            timeout_ms: config.mcp.stdio.timeout_ms,
            max_message_size_bytes: config.mcp.stdio.max_message_size_bytes,
          },
        http: {
          enabled: (options.http === true) || (config.mcp.default_transport === 'http' && !options.stdio),
          port: options.port ? (typeof options.port === 'string' ? parseInt(options.port, 10) : options.port) : config.mcp.http.port,
          cors_enabled: config.mcp.http.cors_enabled,
          timeout_ms: config.mcp.http.timeout_ms,
          websocket_upgrade: config.mcp.http.websocket_upgrade,
        },
        },
      },
      capabilities: {
        tools: [
          {
            name: 'expo_read_document',
            description: 'Expoドキュメント、APIリファレンス、ガイドを取得',
            enabled: config.features.tools.expo_read_document?.enabled ?? true,
          },
          {
            name: 'expo_search_documents',
            description: 'Expoエコシステム全体でコンテンツ検索',
            enabled: config.features.tools.expo_search_documents?.enabled ?? true,
          },
          {
            name: 'expo_recommend',
            description: '現在のコンテキストに基づく関連コンテンツ推薦',
            enabled: config.features.tools.expo_recommend?.enabled ?? true,
          },
          {
            name: 'expo_get_sdk_module',
            description: 'Expo SDK モジュールの詳細情報を取得',
            enabled: config.features.tools.expo_get_sdk_module?.enabled ?? true,
          },
          {
            name: 'expo_config_templates',
            description: 'Expo設定ファイルの生成と検証',
            enabled: config.features.tools.expo_config_templates?.enabled ?? true,
          },
          {
            name: 'expo_eas_command_builder',
            description: 'EAS CLI コマンドをコンテキストに基づいて生成',
            enabled: config.features.tools.expo_eas_command_builder?.enabled ?? true,
          },
          {
            name: 'expo_code_examples',
            description: '実行可能なコード例とSnack統合を提供',
            enabled: config.features.tools.expo_code_examples?.enabled ?? true,
          },
          {
            name: 'expo_error_diagnosis',
            description: '一般的なExpoエラーの分析と解決策提供',
            enabled: config.features.tools.expo_error_diagnosis?.enabled ?? true,
          },
        ],
        resources: [
          {
            uri_template: 'expo://docs/{path}',
            name: 'Expo Documentation',
            description: 'Expo公式ドキュメント',
            mime_type: 'text/markdown',
          },
          {
            uri_template: 'expo://api/{module}',
            name: 'Expo SDK API Reference',
            description: 'Expo SDK APIリファレンス',
            mime_type: 'text/markdown',
          },
          {
            uri_template: 'expo://examples/{category}',
            name: 'Code Examples',
            description: '実行可能なコード例とSnackリンク',
            mime_type: 'application/json',
          },
          {
            uri_template: 'expo://config/{type}',
            name: 'Configuration Templates',
            description: 'Expo設定ファイルテンプレート',
            mime_type: 'application/json',
          },
          {
            uri_template: 'expo://eas/{command}',
            name: 'EAS Commands',
            description: 'EAS CLI コマンドリファレンス',
            mime_type: 'text/plain',
          },
        ],
        prompts: [
          {
            name: 'expo_setup_helper',
            description: 'Expoプロジェクトセットアップ支援プロンプト',
            arguments: [
              {
                name: 'project_type',
                description: 'プロジェクトタイプ（blank, tabs, bare workflow）',
                required: true,
              },
              {
                name: 'target_platforms',
                description: '対象プラットフォーム',
                required: false,
              },
            ],
          },
          {
            name: 'expo_error_helper',
            description: 'Expoエラー解決支援プロンプト',
            arguments: [
              {
                name: 'error_message',
                description: 'エラーメッセージ',
                required: true,
              },
              {
                name: 'context',
                description: '発生時のコンテキスト（ビルド中、実行中等）',
                required: false,
              },
            ],
          },
          {
            name: 'expo_api_helper',
            description: 'Expo API使用支援プロンプト',
            arguments: [
              {
                name: 'module_name',
                description: '使用したいExpo SDKモジュール',
                required: true,
              },
              {
                name: 'use_case',
                description: '使用目的・実現したい機能',
                required: false,
              },
            ],
          },
          {
            name: 'expo_config_analyzer',
            description: 'Expo設定分析・最適化提案プロンプト',
            arguments: [
              {
                name: 'config_content',
                description: '現在のapp.jsonまたはeas.json内容',
                required: true,
              },
              {
                name: 'target_environment',
                description: '対象環境（development, preview, production）',
                required: false,
              },
            ],
          },
        ],
      },
      security: config.security,
      performance: config.performance,
      logging: config.logging,
    };

    // MCP Server 初期化
    const mcpServer = new ExpoMcpServer(mcpConfig);

    // イベントハンドラー設定
    mcpServer.on('session:initialized', (data) => {
      console.log(`✅ MCP session initialized: ${data.sessionId}`);
      if (options.debug) {
        console.log('📱 Client info:', data.clientInfo);
      }
    });

    mcpServer.on('server:connected', (data) => {
      console.log(`🔗 MCP Server connected via ${data.transport}`);
    });

    mcpServer.on('server:disconnected', (data) => {
      console.log(`❌ MCP Server disconnected${data.signal ? ` (${data.signal})` : ''}`);
    });

    mcpServer.on('server:reconnected', (data) => {
      console.log(`🔄 MCP Server reconnected: ${data.sessionId}`);
    });

    mcpServer.on('error', (error) => {
      console.error('❌ MCP Server error:', error);
    });

    // トランスポート選択と開始
    if (mcpConfig.protocol.transports.stdio.enabled) {
      console.log('📡 Starting MCP Server with stdio transport...');
      await mcpServer.startStdio();
      
      // Stdio mode では無限ループで待機
      console.log('✅ MCP Server ready - Listening on stdio...');
      
      // 定期的な接続チェック
      setInterval(async () => {
        const isAlive = await mcpServer.ping();
        if (!isAlive) {
          console.warn('⚠️  Ping check failed - attempting reconnection...');
          try {
            await mcpServer.reconnect();
          } catch (reconnectError) {
            console.error('❌ Reconnection failed:', reconnectError);
          }
        }
      }, 30000); // 30秒ごと

      // プロセス終了時のクリーンアップを実行（サーバー内で既に設定済み）
      
    } else if (mcpConfig.protocol.transports.http.enabled) {
      const port = mcpConfig.protocol.transports.http.port;
      console.log(`📡 Starting MCP Server with HTTP + SSE transport on port ${port}...`);
      
      await mcpServer.startHttp(port);
      
      console.log(`✅ MCP Server ready - HTTP endpoints available:`);
      console.log(`   POST http://localhost:${port}/mcp - JSON-RPC messages`);
      console.log(`   GET  http://localhost:${port}/mcp/events - Server-Sent Events`);
      console.log(`   GET  http://localhost:${port}/mcp/ws - WebSocket upgrade`);
      console.log(`   GET  http://localhost:${port}/health - Health check`);
      
      // HTTP mode では無限ループで待機
      const keepAlive = setInterval(() => {
        if (options.debug) {
          console.log(`[${new Date().toISOString()}] HTTP Server running...`);
        }
      }, 60000); // 1分ごと
      
      // クリーンアップ時にInterval停止
      process.on('SIGINT', () => {
        clearInterval(keepAlive);
      });
      process.on('SIGTERM', () => {
        clearInterval(keepAlive);
      });
      
    } else {
      console.error('❌ No valid transport configured');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Failed to start Expo MCP Server:', error);
    process.exit(1);
  }
}

// 非同期関数の実行
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

export default main; 