# Changelog

## [2.15.0] - 2026-05-25 — Phase 2-I: タブ構成再編 (サマリーは抜粋 / 詳細データは全件)

中村さんからの指摘:
> サマリータブの内容は完璧だと思います。構造化データもOKです。
> ただし、SEO詳細・AIO詳細が、サマリータブの内容を反映していない部分も出ているようです。
> どうするのが良いでしょうか？もしかして、SEO詳細・AIO詳細は不要？
>
> 案Cは、サマリーが、まさにサマリーらしくなるのでは？

→ **案 C-1 + D-1 + タブ案 X** で確定:
- サマリーは Critical + High のみ抜粋 (本当の意味の「サマリー」に)
- 詳細データは SEO + AIO 統合の全件ビュー
- 構造化データは現状維持 (実装ガイドとして既に完成)

### 🎯 解決した課題

旧 (v2.14.0):
- サマリーに 30 件の推奨が全部並ぶ → 情報過多気味
- SEO詳細・AIO詳細タブが Phase 1 初期のまま陳腐化
- 「同じ情報の劣化版が並んでいる」状態 (中村さんの指摘)

新 (v2.15.0):
- サマリーは Critical + High のみ (大事なものだけ)
- 詳細データタブで「全件 + 全該当箇所」を確認可能
- 役割分担が明確: **サマリー = 要点 / 詳細 = 全データ**

### ✨ 実装内容

#### 1. タブ構成: 4タブ → 3タブ

| 旧 | 新 |
|---|---|
| サマリー | サマリー (Critical/High のみ) |
| SEO詳細 | **詳細データ** (SEO + AIO 統合、全件) |
| AIO詳細 | (上に統合、削除) |
| 構造化データ | 構造化データ (現状維持) |

#### 2. サマリータブ
- `topRecs = conciseRecommendations.filter(r => r.priority === 'critical' || r.priority === 'high')`
- 見出し: 「今すぐ対応すべき推奨アクション (N件)」
- Medium/Low が残っている場合: 「他に Medium/Low 優先度の項目が N 件あります → 詳細データタブで確認できます」リンク
- Critical/High なし & Medium/Low あり: 「✨ Critical / High 優先度の問題はありません」
- 全件良好: 「🎉 すべての項目が良好です」

#### 3. 詳細データタブ (新規 `displayDetailedData`)
- **上部オーバービュー**: 優先度別カウントチップ (Critical / High / Medium / Low / 合計)
- **SEO 詳細セクション**: titleTag / metaDescription / headingStructure / imageAltAttributes / internalLinkStructure / otherSEOElements
- **AIO 詳細セクション**: contentComprehensiveness / structuredInformation / credibilitySignals / aiSearchOptimization / naturalLanguageQuality / contextRelevance / llmsTxtCompliance
- 各カテゴリで:
  - スコア表示
  - 現在の値 (タイトル/メタなど)
  - **「推奨アクション N 件を表示 ▼」**トグル → 全優先度の推奨 (issue/codeExample/docLink 含む)
  - **「該当箇所一覧 (N件)」**: 全件のURL/src一覧 (画像 alt なら全画像、リンクなら全リンク)
- 推奨アクションは優先度順 (Critical → Low) でソート

#### 4. ヘルパー新設
- `_renderDetailsCategory(catKey, catName, check, recs, results)`: 1 カテゴリ分の HTML 生成
- `_collectAllLocations(catKey, check, results)`: カテゴリ内の全該当箇所を集約

### 🎨 CSS 追加
- `.details-overview`: 上部オーバービュー
- `.prio-chip.critical/high/medium/low/total`: 優先度別チップ
- `.details-section-title`: SEO/AIO セクション見出し (青下線)
- `.details-category`: カテゴリブロック
- `.details-rec-toggle`: 推奨アクション展開ボタン
- `.details-rec-item.critical/high/medium/low`: 推奨アクション項目 (左色帯)
- `.details-locations` / `.details-loc-list`: 該当箇所一覧 (max-height: 300px スクロール対応)
- `.summary-rest-hint`: サマリーの「他N件は詳細データタブで」ヒント
- `.summary-all-good`: 良好時の達成感表示

### 🧪 テスト

#### 既存テスト更新
- `__tests__/phase-1-8-tab-cleanup.test.js`: 「4タブが残っている」→「3タブが残っている (Phase 2-I で SEO詳細・AIO詳細を統合)」

#### 新規テスト
`__tests__/phase-2i-tab-restructure.test.js` (**17 項目**):
- 3タブ構成 (サマリー / 詳細データ / 構造化データ)
- 旧 SEO詳細 / AIO詳細 ラベル削除
- `<div id="aio">` コンテナ削除
- `displayDetails` / `displayAIO` 旧メソッド削除
- `displayDetailedData` 新メソッド定義
- サマリーフィルタ (`priority === 'critical' || priority === 'high'`)
- 「今すぐ対応すべき推奨アクション」見出し
- 「詳細データタブ」リンク
- 良好時メッセージ
- `_renderDetailsCategory` / `_collectAllLocations` ヘルパー
- priority chip CSS 定義

**全テスト 456/456 PASS** (439 + 17 = 456, regression なし)

### ✅ 動作確認

ローカル `carenet.com` 診断:
- ✅ 3タブ構成: サマリー / 詳細データ / 構造化データ
- ✅ サマリーに 23件 (Critical+High のみ、元 30件中)
- ✅ 「他に Medium/Low の項目が 5 件 → 詳細データタブ」リンク表示
- ✅ 詳細データタブ: Critical 20 / High 3 / Medium 5 / Low 0 / 合計 28
- ✅ SEO 詳細 (6 カテゴリ) + AIO 詳細 (7 カテゴリ) 全表示
- ✅ 該当箇所一覧 (内部リンク 22件全件、画像 alt 2件)
- ✅ 推奨アクション展開トグル動作 OK

### 📦 Breaking Changes

UI 変更:
- 旧「SEO詳細」「AIO詳細」タブをクリックしていたブックマーク → 「詳細データ」タブに統合
- 比較モード時の「比較モードでは表示しません」案内は `aioContent` から `detailsContent` のみに変更

データ層は無変更、API レスポンス互換性あり。

### 📦 version bump

`2.14.0` → `2.15.0` (minor: UI 大幅再編)

### 🆕 Phase 2-I.1: SEO/AIO セクション冒頭にスコア表示 (同 PR 内追加)

中村さん追加指摘:
> SEO詳細の冒頭に、AIO詳細と同様の、スコアのセクションを設けるべきでは？

旧 `displayAIO` には AIO 総合スコア表示があったが、新 `displayDetailedData` への統合時に削除されていた。SEO と AIO で**対称的に**スコアセクションを表示:

- SEO 詳細セクション冒頭: 「**75** / SEO総合スコア」 (results.overallScore)
- AIO 詳細セクション冒頭: 「**33** / AIO総合スコア」 (results.aio.overallScore)
- 統一フォーマット: 左端色付き縦線 + 大きい数字 + 控えめなラベル
- スコア別カラー: good/medium/high/critical

ヘルパー `renderSectionScore(label, score)` で重複なく実装。

#### CSS 追加
- `.details-section-score`: 共通スタイル
- `.details-section-score.good/medium/high/critical`: 左縦線色
- `.details-section-score-num`: 大きい数字 (2.4rem, 色クラス連動)
- `.details-section-score-label`: 控えめラベル

#### テスト追加 (5 項目)
- SEO総合スコア / AIO総合スコア ラベルが表示
- `renderSectionScore` ヘルパーが両セクションで使われる
- `.details-section-score*` CSS 定義
- スコアごとの色クラス (good/medium/high/critical)

