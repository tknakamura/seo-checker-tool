/**
 * 詳細レポート生成機能
 * 改善提案の優先度、具体的な実装方法、期待される効果を含む包括的なレポートを生成
 */
class EnhancedReporter {
  constructor() {
    this.priorityWeights = {
      critical: 100,    // 即座に対応が必要
      high: 80,         // 1週間以内に対応
      medium: 60,       // 1ヶ月以内に対応
      low: 40           // 3ヶ月以内に対応
    };
    
    this.impactScores = {
      seo: {
        titleTag: 25,
        metaDescription: 20,
        headingStructure: 15,
        imageAltAttributes: 10,
        internalLinkStructure: 15,
        structuredData: 10,
        otherSEOElements: 5
      },
      aio: {
        contentComprehensiveness: 20,
        structuredInformation: 25,
        credibilitySignals: 15,
        aiSearchOptimization: 20,
        naturalLanguageQuality: 10,
        contextRelevance: 10
      }
    };
  }

  /**
   * 詳細レポートの生成
   * @param {Object} results - SEO・AIOチェック結果
   * @returns {Object} 詳細レポート
   */
  generateDetailedReport(results) {
    const report = {
      summary: this.generateSummary(results),
      priorityAnalysis: this.generatePriorityAnalysis(results),
      implementationPlan: this.generateImplementationPlan(results),
      benchmarkComparison: this.generateBenchmarkComparison(results),
      expectedImpact: this.generateExpectedImpact(results),
      detailedRecommendations: this.generateDetailedRecommendations(results)
    };

    return report;
  }

  /**
   * サマリー生成
   */
  generateSummary(results) {
    const { overallScore, aioOverallScore, combinedScore } = results;
    
    const seoGrade = this.getGrade(overallScore);
    const aioGrade = this.getGrade(aioOverallScore);
    const combinedGrade = this.getGrade(combinedScore);

    const criticalIssues = this.countCriticalIssues(results);
    const highPriorityIssues = this.countHighPriorityIssues(results);
    const totalIssues = this.countTotalIssues(results);

    return {
      overallScore: combinedScore,
      seoScore: overallScore,
      aioScore: aioOverallScore,
      grades: {
        overall: combinedGrade,
        seo: seoGrade,
        aio: aioGrade
      },
      issueCounts: {
        critical: criticalIssues,
        high: highPriorityIssues,
        total: totalIssues
      },
      status: this.getOverallStatus(combinedScore, criticalIssues),
      quickWins: this.identifyQuickWins(results)
    };
  }

  /**
   * 優先度分析
   */
  generatePriorityAnalysis(results) {
    const priorities = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    // SEO項目の優先度分析
    Object.entries(results.checks).forEach(([key, check]) => {
      if (check.issues && check.issues.length > 0) {
        const priority = this.calculatePriority(key, check, 'seo');
        const impact = this.calculateImpact(key, check, 'seo');
        const effort = this.calculateEffort(key, check);
        
        priorities[priority].push({
          category: key,
          type: 'seo',
          issues: check.issues,
          recommendations: check.recommendations,
          impact: impact,
          effort: effort,
          roi: impact / effort
        });
      }
    });

    // AIO項目の優先度分析
    if (results.aio && results.aio.checks) {
      Object.entries(results.aio.checks).forEach(([key, check]) => {
        if (check.issues && check.issues.length > 0) {
          const priority = this.calculatePriority(key, check, 'aio');
          const impact = this.calculateImpact(key, check, 'aio');
          const effort = this.calculateEffort(key, check);
          
          priorities[priority].push({
            category: key,
            type: 'aio',
            issues: check.issues,
            recommendations: check.recommendations,
            impact: impact,
            effort: effort,
            roi: impact / effort
          });
        }
      });
    }

    return priorities;
  }

  /**
   * 実装計画の生成
   */
  generateImplementationPlan(results) {
    const plan = {
      phase1: { // 即座に対応（1週間以内）
        title: "緊急対応項目",
        duration: "1週間以内",
        items: []
      },
      phase2: { // 短期対応（1ヶ月以内）
        title: "短期改善項目",
        duration: "1ヶ月以内",
        items: []
      },
      phase3: { // 中期対応（3ヶ月以内）
        title: "中期改善項目",
        duration: "3ヶ月以内",
        items: []
      },
      phase4: { // 長期対応（6ヶ月以内）
        title: "長期改善項目",
        duration: "6ヶ月以内",
        items: []
      }
    };

    const priorityAnalysis = this.generatePriorityAnalysis(results);
    
    // 優先度に基づいて実装計画に振り分け
    plan.phase1.items = priorityAnalysis.critical.map(item => 
      this.createImplementationItem(item, 'critical')
    );
    plan.phase2.items = priorityAnalysis.high.map(item => 
      this.createImplementationItem(item, 'high')
    );
    plan.phase3.items = priorityAnalysis.medium.map(item => 
      this.createImplementationItem(item, 'medium')
    );
    plan.phase4.items = priorityAnalysis.low.map(item => 
      this.createImplementationItem(item, 'low')
    );

    return plan;
  }

