# Changelog

## [2.0.1] - 2026-05-24 — Phase 1.4: 品質ゲート強化 (lighthouse除去 / ESLint / npm audit)

中村さん側で送られた「Phase 1.4 積み残し」を一気に解消。

### 🔧 lighthouse の ESM 干渉を解消
- `index.js` の `const lighthouse = require('lighthouse')` を **完全除去**
  - lighthouse v10+ は ESM-only。CommonJS の `require` で `ERR_REQUIRE_ESM` を起こし、
    `__tests__/integration.test.js` `api.test.js` `fullwidth-length.test.js` の
    3本がスキップされていた根本原因
  - 実コードでは1度も使われていない残骸だったため、依存ごと削除しても影響なし
  - 将来 Lighthouse 連携を入れる場合は dynamic import を使うこと
    (`const { default: lighthouse } = await import('lighthouse')`)
- `package.json` の `dependencies` から `"lighthouse": "^12.8.1"` を削除
  - npm install 時間の短縮、本番イメージサイズ縮小にも貢献

### ✨ 既存テスト3本を再開
- `__tests__/integration.test.js`
- `__tests__/api.test.js`
- `__tests__/fullwidth-length.test.js`
- これら3本は Phase 1.3 で除外していたが本PRで復活
- CI workflow も `npm test` で全件実行するよう変更

### 🆕 回帰防止テスト
- `__tests__/no-cjs-esm-conflict.test.js` を新規追加
  - `index.js` が `require('lighthouse')` をコードに含まないこと
  - `require('../index.js')` がエラーなく動作すること
  - `SEOChecker.checkSEO(html)` が ESMエラーなしで実行できること
  - HTMLペースト時 llmsTxtCompliance が安全にスキップされること

### 🔧 ESLint を CI に追加
- `.eslintrc.json` を新規追加
  - `eslint:recommended` ベース、warning レベルで gradual adoption
  - `client/` `analysis/` `public/index.html` などは除外
  - `no-unused-vars` は `^_` プレフィックスを無視
- CI に `lint` ジョブを追加（`npm run lint`）
  - `package.json` の `"lint": "eslint ."` をそのまま実行

### 🔧 npm audit を CI に追加
- CI に `audit` ジョブを追加
  - `npm audit --omit=dev --audit-level=high` で本番依存のみの high 以上を検出 → 失敗
  - dev も含めた `low` 以上は情報用に常時出力（失敗しない）
  - production の脆弱性は可視化＆強制、dev のは noise を減らす

### 🤖 CI Workflow 構成 (.github/workflows/ci.yml)
- ジョブ4本に整理:
  - `test` (Node **20.x / 22.x** マトリクス): `npm test` + `npm run typecheck`
  - `lint`: `npm run lint`
  - `audit`: `npm audit --omit=dev --audit-level=high`
  - `client-typecheck`: client/ の `npx tsc -b`

### 🔥 PR #6 review round 1（CI green 化）

初回 push で Test (Node 18.x / 20.x) と npm audit の 3 ジョブが落ちたため、
レビュー対応として以下を追加。

#### 🟠 Node 18 サポート終了
- `cheerio@1.x` が内部で `undici` をロード → `undici` が `globalThis.File` を参照
  → **Node 18 では `File` 未定義** で `ReferenceError: File is not defined`
  → `index.js` の require 自体が失敗し、4 テストスーツが連鎖失敗
- Node 18 は 2025-04 に EOL（2026 年 5 月時点でサポート切れ）のため、
  サポート対象を **Node 20 LTS 以上** に揃える方が筋が良いと判断
  - `engines.node`: `>=18.0.0` → `>=20.0.0`
  - `engines.npm`: `>=8.0.0` → `>=10.0.0`
  - CI matrix: `[18.x, 20.x]` → `[20.x, 22.x]`（Node 22 LTS も追加）

#### 🔴 fullwidth-length.test.js の期待値バグ修正
- `SEO対策` の期待値 `4.5` は実装と不整合
  - 仕様: 半角 0.5 / 全角 1.0 → 計算結果は **3.5**（S+E+O=1.5 + 対+策=2.0）
  - テスト側を `3.5` に修正、コメントで計算根拠を明記

