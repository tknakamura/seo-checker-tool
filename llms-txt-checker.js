/**
 * llms.txt 対応チェッカー
 *
 * llms.txt は llmstxt.org（Answer.AI）が提唱する AI/LLM 向けの
 * サイト情報提供標準ファイル（robots.txt のAI/LLM版）。
 *
 * 仕様: https://llmstxt.org/
 *
 * このモジュールは対象ホストに対して以下をチェックする:
 *  - /llms.txt の存在（必須）
 *  - /llms-full.txt の存在（推奨、フルテキスト版）
 *  - H1（タイトル）の存在と単一性
 *  - サマリー（Blockquote）の存在
 *  - 1つ以上の H2 セクション
 *  - Markdown リンク形式の妥当性
 *  - robots.txt のAI Crawler許可状況
 *
 * @example
 *   const LlmsTxtChecker = require('./llms-txt-checker');
 *   const checker = new LlmsTxtChecker();
 *   const result = await checker.check('https://example.com/');
 *   // result.score, result.issues, result.recommendations, result.found, ...
 */

const axios = require('axios');

const USER_AGENT = 'SEO-AIO-Doctor/1.3 (+https://seo-checker-tool.onrender.com/)';
// AIクローラーの代表的な User-Agent 文字列（参考用）
const AI_USER_AGENTS = [
  'GPTBot',           // OpenAI
  'OAI-SearchBot',    // OpenAI Search
  'ChatGPT-User',     // ChatGPT browse
  'ClaudeBot',        // Anthropic
  'anthropic-ai',     // Anthropic
  'PerplexityBot',    // Perplexity
  'Google-Extended',  // Google Bard/SGE
  'CCBot',            // Common Crawl
  'cohere-ai',        // Cohere
  'Bytespider',       // ByteDance
];

class LlmsTxtChecker {
  constructor(options = {}) {
    this.timeout = options.timeout || 8000;
    this.maxBytes = options.maxBytes || 200_000; // llms.txt は通常小さい
  }

  /**
   * メインのチェック関数
   * @param {string} pageUrl - 診断対象のページURL（任意のパス）
   * @returns {Promise<Object>} チェック結果
   */
  async check(pageUrl) {
    const result = {
      // 入力
      origin: null,
      llmsTxtUrl: null,
      llmsFullTxtUrl: null,
      robotsTxtUrl: null,

      // 取得状態
      found: false,
      foundFullVersion: false,
      llmsTxtContent: null,
      llmsTxtSize: 0,
      llmsFullTxtSize: 0,
      httpStatus: null,
      fetchError: null,

      // パース結果
      parsed: null, // { title, summary, sections: [{ name, items: [{text, url, description}] }] }

      // robots.txt
      robotsTxt: {
        found: false,
        aiCrawlers: {}, // { GPTBot: 'allowed' | 'disallowed' | 'unspecified', ... }
        warnings: []
      },

      // 評価
      score: 0,           // 0-100
      issues: [],         // 検出された問題
      recommendations: [],// 推奨アクション
    };

    let origin;
    try {
      const u = new URL(pageUrl);
      origin = `${u.protocol}//${u.host}`;
    } catch (_) {
      result.fetchError = 'INVALID_URL';
      result.issues.push('URLが不正でllms.txtチェックを実行できませんでした');
      return result;
    }

    result.origin = origin;
    result.llmsTxtUrl = `${origin}/llms.txt`;
    result.llmsFullTxtUrl = `${origin}/llms-full.txt`;
    result.robotsTxtUrl = `${origin}/robots.txt`;

    // 並列でllms.txt, llms-full.txt, robots.txt を取得
    const [llmsTxt, llmsFullTxt, robotsTxt] = await Promise.all([
      this._fetchText(result.llmsTxtUrl),
      this._fetchText(result.llmsFullTxtUrl),
      this._fetchText(result.robotsTxtUrl),
    ]);

    result.httpStatus = llmsTxt.status;
    result.fetchError = llmsTxt.error;

    if (llmsTxt.ok && llmsTxt.text) {
      result.found = true;
      result.llmsTxtContent = llmsTxt.text;
      result.llmsTxtSize = llmsTxt.text.length;
      result.parsed = this._parse(llmsTxt.text);
    }

    if (llmsFullTxt.ok && llmsFullTxt.text) {
      result.foundFullVersion = true;
      result.llmsFullTxtSize = llmsFullTxt.text.length;
    }

    if (robotsTxt.ok && robotsTxt.text) {
      result.robotsTxt.found = true;
      result.robotsTxt.aiCrawlers = this._analyzeRobotsTxt(robotsTxt.text);
    }

    // 評価
    this._evaluate(result);

    return result;
  }

