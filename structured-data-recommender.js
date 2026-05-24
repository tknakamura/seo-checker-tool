/**
 * 構造化データ推奨エンジン
 * ページタイプに基づいて適切な構造化データスキーマを推奨し、優先度を付けて提案
 */
class StructuredDataRecommender {
  constructor() {
    // ページタイプ別推奨スキーマ設定
    // Phase 2-D: 新タイプ (WebPage / Service / AboutPage / ContactPage / SoftwareApplication
    //             / VideoObject / CollectionPage / NewsArticle / BlogPosting / Person /
    //             Organization) を追加。LLM が判定する全タイプを網羅。
    this.recommendations = {
      Article: {
        primary: ['Article', 'NewsArticle', 'BlogPosting'],
        secondary: ['Organization', 'Person', 'BreadcrumbList'],
        optional: ['Comment', 'Rating', 'Review']
      },
      NewsArticle: {
        primary: ['NewsArticle'],
        secondary: ['Organization', 'Person', 'BreadcrumbList'],
        optional: ['ImageObject', 'Comment']
      },
      BlogPosting: {
        primary: ['BlogPosting'],
        secondary: ['Person', 'Organization', 'BreadcrumbList'],
        optional: ['ImageObject', 'Comment']
      },
      Product: {
        primary: ['Product'],
        secondary: ['Organization', 'Offer', 'Review'],
        optional: ['AggregateRating', 'Brand', 'BreadcrumbList']
      },
      LocalBusiness: {
        primary: ['LocalBusiness'],
        secondary: ['Organization', 'PostalAddress', 'ContactPoint'],
        optional: ['OpeningHoursSpecification', 'GeoCoordinates', 'Review']
      },
      // 新規: BtoB サービス LP / SaaS / 広告掲載案内など
      Service: {
        primary: ['Service'],
        secondary: ['Organization', 'Offer', 'AggregateRating'],
        optional: ['BreadcrumbList', 'ContactPoint', 'VideoObject']
      },
      // 新規: 汎用 Web ページ（カテゴリページ、案内ページなど）
      WebPage: {
        primary: ['WebPage'],
        secondary: ['Organization', 'BreadcrumbList'],
        optional: ['Person', 'ImageObject', 'VideoObject']
      },
      // 新規: 会社案内・自己紹介ページ
      AboutPage: {
        primary: ['AboutPage'],
        secondary: ['Organization', 'Person'],
        optional: ['BreadcrumbList', 'ContactPoint', 'ImageObject']
      },
      // 新規: 問い合わせページ
      ContactPage: {
        primary: ['ContactPage'],
        secondary: ['Organization', 'ContactPoint', 'PostalAddress'],
        optional: ['BreadcrumbList', 'OpeningHoursSpecification']
      },
      // 新規: 商品カテゴリ・コレクションページ
      CollectionPage: {
        primary: ['CollectionPage'],
        secondary: ['BreadcrumbList', 'ItemList'],
        optional: ['Organization', 'Product']
      },
      // 新規: SaaS / アプリ
      SoftwareApplication: {
        primary: ['SoftwareApplication'],
        secondary: ['Organization', 'AggregateRating', 'Offer'],
        optional: ['Review', 'ImageObject', 'VideoObject']
      },
      // 新規: 組織情報ページ
      Organization: {
        primary: ['Organization'],
        secondary: ['ContactPoint', 'PostalAddress'],
        optional: ['BreadcrumbList', 'Person', 'ImageObject']
      },
      // 新規: 人物プロフィールページ
      Person: {
        primary: ['Person'],
        secondary: ['Organization'],
        optional: ['BreadcrumbList', 'ImageObject']
      },
      Recipe: {
        primary: ['Recipe'],
        secondary: ['Person', 'Organization', 'NutritionInformation'],
        optional: ['AggregateRating', 'Review', 'Video']
      },
      Event: {
        primary: ['Event'],
        secondary: ['Place', 'Organization', 'Offer'],
        optional: ['Person', 'PostalAddress', 'VirtualLocation']
      },
      FAQ: {
        primary: ['FAQPage'],
        secondary: ['Question', 'Answer'],
        optional: ['Organization', 'BreadcrumbList']
      },
      // 新規: FAQPage 直接対応
      FAQPage: {
        primary: ['FAQPage'],
        secondary: ['Question', 'Answer'],
        optional: ['Organization', 'BreadcrumbList']
      },
      HowTo: {
        primary: ['HowTo'],
        secondary: ['HowToStep', 'HowToSupply', 'HowToTool'],
        optional: ['Person', 'Organization', 'Video']
      },
      Review: {
        primary: ['Review'],
        secondary: ['Product', 'Organization', 'Rating'],
        optional: ['Person', 'AggregateRating', 'CreativeWork']
      },
      JobPosting: {
        primary: ['JobPosting'],
        secondary: ['Organization', 'Place'],
        optional: ['PostalAddress', 'MonetaryAmount', 'EducationalOccupationalCredential']
      },
      Course: {
        primary: ['Course', 'EducationEvent'],
        secondary: ['Organization', 'Person', 'Place'],
        optional: ['AggregateRating', 'Review', 'Offer']
      },
      // 新規: 動画コンテンツ主体
      VideoObject: {
        primary: ['VideoObject'],
        secondary: ['Organization', 'Person'],
        optional: ['BreadcrumbList', 'Comment']
      }
    };

    // スキーマ別の重要度設定
    this.schemaImportance = {
      // 必須スキーマ（SEOへの影響が大きい）
      critical: [
        'Article', 'NewsArticle', 'BlogPosting', 'Product', 'LocalBusiness', 
        'Recipe', 'Event', 'FAQPage', 'HowTo', 'Review', 'JobPosting', 'Course'
      ],
      // 高優先度（リッチスニペットに影響）
      high: [
        'Organization', 'Person', 'Place', 'Offer', 'Rating', 'AggregateRating'
      ],
      // 中優先度（SEO向上に貢献）
      medium: [
        'BreadcrumbList', 'Question', 'Answer', 'HowToStep', 'PostalAddress'
      ],
      // 低優先度（付加価値）
      low: [
        'Comment', 'Brand', 'NutritionInformation', 'ContactPoint', 'Video'
      ]
    };

    // ビジネス種別の詳細分類
    this.businessTypes = {
      'Restaurant': ['レストラン', 'カフェ', 'カレー', '食べ物', '飲食店'],
      'Store': ['ストア', 'ショップ', '店舗', '販売', '小売'],
      'Hotel': ['ホテル', '宿泊', '旅館', 'リゾート'],
      'Hospital': ['病院', 'クリニック', '診療所', '医療'],
      'School': ['学校', '大学', '塾', '教育', 'スクール'],
      'Gym': ['ジム', 'フィットネス', 'スポーツクラブ'],
      'BeautySalon': ['美容室', 'サロン', 'エステ', '美容']
    };
  }

