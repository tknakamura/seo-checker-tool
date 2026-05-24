/**
 * AIO（AI最適化）チェック機能
 * AI検索エンジンでの露出とコンテンツのAI最適化度を測定
 */
const LlmsTxtChecker = require('./llms-txt-checker');

class AIOChecker {
  constructor() {
    this.llmsTxtChecker = new LlmsTxtChecker();
    this.aiSearchEngines = [
      'Google SGE',
      'Bing AI',
      'Perplexity AI',
      'ChatGPT',
      'Claude'
    ];
  }

  /**
   * AIOチェックの実行
   * @param {Object} seoResults - SEOチェック結果
   * @param {string} url - チェック対象URL
   * @param {Object} $ - Cheerioオブジェクト
   * @returns {Object} AIOチェック結果
   */
  async checkAIO(seoResults, url, $) {
    try {
      // 静的チェック（既存）と llms.txt チェック（HTTPフェッチ）を並列実行
      // url が空の場合は llms.txt チェックをスキップ（HTMLペースト診断時）
      const llmsTxtPromise = url
        ? this.checkLlmsTxtSafe(url)
        : Promise.resolve(this._llmsTxtSkippedResult());

      const [
        contentComprehensiveness,
        structuredInformation,
        credibilitySignals,
        aiSearchOptimization,
        naturalLanguageQuality,
        contextRelevance,
        llmsTxtCompliance,
      ] = await Promise.all([
        Promise.resolve(this.checkContentComprehensiveness($)),
        Promise.resolve(this.checkStructuredInformation($, seoResults)),
        Promise.resolve(this.checkCredibilitySignals($, url)),
        Promise.resolve(this.checkAISearchOptimization($, seoResults)),
        Promise.resolve(this.checkNaturalLanguageQuality($)),
        Promise.resolve(this.checkContextRelevance($, url)),
        llmsTxtPromise,
      ]);

      const aioResults = {
        timestamp: new Date().toISOString(),
        checks: {
          contentComprehensiveness,
          structuredInformation,
          credibilitySignals,
          aiSearchOptimization,
          naturalLanguageQuality,
          contextRelevance,
          llmsTxtCompliance, // Phase 2-A 新規カテゴリ
        },
        overallScore: 0,
        recommendations: []
      };

      // 総合スコア計算
      aioResults.overallScore = this.calculateAIOOverallScore(aioResults.checks);

      // 改善提案生成
      aioResults.recommendations = this.generateAIORecommendations(aioResults.checks);

      return aioResults;
    } catch (error) {
      console.error('AIOチェックエラー:', error);
      throw error;
    }
  }

  /**
   * llms.txt チェックを安全に実行（タイムアウトや例外を握り潰す）
   * AIOチェック全体を落とさないため、失敗時は中立的なスキップ結果を返す。
   */
  async checkLlmsTxtSafe(url) {
    try {
      const raw = await this.llmsTxtChecker.check(url);
      // SEOCheckItem 形式に整形する（score / issues / recommendations）
      return {
        score: raw.score,
        issues: raw.issues || [],
        recommendations: raw.recommendations.map(r => r.title),
        // 詳細情報は別フィールドで保持しておく（フロントで参照可）
        details: {
          found: raw.found,
          foundFullVersion: raw.foundFullVersion,
          llmsTxtUrl: raw.llmsTxtUrl,
          llmsFullTxtUrl: raw.llmsFullTxtUrl,
          robotsTxtUrl: raw.robotsTxtUrl,
          parsed: raw.parsed,
          robotsTxt: raw.robotsTxt,
          httpStatus: raw.httpStatus,
          fetchError: raw.fetchError,
          llmsTxtSize: raw.llmsTxtSize,
          llmsFullTxtSize: raw.llmsFullTxtSize,
          // 推奨アクションのリッチオブジェクトはこちらで保持
          richRecommendations: raw.recommendations,
        }
      };
    } catch (err) {
      console.warn('llms.txt チェックでエラー、スキップ:', err && err.message);
      return this._llmsTxtErrorResult(err && err.message);
    }
  }

