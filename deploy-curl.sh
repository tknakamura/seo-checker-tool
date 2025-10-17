#!/bin/bash

# ConoHa WING デプロイスクリプト (curl版)
# SEO・AIOチェックツールのデプロイ用

echo "🚀 ConoHa WING デプロイ開始 (curl版)..."

# 設定
FTP_HOST="www1044.conoha.ne.jp"
FTP_USER="ftp@checkseoaio.com"
FTP_PASS="Asapspqr1618!"
REMOTE_DIR="/home/h6u8t_ve78vhk6/api.checkseoaio.com"

# アップロード対象ファイル
FILES=(
  "index.js"
  "aio-checker.js"
  "detailed-analyzer.js" 
  "enhanced-reporter.js"
  "page-type-analyzer.js"
  "structured-data-recommender.js"
  "schema-templates.js"
  "config.production.js"
  "ecosystem.config.js"
  "package.json"
  "package-lock.json"
  "public/index.html"
  "test-fullwidth-length.js"
)

echo "📤 ファイルをアップロード中..."

# 各ファイルをcurlでアップロード
for file in "${FILES[@]}"; do
  if [[ -f "$file" ]]; then
    echo "📤 アップロード中: $file"
    
    # ディレクトリ部分を取得
    dir_path=$(dirname "$file")
    filename=$(basename "$file")
    
    # リモートパスを構築
    if [[ "$dir_path" == "." ]]; then
      remote_path="$REMOTE_DIR/$filename"
    else
      remote_path="$REMOTE_DIR/$dir_path/$filename"
    fi
    
    # curlでFTPアップロード
    curl -T "$file" "ftp://$FTP_HOST$remote_path" \
         --user "$FTP_USER:$FTP_PASS" \
         --ftp-create-dirs \
         --progress-bar
         
    if [[ $? -eq 0 ]]; then
      echo "✅ アップロード完了: $file"
    else
      echo "❌ アップロード失敗: $file"
    fi
  else
    echo "⚠️ ファイルが見つかりません: $file"
  fi
done

# ログディレクトリの作成（curlでは難しいため手動確認が必要）
echo "📁 ログディレクトリ作成をサーバー側で確認してください: $REMOTE_DIR/logs"

echo ""
echo "✅ デプロイ完了！"
echo "🌐 アクセスURL: https://api.checkseoaio.com"
echo "📊 管理画面: https://api.checkseoaio.com/admin"
echo ""
echo "📋 デプロイされた主要な変更:"
echo "   - 構造化データ判定機能の大幅改善"
echo "   - ページタイプ自動判定エンジン (page-type-analyzer.js)"
echo "   - 構造化データ推奨システム (structured-data-recommender.js)"
echo "   - スキーマテンプレート自動生成 (schema-templates.js)"
echo "   - 10種類以上のページタイプ対応 (Article, Product, LocalBusiness等)"
echo "   - 具体的なJSON-LD実装例の自動生成"
echo "   - 新しい構造化データ専用UIタブ追加"
echo ""
echo "🧪 テスト用URL例:"
echo "   POST https://api.checkseoaio.com/api/check/seo"
echo "   POST https://api.checkseoaio.com/api/report/seo"
