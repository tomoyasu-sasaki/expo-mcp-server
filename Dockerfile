# =============================================================================
# Expo MCP Server Dockerfile
# マルチステージビルド & セキュリティ強化
# =============================================================================

# Build Stage
FROM node:18-alpine AS builder

# セキュリティ: 非root権限でのビルド
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# 作業ディレクトリ設定
WORKDIR /app

# package.json と package-lock.json を先にコピー (キャッシュ最適化)
COPY package*.json ./
COPY tsconfig.json ./

# 依存関係インストール（開発依存関係含む）
RUN npm ci --include=dev

# ソースコードコピー
COPY src/ ./src/
COPY .eslintrc.cjs ./
COPY jest.config.cjs ./

# TypeScript コンパイル & ビルド
RUN npm run build && \
    npm run type-check && \
    npm prune --production

# =============================================================================
# Production Stage
FROM node:18-alpine AS production

# セキュリティ: 最新パッケージ & セキュリティパッチ
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# 作業ディレクトリ設定
WORKDIR /app

# データディレクトリ作成 & 権限設定
RUN mkdir -p /app/data /app/cache /app/logs && \
    chown -R mcpuser:nodejs /app

# 本番用依存関係とビルド成果物をコピー
COPY --from=builder --chown=mcpuser:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=mcpuser:nodejs /app/dist ./dist/
COPY --from=builder --chown=mcpuser:nodejs /app/package*.json ./

# 設定ファイルとスクリプトコピー
COPY --chown=mcpuser:nodejs docker/health-check.cjs ./
COPY --chown=mcpuser:nodejs docker/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# セキュリティ設定
USER mcpuser

# ネットワークポート公開 (HTTP フォールバック用)
EXPOSE 3000

# 環境変数設定
ENV NODE_ENV=production \
    MCP_MODE=stdio \
    LOG_LEVEL=info \
    LOCAL_STORAGE_PATH=/app/data \
    MAX_STORAGE_SIZE_GB=10

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node health-check.cjs

# ボリューム定義
VOLUME ["/app/data", "/app/cache", "/app/logs"]

# エントリーポイント設定 (dumb-init でシグナルハンドリング)
ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"] 