**全テスト 461/461 PASS** (456 + 5)

---

## [2.14.0] - 2026-05-24 — Phase 2-H: ページタイプ判定の精度向上 & LLM タイムアウト延長

中村さんから報告された誤判定への対応:
> `https://ads.mercari.com/column/136` が「商品ページ」となりました。これは記事ページだと思います。

### 🔴 解決した課題

このページは「メルカリ広告サービスについて解説する記事」だが、「商品ページ」と誤判定:
- 本文に '商品', '価格', '購入', 'カート' が頻出 (広告サービスを商品として説明)
- ルールベース判定で Product 21 vs Article 16 と僅差
- URL の `/column/` パターン (Article シグナル) が弱い重み (2.0) で見過ごされ
- LLM 補正が **8秒タイムアウト**で失敗 → ルールベースの誤判定が表示

### ✨ 修正 5 点

#### 1. URL 重みを 2.0 → 5.0 に強化
- URL は人間が意図して設計した強いシグナル (構造化された情報)
- `/column/123` は確実に記事ページ、`/product/iphone` は確実に商品ページ
- タイトル重み (3.0) を超える評価で、本文キーワード誤検知を抑制

#### 2. URL パターンマッチタイプにボーナス +10
- URL パターンがマッチしたタイプに +10 のボーナス (本文キーワード10個分相当)
- マッチしなかったタイプは本文キーワードスコアを **50% 減衰**
- これにより `/column/` を含む URL の Product スコアが半減、Article が+10で逆転

#### 3. Article URL パターン拡張
- 旧: `/blog/, /news/, /article/, /post/, /column/`
- 新: `/blog/, /news/, /article/, /articles/, /post/, /posts/, /column/, /columns/, /case/, /case-study/, /insights/, /story/, /stories/`
- 複数形 (`/articles/`, `/columns/`) や `/case-study/` も網羅

#### 4. LLM タイムアウトを 8s → 15s に延長
- ページタイプ判定は致命的に重要なので、ネットワーク遅延に耐性を持つ
- Content Rewriter (Phase 2-E) の 12s よりさらに長く設定
- タイムアウトでもルールベースが改善されているのでフォールバック品質も向上

#### 5. AbortError のエラーコード正規化 (バグ修正)
- 旧: `errorCode: 20` (DOMException の数値コードがそのまま入る)
- 新: `errorCode: 'LLM_TIMEOUT'` (人間が読める文字列)
- `err.name === 'AbortError'` または `err.code === 20` の場合に正規化

### 🆕 `_getUrlMatchedTypes` ヘルパー
- URL パターンがマッチしたページタイプを返すユーティリティ
- 1つの URL が複数タイプにマッチすることもある (例: `/shop/` は Product と LocalBusiness 両方)

### 🧪 テスト

`__tests__/phase-2h-page-type-fix.test.js` 新規 (**16 項目**):
- `/column/` を含む URL は Article 判定 (本文に商品キーワード多数でも)
- `/columns/` (複数形) も Article 判定
- `/case-study/` も Article 判定
- `/product/` を含む URL なら Product 判定
- URL マッチしない場合は従来通り本文ベース
- `weights.url === 5.0`
- `_getUrlMatchedTypes` ヘルパーの正常系
- AbortError → `LLM_TIMEOUT` 正規化
- 数値 20 → `LLM_TIMEOUT` 正規化
- HTTP 401 等は文字列をそのまま
- 後方互換性 (既存の `analyzer.analyzePage` が動く)

**全テスト 439/439 PASS** (Phase 2-G 423 + Phase 2-H 16 = 439)

### ✅ 動作確認

ローカルで `https://ads.mercari.com/column/136` 診断:
- ✅ **primary: Article** (修正前は Product)
- ✅ confidence: **43%** (修正前は 23%)
- ✅ allScores: Article 29 vs Product 10.5 (圧倒的差)
- ✅ LLM 補正なしでも正しく判定 (ローカル LLM 無効環境)

### 📦 Breaking Changes

なし:
- 後方互換: 既存の `analyzePage`/`analyzePageAsync` は引き続き動く
- 既存テスト 423 件すべて引き続き PASS

### 📦 version bump

`2.13.0` → `2.14.0` (minor: スコアリングロジック調整 + バグ修正)

---

## [2.13.0] - 2026-05-24 — Phase 2-G: 該当箇所単位の個別 AI 書き換え提案

中村さん要望「**AI 書き換え時に該当箇所を1件ずつ渡して個別最適化**」への対応。
Phase 2-E (カテゴリ単位の一般論的提案) と Phase 2-E.2/2-F (該当箇所表示) を融合し、
**「この特定の URL/画像専用」の個別最適化された 3 案** を生成可能にした。

### 🎯 解決した課題

旧 (Phase 2-E):
- 「11個のリンクテキストが空」→ AI は「動詞+名詞で a11y 配慮」の一般論的な3案
- どの URL に対しても同じ提案
- 具体性が低い

新 (Phase 2-G):
- 各 URL/画像に「✨ この項目を AI に書き換えてもらう」ボタン
- AI には URL/src・position・ページ文脈を渡す
- 「`/?keiro=com_logo`」→ 「メルカリのロゴ - トップページへ」など URL から推測した具体提案
- 「`636annsp.jpg`」→ ファイル名から推測した画像内容の alt 提案

### ✨ 実装内容

#### バックエンド: `llm-content-rewriter.js` 拡張

`rewrite(input)` で `specificLocation` フィールドを受け付ける:
```js
{
  target: 'linkText',
  currentValue: '',
  pageContext: {...},
  specificLocation: {     // 🆕
    type: 'link',
    href: '/?keiro=com_logo',
    position: 1,
    currentText: '',
  }
}
```

- `_sanitize`: specificLocation のサニタイズ (href/src 500字制限、currentText 200字、position 数値以外は null)
- `_cacheKey`: specificLocation の type/href/src/position をキャッシュキーに含めて個別キャッシュ
- `_callOpenAI`: specificLocation がある場合プロンプトに **「書き換え対象の特定要素」セクション** を追加
  - `type === 'link'` の場合: 「リンク先 URL: ..., 位置: N番目」+ 「URL から推測される行き先・用途を踏まえ...」
  - `type === 'image'` の場合: 「画像 URL: ..., 位置: N番目」+ 「画像 URL のファイル名・パスから推測される内容を踏まえ...」

#### API: `POST /api/llm/suggest` で specificLocation 受信

既存エンドポイントに `specificLocation` パラメータを追加。指定なしの場合は従来 (Phase 2-E) と同じ動作。

#### UI

該当箇所 (link/image) の各行に **「✨ この項目を AI に書き換えてもらう」** 小さい紫ボタンを設置:
```
該当箇所 (11件)
┌─────────────────────────────────────────┐
│ /?keiro=com_logo                  [リンク 1番目]│
│ [✨ この項目を AI に書き換えてもらう]              │
│ ↓ クリック後                                  │
│   この項目専用の AI 提案 (3件):                 │
│   ┌─ 提案 1 [コピー]                          │
│   │ メルカリのロゴ - トップページへ            │
│   │ 理由: URL の keiro=com_logo からロゴ判定  │
│   ├─ 提案 2 [コピー]                          │
│   │ メルカリ - トップに戻る                   │
│   │ 理由: 主機能を明示                       │
│   └─ 提案 3 [コピー]                          │
│     メルカリ広告 公式サイト                   │
│     理由: ブランド + 用途明示                 │
└─────────────────────────────────────────┘
```

- 対象: `link` / `image` タイプの該当箇所のみ (タイトル/メタ/H1 は元から1件のため Phase 2-E で十分)
- 既存の上部 CTA「カテゴリ単位の汎用提案」と共存
- コピー機能・再試行ボタン・エラー表示は Phase 2-E と同等

