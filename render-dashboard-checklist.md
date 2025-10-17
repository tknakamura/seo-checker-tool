# render.com ダッシュボード確認チェックリスト

## 🔍 確認URL
https://dashboard.render.com/web/srv-d37ku07fte5s73bclpsg

## 📋 確認項目

### 1️⃣ リポジトリ接続状況
**Settings** → **Build & Deploy**

- [ ] **Connected Repository**: `github.com/[ユーザー名]/[リポジトリ名]`
- [ ] **Branch**: `main` または `master`  
- [ ] **Auto-Deploy**: `Enabled` / `Disabled`

### 2️⃣ ビルド設定
**Settings** → **Build & Deploy**

- [ ] **Build Command**: `npm install`
- [ ] **Start Command**: `npm start`
- [ ] **Node Version**: `18` または `20` (推奨)

### 3️⃣ 環境変数
**Environment** タブ

- [ ] **NODE_ENV**: `production`
- [ ] **PORT**: 自動設定（通常は不要）

### 4️⃣ デプロイ履歴
**Deploys** タブ

- [ ] 最新デプロイ状況
- [ ] ビルドログの確認
- [ ] エラーの有無

---

## 🚀 デプロイ実行方法

### ✅ Case A: GitHubリポジトリ接続済み
```bash
./deploy-to-existing-repo.sh
```

### ✅ Case B: 新規リポジトリ作成が必要
```bash
./create-new-repo-deploy.sh
```

### ✅ Case C: 手動設定変更
render.comダッシュボードで:
1. Settings → Build & Deploy
2. Connected Repository を変更
3. Manual Deploy をクリック

---

## 🧪 デプロイ後の動作確認

### 全角文字数カウント機能テスト
```bash
# render.comのURLに置き換えて実行
curl -X POST https://[あなたのrender.comURL]/api/check/seo \
  -H "Content-Type: application/json" \
  -d '{"html":"<title>メルカリSEO対策完全ガイド｜初心者向け</title><meta name=\"description\" content=\"全角文字数カウント機能のテストです。\""}'
```

### 期待される結果
- Title Tag: 約20全角文字として認識
- Meta Description: 約18全角文字として認識
- 問題があれば適切な推奨事項が表示

---

## 📞 サポート情報

### render.com ドキュメント
- [デプロイガイド](https://render.com/docs/deploys)
- [Node.js設定](https://render.com/docs/node-version)
- [環境変数](https://render.com/docs/environment-variables)

### 全角文字数カウント修正内容
- Title Tag: 15-30全角文字基準
- Meta Description: 60-80全角文字基準  
- 半角文字: 0.5文字カウント
- 全角文字: 1文字カウント
