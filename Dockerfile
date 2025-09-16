# Node.js 18 Alpine ベースイメージを使用
FROM node:18-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションのソースコードをコピー
COPY . .

# ログディレクトリを作成
RUN mkdir -p logs

# ポート3001を公開
EXPOSE 3001

# ヘルスチェック用のエンドポイント
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

# アプリケーションを起動
CMD ["npm", "start"]