### 🛡️ 安全装置

- **specificLocation のサニタイズ**: サイズ制限 + ロールキーワード中和 (Phase 2-E と同じプロンプトインジェクション対策)
- **キャッシュ分離**: specificLocation の有無、別 href/src/position はそれぞれ別キャッシュ
- **後方互換性**: specificLocation 省略時は Phase 2-E と完全互換

### 🧪 テスト

`__tests__/phase-2g-individual-llm.test.js` 新規 (**15 項目**):
- specificLocation を渡せること (linkText/altText 両方)
- プロンプトに「リンク先 URL」「位置」「URL から推測」「ファイル名」が反映
- specificLocation 省略時は汎用プロンプト
- キャッシュ分離 (有無別、別 href、別 position)
- 同じ href + position は cache ヒット
- サニタイズ (長さ・ロールキーワード・position 型)
- 後方互換性 (Phase 2-E の呼び出し方は引き続き動く)

**全テスト 423/423 PASS** (Phase 2-E 29 + Phase 2-G 15 = 既存408 + 15)

### ✅ 動作確認

ローカル `carenet.com` 診断:
- ✅ **50 個** の個別 AI ボタン (リンク 22個 + 画像 + 各 specificIssue ごと)
- ✅ 各ボタンに URL + position + type が正しく埋め込まれる
- ✅ 上部 CTA (カテゴリ単位) と個別ボタン (該当箇所単位) が共存
- ✅ ローカル LLM 無効時に正しく 503 エラー

### 💰 コスト

- 1 個別提案 ~700 input + 300 output tokens ≒ **$0.0004 (0.06円)** (Phase 2-E より若干増)
- ユーザーは興味ある項目だけクリックするのでオンデマンド維持
- 月 100 診断 + 平均 10 個別クリック ≒ 約 60 円
- 既存ハードリミット $20/月で十分余裕

### 📦 Breaking Changes

なし:
- specificLocation 省略時は Phase 2-E と完全互換
- 既存テスト 408 件すべて引き続き PASS

### 📦 version bump

`2.12.0` → `2.13.0` (minor)

---

## [2.12.0] - 2026-05-24 — Phase 2-F: 構造化データの該当箇所表示

Phase 2-E.2 で導入した「該当箇所」表示の対象に**構造化データ関連の issue**を追加。
「Product スキーマに offers がない」と言われたとき、**どの JSON-LD ブロックの話か**が分かるようになります。

### 🎯 解決した課題

例:
- 「Productスキーマにoffersがありません」と表示されるが、ページに JSON-LD が複数あるとどれが該当か分からない
- 「JSON-LDの構文エラーがあります」と言われても、N番目のどのスクリプトかが見えない
- 「推奨スキーマが不足しています: Article, FAQPage, HowTo」と表示されても、リスト表記で分かりにくい

### ✨ 実装内容

#### 🆕 `_extractStructuredDataLocations` メソッド

`category === 'structuredData'` の issue に対し、issue 文言から該当する JSON-LD を**実データから特定**:

| issue パターン | 表示内容 |
|---|---|
| `○○スキーマに××がありません` | 該当する `@type === '○○'` の JSON-LD + 不足フィールド明示 + スニペット展開 |
| `JSON-LD[N]に@typeがありません` | N 番目の JSON-LD ブロック + スニペット |
| `JSON-LDの構文エラーがあります` | エラー詳細メッセージ + 該当 position |
| `推奨スキーマが不足しています: A, B, C` | バッジ風に各不足スキーマを表示 |
| `○○スキーマが不足しています` (単独) | 表示なし（該当 JSON-LD が存在しないため） |
| `構造化データが存在しません` | 表示なし |

#### 🆕 `_formatJsonLdSnippet` ヘルパー
- JSON-LD を読みやすくフォーマット
- 文字列フィールドは80文字で切り詰め
- 配列は `[Array (N)]` で要約
- ネストオブジェクトは `@type` だけ表示
- フィールド数が多い場合は最初の8キーまで + 「他Nフィールド」

#### 🎨 UI 表示

```
該当箇所 (2件)
┌──────────────────────────────────────┐
│ Product スキーマ (フィールド「offers」が不足) [JSON-LD 1番目] │
│ ▶ JSON-LD を表示                                         │
│   ┌──────────────────────────────────┐
│   │ {                                            │
│   │   "@context": "https://schema.org",         │
│   │   "@type": "Product",                       │
│   │   "name": "テスト商品",                       │
│   │   "description": "テスト"                    │
│   │ }                                            │
│   └──────────────────────────────────┘
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Organization スキーマ (フィールド「url」が不足) [JSON-LD 2番目] │
│ ▶ JSON-LD を表示                                         │
└──────────────────────────────────────┘
```

不足スキーマの場合はバッジ風表示:
```
該当箇所 (3件)
[Article スキーマ (未実装) 不足]
[FAQPage スキーマ (未実装) 不足]
[HowTo スキーマ (未実装) 不足]
```

### 🛠 実装上の工夫

- **データソース優先**: `detailedAnalysis.structuredData.jsonLd[]` (`{data, position, isValid}` 形式)
- **フォールバック**: `results.checks.structuredData.jsonLd[]` (生データ直格納) を `{data, position}` 形式にラップ
- バックエンド変更**ゼロ** (既存データ構造を活用)
- 不足スキーマと該当 JSON-LD を識別する `type: 'structured-missing'` / `type: 'structured'` の使い分け

### 🎨 CSS 追加
- `.loc-structured`: 構造化データ該当箇所の縦並びレイアウト
- `.loc-missing-schema`: 不足スキーマ用の黄色バッジ
- `.loc-jsonld-details` / `.loc-jsonld-snippet`: 展開可能な JSON コードブロック
- ライトテーマ・等幅フォント・スクロール対応 (max-height: 240px)

### ✅ 動作確認

ローカルで JSON-LD 入り HTML を診断:
- ✅ 「Productスキーマにoffersがありません」展開時に Product スキーマの該当 JSON-LD と位置 (1番目) を表示
- ✅ 「JSON-LD を表示」展開で実データのスニペットが見える
- ✅ 「Organizationスキーマにurlがありません」も同パターンで動作
- ✅ 既存テスト 408/408 PASS (regression なし)

### 📦 Breaking Changes
なし。視覚的な追加のみ。

### 📦 version bump
`2.11.0` → `2.12.0` (minor: 新機能、後方互換)

---

## [2.11.0] - 2026-05-24 — Phase 2-E.2: 推奨アクションに「該当箇所」一覧表示

中村さん実運用フィードバック「**現状、複数の提案がある際に、該当箇所がわからないことが多いです**」への対応。

### 🎯 解決した課題

例えば「リンクに適切なテキストを追加してください（11件）」と表示されても、**11個のうちどれを直せばよいか分からない**という問題:
- セレクタは `a[href]` 程度の情報しかない
- 実際の作業でユーザーが該当箇所を特定できない
- AI 書き換え提案を出しても、どこに適用するか分からない

実は **`detailedAnalysis` に URL/position/src 等の具体情報が既に蓄積されていた** (Phase 1.8 で UI から非表示になっていた)。これを推奨アクション展開時に活用する。

### ✨ 実装内容

#### 🆕 推奨アクション展開時に「該当箇所 (N件)」セクション追加

対象カテゴリ別の表示:

