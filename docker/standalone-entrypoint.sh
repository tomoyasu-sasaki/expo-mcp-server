#!/bin/bash
set -e

echo "🚀 Expo MCP Server - 単一コンテナモード起動中..."

# ログディレクトリ作成
sudo mkdir -p /var/log/supervisor
sudo chown -R node:node /var/log/supervisor

# データディレクトリの権限設定
sudo chown -R node:node /data /app/data /app/storage

echo "📁 データディレクトリ準備完了"

# Redis起動待機チェック
check_redis() {
    for i in {1..30}; do
        if redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1; then
            echo "✅ Redis起動完了"
            return 0
        fi
        echo "⏳ Redis起動待機中... ($i/30)"
        sleep 1
    done
    echo "❌ Redis起動に失敗"
    return 1
}

# Typesense起動待機チェック  
check_typesense() {
    for i in {1..30}; do
        if curl -sf http://127.0.0.1:8108/health >/dev/null 2>&1; then
            echo "✅ Typesense起動完了"
            return 0
        fi
        echo "⏳ Typesense起動待機中... ($i/30)"
        sleep 1
    done
    echo "❌ Typesense起動に失敗"
    return 1
}

echo "🔄 supervisordでサービス群起動中..."

# supervisord起動（フォアグラウンド）
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf 