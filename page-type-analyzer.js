/**
 * ページタイプ分析エンジン
 * ページコンテンツを分析してそのページにふさわしい構造化データタイプを自動判定
 */
class PageTypeAnalyzer {
  constructor() {
    // ページタイプ別のキーワードパターン
    this.patterns = {
      Article: {
        keywords: ['記事', 'ブログ', 'ニュース', '投稿', 'コラム', 'レポート', '解説'],
        urlPatterns: ['/blog/', '/news/', '/article/', '/post/', '/column/'],
        titlePatterns: ['～について', '～とは', '～を解説', '～のまとめ'],
        contentPatterns: ['公開日', '更新日', '執筆者', '著者', 'シェア', 'いいね']
      },
      Product: {
        keywords: ['商品', '製品', '価格', '購入', '在庫', 'レビュー', '評価', 'カート', '送料'],
        urlPatterns: ['/product/', '/item/', '/goods/', '/shop/', '/store/'],
        titlePatterns: ['～を購入', '～の価格', '～のレビュー', '価格：', '￥'],
        contentPatterns: ['価格', '在庫', 'カートに入れる', '購入する', '送料', '配送', '保証']
      },
      LocalBusiness: {
        keywords: ['店舗', '営業時間', '住所', '電話番号', 'アクセス', '地図', '駐車場', '予約'],
        urlPatterns: ['/company/', '/about/', '/contact/', '/access/', '/shop/'],
        titlePatterns: ['会社概要', '店舗情報', 'アクセス', '営業時間', '～店'],
        contentPatterns: ['営業時間', '定休日', '住所', '電話', 'TEL', '地図', 'アクセス']
      },
      Recipe: {
        keywords: ['レシピ', '料理', '材料', '作り方', '調理', '手順', '分量', '調理時間'],
        urlPatterns: ['/recipe/', '/cooking/', '/food/'],
        titlePatterns: ['～のレシピ', '～の作り方', '簡単', '手作り'],
        contentPatterns: ['材料', '分量', '手順', '調理時間', '人前', 'カロリー', '栄養']
      },
      Event: {
        keywords: ['イベント', '開催', '日時', '場所', '参加', 'チケット', '予約', '会場'],
        urlPatterns: ['/event/', '/seminar/', '/conference/', '/workshop/'],
        titlePatterns: ['開催のお知らせ', 'イベント情報', 'セミナー', '講座'],
        contentPatterns: ['開催日', '開催時間', '会場', '参加費', '定員', 'お申込み']
      },
      FAQ: {
        keywords: ['よくある質問', 'FAQ', 'Q&A', '質問', '回答', 'ヘルプ', 'サポート'],
        urlPatterns: ['/faq/', '/help/', '/support/', '/qa/'],
        titlePatterns: ['よくある質問', 'FAQ', 'Q&A', 'ヘルプ'],
        contentPatterns: ['Q:', 'A:', '質問：', '回答：', 'よくある質問']
      },
      HowTo: {
        keywords: ['方法', 'やり方', '手順', 'ステップ', 'ガイド', 'チュートリアル', '使い方'],
        urlPatterns: ['/howto/', '/guide/', '/tutorial/', '/manual/'],
        titlePatterns: ['～の方法', '～のやり方', '～ガイド', 'ステップ', '手順'],
        contentPatterns: ['ステップ', '手順', '方法', 'STEP', 'まず', '次に', '最後に']
      },
      Review: {
        keywords: ['レビュー', '評価', '口コミ', '感想', '体験談', '評判', '星'],
        urlPatterns: ['/review/', '/rating/', '/evaluation/'],
        titlePatterns: ['レビュー', '評価', '口コミ', '体験談', '～を試してみた'],
        contentPatterns: ['評価', '★', '☆', '星', '点数', 'おすすめ', 'メリット', 'デメリット']
      },
      JobPosting: {
        keywords: ['求人', '採用', '募集', '仕事', '転職', '就職', '給与', '勤務地'],
        urlPatterns: ['/job/', '/career/', '/recruit/', '/hiring/'],
        titlePatterns: ['求人情報', '採用情報', '募集要項', '正社員', 'アルバイト'],
        contentPatterns: ['募集要項', '給与', '勤務地', '勤務時間', '応募資格', '福利厚生']
      },
      Course: {
        keywords: ['講座', 'コース', '授業', '学習', '教育', 'スクール', '研修', 'カリキュラム'],
        urlPatterns: ['/course/', '/class/', '/training/', '/education/'],
        titlePatterns: ['講座', 'コース', '研修', 'スクール', '～を学ぶ'],
        contentPatterns: ['カリキュラム', '学習内容', '期間', '受講料', '講師', '資格']
      }
    };

    // 重み付け設定
    this.weights = {
      title: 3.0,
      meta: 2.5,
      headings: 2.0,
      url: 2.0,
      content: 1.0
    };
  }

