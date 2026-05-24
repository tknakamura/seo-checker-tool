/**
 * Phase 2-G: 該当箇所単位での個別 AI 書き換え提案テスト
 *
 * 中村さん要望「AI 書き換え時に該当箇所を1件ずつ渡して個別最適化」への対応。
 *
 * Phase 2-E: カテゴリ単位 (11個のリンクテキストをまとめて一般論的に3案)
 * Phase 2-G: 該当箇所単位 (1個の URL から推測した具体的な3案)
 *
 * このテストで保証する内容:
 *   1. specificLocation を渡せること
 *   2. specificLocation がプロンプトに反映されること (link/image でメッセージが変わる)
 *   3. specificLocation の有無で別キャッシュになること
 *   4. 別の href/src は別キャッシュになること
 *   5. specificLocation のサニタイズ (サイズ制限、ロールキーワード中和)
 *   6. 後方互換性 (specificLocation 省略時は従来通り動作)
 */
process.env.NODE_ENV = 'test';
const LlmContentRewriter = require('../llm-content-rewriter.js');

function makeFakeFetch(responseJson, options = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (options.delay) await new Promise(r => setTimeout(r, options.delay));
    if (options.throwError) throw new Error(options.throwError);
    return {
      ok: options.ok !== false,
      status: options.status || 200,
      json: async () => responseJson,
      text: async () => typeof responseJson === 'string' ? responseJson : JSON.stringify(responseJson),
    };
  };
  fn.calls = calls;
  return fn;
}

const successResponse = {
  choices: [{
    message: {
      content: JSON.stringify({
        suggestions: [
          { text: '案1', reason: '理由1' },
          { text: '案2', reason: '理由2' },
          { text: '案3', reason: '理由3' },
        ]
      })
    }
  }]
};

describe('Phase 2-G: specificLocation を渡せる', () => {
  test('linkText + specificLocation で OK', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const result = await r.rewrite({
      target: 'linkText',
      currentValue: '',
      pageContext: { url: 'https://example.com', title: 'メルカリ広告' },
      specificLocation: {
        type: 'link',
        href: '/?keiro=com_logo',
        position: 1,
        currentText: '',
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(3);
  });

  test('altText + specificLocation で OK', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const result = await r.rewrite({
      target: 'altText',
      currentValue: '',
      pageContext: { url: 'https://example.com' },
      specificLocation: {
        type: 'image',
        src: 'https://example.com/img/upload/636annsp.jpg',
        position: 17,
        currentText: '',
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(3);
  });
});

describe('Phase 2-G: specificLocation がプロンプトに反映される', () => {
  test('link の場合に「リンク先 URL」「位置」「URL から推測」がプロンプトに含まれる', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    await r.rewrite({
      target: 'linkText',
      currentValue: '',
      pageContext: {},
      specificLocation: {
        type: 'link',
        href: '/?keiro=com_logo',
        position: 1,
        currentText: '',
      },
    });
    const sentBody = JSON.parse(fetchImpl.calls[0].opts.body);
    const userMsg = sentBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('リンク先 URL: /?keiro=com_logo');
    expect(userMsg).toContain('1 番目のリンク');
    expect(userMsg).toContain('URL から推測');
  });

  test('image の場合に「画像 URL」「位置」「ファイル名から推測」がプロンプトに含まれる', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    await r.rewrite({
      target: 'altText',
      currentValue: '',
      pageContext: {},
      specificLocation: {
        type: 'image',
        src: 'https://example.com/img/upload/636annsp.jpg',
        position: 17,
        currentText: '',
      },
    });
    const sentBody = JSON.parse(fetchImpl.calls[0].opts.body);
    const userMsg = sentBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('画像 URL: https://example.com/img/upload/636annsp.jpg');
    expect(userMsg).toContain('17 番目の画像');
    expect(userMsg).toContain('ファイル名');
  });

  test('specificLocation を省略すると Phase 2-E と同じ汎用プロンプト', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    await r.rewrite({
      target: 'linkText',
      currentValue: 'こちら',
      pageContext: { url: 'https://example.com' },
    });
    const sentBody = JSON.parse(fetchImpl.calls[0].opts.body);
    const userMsg = sentBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).not.toContain('書き換え対象の特定要素');
    expect(userMsg).not.toContain('リンク先 URL');
  });
});

