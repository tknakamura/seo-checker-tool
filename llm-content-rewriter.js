/**
 * LLM コンテンツ書き換え提案モジュール (Phase 2-E)
 *
 * OpenAI gpt-4o-mini を使って、SEO/AIO 観点で問題のある要素
 * (タイトル/メタディスクリプション/H1/リンクテキスト/alt属性) に対し、
 * 3 つの書き換え候補と理由を生成する。
 *
 * 動作原則:
 *   - OPENAI_API_KEY 未設定なら何もしない (UI 側でボタン非表示にする)
 *   - LLM 失敗時はエラーを返してユーザーに通知
 *   - 同じ (target, currentValue, pageContext) への連続要求はメモリLRUでキャッシュ
 *   - 入力サイズは厳密制限 (プロンプトインジェクション対策 + コスト予測可能化)
 *   - 出力は常に 3 案、それぞれ {text, reason}
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 12000; // 提案は少し時間かかってもOK
const MAX_BODY_CHARS = 800;
const MAX_TITLE_CHARS = 200;
const MAX_META_CHARS = 400;
const MAX_HEADINGS = 10;
const MAX_HEADING_CHARS = 100;
const MAX_CURRENT_CHARS = 500;

// サポートする書き換え対象
const SUPPORTED_TARGETS = Object.freeze([
  'title',
  'metaDescription',
  'h1',
  'linkText',
  'altText',
]);

/**
 * 対象ごとのプロンプト断片（システムプロンプトを動的に組み立てる）
 */
const TARGET_PROMPTS = {
  title: {
    label: 'ページタイトル (title要素)',
    constraints: [
      '全角20〜32文字以内 (Google検索結果で切り捨てられない長さ)',
      '主要キーワードを前半に配置',
      'ブランド名は末尾に「| ブランド名」形式で',
      '魅力的でクリックしたくなる文言',
    ],
  },
  metaDescription: {
    label: 'メタディスクリプション',
    constraints: [
      '全角80〜120文字以内 (PC・スマホ両方で見切れない)',
      '前半70文字に重要な結論や検索意図の答え',
      '行動喚起 (CTA) を含むと効果的',
      'タイトルの繰り返しではなく、補足情報を提供',
    ],
  },
  h1: {
    label: 'メインの見出し (H1タグ)',
    constraints: [
      '全角15〜40文字以内',
      'ページの主題を一目で伝える',
      'タイトルと内容が一致するが、まったく同じ文言は避ける',
      'キーワードを自然に含む',
    ],
  },
  linkText: {
    label: 'リンクテキスト (アンカーテキスト)',
    constraints: [
      '「こちら」「詳細」「クリック」等の汎用テキストを避ける',
      'リンク先の内容が具体的に分かる文言 (5〜30文字)',
      'a11y (スクリーンリーダーで読み上げて意味が通る) を意識',
      '動詞 + 名詞の形が望ましい (例: 「料金プランを見る」)',
    ],
  },
  altText: {
    label: '画像の alt属性',
    constraints: [
      '画像の内容を簡潔に説明 (125文字以内)',
      '「image of」「picture of」等の冗長な表現を避ける',
      '装飾的な画像なら空文字 alt="" を提案',
      '機能的な画像（ボタン等）は機能を説明',
    ],
  },
};

function buildSystemPrompt(target) {
  const meta = TARGET_PROMPTS[target];
  if (!meta) return null;
  return `あなたは SEO/AIO に精通した日本語ネイティブのコピーライターです。
与えられた Web ページの現状を踏まえて、${meta.label}の書き換え候補を 3 つ提案してください。

【守るべき制約】
${meta.constraints.map(c => '- ' + c).join('\n')}
- ページ全体の文脈（タイトル・本文・主要見出し）と整合する内容
- ブランド名や固有名詞は元の表記を維持
- 自然な日本語、不自然な体言止めの濫用は避ける

【出力形式】
JSON のみ、説明文・前置きを含めない:
{
  "suggestions": [
    {"text": "<書き換え案1>", "reason": "<なぜこれが良いか、日本語1文>"},
    {"text": "<書き換え案2>", "reason": "<なぜこれが良いか、日本語1文>"},
    {"text": "<書き換え案3>", "reason": "<なぜこれが良いか、日本語1文>"}
  ]
}

3案は異なる切り口で（例: キーワード重視 / 数字・実績訴求 / ターゲット明示）。
text は制約を必ず守った文言にし、reason は「なぜこの案を推すか」を 1 文で。`;
}

