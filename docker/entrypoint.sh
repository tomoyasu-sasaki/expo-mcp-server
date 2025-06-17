#!/bin/sh
set -e

# =============================================================================
# Expo MCP Server - Docker Entrypoint Script
# =============================================================================

echo "🚀 Starting Expo MCP Server..."
echo "📋 Environment: NODE_ENV=${NODE_ENV:-production}"
echo "🔧 MCP Mode: ${MCP_MODE:-stdio}"
echo "💾 Storage Path: ${LOCAL_STORAGE_PATH:-/app/data}"

# データディレクトリの権限確認・修正
if [ ! -w "${LOCAL_STORAGE_PATH:-/app/data}" ]; then
    echo "⚠️  Warning: Data directory not writable, attempting to fix permissions..."
    mkdir -p "${LOCAL_STORAGE_PATH:-/app/data}"
fi

# ログディレクトリ確認
mkdir -p /app/logs
echo "📁 Directory structure verified"

# 設定ファイル存在確認
if [ ! -f "/app/dist/index.js" ]; then
    echo "❌ Error: Built application not found at /app/dist/index.js"
    exit 1
fi

echo "✅ Pre-flight checks completed"

# MCP モードに応じた起動
if [ "${MCP_MODE}" = "stdio" ]; then
    echo "🔌 Starting MCP server in stdio mode..."
    exec node /app/dist/index.js --stdio
elif [ "${MCP_MODE}" = "http" ]; then
    echo "🌐 Starting MCP server in HTTP mode on port ${MCP_PORT:-3000}..."
    exec node /app/dist/index.js --port "${MCP_PORT:-3000}"
else
    echo "🔧 Starting MCP server with default configuration..."
    exec node /app/dist/index.js
fi 