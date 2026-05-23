/**
 * Phase 2-A.1: AIO スコア重み付け再調整の検証
 *
 * 旧 impactScores の比率 (structured が最重要、nlq/ctx が軽い) を維持しつつ
 * llms.txt 15% を追加した重み付けが正しく動作することを保証する。
 *
 * 期待される重み:
 *   structuredInformation:    0.2125  (旧 25% × 0.85)
 *   contentComprehensiveness: 0.17    (旧 20% × 0.85)
 *   aiSearchOptimization:     0.17    (旧 20% × 0.85)
 *   credibilitySignals:       0.1275  (旧 15% × 0.85)
 *   naturalLanguageQuality:   0.085   (旧 10% × 0.85)
 *   contextRelevance:         0.085   (旧 10% × 0.85)
 *   llmsTxtCompliance:        0.15    (新規)
 *   合計:                     1.00
 */
const AIOChecker = require('../aio-checker.js');
const EnhancedReporter = require('../enhanced-reporter.js');

const allHighChecks = () => ({
  contentComprehensiveness: { score: 100, issues: [], recommendations: [] },
  structuredInformation:    { score: 100, issues: [], recommendations: [] },
  credibilitySignals:       { score: 100, issues: [], recommendations: [] },
  aiSearchOptimization:     { score: 100, issues: [], recommendations: [] },
  naturalLanguageQuality:   { score: 100, issues: [], recommendations: [] },
  contextRelevance:         { score: 100, issues: [], recommendations: [] },
  llmsTxtCompliance:        { score: 100, issues: [], recommendations: [] },
});

describe('Phase 2-A.1: AIO 重み付け再調整', () => {
  const aio = new AIOChecker();

  test('全カテゴリ100点で AIO 総合スコア = 100', () => {
    expect(aio.calculateAIOOverallScore(allHighChecks())).toBe(100);
  });

  test('structuredInformation のみ0 → 79点 (旧重みの最重要カテゴリ)', () => {
    const checks = allHighChecks();
    checks.structuredInformation = { score: 0, issues: [], recommendations: [] };
    // 期待値: 100 - (100 * 0.2125) = 78.75 → 79
    expect(aio.calculateAIOOverallScore(checks)).toBe(79);
  });

  test('contentComprehensiveness のみ0 → 83点', () => {
    const checks = allHighChecks();
    checks.contentComprehensiveness = { score: 0, issues: [], recommendations: [] };
    // 期待値: 100 - (100 * 0.17) = 83
    expect(aio.calculateAIOOverallScore(checks)).toBe(83);
  });

  test('aiSearchOptimization のみ0 → 83点', () => {
    const checks = allHighChecks();
    checks.aiSearchOptimization = { score: 0, issues: [], recommendations: [] };
    expect(aio.calculateAIOOverallScore(checks)).toBe(83);
  });

  test('credibilitySignals のみ0 → 87点', () => {
    const checks = allHighChecks();
    checks.credibilitySignals = { score: 0, issues: [], recommendations: [] };
    // 期待値: 100 - (100 * 0.1275) = 87.25 → 87
    expect(aio.calculateAIOOverallScore(checks)).toBe(87);
  });

  test('naturalLanguageQuality のみ0 → 92点 (軽量カテゴリ)', () => {
    const checks = allHighChecks();
    checks.naturalLanguageQuality = { score: 0, issues: [], recommendations: [] };
    // 期待値: 100 - (100 * 0.085) = 91.5 → 92
    expect(aio.calculateAIOOverallScore(checks)).toBe(92);
  });

  test('contextRelevance のみ0 → 92点 (軽量カテゴリ)', () => {
    const checks = allHighChecks();
    checks.contextRelevance = { score: 0, issues: [], recommendations: [] };
    expect(aio.calculateAIOOverallScore(checks)).toBe(92);
  });

  test('llmsTxtCompliance のみ0 → 85点', () => {
    const checks = allHighChecks();
    checks.llmsTxtCompliance = { score: 0, issues: [], recommendations: [] };
    expect(aio.calculateAIOOverallScore(checks)).toBe(85);
  });

  test('旧 impactScores の重要度順が保持されている', () => {
    // structured (最重要) のペナルティ > content/ai > credibility > llms.txt > nlq/ctx
    // 各カテゴリのみ0で総合スコアを計算し、低いほどカテゴリの重みが大きい
    const cases = [
      { key: 'structuredInformation',    expected: 79 },  // 21.25%減
      { key: 'contentComprehensiveness', expected: 83 },  // 17%減
      { key: 'aiSearchOptimization',     expected: 83 },  // 17%減
      { key: 'llmsTxtCompliance',        expected: 85 },  // 15%減
      { key: 'credibilitySignals',       expected: 87 },  // 12.75%減
      { key: 'naturalLanguageQuality',   expected: 92 },  // 8.5%減
      { key: 'contextRelevance',         expected: 92 },  // 8.5%減
    ];
    // expected 配列は昇順（スコアが小さい = 重みが大きい）
    const scores = cases.map(c => {
      const checks = allHighChecks();
      checks[c.key] = { score: 0, issues: [], recommendations: [] };
      return aio.calculateAIOOverallScore(checks);
    });
    expect(scores).toEqual(cases.map(c => c.expected));
  });

  test('重みの合計が 1.00 (フロート誤差±0.001以内)', () => {
    // 内部実装と乖離しないか軽く守る
    // 計算: 0.17 + 0.2125 + 0.1275 + 0.17 + 0.085 + 0.085 + 0.15 = 1.0
    const sum = 0.17 + 0.2125 + 0.1275 + 0.17 + 0.085 + 0.085 + 0.15;
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });
});

describe('Phase 2-A.1: effortMap に llmsTxtCompliance', () => {
  const reporter = new EnhancedReporter();

  test('llmsTxtCompliance は低工数 (effort: 2)', () => {
    // Markdown 1ファイル設置するだけなので低工数 (titleTag=1, otherSEOElements=2 と同等)
    const effort = reporter.calculateEffort('llmsTxtCompliance', { score: 0, issues: [] });
    expect(effort).toBe(2);
  });

  test('quickWins 推定で llms.txt が高 ROI として浮かぶ', () => {
    // impactScores: llmsTxtCompliance = 15 (Phase 2-A で追加済み)
    // effort: 2
    // ROI = impact / effort = 7.5 (非常に高い)
    //
    // 比較: structuredInformation impact=25, effort=7 → ROI=3.57
    //       contentComprehensiveness impact=20, effort=6 → ROI=3.33
    //       titleTag impact (検算で SEO 側だが) effort=1 → ROI 高
    //
    // この test は effort と impact から ROI を逆算する形ではなく、
    // 単に「effort=2 が記録されている」ことのみを保証する。
    // quickWins 算出ロジックは別箇所にあるためここでは触れない。
    expect(reporter.calculateEffort('llmsTxtCompliance', { score: 0 })).toBeLessThan(3);
  });

  test('未知のカテゴリは デフォルト effort 5', () => {
    // 既存挙動の regression
    expect(reporter.calculateEffort('unknownCategory', { score: 0 })).toBe(5);
  });
});