class LlmContentRewriter {
  /**
   * @param {Object} options
   * @param {string} [options.apiKey] - OPENAI_API_KEY
   * @param {string} [options.model]
   * @param {number} [options.timeoutMs]
   * @param {Function} [options.fetchImpl] - テスト注入用
   * @param {number} [options.cacheSize]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.OPENAI_API_KEY;
    this.model = options.model || MODEL;
    this.timeoutMs = options.timeoutMs || TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.cacheSize = options.cacheSize || 200;
    this.cacheTtlMs = options.cacheTtlMs != null ? options.cacheTtlMs : 6 * 60 * 60 * 1000; // 6h
    this._cache = new Map();
  }

  isEnabled() {
    return !!(this.apiKey && this.fetchImpl);
  }

  static get SUPPORTED_TARGETS() {
    return SUPPORTED_TARGETS;
  }

  /**
   * 書き換え提案を生成
   * @param {Object} input
   * @param {string} input.target - SUPPORTED_TARGETS のいずれか
   * @param {string} input.currentValue - 現在の値
   * @param {Object} input.pageContext - { url, title, metaDescription, headings, bodyText }
   * @returns {Promise<Object>} { suggestions: [{text, reason}, ...3個], source, model, latencyMs, error?, errorCode?, errorMessage? }
   */
  async rewrite(input) {
    if (!this.isEnabled()) {
      return { error: true, errorCode: 'LLM_DISABLED', errorMessage: 'OPENAI_API_KEY が設定されていません' };
    }

    // バリデーション
    if (!input || typeof input !== 'object') {
      return { error: true, errorCode: 'INVALID_INPUT', errorMessage: 'input が不正です' };
    }
    const target = input.target;
    if (!SUPPORTED_TARGETS.includes(target)) {
      return { error: true, errorCode: 'UNSUPPORTED_TARGET', errorMessage: `target は ${SUPPORTED_TARGETS.join('/')} のいずれかである必要があります` };
    }

    const sanitized = this._sanitize(input);
    const cacheKey = this._cacheKey(target, sanitized);
    const cached = this._readCache(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    const startedAt = Date.now();
    let raw;
    try {
      raw = await this._callOpenAI(target, sanitized);
    } catch (err) {
      return {
        error: true,
        errorCode: err && err.code ? err.code : 'LLM_CALL_FAILED',
        errorMessage: err && err.message ? err.message : 'unknown',
        latencyMs: Date.now() - startedAt,
      };
    }
    const latencyMs = Date.now() - startedAt;

    const parsed = this._parseResponse(raw);
    if (!parsed) {
      return {
        error: true,
        errorCode: 'LLM_PARSE_FAILED',
        errorMessage: 'LLM レスポンスを解釈できませんでした',
        rawResponse: typeof raw === 'string' ? raw.slice(0, 500) : null,
        latencyMs,
      };
    }

    const result = {
      target,
      suggestions: parsed.suggestions,
      source: 'llm',
      model: this.model,
      latencyMs,
    };
    this._writeCache(cacheKey, result);
    return result;
  }

  /** @private */
  _sanitize(input) {
    const safe = (s, max) => {
      if (typeof s !== 'string') return '';
      return s
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\b(system|assistant|developer|user|tool|function)\s*:/gi, '$1_:')
        .slice(0, max)
        .trim();
    };
    const ctx = input.pageContext || {};
    return {
      currentValue: safe(input.currentValue, MAX_CURRENT_CHARS),
      url: safe(ctx.url, 500),
      title: safe(ctx.title, MAX_TITLE_CHARS),
      metaDescription: safe(ctx.metaDescription, MAX_META_CHARS),
      headings: Array.isArray(ctx.headings)
        ? ctx.headings.slice(0, MAX_HEADINGS).map(h => safe(h, MAX_HEADING_CHARS)).filter(Boolean)
        : [],
      bodyText: safe(ctx.bodyText, MAX_BODY_CHARS),
    };
  }

  /** @private */
  _cacheKey(target, sanitized) {
    const text = `${target}|${sanitized.url}|${sanitized.currentValue}|${(sanitized.bodyText || '').slice(0, 100)}`;
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  /** @private */
  _readCache(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this._cache.delete(key);
      return null;
    }
    this._cache.delete(key);
    this._cache.set(key, entry);
    return entry.value;
  }

  /** @private */
  _writeCache(key, value) {
    this._cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
    while (this._cache.size > this.cacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  }

  /** @private */
  async _callOpenAI(target, sanitized) {
    const systemPrompt = buildSystemPrompt(target);
    if (!systemPrompt) {
      const e = new Error(`不明な書き換え対象: ${target}`);
      e.code = 'UNSUPPORTED_TARGET';
      throw e;
    }

    const userPrompt = [
      `URL: ${sanitized.url || '(未指定)'}`,
      `現在の値: ${sanitized.currentValue || '(空)'}`,
      '--- ページ全体の文脈 ---',
      `タイトル: ${sanitized.title || '(空)'}`,
      `メタディスクリプション: ${sanitized.metaDescription || '(空)'}`,
      `主要見出し: ${sanitized.headings.join(' / ') || '(なし)'}`,
      `本文サンプル: ${sanitized.bodyText || '(空)'}`,
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7, // 書き換えはバリエーション欲しい
          max_tokens: 600,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
        err.code = `OPENAI_HTTP_${res.status}`;
        throw err;
      }

      const json = await res.json();
      const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      return content || null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** @private */
  _parseResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (_) {
      const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      try {
        obj = JSON.parse(stripped);
      } catch (_) {
        return null;
      }
    }
    if (!obj || !Array.isArray(obj.suggestions)) return null;
    const suggestions = obj.suggestions
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const text = typeof item.text === 'string' ? item.text.trim().slice(0, 500) : null;
        if (!text) return null;
        const reason = typeof item.reason === 'string' ? item.reason.trim().slice(0, 300) : '';
        return { text, reason };
      })
      .filter(Boolean)
      .slice(0, 5);
    if (suggestions.length === 0) return null;
    return { suggestions };
  }
}

module.exports = LlmContentRewriter;
module.exports.SUPPORTED_TARGETS = SUPPORTED_TARGETS;
module.exports.MODEL = MODEL;
module.exports.buildSystemPrompt = buildSystemPrompt;
