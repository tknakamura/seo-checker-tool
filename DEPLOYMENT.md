# Render.com デプロイ手順書

## 🚀 デプロイの準備

### 1. GitHubリポジトリの準備

```bash
# 現在のディレクトリでGitリポジトリを初期化（まだの場合）
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit for Render.com deployment"

# GitHubリポジトリを作成し、リモートを追加
# GitHub上でリポジトリを作成後、以下のコマンドを実行
git remote add origin https://github.com/YOUR_USERNAME/seo-checker-tool.git

# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

### 2. Render.comアカウントの準備

1. [Render.com](https://render.com)にアクセス
2. GitHubアカウントでサインアップ/ログイン
3. GitHubリポジトリへのアクセス権限を許可

## 🌐 Render.comでのデプロイ

### 1. 新しいWebサービスを作成

1. Render.comダッシュボードで「New +」をクリック
2. 「Web Service」を選択
3. GitHubリポジトリを選択
4. 以下の設定を入力：

#### 基本設定
- **Name**: `seo-checker-tool`
- **Environment**: `Node`
- **Region**: `Oregon (US West)` または `Frankfurt (EU Central)`
- **Branch**: `main`
- **Root Directory**: `/` (空のまま)

#### ビルド・デプロイ設定
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### 環境変数
```
NODE_ENV=production
PORT=3001
```

### 2. 高度な設定（オプション）

#### ヘルスチェック
- **Health Check Path**: `/`

#### 自動デプロイ
- **Auto-Deploy**: `Yes` (推奨)

#### スケーリング
- **Plan**: `Free` (開発用) または `Starter` (本番用)

### 3. デプロイの実行

1. 「Create Web Service」をクリック
2. ビルドプロセスが開始されます（5-10分程度）
3. デプロイ完了後、提供されたURLでアクセス可能

## 🔧 デプロイ後の設定

### 1. ドメインの確認

デプロイ完了後、以下のURLでアクセスできます：
- **Webインターフェース**: `https://seo-checker-tool.onrender.com`
- **API エンドポイント**: `https://seo-checker-tool.onrender.com/api/check/seo`

### 2. 動作確認

1. Webインターフェースにアクセス
2. テスト用URL（例：`https://example.com`）を入力
3. SEOチェックが正常に動作することを確認

### 3. カスタムドメイン（オプション）

1. Render.comダッシュボードでサービスを選択
2. 「Settings」タブをクリック
3. 「Custom Domains」セクションでドメインを追加
4. DNS設定を更新

## 🐛 トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドエラー
```
Error: Cannot find module 'xxx'
```
**解決方法**: `package.json`の依存関係を確認し、`npm install`を実行

#### 2. ポートエラー
```
Error: listen EADDRINUSE :::3001
```
**解決方法**: 環境変数`PORT`が正しく設定されているか確認

#### 3. CORSエラー
```
Access to fetch at 'xxx' from origin 'xxx' has been blocked by CORS policy
```
**解決方法**: `index.js`のCORS設定で本番ドメインが許可されているか確認

#### 4. メモリ不足エラー
```
JavaScript heap out of memory
```
**解決方法**: Render.comのプランをアップグレードするか、メモリ使用量を最適化

### ログの確認

1. Render.comダッシュボードでサービスを選択
2. 「Logs」タブをクリック
3. リアルタイムログを確認

## 📊 パフォーマンス最適化

### 1. メモリ使用量の最適化

- 不要な依存関係を削除
- 画像やファイルのサイズを最適化
- キャッシュ機能を実装

### 2. レスポンス時間の改善

- データベースクエリの最適化
- CDNの使用
- 静的ファイルの圧縮

### 3. スケーリング

- 必要に応じてプランをアップグレード
- 負荷分散の設定
- 自動スケーリングの有効化

## 🔒 セキュリティ設定

### 1. 環境変数の保護

- 機密情報は環境変数で管理
- `.env`ファイルを`.gitignore`に追加
- 本番環境では強力なパスワードを使用

### 2. HTTPSの有効化

- Render.comでは自動的にHTTPSが有効
- カスタムドメインでもSSL証明書が自動発行

### 3. アクセス制御

- 必要に応じて認証機能を実装
- APIレート制限の設定
- IPアドレス制限の実装

## 📈 監視とメンテナンス

### 1. ヘルスチェック

- 定期的なヘルスチェックの実行
- アラートの設定
- ダウンタイムの監視

### 2. バックアップ

- データベースの定期バックアップ
- 設定ファイルのバックアップ
- 災害復旧計画の策定

### 3. アップデート

- 依存関係の定期更新
- セキュリティパッチの適用
- 機能の継続的改善

## 🆘 サポート

### 1. Render.comサポート

- [Render.com Documentation](https://render.com/docs)
- [Render.com Support](https://render.com/support)

### 2. プロジェクトサポート

- GitHub Issuesでバグレポート
- 機能リクエストの提出
- コミュニティフォーラムでの質問

---

**注意**: この手順書は一般的なデプロイ手順です。プロジェクトの特定の要件に応じて調整してください。