| カテゴリ | 該当箇所のソース | 表示内容 |
|---|---|---|
| 画像 alt 関連 | `detailedAnalysis.imageAltAttributes.specificIssues[].images[]` | `src` (URL クリッカブル) + 「画像 N番目」 |
| リンクテキスト関連 | `detailedAnalysis.internalLinkStructure.specificIssues[].links[]` | `href` (URL クリッカブル) + 「リンク N番目」 |
| 見出し関連 | `detailedAnalysis.headingStructure.specificIssues[]` | 該当見出しテキスト + 要素種別 |
| タイトル | `detailedAnalysis.titleTag.specificIssues[]` | 現在のタイトル + 全角文字数 |
| メタディスクリプション | `detailedAnalysis.metaDescription.specificIssues[]` | 現在の説明文 + 全角文字数 |

#### 🎨 UI

- 「該当箇所 (N件)」セクションを **AI ボタンと修正例コードの間**に配置
- 最初の **5件は常に表示**、それ以上は **「他 X 件を表示」ボタン**で展開
- URL は**新タブで開けるリンク**として描画
- 各項目に**「N番目」のヒント**（右側に丸いバッジ）
- 等幅フォントで URL を可読性高く表示

#### 🛠 実装方法
- 既存 `detailedAnalysis` を活用 (バックエンド変更**ゼロ**)
- `_extractLocations()` ヘルパー新設で category 別の抽出ロジック
- `_dedupeLocations()` で重複除去
- `attachLocationToggles()` で「他N件を表示」のトグル

### ✅ 動作確認

ローカル `carenet.com` 診断:
- リンクテキスト空 issue: **22件**の該当URL一覧表示
- 画像 alt なし issue: **3件**の該当画像 src 一覧表示
- 各 location に「リンク 1番目」「画像 17番目」のヒント
- 「他 X 件を表示」展開動作 OK
- 既存テスト **408/408 PASS** (regression なし)

### 📦 Breaking Changes
なし。視覚的な追加のみ。

### 📦 version bump
`2.10.1` → `2.11.0` (minor: 新機能、後方互換)

---

## [2.10.1] - 2026-05-24 — fix(phase-2e.1): AI 書き換えボタンの発見性を改善

中村さん実運用フィードバック「**本番を見ると、AI ボタンクリックがないように見えます**」への対応。

### 🔴 解決した課題

Phase 2-E (v2.10.0) で AI 書き換えボタンを実装したが、UX 上の問題で「ボタンが無い」と認識される状態だった:

- 推奨アクションは 30 件並び、AI 提案対応は 4 件のみ
- AI ボタンは **推奨アクションを展開しないと見えない**
- 上位 Critical アクション (JSON-LD, タッチターゲット等) には AI ボタンが付かない
- → 「どこに AI ボタンがあるのか分からない」

### ✨ 改善内容

#### 1. 閉じた状態でも「✨ AI 提案可」バッジを表示
- 推奨アクションヘッダーに新規バッジ追加 (`.llm-available-badge`)
- 紫グラデーション (Phase 2-C AI バッジと統一)
- 一覧をスクロールするだけで「AI で改善案を出せる項目」が一目で発見できる

#### 2. AI 対応行に紫の縦線インジケータ
- `.recommendation-item.has-llm-suggest` に `border-left: 3px solid #6d28d9`
- 大量のアクションの中から AI 提案可能な行が**視覚的にハイライト**される

#### 3. 展開時の AI ボタンを最上部に移動
- 旧: 検出された問題 → 修正例 → 参考ドキュメント → AI ボタン (最下部)
- 新: **AI ボタン (CTA ブロック)** → 検出された問題 → 修正例 → 参考ドキュメント
- 展開直後に AI ボタンが目に入る配置

#### 4. AI ボタンを CTA ブロックとして強調
- 旧: 点線で区切られた小さいボタン
- 新: 紫グラデーション背景の **CTA ブロック**
  - 左端に濃紫の縦線アクセント
  - ボタンを大きく (12px×18px padding, 0.92rem)
  - 軽い shadow + hover で浮き上がり
  - 「現状を踏まえて 3 つの改善案を OpenAI gpt-4o-mini が生成します（数秒）」のヒント文を追加

#### 5. ボタンラベルを具体化
- 旧: `✨ AI に書き換え提案を依頼`
- 新: `✨ AI に「メタディスクリプション」の書き換え案を提案させる`
- 対象が明示されて何が起きるか分かりやすい

### ✅ 動作確認

ローカル `ads.mercari.com` 診断:
- ✅ `[✨ AI 提案可]` バッジ 4 個 (メタディスク×2, H1, リンクテキスト)
- ✅ 4 行の左端に紫縦線
- ✅ 展開時に AI ボタンが冒頭の CTA ブロックとして大きく表示
- ✅ 既存テスト 408/408 PASS (regression なし)

### 📦 Breaking Changes
なし。視覚的な改善のみ、データ構造変更なし。

### 📦 version bump
`2.10.0` → `2.10.1` (patch: UX 改善)

---

## [2.10.0] - 2026-05-24 — Phase 2-E: LLM コンテンツ書き換え提案 (オンデマンド AI 提案)

中村さんからの実運用フィードバック「**タイトル・ディスクリプションを『じゃあどう直せば良い?』となるので、LLM での推奨や提案は重要**」への対応。

「気づき → 行動」のラストワンマイルを埋める機能を追加しました。

### 🎯 解決した課題

旧UI:
```
✓ メタディスクリプションを120全角文字以下にしてください
  詳細: PC表示は約120文字で切り捨てられる。重要情報は前半70文字に。
  📖 参考ドキュメント
```
→ 「で、具体的にどう書き直せばいいの?」となる問題

新UI (Phase 2-E):
```
✓ メタディスクリプションを120全角文字以下にしてください
  詳細: PC表示は約120文字で切り捨てられる。重要情報は前半70文字に。
  📖 参考ドキュメント
  [✨ AI に書き換え提案を依頼]  ← クリックで3案表示
```

### ✨ 新機能

#### 🆕 `llm-content-rewriter.js` (新規モジュール)

OpenAI gpt-4o-mini で SEO/AIO 観点の書き換え候補を3つ生成:
- **対象**: title / metaDescription / h1 / linkText / altText
- **オンデマンド**: 診断時には呼ばず、UI のボタンクリック時のみ実行
- **3案ずつ**: キーワード重視 / 数字インパクト / ターゲット明示 など切り口を変えて提案
- **理由付き**: 各案に「なぜこれが良いか」の日本語1文

#### 🆕 `POST /api/llm/suggest` エンドポイント
- body: `{ target, currentValue, pageContext }`
- 503 (LLM_DISABLED): OPENAI_API_KEY 未設定時
- 400: target が SUPPORTED_TARGETS 外
- 502: LLM 呼び出し失敗
- 200: 成功 (suggestions: 3案)

#### 🛡️ 安全装置
- **タイムアウト 12秒** → ユーザーには再試行ボタン表示
- **メモリ LRU キャッシュ** (200 エントリ / 6時間) — 同じ書き換え要求のコスト削減
- **入力サニタイズ**: サイズ制限 + 制御文字除去 + プロンプトインジェクション中和 (`user:`, `tool:`, `function:` も対象に)
- **対象ごとに最適化されたシステムプロンプト**:
  - title: 「全角20〜32文字以内、主要キーワードを前半に」
  - metaDescription: 「全角80〜120文字以内、前半70文字に重要情報」
  - h1: 「全角15〜40文字以内、タイトルと内容が一致しつつ同一文言は避ける」
  - linkText: 「『こちら』『詳細』を避け、リンク先の内容が分かる文言」
  - altText: 「125文字以内、『image of』等の冗長表現を避ける」

