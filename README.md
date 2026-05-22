# 🩺 SEO AIO Doctor

WebページのSEO（検索エンジン最適化）とAIO（AI検索最適化）を一括診断する、日本語対応のオールインワン診断ツールです。
ChatGPT・Perplexity・Google AI Overviews など生成AI時代の検索に対応するための具体的な改善アクションを提示します。

🌐 **公開デモ**: https://seo-checker-tool.onrender.com/

## 🚀 特徴

- **SEO + AIO デュアル診断**: 従来SEOに加え、AI検索エンジンに引用されやすくする AIO 視点で評価
- **具体的な修正提案**: 「適切な修正を行ってください」ではなく、**修正例コード（JSON-LD等）と参考リンク付き**で提示
- **6つのAIO観点**: コンテンツ包括性 / 構造化情報 / 信頼性シグナル / AI検索最適化 / 自然言語品質 / コンテキスト関連性
- **日本語文字化け対応**: UTF-8, Shift_JIS, EUC-JP, ISO-2022-JP を自動判定
- **リアルタイム診断**: URL or HTML直接貼付で即時チェック
- **JavaScript対応**: Puppeteer によるレンダリング後の動的コンテンツも診断可能

## 📋 機能

### SEOチェック項目
- タイトルタグ（長さ、重複、フォーマット）
- メタディスクリプション（長さ、品質）
- 見出し構造（H1-H6 階層、重複検出）
- 内部リンク・外部リンク
- 画像のalt属性（不足、空、長すぎ、不要語句）
- 構造化データ（JSON-LD、推奨スキーマ判定）
- URL構造、viewport、noindex、HTTPS

### AIO（AI最適化）チェック項目
- 本文ボリュームと段落構造
- FAQ / HowTo / 定義リスト / 比較表
- 著者・公開日・引用・連絡先
- 質問形式・数値データ
- 文章の読みやすさ（文長・専門用語・受動態・接続詞）
- URL・内部リンク・カテゴリの文脈関連性

### 日本語対応
- 文字エンコーディング自動検出（UTF-8, Shift_JIS, EUC-JP, ISO-2022-JP）
- 文字化け文字の自動修正
- 全角ベースの文字数カウント（タイトル/ディスクリプション）

## 🛠️ セットアップ

### 必要要件
- Node.js 18.0.0以上
- npm 8.0.0以上

### インストール
```bash
# リポジトリをクローン
git clone https://github.com/tknakamura/seo-checker-tool.git
cd seo-checker-tool

# 依存関係をインストール
npm install
```

### 起動
```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

## 🌐 使用方法

### Webインターフェース
1. ブラウザで `http://localhost:3001` にアクセス
2. チェックしたいURLを入力
3. 「SEOチェック実行」ボタンをクリック
4. 結果を確認

### API使用
```bash
curl -X POST http://localhost:3001/api/check/seo \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## 📁 プロジェクト構成

```
mercari-seo-checker-tool/
├── index.js              # メインサーバーファイル
├── detailed-analyzer.js  # 詳細分析機能
├── enhanced-reporter.js  # レポート生成機能
├── public/
│   └── index.html        # フロントエンド
├── logs/                 # ログファイル
├── package.json          # 依存関係
└── README.md            # このファイル
```

## 🔧 設定

### 環境変数
```bash
PORT=3001                 # サーバーポート（Render では自動設定）
LOG_LEVEL=info           # ログレベル
NODE_ENV=development     # 環境
CORS_ORIGIN=https://...  # 本番で別オリジンから API を呼ぶ場合
```

### 設定ファイル
- `seo-config.json`: SEO/AIO のしきい値（タイトル長・メタ説明長・待機時間など）。省略時はコード内デフォルトを使用
- `config.production.js`: 本番環境設定
- `deploy.sh` / `deploy-render.sh`: デプロイスクリプト

## 📊 ログ

ログは `logs/` ディレクトリに保存されます：
- `seo-checker.log`: メインログ
- ログレベル: info, warn, error

## 🚀 デプロイ

### Render.com でリリース
1. [Render](https://render.com) にログインし、**New → Web Service** を選択
2. このリポジトリ（GitHub）を接続し、ブランチ `main` を指定
3. 設定例: **Build Command** `npm install`、**Start Command** `npm start`
4. **Environment**: `NODE_ENV=production`（PORT は Render が自動設定）
5. **Deploy** 後、`https://<サービス名>.onrender.com` でアクセス可能
6. オプション: 環境変数に `CORS_ORIGIN`（フロントの URL）、`MONGODB_URI`（履歴保存用）を追加可能

詳細は [render.yaml](render.yaml) および [render-dashboard-checklist.md](render-dashboard-checklist.md) を参照。

### 本番環境（その他）
```bash
# デプロイスクリプト実行
./deploy.sh

# または手動デプロイ
npm run build
npm start
```

### Docker（オプション）
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 貢献

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🆘 サポート

問題が発生した場合：
1. [Issues](https://github.com/mercari/mercari-seo-checker-tool/issues) で既存の問題を確認
2. 新しいIssueを作成
3. ログファイルを添付

## 📈 更新履歴

### v1.0.0
- 初回リリース
- 日本語文字化け対応
- 基本的なSEOチェック機能
- Webインターフェース
- API エンドポイント

---

**Mercari Japan Team** - SEOチェックツール