  _llmsTxtSkippedResult() {
    return {
      score: 0,
      issues: [],
      recommendations: [],
      details: {
        skipped: true,
        skipReason: 'URLが指定されていないためllms.txtチェックをスキップしました'
      }
    };
  }

  _llmsTxtErrorResult(message) {
    return {
      score: 0,
      issues: [`llms.txtチェックでエラー: ${message || '不明'}`],
      recommendations: [],
      details: { error: true, message }
    };
  }

  /**
   * コンテンツの包括性チェック
   */
  checkContentComprehensiveness($) {
    const issues = [];
    const recommendations = [];

    // テキストコンテンツの分析
    const textContent = $('body').text().trim();
    const wordCount = textContent.split(/\s+/).length;
    const paragraphCount = $('p').length;
    const listCount = $('ul, ol').length;

    // コンテンツの長さチェック
    if (wordCount < 300) {
      issues.push(`コンテンツが短すぎます（${wordCount}語）`);
      recommendations.push('コンテンツを300語以上にしてください');
    } else if (wordCount > 3000) {
      issues.push(`コンテンツが長すぎる可能性があります（${wordCount}語）`);
      recommendations.push('コンテンツを3000語以下に最適化してください');
    }

    // 段落構造のチェック
    if (paragraphCount < 3) {
      issues.push('段落が少なすぎます');
      recommendations.push('コンテンツを3つ以上の段落に分割してください');
    }

    // リストの存在チェック
    if (listCount === 0) {
      issues.push('リスト形式のコンテンツがありません');
      recommendations.push('箇条書きや番号付きリストを追加してください');
    }

    // 見出しとコンテンツのバランスチェック
    const headingCount = $('h1, h2, h3, h4, h5, h6').length;
    const contentToHeadingRatio = wordCount / Math.max(headingCount, 1);
    
    if (contentToHeadingRatio < 100) {
      issues.push('見出しに対してコンテンツが少なすぎます');
      recommendations.push('各見出しにより多くのコンテンツを追加してください');
    }

    return {
      wordCount: wordCount,
      paragraphCount: paragraphCount,
      listCount: listCount,
      headingCount: headingCount,
      contentToHeadingRatio: Math.round(contentToHeadingRatio),
      issues: issues,
      recommendations: recommendations,
      score: this.calculateComprehensivenessScore(wordCount, paragraphCount, listCount, contentToHeadingRatio)
    };
  }

  /**
   * 構造化情報のチェック
   */
  checkStructuredInformation($, seoResults) {
    const issues = [];
    const recommendations = [];

    // 構造化データの詳細分析
    const structuredData = seoResults.checks.structuredData;
    
    // スキーマの種類チェック
    const schemaTypes = new Set();
    
    if (structuredData.jsonLd.length === 0) {
      issues.push('JSON-LD構造化データがありません');
      recommendations.push('JSON-LD構造化データを実装してください');
    } else {
      structuredData.jsonLd.forEach(schema => {
        if (schema['@type']) {
          if (Array.isArray(schema['@type'])) {
            schema['@type'].forEach(type => schemaTypes.add(type));
          } else {
            schemaTypes.add(schema['@type']);
          }
        }
      });

      // AI検索に重要なスキーマのチェック
      const importantSchemas = ['Article', 'FAQPage', 'HowTo', 'Product', 'Review'];
      const missingSchemas = importantSchemas.filter(schema => !schemaTypes.has(schema));
      
      if (missingSchemas.length > 0) {
        issues.push(`AI検索に重要なスキーマが不足しています: ${missingSchemas.join(', ')}`);
        recommendations.push(`不足しているスキーマを実装してください: ${missingSchemas.join(', ')}`);
      }
    }

    // FAQの存在チェック
    const faqElements = $('[itemtype*="FAQ"], .faq, .question, .answer').length;
    if (faqElements === 0) {
      issues.push('FAQ形式のコンテンツがありません');
      recommendations.push('よくある質問を追加してください');
    }

    // 定義リストのチェック
    const definitionLists = $('dl').length;
    if (definitionLists === 0) {
      issues.push('定義リストがありません');
      recommendations.push('用語の定義を追加してください');
    }

    return {
      schemaTypes: Array.from(schemaTypes),
      faqElements: faqElements,
      definitionLists: definitionLists,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateStructuredInfoScore(structuredData, faqElements, definitionLists)
    };
  }

