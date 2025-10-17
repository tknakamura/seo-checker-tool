#!/bin/bash

# 超簡単ワンコマンド自動デプロイ
# 使用方法: ./auto-deploy.sh

echo "🚀 全角文字数カウント修正版 - 自動デプロイ開始"
echo "⏰ $(date)"
echo ""

# Git状況確認（オプション）
if [ -d .git ]; then
    echo "📂 Git状況:"
    git status --porcelain
    echo ""
fi

# 自動デプロイ実行
echo "🔄 デプロイ実行中..."
./deploy-curl.sh

echo ""
echo "✅ 自動デプロイ完了！"
echo "🌐 本番URL: https://api.checkseoaio.com"
echo "📊 管理URL: https://api.checkseoaio.com/admin"
echo ""
echo "🧪 動作確認コマンド例:"
echo "curl -k -X POST https://api.checkseoaio.com/api/check/seo \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"html\":\"<title>テスト用全角文字タイトル</title>\"}'"
