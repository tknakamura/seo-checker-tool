# GitHub認証設定ガイド

## 🔑 Personal Access Token作成手順

### 1️⃣ GitHubでトークン作成
1. GitHub にログイン
2. **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)** をクリック
4. 設定:
   - **Note**: `SEO Checker Deploy`
   - **Expiration**: `90 days` または `No expiration`
   - **Scopes**: ✅ `repo` (Full control of private repositories)
5. **Generate token** をクリック
6. 🔴 **重要**: 表示されたトークンをコピー（再表示されません）

### 2️⃣ ローカルでトークン使用
```bash
# リモートURLを更新（トークン付き）
git remote set-url origin https://[YOUR_TOKEN]@github.com/tknakamura/seo-checker-tool.git

# プッシュ実行
git push -u origin main
```

### 3️⃣ render.com自動デプロイ
- プッシュ完了後、render.com で自動ビルドが開始
- https://dashboard.render.com/web/srv-d37ku07fte5s73bclpsg で進行状況確認

---

## 🔄 代替方法

### Option A: SSH認証
```bash
# SSH キー生成（未設定の場合）
ssh-keygen -t ed25519 -C "seo@checkseoaio.com"

# SSH キーをGitHubに追加
# ~/.ssh/id_ed25519.pub の内容をGitHub Settings > SSH and GPG keys に追加

# リモートURLをSSHに変更
git remote set-url origin git@github.com:tknakamura/seo-checker-tool.git
```

### Option B: GitHub Desktop使用
1. GitHub Desktop をダウンロード
2. リポジトリをクローン
3. 変更をコミット・プッシュ

---

## ✅ デプロイ確認

### プッシュ成功後の確認項目
1. **GitHub**: リポジトリに analysis/seo-checker/ が追加されている
2. **render.com**: 自動ビルド開始の確認
3. **動作テスト**: 全角文字数カウント機能の確認

### 動作確認コマンド例
```bash
# render.comのURLでテスト
curl -X POST https://[render.comのURL]/api/check/seo \
  -H "Content-Type: application/json" \
  -d '{"html":"<title>メルカリSEO対策完全ガイド｜初心者向け</title>"}'
```

期待される結果: **約20全角文字**として認識