  /**
   * 信頼性シグナルのチェック
   */
  checkCredibilitySignals($, url) {
    const issues = [];
    const recommendations = [];

    // 著者情報のチェック
    const authorInfo = $('[rel="author"], .author, [itemprop="author"]').length;
    if (authorInfo === 0) {
      issues.push('著者情報がありません');
      recommendations.push('著者情報を追加してください');
    }

    // 公開日・更新日のチェック
    const dateInfo = $('time, [datetime], .date, .published, .updated').length;
    if (dateInfo === 0) {
      issues.push('日付情報がありません');
      recommendations.push('公開日や更新日を追加してください');
    }

    // 引用・参考文献のチェック
    const citations = $('blockquote, cite, .citation, .reference').length;
    if (citations === 0) {
      issues.push('引用や参考文献がありません');
      recommendations.push('信頼できるソースからの引用を追加してください');
    }

    // 外部リンクの品質チェック
    const externalLinks = $('a[href^="http"]').filter((i, el) => {
      const href = $(el).attr('href');
      if (!href || href.trim() === '') {
        return false; // 空のhrefは除外
      }
      if (!url || url.trim() === '') {
        return true; // URLが空の場合は全ての外部リンクを対象とする
      }
      try {
        // hrefとurlの両方が有効なURLかチェック
        new URL(href);
        new URL(url);
        return !href.includes(new URL(url).hostname);
      } catch (e) {
        return true; // URLが無効な場合は全ての外部リンクを対象とする
      }
    });
    
    const highAuthorityLinks = externalLinks.filter((i, el) => {
      const href = $(el).attr('href');
      if (!href || href.trim() === '') {
        return false; // 空のhrefは除外
      }
      try {
        // hrefが有効なURLかチェック
        new URL(href);
        const domain = new URL(href).hostname;
        return this.isHighAuthorityDomain(domain);
      } catch (e) {
        return false; // 無効なURLは除外
      }
    }).length;

    if (externalLinks.length > 0 && highAuthorityLinks === 0) {
      issues.push('権威のある外部サイトへのリンクがありません');
      recommendations.push('信頼できる外部サイトへのリンクを追加してください');
    }

    // 連絡先情報のチェック
    const contactInfo = $('[href^="mailto:"], [href^="tel:"], .contact').length;
    if (contactInfo === 0) {
      issues.push('連絡先情報がありません');
      recommendations.push('連絡先情報を追加してください');
    }

    return {
      authorInfo: authorInfo,
      dateInfo: dateInfo,
      citations: citations,
      externalLinks: externalLinks.length,
      highAuthorityLinks: highAuthorityLinks,
      contactInfo: contactInfo,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateCredibilityScore(authorInfo, dateInfo, citations, highAuthorityLinks, contactInfo)
    };
  }

