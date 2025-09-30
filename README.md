# Mercari SEOチェックツール

Mercari Japan向けのSEOチェックツールです。日本語の文字化けに対応し、タイトルタグやメタディスクリプションの品質をチェックできます。

## 🚀 特徴

- **日本語文字化け対応**: 自動的に文字化けを検出・修正
- **リアルタイムSEOチェック**: URLまたはHTMLを直接入力してチェック
- **詳細な分析レポート**: タイトルタグ、メタディスクリプション、見出し構造などを分析
- **スコア評価**: 各要素の品質をスコアで評価
- **改善提案**: 具体的な改善点と推奨アクションを提示

## 📋 機能

### SEOチェック項目
- タイトルタグ（長さ、内容、重複チェック）
- メタディスクリプション（長さ、内容、品質チェック）
- 見出し構造（H1-H6の階層チェック）
- 内部リンク構造
- 画像のalt属性
- ページ速度（Lighthouse連携）

### 日本語対応
- 文字エンコーディング自動検出（UTF-8, Shift_JIS, EUC-JP, ISO-2022-JP）
- 文字化け文字の自動修正
- 日本語文字の正しい表示

## 🛠️ セットアップ

### 必要要件
- Node.js 18.0.0以上
- npm 8.0.0以上

### インストール
```bash
# リポジトリをクローン
git clone https://github.com/mercari/mercari-seo-checker-tool.git
cd mercari-seo-checker-tool

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
PORT=3001                 # サーバーポート
LOG_LEVEL=info           # ログレベル
NODE_ENV=development     # 環境
```

### 設定ファイル
- `config.production.js`: 本番環境設定
- `deploy.sh`: デプロイスクリプト

## 📊 ログ

ログは `logs/` ディレクトリに保存されます：
- `seo-checker.log`: メインログ
- ログレベル: info, warn, error

## 🚀 デプロイ

### 本番環境
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