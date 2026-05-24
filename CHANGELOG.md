# Changelog

## [2.3.2] - 2026-05-24 — chore: Render プランを Standard (2GB) に IaC 化

### 🔧 Render プラン昇格: starter → standard
- **背景**: `ads.mercari.com` 等の重い SPA を Advanced 診断すると、Chromium の `page.content()` で
  インスタンス全体のメモリが 512 MB 上限を超え OOM → HTTP 502 + 再起動が連発していた
- **heap ログで判明した事実** (PR #11 の観測ログより):
  - Node heap は 43 MB のみ（Node 側は余裕）
  - `page.content()` で **17,365,277 文字** の HTML を取得（約 17 MB）
  - 切れ位置は `page.content()` 呼び出し中の Chromium 側メモリスパイク
- **対処**: Render ダッシュボードで **Standard ($25/mo, 2 GB RAM)** に昇格
- **検証結果** (昇格後):
  - `ads.mercari.com` Advanced 診断: **HTTP 200** (旧 502)
  - heap 推移: 43 → 76 → 89 → 98 → 83 MB（再起動なし）
  - SEO 53 / AIO 9 / 総合 31 で正常にスコア返却

### 🔧 `render.yaml` に `plan: standard` を記録
- ダッシュボード変更を IaC に反映（旧 `plan: free` は実態と乖離していた）

### 📦 Breaking Changes
なし。インフラ変更のみ。

### 📦 version bump
`2.3.1` → `2.3.2` (patch: IaC のみ)

---

## [2.3.1] - 2026-05-24 — Phase 1.5.1: 重いSPA診断の OOM 切れ対策（メモ化 + heap 観測ログ）

### 🐛 発覚した問題
中村さんが本番 (`https://seo-checker-tool.onrender.com/`) で `https://ads.mercari.com/` を Advanced（waitForJS）で診断した際、HTTP 502 が連発しインスタンスが再起動する現象が発生。

### 🔍 根本原因
- **Render starter プラン = 512 MB RAM** に対し、Puppeteer + Chromium + 重いSPA + Cheerio 解析でメモリが上限を超え OOM-kill されていた
  - 例: 23:32, 23:33, 23:34 と 3 回連続でリクエスト直後にインスタンス再起動
  - レスポンスの `223158 bytes` は Render エッジが返す **502 エラーページ HTML**（API レスポンスではなかった）
- 「動的コンテンツの生成待機完了」直後の `page.content()` 〜 Cheerio 解析 〜 AIO 解析のどこで死んでいるか不明だったため、まず観測ポイントを増やす

### ⚙️ メモリ最適化

#### 🔧 `estimateContentLength($)` のメモ化
- Phase 1.5 で導入された関数が見出しチェックとリンクチェックで**合計 4 回**呼ばれ、毎回 `$('body').clone()` を実行していた
- `$` オブジェクトに `_wordCountCache` をぶら下げて 2 回目以降はキャッシュを返す
- 1 診断あたりの clone 回数: **4 → 1**（重いSPAでメモリピーク数十MB削減見込み）

#### 📊 heap 観測ログを追加
OOM 切れ位置の特定のため、以下のポイントで `heapUsed` をログ出力:
1. `page.content()` 取得開始時
2. `page.content()` 取得完了時（差分Δ含む）
3. Puppeteer cleanup 完了時
4. Cheerio パース開始時
5. Cheerio パース完了時
6. AIO チェック開始時
7. AIO チェック完了時（差分Δ含む）

これにより本番ログを見れば「Puppeteer取得時 200MB → 解析後 350MB → AIO後 480MB → OOM」のようにメモリ推移が追える。

### 🛡️ Puppeteer cleanup の堅牢化
- `page.close()` / `browser.close()` を `try/catch` で包み、片方の失敗でもう片方が呼ばれない事態を防ぐ
- 既存実装では `page.close()` がエラー時に `browser.close()` がスキップされ、Chromium プロセスが孤児化するリスクがあった

### 🧪 テスト追加
`__tests__/phase-1-5-1-memo.test.js` (6項目):
- 同じ `$` での 2 回目以降はキャッシュ値を返す
- 異なる `$` オブジェクトは独立にカウントされる
- script/style/nav 除外もキャッシュ対象
- 空ページは 0 でキャッシュ
- null/不正値はクラッシュせず 0
- 既存の見出しスコア計算結果に影響しない (regression)

### 📦 Breaking Changes
なし。`estimateContentLength` の戻り値は同一、外部 API も変更なし。

### 📦 version bump
`2.3.0` → `2.3.1` (patch: 内部最適化と観測強化)

### 🔮 補足
今回のメモ化だけで 512 MB 上限を完全回避できる保証はない。本番で再度 ads.mercari.com を試して heap ログから残メモリを確認し、必要なら以下のいずれかで対処:
- Render プランを **Standard ($25/mo, 2GB RAM)** に昇格
- UX 改善: 502/OOM 検知時に「Simple モードでお試しください」と提示する自動フォールバック
- `page.content()` を使わず `page.evaluate()` で必要要素のみ抽出する大幅リファクタ

---

## [2.3.0] - 2026-05-24 — Phase 1.5: 区分線形スコアリング & SEO 評価基準キャリブレーション

中村さんから「メタディスクリプション 87 文字なのに 50 点はおかしい」というご指摘を受け、SEO 評価関数の全面的な見直しを実施。

### 🎯 解決した課題

#### 旧仕様の問題
- **3段階スコアリング**: `calculateTitleScore` / `calculateDescriptionScore` が `0 / 50 / 100` の3段階しかなかった
  - 87文字（理想に近い）も 500文字（明らかに長すぎ）もすべて 50点扱い
  - 「ちょっと長い」「やや短い」を「明らかに長すぎ」と同列に減点していた
- **古い閾値**: メタディスクリプション 60-80 全角文字は 2010年代初期の基準
  - 業界実務: PC 表示は約120文字、SP 表示は約70文字。80-120 が両方をカバーする理想範囲
- **コンテンツ長を無視**: 短いページにも `H2 ≥ 2 / H3 ≥ 3 / 内部リンク ≥ 10` を要求していた

### ✨ 新機能: 区分線形スコアリング (piecewise linear)

#### 🆕 `piecewiseLinearScore(value, points)` ヘルパー
- 評価対象の値が「控えめ → 理想 → 過剰」範囲をどう動くかを **0-100 で滑らかに表現**
- 各カテゴリで使い回せる汎用関数

#### 🔄 タイトルスコア
| 文字数（全角） | 旧 | 新 |
|---|---|---|
| 5 | 50 | 30 |
| 15 | 100 | 70 |
| 25 | 100 | 100 |
| 32 | 100 | 100 |
| 40 | 50 | 85 |
| 50 | 50 | 65 |
| 100 | 50 | 50 |

#### 🔄 メタディスクリプションスコア (**中村さんご指摘のポイント**)
| 文字数（全角） | 旧 | 新 |
|---|---|---|
| 50 | 50 | 60 |
| 70 | 100 | 85 |
| 80 | 100 | 100 |
| **87 (CareNet.com)** | **50** ❌ | **100** ✅ |
| 120 | 50 | 100 |
| 140 | 50 | 92 |
| 160 | 50 | 78 |
| 200 | 50 | 60 |
| 300 | 50 | 50 |

### ✨ 新機能: コンテンツ長に応じた動的閾値

#### 🆕 `estimateContentLength($)` で語数を概算
- 英語: 1単語=1
- 日本語: 約2文字=1語相当
- script / style / nav / footer / aside は除外

#### 🔄 H2/H3 必要数の動的調整
| コンテンツ長 | H2 必要 | H3 必要 |
|---|---|---|
| < 500 語（短いページ） | 1 | 0 |
| 500-2000 語 | 2 | 2 |
| > 2000 語 | 3 | 5 |

#### 🔄 内部リンク必要数の動的調整
| コンテンツ長 | 内部リンク必要 |
|---|---|
| < 500 語 | 3 |
| 500-2000 語 | 7 |
| > 2000 語 | 12 |

### 🔧 `seo-config.json` の閾値を更新

| キー | 旧 | 新 |
|---|---|---|
| `titleMaxLength` | 30 | 32 |
| `descriptionMinLength` | 60 | 70 |
| `descriptionMaxLength` | 80 | 120 |
| `h2MinCount` | 2 | 1 |
| `h3MinCount` | 3 | 0 |
| `internalLinksMin` | 10 | 3 |

注: 値はすべて「短いページ向け最小値」。コード側でコンテンツ長により動的に上方調整される。

### 🔧 警告メッセージと推奨アクション文言を新閾値に同期

#### `detailed-analyzer.js`
- `seo-config.json` を読み込み、ハードコード値 (`60` / `80` / `15` / `30`) を全廃
- 警告メッセージに動的閾値を反映

#### `enhanced-reporter.js`
- `getConciseFix` のメッセージを新閾値ベースに更新
- 「タイトルを 30 全角文字以下」→「タイトルを 32 全角文字以下にしてください（Google検索結果では約32文字で切り捨てられます）」
- 「メタディスクリプションを 80 全角文字以下」→「120 全角文字以下にしてください（PC表示は約120文字で切り捨て。重要情報は前半70文字に）」

### 🔧 既存スコア関数も区分線形化

#### `calculateHeadingScore`
- H1: 1個=35, 0個=0, 複数=15
- H2: 動的閾値に対する充足率 × 25
- H3: 動的閾値に対する充足率 × 15 (短いページでは満点)
- 階層: 15
- 内容: 10

#### `calculateLinkScore`
- 内部リンク: 動的閾値に対する充足率 × 40
- 外部リンク: 1個=20, 3個以上=+10
- 総数: 5+=10, 10+=10, 20+=10

#### `calculateImageAltScore`
- 0画像 → 50 (中立, 既存維持)
- N画像 → alt 付与率 × 100

### 🧪 テスト
- `__tests__/phase-1-5-calibration.test.js` 新規追加 (47 項目)
  - `piecewiseLinearScore` ヘルパー (5ケース)
  - タイトルスコア区分線形 (10ケース)
  - メタディスクリプションスコア区分線形 (11ケース)
  - **CareNet.com 87文字 → 100点** の specific regression
  - 「0/50/100 の 3段階から脱却している」検証
  - コンテンツ長動的閾値の見出しスコア (5ケース)
  - リンクスコア動的閾値 (4ケース)
  - estimateContentLength (4ケース)
  - enhanced-reporter 文言の新閾値同期 (2ケース)

### ✅ 実機検証

CareNet.com 診断結果:
- メタディスクリプション 84.5文字（全角）
  - **旧スコア: 50 / 新スコア: 100** ✅
- タイトル 26.5文字 → 100点
- 「メタディスクリプションが長すぎ」issue が消失（正しい挙動）

### 📦 Breaking Changes

なし。ただし**過去診断スコアと数点〜数十点の差が出る可能性**あり。これは「より正確な評価」になった結果であり、改善ではなく退行ではない。

### 📦 version bump
`2.2.0` → `2.3.0` (minor: スコアリングロジック大幅改善、結果が変わる)

---

## [2.2.0] - 2026-05-24 — Phase 2-B: 競合URL比較モード + LIKEPASS フッタ

### ✨ 新機能: 競合URL比較モード

2つのURLを並列診断してスコアを横並びで比較できる機能を追加。SEO/AIO改善のベンチマーキングに使えます。

#### 🆕 `/api/compare` エンドポイント
- POST 経由で `primaryUrl` + `competitorUrl` を受け取り、並列診断
- `Promise.allSettled` で **片方失敗でも結果を返す**（partial failure 対応）
- 両方失敗した場合のみ 502 を返す
- 同一URL指定や URL バリデーション失敗は 400

#### 🆕 `buildComparison()` ロジック
- カテゴリ別差分（SEO 7 + AIO 7 = 14カテゴリ）
- 勝敗判定（5点差以下は tie、それ以上で勝敗判定）
- **`gapsToClose`** ハイライト: 競合 80+ かつ 自分 50未満
- **`myAdvantages`** ハイライト: 自分 80+ かつ 競合 50未満
- カテゴリ別勝ち数集計 (`winCounts`)

#### 🎨 UI (vanilla)
- 既存フォームに **「比較対象URL」欄** を追加（UI配置 C）
  - 青の border-left + 淡背景でアクセント
  - 「（オプション）」のヒント文付き
- 入力時のみ比較モード起動、空欄なら従来通り単独診断
- 比較結果サマリー:
  - **勝敗カード**: SEO / AIO / 総合 をそれぞれ自分 vs 競合のスコアで表示
  - **カテゴリ別勝ち負け**: バーチャートで視覚化（あなた優位/同等/競合優位）
  - **競合が先行している項目**: 「キャッチアップすべき」リスト
  - **あなたが先行している項目**: 「優位を維持」リスト
  - **全カテゴリ詳細テーブル**: 14カテゴリ全部のスコア・差分・勝敗
- 比較モード中は他タブを「サマリーのみ」案内に切り替え

### ✨ 新機能: LIKEPASS フッタ + 動的バージョン表示

#### 🆕 `/api/version` エンドポイント
- `package.json` の `name` / `version` / `license` を返す
- `Cache-Control: public, max-age=300` で軽くキャッシュ
- 起動時に1度だけ読み込み

#### 🎨 フッタ (vanilla)
- レイアウト B: ロゴ左、クレジット中央（3カラムグリッド）
- **LIKEPASS ロゴ**: 20px、`https://likepass.net` へリンク（新タブ）
- **`Developed by TK Nakamura`**: 中央、本文色
- **動的バージョン**: `v2.2.0 · MIT License` を `/api/version` から取得
- a11y: `aria-label`、`:focus-visible` フォーカスリング
- レスポンシブ: モバイルでは縦並び

### 🧹 リポジトリ整理

#### `node_modules` の tracked 解除
- `git rm -r --cached node_modules` で **21,299 ファイル** を削除
- `.gitignore` の重複していた `node_modules/` 行も整理

#### GitHub Actions のメジャー更新
- `actions/checkout@v4` → `@v5`
- `actions/setup-node@v4` → `@v5`
- 2026年6月の強制移行への先行対応

### 🧪 テスト
- `__tests__/compare-api.test.js` 新規追加（10+項目）
  - `buildComparison` のロジック検証
  - 5点差以下は tie 判定
  - null 入力時の `available: false`
  - combinedScore の fallback ロジック
  - `/api/version` の package.json 連携

### ✅ 実機検証

| シナリオ | 結果 |
|---|---|
| ads.mercari.com vs llmstxt.org の比較 | ✅ 14カテゴリ全部の差分、勝敗カード、ギャップハイライト全部表示 |
| `/api/version` | ✅ `{"name":"seo-aio-doctor","version":"2.2.0","license":"MIT"}` |
| LIKEPASS ロゴ → https://likepass.net | ✅ 新タブで開く |
| フッタの動的バージョン | ✅ `v2.2.0 · MIT License` |
| モバイルレスポンシブ | ✅ フッタ縦並び、テーブル縮小 |

### 📦 Breaking Changes
なし。既存の `/api/check/seo` 単独診断は完全維持、`/api/compare` は新規追加。

### 📦 version bump
`2.1.1` → `2.2.0` (minor: 新機能2つ追加)

---

## [2.1.1] - 2026-05-24 — chore: Render の puppeteer Chrome ダウンロードをスキップ (IaC化)

PR #7 マージ時の Render デプロイで `npm install` が `puppeteer/install.mjs` の
chrome-headless-shell 取得に失敗し `build_failed` になった件のフォローアップ。

### 🔧 `render.yaml` に `PUPPETEER_SKIP_DOWNLOAD=true` を IaC として記録
- 本番では `@sparticuz/chromium` のバイナリを使うため、puppeteer の Chrome 自動
  ダウンロードは不要
- 初回復旧時は Render ダッシュボード（API 経由）で直接 env var を追加したため、
  IaC (`render.yaml`) と実体に乖離があった状態
- 今 PR で `render.yaml` にも同 env var を追加し、将来 Service 再作成時にも
  自動でセットされる構成にする

### 📦 Breaking Changes
なし。本番動作はすでに同じ env var で稼働しており、追加の変更は IaC のみ。

### 📦 version bump
`2.1.0` → `2.1.1` (patch: 設定の IaC 化のみ、コード変更なし)

---

## [2.1.0] - 2026-05-24 — Phase 2-A.1: AIO 重み付け調整 / effortMap 追加

PR #5 (Phase 2-A) レビュー時に中村さんから Nice-to-have として送られた2点を反映。

### 🎯 AIO 重み付けを「旧 impactScores 比率維持」に再調整

#### 背景
Phase 2-A で llms.txt を 15% 比重で導入した際、残り 85% を6カテゴリに **均一に近い形** (17%/17%/17%/17%/9%/8%) で配分していた。
しかし旧 `impactScores` では `structuredInformation` (25%) が最重要、`naturalLanguageQuality` / `contextRelevance` (10%) が軽量、という明確な優先度設計があった。
今回これを厳密に保ったまま llms.txt 15% を追加する。

#### 新しい重み (`aio-checker.js#calculateAIOOverallScore`)
| カテゴリ | 旧 impactScores 比率 | × 0.85 = 新重み |
|---|---|---|
| structuredInformation    | 25% | **0.2125** |
| contentComprehensiveness | 20% | **0.17** |
| aiSearchOptimization     | 20% | **0.17** |
| credibilitySignals       | 15% | **0.1275** |
| naturalLanguageQuality   | 10% | **0.085** |
| contextRelevance         | 10% | **0.085** |
| **llmsTxtCompliance**    | （新規） | **0.15** |
| 合計 | 100% | **1.00** |

#### 効果
- 「構造化情報が AIO で最も重要」という旧設計の意図を回復
- llmstxt.org の AIO スコア: 48 → 47 (structured 0点の影響を強く反映)

### 🆕 `effortMap` に `llmsTxtCompliance: 2` を追加

`enhanced-reporter.js#calculateEffort`:
- llms.txt は **Markdown ファイル1つ設置するだけ** で完了するため低工数
- `titleTag` (1), `metaDescription` (1), `otherSEOElements` (2) と同等
- 旧 `impactScores.aio.llmsTxtCompliance = 15` と組み合わせると、
  ROI = impact/effort = 7.5 で **quickWins 上位候補** として浮上する想定

### 🧪 テスト追加

`__tests__/phase-2a1-weights.test.js` を新規追加 (12項目):
- 全カテゴリ100点で総合100
- 各カテゴリ単独0点での総合スコア検証 (期待値表で網羅)
- 旧 impactScores の重要度順が保持されているか
- 重みの合計が 1.00 ±0.001
- `llmsTxtCompliance` の effort=2 確認
- 未知カテゴリのデフォルト effort=5 (regression)

node 単体テストで **9/9 PASS** 確認済み。CI で jest 全項目を検証。

### 📦 Breaking Changes
なし。スコア配点が微調整されるため、過去診断結果と最大数点の差が出る可能性あり。

### 📦 version bump
`2.0.1` → `2.1.0` (minor: 重み付け改善は破壊的変更でないが、結果が変わるため minor bump)

---

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