  /**
   * HTTP GET でテキストを取得
   * @private
   */
  async _fetchText(url) {
    try {
      const res = await axios.get(url, {
        timeout: this.timeout,
        maxContentLength: this.maxBytes,
        validateStatus: () => true, // 4xx/5xx もエラーにしない
        responseType: 'text',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/plain, text/markdown, */*',
        },
        // Renderの無料プランでは遅いサーバーがあるためリトライしない
      });
      const ok = res.status >= 200 && res.status < 300;
      // Content-Type が HTML を返すサイトは「llms.txt 風のフォールバック」を返している可能性
      const contentType = (res.headers['content-type'] || '').toLowerCase();
      const looksLikeHtml = /text\/html|<!doctype html|<html/i.test(contentType) ||
                            (typeof res.data === 'string' && /<!doctype html|<html[\s>]/i.test(res.data.slice(0, 300)));
      return {
        ok: ok && !looksLikeHtml,
        status: res.status,
        text: typeof res.data === 'string' ? res.data : null,
        looksLikeHtml,
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        status: err.response ? err.response.status : null,
        text: null,
        looksLikeHtml: false,
        error: err.code || err.message,
      };
    }
  }

  /**
   * llms.txt の中身を簡易パース
   *  - 1行目想定: # Title
   *  - 続く Blockquote `> ...` を summary として吸い上げ
   *  - `## SectionName` で区切り、各セクション配下の `- [text](url): description` を収集
   * @private
   */
  _parse(text) {
    const lines = text.split(/\r?\n/);
    const parsed = {
      title: null,
      summary: null,
      sections: [],
      hasMultipleH1: false,
      rawLineCount: lines.length,
    };

    let currentSection = null;
    let summaryBuffer = [];
    let h1Count = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // # Title (H1)
      const h1Match = line.match(/^#\s+(.+?)\s*$/);
      if (h1Match) {
        h1Count++;
        if (!parsed.title) parsed.title = h1Match[1].trim();
        continue;
      }

      // ## Section
      const h2Match = line.match(/^##\s+(.+?)\s*$/);
      if (h2Match) {
        if (currentSection) parsed.sections.push(currentSection);
        currentSection = {
          name: h2Match[1].trim(),
          items: [],
        };
        continue;
      }

      // > summary
      const bqMatch = line.match(/^>\s?(.*)$/);
      if (bqMatch && !currentSection && parsed.title) {
        const text = bqMatch[1].trim();
        if (text) summaryBuffer.push(text);
        continue;
      }

      // - [text](url): description
      const linkMatch = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(?::\s*(.+))?$/);
      if (linkMatch && currentSection) {
        currentSection.items.push({
          text: linkMatch[1].trim(),
          url: linkMatch[2].trim(),
          description: linkMatch[3] ? linkMatch[3].trim() : null,
        });
        continue;
      }
    }
    if (currentSection) parsed.sections.push(currentSection);
    if (summaryBuffer.length > 0) parsed.summary = summaryBuffer.join(' ').trim();
    parsed.hasMultipleH1 = h1Count > 1;
    return parsed;
  }

  /**
   * robots.txt から AIクローラーの許可/拒否を抽出
   * 簡易実装: User-agent ブロックごとに Disallow / Allow を見る
   * @private
   */
  _analyzeRobotsTxt(text) {
    const lines = text.split(/\r?\n/);
    const blocks = []; // { agents: [], disallow: [], allow: [] }
    let current = null;

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) {
        // 空行はブロック区切り（次の User-agent が同じグループの追加か新規かは
        // 厳密にはルールがあるが、シンプルに扱う）
        continue;
      }
      const uaMatch = line.match(/^user-agent:\s*(.+)$/i);
      if (uaMatch) {
        // 直前のブロックの「Disallow/Allow を共有する」場合があるので、
        // current が disallow/allow を持っていれば push して新ブロック
        if (current && (current.disallow.length || current.allow.length)) {
          blocks.push(current);
          current = null;
        }
        if (!current) current = { agents: [], disallow: [], allow: [] };
        current.agents.push(uaMatch[1].trim());
        continue;
      }
      const dMatch = line.match(/^disallow:\s*(.*)$/i);
      if (dMatch && current) {
        current.disallow.push(dMatch[1].trim());
        continue;
      }
      const aMatch = line.match(/^allow:\s*(.*)$/i);
      if (aMatch && current) {
        current.allow.push(aMatch[1].trim());
        continue;
      }
    }
    if (current && (current.agents.length)) blocks.push(current);

    const aiCrawlers = {};
    for (const ua of AI_USER_AGENTS) {
      aiCrawlers[ua] = this._resolveAgentStatus(ua, blocks);
    }
    return aiCrawlers;
  }

  /**
   * 特定エージェントに対するクロール許可状態を判定
   * - 'disallowed': Disallow: / または Disallow: /* (全パス拒否)
   * - 'allowed': Disallow: が空 or 一部パスのみで主要コンテンツがアクセス可能
   * - 'unspecified': そのエージェント向けブロックなし
   *
   * 注: `Disallow: /api/` のような限定パス拒否は健全な運用とみなし allowed 判定。
   * "partial" は本当に問題のあるケース（広範囲の拒否）のみに限定する。
   * @private
   */
  _resolveAgentStatus(agent, blocks) {
    // 大文字小文字無視
    const lcAgent = agent.toLowerCase();
    let matched = null;
    let wildcard = null;
    for (const b of blocks) {
      for (const a of b.agents) {
        if (a.toLowerCase() === lcAgent) matched = b;
        if (a === '*') wildcard = b;
      }
    }
    // 明示マッチ優先（AIエージェントへの個別ルール）→ ない場合は wildcard
    const target = matched || wildcard;
    if (!target) return 'unspecified';

    // Disallow: / または / で始まる重要パス拒否があるか
    const fullBlock = target.disallow.some(d => d === '/' || d === '/*');
    if (fullBlock) return 'disallowed';

    // 空または '/' の包括拒否のみが該当しない場合は実質許可
    // 限定パス拒否（例: /api/, /admin/）は健全な運用なので allowed 扱い
    return 'allowed';
  }

  /**
   * 結果に対するスコア・推奨アクションの生成
   * @private
   */
  _evaluate(result) {
    let score = 0;
    const issues = [];
    const recommendations = [];

    // ----- 必須: llms.txt の存在 (最大 50点) -----
    if (!result.found) {
      issues.push('llms.txt が見つかりません');
      recommendations.push({
        type: 'critical',
        title: 'llms.txt を /llms.txt に設置する',
        description: 'AI/LLMがサイト構造を効率的に理解するための標準ファイルです。AI検索（ChatGPT, Claude, Perplexity）で引用される確率が大幅に向上します。',
        codeExample: this._templateLlmsTxt(result.origin || 'https://example.com'),
        docLink: 'https://llmstxt.org/',
      });
    } else {
      score += 50;
    }

    // ----- 構造: title (10点) -----
    if (result.parsed) {
      if (!result.parsed.title) {
        issues.push('llms.txt にH1タイトル（# Title）がありません');
        recommendations.push({
          type: 'high',
          title: 'llms.txt の先頭に # Title（サイト名）を追加',
          description: 'llms.txt 仕様では H1（# Title）が必須です。サイトの名称を明示してください。',
          codeExample: '# サイト名',
          docLink: 'https://llmstxt.org/#format',
        });
      } else {
        score += 10;
      }

      if (result.parsed.hasMultipleH1) {
        issues.push('llms.txt にH1（#）が複数あります');
        recommendations.push({
          type: 'high',
          title: 'H1 タイトルは1つだけにする',
          description: 'llms.txt 仕様では H1 はサイトタイトル1つのみです。他は ## (H2) に変更してください。',
          docLink: 'https://llmstxt.org/#format',
        });
      }

      // ----- 構造: summary (10点) -----
      if (!result.parsed.summary) {
        issues.push('llms.txt にサマリー（> blockquote）がありません');
        recommendations.push({
          type: 'medium',
          title: 'タイトル直後にサマリー（> ...）を追加',
          description: 'サイトが何を提供するかを1〜2文で要約してください。AI回答で正しく言及されやすくなります。',
          codeExample: '> このサイトは〇〇に関する情報を提供します。',
          docLink: 'https://llmstxt.org/#format',
        });
      } else {
        score += 10;
      }

      // ----- 構造: 1つ以上のH2セクション (15点) -----
      if (result.parsed.sections.length === 0) {
        issues.push('llms.txt に H2 セクション（## ...）がありません');
        recommendations.push({
          type: 'high',
          title: '少なくとも1つの ## セクションを追加',
          description: '主要コンテンツへのリンクをセクション分けして列挙してください（例: ## Docs, ## API, ## Blog）。',
          codeExample: '## Docs\n\n- [Getting Started](/docs/start): 入門ガイド\n- [API Reference](/docs/api): API仕様',
          docLink: 'https://llmstxt.org/#format',
        });
      } else {
        score += 15;
        // リンクの妥当性も軽く見る
        const totalItems = result.parsed.sections.reduce((sum, s) => sum + s.items.length, 0);
        if (totalItems === 0) {
          issues.push('H2 セクションは存在しますが、リンクが1つも含まれていません');
          recommendations.push({
            type: 'medium',
            title: '各セクション配下に - [text](url) 形式でリンクを追加',
            description: 'AIが辿るべきURLが無いと llms.txt の効果が薄まります。',
            docLink: 'https://llmstxt.org/#format',
          });
        }
      }
    }

    // ----- 推奨: llms-full.txt (5点) -----
    if (result.found && !result.foundFullVersion) {
      // llms.txt があるサイトには、llms-full.txt も推奨
      recommendations.push({
        type: 'low',
        title: 'llms-full.txt の設置も検討',
        description: 'llms.txt がインデックス的な役割なのに対し、llms-full.txt は実コンテンツを Markdown で結合した「フル版」です。AIが内容を一括取得しやすくなります。',
        docLink: 'https://llmstxt.org/#what-about-llms-fulltxt',
      });
    } else if (result.foundFullVersion) {
      score += 5;
    }

    // ----- 推奨: AIクローラー許可 (10点) -----
    if (result.robotsTxt.found) {
      const blocked = Object.entries(result.robotsTxt.aiCrawlers).filter(
        ([, status]) => status === 'disallowed'
      );
      if (blocked.length > 0) {
        const list = blocked.map(([ua]) => ua).join(', ');
        issues.push(`AIクローラーが robots.txt でブロック/制限されています: ${list}`);
        recommendations.push({
          type: 'high',
          title: 'robots.txt で AIクローラーを許可する',
          description: 'llms.txt を設置していても、robots.txt で AIクローラーがブロックされていれば取得されません。GPTBot, ClaudeBot, PerplexityBot 等を明示的に許可することを推奨します。',
          codeExample: '# robots.txt\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /',
          docLink: 'https://platform.openai.com/docs/gptbot',
        });
      } else {
        score += 10;
      }
    } else {
      // robots.txt が無いケースは無罪推定（全許可とみなされる）
      score += 5;
    }

    // ----- 致命的なエラー -----
    if (result.fetchError === 'INVALID_URL') {
      issues.push('URL不正のため llms.txt チェックをスキップしました');
    }

    // 上限を 100 に丸める
    result.score = Math.min(100, Math.max(0, score));
    result.issues = issues;
    result.recommendations = recommendations;
  }

  /**
   * 新規 llms.txt の雛形を生成
   * @private
   */
  _templateLlmsTxt(origin) {
    return [
      '# サイト名',
      '',
      '> このサイトは〇〇に関する情報を提供します。本セクションでサイト全体の目的と読者ターゲットを1〜2文で要約してください。',
      '',
      '## Docs',
      '',
      `- [はじめに](${origin}/docs/getting-started): プロジェクトの概要と導入手順`,
      `- [API リファレンス](${origin}/docs/api): すべてのAPIエンドポイント仕様`,
      '',
      '## Examples',
      '',
      `- [サンプル集](${origin}/examples): ユースケース別の実装例`,
      '',
      '## Optional',
      '',
      `- [リリースノート](${origin}/changelog): 過去のリリース履歴（参考情報）`,
    ].join('\n');
  }
}

module.exports = LlmsTxtChecker;
