# =============================================================================
# Expo MCP Server Dockerfile
# マルチアーキテクチャビルド & セキュリティ強化 & イメージ署名対応
# =============================================================================

# プラットフォーム対応のベースイメージ
ARG TARGETPLATFORM
ARG BUILDPLATFORM=linux/amd64
FROM node:18-alpine AS base

# ビルド情報ラベル（署名で使用）
LABEL maintainer="Expo DevRel Team <devrel@expo.dev>" \
      org.opencontainers.image.title="Expo MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for Expo ecosystem" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Expo" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/expo/expo-mcp-server" \
      org.opencontainers.image.documentation="https://github.com/expo/expo-mcp-server/blob/main/README.md" \
      org.opencontainers.image.created="" \
      org.opencontainers.image.revision=""

# Build Args for multi-arch
ARG TARGETARCH
ARG TARGETOS

# =============================================================================
# Dependencies Stage - プラットフォーム固有の依存関係インストール
FROM base AS dependencies

# セキュリティ: 最新パッケージ & セキュリティパッチ
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    ca-certificates \
    tini && \
    rm -rf /var/cache/apk/*

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# 作業ディレクトリ設定
WORKDIR /app

# package.json と package-lock.json を先にコピー (キャッシュ最適化)
COPY --chown=mcpuser:nodejs package*.json ./
COPY --chown=mcpuser:nodejs tsconfig.json ./

# プラットフォーム固有のnpmキャッシュクリア
RUN npm cache clean --force

# 依存関係インストール（開発依存関係含む）
RUN npm ci --include=dev --no-audit --no-fund

# =============================================================================
# Build Stage - TypeScriptコンパイル & バンドル
FROM dependencies AS builder

# ソースコードコピー
COPY --chown=mcpuser:nodejs src/ ./src/
COPY --chown=mcpuser:nodejs .eslintrc.cjs ./
COPY --chown=mcpuser:nodejs jest.config.cjs ./

# TypeScript コンパイル & ビルド & プロダクション依存関係のみに削減
RUN npm run build && \
    npm run type-check && \
    npm prune --production --no-audit

# ビルド成果物の検証
RUN test -f dist/index.js || (echo "Build failed: dist/index.js not found" && exit 1)

# =============================================================================
# Production Stage - 最終プロダクションイメージ
FROM node:18-alpine AS production

# セキュリティ: 最新パッケージ & 実行時ライブラリのみ
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# 作業ディレクトリ設定
WORKDIR /app

# データディレクトリ作成 & 権限設定
RUN mkdir -p /app/data /app/cache /app/logs /app/config && \
    chown -R mcpuser:nodejs /app

# 本番用依存関係とビルド成果物をコピー
COPY --from=builder --chown=mcpuser:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=mcpuser:nodejs /app/dist ./dist/
COPY --from=builder --chown=mcpuser:nodejs /app/package*.json ./

# 設定ファイルとスクリプトコピー
COPY --chown=mcpuser:nodejs config/default.json ./config/
COPY --chown=mcpuser:nodejs config/production.json ./config/
COPY --chown=mcpuser:nodejs mcp-config.json ./
COPY --chown=mcpuser:nodejs docker/health-check.cjs ./
COPY --chown=mcpuser:nodejs docker/entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# セキュリティ設定 - 非rootユーザーに切り替え
USER mcpuser

# ネットワークポート公開 (HTTP フォールバック用)
EXPOSE 3000

# 環境変数設定
ENV NODE_ENV=production \
    MCP_MODE=stdio \
    LOG_LEVEL=info \
    LOCAL_STORAGE_PATH=/app/data \
    MAX_STORAGE_SIZE_GB=10 \
    CACHE_TTL_SECONDS=3600 \
    RATE_LIMIT_RPM=2000

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD node health-check.cjs || exit 1

# ボリューム定義
VOLUME ["/app/data", "/app/cache", "/app/logs"]

# エントリーポイント設定 (tini でシグナルハンドリング強化)
ENTRYPOINT ["tini", "--", "./entrypoint.sh"]
CMD ["--stdio"]

# =============================================================================
# Metadata for signing and security
LABEL org.opencontainers.image.title="Expo MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for Expo ecosystem with multi-architecture support" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Expo DevRel Team <devrel@expo.dev>" \
      org.opencontainers.image.vendor="Expo" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/expo/expo-mcp-server" \
      org.opencontainers.image.documentation="https://github.com/expo/expo-mcp-server/blob/main/docs/docker-deployment.md" \
      org.opencontainers.image.url="https://github.com/expo/expo-mcp-server" \
      security.scan="enabled" \
      security.signature="required" 