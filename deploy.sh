#!/bin/bash

# Render.com デプロイスクリプト
echo "🚀 SEOチェッカーツールをRender.comにデプロイします..."

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install

# 本番環境用のビルド（必要に応じて）
echo "🔨 本番環境用ビルド中..."
# npm run build

# ログディレクトリの作成
echo "📁 ログディレクトリを作成中..."
mkdir -p logs

# 権限の設定
echo "🔐 権限を設定中..."
chmod 755 logs

# アプリケーションの起動
echo "🎯 アプリケーションを起動中..."
npm start