#!/bin/bash
# Render.com デプロイをトリガーするスクリプト
# 方法1: Deploy Hook（推奨・認証不要） RENDER_DEPLOY_HOOK_URL を設定
# 方法2: API Key で RENDER_API_KEY と RENDER_SERVICE_ID を設定

set -e

SERVICE_ID="${RENDER_SERVICE_ID:-srv-d37ku07fte5s73bclpsg}"

if [ -n "$RENDER_DEPLOY_HOOK_URL" ]; then
  echo "🚀 Deploy Hook でデプロイをトリガーしています..."
  curl -f -X POST "$RENDER_DEPLOY_HOOK_URL"
  echo ""
  echo "✅ デプロイがキューに登録されました"
  echo "📊 進行状況: https://dashboard.render.com/web/$SERVICE_ID"
  exit 0
fi

if [ -n "$RENDER_API_KEY" ]; then
  echo "🚀 Render API でデプロイをトリガーしています..."
  resp=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    "https://api.render.com/v1/services/$SERVICE_ID/deploys")
  http_code=$(echo "$resp" | tail -n1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "$body" | head -c 500
    echo ""
    echo "✅ デプロイがキューに登録されました"
    echo "📊 進行状況: https://dashboard.render.com/web/$SERVICE_ID"
    exit 0
  else
    echo "❌ API エラー (HTTP $http_code): $body"
    exit 1
  fi
fi

echo "⚠️  デプロイをトリガーするには、次のいずれかを設定してください："
echo ""
echo "方法1（推奨）Deploy Hook:"
echo "  1. https://dashboard.render.com/web/$SERVICE_ID を開く"
echo "  2. Settings → Deploy Hook の URL をコピー"
echo "  3. 実行: RENDER_DEPLOY_HOOK_URL='https://api.render.com/deploy/srv-xxx?key=xxx' ./deploy-render.sh"
echo ""
echo "方法2: API Key:"
echo "  1. https://dashboard.render.com/account/api-keys で API Key を発行"
echo "  2. 実行: RENDER_API_KEY='rnd_xxx' ./deploy-render.sh"
echo ""
echo "手動デプロイ: 上記ダッシュボード → Manual Deploy をクリック"
exit 1
