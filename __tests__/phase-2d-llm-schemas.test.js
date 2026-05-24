/**
 * Phase 2-D: LLM 推奨スキーマ統合のテスト
 *
 * 中村さん指摘: 「必要なスキーマ (3件) が実際に適正な判断になっているか怪しい」
 * 原因: LLM が判定した新タイプ (WebPage / Service 等) に対し、
 *      structured-data-recommender のマッピングが旧10タイプしか持っておらず
 *      Article のフォールバックを返していた
 *
 * 対応:
 *   1. LLM プロンプトに「推奨スキーマ」も判定させる
 *   2. recommender が LLM 結果を優先採用、フォールバックでルールベース拡張
 *   3. ルールベースに新タイプ (WebPage/Service/AboutPage/ContactPage/
 *      SoftwareApplication/CollectionPage/Organization/Person/NewsArticle/
 *      BlogPosting/VideoObject) を追加
 *
 * このテストで保証する内容:
 *   1. LlmPageTypeCorrector のレスポンスパーサが recommendedSchemas を解釈
 *   2. LLM 推奨が存在する場合、recommender が優先採用
 *   3. LLM 推奨がない場合、ルールベース推奨にフォールバック
 *   4. 既存スキーマと重複する推奨は除外される
 *   5. ルールベースに新タイプが追加されている
 *   6. 既存スキーマ情報が LLM 入力に渡される
 */

process.env.NODE_ENV = 'test';
const LlmPageTypeCorrector = require('../llm-page-type-corrector.js');
const PageTypeAnalyzer = require('../page-type-analyzer.js');
const StructuredDataRecommender = require('../structured-data-recommender.js');
const cheerio = require('cheerio');

function makeFakeFetch(content) {
  return async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  });
}

describe('Phase 2-D: LLM レスポンスパーサが recommendedSchemas を解釈', () => {
  test('完全な recommendedSchemas を含む正常レスポンス', async () => {
    const content = JSON.stringify({
      primaryType: 'Service',
      secondaryTypes: ['WebPage', 'Organization'],
      confidence: 0.92,
      reasoning: 'BtoB サービス LP',
      matchedSignals: ['広告掲載', '企業向け'],
      recommendedSchemas: {
        required: [
          { schema: 'Service', reason: 'サービス本体を表す' },
          { schema: 'WebPage', reason: 'ページ全体' },
        ],
        recommended: [
          { schema: 'Organization', reason: '運営企業情報' },
          { schema: 'BreadcrumbList', reason: 'ナビゲーション' },
          { schema: 'ContactPoint', reason: '問い合わせ' },
        ],
        optional: [
          { schema: 'VideoObject', reason: '動画があれば' },
        ],
      },
    });

    const c = new LlmPageTypeCorrector({
      apiKey: 'sk-test',
      fetchImpl: makeFakeFetch(content),
    });
    const result = await c.correct({ url: 'https://ads.mercari.com/', title: 'X' });

    expect(result.recommendedSchemas).toBeDefined();
    expect(result.recommendedSchemas.required).toHaveLength(2);
    expect(result.recommendedSchemas.required[0].schema).toBe('Service');
    expect(result.recommendedSchemas.required[0].reason).toContain('サービス本体');
    expect(result.recommendedSchemas.recommended).toHaveLength(3);
    expect(result.recommendedSchemas.optional).toHaveLength(1);
  });

  test('recommendedSchemas 欠落でもパース失敗しない (空配列で返る)', async () => {
    const content = JSON.stringify({
      primaryType: 'Article',
      secondaryTypes: [],
      confidence: 0.7,
      reasoning: '',
      matchedSignals: [],
      // recommendedSchemas 欠落
    });
    const c = new LlmPageTypeCorrector({ apiKey: 'sk-test', fetchImpl: makeFakeFetch(content) });
    const result = await c.correct({ url: 'https://x.com', title: 'T' });
    expect(result.recommendedSchemas).toEqual({
      required: [],
      recommended: [],
      optional: [],
    });
  });

  test('schema フィールド欠落のアイテムは除外される', async () => {
    const content = JSON.stringify({
      primaryType: 'Article',
      confidence: 0.7,
      recommendedSchemas: {
        required: [
          { schema: 'Article', reason: 'OK' },
          { reason: 'schema欠落' },  // 除外される
          { schema: '', reason: '空文字' }, // 除外される
        ],
        recommended: [],
        optional: [],
      },
    });
    const c = new LlmPageTypeCorrector({ apiKey: 'sk-test', fetchImpl: makeFakeFetch(content) });
    const result = await c.correct({ url: 'https://x.com', title: 'T' });
    expect(result.recommendedSchemas.required).toHaveLength(1);
    expect(result.recommendedSchemas.required[0].schema).toBe('Article');
  });

  test('reason 長すぎは切り詰め', async () => {
    const longReason = 'x'.repeat(500);
    const content = JSON.stringify({
      primaryType: 'Article',
      confidence: 0.7,
      recommendedSchemas: {
        required: [{ schema: 'Article', reason: longReason }],
        recommended: [],
        optional: [],
      },
    });
    const c = new LlmPageTypeCorrector({ apiKey: 'sk-test', fetchImpl: makeFakeFetch(content) });
    const result = await c.correct({ url: 'https://x.com', title: 'T' });
    expect(result.recommendedSchemas.required[0].reason.length).toBeLessThanOrEqual(300);
  });
});

