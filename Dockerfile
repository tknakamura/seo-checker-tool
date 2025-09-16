# Node.js 20 Alpine ベースイメージを使用
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# システムの依存関係をインストール（Puppeteer用）
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# PuppeteerがChromiumを使用するように設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# package.jsonをコピー
COPY package.json ./

# 依存関係をインストール
RUN npm install --production --no-audit --no-fund

# アプリケーションのソースコードをコピー
COPY . .

# publicディレクトリの存在確認
RUN ls -la /app/
RUN ls -la /app/public/ || echo "publicディレクトリが存在しません"

# HTMLファイルをルートディレクトリにもコピー（フォールバック用）
RUN if [ -f /app/public/index.html ]; then cp /app/public/index.html /app/index.html; fi
RUN ls -la /app/index.html || echo "index.htmlがルートにコピーされませんでした"

# ログディレクトリを作成
RUN mkdir -p logs

# 非rootユーザーを作成
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# ファイルの所有権を変更
RUN chown -R nextjs:nodejs /app
USER nextjs

# ポート3001を公開
EXPOSE 3001

# ヘルスチェック用のエンドポイント
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# アプリケーションを起動
CMD ["npm", "start"]