  /**
   * ベンチマーク比較
   */
  generateBenchmarkComparison(results) {
    const benchmarks = {
      industry: {
        ecommerce: { seo: 75, aio: 70 },
        content: { seo: 80, aio: 75 },
        corporate: { seo: 70, aio: 65 }
      },
      competitors: {
        average: { seo: 78, aio: 72 },
        top10: { seo: 85, aio: 80 }
      }
    };

    const comparison = {
      seo: {
        current: results.overallScore,
        industry: benchmarks.industry.ecommerce.seo,
        competitors: benchmarks.competitors.average.seo,
        top10: benchmarks.competitors.top10.seo,
        gap: results.overallScore - benchmarks.competitors.average.seo
      },
      aio: {
        current: results.aioOverallScore,
        industry: benchmarks.industry.ecommerce.aio,
        competitors: benchmarks.competitors.average.aio,
        top10: benchmarks.competitors.top10.aio,
        gap: results.aioOverallScore - benchmarks.competitors.average.aio
      }
    };

    return comparison;
  }

  /**
   * 期待される効果
   */
  generateExpectedImpact(results) {
    const currentScore = results.combinedScore;
    const potentialScore = this.calculatePotentialScore(results);
    const improvement = potentialScore - currentScore;

    return {
      currentScore: currentScore,
      potentialScore: potentialScore,
      improvement: improvement,
      expectedBenefits: {
        seo: {
          organicTraffic: this.calculateTrafficImpact(improvement, 'seo'),
          rankingImprovement: this.calculateRankingImpact(improvement),
          clickThroughRate: this.calculateCTRImpact(improvement)
        },
        aio: {
          aiVisibility: this.calculateAIVisibilityImpact(improvement),
          aiCitations: this.calculateAICitationsImpact(improvement),
          aiSearchRanking: this.calculateAISearchRankingImpact(improvement)
        }
      },
      timeline: {
        immediate: "1-2週間: 技術的改善の効果",
        shortTerm: "1-2ヶ月: 検索エンジン認識の改善",
        longTerm: "3-6ヶ月: 持続的なトラフィック増加"
      }
    };
  }

  /**
   * 詳細な推奨事項（構造化データ実装例付き）
   */
  generateDetailedRecommendations(results) {
    const recommendations = [];

    // SEO推奨事項
    Object.entries(results.checks).forEach(([key, check]) => {
      if (check.issues && check.issues.length > 0) {
        let implementation = this.getImplementationGuide(key, 'seo');
        let examples = this.getExamples(key, 'seo');
        
        // 構造化データの場合、新機能の結果を活用
        if (key === 'structuredData' && check.implementationExamples) {
          implementation = this.getEnhancedStructuredDataImplementation(check, results);
          examples = this.getEnhancedStructuredDataExamples(check, results);
        }

        recommendations.push({
          category: key,
          type: 'seo',
          priority: this.calculatePriority(key, check, 'seo'),
          issues: check.issues,
          recommendations: check.recommendations,
          implementation: implementation,
          examples: examples,
          tools: this.getRecommendedTools(key, 'seo'),
          metrics: this.getSuccessMetrics(key, 'seo'),
          // 新機能：構造化データの詳細情報
          ...(key === 'structuredData' && {
            pageTypeAnalysis: check.pageTypeAnalysis,
            structuredDataRecommendations: check.structuredDataRecommendations,
            implementationExamples: check.implementationExamples
          })
        });
      }
    });

    // AIO推奨事項
    if (results.aio && results.aio.checks) {
      Object.entries(results.aio.checks).forEach(([key, check]) => {
        if (check.issues && check.issues.length > 0) {
          recommendations.push({
            category: key,
            type: 'aio',
            priority: this.calculatePriority(key, check, 'aio'),
            issues: check.issues,
            recommendations: check.recommendations,
            implementation: this.getImplementationGuide(key, 'aio'),
            examples: this.getExamples(key, 'aio'),
            tools: this.getRecommendedTools(key, 'aio'),
            metrics: this.getSuccessMetrics(key, 'aio')
          });
        }
      });
    }

    return recommendations.sort((a, b) => 
      this.priorityWeights[b.priority] - this.priorityWeights[a.priority]
    );
  }