  /**
   * 構造化データの推奨事項を生成
   * @param {Object} pageAnalysis - ページ分析結果 (Phase 2-D: recommendedSchemas を含む場合あり)
   * @param {Object} existingSchemas - 既存のスキーマ情報
   * @param {Object} pageData - ページデータ
   * @returns {Object} 推奨事項
   */
  generateRecommendations(pageAnalysis, existingSchemas = {}, pageData = {}) {
    try {
      const primaryType = pageAnalysis.primaryType || 'Article';
      const confidence = pageAnalysis.confidence || 0;

      // Phase 2-D: LLM が推奨スキーマを返していればそれを優先採用
      const llmRecommended = pageAnalysis.recommendedSchemas;
      const hasLlmSchemas = llmRecommended && (
        (llmRecommended.required && llmRecommended.required.length > 0) ||
        (llmRecommended.recommended && llmRecommended.recommended.length > 0) ||
        (llmRecommended.optional && llmRecommended.optional.length > 0)
      );

      let prioritizedList;
      let source = 'rule-based';
      if (hasLlmSchemas) {
        // LLM 推奨を採用、既存スキーマで重複除外
        prioritizedList = this._buildPrioritizedFromLlm(llmRecommended, existingSchemas);
        source = 'llm';
      } else {
        // 従来通り: ルールベース推奨
        const baseRecommendations = this.getBaseRecommendations(primaryType);
        const missingSchemas = this.findMissingSchemas(baseRecommendations, existingSchemas);
        prioritizedList = this.prioritizeRecommendations(missingSchemas, pageData);
      }

      // 具体的な実装提案を生成
      const implementationSuggestions = this.generateImplementationSuggestions(
        prioritizedList, pageData, primaryType
      );

      // ビジネス特化型の推奨事項（LocalBusinessの場合）
      const businessSpecific = this.getBusinessSpecificRecommendations(
        primaryType, pageData
      );

      return {
        pageType: primaryType,
        confidence: confidence,
        // Phase 2-D: 推奨ソース ('llm' | 'rule-based')
        source: source,
        recommendations: {
          missing: prioritizedList.missing,
          improvements: prioritizedList.improvements,
          optional: prioritizedList.optional
        },
        implementation: implementationSuggestions,
        businessSpecific: businessSpecific,
        expectedBenefits: this.calculateExpectedBenefits(prioritizedList),
        validationSteps: this.getValidationSteps()
      };
    } catch (error) {
      console.error('推奨事項生成エラー:', error);
      return this.getDefaultRecommendations();
    }
  }

