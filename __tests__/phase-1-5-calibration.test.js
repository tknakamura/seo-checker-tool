/**
 * Phase 1.5: 区分線形スコアリングと判定基準キャリブレーションのテスト
 *
 * 中村さんからの指摘: 「メタディスクリプション 87文字 が 50点になるのはおかしい」
 *
 * このテストで保証する内容:
 *   1. 区分線形ヘルパー (piecewiseLinearScore) が滑らかに動作
 *   2. 87文字のような業界的に許容範囲のメタディスクリプションが 100 点近く取れる
 *   3. 旧 0/50/100 の3段階ではなく、連続的にスコアが変化する
 *   4. コンテンツ長に応じた動的 H2/H3/内部リンク閾値
 *   5. enhanced-reporter / detailed-analyzer も新しい閾値を反映
 */

process.env.NODE_ENV = 'test'; // サーバ起動を抑止
const SEOChecker = require('../index.js');

describe('Phase 1.5: piecewiseLinearScore ヘルパー', () => {
  const c = new SEOChecker();

  test('value <= 最小ポイント → 最初の score', () => {
    expect(c.piecewiseLinearScore(0, [{x:10, score:30}, {x:100, score:100}])).toBe(30);
    expect(c.piecewiseLinearScore(-5, [{x:10, score:30}, {x:100, score:100}])).toBe(30);
  });

  test('value >= 最大ポイント → 最後の score', () => {
    expect(c.piecewiseLinearScore(1000, [{x:10, score:30}, {x:100, score:100}])).toBe(100);
  });

  test('中間値は線形補間', () => {
    // 10→30、100→100 の間で 55 は (55-10)/(100-10) = 0.5 → 30 + (100-30)*0.5 = 65
    expect(c.piecewiseLinearScore(55, [{x:10, score:30}, {x:100, score:100}])).toBe(65);
  });

  test('複数の区分点を辿る', () => {
    const points = [
      { x: 0, score: 0 },
      { x: 50, score: 100 },
      { x: 100, score: 100 },
      { x: 200, score: 0 },
    ];
    expect(c.piecewiseLinearScore(0, points)).toBe(0);
    expect(c.piecewiseLinearScore(25, points)).toBe(50);
    expect(c.piecewiseLinearScore(50, points)).toBe(100);
    expect(c.piecewiseLinearScore(100, points)).toBe(100);
    expect(c.piecewiseLinearScore(150, points)).toBe(50);
    expect(c.piecewiseLinearScore(200, points)).toBe(0);
  });

  test('points が不正な場合は 0', () => {
    expect(c.piecewiseLinearScore(50, null)).toBe(0);
    expect(c.piecewiseLinearScore(50, [])).toBe(0);
    expect(c.piecewiseLinearScore(50, [{x:1, score:50}])).toBe(0);
    expect(c.piecewiseLinearScore(NaN, [{x:0,score:0},{x:100,score:100}])).toBe(0);
  });
});

describe('Phase 1.5: タイトルスコア (区分線形)', () => {
  const c = new SEOChecker();
  function score(len) { return c.calculateTitleScore('x'.repeat(len), len); }

  test('0文字 → 0点', () => expect(c.calculateTitleScore('', 0)).toBe(0));
  test('5文字 → 30点 (極端に短い)', () => expect(score(5)).toBe(30));
  test('15文字 → 70点 (許容ライン)', () => expect(score(15)).toBe(70));
  test('20文字 → 90点 (やや短いが許容)', () => expect(score(20)).toBe(90));
  test('25文字 → 100点 (理想)', () => expect(score(25)).toBe(100));
  test('32文字 → 100点 (理想、Google切り捨て直前)', () => expect(score(32)).toBe(100));
  test('40文字 → 85点 (やや長い)', () => expect(score(40)).toBe(85));
  test('50文字 → 65点 (長すぎ)', () => expect(score(50)).toBe(65));
  test('80文字 → 50点 (明らかに長すぎ)', () => expect(score(80)).toBe(50));
  test('200文字 → 50点 (どんなに長くても下限 50)', () => expect(score(200)).toBe(50));
});