  /**
   * 拡張された構造化データ実装ガイドを生成
   */
  getEnhancedStructuredDataImplementation(structuredDataCheck, results) {
    const implementation = [];

    // ページタイプ分析結果
    if (structuredDataCheck.pageTypeAnalysis) {
      const analysis = structuredDataCheck.pageTypeAnalysis;
      implementation.push({
        step: 1,
        title: 'ページタイプの確認',
        description: `このページは「${this.getPageTypeDisplayName(analysis.primaryType)}」として分析されました（信頼度: ${Math.round(analysis.confidence * 100)}%）`,
        details: [
          `主要タイプ: ${analysis.primaryType}`,
          `候補タイプ: ${analysis.secondaryTypes ? analysis.secondaryTypes.join(', ') : 'なし'}`,
          `分析根拠: ${this.getAnalysisReason(analysis)}`
        ]
      });
    }

    // 推奨スキーマの実装
    if (structuredDataCheck.structuredDataRecommendations) {
      const recommendations = structuredDataCheck.structuredDataRecommendations;
      
      if (recommendations.recommendations.missing.length > 0) {
        implementation.push({
          step: 2,
          title: '必須スキーマの実装',
          description: '以下のスキーマは必須です。優先的に実装してください。',
          details: recommendations.recommendations.missing.map(item => ({
            schema: item.schema,
            reason: item.reason,
            priority: item.priority,
            impact: item.impact,
            seoValue: item.seoValue
          }))
        });
      }

      if (recommendations.recommendations.improvements.length > 0) {
        implementation.push({
          step: 3,
          title: '推奨スキーマの実装',
          description: '以下のスキーマを追加することでSEO効果が向上します。',
          details: recommendations.recommendations.improvements.map(item => ({
            schema: item.schema,
            reason: item.reason,
            priority: item.priority,
            impact: item.impact
          }))
        });
      }
    }

    // 具体的な実装例
    if (structuredDataCheck.implementationExamples && structuredDataCheck.implementationExamples.immediate) {
      implementation.push({
        step: 4,
        title: '具体的な実装',
        description: '以下のJSON-LDコードを<head>セクションに追加してください。',
        codeExamples: structuredDataCheck.implementationExamples.immediate.map(example => ({
          schema: example.schema,
          title: example.title,
          code: this.formatJsonLd(example.jsonLd),
          validation: example.validation
        }))
      });
    }

    // 検証手順
    implementation.push({
      step: 5,
      title: '検証と確認',
      description: '実装後は以下のツールで必ず検証してください。',
      validationSteps: [
        {
          tool: 'Google構造化データテストツール',
          url: 'https://search.google.com/test/rich-results',
          description: 'Googleでの認識確認'
        },
        {
          tool: 'Schema.org Validator',
          url: 'https://validator.schema.org/',
          description: 'スキーマ仕様の準拠確認'
        },
        {
          tool: 'Google Search Console',
          description: '実装後の効果測定'
        }
      ]
    });

    return implementation;
  }

  /**
   * 拡張された構造化データ実装例を生成
   */
  getEnhancedStructuredDataExamples(structuredDataCheck, results) {
    const examples = [];

    // 基本実装例
    if (structuredDataCheck.implementationExamples && structuredDataCheck.implementationExamples.immediate) {
      structuredDataCheck.implementationExamples.immediate.forEach(example => {
        examples.push({
          type: 'immediate',
          title: `${example.schema}スキーマの実装例`,
          description: `${example.title}`,
          code: this.formatJsonLdForDisplay(example.jsonLd),
          estimatedTime: this.getEstimatedImplementationTime(example.schema),
          benefits: this.getImplementationBenefits(example.schema)
        });
      });
    }

    // 詳細実装ガイド例
    if (structuredDataCheck.implementationExamples && structuredDataCheck.implementationExamples.detailed) {
      structuredDataCheck.implementationExamples.detailed.forEach(guide => {
        if (guide.codeExample) {
          examples.push({
            type: 'detailed',
            title: guide.title,
            description: guide.description,
            code: guide.codeExample,
            requiredFields: guide.requiredFields || [],
            confidence: guide.confidence || 0
          });
        }
      });
    }

    // ビジネス特化型の例
    if (structuredDataCheck.structuredDataRecommendations && 
        structuredDataCheck.structuredDataRecommendations.businessSpecific.length > 0) {
      structuredDataCheck.structuredDataRecommendations.businessSpecific.forEach(specific => {
        examples.push({
          type: 'business_specific',
          title: `${specific.type}向け最適化`,
          description: specific.description,
          suggestion: specific.suggestion,
          implementation: specific.implementation
        });
      });
    }

    return examples;
  }