  /**
   * 基本推奨事項を取得
   * @param {string} pageType - ページタイプ
   * @returns {Object} 基本推奨事項
   */
  getBaseRecommendations(pageType) {
    const recommendation = this.recommendations[pageType] || this.recommendations.Article;
    
    return {
      primary: recommendation.primary || [],
      secondary: recommendation.secondary || [],
      optional: recommendation.optional || []
    };
  }

  /**
   * 不足しているスキーマを特定
   * @param {Object} recommendations - 推奨事項
   * @param {Object} existingSchemas - 既存スキーマ
   * @returns {Object} 不足スキーマリスト
   */
  findMissingSchemas(recommendations, existingSchemas) {
    const existing = new Set(existingSchemas.jsonLd?.map(schema => 
      Array.isArray(schema.data?.['@type']) ? schema.data['@type'][0] : schema.data?.['@type']
    ).filter(Boolean) || []);

    return {
      primary: recommendations.primary.filter(schema => !existing.has(schema)),
      secondary: recommendations.secondary.filter(schema => !existing.has(schema)),
      optional: recommendations.optional.filter(schema => !existing.has(schema))
    };
  }

  /**
   * 推奨事項を優先度順に並べ替え
   * @param {Object} missingSchemas - 不足スキーマ
   * @param {Object} pageData - ページデータ
   * @returns {Object} 優先度付きリスト
   */
  /**
   * Phase 2-D: LLM の recommendedSchemas を既存の {missing, improvements, optional} 形式に変換
   *
   * @param {Object} llmRecommended - { required: [{schema, reason}], recommended: [...], optional: [...] }
   * @param {Object} existingSchemas - 既存実装スキーマ情報（重複除外用）
   * @returns {Object} { missing, improvements, optional }
   * @private
   */
  _buildPrioritizedFromLlm(llmRecommended, existingSchemas) {
    // 既存スキーマ集合
    const existing = new Set(
      (existingSchemas && Array.isArray(existingSchemas.jsonLd) ? existingSchemas.jsonLd : [])
        .map(s => {
          const t = s && s.data && s.data['@type'];
          if (Array.isArray(t)) return t[0];
          return t;
        })
        .filter(Boolean)
    );

    const buildEntry = (item, priority, impact) => ({
      schema: item.schema,
      priority,
      reason: item.reason || `${item.schema} を実装することを推奨します`,
      impact,
      difficulty: this.getSchemaDifficulty(item.schema),
      seoValue: this.getSEOValue(item.schema),
      source: 'llm',
    });

    const filterUnique = (arr) => {
      const seen = new Set();
      const result = [];
      for (const item of (arr || [])) {
        if (!item || !item.schema) continue;
        if (existing.has(item.schema)) continue;
        if (seen.has(item.schema)) continue;
        seen.add(item.schema);
        result.push(item);
      }
      return result;
    };

    return {
      missing: filterUnique(llmRecommended.required).map(item => buildEntry(item, 'critical', 'high')),
      improvements: filterUnique(llmRecommended.recommended).map(item => buildEntry(item, 'high', 'medium')),
      optional: filterUnique(llmRecommended.optional).map(item => buildEntry(item, 'low', 'low')),
    };
  }

