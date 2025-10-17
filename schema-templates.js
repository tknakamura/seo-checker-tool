/**
 * スキーマテンプレート集
 * 各構造化データタイプの完全なJSON-LDテンプレートと、実際のページデータからの値抽出ロジック
 */
class SchemaTemplates {
  constructor() {
    // データ抽出用の正規表現パターン
    this.extractionPatterns = {
      price: /[￥$€£]\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*円/g,
      rating: /★+|☆+|(\d+(?:\.\d+)?)\s*(?:点|stars?|\/\d+)/gi,
      date: /\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}日?/g,
      time: /\d{1,2}:\d{2}(?::\d{2})?/g,
      phone: /\d{2,4}[-‐]\d{2,4}[-‐]\d{3,4}|\d{10,11}/g,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      address: /[都道府県][市区町村][^0-9]*\d+[-‐]\d+[-‐]\d+/g
    };
  }

  /**
   * 指定されたスキーマタイプのテンプレートを取得し、実際のデータで埋める
   * @param {string} schemaType - スキーマタイプ
   * @param {Object} pageData - ページデータ
   * @param {Object} $ - Cheerioオブジェクト
   * @returns {Object} 埋められたスキーマテンプレート
   */
  generateSchema(schemaType, pageData, $) {
    try {
      const template = this.getTemplate(schemaType);
      if (!template) {
        throw new Error(`Unknown schema type: ${schemaType}`);
      }

      // テンプレートに実際のデータを埋め込み
      const filledTemplate = this.fillTemplate(template, pageData, $);
      
      return {
        success: true,
        schema: filledTemplate,
        implementationGuide: this.getImplementationGuide(schemaType),
        requiredData: this.getRequiredData(schemaType),
        optionalData: this.getOptionalData(schemaType)
      };
    } catch (error) {
      console.error(`Schema generation error for ${schemaType}:`, error);
      return {
        success: false,
        error: error.message,
        schema: this.getBasicTemplate(schemaType),
        implementationGuide: this.getImplementationGuide(schemaType)
      };
    }
  }

  /**
   * スキーマテンプレートを取得
   * @param {string} schemaType - スキーマタイプ
   * @returns {Object|null} テンプレート
   */
  getTemplate(schemaType) {
    const templates = {
      Article: this.getArticleTemplate(),
      NewsArticle: this.getNewsArticleTemplate(),
      BlogPosting: this.getBlogPostingTemplate(),
      Product: this.getProductTemplate(),
      LocalBusiness: this.getLocalBusinessTemplate(),
      Recipe: this.getRecipeTemplate(),
      Event: this.getEventTemplate(),
      FAQPage: this.getFAQPageTemplate(),
      HowTo: this.getHowToTemplate(),
      Review: this.getReviewTemplate(),
      JobPosting: this.getJobPostingTemplate(),
      Course: this.getCourseTemplate(),
      Organization: this.getOrganizationTemplate(),
      Person: this.getPersonTemplate(),
      BreadcrumbList: this.getBreadcrumbListTemplate()
    };

    return templates[schemaType] || null;
  }

  // 個別スキーマテンプレート定義

  getArticleTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "{{title}}",
      "description": "{{description}}",
      "image": "{{mainImage}}",
      "author": {
        "@type": "Person",
        "name": "{{authorName}}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "{{publisherName}}",
        "logo": {
          "@type": "ImageObject",
          "url": "{{publisherLogo}}"
        }
      },
      "datePublished": "{{publishDate}}",
      "dateModified": "{{modifiedDate}}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "{{url}}"
      }
    };
  }

  getNewsArticleTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "{{title}}",
      "description": "{{description}}",
      "image": "{{mainImage}}",
      "author": {
        "@type": "Person",
        "name": "{{authorName}}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "{{publisherName}}",
        "logo": {
          "@type": "ImageObject",
          "url": "{{publisherLogo}}"
        }
      },
      "datePublished": "{{publishDate}}",
      "dateModified": "{{modifiedDate}}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "{{url}}"
      },
      "articleSection": "{{category}}"
    };
  }

  getBlogPostingTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "{{title}}",
      "description": "{{description}}",
      "image": "{{mainImage}}",
      "author": {
        "@type": "Person",
        "name": "{{authorName}}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "{{publisherName}}",
        "logo": {
          "@type": "ImageObject",
          "url": "{{publisherLogo}}"
        }
      },
      "datePublished": "{{publishDate}}",
      "dateModified": "{{modifiedDate}}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "{{url}}"
      },
      "keywords": "{{keywords}}"
    };
  }

  getProductTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "{{productName}}",
      "description": "{{description}}",
      "image": "{{productImage}}",
      "brand": {
        "@type": "Brand",
        "name": "{{brandName}}"
      },
      "offers": {
        "@type": "Offer",
        "price": "{{price}}",
        "priceCurrency": "JPY",
        "availability": "{{availability}}",
        "seller": {
          "@type": "Organization",
          "name": "{{sellerName}}"
        }
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "{{ratingValue}}",
        "reviewCount": "{{reviewCount}}"
      },
      "sku": "{{sku}}",
      "gtin": "{{gtin}}"
    };
  }

  getLocalBusinessTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "{{businessName}}",
      "description": "{{description}}",
      "image": "{{businessImage}}",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "{{streetAddress}}",
        "addressLocality": "{{city}}",
        "addressRegion": "{{state}}",
        "postalCode": "{{postalCode}}",
        "addressCountry": "JP"
      },
      "telephone": "{{phone}}",
      "url": "{{website}}",
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "{{latitude}}",
        "longitude": "{{longitude}}"
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          "opens": "{{weekdayOpen}}",
          "closes": "{{weekdayClose}}"
        }
      ],
      "priceRange": "{{priceRange}}"
    };
  }

  getRecipeTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Recipe",
      "name": "{{recipeName}}",
      "description": "{{description}}",
      "image": "{{recipeImage}}",
      "author": {
        "@type": "Person",
        "name": "{{authorName}}"
      },
      "prepTime": "{{prepTime}}",
      "cookTime": "{{cookTime}}",
      "totalTime": "{{totalTime}}",
      "recipeYield": "{{servings}}",
      "recipeCategory": "{{category}}",
      "recipeCuisine": "{{cuisine}}",
      "recipeIngredient": "{{ingredients}}",
      "recipeInstructions": "{{instructions}}",
      "nutrition": {
        "@type": "NutritionInformation",
        "calories": "{{calories}}"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "{{ratingValue}}",
        "reviewCount": "{{reviewCount}}"
      }
    };
  }

  getEventTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "{{eventName}}",
      "description": "{{description}}",
      "image": "{{eventImage}}",
      "startDate": "{{startDate}}",
      "endDate": "{{endDate}}",
      "location": {
        "@type": "Place",
        "name": "{{venueName}}",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "{{streetAddress}}",
          "addressLocality": "{{city}}",
          "addressRegion": "{{state}}",
          "postalCode": "{{postalCode}}",
          "addressCountry": "JP"
        }
      },
      "organizer": {
        "@type": "Organization",
        "name": "{{organizerName}}",
        "url": "{{organizerUrl}}"
      },
      "offers": {
        "@type": "Offer",
        "price": "{{ticketPrice}}",
        "priceCurrency": "JPY",
        "availability": "{{availability}}",
        "url": "{{ticketUrl}}"
      }
    };
  }

  getFAQPageTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": "{{faqItems}}"
    };
  }

  getHowToTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "{{title}}",
      "description": "{{description}}",
      "image": "{{image}}",
      "totalTime": "{{totalTime}}",
      "supply": "{{supplies}}",
      "tool": "{{tools}}",
      "step": "{{steps}}"
    };
  }

  getReviewTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Review",
      "itemReviewed": {
        "@type": "{{reviewedItemType}}",
        "name": "{{reviewedItemName}}"
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "{{ratingValue}}",
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": "{{authorName}}"
      },
      "reviewBody": "{{reviewText}}",
      "datePublished": "{{publishDate}}"
    };
  }

  getJobPostingTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "{{jobTitle}}",
      "description": "{{jobDescription}}",
      "hiringOrganization": {
        "@type": "Organization",
        "name": "{{companyName}}",
        "sameAs": "{{companyUrl}}"
      },
      "jobLocation": {
        "@type": "Place",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "{{city}}",
          "addressRegion": "{{state}}",
          "addressCountry": "JP"
        }
      },
      "baseSalary": {
        "@type": "MonetaryAmount",
        "currency": "JPY",
        "value": {
          "@type": "QuantitativeValue",
          "minValue": "{{minSalary}}",
          "maxValue": "{{maxSalary}}",
          "unitText": "MONTH"
        }
      },
      "employmentType": "{{employmentType}}",
      "datePosted": "{{postDate}}",
      "validThrough": "{{validThrough}}"
    };
  }

  getCourseTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": "{{courseName}}",
      "description": "{{description}}",
      "provider": {
        "@type": "Organization",
        "name": "{{providerName}}"
      },
      "hasCourseInstance": {
        "@type": "CourseInstance",
        "courseMode": "{{courseMode}}",
        "courseSchedule": {
          "@type": "Schedule",
          "duration": "{{duration}}",
          "repeatFrequency": "{{frequency}}"
        },
        "instructor": {
          "@type": "Person",
          "name": "{{instructorName}}"
        }
      },
      "offers": {
        "@type": "Offer",
        "price": "{{price}}",
        "priceCurrency": "JPY"
      }
    };
  }

  getOrganizationTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "{{organizationName}}",
      "url": "{{website}}",
      "logo": "{{logo}}",
      "description": "{{description}}",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "{{streetAddress}}",
        "addressLocality": "{{city}}",
        "addressRegion": "{{state}}",
        "postalCode": "{{postalCode}}",
        "addressCountry": "JP"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "{{phone}}",
        "contactType": "customer service"
      },
      "sameAs": "{{socialProfiles}}"
    };
  }

  getPersonTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "{{name}}",
      "jobTitle": "{{jobTitle}}",
      "affiliation": {
        "@type": "Organization",
        "name": "{{organization}}"
      },
      "url": "{{website}}",
      "sameAs": "{{socialProfiles}}"
    };
  }

  getBreadcrumbListTemplate() {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": "{{breadcrumbItems}}"
    };
  }

  /**
   * テンプレートに実際のデータを埋め込み
   * @param {Object} template - スキーマテンプレート
   * @param {Object} pageData - ページデータ
   * @param {Object} $ - Cheerioオブジェクト
   * @returns {Object} データが埋め込まれたスキーマ
   */
  fillTemplate(template, pageData, $) {
    const templateStr = JSON.stringify(template);
    const extractedData = this.extractDataFromPage(pageData, $, template['@type']);
    
    let filledStr = templateStr;
    
    // プレースホルダーを実際の値で置換
    Object.entries(extractedData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      filledStr = filledStr.replace(new RegExp(placeholder, 'g'), value || '');
    });

    // 空の値や不要なプロパティを削除
    const filled = JSON.parse(filledStr);
    return this.cleanSchema(filled);
  }

  /**
   * ページから必要なデータを抽出
   * @param {Object} pageData - ページデータ
   * @param {Object} $ - Cheerioオブジェクト
   * @param {string} schemaType - スキーマタイプ
   * @returns {Object} 抽出されたデータ
   */
  extractDataFromPage(pageData, $, schemaType) {
    const extracted = {};

    // 基本情報の抽出
    extracted.title = pageData.title || $('title').text().trim();
    extracted.description = pageData.metaDescription || 
                           $('meta[name="description"]').attr('content') || 
                           this.generateDescription(pageData.bodyText);
    extracted.url = pageData.url || '';

    // スキーマタイプ別の特殊抽出
    switch (schemaType) {
      case 'Article':
      case 'NewsArticle':
      case 'BlogPosting':
        Object.assign(extracted, this.extractArticleData($, pageData));
        break;
      case 'Product':
        Object.assign(extracted, this.extractProductData($, pageData));
        break;
      case 'LocalBusiness':
        Object.assign(extracted, this.extractLocalBusinessData($, pageData));
        break;
      case 'Recipe':
        Object.assign(extracted, this.extractRecipeData($, pageData));
        break;
      case 'Event':
        Object.assign(extracted, this.extractEventData($, pageData));
        break;
      case 'FAQPage':
        Object.assign(extracted, this.extractFAQData($, pageData));
        break;
      case 'HowTo':
        Object.assign(extracted, this.extractHowToData($, pageData));
        break;
      case 'Review':
        Object.assign(extracted, this.extractReviewData($, pageData));
        break;
      case 'JobPosting':
        Object.assign(extracted, this.extractJobData($, pageData));
        break;
      case 'Course':
        Object.assign(extracted, this.extractCourseData($, pageData));
        break;
    }

    return extracted;
  }

  // データ抽出メソッド群
  extractArticleData($, pageData) {
    return {
      authorName: this.extractAuthor($) || 'サイト運営者',
      publisherName: this.extractPublisher($) || 'サイト名',
      publishDate: this.extractPublishDate($) || new Date().toISOString().split('T')[0],
      modifiedDate: this.extractModifiedDate($) || new Date().toISOString().split('T')[0],
      mainImage: this.extractMainImage($),
      publisherLogo: this.extractLogo($),
      keywords: this.extractKeywords($, pageData),
      category: this.extractCategory($)
    };
  }

  extractProductData($, pageData) {
    return {
      productName: pageData.title,
      productImage: this.extractMainImage($),
      brandName: this.extractBrand($),
      price: this.extractPrice($, pageData),
      availability: this.extractAvailability($),
      sellerName: this.extractSeller($),
      ratingValue: this.extractRating($),
      reviewCount: this.extractReviewCount($),
      sku: this.extractSKU($),
      gtin: this.extractGTIN($)
    };
  }

  extractLocalBusinessData($, pageData) {
    return {
      businessName: pageData.title,
      businessImage: this.extractMainImage($),
      streetAddress: this.extractAddress($),
      city: this.extractCity($),
      state: this.extractState($),
      postalCode: this.extractPostalCode($),
      phone: this.extractPhone($),
      website: pageData.url,
      latitude: this.extractLatitude($),
      longitude: this.extractLongitude($),
      weekdayOpen: this.extractOpenTime($),
      weekdayClose: this.extractCloseTime($),
      priceRange: this.extractPriceRange($)
    };
  }

  extractRecipeData($, pageData) {
    return {
      recipeName: pageData.title,
      recipeImage: this.extractMainImage($),
      authorName: this.extractAuthor($),
      prepTime: this.extractPrepTime($),
      cookTime: this.extractCookTime($),
      totalTime: this.extractTotalTime($),
      servings: this.extractServings($),
      category: this.extractRecipeCategory($),
      cuisine: this.extractCuisine($),
      ingredients: this.extractIngredients($),
      instructions: this.extractInstructions($),
      calories: this.extractCalories($),
      ratingValue: this.extractRating($),
      reviewCount: this.extractReviewCount($)
    };
  }

  extractEventData($, pageData) {
    return {
      eventName: pageData.title,
      eventImage: this.extractMainImage($),
      startDate: this.extractStartDate($),
      endDate: this.extractEndDate($),
      venueName: this.extractVenue($),
      streetAddress: this.extractAddress($),
      city: this.extractCity($),
      state: this.extractState($),
      postalCode: this.extractPostalCode($),
      organizerName: this.extractOrganizer($),
      organizerUrl: this.extractOrganizerUrl($),
      ticketPrice: this.extractTicketPrice($),
      availability: this.extractAvailability($),
      ticketUrl: this.extractTicketUrl($)
    };
  }

  extractFAQData($, pageData) {
    const faqItems = [];
    
    // Q&A形式の検出
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      if (/^Q\s*[:：]/.test(text)) {
        const question = text.replace(/^Q\s*[:：]\s*/, '');
        const nextEl = $(el).next();
        if (nextEl.length && /^A\s*[:：]/.test(nextEl.text())) {
          const answer = nextEl.text().replace(/^A\s*[:：]\s*/, '');
          faqItems.push({
            "@type": "Question",
            "name": question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": answer
            }
          });
        }
      }
    });

    return {
      faqItems: faqItems
    };
  }

  extractHowToData($, pageData) {
    return {
      totalTime: this.extractTotalTime($),
      supplies: this.extractSupplies($),
      tools: this.extractTools($),
      steps: this.extractSteps($),
      image: this.extractMainImage($)
    };
  }

  extractReviewData($, pageData) {
    return {
      reviewedItemType: this.extractReviewedItemType($),
      reviewedItemName: this.extractReviewedItemName($),
      ratingValue: this.extractRating($),
      authorName: this.extractAuthor($),
      reviewText: this.extractReviewText($, pageData),
      publishDate: this.extractPublishDate($) || new Date().toISOString().split('T')[0]
    };
  }

  extractJobData($, pageData) {
    return {
      jobTitle: pageData.title,
      jobDescription: pageData.description,
      companyName: this.extractCompanyName($),
      companyUrl: this.extractCompanyUrl($),
      city: this.extractCity($),
      state: this.extractState($),
      minSalary: this.extractMinSalary($),
      maxSalary: this.extractMaxSalary($),
      employmentType: this.extractEmploymentType($),
      postDate: this.extractPostDate($),
      validThrough: this.extractValidThrough($)
    };
  }

  extractCourseData($, pageData) {
    return {
      courseName: pageData.title,
      providerName: this.extractProvider($),
      courseMode: this.extractCourseMode($),
      duration: this.extractDuration($),
      frequency: this.extractFrequency($),
      instructorName: this.extractInstructor($),
      price: this.extractPrice($, pageData)
    };
  }

  // 汎用データ抽出ヘルパーメソッド
  extractAuthor($) {
    return $('[rel="author"], .author, [itemprop="author"]').first().text().trim() || 
           $('meta[name="author"]').attr('content') || '';
  }

  extractPublisher($) {
    return $('[itemprop="publisher"]').first().text().trim() || 
           $('meta[property="og:site_name"]').attr('content') ||
           $('title').text().split('|').pop().trim() || '';
  }

  extractMainImage($) {
    return $('meta[property="og:image"]').attr('content') ||
           $('img').first().attr('src') || '';
  }

  extractPrice($, pageData) {
    const priceMatch = pageData.bodyText.match(this.extractionPatterns.price);
    return priceMatch ? priceMatch[0].replace(/[^\d,.]/g, '') : '';
  }

  extractRating($) {
    const ratingText = $('body').text();
    const ratingMatch = ratingText.match(this.extractionPatterns.rating);
    return ratingMatch ? ratingMatch[1] || ratingMatch[0].length : '';
  }

  extractAddress($) {
    const addressText = $('body').text();
    const addressMatch = addressText.match(this.extractionPatterns.address);
    return addressMatch ? addressMatch[0] : '';
  }

  extractPhone($) {
    const phoneText = $('body').text();
    const phoneMatch = phoneText.match(this.extractionPatterns.phone);
    return phoneMatch ? phoneMatch[0] : '';
  }

  generateDescription(bodyText) {
    if (!bodyText) return '';
    
    const sentences = bodyText.split(/[。！？]/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 2).join('。') + (sentences.length > 0 ? '。' : '');
  }

  /**
   * スキーマから空の値や不要なプロパティを削除
   * @param {Object} schema - スキーマオブジェクト
   * @returns {Object} クリーンアップされたスキーマ
   */
  cleanSchema(schema) {
    const cleaned = {};
    
    Object.entries(schema).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '' && value !== '{{' + key + '}}') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleanedObject = this.cleanSchema(value);
          if (Object.keys(cleanedObject).length > 0) {
            cleaned[key] = cleanedObject;
          }
        } else if (Array.isArray(value)) {
          const cleanedArray = value.filter(item => 
            item !== null && item !== undefined && item !== '' && 
            (typeof item !== 'string' || !item.includes('{{'))
          );
          if (cleanedArray.length > 0) {
            cleaned[key] = cleanedArray;
          }
        } else {
          cleaned[key] = value;
        }
      }
    });
    
    return cleaned;
  }

  /**
   * 実装ガイドを取得
   * @param {string} schemaType - スキーマタイプ
   * @returns {Array} 実装ガイド
   */
  getImplementationGuide(schemaType) {
    const guides = {
      Article: [
        'headタグ内にJSON-LDスクリプトを追加',
        'headline、author、publisherは必須項目',
        'datePublished、dateModifiedを含めることを推奨',
        'mainEntityOfPageでページURLを指定'
      ],
      Product: [
        'name、offers、imageは必須項目',
        'aggregateRatingがあるとリッチスニペット表示の可能性が向上',
        'priceValidUntilで価格の有効期限を指定',
        'availabilityで在庫状況を明示'
      ],
      LocalBusiness: [
        'name、addressは必須項目',
        'openingHoursSpecificationで営業時間を詳細に記載',
        'geoCoordinatesでより正確な位置情報を提供',
        'telephoneでの連絡先情報は必ず含める'
      ]
    };

    return guides[schemaType] || [
      'Schema.orgの仕様に従って実装',
      '必須プロパティを確認して設定',
      'Google構造化データテストツールで検証'
    ];
  }

  /**
   * 必須データ項目を取得
   * @param {string} schemaType - スキーマタイプ
   * @returns {Array} 必須データ項目
   */
  getRequiredData(schemaType) {
    const requiredData = {
      Article: ['headline', 'author', 'publisher', 'datePublished'],
      Product: ['name', 'offers', 'image'],
      LocalBusiness: ['name', 'address'],
      Recipe: ['name', 'recipeIngredient', 'recipeInstructions'],
      Event: ['name', 'startDate', 'location'],
      FAQPage: ['mainEntity'],
      HowTo: ['name', 'step'],
      Review: ['itemReviewed', 'reviewRating', 'author'],
      JobPosting: ['title', 'description', 'hiringOrganization'],
      Course: ['name', 'provider']
    };

    return requiredData[schemaType] || [];
  }

  /**
   * 推奨データ項目を取得
   * @param {string} schemaType - スキーマタイプ  
   * @returns {Array} 推奨データ項目
   */
  getOptionalData(schemaType) {
    const optionalData = {
      Article: ['image', 'dateModified', 'mainEntityOfPage', 'keywords'],
      Product: ['brand', 'aggregateRating', 'review', 'sku'],
      LocalBusiness: ['telephone', 'openingHours', 'priceRange', 'geo'],
      Recipe: ['author', 'nutrition', 'aggregateRating', 'prepTime'],
      Event: ['offers', 'organizer', 'image', 'endDate'],
      FAQPage: ['breadcrumb', 'lastReviewed'],
      HowTo: ['image', 'video', 'totalTime', 'supply'],
      Review: ['reviewBody', 'datePublished'],
      JobPosting: ['baseSalary', 'benefits', 'qualifications'],
      Course: ['offers', 'coursePrerequisites', 'educationalCredentialAwarded']
    };

    return optionalData[schemaType] || [];
  }

  // より多くのヘルパーメソッドを追加
  extractPublishDate($) {
    return $('time[datetime], [datetime]').first().attr('datetime') ||
           $('meta[property="article:published_time"]').attr('content') || '';
  }

  extractModifiedDate($) {
    return $('time[datetime][itemprop="dateModified"]').attr('datetime') ||
           $('meta[property="article:modified_time"]').attr('content') || '';
  }

  extractLogo($) {
    return $('meta[property="og:image"]').attr('content') ||
           $('.logo img, #logo img').first().attr('src') || '';
  }

  extractKeywords($, pageData) {
    return $('meta[name="keywords"]').attr('content') ||
           pageData.headings.slice(0, 5).join(', ') || '';
  }

  extractCategory($) {
    return $('meta[property="article:section"]').attr('content') ||
           $('.category, .tag').first().text().trim() || '';
  }

  // 追加のヘルパーメソッドは必要に応じて実装
  extractBrand($) { return ''; }
  extractAvailability($) { return 'InStock'; }
  extractSeller($) { return ''; }
  extractReviewCount($) { return ''; }
  extractSKU($) { return ''; }
  extractGTIN($) { return ''; }
  extractCity($) { return ''; }
  extractState($) { return ''; }
  extractPostalCode($) { return ''; }
  extractLatitude($) { return ''; }
  extractLongitude($) { return ''; }
  extractOpenTime($) { return '09:00'; }
  extractCloseTime($) { return '18:00'; }
  extractPriceRange($) { return '$$'; }

  getBasicTemplate(schemaType) {
    return {
      "@context": "https://schema.org",
      "@type": schemaType,
      "name": "ページタイトルを入力してください",
      "description": "ページの説明を入力してください"
    };
  }
}

module.exports = SchemaTemplates;