  /**
   * JSON-LDをフォーマット
   */
  formatJsonLd(jsonLd) {
    if (!jsonLd) return '';
    
    try {
      return JSON.stringify(jsonLd, null, 2);
    } catch (error) {
      return String(jsonLd);
    }
  }

  /**
   * JSON-LDを表示用にフォーマット
   */
  formatJsonLdForDisplay(jsonLd) {
    const formatted = this.formatJsonLd(jsonLd);
    return `<script type="application/ld+json">\n${formatted}\n</script>`;
  }

  /**
   * ページタイプの表示名を取得
   */
  getPageTypeDisplayName(pageType) {
    const displayNames = {
      Article: '記事・ブログ',
      Product: '商品ページ',
      LocalBusiness: '店舗・企業',
      Recipe: 'レシピ',
      Event: 'イベント',
      FAQ: 'よくある質問',
      HowTo: '手順・ガイド',
      Review: 'レビュー',
      JobPosting: '求人情報',
      Course: 'コース・講座'
    };
    
    return displayNames[pageType] || pageType;
  }

  /**
   * 分析理由を取得
   */
  getAnalysisReason(analysis) {
    if (analysis.analysisDetails && analysis.analysisDetails.matchedPatterns) {
      const patterns = analysis.analysisDetails.matchedPatterns;
      const reasons = [];
      
      if (patterns.keywords && patterns.keywords.length > 0) {
        reasons.push(`キーワード: ${patterns.keywords.slice(0, 3).join(', ')}`);
      }
      if (patterns.titlePatterns && patterns.titlePatterns.length > 0) {
        reasons.push(`タイトルパターン: ${patterns.titlePatterns.slice(0, 2).join(', ')}`);
      }
      if (patterns.urlPatterns && patterns.urlPatterns.length > 0) {
        reasons.push(`URLパターン: ${patterns.urlPatterns.slice(0, 2).join(', ')}`);
      }
      
      return reasons.join(', ') || '内容分析による判定';
    }
    
    return '内容分析による判定';
  }

  /**
   * 実装時間の見積もりを取得
   */
  getEstimatedImplementationTime(schema) {
    const times = {
      Article: '30分',
      Product: '1-2時間',
      LocalBusiness: '1時間',
      Recipe: '2-3時間',
      Event: '1時間',
      FAQPage: '30分',
      HowTo: '2-3時間',
      Review: '30分',
      JobPosting: '1時間',
      Course: '1-2時間'
    };
    
    return times[schema] || '1時間';
  }

  /**
   * 実装メリットを取得
   */
  getImplementationBenefits(schema) {
    const benefits = {
      Article: [
        'Googleニュースでの露出向上',
        'リッチスニペット表示の可能性',
        'author情報の表示'
      ],
      Product: [
        '商品リッチスニペット表示',
        '価格・在庫情報の表示',
        'レビュー星評価の表示'
      ],
      LocalBusiness: [
        'Googleマップでの表示改善',
        '営業時間の表示',
        'ローカル検索での上位表示'
      ],
      Recipe: [
        'レシピリッチスニペット表示',
        '調理時間・カロリー表示',
        'レシピ検索での優遇'
      ]
    };
    
    return benefits[schema] || ['SEO効果の向上', '検索結果での目立ち度アップ'];
  }

  /**
   * 簡潔な推奨アクション生成
   */
  generateConciseRecommendations(results) {
    const recommendations = [];

    // SEO推奨事項
    Object.entries(results.checks).forEach(([key, check]) => {
      if (check.issues && check.issues.length > 0) {
        const conciseIssues = this.getConciseIssues(check.issues, key);
        conciseIssues.forEach(issue => {
          recommendations.push({
            category: key,
            type: 'seo',
            priority: this.calculatePriority(key, check, 'seo'),
            issue: issue.description,
            element: issue.element,
            location: issue.location,
            fix: issue.fix,
            count: issue.count || 1
          });
        });
      }
    });

    // AIO推奨事項
    if (results.aio && results.aio.checks) {
      Object.entries(results.aio.checks).forEach(([key, check]) => {
        if (check.issues && check.issues.length > 0) {
          const conciseIssues = this.getConciseIssues(check.issues, key);
          conciseIssues.forEach(issue => {
            recommendations.push({
              category: key,
              type: 'aio',
              priority: this.calculatePriority(key, check, 'aio'),
              issue: issue.description,
              element: issue.element,
              location: issue.location,
              fix: issue.fix,
              count: issue.count || 1
            });
          });
        }
      });
    }

    return recommendations.sort((a, b) => 
      this.priorityWeights[b.priority] - this.priorityWeights[a.priority]
    );
  }

