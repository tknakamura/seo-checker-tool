#!/bin/bash

# 新規GitHubリポジトリ作成 + render.com接続スクリプト

echo "🆕 新規GitHubリポジトリを作成してrender.comに接続"
echo ""

echo "📋 手順："
echo "1. https://github.com/new でリポジトリ作成"
echo "2. リポジトリ名: mercari-seo-checker-fullwidth（推奨）"
echo "3. Public または Private を選択"
echo "4. README.md は作成しない（既にファイルがあるため）"
echo ""

read -p "📋 作成したリポジトリURL（例: https://github.com/username/mercari-seo-checker-fullwidth.git）: " NEW_REPO_URL

if [ -z "$NEW_REPO_URL" ]; then
    echo "❌ リポジトリURLが入力されていません"
    exit 1
fi

echo "🚀 新規リポジトリに全角文字数カウント修正版をアップロード中..."

# リモートリポジトリを設定
git remote add origin "$NEW_REPO_URL" 2>/dev/null || git remote set-url origin "$NEW_REPO_URL"

# 初回push
git push -u origin main

echo ""
echo "✅ GitHubリポジトリにアップロード完了！"
echo ""
echo "🔧 次のステップ（render.comダッシュボードで実行）："
echo "1. https://dashboard.render.com/web/srv-d37ku07fte5s73bclpsg にアクセス"
echo "2. Settings → Build & Deploy"
echo "3. Connected Repository を変更または接続"
echo "4. Repository: $NEW_REPO_URL"
echo "5. Branch: main"
echo "6. Auto-Deploy: Enabled"
echo ""
echo "📋 ビルド設定："
echo "   Build Command: npm install"
echo "   Start Command: npm start"