  /**
   * AI検索最適化のチェック
   */
  checkAISearchOptimization($, seoResults) {
    const issues = [];
    const recommendations = [];

    // 自然言語での質問形式のチェック
    const questionPatterns = $('*').filter((i, el) => {
      const text = $(el).text();
      return /^(何|なぜ|どのように|いつ|どこで|誰が|どれ|どの|なぜ|どうして)/.test(text.trim());
    }).length;

    if (questionPatterns === 0) {
      issues.push('質問形式のコンテンツがありません');
      recommendations.push('ユーザーの疑問に答える質問形式のコンテンツを追加してください');
    }

    // 比較・対比のチェック
    const comparisonWords = ['比較', '対比', '違い', 'vs', 'versus', 'どちら', 'どれが'];
    const hasComparison = comparisonWords.some(word => 
      $('body').text().includes(word)
    );

    if (!hasComparison) {
      issues.push('比較・対比のコンテンツがありません');
      recommendations.push('選択肢の比較や対比を追加してください');
    }

    // 手順・ステップのチェック
    const stepPatterns = $('*').filter((i, el) => {
      const text = $(el).text();
      return /^(ステップ|手順|方法|やり方|手順\d+|Step \d+)/.test(text.trim());
    }).length;

    if (stepPatterns === 0) {
      issues.push('手順・ステップ形式のコンテンツがありません');
      recommendations.push('How-to形式のコンテンツを追加してください');
    }

    // 数値データのチェック
    const numericData = $('body').text().match(/\d+[%％]|\d+円|\d+個|\d+回|\d+年|\d+月|\d+日/g) || [];
    if (numericData.length < 3) {
      issues.push('具体的な数値データが少なすぎます');
      recommendations.push('統計データや具体的な数値を追加してください');
    }

    return {
      questionPatterns: questionPatterns,
      hasComparison: hasComparison,
      stepPatterns: stepPatterns,
      numericDataCount: numericData.length,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateAISearchScore(questionPatterns, hasComparison, stepPatterns, numericData.length)
    };
  }