#### 🟠 jest worker のクリーン exit
- `index.js` の memory monitor `setInterval(...)` に `.unref()` を追加
  - 本番動作には影響しない（active handle がなければ event loop が終了するだけ）
  - jest が `"A worker process has failed to exit gracefully"` 警告を出さなくなる

#### 🔴 npm audit を 0 vulnerabilities に
本番依存の脆弱性 8 high + 1 critical を **すべて解消**:
- **未使用 dependency を削除**: `nodemailer` `googleapis` `natural` `cron`
  `redis` `helmet` の 6 パッケージ。コード grep で require が0件であることを確認
  - これだけで Nodemailer high×4、uuid moderate（googleapis/natural経由）が消える
- **直接依存の bump**:
  - `axios` `^1.6.0` → `^1.16.0`（CVE GHSA: SSRF / DoS）
  - `express` `^4.18.2` → `^4.22.2`（path-to-regexp / qs / body-parser fix）
  - `mongoose` `^8.0.0` → `^8.24.0`
- **`overrides` で推移依存を強制更新**:
  - `basic-ftp` → `^6.0.1`（critical: path traversal / CRLF injection）
  - `undici` → `^6.21.4`（high×6: smuggling / DoS / CRLF injection）
  - `path-to-regexp` → `^0.1.13`（high: ReDoS）
  - `underscore` → `^1.13.7`（high: DoS）
  - `ws` → `^8.21.0`（moderate: 未初期化メモリ開示）
  - `ip-address` → `^10.2.0`（moderate: XSS）
  - `js-yaml` → `^4.1.1`（moderate: prototype pollution）
- **ローカル検証結果**:
  - `npm audit --omit=dev --audit-level=high`: **found 0 vulnerabilities**
  - `npm audit`（dev込み）: **found 0 vulnerabilities**
  - `npm test`: **7 suites / 197 tests PASS**
  - `npm run lint`: 0 errors, 43 warnings（warning は許容）
  - `npm run typecheck`: PASS

### 📦 Breaking Changes
- **Node 18 サポート終了**: Node 20+ が必要。Render の Node ランタイムは
  自動で 20+ が選ばれるので本番影響なし
- **未使用 deps 削除**: `nodemailer` 等を将来使う場合は再 install が必要
- それ以外は patch/minor bump のみで API 互換

### 📦 version bump
`2.0.0` → `2.0.1` (patch: quality gates 強化、機能追加なし)

---

## [2.0.0] - 2026-05-23 — Phase 2-A: llms.txt 対応チェック

### ✨ 新機能: llms.txt 診断