describe('Phase 1.5: メタディスクリプションスコア (区分線形)', () => {
  const c = new SEOChecker();
  function score(len) { return c.calculateDescriptionScore('x'.repeat(len), len); }

  test('0文字 → 0点', () => expect(c.calculateDescriptionScore('', 0)).toBe(0));
  test('20文字 → 30点 (極端に短い)', () => expect(score(20)).toBe(30));
  test('50文字 → 60点 (SP表示でかろうじて)', () => expect(score(50)).toBe(60));
  test('70文字 → 85点 (SP表示でしっかり)', () => expect(score(70)).toBe(85));
  test('80文字 → 100点 (理想開始)', () => expect(score(80)).toBe(100));

  // 中村さんご指摘の問題ケース
  test('87文字 (CareNet.com) → 100点 (旧50点からの修正、これが本質)', () => {
    expect(score(87)).toBe(100);
  });

  test('120文字 → 100点 (理想終了)', () => expect(score(120)).toBe(100));
  test('140文字 → 92点 (やや長い、PC表示でほぼ全部見える)', () => expect(score(140)).toBe(92));
  test('160文字 → 78点 (長い)', () => expect(score(160)).toBe(78));
  test('200文字 → 60点 (長すぎ)', () => expect(score(200)).toBe(60));
  test('300文字 → 50点 (明らかに長すぎ、下限)', () => expect(score(300)).toBe(50));
});

describe('Phase 1.5: 0/50/100 の3段階から脱却している', () => {
  const c = new SEOChecker();

  test('メタディスクリプションが多様なスコアを取りうる', () => {
    const scores = new Set();
    for (let len = 0; len <= 300; len += 10) {
      scores.add(c.calculateDescriptionScore('x'.repeat(len), len));
    }
    // 旧仕様は { 0, 50, 100 } の3種類だけだったが、新仕様は多様
    expect(scores.size).toBeGreaterThan(10);
  });

  test('タイトルも多様なスコアを取りうる', () => {
    const scores = new Set();
    for (let len = 0; len <= 100; len += 5) {
      scores.add(c.calculateTitleScore('x'.repeat(len), len));
    }
    expect(scores.size).toBeGreaterThan(8);
  });
});

describe('Phase 1.5: コンテンツ長に応じた動的閾値', () => {
  const c = new SEOChecker();

  test('短いページ (300語) では H2 1個でも満点近く取れる', () => {
    const hierarchy = { issues: [] };
    const content = { issues: [] };
    const score = c.calculateHeadingScore(1, 1, 0, hierarchy, content, 300);
    // H1=1 (35) + H2=1/1 (25) + H3=0/0 (15 満点) + 階層 (15) + 内容 (10) = 100
    expect(score).toBe(100);
  });

  test('長いページ (3000語) では H2 1個だと減点', () => {
    const hierarchy = { issues: [] };
    const content = { issues: [] };
    // H2 needed=3, H2 actual=1 → 25 * 1/3 ≈ 8
    // H3 needed=5, H3 actual=0 → 15 * 0/5 = 0
    // H1 (35) + H2 (8) + H3 (0) + 階層 (15) + 内容 (10) = 68
    const score = c.calculateHeadingScore(1, 1, 0, hierarchy, content, 3000);
    expect(score).toBeLessThan(80);
    expect(score).toBeGreaterThan(60);
  });

  test('長いページで H2 3個 H3 5個揃えば満点', () => {
    const hierarchy = { issues: [] };
    const content = { issues: [] };
    const score = c.calculateHeadingScore(1, 3, 5, hierarchy, content, 3000);
    expect(score).toBe(100);
  });

  test('H1 が0個だと大幅減点', () => {
    const hierarchy = { issues: [] };
    const content = { issues: [] };
    const score = c.calculateHeadingScore(0, 5, 10, hierarchy, content, 3000);
    // H1=0 → 0 + H2 (25) + H3 (15) + 階層 (15) + 内容 (10) = 65
    expect(score).toBe(65);
  });

  test('H1 が複数だと中程度減点', () => {
    const hierarchy = { issues: [] };
    const content = { issues: [] };
    const score = c.calculateHeadingScore(3, 5, 10, hierarchy, content, 3000);
    // H1=複数 → 15 + H2 (25) + H3 (15) + 階層 (15) + 内容 (10) = 80
    expect(score).toBe(80);
  });
});