describe('Phase 2-D: PageTypeAnalyzer 経由で recommendedSchemas が伝搬', () => {
  test('analyzePageAsync が recommendedSchemas を返す', async () => {
    const mockCorrector = {
      isEnabled: () => true,
      correct: async () => ({
        primaryType: 'WebPage',
        secondaryTypes: ['Service'],
        confidence: 0.9,
        reasoning: 'AI',
        matchedSignals: [],
        recommendedSchemas: {
          required: [{ schema: 'WebPage', reason: 'ページ全体' }],
          recommended: [{ schema: 'Organization', reason: '運営者' }],
          optional: [],
        },
        source: 'llm',
        model: 'gpt-4o-mini',
        latencyMs: 100,
      }),
    };
    const analyzer = new PageTypeAnalyzer({ llmCorrector: mockCorrector });
    const $ = cheerio.load('<html><body><h1>Test</h1></body></html>');
    const result = await analyzer.analyzePageAsync($, 'https://example.com/');
    expect(result.recommendedSchemas).toBeDefined();
    expect(result.recommendedSchemas.required[0].schema).toBe('WebPage');
  });

  test('existingSchemas オプションが LLM corrector に渡される', async () => {
    let capturedInput = null;
    const mockCorrector = {
      isEnabled: () => true,
      correct: async (input) => {
        capturedInput = input;
        return {
          primaryType: 'Article',
          secondaryTypes: [],
          confidence: 0.8,
          reasoning: '',
          matchedSignals: [],
          recommendedSchemas: { required: [], recommended: [], optional: [] },
          source: 'llm',
          model: 'gpt-4o-mini',
          latencyMs: 50,
        };
      },
    };
    const analyzer = new PageTypeAnalyzer({ llmCorrector: mockCorrector });
    const $ = cheerio.load('<html><body><h1>Test</h1></body></html>');
    await analyzer.analyzePageAsync($, 'https://example.com/', {
      existingSchemas: ['Organization', 'WebSite'],
    });
    expect(capturedInput.existingSchemas).toEqual(['Organization', 'WebSite']);
  });
});

