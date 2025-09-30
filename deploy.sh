#!/bin/bash

# ConoHa WING デプロイスクリプト
# SEO・AIOチェックツールのデプロイ用

echo "🚀 ConoHa WING デプロイ開始..."

# 設定
FTP_HOST="www1044.conoha.ne.jp"
FTP_USER="ftp@checkseoaio.com"
FTP_PASS="Asapspqr1618!"
REMOTE_DIR="/home/h6u8t_ve78vhk6/api.checkseoaio.com"
LOCAL_DIR="./"

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install --production

# ログディレクトリの作成
echo "📁 ログディレクトリを作成中..."
mkdir -p logs

# ファイルのアップロード
echo "📤 ファイルをアップロード中..."
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST << EOF
cd $REMOTE_DIR
mirror -R --delete --verbose $LOCAL_DIR ./
quit
EOF

# 権限の設定
echo "🔐 権限を設定中..."
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST << EOF
cd $REMOTE_DIR
chmod 755 index.js
chmod 755 ecosystem.config.js
chmod 755 deploy.sh
chmod -R 755 public/
chmod -R 755 logs/
quit
EOF

echo "✅ デプロイ完了！"
echo "🌐 アクセスURL: https://api.checkseoaio.com"
echo "📊 管理画面: https://api.checkseoaio.com/admin"

