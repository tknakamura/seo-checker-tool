/**
 * Phase 2-I: タブ構成再編 (案 C-1 + D-1 + X) のテスト
 *
 * 中村さん指摘:
 *   - サマリーが進化したのに対し SEO詳細・AIO詳細タブが Phase 1 のまま陳腐化
 *   - 「同じ情報の劣化版」が並んでいる
 *
 * 修正:
 *   - 4 タブ → 3 タブに整理 (SEO詳細・AIO詳細を「詳細データ」に統合)
 *   - サマリーは Critical + High のみ抜粋
 *   - 詳細データは全 SEO + AIO カテゴリ + 全推奨アクション + 全該当箇所一覧
 *
 * このテストで保証する内容:
 *   1. 3 タブ構成 (サマリー / 詳細データ / 構造化データ)
 *   2. 詳細データタブ用の表示メソッド displayDetailedData が存在する
 *   3. サマリー側のフィルタリング (priority === 'critical' || priority === 'high')
 *   4. 旧 displayDetails / displayAIO メソッド本体が削除されている
 *   5. 旧 aio タブのコンテナ <div id="aio"> が削除されている
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.resolve(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

describe('Phase 2-I: タブ構成 (3タブ)', () => {
  test('サマリー / 詳細データ / 構造化データ の 3 タブのみ', () => {
    expect(html).toMatch(/data-tab="summary"/);
    expect(html).toMatch(/data-tab="details"/);
    expect(html).toMatch(/data-tab="structured-data"/);
    // 旧 AIO タブは削除
    expect(html).not.toMatch(/data-tab="aio"/);
  });

  test('タブラベルが「詳細データ」', () => {
    expect(html).toContain('>詳細データ<');
  });

  test('旧 SEO詳細 / AIO詳細 ラベルが存在しない', () => {
    expect(html).not.toContain('>SEO詳細<');
    expect(html).not.toContain('>AIO詳細<');
  });

  test('タブコンテナ <div id="aio"> が削除されている', () => {
    expect(html).not.toMatch(/<div class="tab-content" id="aio">/);
  });

  test('タブコンテナ <div id="details">, <div id="summary">, <div id="structured-data"> は残っている', () => {
    expect(html).toMatch(/<div class="tab-content[^"]*" id="summary">/);
    expect(html).toMatch(/<div class="tab-content[^"]*" id="details">/);
    expect(html).toMatch(/<div class="tab-content[^"]*" id="structured-data">/);
  });
});

describe('Phase 2-I: 旧メソッド削除 & 新メソッド追加', () => {
  test('displayDetails(results) メソッド本体が存在しない', () => {
    // 旧定義シグネチャを検出 (新しい displayDetailedData はマッチしない)
    expect(html).not.toMatch(/^\s*displayDetails\(results\)\s*\{/m);
  });

  test('displayAIO(results) メソッド本体が存在しない', () => {
    expect(html).not.toMatch(/^\s*displayAIO\(results\)\s*\{/m);
  });

  test('displayDetailedData(results) メソッドが定義されている', () => {
    expect(html).toMatch(/displayDetailedData\(results\)\s*\{/);
  });

  test('this.displayDetailedData(results) が displayResults で呼ばれている', () => {
    expect(html).toMatch(/this\.displayDetailedData\(results\)/);
  });

  test('旧 this.displayDetails(results), this.displayAIO(results) 呼び出しが消えている', () => {
    expect(html).not.toMatch(/this\.displayDetails\(results\)/);
    expect(html).not.toMatch(/this\.displayAIO\(results\)/);
  });
});

describe('Phase 2-I: サマリーフィルタリング', () => {
  test('Critical + High のみ表示するフィルタコードが存在', () => {
    // topRecs フィルタロジック (priority === 'critical' || priority === 'high')
    expect(html).toMatch(/r\.priority === 'critical' \|\| r\.priority === 'high'/);
  });

  test('「今すぐ対応すべき推奨アクション」見出しがある', () => {
    expect(html).toContain('今すぐ対応すべき推奨アクション');
  });

  test('「詳細データタブで確認できます」リンクのテキストがある', () => {
    expect(html).toContain('詳細データタブ');
  });

  test('「すべての項目が良好です」または「Critical / High 優先度の問題はありません」表示がある', () => {
    expect(html).toMatch(/Critical \/ High 優先度の問題はありません|すべての項目が良好です/);
  });
});

describe('Phase 2-I: 詳細データタブのヘルパー', () => {
  test('_renderDetailsCategory メソッドが定義されている', () => {
    expect(html).toMatch(/_renderDetailsCategory\(catKey, catName, check, recs, results\)/);
  });

  test('_collectAllLocations メソッドが定義されている', () => {
    expect(html).toMatch(/_collectAllLocations\(catKey, check, results\)/);
  });

  test('priority chip 表示用クラス (prio-chip critical/high/medium/low) が CSS に定義', () => {
    expect(html).toContain('.prio-chip.critical');
    expect(html).toContain('.prio-chip.high');
    expect(html).toContain('.prio-chip.medium');
    expect(html).toContain('.prio-chip.low');
  });
});

describe('Phase 2-I.1: SEO / AIO セクション冒頭のスコア表示 (両セクション統一)', () => {
  test('SEO セクションに「SEO総合スコア」ラベルが表示される', () => {
    expect(html).toContain('SEO総合スコア');
  });

  test('AIO セクションに「AIO総合スコア」ラベルが表示される', () => {
    expect(html).toContain('AIO総合スコア');
  });

  test('renderSectionScore ヘルパーが SEO/AIO 両方で使われる', () => {
    expect(html).toMatch(/renderSectionScore\('SEO総合スコア'/);
    expect(html).toMatch(/renderSectionScore\('AIO総合スコア'/);
  });

  test('details-section-score CSS クラスが定義されている', () => {
    expect(html).toContain('.details-section-score');
    expect(html).toContain('.details-section-score-num');
    expect(html).toContain('.details-section-score-label');
  });

  test('スコアごとの色クラス (good/medium/high/critical) も定義', () => {
    expect(html).toContain('.details-section-score.good');
    expect(html).toContain('.details-section-score.medium');
    expect(html).toContain('.details-section-score.high');
    expect(html).toContain('.details-section-score.critical');
  });
});