#### 🎨 UI (`public/index.html`)
- 推奨アクション展開時に **`[✨ AI に書き換え提案を依頼]`** ボタンを表示
- 表示条件: `category` と `issue` 文言から該当する書き換え対象を判定
- クリック時:
  - 「⏳ AI に問い合わせ中...」状態 → ボタン disabled
  - 結果表示: 3案それぞれに「提案 N / コピー / 理由」
  - エラー時: 再試行ボタン
- コピー機能: クリップボード API + フォールバック

### 🧪 テスト

`__tests__/phase-2e-llm-rewrite.test.js` 新規 (29項目):
- 基本動作 (isEnabled, rewrite の null返却, SUPPORTED_TARGETS 公開)
- バリデーション (input null, 未サポート target)
- 正常系 (3案返却, コードフェンス対応, text欠落除外)
- エラー処理 (HTTP 401 / network / 壊れた JSON / suggestions 欠落)
- キャッシュ (同入力ヒット, 別 target 別キャッシュ)
- サニタイズ (長さ制限, 6種類のロールキーワード中和, 制御文字)
- buildSystemPrompt の target ごとプロンプト生成
- 後方互換性 (OPENAI_API_KEY 未設定)

**全テスト 408/408 PASS** (regression なし)

### 💰 コスト

- gpt-4o-mini: $0.15/1M input + $0.60/1M output tokens
- 1書き換え提案あたり ~600 input + 300 output tokens ≒ **$0.0003 (0.05円)**
- 平均5クリック/診断 → 1診断あたり **約 0.3円** 追加
- 月100診断 + 各5クリック = **約 30円**
- 月1,000診断 + 各5クリック = **約 300円**
- 既存のハードリミット $20/月 (約 3,000円) で十分余裕

### 📦 環境変数
- `OPENAI_API_KEY` (既存): Phase 2-C で設定済み、追加設定不要

### 📦 Breaking Changes
なし。
- LLM 無効環境では UI に AI ボタンが表示されるが、クリック時に 503 エラーになる
- 既存の全機能はそのまま動作

### 📦 version bump
`2.9.0` → `2.10.0` (minor: 新機能、後方互換)

---

## [2.9.0] - 2026-05-24 — feat: favicon 一式を追加 (聴診器モチーフ + Claw 青)

中村さんのご要望「faviconが無いのは寂しいですね」への対応。

### 🎨 デザイン
- **モチーフ**: 聴診器 (stethoscope) — "Doctor" のネーミングに合わせる
- **配色**: 角丸正方形の Claw 青背景 (`#2563eb`) + 白の聴診器 + 青のチェックマーク
- **意味付け**: 「診断 OK」のメタファー (チェックマークが聴診器のチェストピース内に配置)
- 小サイズ (16x16) でも認識性が高いシンプルな線画

