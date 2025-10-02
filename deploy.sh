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

# ログディレクトリの作成
echo "📁 ログディレクトリを作成中..."
mkdir -p logs

# ファイルのアップロード（node_modulesを除外）
echo "📤 ファイルをアップロード中..."
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST << EOF
cd $REMOTE_DIR
mirror -R --delete --verbose --exclude-glob node_modules/ --exclude-glob .git/ --exclude-glob test-seo.js $LOCAL_DIR ./
quit
EOF

# 本番環境で依存関係をインストール
echo "📦 本番環境で依存関係をインストール中..."
lftp -u $FTP_USER,$FTP_PASS $FTP_HOST << EOF
cd $REMOTE_DIR
!npm install --production
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

