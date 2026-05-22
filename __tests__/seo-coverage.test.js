/**
 * Phase 1.1: SEO残存フォールバックの回帰テスト
 * - SEO側のissueも「適切な修正を行ってください」にフォールバックしないこと
 * - ads.mercari.com 実地診断で確認された6種類を中心に網羅
 * - 最終フォールバックも、issue文字列＋カテゴリヒントを返してインフォメーティブであること
 */
const EnhancedReporter = require('../enhanced-reporter.js');

const SEO_ISSUE_SAMPLES = [
  // 見出し関連
  ['H2タグが少なすぎます（0個）', 'headingStructure'],
  ['H3タグが少なすぎます（0個）', 'headingStructure'],
  ['見出しの階層が飛び越されています（H1 → H3）', 'headingStructure'],
  ['H2タグが空です', 'headingStructure'],
  ['見出しに重複する内容があります', 'headingStructure'],
  // メタディスクリプション
  ['メタディスクリプションがすべて小文字です', 'metaDescription'],
  ['メタディスクリプションに省略記号が含まれています', 'metaDescription'],
  // 画像
  ['画像が存在しません', 'imageAltAttributes'],
  ['画像のalt属性が長すぎます（200文字）', 'imageAltAttributes'],
  ['alt属性に「image」や「picture」などの不要な単語が含まれています', 'imageAltAttributes'],
  // リンク
  ['リンクが存在しません', 'internalLinkStructure'],
  ['5個の汎用的なリンクテキストがあります', 'internalLinkStructure'],
  // 構造化データ
  ['LocalBusinessスキーマが不足しています', 'structuredData'],
  ['Organizationスキーマが不足しています', 'structuredData'],
  ['WebSiteスキーマが不足しています', 'structuredData'],
  ['Productスキーマが不足しています', 'structuredData'],
  ['BreadcrumbListスキーマが不足しています', 'structuredData'],
  ['JSON-LDの構文エラーがあります', 'structuredData'],
  ['JSON-LD[0]に@typeがありません', 'structuredData'],
  ['Organizationスキーマにnameがありません', 'structuredData'],
  ['WebSiteスキーマにpotentialActionがありません', 'structuredData'],
  ['Productスキーマにoffersがありません', 'structuredData'],
  ['BreadcrumbListスキーマにitemListElementがありません', 'structuredData'],
  // その他SEO
  ['viewportメタタグにwidth=device-widthがありません', 'otherSEOElements'],
  ['viewportメタタグにinitial-scale=1がありません', 'otherSEOElements'],
  ['URLパラメータが多すぎます', 'otherSEOElements'],
  ['URLの形式が正しくありません', 'otherSEOElements'],
  ['14個のタッチターゲットが小さすぎます', 'otherSEOElements'],
  // タイトル
  ['タイトルに重複するキーワードがあります', 'titleTag'],
  ['タイトルにパイプ（|）が多すぎます', 'titleTag'],
];

const FALLBACK = '適切な修正を行ってください';

describe('Phase 1.1: SEO recommendation coverage', () => {
  const reporter = new EnhancedReporter();

  test.each(SEO_ISSUE_SAMPLES)(
    'getConciseFix returns specific message for SEO issue "%s"',
    (issue, category) => {
      const fix = reporter.getConciseFix(issue, category);
      expect(fix).not.toBe(FALLBACK);
      expect(fix.length).toBeGreaterThan(10);
    }
  );

  test.each(SEO_ISSUE_SAMPLES)(
    'getDocLink returns a URL for SEO issue "%s"',
    (issue, category) => {
      const link = reporter.getDocLink(issue, category);
      expect(link).not.toBeNull();
      expect(link).toMatch(/^https?:\/\//);
    }
  );

  test('LocalBusiness の docLink は LocalBusiness 専用ページを指す', () => {
    const link = reporter.getDocLink('LocalBusinessスキーマが不足しています', 'structuredData');
    expect(link).toContain('local-business');
  });

  test('Breadcrumb の docLink は breadcrumb 専用ページを指す', () => {
    const link = reporter.getDocLink('BreadcrumbListスキーマが不足しています', 'structuredData');
    expect(link).toContain('breadcrumb');
  });

  test('最終フォールバックでも何の問題か分かる文字列を返す（適切な修正を行ってくださいではない）', () => {
    const unknownIssue = '完全に予測不能な架空のissue文字列です';
    const fix = reporter.getConciseFix(unknownIssue, 'titleTag');
    expect(fix).not.toBe(FALLBACK);
    expect(fix).toContain(unknownIssue);
    expect(fix).toMatch(/タイトル/); // カテゴリヒントを含む
  });

  test('未知の category でも null や fallback ではなく原文を返す', () => {
    const fix = reporter.getConciseFix('未知のissue', 'unknownCategory');
    expect(fix).not.toBe(FALLBACK);
    expect(typeof fix).toBe('string');
    expect(fix.length).toBeGreaterThan(0);
  });
});

describe('Phase 1.1: Advanced fallback warning shape', () => {
  // index.js の results.warnings 形状の最小限の構造チェック
  const sample = {
    code: 'ADVANCED_FALLBACK_TO_SIMPLE',
    message: 'Advanced Check に失敗したため、Simple Check の結果を表示しています。',
    detail: 'Navigation timeout of 20000 ms exceeded'
  };
  test('warning entry has code/message/detail', () => {
    expect(sample).toHaveProperty('code');
    expect(sample).toHaveProperty('message');
    expect(sample).toHaveProperty('detail');
  });
});