  prioritizeRecommendations(missingSchemas, pageData) {
    const result = {
      missing: [],
      improvements: [],
      optional: []
    };

    // 不足している必須スキーマ（最高優先度）
    missingSchemas.primary.forEach(schema => {
      result.missing.push({
        schema: schema,
        priority: 'critical',
        reason: `${schema}は${this.getSchemaDescription(schema)}として必須です`,
        impact: 'high',
        difficulty: this.getSchemaDifficulty(schema),
        seoValue: this.getSEOValue(schema)
      });
    });

    // 不足している推奨スキーマ（高優先度）
    missingSchemas.secondary.forEach(schema => {
      result.improvements.push({
        schema: schema,
        priority: 'high',
        reason: `${schema}を追加することで${this.getSchemaValue(schema)}`,
        impact: 'medium',
        difficulty: this.getSchemaDifficulty(schema),
        seoValue: this.getSEOValue(schema)
      });
    });

    // オプションスキーマ（低優先度）
    missingSchemas.optional.forEach(schema => {
      result.optional.push({
        schema: schema,
        priority: 'low',
        reason: `${schema}は${this.getSchemaOptionalValue(schema)}`,
        impact: 'low',
        difficulty: this.getSchemaDifficulty(schema),
        seoValue: this.getSEOValue(schema)
      });
    });

    return result;
  }

  /**
   * 具体的な実装提案を生成
   * @param {Object} prioritizedList - 優先度付きリスト
   * @param {Object} pageData - ページデータ
   * @param {string} pageType - ページタイプ
   * @returns {Object} 実装提案
   */
  generateImplementationSuggestions(prioritizedList, pageData, pageType) {
    const suggestions = {
      immediate: [], // 即座に実装すべき
      shortTerm: [], // 1-2週間で実装
      longTerm: []   // 1ヶ月以内に実装
    };

    // 不足スキーマを即座に実装すべき項目として追加
    prioritizedList.missing.forEach(item => {
      suggestions.immediate.push({
        schema: item.schema,
        title: `${item.schema}スキーマの実装`,
        description: item.reason,
        estimatedTime: this.getImplementationTime(item.schema),
        requiredData: this.getRequiredData(item.schema, pageData),
        template: this.getSchemaTemplate(item.schema),
        examples: this.getImplementationExamples(item.schema, pageData),
        benefits: this.getImplementationBenefits(item.schema)
      });
    });

    // 改善スキーマを短期実装項目として追加
    prioritizedList.improvements.forEach(item => {
      suggestions.shortTerm.push({
        schema: item.schema,
        title: `${item.schema}スキーマの追加`,
        description: item.reason,
        estimatedTime: this.getImplementationTime(item.schema),
        requiredData: this.getRequiredData(item.schema, pageData),
        template: this.getSchemaTemplate(item.schema),
        examples: this.getImplementationExamples(item.schema, pageData),
        benefits: this.getImplementationBenefits(item.schema)
      });
    });

    // オプションスキーマを長期実装項目として追加
    prioritizedList.optional.forEach(item => {
      suggestions.longTerm.push({
        schema: item.schema,
        title: `${item.schema}スキーマの検討`,
        description: item.reason,
        estimatedTime: this.getImplementationTime(item.schema),
        requiredData: this.getRequiredData(item.schema, pageData),
        template: this.getSchemaTemplate(item.schema),
        examples: this.getImplementationExamples(item.schema, pageData),
        benefits: this.getImplementationBenefits(item.schema)
      });
    });

    return suggestions;
  }

