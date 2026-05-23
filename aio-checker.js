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
   * スコア計算メソッド群
   */
  calculateComprehensivenessScore(wordCount, paragraphCount, listCount, ratio) {
    let score = 0;
    
    if (wordCount >= 300 && wordCount <= 3000) score += 30;
    if (paragraphCount >= 3) score += 20;
    if (listCount > 0) score += 20;
    if (ratio >= 100 && ratio <= 500) score += 30;
    
    return Math.min(score, 100);
  }

  calculateStructuredInfoScore(structuredData, faqElements, definitionLists) {
    let score = 0;
    
    if (structuredData.jsonLd.length > 0) score += 40;
    if (faqElements > 0) score += 30;
    if (definitionLists > 0) score += 30;
    
    return Math.min(score, 100);
  }

  calculateCredibilityScore(authorInfo, dateInfo, citations, highAuthorityLinks, contactInfo) {
    let score = 0;
    
    if (authorInfo > 0) score += 20;
    if (dateInfo > 0) score += 20;
    if (citations > 0) score += 20;
    if (highAuthorityLinks > 0) score += 20;
    if (contactInfo > 0) score += 20;
    
    return Math.min(score, 100);
  }

  calculateAISearchScore(questionPatterns, hasComparison, stepPatterns, numericDataCount) {
    let score = 0;
    
    if (questionPatterns > 0) score += 25;
    if (hasComparison) score += 25;
    if (stepPatterns > 0) score += 25;
    if (numericDataCount >= 3) score += 25;
    
    return Math.min(score, 100);
  }

  calculateNaturalLanguageScore(avgSentenceLength, technicalTerms, passiveVoice, conjunctions) {
    let score = 100;
    
    if (avgSentenceLength > 50) score -= 20;
    if (technicalTerms > 10) score -= 20;
    if (passiveVoice > 5) score -= 20;
    if (conjunctions < 3) score -= 20;
    
    return Math.max(score, 0);
  }

  calculateContextRelevanceScore(urlRelevance, relevantInternalLinks, categories) {
    let score = 0;
    
    if (urlRelevance >= 0.5) score += 40;
    if (relevantInternalLinks > 0) score += 30;
    if (categories > 0) score += 30;
    
    return Math.min(score, 100);
  }

  calculateAIOOverallScore(checks) {
    // Phase 2-A: llms.txt 対応を15%の比重で追加。残り85%を既存カテゴリへ比例配分。
    const weights = {
      contentComprehensiveness: 0.17,
      structuredInformation: 0.17,
      credibilitySignals: 0.17,
      aiSearchOptimization: 0.17,
      naturalLanguageQuality: 0.09,
      contextRelevance: 0.08,
      llmsTxtCompliance: 0.15,
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
