/**
 * Phase 2-H: ページタイプ判定の精度向上テスト
 *
 * 中村さんから報告された誤判定:
 *   https://ads.mercari.com/column/136 が「商品ページ」と判定される問題
 *
 * 原因:
 *   1. 本文に '商品', '価格', '購入', 'カート' が頻出 (広告サービスを商品として説明する記事)
 *   2. URL の '/column/' パターンが弱い重み (2.0) で見過ごされる
 *   3. LLM 補正が 8 秒タイムアウトで失敗 → ルールベースの誤判定がそのまま表示
 *
 * 修正:
 *   1. URL 重みを 2.0 → 5.0 に強化
 *   2. URL マッチしたタイプ以外は本文キーワードからのスコアを 50% 減衰
 *   3. Article の urlPatterns に /columns/ (複数形) /articles/ /case/ 等を追加
 *   4. LLM タイムアウトを 8s → 15s に延長
 *   5. AbortError のエラーコードを 'LLM_TIMEOUT' に正規化
 */
process.env.NODE_ENV = 'test';
const cheerio = require('cheerio');
const PageTypeAnalyzer = require('../page-type-analyzer.js');
const LlmPageTypeCorrector = require('../llm-page-type-corrector.js');

describe('Phase 2-H: URL パターン重視のページタイプ判定', () => {
  // LLM 補正を無効化してルールベースだけテスト
  const analyzer = new PageTypeAnalyzer({ llmCorrector: { isEnabled: () => false } });

  test('/column/ を含む URL は Article 判定 (本文に商品キーワード多数でも)', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>検討の熱量をメルカリ内の購買導線へつなぐWebサイトリターゲティング</title>
      <meta name="description" content="メルカリAdsのWebサイトリターゲティング機能を解説する記事">
      </head><body>
      <h1>メルカリAdsのWebサイトリターゲティング</h1>
      <p>本記事では商品の購入や価格設定、カートへの遷移など、ECサイトでの導線について解説します。
         商品の購入や価格を訴求するための広告手法を商品中心に解説します。
         商品の購入や価格を最適化するための施策、価格や商品の在庫管理、購入時のカート挙動の最適化など、
         商品関連の話題を取り上げます。</p>
      <p>商品の購入や価格、商品、購入、カートの記述を続けます。</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://ads.mercari.com/column/136');
    expect(result.primaryType).toBe('Article');
  });

  test('/columns/ (複数形) も Article 判定', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>テスト記事</title>
      </head><body>
      <h1>テスト</h1>
      <p>商品 商品 商品 価格 価格 価格 購入 購入 購入 カート カート カート</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/columns/abc');
    expect(result.primaryType).toBe('Article');
  });

  test('/case-study/ も Article 判定', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>事例</title>
      </head><body>
      <h1>導入事例</h1>
      <p>商品 価格 購入 商品 価格 購入</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/case-study/123');
    expect(result.primaryType).toBe('Article');
  });

  test('/product/ を含む URL なら Product 判定 (記事キーワードが本文にあっても)', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>iPhone 15 Pro</title>
      <meta name="description" content="価格 ¥150,000">
      </head><body>
      <h1>iPhone 15 Pro 詳細</h1>
      <p>商品の価格は150,000円。購入はカートから。在庫あり。</p>
      <p>記事 ブログ ニュース 解説 コラム</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/product/iphone-15');
    expect(result.primaryType).toBe('Product');
  });

  test('URL マッチしない場合は従来通り本文ベース', () => {
    // 単純なホームページ系
    const html = `<!DOCTYPE html><html><head>
      <title>商品紹介ページ</title>
      <meta name="description" content="商品の価格と購入情報">
      </head><body>
      <h1>商品一覧</h1>
      <p>商品 価格 購入 カート 商品 価格 購入 カート</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/');
    // URL マッチなし → 本文の Product キーワードで Product 判定
    expect(result.primaryType).toBe('Product');
  });
});

describe('Phase 2-H: weights.url が 5.0 に強化されている', () => {
  test('analyzer.weights.url === 5.0', () => {
    const analyzer = new PageTypeAnalyzer();
    expect(analyzer.weights.url).toBe(5.0);
  });
});

describe('Phase 2-H: _getUrlMatchedTypes ヘルパー', () => {
  const analyzer = new PageTypeAnalyzer({ llmCorrector: { isEnabled: () => false } });

  test('/column/ → Article のみマッチ', () => {
    const matched = analyzer._getUrlMatchedTypes('https://example.com/column/123');
    expect(matched).toContain('Article');
    expect(matched).not.toContain('Product');
  });

  test('/shop/ → Product と LocalBusiness 両方マッチ', () => {
    const matched = analyzer._getUrlMatchedTypes('https://example.com/shop/items');
    expect(matched).toContain('Product');
    expect(matched).toContain('LocalBusiness');
  });

  test('マッチなし URL → 空配列', () => {
    const matched = analyzer._getUrlMatchedTypes('https://example.com/');
    expect(matched).toEqual([]);
  });

  test('null/undefined → 空配列', () => {
    expect(analyzer._getUrlMatchedTypes(null)).toEqual([]);
    expect(analyzer._getUrlMatchedTypes(undefined)).toEqual([]);
    expect(analyzer._getUrlMatchedTypes('')).toEqual([]);
  });
});

describe('Phase 2-H: LLM Corrector タイムアウト延長', () => {
  test('TIMEOUT_MS は 15000ms (15秒)', () => {
    const corrector = new LlmPageTypeCorrector({ apiKey: 'sk-test' });
    expect(corrector.timeoutMs).toBe(15000);
  });
});

describe('Phase 2-H: AbortError のエラーコード正規化', () => {
  test('AbortError は LLM_TIMEOUT に正規化', async () => {
    const fetchImpl = async () => {
      const err = new Error('This operation was aborted');
      err.name = 'AbortError';
      err.code = 20;
      throw err;
    };
    const corrector = new LlmPageTypeCorrector({
      apiKey: 'sk-test',
      fetchImpl,
    });
    const result = await corrector.correct({
      url: 'https://example.com/',
      title: 'Test',
      ruleBased: { primaryType: 'Article', confidence: 0.5 },
    });
    expect(result.error).toBe(true);
    expect(result.errorCode).toBe('LLM_TIMEOUT');
  });

  test('err.code が数値 20 の場合も LLM_TIMEOUT', async () => {
    const fetchImpl = async () => {
      const err = new Error('aborted');
      err.code = 20;
      throw err;
    };
    const corrector = new LlmPageTypeCorrector({
      apiKey: 'sk-test',
      fetchImpl,
    });
    const result = await corrector.correct({
      url: 'https://example.com/',
      title: 'Test',
      ruleBased: { primaryType: 'Article', confidence: 0.5 },
    });
    expect(result.errorCode).toBe('LLM_TIMEOUT');
  });

  test('HTTP 401 等は errorCode 文字列をそのまま', async () => {
    const fetchImpl = async () => {
      const err = new Error('Unauthorized');
      err.code = 'OPENAI_HTTP_401';
      throw err;
    };
    const corrector = new LlmPageTypeCorrector({
      apiKey: 'sk-test',
      fetchImpl,
    });
    const result = await corrector.correct({
      url: 'https://example.com/',
      title: 'Test',
      ruleBased: { primaryType: 'Article', confidence: 0.5 },
    });
    expect(result.errorCode).toBe('OPENAI_HTTP_401');
  });

  test('errorCode 未設定の例外は LLM_CALL_FAILED', async () => {
    const fetchImpl = async () => {
      throw new Error('Network error');
    };
    const corrector = new LlmPageTypeCorrector({
      apiKey: 'sk-test',
      fetchImpl,
    });
    const result = await corrector.correct({
      url: 'https://example.com/',
      title: 'Test',
      ruleBased: { primaryType: 'Article', confidence: 0.5 },
    });
    expect(result.errorCode).toBe('LLM_CALL_FAILED');
  });
});

describe('Phase 2-H: 後方互換性', () => {
  test('既存の analyzer.analyzePage が引き続き動く', () => {
    const analyzer = new PageTypeAnalyzer({ llmCorrector: { isEnabled: () => false } });
    const html = `<!DOCTYPE html><html><head>
      <title>FAQ</title>
      </head><body>
      <h1>よくある質問</h1>
      <p>Q. ○○とは何ですか？ A. ○○です。質問 回答 FAQ</p>
      </body></html>`;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/faq/');
    expect(result.primaryType).toBe('FAQ');
  });
});
