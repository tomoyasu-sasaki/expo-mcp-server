#!/usr/bin/env node

/**
 * Expo MCP Server
 * Model Context Protocol サーバーの実装
 */

import { Command } from 'commander';

const program = new Command();

program
  .name('expo-mcp-server')
  .description('Expo MCP Server - Model Context Protocol implementation for Expo ecosystem')
  .version('1.0.0');

program
  .option('--stdio', 'Use stdio transport (default for MCP)', true)
  .option('--port <port>', 'HTTP port (ignored in stdio mode)', '3000')
  .option('--debug', 'Enable debug logging', false)
  .option('--config <path>', 'Custom config file path');

program.parse();

const options = program.opts();

console.log('🚀 Expo MCP Server starting...');
console.log('📋 Options:', options);

// TODO: Phase 2でMCP Protocol実装
// TODO: Phase 3でExpo特有機能実装

export default program; 