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
            codeExample: issue.codeExample || null,
            docLink: issue.docLink || null,
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
              codeExample: issue.codeExample || null,
              docLink: issue.docLink || null,
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
          codeExample: this.getCodeExample(issue, category),
          docLink: this.getDocLink(issue, category),
          count: 0
        };
      }
      issueGroups[key].count++;
    });

    // グループ化された問題を配列に変換（descriptionは生のまま保持し、件数は表示側で count フィールドから出す）
    Object.values(issueGroups).forEach(issue => {
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

    // ---------- SEO関連の追加マッピング（Phase 1.1） ----------
    if (issue.includes('H2タグが少なすぎます')) return 'few_h2';
    if (issue.includes('H3タグが少なすぎます')) return 'few_h3';
    if (issue.includes('見出しの階層が飛び越されています')) return 'heading_hierarchy_skip';
    if (issue.includes('タグが空です')) return 'empty_heading';
    if (issue.includes('タグが長すぎます')) return 'heading_too_long';
    if (issue.includes('タグに重複する内容があります')) return 'duplicate_heading';
    if (issue.includes('画像が存在しません')) return 'no_images';
    if (issue.includes('alt属性が長すぎます')) return 'alt_too_long';
    if (issue.includes('alt属性に「image」や「picture」など')) return 'alt_unnecessary_words';
    if (issue.includes('リンクが存在しません')) return 'no_links';
    if (issue.includes('汎用的なリンクテキストがあります')) return 'generic_link_text';
    if (issue.includes('メタディスクリプションがすべて小文字')) return 'meta_lowercase';
    if (issue.includes('メタディスクリプションに省略記号')) return 'meta_ellipsis';
    if (issue.includes('タイトルに重複するキーワード')) return 'title_duplicate_keywords';
    if (issue.includes('タイトルにパイプ')) return 'title_too_many_pipes';
    if (issue.includes('JSON-LDの構文エラー')) return 'jsonld_syntax_error';
    if (issue.includes('スキーマが不足しています')) {
      // 「LocalBusinessスキーマが不足しています」「Organizationスキーマが不足」など、スキーマ名を含む
      const m = issue.match(/^(\S+?)スキーマが不足しています$/);
      return m ? `missing_schema_${m[1]}` : 'missing_schema';
    }
    if (issue.includes('推奨スキーマが不足しています')) return 'missing_recommended_schemas';
    if (issue.includes('@typeがありません')) return 'jsonld_no_type';
    if (issue.includes('Organizationスキーマに')) return 'organization_missing_field';
    if (issue.includes('WebSiteスキーマに')) return 'website_missing_field';
    if (issue.includes('Productスキーマに')) return 'product_missing_field';
    if (issue.includes('BreadcrumbListスキーマに')) return 'breadcrumb_missing_field';
    if (issue.includes('viewportメタタグにwidth=device-widthがありません')) return 'viewport_no_width';
    if (issue.includes('viewportメタタグにinitial-scale=1がありません')) return 'viewport_no_scale';
    if (issue.includes('URLパラメータが多すぎ')) return 'url_too_many_params';
    if (issue.includes('URLの形式が正しくありません')) return 'invalid_url';
    if (issue.includes('タッチターゲットが小さすぎます')) return 'small_touch_targets';

    // ---------- AIO関連 ----------
    if (issue.includes('コンテンツが短すぎます')) return 'aio_content_too_short';
    if (issue.includes('コンテンツが長すぎる可能性')) return 'aio_content_too_long';
    if (issue.includes('段落が少なすぎます')) return 'aio_few_paragraphs';
    if (issue.includes('リスト形式のコンテンツがありません')) return 'aio_no_lists';
    if (issue.includes('見出しに対してコンテンツが少なすぎます')) return 'aio_thin_under_headings';
    if (issue.includes('JSON-LD構造化データがありません')) return 'aio_no_jsonld';
    if (issue.includes('AI検索に重要なスキーマが不足')) return 'aio_missing_schemas';
    if (issue.includes('FAQ形式のコンテンツがありません')) return 'aio_no_faq';
    if (issue.includes('定義リストがありません')) return 'aio_no_definition_list';
    if (issue.includes('著者情報がありません')) return 'aio_no_author';
    if (issue.includes('日付情報がありません')) return 'aio_no_date';
    if (issue.includes('引用や参考文献がありません')) return 'aio_no_citations';
    if (issue.includes('権威のある外部サイト')) return 'aio_no_authority_links';
    if (issue.includes('連絡先情報がありません')) return 'aio_no_contact';
    if (issue.includes('質問形式のコンテンツがありません')) return 'aio_no_questions';
    if (issue.includes('比較・対比のコンテンツ')) return 'aio_no_comparison';
    if (issue.includes('手順・ステップ形式')) return 'aio_no_howto';
    if (issue.includes('具体的な数値データが少なすぎ')) return 'aio_few_numbers';
    if (issue.includes('文章が長すぎます')) return 'aio_sentence_too_long';
    if (issue.includes('専門用語が多すぎます')) return 'aio_too_many_jargon';
    if (issue.includes('受動態が多すぎます')) return 'aio_too_much_passive';
    if (issue.includes('接続詞が少なすぎます')) return 'aio_few_connectives';
    if (issue.includes('URLとコンテンツの関連性')) return 'aio_url_irrelevant';
    if (issue.includes('内部リンクの関連性が低い')) return 'aio_internal_link_irrelevant';
    if (issue.includes('カテゴリやタグがありません')) return 'aio_no_taxonomy';

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
      otherSEOElements: 'meta, url',
      // AIOカテゴリ
      contentComprehensiveness: '本文 / 見出し',
      structuredInformation: '構造化マークアップ',
      credibilitySignals: '著者・出典・連絡先',
      aiSearchOptimization: 'FAQ / HowTo / 比較',
      naturalLanguageQuality: '文章スタイル',
      contextRelevance: 'URL / 内部リンク / カテゴリ'
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
      otherSEOElements: 'head/url',
      // AIOカテゴリ（具体的な場所をユーザーに伝える）
      contentComprehensiveness: 'body（本文セクション）',
      structuredInformation: 'head（JSON-LDスクリプト）',
      credibilitySignals: 'body / footer',
      aiSearchOptimization: 'body（FAQ・HowTo・比較セクション）',
      naturalLanguageQuality: 'body（本文）',
      contextRelevance: 'URL / nav / sidebar'
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

    // ---------- SEO関連の追加fix（Phase 1.1） ----------
    if (issue.includes('H2タグが少なすぎます')) {
      return 'コンテンツの主要セクションごとに <h2> を追加してください。3個以上を目安にすると検索エンジンが構造を理解しやすくなります。';
    }
    if (issue.includes('H3タグが少なすぎます')) {
      return '各 <h2> セクション配下に <h3> を配置し、サブトピックを明示してください。階層的な見出しはAI検索でも有利です。';
    }
    if (issue.includes('見出しの階層が飛び越されています')) {
      return '見出しは H1 → H2 → H3 と1段ずつ進めてください（例: H2 → H4 はNG）。階層が崩れるとアクセシビリティとSEO評価が下がります。';
    }
    if (issue.includes('タグが空です')) {
      return '空の見出しタグを削除するか、意味のあるテキストを入れてください。中身のない見出しはSEO上マイナスです。';
    }
    if (issue.includes('タグが長すぎます')) {
      return '見出しは70文字以内（できれば40文字以内）にしてください。長すぎる見出しは要点が伝わりません。';
    }
    if (issue.includes('タグに重複する内容があります')) {
      return '同じ文言の見出しを統合または書き換えてください。各見出しは固有の主題を表すべきです。';
    }
    if (issue.includes('画像が存在しません')) {
      return 'コンテンツに関連する画像（製品写真・図解・スクリーンショット等）を追加し、必ず alt 属性で内容を説明してください。視覚情報はCVR向上にも寄与します。';
    }
    if (issue.includes('alt属性が長すぎます')) {
      return 'alt属性は125文字以内に簡潔にまとめてください。長すぎるとスクリーンリーダー利用者の体験が悪化します。';
    }
    if (issue.includes('alt属性に「image」や「picture」など')) {
      return 'alt属性から「image of」「picture of」などの冗長な表現を削除し、画像の内容そのものを簡潔に記述してください。';
    }
    if (issue.includes('リンクが存在しません')) {
      return 'ページ内に内部リンクを追加し、関連コンテンツへ誘導してください。リンクがないページはクロールされにくくなります。';
    }
    if (issue.includes('汎用的なリンクテキストがあります')) {
      return '「こちら」「詳細はこちら」「click here」などの汎用テキストを、リンク先の内容が分かる具体的な文言（例: 「料金プランを見る」）に置き換えてください。';
    }
    if (issue.includes('メタディスクリプションがすべて小文字')) {
      return 'メタディスクリプションに固有名詞・文頭を適切に大文字化し、自然な表記にしてください。すべて小文字だと品質が低く見えます。';
    }
    if (issue.includes('メタディスクリプションに省略記号')) {
      return '省略記号（…）を使わず、文を完結させてください。文字数制限内で要点を伝えるように書き直しを推奨します。';
    }
    if (issue.includes('タイトルに重複するキーワード')) {
      return 'タイトル内で同じキーワードが2回以上出ないよう、言い換えや削除で整理してください。';
    }
    if (issue.includes('タイトルにパイプ')) {
      return 'タイトル区切りのパイプ「|」は2個以内に抑えてください。多すぎると視認性が悪く、CTRが下がります。';
    }
    if (issue.includes('JSON-LDの構文エラー')) {
      return 'JSON-LDのJSON構文エラーを修正してください。Google Rich Results Test ( https://search.google.com/test/rich-results ) で検証できます。';
    }
    if (issue.includes('LocalBusinessスキーマが不足')) {
      return '実店舗・拠点を持つ事業者の場合、LocalBusiness スキーマ（住所・電話・営業時間・地理座標）を実装してください。Google マップやAI回答での露出に直結します。';
    }
    if (issue.includes('Organizationスキーマが不足')) {
      return 'Organization スキーマ（会社名・URL・ロゴ・SNSプロフィール）を実装してください。ブランドの信頼性をAIに伝えられます。';
    }
    if (issue.includes('WebSiteスキーマが不足')) {
      return 'WebSite スキーマ（サイト名・URL・potentialAction=SearchAction）を実装すると、サイトリンク検索ボックスの表示候補になります。';
    }
    if (issue.includes('Productスキーマが不足')) {
      return 'Product スキーマ（商品名・価格・在庫・レビュー）を実装すると、リッチリザルトと商品AI回答に表示される可能性が高まります。';
    }
    if (issue.includes('BreadcrumbListスキーマが不足')) {
      return 'BreadcrumbList スキーマを実装してください。検索結果でパンくず表示が出やすくなり、AIにも階層を伝えられます。';
    }
    if (issue.includes('FAQPageスキーマが不足')) {
      return 'よくある質問セクションがあるなら FAQPage スキーマを実装してください。AI回答での引用率が上がります。';
    }
    if (issue.includes('Articleスキーマが不足') || issue.includes('NewsArticleスキーマが不足') || issue.includes('BlogPostingスキーマが不足')) {
      return '記事ページなら Article（または NewsArticle / BlogPosting）スキーマで著者・公開日・更新日を構造化してください。';
    }
    if (issue.includes('HowToスキーマが不足')) {
      return '手順を扱うページなら HowTo スキーマでステップ・所要時間・必要な道具を構造化してください。';
    }
    if (issue.includes('VideoObjectスキーマが不足')) {
      return '動画があるなら VideoObject スキーマでサムネイル・公開日・説明・尺を構造化してください。';
    }
    if (issue.includes('スキーマが不足しています')) {
      // 上記でカバーされなかった「〇〇スキーマが不足」の汎用fallback
      const m = issue.match(/^(\S+?)スキーマが不足しています$/);
      const schema = m ? m[1] : 'スキーマ';
      return `${schema} スキーマを実装し、ページ種別に応じた情報を構造化してください。schema.org のリファレンス ( https://schema.org/${m ? m[1] : ''} ) を参照してください。`;
    }
    if (issue.includes('推奨スキーマが不足しています')) {
      return 'ページ種別に応じた推奨スキーマを実装してください。ページタイプ判定結果に表示されるスキーマから優先的に追加することを推奨します。';
    }
    if (issue.includes('@typeがありません')) {
      return 'JSON-LDの各オブジェクトに `@type` を必ず指定してください（例: `"@type": "Article"`）。@typeがないとGoogleが認識できません。';
    }
    if (issue.includes('Organizationスキーマにnameがありません')) {
      return 'Organization の `name` プロパティに組織名を設定してください（必須プロパティ）。';
    }
    if (issue.includes('Organizationスキーマにurlがありません')) {
      return 'Organization の `url` プロパティに公式サイトのURLを設定してください。';
    }
    if (issue.includes('WebSiteスキーマにnameがありません')) {
      return 'WebSite の `name` プロパティにサイト名を設定してください。';
    }
    if (issue.includes('WebSiteスキーマにurlがありません')) {
      return 'WebSite の `url` プロパティにサイトURLを設定してください。';
    }
    if (issue.includes('WebSiteスキーマにpotentialActionがありません')) {
      return 'WebSite に `potentialAction`（SearchAction）を追加すると、Google のサイトリンク検索ボックス候補になります。';
    }
    if (issue.includes('Productスキーマにnameがありません')) {
      return 'Product の `name` プロパティに商品名を設定してください（必須）。';
    }
    if (issue.includes('Productスキーマにdescriptionがありません')) {
      return 'Product の `description` プロパティに商品説明を設定してください。';
    }
    if (issue.includes('Productスキーマにoffersがありません')) {
      return 'Product に `offers`（価格・在庫情報）を追加するとリッチリザルト対象になります。';
    }
    if (issue.includes('BreadcrumbListスキーマにitemListElement')) {
      return 'BreadcrumbList の `itemListElement` 配列にパンくずの各階層を順番に列挙してください。';
    }
    if (issue.includes('viewportメタタグにwidth=device-widthがありません')) {
      return 'viewport メタタグに `width=device-width` を追加してください（例: `<meta name="viewport" content="width=device-width, initial-scale=1">`）。';
    }
    if (issue.includes('viewportメタタグにinitial-scale=1がありません')) {
      return 'viewport メタタグに `initial-scale=1` を追加してください。';
    }
    if (issue.includes('URLパラメータが多すぎ')) {
      return 'URLのクエリパラメータを減らし、必要なものだけに絞ってください。トラッキング用パラメータは Canonical タグで正規化を推奨します。';
    }
    if (issue.includes('URLの形式が正しくありません')) {
      return 'URLに使用できない文字（スペース、日本語等）が含まれていないか確認し、適切にエンコードしてください。';
    }
    if (issue.includes('タッチターゲットが小さすぎます')) {
      return 'タップ可能な要素（ボタン・リンク・アイコン）を 48×48px（最低 44×44px）以上にし、要素間の余白も8px以上確保してください。モバイルUX とCore Web Vitals の INP 改善に直結します。';
    }

    // ---------- AIO関連の具体fix ----------
    if (issue.includes('コンテンツが短すぎます')) {
      return '本文を300語以上に拡充してください。AI検索エンジンは内容が薄いページを引用元として選びにくくなります。';
    }
    if (issue.includes('コンテンツが長すぎる可能性')) {
      return '記事を複数ページに分割するか、要約・目次・FAQを追加して読みやすさを保ってください。';
    }
    if (issue.includes('段落が少なすぎます')) {
      return '段落を3つ以上に分け、1段落あたり2〜4文を目安に整えてください。';
    }
    if (issue.includes('リスト形式のコンテンツがありません')) {
      return '箇条書き（<ul>/<ol>）を1箇所以上追加してください。AIは構造化された情報を引用しやすい傾向があります。';
    }
    if (issue.includes('見出しに対してコンテンツが少なすぎます')) {
      return '各見出し直下に150字以上の本文を入れ、見出しと内容のバランスを取ってください。';
    }
    if (issue.includes('JSON-LD構造化データがありません')) {
      return 'ページ種別に応じた JSON-LD（Article / FAQPage / Product など）を <head> に追加してください。AI検索の理解度が大幅に上がります。';
    }
    if (issue.includes('AI検索に重要なスキーマが不足')) {
      return 'FAQPage / HowTo / Article / BreadcrumbList のうちページに合うものを実装してください。AI回答で引用される確率が上がります。';
    }
    if (issue.includes('FAQ形式のコンテンツがありません')) {
      return 'Q&A形式のセクションを追加し、FAQPageスキーマも併用してください。ChatGPT/Perplexity等で引用されやすくなります。';
    }
    if (issue.includes('定義リストがありません')) {
      return '専門用語の定義に <dl><dt><dd> を使うか、「〇〇とは〜です」という定義文を冒頭に置いてください。';
    }
    if (issue.includes('著者情報がありません')) {
      return '著者名・肩書きを明示し、可能なら Person スキーマや <meta name="author"> を追加してください。E-E-A-Tに直結します。';
    }
    if (issue.includes('日付情報がありません')) {
      return '公開日・更新日を本文に表示し、Article スキーマの datePublished / dateModified にも反映してください。';
    }
    if (issue.includes('引用や参考文献がありません')) {
      return '<cite> や脚注、参考文献リストで出典を明示してください。情報の信頼性をAIに伝えられます。';
    }
    if (issue.includes('権威のある外部サイト')) {
      return '官公庁・業界団体・主要メディアなど信頼性の高い外部サイトへの参照リンクを1〜3本追加してください。';
    }
    if (issue.includes('連絡先情報がありません')) {
      return 'フッターまたは専用ページに会社情報・問い合わせ先を掲載し、Organization スキーマも実装してください。';
    }
    if (issue.includes('質問形式のコンテンツがありません')) {
      return '見出しに「〜とは？」「なぜ〜？」「どうやって〜？」など疑問形を盛り込んでください。AI検索クエリに直接マッチします。';
    }
    if (issue.includes('比較・対比のコンテンツ')) {
      return '比較表（<table>）や「Aと違い、Bは〜」といった対比表現を追加してください。AI回答の比較質問に強くなります。';
    }
    if (issue.includes('手順・ステップ形式')) {
      return '番号付きステップ（<ol>）に加え、HowToスキーマを実装すると「やり方」系のAI検索で選ばれやすくなります。';
    }
    if (issue.includes('具体的な数値データが少なすぎ')) {
      return '統計値・割合・年次データなど具体的な数値を本文に追加し、出典も合わせて記載してください。';
    }
    if (issue.includes('文章が長すぎます')) {
      return '1文を60字以内、長くても80字以内に収めてください。AIも人間も読みやすくなります。';
    }
    if (issue.includes('専門用語が多すぎます')) {
      return '専門用語の初出時に1文の平易な定義を併記してください（例: "LCP（読み込み速度の指標）"）。';
    }
    if (issue.includes('受動態が多すぎます')) {
      return '「〜される」を能動態に書き換えてください。主語と動作が明確だとAIの抽出精度が上がります。';
    }
    if (issue.includes('接続詞が少なすぎます')) {
      return '「しかし」「そのため」「一方で」など論理関係を示す接続詞を増やし、文の流れを明示してください。';
    }
    if (issue.includes('URLとコンテンツの関連性')) {
      return 'URLスラッグにページ主題のキーワードを含め、コンテンツとの一致度を高めてください。';
    }
    if (issue.includes('内部リンクの関連性が低い')) {
      return 'アンカーテキストとリンク先のテーマを一致させ、文脈に沿った関連ページへのリンクに置き換えてください。';
    }
    if (issue.includes('カテゴリやタグがありません')) {
      return 'パンくず（BreadcrumbList）やカテゴリ、タグを設置してページ間の関係性をAIに伝えてください。';
    }

    // ---------- 最終フォールバック ----------
    // ここに来た時点で個別マッピング漏れ。何の問題かをそのまま表示し、カテゴリ別のヒントを付与する。
    const categoryHint = this.getCategoryHint(category);
    if (issue && typeof issue === 'string' && issue.length > 0) {
      return categoryHint ? `${issue} → ${categoryHint}` : issue;
    }
    return categoryHint || '該当箇所の改善をご検討ください';
  }

  /**
   * カテゴリ別の汎用ヒント（最終フォールバック時に使用、Phase 1.1）
   */
  getCategoryHint(category) {
    const hints = {
      titleTag: 'タイトルタグの見直しが必要です（15〜30全角文字、固有のキーワードを含む）',
      metaDescription: 'メタディスクリプションの見直しが必要です（60〜80全角文字、ページ内容を要約）',
      headingStructure: '見出し構造の見直しが必要です（H1〜H6を階層的に使用）',
      imageAltAttributes: '画像のalt属性の見直しが必要です',
      internalLinkStructure: '内部リンク・外部リンクの構造を見直してください',
      structuredData: '構造化データ（JSON-LD）の見直しが必要です',
      otherSEOElements: 'その他SEO要素（viewport, robots, URL等）を確認してください',
      contentComprehensiveness: 'コンテンツのボリュームと構造を見直してください',
      structuredInformation: '構造化情報（JSON-LD等）の実装を見直してください',
      credibilitySignals: '信頼性シグナル（著者・出典・連絡先）を強化してください',
      aiSearchOptimization: 'AI検索向けのコンテンツ構造（FAQ/HowTo/比較）を強化してください',
      naturalLanguageQuality: '文章の読みやすさ（文長・専門用語・接続詞）を見直してください',
      contextRelevance: 'URL・内部リンク・カテゴリの文脈関連性を見直してください'
    };
    return hints[category] || null;
  }

  /**
   * 修正例コード（Phase 1-B）
   * 各issueに対応するスニペットを返す。ない場合は null
   */
  getCodeExample(issue, category) {
    // SEO
    if (issue.includes('構造化データが存在しません') || issue.includes('JSON-LD構造化データがありません')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Article",',
        '  "headline": "記事タイトル",',
        '  "author": { "@type": "Person", "name": "著者名" },',
        '  "datePublished": "2025-01-01",',
        '  "dateModified": "2025-01-15"',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('viewportメタタグがありません')) {
      return '<meta name="viewport" content="width=device-width, initial-scale=1">';
    }
    if (issue.includes('noindexに設定されています')) {
      return '<!-- 削除する -->\n<meta name="robots" content="noindex">';
    }
    if (issue.includes('alt属性がありません')) {
      return '<img src="photo.jpg" alt="商品の使用シーン: 〇〇を使う様子">';
    }
    if (issue.includes('リンクテキストが空です')) {
      return '<a href="/about">会社概要を見る</a>';
    }
    if (issue.includes('H1タグが存在しません')) {
      return '<h1>ページの主題を表す見出し</h1>';
    }
    // AIO
    if (issue.includes('FAQ形式のコンテンツがありません')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "FAQPage",',
        '  "mainEntity": [{',
        '    "@type": "Question",',
        '    "name": "〇〇とは何ですか？",',
        '    "acceptedAnswer": {',
        '      "@type": "Answer",',
        '      "text": "〇〇は〜です。"',
        '    }',
        '  }]',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('手順・ステップ形式')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "HowTo",',
        '  "name": "〇〇のやり方",',
        '  "step": [',
        '    { "@type": "HowToStep", "text": "ステップ1: ..." },',
        '    { "@type": "HowToStep", "text": "ステップ2: ..." }',
        '  ]',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('著者情報がありません')) {
      return [
        '<meta name="author" content="著者名">',
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Person",',
        '  "name": "著者名",',
        '  "jobTitle": "編集長",',
        '  "url": "https://example.com/author/xxx"',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('定義リストがありません')) {
      return [
        '<dl>',
        '  <dt>SEO</dt>',
        '  <dd>検索エンジン最適化のこと。検索結果での表示順を改善する施策。</dd>',
        '</dl>'
      ].join('\n');
    }
    if (issue.includes('連絡先情報がありません')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Organization",',
        '  "name": "会社名",',
        '  "url": "https://example.com",',
        '  "contactPoint": {',
        '    "@type": "ContactPoint",',
        '    "contactType": "customer support",',
        '    "email": "support@example.com"',
        '  }',
        '}',
        '</script>'
      ].join('\n');
    }
    // ---------- Phase 1.1: SEO追加サンプル ----------
    if (issue.includes('LocalBusinessスキーマが不足')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "LocalBusiness",',
        '  "name": "店舗名",',
        '  "image": "https://example.com/photo.jpg",',
        '  "address": {',
        '    "@type": "PostalAddress",',
        '    "streetAddress": "東京都港区六本木1-2-3",',
        '    "addressLocality": "港区",',
        '    "addressRegion": "東京都",',
        '    "postalCode": "106-0032",',
        '    "addressCountry": "JP"',
        '  },',
        '  "telephone": "+81-3-1234-5678",',
        '  "openingHours": "Mo-Fr 09:00-18:00",',
        '  "geo": { "@type": "GeoCoordinates", "latitude": 35.6638, "longitude": 139.7298 }',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('BreadcrumbListスキーマが不足') || issue.includes('BreadcrumbListスキーマにitemListElement')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "BreadcrumbList",',
        '  "itemListElement": [',
        '    { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://example.com/" },',
        '    { "@type": "ListItem", "position": 2, "name": "カテゴリ", "item": "https://example.com/category/" },',
        '    { "@type": "ListItem", "position": 3, "name": "現在のページ" }',
        '  ]',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('Productスキーマ')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Product",',
        '  "name": "商品名",',
        '  "description": "商品説明",',
        '  "image": "https://example.com/product.jpg",',
        '  "offers": {',
        '    "@type": "Offer",',
        '    "price": "9800",',
        '    "priceCurrency": "JPY",',
        '    "availability": "https://schema.org/InStock"',
        '  }',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('WebSiteスキーマ')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "WebSite",',
        '  "name": "サイト名",',
        '  "url": "https://example.com",',
        '  "potentialAction": {',
        '    "@type": "SearchAction",',
        '    "target": "https://example.com/search?q={search_term_string}",',
        '    "query-input": "required name=search_term_string"',
        '  }',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('Organizationスキーマが不足') || issue.includes('Organizationスキーマに')) {
      return [
        '<script type="application/ld+json">',
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Organization",',
        '  "name": "会社名",',
        '  "url": "https://example.com",',
        '  "logo": "https://example.com/logo.png",',
        '  "sameAs": [',
        '    "https://twitter.com/company",',
        '    "https://www.facebook.com/company"',
        '  ]',
        '}',
        '</script>'
      ].join('\n');
    }
    if (issue.includes('H2タグが少なすぎます') || issue.includes('H3タグが少なすぎます')) {
      return [
        '<h2>主要セクションの見出し</h2>',
        '<p>セクション本文...</p>',
        '  <h3>サブトピックの見出し</h3>',
        '  <p>サブ本文...</p>'
      ].join('\n');
    }
    if (issue.includes('viewportメタタグにwidth=device-widthがありません') || issue.includes('viewportメタタグにinitial-scale=1がありません')) {
      return '<meta name="viewport" content="width=device-width, initial-scale=1">';
    }
    if (issue.includes('タッチターゲットが小さすぎます')) {
      return [
        '/* タップ可能要素は最低 44x44px、推奨 48x48px */',
        '.btn, a.button {',
        '  min-width: 48px;',
        '  min-height: 48px;',
        '  padding: 12px 16px;',
        '}',
        '/* 要素間の余白 */',
        '.btn + .btn { margin-left: 8px; }'
      ].join('\n');
    }
    return null;
  }

  /**
   * 参考ドキュメントリンク（Phase 1-B）
   * 全推奨アクションが何らかの公式リファレンスを持つように網羅
   * 注: 具体的なスキーマ名は一般的な「構造化データ」より先に判定する
   */
  getDocLink(issue, category) {
    // 具体スキーマを最優先で判定
    if (issue.includes('LocalBusiness')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/local-business?hl=ja';
    }
    if (issue.includes('BreadcrumbList')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/breadcrumb?hl=ja';
    }
    if (issue.includes('Product')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/product?hl=ja';
    }
    if (issue.includes('Organization')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/logo?hl=ja';
    }
    if (issue.includes('WebSite') || issue.includes('SearchAction') || issue.includes('potentialAction')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox?hl=ja';
    }
    if (issue.includes('Article') || issue.includes('NewsArticle') || issue.includes('BlogPosting')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/article?hl=ja';
    }
    if (issue.includes('VideoObject')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/video?hl=ja';
    }
    // 構造化データ・スキーマ系（汎用）
    if (issue.includes('構造化データ') || issue.includes('JSON-LD') || issue.includes('スキーマが不足')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data?hl=ja';
    }
    if (issue.includes('FAQ')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/faqpage?hl=ja';
    }
    if (issue.includes('手順・ステップ')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/how-to?hl=ja';
    }
    // HTML/メタ系
    if (issue.includes('viewport')) {
      return 'https://developer.mozilla.org/ja/docs/Web/HTML/Viewport_meta_tag';
    }
    if (issue.includes('alt')) {
      return 'https://developer.mozilla.org/ja/docs/Web/HTML/Element/img#alt';
    }
    if (issue.includes('タイトル')) {
      return 'https://developers.google.com/search/docs/appearance/title-link?hl=ja';
    }
    if (issue.includes('メタディスクリプション')) {
      return 'https://developers.google.com/search/docs/appearance/snippet?hl=ja';
    }
    if (issue.includes('HTTPS')) {
      return 'https://developers.google.com/search/docs/advanced/security/https?hl=ja';
    }
    if (issue.includes('noindex')) {
      return 'https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=ja';
    }
    // E-E-A-T / 信頼性系
    if (issue.includes('著者') || issue.includes('E-E-A-T')) {
      return 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja';
    }
    if (issue.includes('日付情報') || issue.includes('引用') || issue.includes('参考文献')) {
      return 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja';
    }
    if (issue.includes('連絡先') || issue.includes('権威のある外部サイト')) {
      return 'https://developers.google.com/search/docs/appearance/structured-data/local-business?hl=ja';
    }
    // 見出し・リンク系
    if (issue.includes('H1') || issue.includes('H2タグが') || issue.includes('H3タグが') ||
        issue.includes('H4タグが') || issue.includes('見出し') || issue.includes('タグが空です') ||
        issue.includes('タグが長すぎます')) {
      return 'https://developer.mozilla.org/ja/docs/Web/HTML/Element/Heading_Elements';
    }
    if (issue.includes('リンクテキスト') || issue.includes('内部リンク') || issue.includes('外部リンク') ||
        issue.includes('リンクが存在しません') || issue.includes('汎用的なリンク')) {
      return 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable?hl=ja';
    }
    // URL系
    if (issue.includes('URL')) {
      return 'https://developers.google.com/search/docs/crawling-indexing/url-structure?hl=ja';
    }
    // コンテンツ品質・AIO系
    if (issue.includes('コンテンツが短') || issue.includes('コンテンツが長') ||
        issue.includes('段落') || issue.includes('リスト形式') ||
        issue.includes('見出しに対してコンテンツ')) {
      return 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja';
    }
    if (issue.includes('定義リスト')) {
      return 'https://developer.mozilla.org/ja/docs/Web/HTML/Element/dl';
    }
    if (issue.includes('質問形式') || issue.includes('比較・対比') ||
        issue.includes('具体的な数値')) {
      return 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja';
    }
    // 自然言語品質系
    if (issue.includes('文章が長') || issue.includes('専門用語') ||
        issue.includes('受動態') || issue.includes('接続詞')) {
      return 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content?hl=ja';
    }
    // コンテキスト関連性系
    if (issue.includes('URLとコンテンツの関連性') || issue.includes('内部リンクの関連性') ||
        issue.includes('カテゴリやタグ')) {
      return 'https://developers.google.com/search/docs/crawling-indexing/url-structure?hl=ja';
    }
    // Phase 1.1 追加（特定スキーマは先頭で判定済み）
    if (issue.includes('JSON-LDの構文エラー') || issue.includes('@type')) {
      return 'https://search.google.com/test/rich-results?hl=ja';
    }
    if (issue.includes('タッチターゲット')) {
      return 'https://web.dev/articles/accessible-tap-targets?hl=ja';
    }
    if (issue.includes('URLパラメータ')) {
      return 'https://developers.google.com/search/docs/crawling-indexing/url-structure?hl=ja';
    }
    if (issue.includes('画像')) {
      return 'https://developers.google.com/search/docs/appearance/google-images?hl=ja';
    }
    if (issue.includes('スキーマ')) {
      return 'https://schema.org/';
    }
    return null;
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
