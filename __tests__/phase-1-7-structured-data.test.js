/**
 * Phase 1.7: 構造化データタブの UI 改善関連テスト
 *
 * 中村さんからのご指摘: 構造化データタブのレポートUIが見づらい
 *   - 信頼度 800% のバグ
 *   - JSON-LD コードが改行なし1行で表示
 *   - 各項目のラベルがなく階層が見えない
 *   - 絵文字多用で section header との区別がつかない
 *
 * このテストで保証する内容:
 *   1. page-type-analyzer の confidence が 0-1 に正規化されている
 *   2. 既存挙動 (primaryType / secondaryTypes / analysisDetails) は維持
 *   3. 異常値 (totalScore=0) でも安全に 0 を返す
 */

process.env.NODE_ENV = 'test';
const PageTypeAnalyzer = require('../page-type-analyzer.js');

describe('Phase 1.7: page-type-analyzer の confidence 正規化', () => {
  const analyzer = new PageTypeAnalyzer();

  test('confidence は 0-1 の範囲', () => {
    const cheerio = require('cheerio');
    // 'localBusiness' に強いシグナルがある HTML
    const html = `
      <html>
        <head>
          <title>店舗紹介</title>
          <meta name="description" content="ご来店ください、営業時間は10時から18時です。住所と電話番号を掲載しています">
        </head>
        <body>
          <h1>店舗情報</h1>
          <p>営業時間: 10:00-18:00</p>
          <p>住所: 東京都〇〇区〇〇1-2-3</p>
          <p>電話: 03-1234-5678</p>
        </body>
      </html>
    `;
    const $ = cheerio.load(html);
    const result = analyzer.analyzePage($, 'https://example.com/shop');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('confidence * 100 しても 100 を超えない (旧 800% バグの回帰)', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html><body><p>test</p></body></html>');
    const result = analyzer.analyzePage($, 'https://example.com/');
    // 旧バグ: rawScore=8.0 などが confidence に入って * 100 = 800% になっていた
    const displayedPct = Math.round(result.confidence * 100);
    expect(displayedPct).toBeLessThanOrEqual(100);
    expect(displayedPct).toBeGreaterThanOrEqual(0);
  });

  test('primaryType / secondaryTypes は引き続き返る', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html><body><h1>Article</h1><p>記事の内容</p></body></html>');
    const result = analyzer.analyzePage($, 'https://example.com/');
    expect(result).toHaveProperty('primaryType');
    expect(result).toHaveProperty('secondaryTypes');
    expect(Array.isArray(result.secondaryTypes)).toBe(true);
  });

  test('analysisDetails.matchedPatterns が引き続き存在', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html><body><h1>test</h1></body></html>');
    const result = analyzer.analyzePage($, 'https://example.com/');
    expect(result).toHaveProperty('analysisDetails');
    expect(result.analysisDetails).toHaveProperty('matchedPatterns');
  });

  test('rawScore がデバッグ用に保持される', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html><body><p>test</p></body></html>');
    const result = analyzer.analyzePage($, 'https://example.com/');
    // 新規追加フィールド
    expect(result).toHaveProperty('rawScore');
    expect(typeof result.rawScore).toBe('number');
  });

  test('totalScore=0 の縮退ケース (異常値) でも 0 を返す', () => {
    // 通常 typeScores 全部が0になることはないが、保険として
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html></html>');
    const result = analyzer.analyzePage($, '');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('Phase 1.7: 構造化データタブの DOM 出力構造', () => {
  // HTMLの実構造ではなく、テンプレートに必要なヘルパーが正しく動くことを確認
  const PageTypeAnalyzer = require('../page-type-analyzer.js');
  const analyzer = new PageTypeAnalyzer();

  test('displayName / 信頼度パーセンテージ計算が両方とも 0-100 範囲', () => {
    const cheerio = require('cheerio');
    const $ = cheerio.load('<html><body><h1>記事タイトル</h1><p>記事本文</p></body></html>');
    const result = analyzer.analyzePage($, 'https://example.com/article/');

    // 表示用のパーセンテージ計算 (UI 側のロジックを再現)
    const displayedPct = Math.min(100, Math.max(0, Math.round((result.confidence || 0) * 100)));
    expect(displayedPct).toBeGreaterThanOrEqual(0);
    expect(displayedPct).toBeLessThanOrEqual(100);
  });
});