  /**
   * 自然言語品質のチェック
   */
  checkNaturalLanguageQuality($) {
    const issues = [];
    const recommendations = [];

    const textContent = $('body').text();
    
    // 読みやすさのチェック
    const sentences = textContent.split(/[。！？]/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length;

    if (avgSentenceLength > 50) {
      issues.push('文章が長すぎます');
      recommendations.push('文章を短く、読みやすくしてください');
    }

    // 専門用語の使用チェック
    const technicalTerms = textContent.match(/[A-Z]{2,}|[a-z]+[A-Z][a-z]+/g) || [];
    if (technicalTerms.length > 10) {
      issues.push('専門用語が多すぎます');
      recommendations.push('専門用語を減らし、一般的な言葉で説明してください');
    }

    // 受動態の使用チェック
    const passiveVoice = textContent.match(/される|られる|された|られた/g) || [];
    if (passiveVoice.length > sentences.length * 0.3) {
      issues.push('受動態が多すぎます');
      recommendations.push('能動態を多用して、より自然な文章にしてください');
    }

    // 接続詞の使用チェック
    const conjunctions = textContent.match(/しかし|また|さらに|そのため|なぜなら/g) || [];
    if (conjunctions.length < 3) {
      issues.push('接続詞が少なすぎます');
      recommendations.push('文章の流れを良くするため接続詞を追加してください');
    }

    return {
      avgSentenceLength: Math.round(avgSentenceLength),
      technicalTermsCount: technicalTerms.length,
      passiveVoiceCount: passiveVoice.length,
      conjunctionsCount: conjunctions.length,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateNaturalLanguageScore(avgSentenceLength, technicalTerms.length, passiveVoice.length, conjunctions.length)
    };
  }

  /**
   * コンテキスト関連性のチェック
   */
  checkContextRelevance($, url) {
    const issues = [];
    const recommendations = [];

    // URLが空の場合はスキップ
    if (!url || url.trim() === '') {
      return { issues, recommendations, score: 100 };
    }

    let urlRelevance = 1;
    let internalLinks = [];
    let relevantInternalLinks = 0;

    try {
      // URLとコンテンツの関連性チェック
      const urlPath = new URL(url).pathname;
      const urlKeywords = urlPath.split('/').filter(segment => segment.length > 2);
      
      const contentText = $('body').text().toLowerCase();
      urlRelevance = urlKeywords.filter(keyword => 
        contentText.includes(keyword.toLowerCase())
      ).length / Math.max(urlKeywords.length, 1);

      if (urlRelevance < 0.5) {
        issues.push('URLとコンテンツの関連性が低いです');
        recommendations.push('URLとコンテンツの関連性を高めてください');
      }

      // 内部リンクの関連性チェック
      internalLinks = $('a[href^="/"], a[href*="' + new URL(url).hostname + '"]');
      relevantInternalLinks = internalLinks.filter((i, el) => {
        const linkText = $(el).text().toLowerCase();
        return urlKeywords.some(keyword => linkText.includes(keyword.toLowerCase()));
      }).length;
    } catch (e) {
      // URLが無効な場合はスキップ
      return { issues, recommendations, score: 100 };
    }

    if (internalLinks.length > 0 && relevantInternalLinks / internalLinks.length < 0.3) {
      issues.push('内部リンクの関連性が低いです');
      recommendations.push('より関連性の高い内部リンクを追加してください');
    }

    // カテゴリ・タグの存在チェック
    const categories = $('.category, .tag, [rel="tag"], .breadcrumb').length;
    if (categories === 0) {
      issues.push('カテゴリやタグがありません');
      recommendations.push('コンテンツの分類を追加してください');
    }

    return {
      urlRelevance: Math.round(urlRelevance * 100),
      internalLinksCount: internalLinks.length,
      relevantInternalLinks: relevantInternalLinks,
      categoriesCount: categories,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateContextRelevanceScore(urlRelevance, relevantInternalLinks, categories)
    };
  }

  /**
   * スコア計算メソッド群 (Phase 1.6: 区分線形化)
   *
   * 旧実装は閾値ベースの加点 (例: wordCount >= 300 で +30) で、
   * 「閾値を1超えた瞬間に大幅加点」「逆に1足りないと0点」の不連続性があった。
   * Phase 1.6 で全関数を区分線形 (piecewise linear) に書き換え、
   * 滑らかに 0〜100 で評価できるようにする。
   *
   * SEOChecker.piecewiseLinearScore と同一仕様だが、aio-checker は SEOChecker と
   * 独立クラスのため、ここでも同じヘルパーを定義する（重複は許容）。
   */

  /**
   * 区分線形スコアリングの汎用ヘルパー (Phase 1.6)
   * @param {number} value - 評価対象の値
   * @param {Array<{x: number, score: number}>} points - 区分点の配列（x昇順）
   * @returns {number} 整数化されたスコア (端点では端点 score、中間は線形補間)
   */
  piecewiseLinearScore(value, points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    if (typeof value !== 'number' || isNaN(value)) return 0;
    if (value <= points[0].x) return Math.round(points[0].score);
    if (value >= points[points.length - 1].x) return Math.round(points[points.length - 1].score);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (value >= a.x && value <= b.x) {
        const t = (b.x === a.x) ? 0 : (value - a.x) / (b.x - a.x);
        return Math.round(a.score + (b.score - a.score) * t);
      }
    }
    return 0;
  }

  /**
   * コンテンツ包括性スコア (Phase 1.6)
   *
   * - wordCount: 800-2000語が理想、極端に短い/長いと減点
   * - paragraphCount: 段落構成（3-7が理想）
   * - listCount: 構造化要素として箇条書きが1個以上
   * - ratio: 見出し当たりの本文密度（200-400が理想）
   */
  calculateComprehensivenessScore(wordCount, paragraphCount, listCount, ratio) {
    // wordCount: 35点満点（旧30）
    const wordScore = this.piecewiseLinearScore(wordCount, [
      { x: 0,    score: 0 },
      { x: 100,  score: 8 },
      { x: 300,  score: 22 },
      { x: 500,  score: 30 },
      { x: 800,  score: 35 },   // 理想開始
      { x: 2000, score: 35 },   // 理想終了
      { x: 3000, score: 28 },
      { x: 5000, score: 20 },   // 長すぎ
      { x: 10000, score: 15 },
    ]);

    // paragraphCount: 25点満点
    const paragraphScore = this.piecewiseLinearScore(paragraphCount, [
      { x: 0, score: 0 },
      { x: 1, score: 5 },
      { x: 2, score: 12 },
      { x: 3, score: 20 },
      { x: 5, score: 25 },
      { x: 20, score: 25 },
    ]);

    // listCount: 15点満点
    const listScore = this.piecewiseLinearScore(listCount, [
      { x: 0, score: 0 },
      { x: 1, score: 10 },
      { x: 3, score: 15 },
      { x: 10, score: 15 },
    ]);

    // ratio (見出し当たりの語数): 25点満点
    const ratioScore = this.piecewiseLinearScore(ratio, [
      { x: 0,   score: 0 },
      { x: 50,  score: 10 },
      { x: 100, score: 18 },
      { x: 200, score: 25 },  // 理想開始
      { x: 400, score: 25 },  // 理想終了
      { x: 600, score: 20 },
      { x: 1000, score: 15 },
    ]);

    return Math.min(wordScore + paragraphScore + listScore + ratioScore, 100);
  }

