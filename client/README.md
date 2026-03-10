# SEOチェッカーツール フロントエンド (React)

Vite + React + TypeScript で構築されたフロントエンドです。

## セットアップ

```bash
cd client
npm install
```

## 開発

```bash
npm run dev
```

開発サーバーは http://localhost:5173 で起動します。API は http://localhost:3001 にプロキシされます。バックエンドを別ターミナルで `npm run dev` して起動してください。

## ビルド

```bash
npm run build
```

ビルド成果物は `../public` に出力され、Express サーバーから配信されます。ルートの `npm run build:client` でインストールとビルドを一括実行できます。
