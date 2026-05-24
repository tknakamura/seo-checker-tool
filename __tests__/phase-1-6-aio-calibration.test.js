/**
 * Phase 1.6: AIO スコア関数の区分線形化テスト
 *
 * Phase 1.5 で SEO 側を区分線形化したのに対し、AIO 側 6カテゴリも同様に対応。
 * 旧仕様は「閾値を1超えた瞬間に大幅加点」「未達なら0点」の不連続性があった。
 * 新仕様は piecewise linear で滑らかに 0-100 を評価する。
 */

process.env.NODE_ENV = 'test';
const AIOChecker = require('../aio-checker.js');

describe('Phase 1.6: piecewiseLinearScore ヘルパー (aio-checker.js)', () => {
  const aio = new AIOChecker();

  test('SEOChecker と同一仕様で線形補間する', () => {
    expect(aio.piecewiseLinearScore(50, [{x:0,score:0}, {x:100,score:100}])).toBe(50);
  });

  test('value <= 最小ポイントは最初の score', () => {
    expect(aio.piecewiseLinearScore(-5, [{x:0,score:10}, {x:100,score:100}])).toBe(10);
  });

  test('value >= 最大ポイントは最後の score', () => {
    expect(aio.piecewiseLinearScore(1000, [{x:0,score:10}, {x:100,score:100}])).toBe(100);
  });

  test('points が不正な場合は 0', () => {
    expect(aio.piecewiseLinearScore(50, null)).toBe(0);
    expect(aio.piecewiseLinearScore(50, [])).toBe(0);
    expect(aio.piecewiseLinearScore(50, [{x:0,score:0}])).toBe(0);
    expect(aio.piecewiseLinearScore(NaN, [{x:0,score:0},{x:100,score:100}])).toBe(0);
  });
});

describe('Phase 1.6: calculateComprehensivenessScore (区分線形)', () => {
  const aio = new AIOChecker();
  const s = (w,p,l,r) => aio.calculateComprehensivenessScore(w,p,l,r);

  test('全部0 → 0点', () => {
    expect(s(0, 0, 0, 0)).toBe(0);
  });

  test('短すぎ (50語) でも 0 点ではなく段階的に評価', () => {
    expect(s(50, 1, 0, 30)).toBeGreaterThan(0);
    expect(s(50, 1, 0, 30)).toBeLessThan(30);
  });

  test('理想範囲 (1500語, 5段落, 2リスト, ratio=300) → 95点以上', () => {
    expect(s(1500, 5, 2, 300)).toBeGreaterThanOrEqual(95);
  });

  test('完璧 (2000語, 5段落, 3リスト, ratio=350) → 100点', () => {
    expect(s(2000, 5, 3, 350)).toBe(100);
  });

  test('長すぎ (5000語) でも完全には0にならない', () => {
    const score = s(5000, 5, 3, 1000);
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThan(85);
  });

  test('多様な入力で多様なスコアを返す (0/50/100の3段階から脱却)', () => {
    const scores = new Set();
    for (let w = 0; w <= 5000; w += 200) {
      for (let p = 0; p <= 7; p++) {
        for (let r = 0; r <= 800; r += 200) {
          scores.add(s(w, p, 1, r));
        }
      }
    }
    expect(scores.size).toBeGreaterThan(20);
  });
});

describe('Phase 1.6: calculateStructuredInfoScore (区分線形)', () => {
  const aio = new AIOChecker();
  const s = (jl, faq, def) => aio.calculateStructuredInfoScore({ jsonLd: Array(jl).fill('x') }, faq, def);

  test('全部0 → 0点', () => expect(s(0, 0, 0)).toBe(0));
  test('JSON-LD 1個 → 28点 (旧40)', () => expect(s(1, 0, 0)).toBe(28));
  test('JSON-LD 3個 → 40点', () => expect(s(3, 0, 0)).toBe(40));
  test('完璧 (3 JSON-LD + 5 FAQ + 5 定義リスト) → 100点', () => expect(s(3, 5, 5)).toBe(100));
  test('部分的な対応 (1 JSON-LD + 1 FAQ + 0 def) → 46点', () => expect(s(1, 1, 0)).toBe(46));
});

