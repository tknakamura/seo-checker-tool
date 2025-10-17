#!/bin/bash

# 既存GitHubリポジトリへの自動デプロイスクリプト
# render.comダッシュボードで確認したリポジトリURLを使用

echo "🔍 render.comに接続されているリポジトリを確認してください："
echo "https://dashboard.render.com/web/srv-d37ku07fte5s73bclpsg"
echo "Settings → Build & Deploy → Connected Repository"
echo ""

read -p "📋 GitHubリポジトリURL（例: https://github.com/username/repo-name.git）: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ リポジトリURLが入力されていません"
    exit 1
fi

echo "🚀 既存リポジトリに全角文字数カウント修正版をデプロイ中..."

# リモートリポジトリを追加
git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"

# pushして自動デプロイ
git push -u origin main

echo ""
echo "✅ デプロイ完了！"
echo "🌐 render.comで自動ビルドが開始されます"
echo "📊 進行状況: https://dashboard.render.com/web/srv-d37ku07fte5s73bclpsg"
echo ""
echo "📋 デプロイ内容："
echo "   - 全角文字数カウント機能実装"
echo "   - Title Tag: 15-30全角文字基準"
echo "   - Meta Description: 60-80全角文字基準"