[llmstxt.org](https://llmstxt.org/) 標準（Answer.AI / Jeremy Howard 提案）に準拠した
AI/LLM 向けサイト情報ファイル `llms.txt` の対応状況を診断する機能を追加しました。
ChatGPT・Claude・Perplexity 等の生成AI検索で引用される確率を高める、2025年のAIO最先端シグナルです。

### 🆕 `llms-txt-checker.js` (新規モジュール)
- `https://example.com/llms.txt` の HTTP フェッチと存在チェック
- `https://example.com/llms-full.txt`（フルテキスト版）の有無チェック
- llms.txt の Markdown 構造を解析:
  - **H1 タイトル** の存在・単一性
  - **サマリー**（blockquote）の存在
  - **H2 セクション** の存在と各セクションのリンク数
  - リンクが Markdown 形式 `[text](url)` か
- `robots.txt` の AIクローラー許可状況を解析:
  - GPTBot / OAI-SearchBot / ChatGPT-User / ClaudeBot / anthropic-ai / PerplexityBot /
    Google-Extended / CCBot / cohere-ai / Bytespider 等10種類を判定
  - `Disallow: /` で全パス拒否のみを `disallowed` とし、限定パス拒否は `allowed` と
    厳密に判定（過剰警告を回避）
- スコア配点 (0-100):
  - llms.txt 存在: 50点
  - H1 タイトル: 10点
  - サマリー: 10点
  - H2 セクション: 15点
  - llms-full.txt: 5点
  - AIクローラー全許可: 10点

### 🆕 AIO カテゴリ追加: `llmsTxtCompliance`
- `aio-checker.js` の6カテゴリに **7番目のカテゴリ** として統合
- AIO 総合スコアの **15% の比重** を占める（既存6カテゴリの合計 85% に再配分）
- HTTP フェッチが必要なため async 処理に変更し、既存6カテゴリと並列実行
- URL未指定（HTMLペースト診断）時は安全にスキップ
- フェッチ失敗時は AIO チェック全体を落とさず警告を残す

### 🆕 `enhanced-reporter.js` に llms.txt 推奨アクション追加
- 9種類の issue キーマッピング:
  - `llmstxt_missing` / `llmstxt_no_title` / `llmstxt_multiple_h1` /
    `llmstxt_no_summary` / `llmstxt_no_section` / `llmstxt_no_links` /
    `llmstxt_robots_block_ai` / `llmstxt_invalid_url` / `llmstxt_check_error`
- すべてに具体的な **fix メッセージ**、**コード例**、**docLink** を実装
- llms.txt フルテンプレ（17行）と robots.txt 推奨設定（15行）のサンプル
- **先食い問題の予防**: issue文に「タイトル」「H2」を含むため、Phase 1.1 と同様
  `llms.txt` を最優先判定で確定（regression テスト含む）

### 🎨 UI 統合
- `public/index.html`: AIO詳細タブの `aioCategories` に「llms.txt 対応」を追加
- `client/src/components/tabs/AIOTab.tsx`: 同上（React版）
- `client/src/utils/helpers.ts`: `getCategoryTitle` に llmsTxtCompliance を追加
- `public/index.html` の `getCategoryTitle` も同期

### 🧪 テスト
- `__tests__/llms-txt.test.js` 新規追加（25+項目）
- node 単体テストで **35/35 PASS** 確認済み

### ✅ 実機検証

| サイト | found | スコア | 備考 |
|---|---|---|---|
| `https://llmstxt.org/` | ✅ | 95/100 | ほぼ満点 |
| `https://docs.anthropic.com/` | ✅ | 85/100 | サマリー欠落のみ |
| `https://anthropic.com/` | ❌ | 10/100 | llms.txt 無し |
| `https://ads.mercari.com/` | ❌ | 10/100 | llms.txt 無し |

### 📦 Breaking Changes
なし。新カテゴリ追加で AIO スコアの重みが再配分されるため、過去スコアと若干差が出ます。

### 📦 version bump
`1.3.0` → `2.0.0` (root + client)。Phase 2 シリーズ初の機能追加として major bump。

---

## [1.3.0] - 2026-05-23 — Phase 1.3

### 🔧 レビュー対応（PR #4 review round 1）
- 🔴 GitHub Actions CI を green 化
  - `npm test` → `npx jest __tests__/recommendations.test.js __tests__/seo-coverage.test.js`
    （`lighthouse` の ESM 依存で動かない `integration` / `api` / `fullwidth-length` を一旦除外、ESM 対応は Phase 1.4 へ送り）
  - `client-typecheck` ジョブ用に `client/package-lock.json` を生成・コミット
  - 名称を `Test & Lint` → `Test` に修正（lint ステップが無いため）、matrix の `fail-fast: false` 追加
- 🟠 `client/src/components/tabs/SummaryTab.tsx` の `WarningsBanner` を `makeWarningKey` で安定キー化（`key={i}` を解消）

---

## [1.3.0] - 2026-05-23 — Phase 1.3 (initial): a11y強化 / React版整合 / CI

### ♿ アクセシビリティ強化
- **警告バナー**: `role="region"` + 各アラートに `role="alert"` / `aria-live="polite"` を付与
  - スクリーンリーダーがフォールバック発生を即座に読み上げ
- **推奨アクションのトグル**: `<div>` → `<button type="button">` 化
  - `aria-expanded` / `aria-controls` でパネル状態をARIA属性に同期
  - キーボード操作（Tab/Enter/Space）が標準対応
  - `:focus-visible` で青のフォーカスリングを表示
  - `aria-hidden="true"` で装飾アイコン（✓/▼）をスクリーンリーダーから隠す
  - 優先度バッジに `aria-label="優先度: Critical"` を付与
- vanilla / React 両方で同様の対応

### 🎨 React 版 Claw 風スタイル追従
- `client/src/index.css` を vanilla版 (`public/index.html`) と同じデザイントークン体系に統一
  - 22KB の Claw inspired theme をそのまま採用
  - 紫グラデーション、影、彩度高めの優先度色を全廃
- `client/src/components/Header.tsx`: `<header>` 要素化、文言を vanilla版と合わせる
- `client/src/components/tabs/SummaryTab.tsx` を Phase 1.1/1.3 仕様に追従:
  - `<button>` ベースのアクセシブルな展開UI
  - 装飾絵文字（📊🎯💡📖）を削除
  - 警告バナーの React 実装（vanilla版と機能パリティ）
  - `useId()` でユニークパネルID生成
  - **`key={i}` → 安定キー** (`makeStableKey`) でstate漏れを防止（Phase 1 review 積み残し対応）

### 🧰 型定義
- `client/src/types.ts`: `WarningEntry` 型を新規追加、`SEOCheckResult.warnings` を型付き対応

### 🤖 CI ワークフロー
- `.github/workflows/ci.yml` を新規追加
  - `npm test` (jest 143項目) を Node 18.x / 20.x マトリクスで実行
  - root の `npm run typecheck` (tsc --noEmit)
  - client の `npx tsc -b` でReact側の型を検証
  - PR/push トリガー、同一PRで複数pushされたら古いjobをキャンセル
  - Puppeteer Chrome 自動ダウンロードを `PUPPETEER_SKIP_DOWNLOAD=true` でスキップ

### 🧹 .gitignore 整理
- Gatsby テンプレート由来の `public` 除外設定を削除
  - このプロジェクトは Express の静的配信に `public/` を使うため track 必須
  - 削除と同時にコメントで再追加防止の注意書きを記載
- 以降は `git add public/index.html` で警告が出ない

### 📦 Breaking Changes
なし。型追加・属性追加のみで、既存クライアントの動作に影響しません。

---

## [1.2.0] - 2026-05-23 — Phase 1.2: Claw 風 UI リブランド

### 🎨 UI リブランド（`public/index.html`、+668 / -1098）
- ヘッダーから `🩺` 絵文字を撤去し、白背景 + 細い下線のミニマルデザインへ
- カードシャドウを全廃、角丸を 8px に統一
- 配色を紫グラデから Claw 系の青 (#2563eb) に変更
- 優先度バッジを **英語化**: 緊急/高/中/低 → **Critical / High / Medium / Low**
- スコア表示を大型紫ブロック → サマリー3カードに統一
- コードブロックをダーク (#282c34) → ライト (#f8f8f8) に
- タブ・見出しの装飾絵文字を最小化（📊🎯⚡等を撤去）
- CSS は大幅にスリム化（実質 -430 行）

### 🔧 整合性修正（レビュー対応）
- `client/src/components/Header.tsx` の h1 から `🩺` 絵文字を撤去（`public/index.html` と統一）
- `client/src/utils/helpers.ts` の `getPriorityTitle` / `getPriorityTitleLong` を Critical/High/Medium/Low に揃え、React 版とも整合
- `public/index.html` 内に重複していた `getPriorityTitle` を 1 箇所に整理（行 1798 側を削除）
- `package.json` / `client/package.json` を `1.1.0` → `1.2.0` に bump

### 📦 Breaking Changes
- なし。表示文言のみの変更で API レスポンス形状や URL は不変。

### 📝 次回予定（Phase 1.3 候補）
- a11y 強化（`role="alert"` / `aria-live` / `aria-expanded` / `<button>` 化）
- React 版 `SummaryTab.tsx` の Claw 風スタイル追従
- llms.txt 対応チェック / 競合URL比較モード

---

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