  /**
   * 構造化情報スコア (Phase 1.6)
   * - jsonLd: 1個で大きく加点、複数あればボーナス
   * - faqElements: FAQ Q&Aペア数
   * - definitionLists: 定義リスト
   */
  calculateStructuredInfoScore(structuredData, faqElements, definitionLists) {
    // jsonLd: 40点満点
    const jsonLdCount = (structuredData.jsonLd && structuredData.jsonLd.length) || 0;
    const jsonLdScore = this.piecewiseLinearScore(jsonLdCount, [
      { x: 0, score: 0 },
      { x: 1, score: 28 },
      { x: 2, score: 35 },
      { x: 3, score: 40 },
      { x: 10, score: 40 },
    ]);

    // faqElements: 30点満点
    const faqScore = this.piecewiseLinearScore(faqElements, [
      { x: 0, score: 0 },
      { x: 1, score: 18 },
      { x: 3, score: 26 },
      { x: 5, score: 30 },
      { x: 20, score: 30 },
    ]);

    // definitionLists: 30点満点
    const defScore = this.piecewiseLinearScore(definitionLists, [
      { x: 0, score: 0 },
      { x: 1, score: 18 },
      { x: 3, score: 26 },
      { x: 5, score: 30 },
      { x: 20, score: 30 },
    ]);

    return Math.min(jsonLdScore + faqScore + defScore, 100);
  }

  /**
   * 信頼性シグナルスコア (Phase 1.6)
   * 旧実装は5項目それぞれ20点（あるか/ないかの2択）でON/OFFが粗かった。
   * Phase 1.6では「複数あるほど信頼性が高まる」項目は段階的に評価する。
   */
  calculateCredibilityScore(authorInfo, dateInfo, citations, highAuthorityLinks, contactInfo) {
    // authorInfo: 20点満点（あるかないかが本質）
    const authorScore = this.piecewiseLinearScore(authorInfo, [
      { x: 0, score: 0 },
      { x: 1, score: 20 },
      { x: 5, score: 20 },
    ]);

    // dateInfo: 20点満点（同じく）
    const dateScore = this.piecewiseLinearScore(dateInfo, [
      { x: 0, score: 0 },
      { x: 1, score: 20 },
      { x: 5, score: 20 },
    ]);

    // citations: 20点満点（多いほど良い）
    const citScore = this.piecewiseLinearScore(citations, [
      { x: 0, score: 0 },
      { x: 1, score: 10 },
      { x: 3, score: 16 },
      { x: 5, score: 20 },
      { x: 30, score: 20 },
    ]);

    // highAuthorityLinks: 20点満点（多いほど良い）
    const haScore = this.piecewiseLinearScore(highAuthorityLinks, [
      { x: 0, score: 0 },
      { x: 1, score: 10 },
      { x: 3, score: 16 },
      { x: 5, score: 20 },
      { x: 30, score: 20 },
    ]);

    // contactInfo: 20点満点（あるかないか）
    const contactScore = this.piecewiseLinearScore(contactInfo, [
      { x: 0, score: 0 },
      { x: 1, score: 20 },
      { x: 5, score: 20 },
    ]);

    return Math.min(authorScore + dateScore + citScore + haScore + contactScore, 100);
  }

