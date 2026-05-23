/**
 * Phase 2-A: llms.txt 対応チェッカーのテスト
 * 単体テスト（HTTPフェッチはモック）+ enhanced-reporter 統合テスト
 */
const LlmsTxtChecker = require('../llms-txt-checker');
const EnhancedReporter = require('../enhanced-reporter.js');

describe('Phase 2-A: LlmsTxtChecker — パース機能', () => {
  const checker = new LlmsTxtChecker();

  test('完全に有効な llms.txt をパースできる', () => {
    const text = [
      '# My Site',
      '',
      '> このサイトは〇〇に関する情報を提供します。',
      '',
      '## Docs',
      '',
      '- [Getting Started](/docs/start): 入門ガイド',
      '- [API Reference](/docs/api): API仕様',
      '',
      '## Examples',
      '',
      '- [Sample 1](/examples/1)',
    ].join('\n');
    const parsed = checker._parse(text);
    expect(parsed.title).toBe('My Site');
    expect(parsed.summary).toContain('〇〇に関する情報');
    expect(parsed.sections).toHaveLength(2);
    expect(parsed.sections[0].name).toBe('Docs');
    expect(parsed.sections[0].items).toHaveLength(2);
    expect(parsed.sections[0].items[0]).toMatchObject({
      text: 'Getting Started',
      url: '/docs/start',
      description: '入門ガイド'
    });
    // descriptionなしのリンクも許容
    expect(parsed.sections[1].items[0].description).toBeNull();
    expect(parsed.hasMultipleH1).toBe(false);
  });

  test('H1 が複数ある場合に hasMultipleH1=true', () => {
    const text = '# Title 1\n\n# Title 2\n\n## Section\n\n- [link](/)';
    const parsed = checker._parse(text);
    expect(parsed.hasMultipleH1).toBe(true);
  });

  test('H1 がない llms.txt は title=null', () => {
    const text = '## Section\n\n- [link](/)';
    const parsed = checker._parse(text);
    expect(parsed.title).toBeNull();
  });

  test('summary 無しの llms.txt は summary=null', () => {
    const text = '# Title\n\n## Section\n\n- [link](/)';
    const parsed = checker._parse(text);
    expect(parsed.summary).toBeNull();
  });
});

describe('Phase 2-A: LlmsTxtChecker — robots.txt 解析', () => {
  const checker = new LlmsTxtChecker();

  test('Disallow: / で AIクローラーが完全ブロックを検出', () => {
    const robots = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Allow: /',
    ].join('\n');
    const status = checker._analyzeRobotsTxt(robots);
    expect(status.GPTBot).toBe('disallowed');
    // 他のAIエージェントはwildcardに従う
    expect(status.ClaudeBot).toBe('allowed');
  });

  test('限定パス拒否 (Disallow: /api/) は allowed 判定', () => {
    // 健全な運用パターン
    const robots = 'User-agent: *\nDisallow: /api/';
    const status = checker._analyzeRobotsTxt(robots);
    expect(status.GPTBot).toBe('allowed');
    expect(status.ClaudeBot).toBe('allowed');
  });

  test('AIエージェント未指定の robots.txt は unspecified', () => {
    const robots = '';
    const status = checker._analyzeRobotsTxt(robots);
    expect(status.GPTBot).toBe('unspecified');
  });

  test('User-agent: * のみで Disallow: / は全AIをdisallowed', () => {
    const robots = 'User-agent: *\nDisallow: /';
    const status = checker._analyzeRobotsTxt(robots);
    expect(status.GPTBot).toBe('disallowed');
    expect(status.PerplexityBot).toBe('disallowed');
  });
});