  /**
   * 簡潔な問題点の取得
   */
  getConciseIssues(issues, category) {
    const conciseIssues = [];
    const issueGroups = {};

    // 問題をグループ化
    issues.forEach(issue => {
      const key = this.getIssueKey(issue, category);
      if (!issueGroups[key]) {
        issueGroups[key] = {
          description: issue,
          element: this.getElementName(category),
          location: this.getLocationName(category),
          fix: this.getConciseFix(issue, category),
          count: 0
        };
      }
      issueGroups[key].count++;
    });

    // グループ化された問題を配列に変換
    Object.values(issueGroups).forEach(issue => {
      if (issue.count > 1) {
        issue.description = `${issue.description} (${issue.count}件)`;
      }
      conciseIssues.push(issue);
    });

    return conciseIssues;
  }

  /**
   * 問題のキーを取得
   */
  getIssueKey(issue, category) {
    // 同じような問題をグループ化するためのキーを生成
    if (issue.includes('タイトルが短すぎます') || issue.includes('タイトルが長すぎます')) {
      return 'title_length';
    }
    if (issue.includes('メタディスクリプションが短すぎます') || issue.includes('メタディスクリプションが長すぎます')) {
      return 'meta_length';
    }
    if (issue.includes('alt属性がありません')) {
      return 'missing_alt';
    }
    if (issue.includes('alt属性が空です')) {
      return 'empty_alt';
    }
    if (issue.includes('リンクテキストが空です')) {
      return 'empty_link_text';
    }
    if (issue.includes('リンクテキストを100文字以下にしてください')) {
      return 'link_text_length';
    }
    if (issue.includes('H1タグが存在しません')) {
      return 'missing_h1';
    }
    if (issue.includes('H1タグが多すぎます')) {
      return 'multiple_h1';
    }
    if (issue.includes('構造化データが存在しません')) {
      return 'missing_structured_data';
    }
    if (issue.includes('内部リンクが少なすぎます')) {
      return 'few_internal_links';
    }
    if (issue.includes('外部リンクが存在しません')) {
      return 'missing_external_links';
    }
    if (issue.includes('viewportメタタグがありません')) {
      return 'missing_viewport';
    }
    if (issue.includes('noindexに設定されています')) {
      return 'noindex_set';
    }
    if (issue.includes('HTTPSではありません')) {
      return 'not_https';
    }
    if (issue.includes('URLが長すぎます')) {
      return 'url_too_long';
    }
    if (issue.includes('ディレクトリが深すぎます')) {
      return 'url_too_deep';
    }
    
    return issue; // デフォルトは元の文字列
  }

  /**
   * 要素名を取得
   */
  getElementName(category) {
    const elementNames = {
      titleTag: 'title',
      metaDescription: 'meta[name="description"]',
      headingStructure: 'h1, h2, h3, h4, h5, h6',
      imageAltAttributes: 'img',
      internalLinkStructure: 'a[href]',
      structuredData: 'script[type="application/ld+json"]',
      otherSEOElements: 'meta, url'
    };
    return elementNames[category] || category;
  }

  /**
   * 場所名を取得
   */
  getLocationName(category) {
    const locationNames = {
      titleTag: 'head',
      metaDescription: 'head',
      headingStructure: 'body',
      imageAltAttributes: 'body',
      internalLinkStructure: 'body',
      structuredData: 'head/body',
      otherSEOElements: 'head/url'
    };
    return locationNames[category] || 'unknown';
  }

