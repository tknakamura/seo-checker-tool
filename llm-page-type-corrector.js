/**
 * LLM ページタイプ補正モジュール (Phase 2-C)
 *
 * OpenAI GPT-4o-mini を使って、ルールベース判定 (page-type-analyzer.js) の
 * 結果を補正・上書きする。
 *
 * 動作原則:
 *   - OPENAI_API_KEY が未設定なら何もしない (既存ルールベース挙動を完全維持)
 *   - LLM 失敗時はルールベース結果にフォールバック (サービス継続性最優先)
 *   - 同じURL/コンテンツへの連続診断はメモリLRUでキャッシュ (コスト削減)
 *   - 入力サイズは厳密制限 (プロンプトインジェクション対策 + コスト予測可能化)
 *   - すべての入出力は構造化、自由形式の文章は判定根拠フィールドのみ
 *
 * このモジュールは page-type-analyzer.js と組み合わせて使うことを想定し、
 * 単独でも `correct(input)` のみで動作する。
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 1000;
const MAX_TITLE_CHARS = 200;
const MAX_META_CHARS = 400;
const MAX_HEADINGS = 15;
const MAX_HEADING_CHARS = 100;

const SYSTEM_PROMPT = `あなたは schema.org と SEO/AIO に精通した日本語ネイティブの専門家です。
与えられた Web ページの情報を分析し、(A) 最も適切な主タイプ判定と、(B) そのページに実装すべき構造化データスキーマの推奨を行ってください。

【A: 主タイプ判定ルール】
- LocalBusiness は実店舗・拠点を持つ事業者のみ。BtoB サービスや広告 LP には使わない
- BtoB サービス LP は Service もしくは WebPage を優先
- 商品単体ページは Product、商品カテゴリは CollectionPage
- 会社案内は AboutPage または Organization
- 問い合わせページは ContactPage
- ソフトウェア / SaaS / アプリは SoftwareApplication
- ニュース記事は NewsArticle、ブログ記事は BlogPosting、汎用記事は Article
- レシピは Recipe、イベントは Event、求人は JobPosting、講座は Course
- 動画コンテンツ主体は VideoObject
- FAQ ページは FAQPage、ハウツーは HowTo
- レビュー専用ページは Review

【B: 推奨スキーマ判定ルール】
- このページに実装すべきスキーマを「必須(required)」「推奨(recommended)」「参考(optional)」の3階層で提案
- 主タイプそのものを最初の必須スキーマに含める
- 主タイプに自然に付随するスキーマを必須/推奨に
- 各スキーマには "schema" (schema.org 名) と "reason" (なぜこのページに必要か、日本語1文) を含める
- 必須は通常 1〜2件、推奨は 2〜4件、参考は 1〜3件
- ページ内容と無関係なスキーマは推奨しない (例: 商品が無いのに Product を推奨しない)
- すでに実装されているスキーマがあれば、追加が必要なものだけを推奨する判断材料にする

具体例:
- BtoB サービス LP (例: ads.mercari.com) なら:
  + 必須: WebPage / Service
  + 推奨: Organization, BreadcrumbList, ContactPoint
  + 参考: VideoObject (動画があれば), FAQPage (FAQがあれば)
- 個人記事サイトなら:
  + 必須: Article (or BlogPosting / NewsArticle)
  + 推奨: Person (著者), Organization (運営), BreadcrumbList
  + 参考: ImageObject

出力は必ず以下の JSON のみ。説明文や前置きを含めない:
{
  "primaryType": "<schema.org タイプ名>",
  "secondaryTypes": ["<候補1>", "<候補2>"],
  "confidence": <0.0-1.0 の小数>,
  "reasoning": "<主タイプ判定の根拠、日本語1-2文>",
  "matchedSignals": ["<判定の決め手1>", "<判定の決め手2>"],
  "recommendedSchemas": {
    "required": [{"schema": "<名前>", "reason": "<理由>"}],
    "recommended": [{"schema": "<名前>", "reason": "<理由>"}],
    "optional": [{"schema": "<名前>", "reason": "<理由>"}]
  }
}`;

class LlmPageTypeCorrector {
  /**
   * @param {Object} options
   * @param {string} [options.apiKey] - OPENAI_API_KEY。未指定なら process.env から自動取得
   * @param {string} [options.model] - 上書き用モデル名（テスト用）
   * @param {number} [options.timeoutMs] - タイムアウト
   * @param {Function} [options.fetchImpl] - テスト用に注入できる fetch 実装
   * @param {number} [options.cacheSize] - LRU キャッシュ上限
   * @param {number} [options.cacheTtlMs] - キャッシュ TTL
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.OPENAI_API_KEY;
    this.model = options.model || MODEL;
    this.timeoutMs = options.timeoutMs || TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    this.cacheSize = options.cacheSize || 100;
    this.cacheTtlMs = options.cacheTtlMs != null ? options.cacheTtlMs : 24 * 60 * 60 * 1000; // 24h
    this._cache = new Map(); // key -> { value, expiresAt }
  }

  /**
   * LLM が有効か（apiKey + fetch 両方そろっているか）
   */
  isEnabled() {
    return !!(this.apiKey && this.fetchImpl);
  }

  /**
   * メインの補正処理。
   * @param {Object} input - { url, title, metaDescription, headings, bodyText, ruleBased }
   * @returns {Promise<Object|null>} 補正結果オブジェクト or null (LLM無効/失敗時)
   *
   * 返却オブジェクト:
   *   {
   *     primaryType,
   *     secondaryTypes,
   *     confidence,
   *     reasoning,
   *     matchedSignals,
   *     source: 'llm' | 'cache',
   *     model,
   *     latencyMs,
   *   }
   */
  async correct(input) {
    if (!this.isEnabled()) return null;

    const sanitized = this._sanitize(input);
    const cacheKey = this._cacheKey(sanitized);
    const cached = this._readCache(cacheKey);
    if (cached) {
      return { ...cached, source: 'cache' };
    }

    const startedAt = Date.now();
    let response;
    try {
      response = await this._callOpenAI(sanitized);
    } catch (err) {
      // タイムアウト / ネットワーク / 401 等。サイレントフォールバック。
      return {
        error: true,
        errorCode: err && err.code ? err.code : 'LLM_CALL_FAILED',
        errorMessage: err && err.message ? err.message : 'unknown',
        latencyMs: Date.now() - startedAt,
      };
    }
    const latencyMs = Date.now() - startedAt;

    const parsed = this._parseResponse(response);
    if (!parsed) {
      return {
        error: true,
        errorCode: 'LLM_PARSE_FAILED',
        errorMessage: 'LLM レスポンスを JSON として解釈できませんでした',
        rawResponse: typeof response === 'string' ? response.slice(0, 500) : null,
        latencyMs,
      };
    }

    const result = {
      ...parsed,
      source: 'llm',
      model: this.model,
      latencyMs,
    };
    this._writeCache(cacheKey, result);
    return result;
  }

  /**
   * 入力サニタイズ。サイズ制限とプロンプトインジェクション対策。
   * @private
   */
  _sanitize(input) {
    const safe = (s, max) => {
      if (typeof s !== 'string') return '';
      return s
        // 制御文字を削除（タブ・改行は残す）
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
        // 過度な空白を圧縮
        .replace(/[ \t]+/g, ' ')
        // システムプロンプト風の文字列を無効化
        .replace(/\b(system|assistant|developer)\s*:/gi, '$1_:')
        // バックティック・JSONを意図せず閉じる文字を中和（保守的に）
        .slice(0, max)
        .trim();
    };
    return {
      url: safe(input && input.url, 500),
      title: safe(input && input.title, MAX_TITLE_CHARS),
      metaDescription: safe(input && input.metaDescription, MAX_META_CHARS),
      headings: Array.isArray(input && input.headings)
        ? input.headings.slice(0, MAX_HEADINGS).map(h => safe(h, MAX_HEADING_CHARS)).filter(Boolean)
        : [],
      bodyText: safe(input && input.bodyText, MAX_BODY_CHARS),
      ruleBased: input && input.ruleBased ? {
        primaryType: safe(input.ruleBased.primaryType, 50),
        confidence: typeof input.ruleBased.confidence === 'number' ? input.ruleBased.confidence : null,
      } : null,
      // Phase 2-D: 既存スキーマを LLM に渡す
      existingSchemas: Array.isArray(input && input.existingSchemas)
        ? input.existingSchemas.slice(0, 20).map(s => safe(s, 50)).filter(Boolean)
        : [],
    };
  }

  /**
   * キャッシュキー生成。url + bodyText のハッシュで一意化。
   * @private
   */
  _cacheKey(sanitized) {
    // 簡易ハッシュ (Node の crypto を使わずに依存を増やさない)
    const text = `${sanitized.url}|${sanitized.title}|${sanitized.bodyText.slice(0, 200)}`;
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  _readCache(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this._cache.delete(key);
      return null;
    }
    // LRU: 最新アクセスを末尾へ
    this._cache.delete(key);
    this._cache.set(key, entry);
    return entry.value;
  }

  _writeCache(key, value) {
    this._cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
    // LRU 上限超過 → 最古を削除
    while (this._cache.size > this.cacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  }

  /**
   * OpenAI API 呼び出し
   * @private
   */
  async _callOpenAI(sanitized) {
    const userPrompt = [
      `URL: ${sanitized.url || '(未指定)'}`,
      `タイトル: ${sanitized.title || '(空)'}`,
      `メタディスクリプション: ${sanitized.metaDescription || '(空)'}`,
      `主要見出し (H1-H3): ${sanitized.headings.join(' / ') || '(なし)'}`,
      `本文サンプル (先頭${MAX_BODY_CHARS}字): ${sanitized.bodyText || '(空)'}`,
      sanitized.existingSchemas.length > 0
        ? `すでに実装されている schema.org タイプ: ${sanitized.existingSchemas.join(', ')} (これらは "required"/"recommended" から除外する判断材料に使ってください)`
        : '既存の schema.org 実装: なし',
      sanitized.ruleBased && sanitized.ruleBased.primaryType
        ? `参考: ルールベース判定は "${sanitized.ruleBased.primaryType}" (信頼度 ${sanitized.ruleBased.confidence != null ? Math.round(sanitized.ruleBased.confidence * 100) + '%' : '不明'})。妥当か検証してください。`
        : null,
    ].filter(Boolean).join('\n');

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
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,            // 安定性最優先
          max_tokens: 400,
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

  /**
   * LLM のレスポンス JSON 文字列をパースし、形式を検証して正規化
   * @private
   */
  _parseResponse(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (_) {
      // フォールバック: コードブロック等を剥がしてみる
      const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      try {
        obj = JSON.parse(stripped);
      } catch (_) {
        return null;
      }
    }
    if (!obj || typeof obj !== 'object') return null;

    // 必須フィールドの検証
    const primaryType = typeof obj.primaryType === 'string' && obj.primaryType.trim()
      ? obj.primaryType.trim().slice(0, 50)
      : null;
    if (!primaryType) return null;

    const secondaryTypes = Array.isArray(obj.secondaryTypes)
      ? obj.secondaryTypes
          .filter(t => typeof t === 'string' && t.trim())
          .map(t => t.trim().slice(0, 50))
          .slice(0, 5)
      : [];

    let confidence = typeof obj.confidence === 'number' ? obj.confidence : Number(obj.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));

    const reasoning = typeof obj.reasoning === 'string'
      ? obj.reasoning.trim().slice(0, 500)
      : '';

    const matchedSignals = Array.isArray(obj.matchedSignals)
      ? obj.matchedSignals
          .filter(s => typeof s === 'string' && s.trim())
          .map(s => s.trim().slice(0, 200))
          .slice(0, 8)
      : [];

    // Phase 2-D: 推奨スキーマ
    const recommendedSchemas = this._parseRecommendedSchemas(obj.recommendedSchemas);

    return {
      primaryType,
      secondaryTypes,
      confidence,
      reasoning,
      matchedSignals,
      recommendedSchemas,
    };
  }

  /**
   * recommendedSchemas をパース・正規化 (Phase 2-D)
   * 期待: { required: [{schema, reason}], recommended: [{schema, reason}], optional: [{schema, reason}] }
   * @private
   */
  _parseRecommendedSchemas(raw) {
    const parseList = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const schema = typeof item.schema === 'string' && item.schema.trim()
            ? item.schema.trim().slice(0, 50)
            : null;
          if (!schema) return null;
          const reason = typeof item.reason === 'string'
            ? item.reason.trim().slice(0, 300)
            : '';
          return { schema, reason };
        })
        .filter(Boolean)
        .slice(0, 10);
    };
    if (!raw || typeof raw !== 'object') {
      return { required: [], recommended: [], optional: [] };
    }
    return {
      required: parseList(raw.required),
      recommended: parseList(raw.recommended),
      optional: parseList(raw.optional),
    };
  }
}

module.exports = LlmPageTypeCorrector;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.MODEL = MODEL;
