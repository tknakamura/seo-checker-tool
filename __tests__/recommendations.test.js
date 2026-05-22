/**
 * Phase 1: 推奨アクション具体化の回帰テスト
 * - AIO 25種のissueすべてが「適切な修正を行ってください」にフォールバックしないこと
 * - docLink がカバレッジ抜けしていないこと
 * - codeExample の有無に関わらず、固有メッセージが返ること
 */
const EnhancedReporter = require('../enhanced-reporter.js');

const AIO_ISSUE_SAMPLES = [
  // contentComprehensiveness
  ['コンテンツが短すぎます（120語）', 'contentComprehensiveness'],
  ['コンテンツが長すぎる可能性があります（3500語）', 'contentComprehensiveness'],
  ['段落が少なすぎます', 'contentComprehensiveness'],
  ['リスト形式のコンテンツがありません', 'contentComprehensiveness'],
  ['見出しに対してコンテンツが少なすぎます', 'contentComprehensiveness'],
  // structuredInformation
  ['JSON-LD構造化データがありません', 'structuredInformation'],
  ['AI検索に重要なスキーマが不足しています: FAQPage, HowTo', 'structuredInformation'],
  ['FAQ形式のコンテンツがありません', 'structuredInformation'],
  ['定義リストがありません', 'structuredInformation'],
  // credibilitySignals
  ['著者情報がありません', 'credibilitySignals'],
  ['日付情報がありません', 'credibilitySignals'],
  ['引用や参考文献がありません', 'credibilitySignals'],
  ['権威のある外部サイトへのリンクがありません', 'credibilitySignals'],
  ['連絡先情報がありません', 'credibilitySignals'],
  // aiSearchOptimization
  ['質問形式のコンテンツがありません', 'aiSearchOptimization'],
  ['比較・対比のコンテンツがありません', 'aiSearchOptimization'],
  ['手順・ステップ形式のコンテンツがありません', 'aiSearchOptimization'],
  ['具体的な数値データが少なすぎます', 'aiSearchOptimization'],
  // naturalLanguageQuality
  ['文章が長すぎます', 'naturalLanguageQuality'],
  ['専門用語が多すぎます', 'naturalLanguageQuality'],
  ['受動態が多すぎます', 'naturalLanguageQuality'],
  ['接続詞が少なすぎます', 'naturalLanguageQuality'],
  // contextRelevance
  ['URLとコンテンツの関連性が低いです', 'contextRelevance'],
  ['内部リンクの関連性が低いです', 'contextRelevance'],
  ['カテゴリやタグがありません', 'contextRelevance'],
];

const FALLBACK = '適切な修正を行ってください';

describe('Phase 1: AIO recommendation coverage', () => {
  const reporter = new EnhancedReporter();

  test.each(AIO_ISSUE_SAMPLES)(
    'getConciseFix returns specific message for "%s"',
    (issue, category) => {
      const fix = reporter.getConciseFix(issue, category);
      expect(fix).not.toBe(FALLBACK);
      expect(typeof fix).toBe('string');
      expect(fix.length).toBeGreaterThan(10);
    }
  );

  test.each(AIO_ISSUE_SAMPLES)(
    'getDocLink returns a URL (no coverage gap) for "%s"',
    (issue, category) => {
      const link = reporter.getDocLink(issue, category);
      expect(link).not.toBeNull();
      expect(link).toMatch(/^https?:\/\//);
    }
  );

  test.each(AIO_ISSUE_SAMPLES)(
    'getIssueKey returns a stable key (not the raw issue string) for "%s"',
    (issue, category) => {
      const key = reporter.getIssueKey(issue, category);
      // フォールバック（issue文字列そのまま）にならず、aio_* プレフィックスが付くこと
      expect(key).toMatch(/^aio_/);
    }
  );

  test('generateConciseRecommendations propagates codeExample and docLink', () => {
    const fakeResults = {
      checks: {},
      aio: {
        checks: {
          aiSearchOptimization: {
            issues: ['FAQ形式のコンテンツがありません'],
            score: 30,
          },
        },
      },
    };
    const recs = reporter.generateConciseRecommendations(fakeResults);
    expect(recs.length).toBe(1);
    expect(recs[0].codeExample).toContain('FAQPage');
    expect(recs[0].docLink).toContain('faqpage');
    expect(recs[0].fix).not.toBe(FALLBACK);
  });

  test('description should not be polluted with (N件) suffix (count-info handles it)', () => {
    const fakeResults = {
      checks: {},
      aio: {
        checks: {
          credibilitySignals: {
            issues: ['著者情報がありません', '著者情報がありません'],
            score: 20,
          },
        },
      },
    };
    const recs = reporter.generateConciseRecommendations(fakeResults);
    expect(recs.length).toBe(1);
    expect(recs[0].count).toBe(2);
    expect(recs[0].issue).not.toMatch(/\(\d+件\)/);
  });
});
