/**
 * 全角文字数カウント機能のJestテスト
 */
const SEOChecker = require('../index.js');

describe('calculateFullWidthLength', () => {
  let seoChecker;

  beforeAll(() => {
    seoChecker = new SEOChecker();
  });

  test('全角ひらがな', () => {
    expect(seoChecker.calculateFullWidthLength('こんにちは')).toBe(5);
  });

  test('全角カタカナ', () => {
    expect(seoChecker.calculateFullWidthLength('サンプル')).toBe(4);
  });

  test('半角英字は0.5文字換算', () => {
    expect(seoChecker.calculateFullWidthLength('Hello')).toBe(2.5);
  });

  test('空文字列は0', () => {
    expect(seoChecker.calculateFullWidthLength('')).toBe(0);
  });

  test('nullは0', () => {
    expect(seoChecker.calculateFullWidthLength(null)).toBe(0);
  });

  test('全角・半角混在', () => {
    // 'SEO対策' = 半角3(0.5×3=1.5) + 全角2(1.0×2=2.0) = 3.5全角文字
    const result = seoChecker.calculateFullWidthLength('SEO対策');
    expect(Math.abs(result - 3.5) < 0.1).toBe(true);
  });
});