describe('Phase 2-D: StructuredDataRecommender — LLM 推奨優先採用', () => {
  const recommender = new StructuredDataRecommender();

  test('LLM 推奨があれば優先採用、source: llm', () => {
    const pageAnalysis = {
      primaryType: 'WebPage',
      confidence: 0.9,
      recommendedSchemas: {
        required: [
          { schema: 'WebPage', reason: 'ページ全体' },
          { schema: 'Service', reason: 'サービス本体' },
        ],
        recommended: [
          { schema: 'Organization', reason: '運営' },
          { schema: 'BreadcrumbList', reason: 'ナビ' },
        ],
        optional: [
          { schema: 'VideoObject', reason: '動画' },
        ],
      },
    };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.source).toBe('llm');
    expect(result.recommendations.missing).toHaveLength(2);
    expect(result.recommendations.missing[0].schema).toBe('WebPage');
    expect(result.recommendations.missing[0].reason).toContain('ページ全体');
    expect(result.recommendations.missing[0].source).toBe('llm');
    expect(result.recommendations.improvements).toHaveLength(2);
    expect(result.recommendations.optional).toHaveLength(1);
  });

  test('LLM 推奨と既存スキーマが重複する場合、推奨から除外', () => {
    const pageAnalysis = {
      primaryType: 'WebPage',
      confidence: 0.9,
      recommendedSchemas: {
        required: [{ schema: 'WebPage', reason: '必要' }],
        recommended: [
          { schema: 'Organization', reason: '運営' },
          { schema: 'BreadcrumbList', reason: 'ナビ' },
        ],
        optional: [],
      },
    };
    // Organization が既に実装済み
    const existingSchemas = {
      jsonLd: [{ data: { '@type': 'Organization' } }],
    };
    const result = recommender.generateRecommendations(pageAnalysis, existingSchemas, {});
    expect(result.source).toBe('llm');
    // Organization は除外、BreadcrumbList だけ残る
    expect(result.recommendations.improvements).toHaveLength(1);
    expect(result.recommendations.improvements[0].schema).toBe('BreadcrumbList');
  });

  test('LLM 推奨がない (recommendedSchemas 欠落) → ルールベースにフォールバック', () => {
    const pageAnalysis = {
      primaryType: 'Article',
      confidence: 0.8,
      // recommendedSchemas は無し
    };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.source).toBe('rule-based');
    expect(result.recommendations.missing.length).toBeGreaterThan(0);
  });

  test('LLM 推奨が全部空配列 → ルールベースにフォールバック', () => {
    const pageAnalysis = {
      primaryType: 'Article',
      confidence: 0.8,
      recommendedSchemas: { required: [], recommended: [], optional: [] },
    };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.source).toBe('rule-based');
  });

  test('LLM 推奨の中で schema が重複していたら 1 件にユニーク化', () => {
    const pageAnalysis = {
      primaryType: 'WebPage',
      confidence: 0.9,
      recommendedSchemas: {
        required: [
          { schema: 'WebPage', reason: 'A' },
          { schema: 'WebPage', reason: 'B' },  // 重複
        ],
        recommended: [],
        optional: [],
      },
    };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.recommendations.missing).toHaveLength(1);
  });
});

describe('Phase 2-D: StructuredDataRecommender — ルールベース拡張 (新タイプ対応)', () => {
  const recommender = new StructuredDataRecommender();
  const NEW_TYPES = [
    'WebPage', 'Service', 'AboutPage', 'ContactPage', 'CollectionPage',
    'SoftwareApplication', 'Organization', 'Person', 'NewsArticle',
    'BlogPosting', 'VideoObject', 'FAQPage',
  ];

  test.each(NEW_TYPES)('新タイプ %s に対する推奨がフォールバックで Article にならない', (type) => {
    const pageAnalysis = {
      primaryType: type,
      confidence: 0.9,
      // recommendedSchemas は無し (ルールベースを使う)
    };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.source).toBe('rule-based');
    // missing の最初のスキーマが、そのタイプ自身または関連スキーマであること
    // (デフォルト Article ではないこと)
    const allSchemas = [
      ...result.recommendations.missing,
      ...result.recommendations.improvements,
      ...result.recommendations.optional,
    ].map(item => item.schema);
    // 主タイプそのものか、Article 以外の関連スキーマが含まれていること
    expect(allSchemas.length).toBeGreaterThan(0);
    // タイプ自身が missing (primary) に含まれていることが基本
    // ただし FAQPage は Question/Answer も含むためゆるく検証
    expect(allSchemas).toEqual(expect.arrayContaining([type]));
  });
});

describe('Phase 2-D: 後方互換性', () => {
  test('LLM 推奨なし & ルールベースのみで Article ページ → 既存挙動と同じ', () => {
    const recommender = new StructuredDataRecommender();
    const pageAnalysis = { primaryType: 'Article', confidence: 0.8 };
    const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
    expect(result.source).toBe('rule-based');
    expect(result.recommendations.missing[0].schema).toBe('Article');
  });

  test('OPENAI_API_KEY 未設定でも recommender は動作', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const recommender = new StructuredDataRecommender();
      const pageAnalysis = { primaryType: 'LocalBusiness', confidence: 0.9 };
      const result = recommender.generateRecommendations(pageAnalysis, { jsonLd: [] }, {});
      expect(result.source).toBe('rule-based');
      expect(result.recommendations.missing).toHaveLength(1);
      expect(result.recommendations.missing[0].schema).toBe('LocalBusiness');
    } finally {
      if (original !== undefined) process.env.OPENAI_API_KEY = original;
    }
  });
});