describe('Phase 1.6: calculateCredibilityScore (区分線形)', () => {
  const aio = new AIOChecker();
  const s = (au, dt, cit, ha, co) => aio.calculateCredibilityScore(au, dt, cit, ha, co);

  test('全部0 → 0点', () => expect(s(0, 0, 0, 0, 0)).toBe(0));
  test('著者だけ → 20点', () => expect(s(1, 0, 0, 0, 0)).toBe(20));
  test('全項目1個ずつ (旧仕様で100点) → 引用とリンクは段階評価で10点ずつ', () => {
    // author=20 + date=20 + cit=10 + ha=10 + contact=20 = 80
    expect(s(1, 1, 1, 1, 1)).toBe(80);
  });
  test('完璧 (引用5+権威リンク5+他全部) → 100点', () => expect(s(1, 1, 5, 5, 1)).toBe(100));
  test('多様なスコア', () => {
    const scores = new Set();
    for (let c = 0; c <= 10; c++) {
      for (let h = 0; h <= 10; h++) {
        scores.add(s(1, 1, c, h, 1));
      }
    }
    expect(scores.size).toBeGreaterThan(5);
  });
});

describe('Phase 1.6: calculateAISearchScore (区分線形)', () => {
  const aio = new AIOChecker();
  const s = (q, comp, st, n) => aio.calculateAISearchScore(q, comp, st, n);

  test('全部0/false → 0点', () => expect(s(0, false, 0, 0)).toBe(0));
  test('1個ずつ (旧仕様で100点) → 段階評価で65点', () => {
    // q=15 + comp=25 + step=15 + num=10 = 65
    expect(s(1, true, 1, 1)).toBe(65);
  });
  test('完璧 → 100点', () => expect(s(5, true, 5, 5)).toBe(100));
  test('hasComparison は boolean なので連続値にならないが他は連続', () => {
    expect(s(0, true, 0, 0)).toBe(25);  // comparison のみ
    expect(s(2, true, 2, 2)).toBeGreaterThan(50);
  });
});

