# メルカリSEOチェックツール - render.com最適化版
# 軽量Node.jsイメージ使用

FROM node:18-alpine

# 作業ディレクトリ設定
WORKDIR /app

# 軽量化：必要最小限のシステムパッケージのみ
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 本番用依存関係のみインストール（軽量化）
RUN npm ci --only=production && npm cache clean --force

# アプリケーションファイルをコピー
COPY . .

# 不要なファイルを削除（軽量化）
RUN rm -rf \
    test-fullwidth-length.js \
    config.production.js \
    render.yaml \
    *.md

# セキュリティ：非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# ポート設定
EXPOSE 3001

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# dumb-initでプロセス管理（適切なシグナルハンドリング）
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
