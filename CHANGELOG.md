# Changelog

## [1.1.1] - 2026-05-23 — Phase 1.1: SEO残存フォールバック解消 & Advanced Check 安定化

### 🎯 解決した問題
Phase 1 リリース後の本番チェック（ads.mercari.com）で以下が判明:
1. AIO はカバーしたが SEO 側に「適切な修正を行ってください」が6件残存していた
2. Advanced Check (JavaScript実行モード) が Render free plan で 502 エラー
3. JS実行できないSPAサイトでは見出し・画像・構造化データが全て検出不能

### ✨ 追加 / 改善

#### 残存フォールバックの解消（SEO側 30 種以上を新規追加）
- `enhanced-reporter.js`
  - `getIssueKey`: 見出し、画像、リンク、各種スキーマ、viewport、URL、タッチターゲット等を網羅
  - `getConciseFix`: 同上、それぞれに具体メッセージを実装
  - `getCodeExample`: LocalBusiness / BreadcrumbList / Product / WebSite / Organization 等のスキーマ実装サンプル、H2/H3 階層サンプル、viewport、タッチターゲット用CSS等を追加
  - `getDocLink`: 具体スキーマ専用ドキュメントを最優先で判定するよう順序を変更
  - **最終フォールバック改良**: マッピング漏れがあっても、元のissue文＋カテゴリ別ヒント（例: 「タイトルタグの見直しが必要です（15〜30全角文字、固有のキーワードを含む）」）を返す `getCategoryHint()` メソッドを新規追加。「適切な修正を行ってください」が二度と表示されないよう保証

#### Advanced Check (Puppeteer) の安定化
- `index.js#fetchHTMLWithPuppeteer`
  - **画像 / フォント / メディアのリソースをブロック** （メモリ削減・高速化）
  - **トラッキング系ドメイン（GA, GTM, doubleclick, Facebook 等）をブロック**
  - `waitUntil` を `networkidle2` → `domcontentloaded` に変更（SPAで終わらない問題を解消）
  - `waitForNetworkIdle` の追加待機を `jsWaitTime` 上限付きで実施
  - ビューポートを 1280x800 に固定（省メモリ）
- `index.js#checkSEO`
  - **Advanced Check 失敗時に自動的に Simple Check にフォールバック**
  - フォールバックが起きた場合は `results.warnings` に `ADVANCED_FALLBACK_TO_SIMPLE` 警告を含めて 200 で返す（502 ではなく）
  - Simple Check も失敗した場合のみ明示的なエラー
- `seo-config.json`: `jsTimeout` を 30s → 20s、`jsWaitTime` を 3s → 2.5s に短縮

#### UI改善
- `public/index.html`: サマリータブ冒頭に **警告バナー** を表示（フォールバック時にユーザーへ通知）
  - 警告コード（`ADVANCED_FALLBACK_TO_SIMPLE`）、メッセージ、詳細を見られる折りたたみ式
  - SPA 系サイトで Simple Check の結果が出ても誤解しないよう注意喚起

#### テスト
- `__tests__/seo-coverage.test.js` 新規（SEO 30種類 + 最終フォールバック挙動を担保）
- node 単体で 55/55 PASS 確認

### 📦 Breaking Changes
- なし。`results.warnings` は optional フィールドで既存クライアントの動作に影響しません。

---

## [1.1.0] - 2026-05-23 — Phase 1: AIO Doctor リブランド & 推奨アクション具体化

### 🔧 レビュー対応（PR #1 review round 1）
- 🔴 `public/index.html` で `rec.fix` `rec.element` `rec.location` に `escapeHtml` を適用（HTMLタグを含む文言の表示崩れを修正）
- 🟠 クリック領域を `.recommendation-header` のみに限定し、`<pre><code>` のコピーが可能に
- 🟠 展開エリア `.recommendation-extra` で `stopPropagation` してテキスト選択時の意図しない折りたたみを防止
- 🟠 リブランド取り残しを解消（`client/package.json`、`README.md` の構造図・サポートリンク・著者表記、`openapi.yaml`、起動ログ、`render.yaml` のコメント）
- 🟠 件数表示の二重化を解消（`description` への `(N件)` 付与をやめ、count-info に統一）
- 🟠 `getDocLink` のカバレッジ穴を解消（AI検索スキーマ不足、比較、専門用語、受動態、接続詞、URL関連性、カテゴリ等を網羅）
- 🟡 回帰テスト `__tests__/recommendations.test.js` を新規追加（AIO 25種すべてが固有メッセージ・docLinkを返すことを担保）


### 🩺 リブランド
- ツール名を「Mercari SEOチェックツール」から **「SEO AIO Doctor」** に変更
- `package.json`, `README.md`, ヘッダー、ページタイトルを更新
- 著者表記とリポジトリURLを `tknakamura/seo-checker-tool` に修正

### ✨ 追加: 推奨アクションの具体化（最大の改善）
- **AIO関連25種類のissueに対する具体的な修正メッセージを追加**
  - これまで「適切な修正を行ってください」と表示されていた箇所が、各issue固有の実用的なアドバイスに置き換わります
  - 対象: コンテンツ包括性 / 構造化情報 / 信頼性シグナル / AI検索最適化 / 自然言語品質 / コンテキスト関連性
- **修正例コード（codeExample）の追加**
  - JSON-LD（FAQPage / HowTo / Person / Organization）、HTML要素のサンプルを推奨アクションに同梱
  - 主要10種類以上のissueに実装
- **参考ドキュメントリンク（docLink）の追加**
  - Google公式 SEOガイドや MDN等の信頼できる解説への外部リンク
- **AIOカテゴリの要素名・場所名を日本語化**
  - これまで「unknown」と表示されていた箇所が「本文 / 見出し」「FAQ・HowTo・比較セクション」など具体的になります

### 🎨 UI改善
- 推奨アクションの各行をクリックで展開、修正例コードと参考リンクを表示
- SEO / AIO のタイプバッジを追加
- ダークテーマのコードブロック（モノスペース）でスニペットを可読性高く表示
- `public/index.html`（本番）と React clientの両方に同等の機能を実装

### 🔧 内部実装
- `enhanced-reporter.js`
  - `getIssueKey()` に AIO 25種類のキー判定を追加
  - `getConciseFix()` に AIO 25種類の具体メッセージを追加
  - `getCodeExample()` メソッドを新規追加（11種類のスニペット）
  - `getDocLink()` メソッドを新規追加（10種類の参考リンク）
  - `getElementName()` / `getLocationName()` に AIO 6カテゴリを追加
  - `generateConciseRecommendations()` の出力に `codeExample`, `docLink` を含める
- `client/src/types.ts` の `ConciseRecommendation` 型に新フィールドを追加
- `client/src/components/tabs/SummaryTab.tsx` を展開UI対応に書き換え
- `client/src/index.css` / `public/index.html` <style> に新スタイル追加

### 📦 Breaking changes
- なし（新フィールドは optional）

### 📝 次回予定（Phase 2 以降の候補）
- llms.txt 対応チェック
- 競合URL比較モード
- スコア履歴と推移グラフ（MongoDB）
- PDF/CSV/JSON エクスポート
- E-E-A-T シグナル深掘り
- Core Web Vitals 統合