  /**
   * 簡潔な修正方法を取得
   */
  getConciseFix(issue, category) {
    if (issue.includes('タイトルが短すぎます')) {
      return 'タイトルを15全角文字以上にしてください';
    }
    if (issue.includes('タイトルが長すぎます')) {
      return 'タイトルを30全角文字以下にしてください';
    }
    if (issue.includes('メタディスクリプションが短すぎます')) {
      return 'メタディスクリプションを60全角文字以上にしてください';
    }
    if (issue.includes('メタディスクリプションが長すぎます')) {
      return 'メタディスクリプションを80全角文字以下にしてください';
    }
    if (issue.includes('alt属性がありません')) {
      return 'すべての画像にalt属性を追加してください';
    }
    if (issue.includes('alt属性が空です')) {
      return '空のalt属性を削除するか、適切な説明文を設定してください';
    }
    if (issue.includes('リンクテキストが空です')) {
      return 'リンクに適切なテキストを追加してください';
    }
    if (issue.includes('リンクテキストを100文字以下にしてください')) {
      return 'リンクテキストを100文字以下にしてください';
    }
    if (issue.includes('H1タグが存在しません')) {
      return 'ページにH1タグを1つ追加してください';
    }
    if (issue.includes('H1タグが多すぎます')) {
      return 'H1タグを1個に統合し、他をH2に変更してください';
    }
    if (issue.includes('構造化データが存在しません')) {
      return 'JSON-LD形式で構造化データを実装してください';
    }
    if (issue.includes('内部リンクが少なすぎます')) {
      return '関連するページへの内部リンクを10個以上追加してください';
    }
    if (issue.includes('外部リンクが存在しません')) {
      return '信頼できる外部サイトへのリンクを追加してください';
    }
    if (issue.includes('viewportメタタグがありません')) {
      return 'viewportメタタグを追加してください';
    }
    if (issue.includes('noindexに設定されています')) {
      return 'noindexを削除して検索エンジンにインデックスされるようにしてください';
    }
    if (issue.includes('HTTPSではありません')) {
      return 'HTTPSを使用してください';
    }
    if (issue.includes('URLが長すぎます')) {
      return 'URLを255文字以下に短縮してください';
    }
    if (issue.includes('ディレクトリが深すぎます')) {
      return 'URLのディレクトリを5階層以下にしてください';
    }
    
    return '適切な修正を行ってください';
  }

  /**
   * ヘルパーメソッド群
   */
  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getOverallStatus(score, criticalIssues) {
    if (criticalIssues > 0) return '要緊急対応';
    if (score >= 80) return '良好';
    if (score >= 60) return '改善必要';
    return '大幅改善必要';
  }

  countCriticalIssues(results) {
    let count = 0;
    Object.values(results.checks).forEach(check => {
      if (check.issues) {
        count += check.issues.filter(issue => 
          this.isCriticalIssue(issue)
        ).length;
      }
    });
    return count;
  }

  countHighPriorityIssues(results) {
    let count = 0;
    Object.values(results.checks).forEach(check => {
      if (check.issues) {
        count += check.issues.filter(issue => 
          this.isHighPriorityIssue(issue)
        ).length;
      }
    });
    return count;
  }

  countTotalIssues(results) {
    let count = 0;
    Object.values(results.checks).forEach(check => {
      if (check.issues) count += check.issues.length;
    });
    if (results.aio && results.aio.checks) {
      Object.values(results.aio.checks).forEach(check => {
        if (check.issues) count += check.issues.length;
      });
    }
    return count;
  }

  identifyQuickWins(results) {
    const quickWins = [];
    
    // 簡単に修正できる項目を特定
    if (results.checks.titleTag && results.checks.titleTag.issues) {
      const titleIssues = results.checks.titleTag.issues.filter(issue =>
        issue.includes('長すぎ') || issue.includes('短すぎ')
      );
      if (titleIssues.length > 0) {
        quickWins.push({
          category: 'titleTag',
          issue: 'タイトルタグの長さ調整',
          effort: '低',
          impact: '高',
          time: '30分'
        });
      }
    }

    if (results.checks.metaDescription && results.checks.metaDescription.issues) {
      const descIssues = results.checks.metaDescription.issues.filter(issue =>
        issue.includes('長すぎ') || issue.includes('短すぎ')
      );
      if (descIssues.length > 0) {
        quickWins.push({
          category: 'metaDescription',
          issue: 'メタディスクリプションの長さ調整',
          effort: '低',
          impact: '中',
          time: '30分'
        });
      }
    }

    return quickWins;
  }

  calculatePriority(category, check, type) {
    const score = check.score;
    const issueCount = check.issues ? check.issues.length : 0;
    const impact = this.impactScores[type][category] || 10;

    if (score < 30 || issueCount >= 5) return 'critical';
    if (score < 50 || issueCount >= 3) return 'high';
    if (score < 70 || issueCount >= 2) return 'medium';
    return 'low';
  }

