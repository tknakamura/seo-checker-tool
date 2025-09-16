# 🚀 Render.com クイックスタートガイド（Docker版）

## 5分でデプロイ完了！

### ステップ1: GitHubにプッシュ
```bash
git add .
git commit -m "Deploy to Render.com with Docker"
git push origin main
```

### ステップ2: Render.comでサービス作成
1. [Render.com](https://render.com) → "New +" → "Web Service"
2. GitHubリポジトリを選択
3. 設定を入力：
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: `Free` (または `Starter`)
4. "Create Web Service" をクリック

### ステップ3: 完了！
- 10-15分でデプロイ完了（Dockerビルド時間含む）
- 提供されたURLでアクセス可能
- 自動的にHTTPS対応
- Puppeteer（Lighthouse）が正常に動作

## 🔧 環境変数（自動設定）

```
NODE_ENV=production
PORT=3001
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 📱 アクセス方法

デプロイ完了後：
- **Webインターフェース**: `https://your-app-name.onrender.com`
- **API**: `https://your-app-name.onrender.com/api/check/seo`

## ✅ 動作確認

1. Webインターフェースにアクセス
2. テストURL（例：`https://example.com`）を入力
3. SEOチェックを実行

## 🆘 問題が発生した場合

1. Render.comダッシュボードの「Logs」を確認
2. ビルドエラーの場合は依存関係をチェック
3. 詳細は `DEPLOYMENT.md` を参照

---

**🎉 おめでとうございます！SEOチェッカーツールが本番環境で稼働しています！**
