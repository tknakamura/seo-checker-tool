/**
 * Phase 1.4: CommonJS / ESM 干渉の回帰防止テスト
 *
 * lighthouse v10+ は ESM-only のため CommonJS `require()` から
 * 取得しようとすると `ERR_REQUIRE_ESM` でモジュール全体のロードが失敗する。
 * Phase 1.4 で `index.js` から `const lighthouse = require('lighthouse')` を
 * 除去し、3本のテスト (integration / api / fullwidth-length) を再開できた。
 *
 * このテストはその回帰を構造的に防ぐ:
 *  - index.js に `require('lighthouse')` がコードに含まれていないこと
 *  - index.js が問題なく require できること
 *  - SEOChecker.checkSEO(html) が正常に動くこと
 */
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.resolve(__dirname, '..', 'index.js');

describe('Phase 1.4: CommonJS/ESM 干渉の回帰防止', () => {
  test('index.js は require("lighthouse") をコードとして含まない', () => {
    const src = fs.readFileSync(INDEX_PATH, 'utf-8');
    // コメント中の "require('lighthouse')" などは許容したいが、
    // 実コード `const X = require('lighthouse')` パターンを禁止
    const codeRequirePattern = /^\s*(?:const|let|var)\s+\w+\s*=\s*require\(['"]lighthouse['"]\)/m;
    expect(codeRequirePattern.test(src)).toBe(false);
  });

  test('index.js を require() してエラーが出ない', () => {
    process.env.NODE_ENV = 'test'; // サーバ起動を抑止
    expect(() => {
      jest.isolateModules(() => {
        require('../index.js');
      });
    }).not.toThrow();
  });

  test('SEOChecker.checkSEO(html) は ESMエラーなしで動作', async () => {
    process.env.NODE_ENV = 'test';
    const SEOChecker = require('../index.js');
    const checker = new SEOChecker();
    const html = '<!DOCTYPE html><html><head><title>テスト</title></head><body><h1>見出し</h1></body></html>';
    const result = await checker.checkSEO(null, html, false);
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('overallScore');
    expect(typeof result.overallScore).toBe('number');
  }, 15000);

  test('HTMLペースト時は llmsTxtCompliance が安全にスキップされる', async () => {
    process.env.NODE_ENV = 'test';
    const SEOChecker = require('../index.js');
    const checker = new SEOChecker();
    const html = '<!DOCTYPE html><html><head><title>テスト</title></head><body></body></html>';
    // url = null → llmsTxtCompliance は skipped
    const result = await checker.checkSEO(null, html, false);
    expect(result.aio).toBeDefined();
    expect(result.aio.checks.llmsTxtCompliance).toBeDefined();
    expect(result.aio.checks.llmsTxtCompliance.details?.skipped).toBe(true);
    expect(result.aio.checks.llmsTxtCompliance.score).toBe(0);
  }, 15000);
});