  /**
   * ビジネス特化型推奨事項を取得
   * @param {string} pageType - ページタイプ
   * @param {Object} pageData - ページデータ
   * @returns {Array} ビジネス特化推奨事項
   */
  getBusinessSpecificRecommendations(pageType, pageData) {
    if (pageType !== 'LocalBusiness') {
      return [];
    }

    const businessType = this.detectBusinessType(pageData);
    const recommendations = [];

    if (businessType) {
      recommendations.push({
        type: 'BusinessType',
        suggestion: `LocalBusinessを${businessType}に特化`,
        description: `より具体的な${businessType}スキーマを使用することで、検索結果での表示が向上します`,
        implementation: `"@type": "${businessType}"`
      });
    }

    // 営業時間の推奨
    if (this.hasBusinessHoursInfo(pageData)) {
      recommendations.push({
        type: 'OpeningHours',
        suggestion: 'OpeningHoursSpecificationの追加',
        description: '営業時間情報を構造化することで、Googleマップでの表示が改善されます',
        implementation: 'openingHoursSpecificationプロパティを追加'
      });
    }

    // 地理的情報の推奨
    if (this.hasLocationInfo(pageData)) {
      recommendations.push({
        type: 'GeoCoordinates',
        suggestion: 'GeoCoordinatesの追加',
        description: '緯度経度情報により、ローカル検索での精度が向上します',
        implementation: 'geoプロパティにGeoCoordinatesを追加'
      });
    }

    return recommendations;
  }

  /**
   * 期待される効果を計算
   * @param {Object} prioritizedList - 優先度付きリスト
   * @returns {Object} 期待される効果
   */
  calculateExpectedBenefits(prioritizedList) {
    const totalItems = prioritizedList.missing.length + 
                      prioritizedList.improvements.length + 
                      prioritizedList.optional.length;

    const criticalItems = prioritizedList.missing.length;
    const highItems = prioritizedList.improvements.length;

    return {
      richSnippets: {
        probability: Math.min(90, criticalItems * 30 + highItems * 15),
        description: 'リッチスニペット表示の可能性'
      },
      searchRanking: {
        improvement: Math.min(20, criticalItems * 5 + highItems * 3),
        description: '検索ランキング向上の見込み（%）'
      },
      clickThroughRate: {
        improvement: Math.min(25, criticalItems * 8 + highItems * 5),
        description: 'クリック率改善の見込み（%）'
      },
      localSearch: {
        visibility: prioritizedList.missing.some(item => 
          ['LocalBusiness', 'Organization'].includes(item.schema)
        ) ? 40 : 10,
        description: 'ローカル検索での表示改善（%）'
      }
    };
  }

  /**
   * 検証手順を取得
   * @returns {Array} 検証手順
   */
  getValidationSteps() {
    return [
      {
        step: 1,
        title: 'Google構造化データテストツールで検証',
        url: 'https://search.google.com/test/rich-results',
        description: '構造化データが正しく認識されるかテストします'
      },
      {
        step: 2,
        title: 'Schema.org検証ツールで確認',
        url: 'https://validator.schema.org/',
        description: 'Schema.orgの仕様に準拠しているか確認します'
      },
      {
        step: 3,
        title: 'Google Search Consoleで監視',
        url: 'https://search.google.com/search-console',
        description: '実装後のリッチスニペット表示状況を監視します'
      },
      {
        step: 4,
        title: 'JSONLDの構文チェック',
        description: 'JSON構文エラーがないか確認します'
      }
    ];
  }

  // ヘルパーメソッド群

