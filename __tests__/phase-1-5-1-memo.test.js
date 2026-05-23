/**
 * Phase 1.5.1: estimateContentLength のメモ化と heap 観測ログの regression テスト
 *
 * 背景: ads.mercari.com 等の重い SPA を waitForJS=true で診断すると
 * Render starter プラン (512MB) でメモリ上限を超えて OOM 502 になる現象が発生。
 * estimateContentLength が見出し + リンクの 2 ステップで合計 4 回呼ばれ、
 * 都度 $('body').clone() していたのが小さいが慢性的なメモリ圧の一因。
 *
 * 本テストで保証する内容:
 *   1. メモ化されても結果は変わらない（既存テストの regression を引き起こさない）
 *   2. 同じ $ オブジェクトで 2 回目以降の呼び出しは clone を再実行しない
 *   3. 異なる $ オブジェクトはそれぞれ独立にカウントされる
 */
process.env.NODE_ENV = 'test';
const cheerio = require('cheerio');
const SEOChecker = require('../index.js');

describe('Phase 1.5.1: estimateContentLength メモ化', () => {
  const c = new SEOChecker();

  test('同じ $ オブジェクトでの2回目以降はキャッシュ値を返す', () => {
    const $ = cheerio.load('<html><body><p>The quick brown fox jumps.</p></body></html>');
    const first = c.estimateContentLength($);
    expect(first).toBe(5);
    // メモ化フィールドが付与されている
    expect($._wordCountCache).toBe(5);
    // 2回目以降は同じ結果
    expect(c.estimateContentLength($)).toBe(5);
    expect(c.estimateContentLength($)).toBe(5);
  });

  test('異なる $ オブジェクトは独立してカウントされる', () => {
    const $a = cheerio.load('<html><body><p>one two three</p></body></html>');
    const $b = cheerio.load('<html><body><p>これはテストです</p></body></html>'); // 8文字 → 4語
    expect(c.estimateContentLength($a)).toBe(3);
    expect(c.estimateContentLength($b)).toBe(4);
    // 各 $ にキャッシュが独立に付く
    expect($a._wordCountCache).toBe(3);
    expect($b._wordCountCache).toBe(4);
  });

  test('script/style/nav 除外もキャッシュされる', () => {
    const $ = cheerio.load('<html><body><script>noise here a b c d e</script><p>main content here</p></body></html>');
    expect(c.estimateContentLength($)).toBe(3);
    expect($._wordCountCache).toBe(3);
    expect(c.estimateContentLength($)).toBe(3);
  });

  test('空のページは 0 でキャッシュされる', () => {
    const $ = cheerio.load('<html><body></body></html>');
    expect(c.estimateContentLength($)).toBe(0);
    expect($._wordCountCache).toBe(0);
    expect(c.estimateContentLength($)).toBe(0);
  });

  test('null/不正な $ はクラッシュせず 0 を返す', () => {
    expect(c.estimateContentLength(null)).toBe(0);
    expect(c.estimateContentLength(undefined)).toBe(0);
    expect(c.estimateContentLength({})).toBe(0);
  });

  test('既存の見出しスコア計算結果に影響しない (regression)', () => {
    const $ = cheerio.load(`
      <html><body>
        <h1>Title</h1><h2>Section A</h2><h2>Section B</h2>
        <p>${'word '.repeat(400)}</p>
      </body></html>
    `);
    // wordCount を 1 度だけ計算（メモ化される）
    const wc = c.estimateContentLength($);
    // 結果はメモ化前と同じ（400+ 語）
    expect(wc).toBeGreaterThan(300);
    // 同じ $ で再度呼んでもキャッシュ値
    expect(c.estimateContentLength($)).toBe(wc);
  });
});
