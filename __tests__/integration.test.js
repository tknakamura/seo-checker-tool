/**
 * 統合テスト: HTML を渡してチェック結果の構造を検証
 */
const SEOChecker = require('../index.js');

describe('SEO check integration', () => {
  let checker;

  beforeAll(() => {
    checker = new SEOChecker();
  });

  const minimalHTML = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <title>テストページ｜サンプルサイト</title>
  <meta name="description" content="これはテスト用のメタディスクリプションです。">
</head>
<body>
  <h1>見出し1</h1>
  <p>本文</p>
</body>
</html>
  `.trim();

  test('checkSEO with HTML returns expected check keys', async () => {
    const results = await checker.checkSEO(null, minimalHTML, false);
    const expectedKeys = [
      'titleTag',
      'metaDescription',
      'headingStructure',
      'imageAltAttributes',
      'internalLinkStructure',
      'structuredData',
      'otherSEOElements',
    ];
    expectedKeys.forEach((key) => {
      expect(results.checks).toHaveProperty(key);
      expect(results.checks[key]).toHaveProperty('score');
    });
    expect(typeof results.overallScore).toBe('number');
  });

  test('titleTag has current and length for Japanese', async () => {
    const results = await checker.checkSEO(null, minimalHTML, false);
    expect(results.checks.titleTag.current).toContain('テスト');
    expect(typeof results.checks.titleTag.length).toBe('number');
  });
});
