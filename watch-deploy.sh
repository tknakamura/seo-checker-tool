#!/bin/bash

# ファイル変更を監視して自動デプロイ
# 使用方法: ./watch-deploy.sh

echo "👁️  ファイル変更監視 + 自動デプロイ開始"
echo "📂 監視対象: *.js ファイル"
echo "🛑 停止: Ctrl+C"
echo ""

# 監視対象ファイル
WATCH_FILES=(
    "index.js"
    "aio-checker.js" 
    "detailed-analyzer.js"
    "enhanced-reporter.js"
)

# 最終更新時刻を記録
declare -A last_modified

for file in "${WATCH_FILES[@]}"; do
    if [ -f "$file" ]; then
        last_modified[$file]=$(stat -f %m "$file" 2>/dev/null || echo 0)
    fi
done

echo "🔍 監視開始..."

while true; do
    changed=false
    
    for file in "${WATCH_FILES[@]}"; do
        if [ -f "$file" ]; then
            current_time=$(stat -f %m "$file" 2>/dev/null || echo 0)
            
            if [ "${last_modified[$file]}" != "$current_time" ]; then
                echo ""
                echo "📝 変更検出: $file"
                echo "⏰ $(date)"
                
                last_modified[$file]=$current_time
                changed=true
            fi
        fi
    done
    
    if [ "$changed" = true ]; then
        echo "🚀 自動デプロイ開始..."
        ./deploy-curl.sh
        echo "✅ 自動デプロイ完了"
        echo "🔍 監視再開..."
    fi
    
    sleep 2
done