describe('Phase 1.5: リンクスコア (コンテンツ長動的)', () => {
  const c = new SEOChecker();

  test('短いページ (300語) で 内部リンク3個・外部1個・総計5個 → 高スコア', () => {
    // internalNeeded=3, internalRatio=1 → 40
    // externalLinks 1 → 20
    // totalLinks 5 → 10
    // 合計 70
    const score = c.calculateLinkScore(5, 3, 1, 300);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  test('長いページ (3000語) で 内部リンク3個 (necessary 12)→ 内部スコア低い', () => {
    // internalNeeded=12, ratio=3/12=0.25 → 10
    // external 0 → 0
    // total 3 → 0
    // 合計 10
    const score = c.calculateLinkScore(3, 3, 0, 3000);
    expect(score).toBeLessThan(30);
  });

  test('リンク0個 → 0点', () => {
    expect(c.calculateLinkScore(0, 0, 0, 1000)).toBe(0);
  });

  test('豊富なリンク (内部15+外部5+総計20) で満点近く', () => {
    const score = c.calculateLinkScore(20, 15, 5, 3000);
    expect(score).toBeGreaterThanOrEqual(95);
  });
});

describe('Phase 1.5: 画像 alt スコア', () => {
  const c = new SEOChecker();

  test('画像なし → 50 (中立)', () => {
    expect(c.calculateImageAltScore(0, 0)).toBe(50);
  });
  test('10/10 alt付与 → 100', () => {
    expect(c.calculateImageAltScore(10, 10)).toBe(100);
  });
  test('5/10 alt付与 → 50', () => {
    expect(c.calculateImageAltScore(10, 5)).toBe(50);
  });
  test('0/10 alt付与 → 0', () => {
    expect(c.calculateImageAltScore(10, 0)).toBe(0);
  });
});

describe('Phase 1.5: estimateContentLength', () => {
  const cheerio = require('cheerio');
  const c = new SEOChecker();

  test('英語の語数を数える', () => {
    const $ = cheerio.load('<html><body><p>The quick brown fox jumps over the lazy dog.</p></body></html>');
    const len = c.estimateContentLength($);
    expect(len).toBe(9);
  });

  test('日本語は2文字=1語相当', () => {
    const $ = cheerio.load('<html><body><p>これはテストです</p></body></html>'); // 8文字 → 4語
    const len = c.estimateContentLength($);
    expect(len).toBe(4);
  });

  test('script/style/nav 等は除外', () => {
    const $ = cheerio.load('<html><body><script>var x="hello world this is noise";</script><p>main content here</p></body></html>');
    const len = c.estimateContentLength($);
    expect(len).toBe(3); // 'main content here'
  });

  test('空のページは 0', () => {
    const $ = cheerio.load('<html><body></body></html>');
    expect(c.estimateContentLength($)).toBe(0);
  });
});

describe('Phase 1.5: enhanced-reporter の文言が新閾値を参照', () => {
  const EnhancedReporter = require('../enhanced-reporter.js');
  const reporter = new EnhancedReporter();

  test('タイトル短すぎの fix に新閾値が含まれる', () => {
    const fix = reporter.getConciseFix('タイトルが短すぎます（10全角文字）', 'titleTag');
    // 新閾値 32 を含むか、旧 30 を含まないか
    expect(fix).toContain('32');
    expect(fix).not.toMatch(/30全角/);
  });

  test('メタディスクリプション長すぎの fix に新閾値が含まれる', () => {
    const fix = reporter.getConciseFix('メタディスクリプションが長すぎます（150全角文字）', 'metaDescription');
    expect(fix).toContain('120');
    // 旧 '80全角文字以下' という単純メッセージではない
    expect(fix.length).toBeGreaterThan(20);
  });
});