  /**
   * ページタイプを分析
   * @param {Object} $ - Cheerioオブジェクト
   * @param {string} url - ページURL
   * @returns {Object} 分析結果
   */
  analyzePage($, url) {
    try {
      const pageData = this.extractPageData($, url);
      const typeScores = this.calculateTypeScores(pageData);
      const detectedTypes = this.getTopTypes(typeScores);
      
      return {
        primaryType: detectedTypes[0],
        secondaryTypes: detectedTypes.slice(1, 3),
        confidence: typeScores[detectedTypes[0]] || 0,
        allScores: typeScores,
        analysisDetails: {
          pageData: pageData,
          matchedPatterns: this.getMatchedPatterns(pageData, detectedTypes[0])
        }
      };
    } catch (error) {
      console.error('ページタイプ分析エラー:', error);
      return {
        primaryType: 'Article', // デフォルト
        secondaryTypes: [],
        confidence: 0,
        allScores: {},
        analysisDetails: {
          error: error.message
        }
      };
    }
  }

  /**
   * ページデータを抽出
   * @param {Object} $ - Cheerioオブジェクト
   * @param {string} url - ページURL
   * @returns {Object} 抽出されたページデータ
   */
  extractPageData($, url) {
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const headings = [];
    
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      headings.push($(el).text().trim());
    });

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const contentLength = bodyText.length;
    
    // 特殊要素の存在チェック
    const hasPrice = this.hasPriceElements($);
    const hasReviewElements = this.hasReviewElements($);
    const hasEventElements = this.hasEventElements($);
    const hasRecipeElements = this.hasRecipeElements($);
    const hasFAQElements = this.hasFAQElements($);
    const hasJobElements = this.hasJobElements($);
    const hasCourseElements = this.hasCourseElements($);

    return {
      title,
      metaDescription,
      headings,
      url: url || '',
      bodyText,
      contentLength,
      specialElements: {
        price: hasPrice,
        review: hasReviewElements,
        event: hasEventElements,
        recipe: hasRecipeElements,
        faq: hasFAQElements,
        job: hasJobElements,
        course: hasCourseElements
      }
    };
  }

  /**
   * 各ページタイプのスコアを計算
   * @param {Object} pageData - ページデータ
   * @returns {Object} タイプ別スコア
   */
  calculateTypeScores(pageData) {
    const scores = {};
    
    Object.keys(this.patterns).forEach(type => {
      scores[type] = this.calculateSingleTypeScore(type, pageData);
    });

    // 特殊要素による補正
    this.applySpecialElementBonus(scores, pageData.specialElements);

    return scores;
  }

  /**
   * 単一ページタイプのスコアを計算
   * @param {string} type - ページタイプ
   * @param {Object} pageData - ページデータ
   * @returns {number} スコア
   */
  calculateSingleTypeScore(type, pageData) {
    const pattern = this.patterns[type];
    let score = 0;

    // タイトルでの一致
    score += this.countMatches(pageData.title, pattern.keywords) * this.weights.title;
    score += this.countPatternMatches(pageData.title, pattern.titlePatterns) * this.weights.title;

    // メタディスクリプションでの一致
    score += this.countMatches(pageData.metaDescription, pattern.keywords) * this.weights.meta;

    // 見出しでの一致
    const headingsText = pageData.headings.join(' ');
    score += this.countMatches(headingsText, pattern.keywords) * this.weights.headings;

    // URLでの一致
    score += this.countPatternMatches(pageData.url, pattern.urlPatterns) * this.weights.url;

    // 本文での一致
    score += this.countMatches(pageData.bodyText, pattern.keywords) * this.weights.content;
    score += this.countMatches(pageData.bodyText, pattern.contentPatterns) * this.weights.content;

    return score;
  }

  /**
   * キーワードマッチ数をカウント
   * @param {string} text - 対象テキスト
   * @param {Array} keywords - キーワード配列
   * @returns {number} マッチ数
   */
  countMatches(text, keywords) {
    if (!text || !keywords) return 0;
    
    const lowerText = text.toLowerCase();
    return keywords.reduce((count, keyword) => {
      const matches = (lowerText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
      return count + matches;
    }, 0);
  }

  /**
   * パターンマッチ数をカウント
   * @param {string} text - 対象テキスト
   * @param {Array} patterns - パターン配列
   * @returns {number} マッチ数
   */
  countPatternMatches(text, patterns) {
    if (!text || !patterns) return 0;
    
    return patterns.reduce((count, pattern) => {
      if (text.includes(pattern)) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  /**
   * 特殊要素によるスコア補正
   * @param {Object} scores - スコアオブジェクト
   * @param {Object} specialElements - 特殊要素の存在フラグ
   */
  applySpecialElementBonus(scores, specialElements) {
    if (specialElements.price) {
      scores.Product = (scores.Product || 0) + 10;
    }
    if (specialElements.review) {
      scores.Review = (scores.Review || 0) + 8;
      scores.Product = (scores.Product || 0) + 5;
    }
    if (specialElements.event) {
      scores.Event = (scores.Event || 0) + 12;
    }
    if (specialElements.recipe) {
      scores.Recipe = (scores.Recipe || 0) + 15;
    }
    if (specialElements.faq) {
      scores.FAQ = (scores.FAQ || 0) + 15;
    }
    if (specialElements.job) {
      scores.JobPosting = (scores.JobPosting || 0) + 12;
    }
    if (specialElements.course) {
      scores.Course = (scores.Course || 0) + 10;
    }
  }

  /**
   * 上位ページタイプを取得
   * @param {Object} scores - スコアオブジェクト
   * @returns {Array} ソートされたページタイプ配列
   */
  getTopTypes(scores) {
    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type)
      .filter((_, index) => index < 5); // 上位5つまで
  }

  /**
   * マッチしたパターンを取得
   * @param {Object} pageData - ページデータ
   * @param {string} type - ページタイプ
   * @returns {Object} マッチしたパターン
   */
  getMatchedPatterns(pageData, type) {
    const pattern = this.patterns[type];
    if (!pattern) return {};

    const matched = {
      keywords: [],
      titlePatterns: [],
      urlPatterns: [],
      contentPatterns: []
    };

    // キーワードマッチ
    pattern.keywords.forEach(keyword => {
      if (pageData.title.toLowerCase().includes(keyword.toLowerCase()) ||
          pageData.bodyText.toLowerCase().includes(keyword.toLowerCase())) {
        matched.keywords.push(keyword);
      }
    });

    // タイトルパターンマッチ
    pattern.titlePatterns.forEach(titlePattern => {
      if (pageData.title.includes(titlePattern)) {
        matched.titlePatterns.push(titlePattern);
      }
    });

    // URLパターンマッチ
    pattern.urlPatterns.forEach(urlPattern => {
      if (pageData.url.includes(urlPattern)) {
        matched.urlPatterns.push(urlPattern);
      }
    });

    // コンテンツパターンマッチ
    pattern.contentPatterns.forEach(contentPattern => {
      if (pageData.bodyText.includes(contentPattern)) {
        matched.contentPatterns.push(contentPattern);
      }
    });

    return matched;
  }

  // 特殊要素検出メソッド群
  hasPriceElements($) {
    const priceSelectors = [
      '[class*="price"]',
      '[id*="price"]',
      '.cost',
      '.amount',
      '[data-price]'
    ];
    
    let hasPrice = false;
    priceSelectors.forEach(selector => {
      if ($(selector).length > 0) {
        hasPrice = true;
      }
    });

    // 価格パターンの検出
    const pricePattern = /[￥$€£]\s*[\d,]+|[\d,]+\s*円|価格\s*[:：]\s*[\d,]+/;
    if (pricePattern.test($('body').text())) {
      hasPrice = true;
    }

    return hasPrice;
  }

  hasReviewElements($) {
    const reviewSelectors = [
      '[class*="review"]',
      '[class*="rating"]',
      '[class*="star"]',
      '.evaluation'
    ];
    
    return reviewSelectors.some(selector => $(selector).length > 0) ||
           /★|☆|評価|レビュー|口コミ/.test($('body').text());
  }

  hasEventElements($) {
    const eventSelectors = [
      '[class*="event"]',
      '[class*="schedule"]',
      '[datetime]',
      'time'
    ];
    
    return eventSelectors.some(selector => $(selector).length > 0) ||
           /開催日|開催時間|会場|イベント/.test($('body').text());
  }

  hasRecipeElements($) {
    const recipeSelectors = [
      '[class*="recipe"]',
      '[class*="ingredient"]',
      '[class*="instruction"]'
    ];
    
    return recipeSelectors.some(selector => $(selector).length > 0) ||
           /材料|分量|手順|調理時間/.test($('body').text());
  }

  hasFAQElements($) {
    return $('[class*="faq"], [id*="faq"], .qa, .question, .answer').length > 0 ||
           /Q\s*[:：]|A\s*[:：]|質問|回答/.test($('body').text());
  }

  hasJobElements($) {
    const jobSelectors = [
      '[class*="job"]',
      '[class*="career"]',
      '[class*="recruit"]'
    ];
    
    return jobSelectors.some(selector => $(selector).length > 0) ||
           /募集要項|給与|勤務地|応募資格/.test($('body').text());
  }

  hasCourseElements($) {
    const courseSelectors = [
      '[class*="course"]',
      '[class*="curriculum"]',
      '[class*="lesson"]'
    ];
    
    return courseSelectors.some(selector => $(selector).length > 0) ||
           /カリキュラム|講座|受講|学習内容/.test($('body').text());
  }

  /**
   * ページタイプの日本語名を取得
   * @param {string} type - ページタイプ
   * @returns {string} 日本語名
   */
  getTypeDisplayName(type) {
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
    
    return displayNames[type] || type;
  }

  /**
   * ページタイプの説明を取得
   * @param {string} type - ページタイプ
   * @returns {string} 説明
   */
  getTypeDescription(type) {
    const descriptions = {
      Article: 'ニュース記事、ブログ投稿、解説記事など',
      Product: 'ECサイトの商品ページ、製品紹介ページ',
      LocalBusiness: '店舗情報、会社概要、事業所案内',
      Recipe: '料理レシピ、作り方の説明',
      Event: 'イベント情報、セミナー案内、開催告知',
      FAQ: 'よくある質問、Q&A、ヘルプページ',
      HowTo: 'ハウツー記事、チュートリアル、手順説明',
      Review: '商品レビュー、評価・感想記事',
      JobPosting: '求人情報、採用案内',
      Course: '講座案内、研修情報、教育コンテンツ'
    };
    
    return descriptions[type] || '';
  }
}

module.exports = PageTypeAnalyzer;