  /**
   * AI検索最適化スコア (Phase 1.6)
   * - questionPatterns: 疑問形の見出し/本文
   * - hasComparison: 比較・対比のコンテンツ（boolean）
   * - stepPatterns: ステップ形式の手順
   * - numericDataCount: 具体的な数値データ
   */
  calculateAISearchScore(questionPatterns, hasComparison, stepPatterns, numericDataCount) {
    // questionPatterns: 25点満点
    const qScore = this.piecewiseLinearScore(questionPatterns, [
      { x: 0, score: 0 },
      { x: 1, score: 15 },
      { x: 3, score: 22 },
      { x: 5, score: 25 },
      { x: 30, score: 25 },
    ]);

    // hasComparison: 25点満点（boolean なので 0 or 25）
    const cScore = hasComparison ? 25 : 0;

    // stepPatterns: 25点満点
    const sScore = this.piecewiseLinearScore(stepPatterns, [
      { x: 0, score: 0 },
      { x: 1, score: 15 },
      { x: 3, score: 22 },
      { x: 5, score: 25 },
      { x: 30, score: 25 },
    ]);

    // numericDataCount: 25点満点
    const nScore = this.piecewiseLinearScore(numericDataCount, [
      { x: 0, score: 0 },
      { x: 1, score: 10 },
      { x: 3, score: 20 },
      { x: 5, score: 25 },
      { x: 50, score: 25 },
    ]);

    return Math.min(qScore + cScore + sScore + nScore, 100);
  }

