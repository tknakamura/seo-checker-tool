# 🚀 Render.com クイックスタートガイド

## 5分でデプロイ完了！

### ステップ1: GitHubにプッシュ
```bash
git add .
git commit -m "Deploy to Render.com"
git push origin main
```

### ステップ2: Render.comでサービス作成
1. [Render.com](https://render.com) → "New +" → "Web Service"
2. GitHubリポジトリを選択
3. 設定を入力：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
4. "Create Web Service" をクリック

### ステップ3: 完了！
- 5-10分でデプロイ完了
- 提供されたURLでアクセス可能
- 自動的にHTTPS対応

## 🔧 環境変数（必要に応じて）

```
NODE_ENV=production
PORT=3001
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