  calculateImpact(category, check, type) {
    const baseImpact = this.impactScores[type][category] || 10;
    const score = check.score;
    const issueCount = check.issues ? check.issues.length : 0;
    
    return baseImpact * (1 - score / 100) * (1 + issueCount * 0.1);
  }

  calculateEffort(category, check) {
    const effortMap = {
      titleTag: 1,
      metaDescription: 1,
      headingStructure: 3,
      imageAltAttributes: 4,
      internalLinkStructure: 5,
      structuredData: 8,
      otherSEOElements: 2,
      contentComprehensiveness: 6,
      structuredInformation: 7,
      credibilitySignals: 4,
      aiSearchOptimization: 5,
      naturalLanguageQuality: 6,
      contextRelevance: 3
    };

    return effortMap[category] || 5;
  }

  createImplementationItem(item, priority) {
    return {
      category: item.category,
      type: item.type,
      priority: priority,
      title: this.getCategoryTitle(item.category),
      description: item.issues[0],
      recommendations: item.recommendations,
      effort: this.getEffortDescription(item.effort),
      impact: this.getImpactDescription(item.impact),
      roi: item.roi,
      implementation: this.getImplementationGuide(item.category, item.type),
      examples: this.getExamples(item.category, item.type),
      tools: this.getRecommendedTools(item.category, item.type),
      metrics: this.getSuccessMetrics(item.category, item.type)
    };
  }

  calculatePotentialScore(results) {
    // すべての問題が解決された場合の潜在スコアを計算
    let potentialScore = 0;
    let totalWeight = 0;

    // SEO項目の重み付きスコア
    Object.entries(results.checks).forEach(([key, check]) => {
      const weight = this.impactScores.seo[key] || 10;
      potentialScore += 100 * weight; // 理想的なスコアは100
      totalWeight += weight;
    });

    // AIO項目の重み付きスコア
    if (results.aio && results.aio.checks) {
      Object.entries(results.aio.checks).forEach(([key, check]) => {
        const weight = this.impactScores.aio[key] || 10;
        potentialScore += 100 * weight;
        totalWeight += weight;
      });
    }

    return totalWeight > 0 ? Math.round(potentialScore / totalWeight) : 100;
  }

  calculateTrafficImpact(improvement, type) {
    // スコア改善に基づくトラフィック増加の推定
    const baseTraffic = 1000; // 仮定のベーストラフィック
    const improvementRate = improvement / 100;
    return Math.round(baseTraffic * improvementRate * 0.3); // 30%の効果率を仮定
  }

  calculateRankingImpact(improvement) {
    return Math.round(improvement / 10); // 10ポイント改善で1位向上を仮定
  }

  calculateCTRImpact(improvement) {
    return (improvement * 0.1).toFixed(1) + '%'; // 10ポイント改善で1%CTR向上を仮定
  }

  calculateAIVisibilityImpact(improvement) {
    return Math.round(improvement * 0.5); // AI検索での露出改善率
  }

  calculateAICitationsImpact(improvement) {
    return Math.round(improvement * 0.3); // AI引用数の改善率
  }

  calculateAISearchRankingImpact(improvement) {
    return Math.round(improvement / 15); // AI検索でのランキング改善
  }

  isCriticalIssue(issue) {
    const criticalKeywords = [
      '存在しません',
      'ありません',
      'エラー',
      '壊れ',
      'アクセスできない',
      'noindex'
    ];
    return criticalKeywords.some(keyword => issue.includes(keyword));
  }

  isHighPriorityIssue(issue) {
    const highPriorityKeywords = [
      '長すぎ',
      '短すぎ',
      '多すぎ',
      '少なすぎ',
      '重複',
      '階層'
    ];
    return highPriorityKeywords.some(keyword => issue.includes(keyword));
  }

  getCategoryTitle(category) {
    const titles = {
      titleTag: 'タイトルタグ',
      metaDescription: 'メタディスクリプション',
      headingStructure: '見出し構造',
      imageAltAttributes: '画像alt属性',
      internalLinkStructure: '内部リンク構造',
      structuredData: '構造化データ',
      otherSEOElements: 'その他SEO要素',
      contentComprehensiveness: 'コンテンツ包括性',
      structuredInformation: '構造化情報',
      credibilitySignals: '信頼性シグナル',
      aiSearchOptimization: 'AI検索最適化',
      naturalLanguageQuality: '自然言語品質',
      contextRelevance: 'コンテキスト関連性'
    };
    return titles[category] || category;
  }