describe('Phase 2-A: LlmsTxtChecker — _evaluate スコア計算', () => {
  const checker = new LlmsTxtChecker();

  test('llms.txt が見つからない場合は低スコア + critical 推奨', () => {
    const result = {
      origin: 'https://example.com',
      found: false,
      foundFullVersion: false,
      parsed: null,
      robotsTxt: { found: false, aiCrawlers: {}, warnings: [] },
      issues: [],
      recommendations: [],
    };
    checker._evaluate(result);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.issues).toContain('llms.txt が見つかりません');
    expect(result.recommendations[0].type).toBe('critical');
  });

  test('完全に揃った llms.txt + llms-full + AI許可 で 高スコア', () => {
    const result = {
      origin: 'https://example.com',
      found: true,
      foundFullVersion: true,
      parsed: {
        title: 'Site',
        summary: 'About this site',
        hasMultipleH1: false,
        sections: [
          { name: 'Docs', items: [{ text: 'a', url: '/a' }] }
        ],
      },
      robotsTxt: {
        found: true,
        aiCrawlers: { GPTBot: 'allowed', ClaudeBot: 'allowed', PerplexityBot: 'allowed' },
        warnings: []
      },
      issues: [],
      recommendations: [],
    };
    checker._evaluate(result);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  test('llms.txt あるがサマリー無し → サマリー issue が出る', () => {
    const result = {
      origin: 'https://example.com',
      found: true,
      foundFullVersion: false,
      parsed: {
        title: 'Site',
        summary: null,
        hasMultipleH1: false,
        sections: [{ name: 'X', items: [{ text: 'a', url: '/a' }] }],
      },
      robotsTxt: { found: false, aiCrawlers: {} },
      issues: [],
      recommendations: [],
    };
    checker._evaluate(result);
    expect(result.issues.some(i => i.includes('サマリー'))).toBe(true);
  });

  test('AIクローラー disallowed が検出されると high 推奨', () => {
    const result = {
      origin: 'https://example.com',
      found: true,
      foundFullVersion: false,
      parsed: { title: 'X', summary: 'y', hasMultipleH1: false, sections: [{ name: 'a', items: [{ text: 'b', url: '/' }] }] },
      robotsTxt: {
        found: true,
        aiCrawlers: { GPTBot: 'disallowed', ClaudeBot: 'allowed' },
        warnings: []
      },
      issues: [],
      recommendations: [],
    };
    checker._evaluate(result);
    expect(result.issues.some(i => i.includes('AIクローラー'))).toBe(true);
    expect(result.recommendations.some(r => r.title.includes('AIクローラー'))).toBe(true);
  });
});

describe('Phase 2-A: enhanced-reporter 統合', () => {
  const reporter = new EnhancedReporter();
  const FALLBACK = '適切な修正を行ってください';

  const llmsIssues = [
    ['llms.txt が見つかりません', 'llmsTxtCompliance', 'llmstxt_missing'],
    ['llms.txt にH1タイトル（# Title）がありません', 'llmsTxtCompliance', 'llmstxt_no_title'],
    ['llms.txt にH1（#）が複数あります', 'llmsTxtCompliance', 'llmstxt_multiple_h1'],
    ['llms.txt にサマリー（> blockquote）がありません', 'llmsTxtCompliance', 'llmstxt_no_summary'],
    ['llms.txt に H2 セクション（## ...）がありません', 'llmsTxtCompliance', 'llmstxt_no_section'],
    ['H2 セクションは存在しますが、リンクが1つも含まれていません', 'llmsTxtCompliance', 'llmstxt_no_links'],
    ['AIクローラーが robots.txt でブロック/制限されています: GPTBot', 'llmsTxtCompliance', 'llmstxt_robots_block_ai'],
  ];

  test.each(llmsIssues)('getIssueKey returns %s → %s', (issue, cat, expected) => {
    expect(reporter.getIssueKey(issue, cat)).toBe(expected);
  });

  test.each(llmsIssues)('getConciseFix returns specific message for "%s"', (issue, cat) => {
    const fix = reporter.getConciseFix(issue, cat);
    expect(fix).not.toBe(FALLBACK);
    expect(fix.length).toBeGreaterThan(10);
  });

  test.each(llmsIssues)('getDocLink returns a URL for "%s"', (issue, cat) => {
    const link = reporter.getDocLink(issue, cat);
    expect(link).not.toBeNull();
    expect(link).toMatch(/^https?:\/\//);
  });

  test('llms.txt の docLink は llmstxt.org か gptbot を指す（タイトル先食い回避）', () => {
    // 'llms.txt にH1タイトル...' は issue文に「タイトル」を含むが
    // Phase 1.1 と同じ「先食い問題」を回避し、llmstxt.org にフォールバックする
    const link = reporter.getDocLink('llms.txt にH1タイトル（# Title）がありません', 'llmsTxtCompliance');
    expect(link).toContain('llmstxt.org');
  });

  test('getElementName / getLocationName が llmsTxtCompliance を認識', () => {
    expect(reporter.getElementName('llmsTxtCompliance')).toContain('llms.txt');
    expect(reporter.getLocationName('llmsTxtCompliance')).toContain('llms.txt');
  });

  test('既存AIO/SEO issue が regression していない', () => {
    // 過去PRで対応したkeyマッピングを抜粋
    const existing = [
      ['H2タグが少なすぎます（0個）', 'headingStructure'],
      ['LocalBusinessスキーマが不足しています', 'structuredData'],
      ['AI検索に重要なスキーマが不足しています: FAQPage, HowTo', 'structuredInformation'],
      ['FAQ形式のコンテンツがありません', 'aiSearchOptimization'],
      ['著者情報がありません', 'credibilitySignals'],
    ];
    for (const [issue, cat] of existing) {
      const fix = reporter.getConciseFix(issue, cat);
      expect(fix).not.toBe(FALLBACK);
      const link = reporter.getDocLink(issue, cat);
      expect(link).not.toBeNull();
    }
  });
});

describe('Phase 2-A: AIO スコア重み付け', () => {
  // calculateAIOOverallScore に llmsTxtCompliance が反映されること
  test('llmsTxtCompliance: 0 で AIO スコアが下がる', () => {
    const AIOChecker = require('../aio-checker');
    const aio = new AIOChecker();

    const allHigh = {
      contentComprehensiveness: { score: 100, issues: [], recommendations: [] },
      structuredInformation:    { score: 100, issues: [], recommendations: [] },
      credibilitySignals:       { score: 100, issues: [], recommendations: [] },
      aiSearchOptimization:     { score: 100, issues: [], recommendations: [] },
      naturalLanguageQuality:   { score: 100, issues: [], recommendations: [] },
      contextRelevance:         { score: 100, issues: [], recommendations: [] },
      llmsTxtCompliance:        { score: 0,   issues: [], recommendations: [] },
    };
    const score = aio.calculateAIOOverallScore(allHigh);
    // 85% を満点で、残り15%が0なので、85前後になるはず
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(90);
  });

  test('llmsTxtCompliance: 100 で AIO スコアがフル', () => {
    const AIOChecker = require('../aio-checker');
    const aio = new AIOChecker();

    const allHigh = {
      contentComprehensiveness: { score: 100, issues: [], recommendations: [] },
      structuredInformation:    { score: 100, issues: [], recommendations: [] },
      credibilitySignals:       { score: 100, issues: [], recommendations: [] },
      aiSearchOptimization:     { score: 100, issues: [], recommendations: [] },
      naturalLanguageQuality:   { score: 100, issues: [], recommendations: [] },
      contextRelevance:         { score: 100, issues: [], recommendations: [] },
      llmsTxtCompliance:        { score: 100, issues: [], recommendations: [] },
    };
    const score = aio.calculateAIOOverallScore(allHigh);
    expect(score).toBeGreaterThanOrEqual(99);
  });
});