### 🆕 生成したアセット (`public/` 直下)
| ファイル | サイズ | 用途 |
|---|---|---|
| `favicon.svg` | スケーラブル | モダンブラウザの優先指定 |
| `favicon.ico` | 16+32+48 マルチサイズ | レガシーブラウザ |
| `favicon-16x16.png` | 16x16 | 標準小 |
| `favicon-32x32.png` | 32x32 | 標準 |
| `favicon-48x48.png` | 48x48 | ICO 用 |
| `apple-touch-icon.png` | 180x180 | iOS ホーム画面 |
| `android-chrome-192x192.png` | 192x192 | Android |
| `android-chrome-512x512.png` | 512x512 | 大サイズ・PWA |
| `site.webmanifest` | PWA manifest | PWA 対応 (theme: #2563eb) |

### 🆕 生成スクリプト
- `scripts/generate-favicons.js` 新規追加
- `public/favicon.svg` をマスターとして、puppeteer で各サイズの PNG を生成
- ICO は 16/32/48 のマルチサイズで手書きバイナリ生成 (外部依存追加なし)
- 将来デザイン変更時は `npm install puppeteer` 後にスクリプト実行で全サイズ再生成可能

### 🔧 `public/index.html` の `<head>` に追加
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2563eb">
```

### ✅ 動作確認
ローカル起動 + ブラウザで全アセット 200 OK 確認:
- `/favicon.ico` → 200
- `/favicon.svg` → 200
- `/apple-touch-icon.png` → 200
- `/site.webmanifest` → 200 (theme_color: #2563eb)
- SVG を直接表示してデザインを目視確認

### 📦 Breaking Changes
なし。追加のみ。

### 📦 version bump
`2.8.1` → `2.9.0` (minor: 新機能、影響範囲なし)

---

## [2.8.1] - 2026-05-24 — fix(phase-2d.1): typo 修正 `LogoImageObject` → `ImageObject`

PR #17 (Phase 2-D) レビューで cursor から指摘された typo を即修正。

### 🔧 修正内容
`structured-data-recommender.js` L77:
- 旧: `Organization.optional = ['BreadcrumbList', 'Person', 'LogoImageObject']`
- 新: `Organization.optional = ['BreadcrumbList', 'Person', 'ImageObject']`
- 理由: `LogoImageObject` は schema.org に**存在しない**。正しくは `ImageObject` (ロゴはこの型で表現する)

### 🧪 regression 防止テスト追加
`__tests__/phase-2d-llm-schemas.test.js` に検証ケースを1つ追加:
- `recommendations` 全エントリに `LogoImageObject` / `BreadcrumbListItem` / `NewsArticleObject` などの既知 typo パターンが含まれていないこと

### 📦 影響
LLM が `Organization` を主タイプとして判定したケースで、UI に「LogoImageObject」という存在しないスキーマが推奨されていた。実害は **schema.org の Validator で警告が出る程度** だが品質問題。

### 📦 version bump
`2.8.0` → `2.8.1` (patch: typo fix)

---

## [2.8.0] - 2026-05-24 — Phase 2-D: LLM が「推奨スキーマ」も判定 + ルールベース新タイプ拡張

中村さんからの実運用フィードバック「**必要なスキーマ (3件) が実際に適正な判断になっているか怪しい**」への対応。Phase 2-C で LLM がページタイプを正しく判定するようになったが、その下流の **構造化データ推奨** が旧10タイプ前提のままで、LLM の新タイプ判定に追従していなかった問題を解消する。

### 🎯 解決した課題

Phase 2-C 後のシナリオ:
1. LLM「`ads.mercari.com` は `WebPage` です」と判定 ✅
2. recommender「`WebPage` のマッピングが無いのでデフォルト `Article` を返します」 ❌
3. ユーザーに「必要なスキーマ: Article, NewsArticle, BlogPosting」と表示される
4. → **判定は正しいのに推奨が的外れ**

### ✨ 対応 1: LLM プロンプトに「推奨スキーマ」も含める

`llm-page-type-corrector.js` のシステムプロンプトを拡張:
- 1回の LLM コールで「主タイプ判定 (A)」と「推奨スキーマ (B)」を同時に取得
- 出力 JSON に `recommendedSchemas: { required, recommended, optional }` を追加
- 各スキーマには `{ schema, reason }` (なぜこのページに必要か日本語1文)
- コスト変わらず、レイテンシ変わらず (出力トークン微増のみ)

具体例の組み込み:
```
- BtoB サービス LP (例: ads.mercari.com) なら:
  + 必須: WebPage / Service
  + 推奨: Organization, BreadcrumbList, ContactPoint
  + 参考: VideoObject (動画があれば), FAQPage (FAQがあれば)
```

### ✨ 対応 2: 既存スキーマを LLM 入力に含める

LLM が「これは既に実装済み」を理解できるようにする:
- `analyzePageAsync($, url, { existingSchemas: ['Organization', 'WebSite'] })`
- LLM プロンプトに「すでに実装されている schema.org タイプ: ... これらは required/recommended から除外する判断材料に」と明示
- 重複推奨を構造的に防ぐ

### ✨ 対応 3: recommender が LLM 推奨を優先採用

`structured-data-recommender.js#generateRecommendations`:
- `pageAnalysis.recommendedSchemas` が存在すれば LLM 推奨を採用
- 存在しない / 全部空 → ルールベース推奨にフォールバック
- 戻り値に `source: 'llm' | 'rule-based'` を追加してトレーサビリティ確保
- 既存スキーマと重複する LLM 推奨は除外
- 同じスキーマが複数推奨されても 1件にユニーク化

### ✨ 対応 4: ルールベース recommender に新タイプを追加

LLM が返す可能性のある全タイプを `this.recommendations` に追加:
- **WebPage** → primary: WebPage, secondary: Organization, BreadcrumbList
- **Service** → primary: Service, secondary: Organization, Offer, AggregateRating
- **AboutPage** → primary: AboutPage, secondary: Organization, Person
- **ContactPage** → primary: ContactPage, secondary: Organization, ContactPoint, PostalAddress
- **CollectionPage** → primary: CollectionPage, secondary: BreadcrumbList, ItemList
- **SoftwareApplication** → primary: SoftwareApplication, secondary: Organization, AggregateRating, Offer
- **Organization** → primary: Organization, secondary: ContactPoint, PostalAddress
- **Person** → primary: Person, secondary: Organization
- **NewsArticle** / **BlogPosting** (Article の個別エントリ)
- **VideoObject** → primary: VideoObject, secondary: Organization, Person
- **FAQPage** (FAQ の正式名)

これにより LLM が無効な環境でもページタイプに応じた適切な推奨が出る。

### 🧪 テスト

`__tests__/phase-2d-llm-schemas.test.js` 新規 (25項目):
- LLM レスポンスパーサの recommendedSchemas 解釈 (4ケース)
- PageTypeAnalyzer 経由での recommendedSchemas 伝搬 (2ケース)
- existingSchemas オプションの LLM 入力への伝搬
- StructuredDataRecommender の LLM 優先採用 (5ケース)
- LLM 推奨と既存スキーマの重複除外
- LLM 推奨内のスキーマ重複ユニーク化
- ルールベース新タイプ対応 (12タイプの test.each)
- 後方互換性 (LLM 無効でも動作、既存挙動と同じ)

全テスト **378/378 PASS** (regression なし)

### 💰 コスト

Phase 2-C と同じ LLM コール数。出力トークンが微増 (~200 → ~400 tokens) するが、
1診断あたり約 **$0.0006 (0.09円)** にとどまる。月1,000診断で 90円。

### 📦 Breaking Changes
なし。
- `pageTypeAnalysis.recommendedSchemas` は新規 optional フィールド
- `structuredDataRecommendations.source` も新規追加フィールド
- 既存の `recommendations.missing/improvements/optional` 構造は同じ

### 📦 version bump
`2.7.0` → `2.8.0` (minor: 新機能、後方互換)

---

## [2.7.0] - 2026-05-24 — Phase 2-C: LLM ページタイプ補正 (OpenAI gpt-4o-mini)

中村さんからの実運用フィードバック: `ads.mercari.com` が `LocalBusiness` と誤判定される件を解消。
ルールベース判定だけでは捉えきれない「BtoB サービス LP」「ブランドサイト」「広告掲載案内」などの**意味的なページタイプ判定**を、OpenAI GPT-4o-mini で補正できるようになりました。

### 🎯 解決した課題

- `ads.mercari.com` のような **BtoB サービス LP** が、本文に含まれる「お問い合わせ」「住所」「営業時間」のキーワードに引きずられて誤って `LocalBusiness` と判定されていた
- ルールベースの 10 タイプ (Article/Product/LocalBusiness/Recipe/Event/FAQ/HowTo/Review/JobPosting/Course) に分類できないページタイプが多数存在
  - `Service` / `WebPage` / `AboutPage` / `ContactPage` / `Organization` / `SoftwareApplication` 等
- 「内容分析による判定」としか説明できず、ユーザーが納得感を持てない

### ✨ 新機能: LLM ページタイプ補正

#### 🆕 `llm-page-type-corrector.js` (新規モジュール)
- OpenAI Chat Completions API (gpt-4o-mini) を `fetch` で直接呼び出す軽量実装 (依存追加なし)
- システムプロンプトで schema.org 仕様と判定ルールを教え込み、JSON のみ出力させる
  - `response_format: { type: 'json_object' }` で構造化レスポンス保証
  - `temperature: 0` で同入力→同出力を保証
- 出力フィールド:
  - `primaryType`: schema.org の主タイプ
  - `secondaryTypes`: 候補タイプ
  - `confidence`: 0.0-1.0
  - `reasoning`: 日本語1-2文の判定根拠
  - `matchedSignals`: 判定の決め手となったシグナル配列

#### 🛡️ 安全装置 (本番運用前提の設計)
- **API キー未設定なら完全に既存ルールベース挙動を維持** (`isEnabled()` で判定)
- **タイムアウト 8秒** で失敗 → ルールベースにフォールバック
- **HTTP エラー / JSON パース失敗** → ルールベースにフォールバック
- **メモリ LRU キャッシュ** (100エントリ / 24時間) で連続診断のコスト削減
- **入力サニタイズ**:
  - サイズ制限 (title 200字 / meta 400字 / body 1000字 / heading 15個×100字)
  - 制御文字除去
  - `system:` / `assistant:` / `developer:` のプロンプトインジェクション無効化
- **プロセス内キャッシュ** (Render 再起動でリセットされる、許容)

### 🔄 `page-type-analyzer.js` の async 化
- `analyzePage()` (同期版) は後方互換のため**そのまま残す**
- `analyzePageAsync()` (新規) で LLM 補正を含む判定
- 既存呼び出し (`index.js`, `detailed-analyzer.js`) を非同期化
  - `SEOChecker.checkStructuredData()` も async に
  - `DetailedAnalyzer.analyzeDetails()` / `analyzeStructuredData()` も async に

### 🎨 UI 拡張 (`public/index.html`)
- ページタイプ分析カードに:
  - 🆕 **AI バッジ** (紫グラデーション) で LLM 判定であることを明示
  - 🆕 **「判定の決め手」** チップで根拠を視覚化
  - 🆕 **ルールベース判定との並列比較**: AI が上書きした場合に旧判定を脚注表示
- 既存の Phase 1.7 デザイン体系を踏襲

### 🧪 テスト
- `__tests__/phase-2c-llm-page-type.test.js` 新規 (22項目)
  - 基本動作 (isEnabled, correct の null返却)
  - 正常系 (JSON パース / コードフェンス対応)
  - エラー処理 (401 / network error / 壊れた JSON / 必須フィールド欠落 / 範囲外 confidence)
  - LRU キャッシュ (ヒット / サイズ超過時の最古削除)
  - 入力サニタイズ (長さ制限 / プロンプトインジェクション中和 / 制御文字 / headings 配列)
  - PageTypeAnalyzer 統合 (LLM成功 / 無効 / 失敗 / 例外スロー)
  - **後方互換性**: OPENAI_API_KEY 未設定で既存挙動完全一致
- Phase 1.8 のテストを async 対応に更新 (`await` を許容する正規表現)
- 全テスト **353/353 PASS** (regression なし)

### 💰 コスト試算
- gpt-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
- 1診断あたり約 1,500 input + 200 output tokens ≒ **$0.0004 (0.06円)**
- 月1,000診断で約 **60円**、月10,000診断で約 **600円**
- Render env var `OPENAI_API_KEY` に **ハードリミット $20/月推奨**

### 📦 環境変数
- `OPENAI_API_KEY`: OpenAI API キー (本番のみで設定、ローカル/CIでは未設定で既存挙動)

### 📦 Breaking Changes
なし。LLM が有効でも無効でも `pageTypeAnalysis` オブジェクトの主要フィールド (`primaryType`, `confidence`, `secondaryTypes`) は同じ形式。`llmCorrection` は **追加** フィールドで optional。

### 📦 version bump
`2.6.0` → `2.7.0` (minor: 新機能 + 既存挙動完全互換)

---

## [2.6.0] - 2026-05-24 — Phase 1.8: 不要タブ削除 (UI シンプル化)

中村さんからの実運用フィードバック: 「具体的な箇所 / 詳細レポート / Markdownレポート の3タブは不要」を反映。タブを **7個 → 4個** に集約し、Claw らしいシンプル設計を徹底。

### 🎯 削除したタブ
- **具体的な箇所**: SEO詳細とサマリーの推奨アクションで内容ほぼカバー済み、価値が低い
- **詳細レポート**: 情報過多で読みにくく、サマリーで充足
- **Markdownレポート**: UIから直接コピーする使い方が想定より少ない

### 🎨 新タブ構成 (4つ)
1. サマリー (総合スコア + 全推奨アクション一覧)
2. SEO詳細
3. AIO詳細
4. 構造化データ

### 🔧 削除した実装

#### `public/index.html`
- タブボタン: `data-tab="specific"` / `"detailed"` / `"report"`
- タブコンテナ: `<div id="specific">` / `id="detailed"` / `id="report"`
- JSメソッド:
  - `async generateReport()` (約 30 行) — `/api/report/seo` を叩く処理
  - `displaySpecificIssues(results)` (約 85 行) — カテゴリ別の問題箇所表示
  - `displayDetailedReport(results)` (約 142 行) — クイックウィン/優先度分析/実装計画
- グローバル関数: `function toggleIssueDetails(issueId)`
- CSS: `.detailed-report` / `.specific-issues` / `.specific-issue` / `.issue-*` /
  `.report-content` / `.summary-cards` / `.score-large` / `.grade` / `.status-badge` /
  `.quick-wins-grid` / `.quick-win-card` / `.priority-section` / `.priority-item` /
  `.implementation-*` / `.tools-list` / `.tool-tag` / `.impact-card` / `.benefits` /
  `.category-section` / `.win-meta` / `.item-meta` 等 約 8,600 文字相当
- `displayResults` から3つのメソッド呼び出し
- 比較モードの「他タブ案内」リストから削除済みIDを除外

#### `index.js`
- API エンドポイント `app.post('/api/report/seo', ...)`
- API エンドポイント `app.post('/api/report/detailed', ...)`

#### `openapi.yaml`
- `/api/report/seo` / `/api/report/detailed` のパス定義
- `ReportSuccessResponse` / `DetailedReportSuccessResponse` スキーマ定義

### 🔒 内部ロジックは保持
- `SEOChecker.checkSEO()` 内で `results.detailedAnalysis` / `results.detailedReport` の生成は継続
- `checker.generateReport()` (Markdown 生成) メソッド本体も保持
- 理由:
  - 将来サマリーに「クイックウィン」「実装計画」「期待される効果」を統合する可能性
  - 外部連携 (内部スクリプトから Markdown レポートを生成して Slack 投稿等) で再利用可能
- `slim:true` パラメータで詳細データを除外可能（既存仕様維持）
- 復活が必要なら git 履歴 (v2.5.0 以前) から復元可能

### 🧪 テスト
- `__tests__/phase-1-8-tab-cleanup.test.js` 新規 (11項目):
  - 削除対象のタブボタン/コンテナの不在
  - 削除対象 JS メソッドの不在
  - 削除対象 API エンドポイントの不在
  - 4タブ (サマリー/SEO詳細/AIO詳細/構造化データ) の存在
  - 既存エンドポイント (/api/check/seo, /api/compare, /api/version) の存在
  - 内部ロジック (detailedAnalysis/detailedReport/generateReport) の維持
- 全テスト 331/331 PASS (regression なし)

### ✅ 実機検証
ローカル `https://carenet.com/` 診断:
- ✅ タブが 4個に削減
- ✅ サマリー / SEO詳細 / AIO詳細 / 構造化データ が正常表示
- ✅ 推奨アクション 28件すべて Phase 1.5/1.6 のキャリブレーション結果反映
- ✅ 削除した `/api/report/*` が 404
- ✅ 既存 `/api/check/seo` `/api/compare` `/api/version` が 200
- ✅ フッタ `v2.6.0 · MIT License`

### 📦 Breaking Changes
- API: `/api/report/seo` `/api/report/detailed` は削除されました。
  これらを利用していた外部スクリプトがある場合は git 履歴から復元してください。
- UI: 3タブが消えました。外部から直接タブURLハッシュで遷移していたケースは影響を受けます。

### 📦 version bump
`2.5.0` → `2.6.0` (minor: UI構成変更 + API削除)

---

## [2.5.0] - 2026-05-24 — Phase 1.7: 構造化データタブ UI 改善

中村さんから実運用フィードバック「構造化データタブの結果レポートUIが見づらい」とのご指摘を受け、タブ全体を Claw 風に再設計。

### 🔴 解決した問題

#### 問題1: 信頼度 800% のバグ
- `page-type-analyzer.js` の `confidence` フィールドが生スコアを返していた
- UI 側で `confidence * 100` を表示する設計だったため、生スコア 8 が **「信頼度 800%」** として表示されていた
- 全タイプスコアの合計を分母にして **0-1 に正規化**するよう修正

#### 問題2: JSON-LD コードが改行なし1行で表示
- `<div class="implementation-code">` に `JSON.stringify(template.schema, null, 2)` の整形済みコードが入っていたが、対応するCSSがなく `white-space: normal` (デフォルト) でレンダリングされて改行が無視されていた
- `<pre><code>` に変更 + `.schema-code` CSS で `white-space: pre` + ダークではなくライト背景でコード可読性UP

#### 問題3: 各情報のラベルがなく階層が見えない
- 旧UI: `SEO値: 88` / `1時間` / `LocalBusinessは店舗・事業所情報として必須です` / 長文の `<script>` / `📋 コードをコピー` ボタンが**縦並びの単独行**で構造が見えなかった
- 新UI: スキーマカードを **折りたたみ式** にし、ヘッダー1行で `スキーマ名 / 優先度 / SEO値 / 実装目安` を整列
- 展開時は `推奨理由` / `実装コード例` / `検証ツール` / `実装メリット` がそれぞれ **大文字小ラベル付きセクション** に分かれる

#### 問題4: 絵文字過剰でセクション識別困難
- 旧: `🚨 必須スキーマ` / `⭐ 推奨スキーマ` / `💡 オプションスキーマ` / `📄 ページタイプ分析結果` / `🔍 検証ツール` / `💰 実装メリット` / `🔗` / `✅`
- 新: バッジ風ラベル `[必須] / [推奨] / [参考]` + 自然な日本語見出し
  - 「必要なスキーマ」「追加すると効果的なスキーマ」「余力があれば追加」
- 絵文字を section header から撤去、装飾性は最低限に

### ✨ 実装

#### 🔧 `page-type-analyzer.js`
- `confidence` を `topScore / totalScore` で 0-1 に正規化
- `rawScore` フィールドを新規追加（デバッグ用）

#### 🎨 `public/index.html`
- `generateSchemaItem` を **`<button class="schema-card-header">` ベースのアクセシブルな展開UI** に書き換え
  - `aria-expanded` / `aria-controls` でARIA同期
  - `:focus-visible` でキーボードフォーカス表示
- `displayStructuredData` のページタイプ分析カードを再設計
  - 横一列の `[ラベル] 判定 [信頼度バッジ]` ヘッダー構造
  - 3カラムグリッドの詳細表示 (主要タイプ / 候補タイプ / 分析根拠)
- セクションヘッダーを `<h3 class="schema-section-title">` + `<span class="schema-section-marker">` の構造に
- 期待される効果カードも統一テーマに揃え、増加分の数値を緑 (`var(--good)`) で強調
- **JS 文字列リテラル中の `</script>` を `'<' + '/script>'` でエスケープ** （HTML パーサが終了してしまう問題への対処）
- スキーマカードのトグル/コードコピーハンドラ `attachSchemaCardHandlers()` を新規追加
  - クリップボードAPI + フォールバック (textarea + execCommand)
  - 「コピー」→「コピー済み」ボタン状態変化

#### 🆕 新CSS（200行追加）
- `.schema-card` / `.schema-card-header` / `.schema-card-body`
- `.schema-code` (ライト背景、等幅、`white-space: pre`)
- `.schema-copy-btn` / `.schema-copy-btn.copied`
- `.schema-section-marker` (バッジ風、必須/推奨/参考で色分け)
- `.schema-validation-list` / `.schema-benefits-list`
- `.benefits-grid` / `.benefit-item` / `.benefit-percentage.benefit-positive`
- `.page-type-analysis` を Phase 1.2 デザイントークン体系で再設計

### 🧪 テスト
- `__tests__/phase-1-7-structured-data.test.js` 新規 (7項目)
  - confidence の 0-1 正規化
  - 800%バグの回帰防止
  - primaryType / secondaryTypes / analysisDetails の維持
  - `rawScore` フィールドの保持
  - totalScore=0 の縮退ケース
- 全テスト 320/320 PASS (regression なし)

### ✅ 実機検証

ローカル `https://ads.mercari.com/` の構造化データタブ:
- ✅ 信頼度 800% → **100%**
- ✅ ページタイプ分析が3カラムで整理 (主要タイプ / 候補タイプ / 分析根拠)
- ✅ スキーマカード(LocalBusiness/Organization/PostalAddress/ContactPoint/OpeningHoursSpecification/GeoCoordinates/Review)が **折りたたみ式** に
- ✅ 展開時のJSON-LDコードが **インデント保持** で読みやすく
- ✅ 「期待される効果」が4枚のカードで `75%` `+14%` `+23%` `+40%` と整列

### 📦 Breaking Changes
なし。`page-type-analyzer.js` の `confidence` 仕様変更は破壊的変更だが、旧UI側の `* 100` はそのまま正しい値を出すようになるだけ。

### 📦 version bump
`2.4.0` → `2.5.0` (minor: UI大幅改善 + バグ修正)

---

## [2.4.0] - 2026-05-24 — Phase 1.6: AIO スコア関数の区分線形化

Phase 1.5 で SEO 側を区分線形化したのに続き、AIO 側 6カテゴリのスコア関数も同様に対応。
SEO + AIO 両方が滑らかなスコアになり、診断結果がより実態に即した評価になります。

### 🎯 解決した課題

#### 旧仕様の問題
- 各カテゴリの加点が **閾値ベースの「あるかないか」** だった
- 例: `calculateCredibilityScore` は5項目それぞれ「>0 で +20点」だけ
  - author 1個も 100個も同じ 20点
  - 引用 1個も 50個も同じ 20点
- 例: `calculateAISearchScore` は「`questionPatterns > 0` で +25点」「`numericData >= 3` で +25点」
  - 1個と100個の違いが反映されない
  - 数値データが2個と3個で 0点 vs 25点という不連続なジャンプ
- 例: `calculateNaturalLanguageScore` は閾値超えの瞬間に -20 ペナルティ
  - 文長 49字 と 51字 で 100点 vs 80点の急変
- 例: `calculateComprehensivenessScore` は `wordCount >= 300 && wordCount <= 3000` で +30
  - 299語と 300語で 0 vs 30点
  - 3000語と 3001語で 30 vs 0点

### ✨ 実装

#### 🆕 `piecewiseLinearScore` ヘルパーを `aio-checker.js` にも追加
- SEOChecker と同じ仕様の汎用ヘルパー
- 重複を許容（独立クラスのため）

#### 🔄 `calculateComprehensivenessScore` (区分線形)
- wordCount: 35点満点 (旧30)
  - 100語=8, 300語=22, 500語=30, 800-2000語=35 (理想), 3000語=28, 5000語=20
- paragraphCount: 25点満点 (旧20)
  - 1=5, 2=12, 3=20, 5以上=25
- listCount: 15点満点 (旧20)
  - 1=10, 3以上=15
- ratio (見出し当たり語数): 25点満点 (旧30)
  - 50=10, 100=18, 200-400=25 (理想), 600=20, 1000=15

#### 🔄 `calculateStructuredInfoScore` (区分線形)
- jsonLd: 0=0, 1=28, 2=35, 3+=40
- faqElements: 0=0, 1=18, 3=26, 5+=30
- definitionLists: 0=0, 1=18, 3=26, 5+=30

#### 🔄 `calculateCredibilityScore` (区分線形)
- author/date/contact: 0=0, 1+=20 (ある/ないが本質、そのまま)
- citations: 1=10, 3=16, 5+=20 (多いほど信頼性高)
- highAuthorityLinks: 1=10, 3=16, 5+=20

#### 🔄 `calculateAISearchScore` (区分線形)
- questionPatterns: 1=15, 3=22, 5+=25
- hasComparison: false=0, true=25 (boolean)
- stepPatterns: 1=15, 3=22, 5+=25
- numericDataCount: 1=10, 3=20, 5+=25

#### 🔄 `calculateNaturalLanguageScore` (区分線形ペナルティ)
- 文長ペナルティ: 30字以下=0, 50字=-15, 80字以上=-25
- 専門用語ペナルティ: 5個以下=0, 10個=-10, 20個以上=-25
- 受動態ペナルティ: 2個以下=0, 5個=-10, 10個以上=-25
- 接続詞ペナルティ: 5個以上=0, 3個=-10, 0個=-25

#### 🔄 `calculateContextRelevanceScore` (区分線形)
- urlRelevance: 0=0, 0.2=15, 0.5=30, 0.7+=40
- relevantInternalLinks: 1=15, 3=25, 5+=30
- categories: 1=20, 3+=30

### 🧪 テスト
- `__tests__/phase-1-6-aio-calibration.test.js` 新規 (39項目)
  - piecewiseLinearScore ヘルパー検証
  - 6カテゴリ全部の区分線形化検証
  - 「0/50/100の3段階から脱却している」検証
  - 既存挙動 regression テスト (checkAIO 7カテゴリ返却、スコア型/範囲)
- 全テスト **313/313 PASS** (regression なし)

### ✅ 実機検証

| サイト | AIO カテゴリ | 旧 | 新 |
|---|---|---|---|
| carenet.com | contentComprehensiveness | 60点付近 | **92** |
| carenet.com | credibilitySignals | 20-40点 | **13** (細かく評価) |
| carenet.com | naturalLanguageQuality | 100-20点 | **25** |
| llmstxt.org | contentComprehensiveness | 100点 | **94** |
| llmstxt.org | credibilitySignals | 40-60点 | **40** |

カテゴリスコアが 0/25/50/75/100 などの離散値から **0/13/20/25/40/69/92/94/95** のような実態を反映した連続値に。

### 📦 Breaking Changes
なし。ただし**過去診断スコアと数点〜数十点の差が出る可能性**あり。
Phase 1.5 同様、これは「より正確な評価」になった結果。

### 📦 version bump
`2.3.2` → `2.4.0` (minor: スコアリングロジック大幅改善)

---

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