describe('Phase 1.6: calculateNaturalLanguageScore (区分線形ペナルティ)', () => {
  const aio = new AIOChecker();
  const s = (len, term, pass, conj) => aio.calculateNaturalLanguageScore(len, term, pass, conj);

  test('理想 (短文, 用語少, 受動少, 接続詞多) → 100点', () => {
    expect(s(20, 0, 0, 5)).toBe(100);
  });

  test('閾値ちょうど (旧50字超で-20, 旧10用語超で-20...) よりは緩やか', () => {
    // 旧: len=51, term=11, pass=6, conj=2 → 100 - 80 = 20
    // 新: 段階的なので 50字付近・10用語付近・5受動付近は減点小さい
    const score = s(50, 10, 5, 3);
    expect(score).toBeGreaterThan(45);
    expect(score).toBeLessThan(75);
  });

  test('全項目で問題ありでも 0 にはなりにくい', () => {
    const score = s(60, 12, 6, 2);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  test('極端に悪い → 0点', () => {
    expect(s(100, 30, 15, 0)).toBe(0);
  });
});

describe('Phase 1.6: calculateContextRelevanceScore (区分線形)', () => {
  const aio = new AIOChecker();
  const s = (url, rl, cat) => aio.calculateContextRelevanceScore(url, rl, cat);

  test('全部0 → 0点', () => expect(s(0, 0, 0)).toBe(0));
  test('URL関連性が中間 (0.3) → 部分加点 (20点付近)', () => {
    expect(s(0.3, 0, 0)).toBeGreaterThanOrEqual(15);
    expect(s(0.3, 0, 0)).toBeLessThanOrEqual(25);
  });
  test('URL関連性0.7 → 40点 (最大)', () => {
    expect(s(0.7, 0, 0)).toBe(40);
  });
  test('完璧 → 100点', () => expect(s(0.7, 5, 3)).toBe(100));
  test('カテゴリ1個 → 20点 (旧30点から段階化)', () => {
    expect(s(0, 0, 1)).toBe(20);
  });
});

describe('Phase 1.6: 全AIOカテゴリで多様なスコアが出る', () => {
  // 旧仕様は各カテゴリで「閾値到達でドンと20-40点加点」の階段関数だった。
  // 新仕様では多様な値が出ることを保証する。
  const aio = new AIOChecker();

  test('Comprehensiveness で15種類以上のスコアが出る', () => {
    const scores = new Set();
    for (let w = 0; w <= 5000; w += 100) {
      scores.add(aio.calculateComprehensivenessScore(w, 3, 1, 200));
    }
    expect(scores.size).toBeGreaterThan(15);
  });

  test('AISearch で10種類以上のスコアが出る', () => {
    const scores = new Set();
    for (let q = 0; q <= 10; q++) {
      for (let n = 0; n <= 10; n++) {
        scores.add(aio.calculateAISearchScore(q, true, q, n));
      }
    }
    expect(scores.size).toBeGreaterThan(10);
  });

  test('NaturalLanguage で15種類以上のスコアが出る', () => {
    const scores = new Set();
    for (let l = 0; l <= 100; l += 10) {
      for (let t = 0; t <= 30; t += 5) {
        scores.add(aio.calculateNaturalLanguageScore(l, t, 3, 4));
      }
    }
    expect(scores.size).toBeGreaterThan(15);
  });
});

describe('Phase 1.6: 既存挙動の regression テスト', () => {
  const aio = new AIOChecker();
  const cheerio = require('cheerio');

  // checkAIO は内部で seoResults.checks.structuredData.jsonLd を参照するため、
  // テスト用の最小限の seoResults を用意
  const minimalSeoResults = {
    checks: {
      structuredData: {
        jsonLd: [],
        microdata: [],
        rdfa: [],
        issues: [],
        recommendations: [],
        score: 0
      }
    }
  };

  test('checkAIO が依然として6+1カテゴリを返す', async () => {
    const $ = cheerio.load('<html><body><h1>Test</h1><p>Some content</p></body></html>');
    const results = await aio.checkAIO(minimalSeoResults, '', $);
    expect(results.checks).toHaveProperty('contentComprehensiveness');
    expect(results.checks).toHaveProperty('structuredInformation');
    expect(results.checks).toHaveProperty('credibilitySignals');
    expect(results.checks).toHaveProperty('aiSearchOptimization');
    expect(results.checks).toHaveProperty('naturalLanguageQuality');
    expect(results.checks).toHaveProperty('contextRelevance');
    expect(results.checks).toHaveProperty('llmsTxtCompliance');
  });

  test('AIO overallScore が 0-100 の整数', async () => {
    const $ = cheerio.load('<html><body><h1>Test</h1></body></html>');
    const results = await aio.checkAIO(minimalSeoResults, '', $);
    expect(results.overallScore).toBeGreaterThanOrEqual(0);
    expect(results.overallScore).toBeLessThanOrEqual(100);
    expect(Number.isInteger(results.overallScore)).toBe(true);
  });

  test('各カテゴリの score も 0-100 の整数', async () => {
    const $ = cheerio.load('<html><body><h1>Test</h1><p>Content</p></body></html>');
    const results = await aio.checkAIO(minimalSeoResults, '', $);
    for (const [key, check] of Object.entries(results.checks)) {
      expect(typeof check.score).toBe('number');
      expect(check.score).toBeGreaterThanOrEqual(0);
      expect(check.score).toBeLessThanOrEqual(100);
    }
  });
});