  /**
   * 自然言語品質スコア (Phase 1.6)
   * 100点満点から段階的に減点。閾値超えの瞬間に-20ではなく、滑らかに減点する。
   */
  calculateNaturalLanguageScore(avgSentenceLength, technicalTerms, passiveVoice, conjunctions) {
    // 文長ペナルティ（最大-25）
    // 短い文章(30字以下)は減点なし、50字超で減点開始、80字超は大幅減点
    const lengthPenalty = this.piecewiseLinearScore(avgSentenceLength, [
      { x: 0,  score: 0 },
      { x: 30, score: 0 },    // 短文は減点なし
      { x: 50, score: -15 },  // 標準を超える
      { x: 80, score: -25 },  // 明らかに長文
      { x: 200, score: -25 },
    ]);

    // 専門用語ペナルティ（最大-25）
    const termPenalty = this.piecewiseLinearScore(technicalTerms, [
      { x: 0,   score: 0 },
      { x: 5,   score: 0 },
      { x: 10,  score: -10 },
      { x: 20,  score: -25 },
      { x: 100, score: -25 },
    ]);

    // 受動態ペナルティ（最大-25）
    const passivePenalty = this.piecewiseLinearScore(passiveVoice, [
      { x: 0,  score: 0 },
      { x: 2,  score: 0 },
      { x: 5,  score: -10 },
      { x: 10, score: -25 },
      { x: 50, score: -25 },
    ]);

    // 接続詞ペナルティ（最大-25）
    // 「少ないほど減点」なので x を反転させて適用
    // conjunctions=0 → -25, 3 → -10, 5+ → 0
    let conjPenalty;
    if (conjunctions >= 5) conjPenalty = 0;
    else if (conjunctions >= 3) conjPenalty = -10 + ((conjunctions - 3) / 2) * 10;
    else if (conjunctions >= 1) conjPenalty = -25 + ((conjunctions - 1) / 2) * 15;
    else conjPenalty = -25;
    conjPenalty = Math.round(conjPenalty);

    const score = 100 + lengthPenalty + termPenalty + passivePenalty + conjPenalty;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * コンテキスト関連性スコア (Phase 1.6)
   * - urlRelevance: URLとコンテンツの一致度 (0.0-1.0)
   * - relevantInternalLinks: 関連する内部リンク数
   * - categories: カテゴリ/タグの数
   */
  calculateContextRelevanceScore(urlRelevance, relevantInternalLinks, categories) {
    // urlRelevance: 40点満点
    const urlScore = this.piecewiseLinearScore(urlRelevance, [
      { x: 0,   score: 0 },
      { x: 0.2, score: 15 },
      { x: 0.5, score: 30 },
      { x: 0.7, score: 40 },
      { x: 1.0, score: 40 },
    ]);

    // relevantInternalLinks: 30点満点
    const linkScore = this.piecewiseLinearScore(relevantInternalLinks, [
      { x: 0,  score: 0 },
      { x: 1,  score: 15 },
      { x: 3,  score: 25 },
      { x: 5,  score: 30 },
      { x: 30, score: 30 },
    ]);

    // categories: 30点満点
    const catScore = this.piecewiseLinearScore(categories, [
      { x: 0,  score: 0 },
      { x: 1,  score: 20 },
      { x: 3,  score: 30 },
      { x: 10, score: 30 },
    ]);

    return Math.min(urlScore + linkScore + catScore, 100);
  }

  calculateAIOOverallScore(checks) {
    // Phase 2-A.1: 旧 impactScores の比率を維持しつつ llms.txt 15% を追加。
    //
    // 旧6カテゴリの impactScores 比率 (合計100):
    //   structuredInformation:    25
    //   contentComprehensiveness: 20
    //   aiSearchOptimization:     20
    //   credibilitySignals:       15
    //   naturalLanguageQuality:   10
    //   contextRelevance:         10
    //
    // これらを 85% に比例押し込み + llmsTxtCompliance 15% で合計100%にする:
    //   structuredInformation:    25 * 0.85 = 21.25 → 0.2125
    //   contentComprehensiveness: 20 * 0.85 = 17.00 → 0.17
    //   aiSearchOptimization:     20 * 0.85 = 17.00 → 0.17
    //   credibilitySignals:       15 * 0.85 = 12.75 → 0.1275
    //   naturalLanguageQuality:   10 * 0.85 =  8.50 → 0.085
    //   contextRelevance:         10 * 0.85 =  8.50 → 0.085
    //   llmsTxtCompliance:                              0.15
    //   ─────────────────────────────────────────────────
    //   合計                                            1.00
    //
    // これにより「構造化情報が AIO で最も重要」という旧設計の意図を保ちつつ、
    // 2025年最先端の AIO シグナルである llms.txt も適切に反映できる。
    const weights = {
      contentComprehensiveness: 0.17,
      structuredInformation:    0.2125,
      credibilitySignals:       0.1275,
      aiSearchOptimization:     0.17,
      naturalLanguageQuality:   0.085,
      contextRelevance:         0.085,
      llmsTxtCompliance:        0.15
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      // 該当チェックが無い・skipされた場合は0扱いで影響しないようにする
      const item = checks[key];
      if (!item || typeof item.score !== 'number') continue;
      totalScore += item.score * weight;
    }

    return Math.round(totalScore);
  }

  generateAIORecommendations(checks) {
    const recommendations = [];
    
    for (const [key, check] of Object.entries(checks)) {
      if (check.recommendations && check.recommendations.length > 0) {
        recommendations.push({
          category: key,
          recommendations: check.recommendations
        });
      }
    }

    return recommendations;
  }

  /**
   * 高権威ドメインの判定
   */
  isHighAuthorityDomain(domain) {
    const highAuthorityDomains = [
      'wikipedia.org',
      'google.com',
      'microsoft.com',
      'apple.com',
      'amazon.com',
      'facebook.com',
      'twitter.com',
      'linkedin.com',
      'youtube.com',
      'github.com',
      'stackoverflow.com',
      'reddit.com',
      'medium.com',
      'techcrunch.com',
      'wired.com',
      'nytimes.com',
      'bbc.com',
      'cnn.com',
      'reuters.com',
      'bloomberg.com'
    ];

    return highAuthorityDomains.some(authDomain => 
      domain.includes(authDomain)
    );
  }
}

module.exports = AIOChecker;