  getSchemaDescription(schema) {
    const descriptions = {
      'Article': 'ニュース記事やブログ投稿',
      'Product': '商品情報',
      'LocalBusiness': '店舗・事業所情報',
      'Recipe': 'レシピ情報',
      'Event': 'イベント情報',
      'FAQPage': 'よくある質問ページ',
      'HowTo': 'ハウツー・手順説明',
      'Review': 'レビュー・評価情報',
      'JobPosting': '求人情報',
      'Course': '講座・コース情報'
    };
    return descriptions[schema] || 'コンテンツ';
  }

  getSchemaValue(schema) {
    const values = {
      'Organization': 'サイトの信頼性が向上します',
      'Person': '著者情報が明確になります',
      'BreadcrumbList': 'ナビゲーション情報が改善されます',
      'Rating': '評価情報が表示されます',
      'AggregateRating': '平均評価が表示されます',
      'Offer': '価格・購入情報が表示されます'
    };
    return values[schema] || 'SEO効果が期待できます';
  }

  getSchemaOptionalValue(schema) {
    const values = {
      'Comment': 'コメント情報を構造化できます',
      'Video': '動画コンテンツが認識されます',
      'Brand': 'ブランド情報が明確になります',
      'ContactPoint': '連絡先情報が整理されます'
    };
    return values[schema] || '付加価値を提供します';
  }

  getSchemaDifficulty(schema) {
    const difficulties = {
      'Article': 'easy',
      'Product': 'medium',
      'LocalBusiness': 'medium',
      'Recipe': 'hard',
      'Event': 'medium',
      'FAQPage': 'easy',
      'HowTo': 'hard',
      'Review': 'easy',
      'JobPosting': 'medium',
      'Course': 'medium'
    };
    return difficulties[schema] || 'medium';
  }

  getSEOValue(schema) {
    const values = {
      'Article': 85,
      'Product': 90,
      'LocalBusiness': 88,
      'Recipe': 92,
      'Event': 85,
      'FAQPage': 80,
      'HowTo': 87,
      'Review': 83,
      'JobPosting': 85,
      'Course': 82
    };
    return values[schema] || 75;
  }

  getImplementationTime(schema) {
    const times = {
      'Article': '30分',
      'Product': '1-2時間',
      'LocalBusiness': '1時間',
      'Recipe': '2-3時間',
      'Event': '1時間',
      'FAQPage': '30分',
      'HowTo': '2-3時間',
      'Review': '30分',
      'JobPosting': '1時間',
      'Course': '1-2時間'
    };
    return times[schema] || '1時間';
  }

  getRequiredData(schema, pageData) {
    // スキーマテンプレートから必要データを取得（次のファイルで実装予定）
    return `${schema}に必要なデータ項目を確認してください`;
  }

  getSchemaTemplate(schema) {
    return `${schema}のテンプレート（schema-templates.jsで実装予定）`;
  }

  getImplementationExamples(schema, pageData) {
    return [`${schema}の実装例を参照してください`];
  }

  getImplementationBenefits(schema) {
    return [`${schema}実装による具体的なメリット`];
  }

  detectBusinessType(pageData) {
    const text = (pageData.title + ' ' + pageData.bodyText).toLowerCase();
    
    for (const [type, keywords] of Object.entries(this.businessTypes)) {
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return type;
      }
    }
    
    return null;
  }

  hasBusinessHoursInfo(pageData) {
    return /営業時間|開店|閉店|定休日/.test(pageData.bodyText);
  }

  hasLocationInfo(pageData) {
    return /住所|所在地|アクセス|地図/.test(pageData.bodyText);
  }

  getDefaultRecommendations() {
    return {
      pageType: 'Article',
      confidence: 0,
      recommendations: {
        missing: [{
          schema: 'Article',
          priority: 'critical',
          reason: 'デフォルト推奨事項',
          impact: 'high'
        }],
        improvements: [],
        optional: []
      },
      implementation: {
        immediate: [],
        shortTerm: [],
        longTerm: []
      },
      businessSpecific: [],
      expectedBenefits: {
        richSnippets: { probability: 30, description: 'リッチスニペット表示の可能性' }
      },
      validationSteps: this.getValidationSteps()
    };
  }
}

module.exports = StructuredDataRecommender;
