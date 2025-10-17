#!/bin/bash

# ConoHa WINGサーバー用起動スクリプト
# サーバーSSH接続後に実行

echo "🚀 SEO・AIOチェックツール サーバー起動"
echo "📂 作業ディレクトリ: /home/h6u8t_ve78vhk6/api.checkseoaio.com"

# 作業ディレクトリに移動
cd /home/h6u8t_ve78vhk6/api.checkseoaio.com

# 依存関係インストール
echo "📦 依存関係をインストール中..."
npm install --production

# PM2がインストールされているかチェック
if ! command -v pm2 &> /dev/null; then
    echo "📦 PM2をインストール中..."
    npm install -g pm2
fi

# 既存のプロセスを停止
echo "🛑 既存プロセスを停止..."
pm2 delete all 2>/dev/null || true

# アプリケーション起動
echo "🚀 アプリケーションを起動中..."
pm2 start ecosystem.config.js

# 起動状態を保存
pm2 save

# 自動起動設定
echo "⚙️  自動起動設定中..."
pm2 startup

echo ""
echo "✅ サーバー起動完了！"
echo "🌐 アクセスURL: https://api.checkseoaio.com"
echo "📊 プロセス状況確認: pm2 status"
echo "📋 ログ確認: pm2 logs"
echo ""
echo "🧪 動作確認:"
echo "curl https://api.checkseoaio.com/"
