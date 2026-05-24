/**
 * Phase 1.8: 不要タブ削除の回帰防止テスト
 *
 * 中村さんからのご要望: 「具体的な箇所」「詳細レポート」「Markdownレポート」タブを削除し、
 * シンプルな4タブ構成 (サマリー / SEO詳細 / AIO詳細 / 構造化データ) に集約。
 *
 * このテストで保証する内容:
 *   1. public/index.html に削除対象のタブボタンとコンテナが存在しない
 *   2. 削除した API エンドポイントが含まれていない (/api/report/seo, /api/report/detailed)
 *   3. 削除した JS メソッド (displaySpecificIssues / displayDetailedReport / generateReport
 *      / toggleIssueDetails) のコード本体が存在しない
 *   4. 内部ロジック (detailedAnalysis / detailedReport の生成) は維持
 *      (将来サマリーに統合する候補なので、データは残す)
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '..', 'public', 'index.html');
const INDEX_JS_PATH = path.resolve(__dirname, '..', 'index.js');

describe('Phase 1.8: 削除されたタブ UI が public/index.html から消えている', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf-8');

  test('タブボタン "具体的な箇所" "詳細レポート" "Markdownレポート" が存在しない', () => {
    expect(html).not.toMatch(/data-tab="specific"/);
    expect(html).not.toMatch(/data-tab="detailed"/);
    expect(html).not.toMatch(/data-tab="report"/);
    expect(html).not.toContain('>具体的な箇所<');
    expect(html).not.toContain('>詳細レポート<');
    expect(html).not.toContain('>Markdownレポート<');
  });

  test('タブコンテナ (specific / detailed / report) が存在しない', () => {
    expect(html).not.toMatch(/<div class="tab-content" id="specific">/);
    expect(html).not.toMatch(/<div class="tab-content" id="detailed">/);
    expect(html).not.toMatch(/<div class="tab-content" id="report">/);
  });

  test('JS メソッドの実装が存在しない', () => {
    // displaySpecificIssues / displayDetailedReport / generateReport の関数定義シグネチャ
    expect(html).not.toMatch(/displaySpecificIssues\(results\)\s*\{/);
    expect(html).not.toMatch(/displayDetailedReport\(results\)\s*\{/);
    // generateReport は async generateReport()
    expect(html).not.toMatch(/async generateReport\(\)\s*\{/);
    // グローバルヘルパー toggleIssueDetails
    expect(html).not.toMatch(/function toggleIssueDetails\(/);
  });

  test('this.displayResults から3メソッド呼び出しが消えている', () => {
    expect(html).not.toMatch(/this\.displaySpecificIssues\(/);
    expect(html).not.toMatch(/this\.displayDetailedReport\(/);
    expect(html).not.toMatch(/this\.generateReport\(\);/);
  });

  test('4タブが残っている: サマリー / SEO詳細 / AIO詳細 / 構造化データ', () => {
    expect(html).toMatch(/data-tab="summary"/);
    expect(html).toMatch(/data-tab="details"/);
    expect(html).toMatch(/data-tab="aio"/);
    expect(html).toMatch(/data-tab="structured-data"/);
  });
});

describe('Phase 1.8: 削除された API エンドポイントが index.js から消えている', () => {
  const src = fs.readFileSync(INDEX_JS_PATH, 'utf-8');

  test('app.post("/api/report/seo", ...) が存在しない', () => {
    expect(src).not.toMatch(/app\.post\(\s*['"]\/api\/report\/seo['"]/);
  });

  test('app.post("/api/report/detailed", ...) が存在しない', () => {
    expect(src).not.toMatch(/app\.post\(\s*['"]\/api\/report\/detailed['"]/);
  });

  test('既存エンドポイント (/api/check/seo, /api/compare, /api/version) は残っている', () => {
    expect(src).toMatch(/app\.post\(\s*['"]\/api\/check\/seo['"]/);
    expect(src).toMatch(/app\.post\(\s*['"]\/api\/compare['"]/);
    expect(src).toMatch(/app\.get\(\s*['"]\/api\/version['"]/);
  });
});

describe('Phase 1.8: 内部ロジック (detailedAnalysis / detailedReport の生成) は維持', () => {
  // 将来サマリーに統合する候補なので、データ生成自体は残す
  const src = fs.readFileSync(INDEX_JS_PATH, 'utf-8');

  test('results.detailedAnalysis の生成が残っている', () => {
    // Phase 2-C: await が前置されたため正規表現を緩和
    expect(src).toMatch(/results\.detailedAnalysis\s*=\s*(?:await\s+)?this\.detailedAnalyzer\.analyzeDetails/);
  });

  test('results.detailedReport の生成が残っている', () => {
    expect(src).toMatch(/results\.detailedReport\s*=\s*this\.enhancedReporter\.generateDetailedReport/);
  });

  test('checker.generateReport() メソッド本体は残っている (Markdownレポート生成ロジック)', () => {
    // バックエンドのロジックは保持。将来外部連携などで再利用可能にする。
    expect(src).toMatch(/generateReport\(results\)\s*\{/);
  });
});