  getEffortDescription(effort) {
    if (effort <= 2) return '低（30分〜1時間）';
    if (effort <= 4) return '中（1〜3時間）';
    if (effort <= 6) return '高（3〜8時間）';
    return '非常に高（8時間以上）';
  }

  getImpactDescription(impact) {
    if (impact >= 20) return '高';
    if (impact >= 10) return '中';
    return '低';
  }

  getImplementationGuide(category, type) {
    const guides = {
      titleTag: {
        seo: [
          '1. 現在のタイトルタグを確認',
          '2. 15-30全角文字の範囲で最適化',
          '3. 主要キーワードを前半に配置',
          '4. ブランド名を末尾に配置',
          '5. 重複キーワードを削除'
        ],
        aio: [
          '1. ユーザーの検索意図を考慮',
          '2. 質問形式のタイトルを検討',
          '3. 具体的な数値や期間を含める',
          '4. 感情に訴える表現を使用'
        ]
      },
      metaDescription: {
        seo: [
          '1. 60-80全角文字の範囲で作成',
          '2. 主要キーワードを含める',
          '3. 行動喚起（CTA）を含める',
          '4. ページの内容を正確に要約',
          '5. 省略記号を避ける'
        ],
        aio: [
          '1. ユーザーの疑問に答える内容',
          '2. 具体的な価値提案を明記',
          '3. 信頼性を示す要素を含める',
          '4. 自然な文章で記述'
        ]
      },
      structuredData: {
        seo: [
          '1. JSON-LD形式で実装',
          '2. 必須スキーマを優先',
          '3. Google構造化データテストツールで検証',
          '4. エラーを修正',
          '5. 本番環境でテスト'
        ],
        aio: [
          '1. AI検索に重要なスキーマを追加',
          '2. FAQPage、HowTo、Articleを実装',
          '3. 詳細な情報を提供',
          '4. 関連性の高いデータを含める'
        ]
      }
    };

    return guides[category]?.[type] || ['実装方法を確認してください'];
  }

  getExamples(category, type) {
    const examples = {
      titleTag: {
        seo: [
          '良い例: 「【2024年最新】メルカリで安全に取引する方法 | 初心者ガイド」',
          '悪い例: 「メルカリ メルカリ 使い方 メルカリ 安全」'
        ],
        aio: [
          '良い例: 「メルカリで月10万円稼ぐ方法とは？実際の成功事例とコツを解説」',
          '悪い例: 「メルカリについて」'
        ]
      },
      metaDescription: {
        seo: [
          '良い例: 「メルカリで安全に取引するための完全ガイド。初心者でも分かる出品方法、購入時の注意点、トラブル回避のコツを詳しく解説します。」',
          '悪い例: 「メルカリの使い方について説明します...」'
        ],
        aio: [
          '良い例: 「メルカリで実際に月10万円を稼いだ人の体験談と具体的な方法を公開。出品のコツから価格設定まで、成功の秘訣を詳しく解説します。」',
          '悪い例: 「メルカリでお金を稼ぐ方法」'
        ]
      }
    };

    return examples[category]?.[type] || ['例を確認してください'];
  }

  getRecommendedTools(category, type) {
    const tools = {
      titleTag: ['Google Search Console', 'Screaming Frog', 'SEMrush'],
      metaDescription: ['Google Search Console', 'Yoast SEO', 'All in One SEO'],
      structuredData: ['Google構造化データテストツール', 'Schema.org', 'JSON-LD Generator'],
      headingStructure: ['Screaming Frog', 'WAVE', 'axe DevTools'],
      imageAltAttributes: ['WAVE', 'axe DevTools', 'Lighthouse'],
      internalLinkStructure: ['Screaming Frog', 'Ahrefs', 'SEMrush']
    };

    return tools[category] || ['関連ツールを確認してください'];
  }

  getSuccessMetrics(category, type) {
    const metrics = {
      titleTag: ['クリック率（CTR）', '検索順位', 'インプレッション数'],
      metaDescription: ['クリック率（CTR）', '検索順位', 'インプレッション数'],
      structuredData: ['リッチスニペット表示率', 'クリック率', '検索順位'],
      headingStructure: ['検索順位', 'ユーザーエンゲージメント', 'ページ滞在時間'],
      imageAltAttributes: ['画像検索からの流入', 'アクセシビリティスコア', 'ページ速度'],
      internalLinkStructure: ['内部リンククリック率', 'ページ滞在時間', '離脱率']
    };

    return metrics[category] || ['関連指標を確認してください'];
  }
}

module.exports = EnhancedReporter;
