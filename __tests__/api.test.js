/**
 * API エンドポイントのテスト
 * サーバーは起動しないため、バリデーションとレスポンス形式をモックで検証
 */
const SEOChecker = require('../index.js');

describe('API validation and response shape', () => {
  test('SEOChecker is a constructor', () => {
    expect(typeof SEOChecker).toBe('function');
    const checker = new SEOChecker();
    expect(checker).toBeInstanceOf(SEOChecker);
  });

  test('calculateFullWidthLength is a function', () => {
    const checker = new SEOChecker();
    expect(typeof checker.calculateFullWidthLength).toBe('function');
  });

  test('checkSEO returns a Promise', () => {
    const checker = new SEOChecker();
    const html = '<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>';
    const p = checker.checkSEO(null, html, false);
    expect(p).toBeInstanceOf(Promise);
    return p.then((results) => {
      expect(results).toHaveProperty('checks');
      expect(results.checks).toHaveProperty('titleTag');
      expect(results.checks.titleTag).toHaveProperty('score');
      expect(results).toHaveProperty('overallScore');
    });
  });

  test('generateReport returns a string', () => {
    const checker = new SEOChecker();
    const html = '<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>';
    return checker.checkSEO(null, html, false).then((results) => {
      const report = checker.generateReport(results);
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });
  });
});