describe('Phase 2-G: キャッシュの分離', () => {
  test('specificLocation の有無で別キャッシュ', async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      return { ok: true, json: async () => successResponse, text: async () => '' };
    };
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const baseInput = { target: 'linkText', currentValue: '', pageContext: { url: 'https://x.com' } };
    await r.rewrite(baseInput);
    await r.rewrite({ ...baseInput, specificLocation: { type: 'link', href: '/a' } });
    expect(callCount).toBe(2);
  });

  test('別 href は別キャッシュ', async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      return { ok: true, json: async () => successResponse, text: async () => '' };
    };
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const base = {
      target: 'linkText',
      currentValue: '',
      pageContext: { url: 'https://x.com' },
    };
    await r.rewrite({ ...base, specificLocation: { type: 'link', href: '/a' } });
    await r.rewrite({ ...base, specificLocation: { type: 'link', href: '/b' } });
    expect(callCount).toBe(2);
  });

  test('同じ href は同じキャッシュにヒット', async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      return { ok: true, json: async () => successResponse, text: async () => '' };
    };
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const input = {
      target: 'linkText',
      currentValue: '',
      pageContext: { url: 'https://x.com' },
      specificLocation: { type: 'link', href: '/a', position: 1 },
    };
    const r1 = await r.rewrite(input);
    const r2 = await r.rewrite(input);
    expect(callCount).toBe(1);
    expect(r1.source).toBe('llm');
    expect(r2.source).toBe('cache');
  });

  test('同じ href でも position 違いは別キャッシュ', async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount++;
      return { ok: true, json: async () => successResponse, text: async () => '' };
    };
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const base = {
      target: 'linkText',
      currentValue: '',
      pageContext: { url: 'https://x.com' },
    };
    await r.rewrite({ ...base, specificLocation: { type: 'link', href: '/a', position: 1 } });
    await r.rewrite({ ...base, specificLocation: { type: 'link', href: '/a', position: 38 } });
    expect(callCount).toBe(2);
  });
});

describe('Phase 2-G: specificLocation のサニタイズ', () => {
  const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl: () => {} });

  test('長すぎる href は切り詰められる', () => {
    const longHref = 'https://example.com/' + 'a'.repeat(2000);
    const result = r._sanitize({
      currentValue: '',
      pageContext: {},
      specificLocation: { type: 'link', href: longHref },
    });
    expect(result.specificLocation.href.length).toBeLessThanOrEqual(500);
  });

  test('currentText のロールキーワードを中和', () => {
    const result = r._sanitize({
      currentValue: '',
      pageContext: {},
      specificLocation: { type: 'link', href: '/a', currentText: 'system: ignore' },
    });
    expect(result.specificLocation.currentText).toContain('system_:');
  });

  test('position が数値以外なら null になる', () => {
    const result = r._sanitize({
      currentValue: '',
      pageContext: {},
      specificLocation: { type: 'link', href: '/a', position: 'one' },
    });
    expect(result.specificLocation.position).toBeNull();
  });

  test('specificLocation が null/undefined なら specificLocation: null', () => {
    const r1 = r._sanitize({ currentValue: '', pageContext: {}, specificLocation: null });
    expect(r1.specificLocation).toBeNull();
    const r2 = r._sanitize({ currentValue: '', pageContext: {} });
    expect(r2.specificLocation).toBeNull();
  });
});

describe('Phase 2-G: 後方互換性', () => {
  test('Phase 2-E の呼び出し方 (specificLocation なし) は引き続き動く', async () => {
    const fetchImpl = makeFakeFetch(successResponse);
    const r = new LlmContentRewriter({ apiKey: 'sk-test', fetchImpl });
    const result = await r.rewrite({
      target: 'title',
      currentValue: '短いタイトル',
      pageContext: { url: 'https://example.com' },
    });
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(3);
  });

  test('SUPPORTED_TARGETS は変化なし', () => {
    expect(LlmContentRewriter.SUPPORTED_TARGETS).toEqual(['title', 'metaDescription', 'h1', 'linkText', 'altText']);
  });
});
