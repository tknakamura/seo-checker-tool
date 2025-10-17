/**
 * 詳細分析機能
 * HTMLの具体的な箇所を特定して問題点を詳細に分析
 */
class DetailedAnalyzer {
  constructor() {
    this.issues = [];
  }

  /**
   * 全角文字数を計算する（日本語SEO基準）
   * 全角文字（ひらがな、カタカナ、漢字、全角英数字）= 1文字
   * 半角文字（半角英数字、半角記号）= 0.5文字
   * @param {string} text - 計算対象の文字列
   * @returns {number} 全角文字数基準での文字数
   */
  calculateFullWidthLength(text) {
    if (!text) return 0;
    
    let length = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      const code = char.charCodeAt(0);
      
      // 全角文字の判定
      if (
        // ひらがな (U+3040-U+309F)
        (code >= 0x3040 && code <= 0x309F) ||
        // カタカナ (U+30A0-U+30FF)
        (code >= 0x30A0 && code <= 0x30FF) ||
        // 漢字 (U+4E00-U+9FAF)
        (code >= 0x4E00 && code <= 0x9FAF) ||
        // 全角英数字・記号 (U+FF00-U+FFEF)
        (code >= 0xFF00 && code <= 0xFFEF) ||
        // 全角スペース (U+3000)
        code === 0x3000 ||
        // その他の全角文字（CJK拡張など）
        (code >= 0x3400 && code <= 0x4DBF) ||
        (code >= 0x20000 && code <= 0x2A6DF) ||
        (code >= 0x2A700 && code <= 0x2B73F) ||
        (code >= 0x2B740 && code <= 0x2B81F) ||
        (code >= 0x2B820 && code <= 0x2CEAF) ||
        (code >= 0xF900 && code <= 0xFAFF) ||
        (code >= 0x2F800 && code <= 0x2FA1F)
      ) {
        length += 1; // 全角文字は1文字
      } else {
        length += 0.5; // 半角文字は0.5文字
      }
    }
    
    return length;
  }

  /**
   * 詳細分析の実行
   * @param {Object} $ - Cheerioオブジェクト
   * @param {string} url - チェック対象URL
   * @returns {Object} 詳細分析結果
   */
  analyzeDetails($, url) {
    const pageData = {
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      bodyText: $('body').text().trim(),
      url: url || ''
    };
    
    const analysis = {
      titleTag: this.analyzeTitleTag($),
      metaDescription: this.analyzeMetaDescription($),
      headingStructure: this.analyzeHeadingStructure($),
      imageAltAttributes: this.analyzeImageAltAttributes($),
      internalLinkStructure: this.analyzeInternalLinkStructure($, url),
      structuredData: this.analyzeStructuredData($, url, pageData),
      otherSEOElements: this.analyzeOtherSEOElements($, url)
    };

    return analysis;
  }

  /**
   * タイトルタグの詳細分析
   */
  analyzeTitleTag($) {
    const title = $('title');
    const titleText = title.text().trim();
    const titleLength = this.calculateFullWidthLength(titleText);
    
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    if (title.length === 0) {
      issues.push('タイトルタグが存在しません');
      recommendations.push('ページに適切なタイトルタグを追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'title',
        location: 'head',
        description: 'タイトルタグが完全に存在しません',
        fix: '<title>適切なタイトルを追加</title>'
      });
    } else {
      // 長さチェック（全角基準）
      if (titleLength < 15) {
        issues.push(`タイトルが短すぎます（${titleLength}全角文字）`);
        recommendations.push(`タイトルを15全角文字以上にしてください`);
        specificIssues.push({
          type: 'length',
          element: 'title',
          location: 'head',
          current: titleText,
          length: titleLength,
          description: `現在のタイトル「${titleText}」は${titleLength}全角文字で短すぎます`,
          fix: 'タイトルを15-30全角文字の範囲で拡張してください'
        });
      }
      
      if (titleLength > 30) {
        issues.push(`タイトルが長すぎます（${titleLength}全角文字）`);
        recommendations.push(`タイトルを30全角文字以下にしてください`);
        specificIssues.push({
          type: 'length',
          element: 'title',
          location: 'head',
          current: titleText,
          length: titleLength,
          description: `現在のタイトル「${titleText}」は${titleLength}全角文字で長すぎます`,
          fix: 'タイトルを30全角文字以下に短縮してください'
        });
      }

      // 重複キーワードチェック
      const words = titleText.toLowerCase().split(/\s+/);
      const duplicateWords = words.filter((word, index) => words.indexOf(word) !== index);
      if (duplicateWords.length > 0) {
        issues.push('タイトルに重複するキーワードがあります');
        recommendations.push('タイトルから重複するキーワードを削除してください');
        specificIssues.push({
          type: 'duplicate',
          element: 'title',
          location: 'head',
          current: titleText,
          duplicates: duplicateWords,
          description: `重複するキーワード: ${duplicateWords.join(', ')}`,
          fix: '重複するキーワードを削除してタイトルを最適化してください'
        });
      }

      // パイプの数チェック
      const pipeCount = (titleText.match(/\|/g) || []).length;
      if (pipeCount > 3) {
        issues.push('タイトルにパイプ（|）が多すぎます');
        recommendations.push('タイトルのパイプ（|）を3個以下にしてください');
        specificIssues.push({
          type: 'format',
          element: 'title',
          location: 'head',
          current: titleText,
          pipeCount: pipeCount,
          description: `パイプ（|）が${pipeCount}個使用されています`,
          fix: 'パイプ（|）を3個以下に減らしてください'
        });
      }
    }

    return {
      current: titleText,
      length: titleLength,
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateTitleScore(titleText, titleLength)
    };
  }

  /**
   * メタディスクリプションの詳細分析
   */
  analyzeMetaDescription($) {
    const metaDesc = $('meta[name="description"]');
    const description = metaDesc.attr('content') || '';
    const descriptionLength = this.calculateFullWidthLength(description);
    
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    if (metaDesc.length === 0) {
      issues.push('メタディスクリプションが存在しません');
      recommendations.push('ページに適切なメタディスクリプションを追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'meta[name="description"]',
        location: 'head',
        description: 'メタディスクリプションが完全に存在しません',
        fix: '<meta name="description" content="適切な説明文を追加">'
      });
    } else {
      // 長さチェック（全角基準）
      if (descriptionLength < 60) {
        issues.push(`メタディスクリプションが短すぎます（${descriptionLength}全角文字）`);
        recommendations.push(`メタディスクリプションを60全角文字以上にしてください`);
        specificIssues.push({
          type: 'length',
          element: 'meta[name="description"]',
          location: 'head',
          current: description,
          length: descriptionLength,
          description: `現在の説明文「${description}」は${descriptionLength}全角文字で短すぎます`,
          fix: '説明文を60-80全角文字の範囲で拡張してください'
        });
      }
      
      if (descriptionLength > 80) {
        issues.push(`メタディスクリプションが長すぎます（${descriptionLength}全角文字）`);
        recommendations.push(`メタディスクリプションを80全角文字以下にしてください`);
        specificIssues.push({
          type: 'length',
          element: 'meta[name="description"]',
          location: 'head',
          current: description,
          length: descriptionLength,
          description: `現在の説明文「${description}」は${descriptionLength}全角文字で長すぎます`,
          fix: '説明文を80全角文字以下に短縮してください'
        });
      }

      // 内容の品質チェック
      if (description === description.toLowerCase()) {
        issues.push('メタディスクリプションがすべて小文字です');
        recommendations.push('メタディスクリプションに適切な大文字小文字を使用してください');
        specificIssues.push({
          type: 'quality',
          element: 'meta[name="description"]',
          location: 'head',
          current: description,
          description: '説明文がすべて小文字で記述されています',
          fix: '適切な大文字小文字を使用して説明文を改善してください'
        });
      }

      if (description.includes('...') || description.includes('…')) {
        issues.push('メタディスクリプションに省略記号が含まれています');
        recommendations.push('メタディスクリプションから省略記号を削除してください');
        specificIssues.push({
          type: 'quality',
          element: 'meta[name="description"]',
          location: 'head',
          current: description,
          description: '説明文に省略記号（...または…）が含まれています',
          fix: '省略記号を削除して完全な文章にしてください'
        });
      }
    }

    return {
      current: description,
      length: descriptionLength,
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateDescriptionScore(description, descriptionLength)
    };
  }

  /**
   * 見出し構造の詳細分析
   */
  analyzeHeadingStructure($) {
    const headings = [];
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    // 見出しの収集
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const $el = $(el);
      const level = parseInt(el.tagName.substring(1));
      const text = $el.text().trim();
      const id = $el.attr('id') || '';
      
      headings.push({
        level: level,
        text: text,
        id: id,
        tagName: el.tagName.toLowerCase(),
        position: i + 1
      });
    });

    // H1のチェック
    const h1Headings = headings.filter(h => h.level === 1);
    if (h1Headings.length === 0) {
      issues.push('H1タグが存在しません');
      recommendations.push('ページにH1タグを1つ追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'h1',
        location: 'body',
        description: 'H1タグが完全に存在しません',
        fix: '<h1>ページのメインタイトル</h1>を追加してください'
      });
    } else if (h1Headings.length > 1) {
      issues.push(`H1タグが多すぎます（${h1Headings.length}個）`);
      recommendations.push('H1タグを1個以下にしてください');
      specificIssues.push({
        type: 'count',
        element: 'h1',
        location: 'body',
        count: h1Headings.length,
        headings: h1Headings.map(h => h.text),
        description: `H1タグが${h1Headings.length}個存在します: ${h1Headings.map(h => h.text).join(', ')}`,
        fix: 'H1タグを1個に統合し、他をH2に変更してください'
      });
    }

    // 見出しの階層チェック
    for (let i = 1; i < headings.length; i++) {
      const prevLevel = headings[i - 1].level;
      const currentLevel = headings[i].level;
      
      if (currentLevel > prevLevel + 1) {
        issues.push(`見出しの階層が飛び越されています（H${prevLevel} → H${currentLevel}）`);
        recommendations.push('見出しの階層を順序よく配置してください');
        specificIssues.push({
          type: 'hierarchy',
          element: `h${currentLevel}`,
          location: 'body',
          current: headings[i].text,
          previous: headings[i - 1].text,
          description: `H${prevLevel}「${headings[i - 1].text}」の後にH${currentLevel}「${headings[i].text}」が配置されています`,
          fix: `H${currentLevel}をH${prevLevel + 1}に変更するか、中間の見出しを追加してください`
        });
      }
    }

    // 空の見出しチェック
    headings.forEach(heading => {
      if (!heading.text) {
        issues.push(`${heading.tagName.toUpperCase()}タグが空です`);
        recommendations.push(`${heading.tagName.toUpperCase()}タグに適切なテキストを追加してください`);
        specificIssues.push({
          type: 'empty',
          element: heading.tagName,
          location: 'body',
          position: heading.position,
          description: `${heading.tagName.toUpperCase()}タグ（${heading.position}番目）が空です`,
          fix: `${heading.tagName.toUpperCase()}タグに適切なテキストを追加してください`
        });
      }
    });

    // 見出しの重複チェック
    const headingTexts = headings.map(h => h.text.toLowerCase());
    const duplicates = headingTexts.filter((text, index) => headingTexts.indexOf(text) !== index);
    if (duplicates.length > 0) {
      issues.push('見出しに重複する内容があります');
      recommendations.push('見出しの内容を一意にしてください');
      specificIssues.push({
        type: 'duplicate',
        element: 'headings',
        location: 'body',
        duplicates: [...new Set(duplicates)],
        description: `重複する見出し: ${[...new Set(duplicates)].join(', ')}`,
        fix: '重複する見出しの内容を変更してください'
      });
    }

    return {
      headings: headings,
      h1Count: h1Headings.length,
      h2Count: headings.filter(h => h.level === 2).length,
      h3Count: headings.filter(h => h.level === 3).length,
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateHeadingScore(headings)
    };
  }

  /**
   * 画像alt属性の詳細分析
   */
  analyzeImageAltAttributes($) {
    const images = [];
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    $('img').each((i, el) => {
      const $img = $(el);
      const src = $img.attr('src') || '';
      const alt = $img.attr('alt') || '';
      const title = $img.attr('title') || '';
      
      images.push({
        src: src,
        alt: alt,
        title: title,
        position: i + 1,
        hasAlt: alt !== '',
        hasEmptyAlt: alt === ''
      });
    });

    if (images.length === 0) {
      issues.push('画像が存在しません');
      recommendations.push('コンテンツに適切な画像を追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'img',
        location: 'body',
        description: 'ページに画像が存在しません',
        fix: 'コンテンツに適切な画像を追加してください'
      });
    } else {
      // alt属性のチェック
      const imagesWithoutAlt = images.filter(img => !img.hasAlt);
      if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length}個の画像にalt属性がありません`);
        recommendations.push('すべての画像にalt属性を追加してください');
        specificIssues.push({
          type: 'missing_alt',
          element: 'img',
          location: 'body',
          count: imagesWithoutAlt.length,
          images: imagesWithoutAlt.map(img => ({
            src: img.src,
            position: img.position
          })),
          description: `${imagesWithoutAlt.length}個の画像にalt属性がありません`,
          fix: 'alt属性を追加してください: <img src="..." alt="適切な説明文">'
        });
      }

      const imagesWithEmptyAlt = images.filter(img => img.hasEmptyAlt);
      if (imagesWithEmptyAlt.length > 0) {
        issues.push(`${imagesWithEmptyAlt.length}個の画像のalt属性が空です`);
        recommendations.push('空のalt属性を削除するか、適切なalt属性を設定してください');
        specificIssues.push({
          type: 'empty_alt',
          element: 'img',
          location: 'body',
          count: imagesWithEmptyAlt.length,
          images: imagesWithEmptyAlt.map(img => ({
            src: img.src,
            position: img.position
          })),
          description: `${imagesWithEmptyAlt.length}個の画像のalt属性が空です`,
          fix: 'alt属性を削除するか、適切な説明文を設定してください'
        });
      }

      // alt属性の品質チェック
      images.forEach(img => {
        if (img.alt && img.alt.length > 125) {
          issues.push(`画像のalt属性が長すぎます（${img.alt.length}文字）`);
          recommendations.push('alt属性を125文字以下にしてください');
          specificIssues.push({
            type: 'alt_length',
            element: 'img',
            location: 'body',
            src: img.src,
            position: img.position,
            current: img.alt,
            length: img.alt.length,
            description: `画像「${img.src}」のalt属性が${img.alt.length}文字で長すぎます`,
            fix: 'alt属性を125文字以下に短縮してください'
          });
        }
        
        if (img.alt && (img.alt.toLowerCase().includes('image') || img.alt.toLowerCase().includes('picture'))) {
          issues.push('alt属性に「image」や「picture」などの不要な単語が含まれています');
          recommendations.push('alt属性から不要な単語を削除してください');
          specificIssues.push({
            type: 'alt_quality',
            element: 'img',
            location: 'body',
            src: img.src,
            position: img.position,
            current: img.alt,
            description: `画像「${img.src}」のalt属性に不要な単語が含まれています`,
            fix: 'alt属性から「image」「picture」などの不要な単語を削除してください'
          });
        }
      });
    }

    return {
      totalImages: images.length,
      imagesWithAlt: images.filter(img => img.hasAlt && !img.hasEmptyAlt).length,
      imagesWithoutAlt: images.filter(img => !img.hasAlt).length,
      imagesWithEmptyAlt: images.filter(img => img.hasEmptyAlt).length,
      images: images,
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateImageAltScore(images)
    };
  }

  /**
   * 内部リンク構造の詳細分析
   */
  analyzeInternalLinkStructure($, url) {
    const links = [];
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    // URLが空の場合はスキップ
    if (!url || url === 'HTMLコンテンツ') {
      return {
        internalLinks: [],
        externalLinks: [],
        brokenLinks: [],
        issues: [],
        recommendations: [],
        score: 0
      };
    }
    
    const baseDomain = new URL(url).hostname;
    
    $('a[href]').each((i, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      const text = $link.text().trim();
      const title = $link.attr('title') || '';
      
      const isInternal = href.startsWith('/') || href.includes(baseDomain);
      const isExternal = href.startsWith('http') && !href.includes(baseDomain);
      
      links.push({
        href: href,
        text: text,
        title: title,
        position: i + 1,
        isInternal: isInternal,
        isExternal: isExternal,
        hasText: text !== '',
        isEmpty: text === ''
      });
    });

    const internalLinks = links.filter(link => link.isInternal);
    const externalLinks = links.filter(link => link.isExternal);

    if (links.length === 0) {
      issues.push('リンクが存在しません');
      recommendations.push('ページに適切なリンクを追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'a',
        location: 'body',
        description: 'ページにリンクが存在しません',
        fix: 'コンテンツに適切なリンクを追加してください'
      });
    } else {
      // 内部リンクの数チェック
      if (internalLinks.length < 10) {
        issues.push(`内部リンクが少なすぎます（${internalLinks.length}個）`);
        recommendations.push('内部リンクを10個以上追加してください');
        specificIssues.push({
          type: 'internal_count',
          element: 'a',
          location: 'body',
          count: internalLinks.length,
          description: `内部リンクが${internalLinks.length}個しかありません`,
          fix: '関連するページへの内部リンクを10個以上追加してください'
        });
      }

      // 外部リンクのチェック
      if (externalLinks.length === 0) {
        issues.push('外部リンクが存在しません');
        recommendations.push('信頼できる外部サイトへのリンクを追加してください');
        specificIssues.push({
          type: 'external_missing',
          element: 'a',
          location: 'body',
          description: '外部リンクが存在しません',
          fix: '信頼できる外部サイトへのリンクを追加してください'
        });
      }

      // リンクテキストのチェック
      const emptyLinks = links.filter(link => link.isEmpty);
      if (emptyLinks.length > 0) {
        issues.push(`${emptyLinks.length}個のリンクテキストが空です`);
        recommendations.push('リンクに適切なテキストを追加してください');
        specificIssues.push({
          type: 'empty_text',
          element: 'a',
          location: 'body',
          count: emptyLinks.length,
          links: emptyLinks.map(link => ({
            href: link.href,
            position: link.position
          })),
          description: `${emptyLinks.length}個のリンクテキストが空です`,
          fix: 'リンクに適切なテキストを追加してください'
        });
      }

      // 汎用的なリンクテキストのチェック
      const genericLinks = links.filter(link => 
        link.text.toLowerCase() === 'click here' || 
        link.text.toLowerCase() === 'read more' ||
        link.text.toLowerCase() === '続きを読む' ||
        link.text.toLowerCase() === '詳細'
      );
      if (genericLinks.length > 0) {
        issues.push(`${genericLinks.length}個の汎用的なリンクテキストがあります`);
        recommendations.push('より具体的で説明的なリンクテキストを使用してください');
        specificIssues.push({
          type: 'generic_text',
          element: 'a',
          location: 'body',
          count: genericLinks.length,
          links: genericLinks.map(link => ({
            href: link.href,
            text: link.text,
            position: link.position
          })),
          description: `${genericLinks.length}個の汎用的なリンクテキストがあります`,
          fix: 'リンクテキストをより具体的で説明的な内容に変更してください'
        });
      }
    }

    return {
      totalLinks: links.length,
      internalLinks: internalLinks,
      externalLinks: externalLinks,
      links: links,
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateLinkScore(links, internalLinks, externalLinks)
    };
  }

  /**
   * 構造化データの詳細分析（拡張版）
   */
  analyzeStructuredData($, url = '', pageData = {}) {
    const jsonLd = [];
    const microdata = [];
    const rdfa = [];
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    // PageTypeAnalyzerとStructuredDataRecommenderを使用するため、
    // 実際のコードでは外部から渡すかここでインスタンス化する
    let pageTypeAnalysis = null;
    let structuredDataRecommendations = null;
    
    try {
      const PageTypeAnalyzer = require('./page-type-analyzer');
      const StructuredDataRecommender = require('./structured-data-recommender');
      const SchemaTemplates = require('./schema-templates');
      
      const pageTypeAnalyzer = new PageTypeAnalyzer();
      const recommender = new StructuredDataRecommender();
      const templates = new SchemaTemplates();

      // ページタイプ分析を実行
      pageTypeAnalysis = pageTypeAnalyzer.analyzePage($, url);
      
      // JSON-LD検索
      $('script[type="application/ld+json"]').each((i, elem) => {
        try {
          const data = JSON.parse($(elem).html());
          jsonLd.push({
            data: data,
            position: i + 1,
            isValid: true
          });
        } catch (e) {
          jsonLd.push({
            data: null,
            position: i + 1,
            isValid: false,
            error: e.message
          });
          issues.push('JSON-LDの構文エラーがあります');
          recommendations.push('JSON-LDの構文を修正してください');
          specificIssues.push({
            type: 'jsonld_syntax',
            element: 'script[type="application/ld+json"]',
            location: 'head/body',
            position: i + 1,
            error: e.message,
            description: `${i + 1}番目のJSON-LDに構文エラーがあります`,
            fix: 'JSON-LDの構文を修正してください'
          });
        }
      });

      // Microdata検索
      $('[itemtype]').each((i, elem) => {
        const itemType = $(elem).attr('itemtype');
        microdata.push({
          itemType: itemType,
          element: elem.tagName.toLowerCase(),
          position: i + 1
        });
      });

      // RDFa検索
      $('[typeof]').each((i, elem) => {
        const typeofValue = $(elem).attr('typeof');
        rdfa.push({
          typeof: typeofValue,
          element: elem.tagName.toLowerCase(),
          position: i + 1
        });
      });

      // 既存スキーマの特定
      const existingSchemas = {
        jsonLd: jsonLd,
        microdata: microdata,
        rdfa: rdfa
      };

      // 構造化データ推奨を生成
      structuredDataRecommendations = recommender.generateRecommendations(
        pageTypeAnalysis, existingSchemas, pageData
      );

      // 従来の構造化データ存在チェック
      if (jsonLd.length === 0 && microdata.length === 0 && rdfa.length === 0) {
        issues.push('構造化データが存在しません');
        recommendations.push(`このページは「${pageTypeAnalyzer.getTypeDisplayName(pageTypeAnalysis.primaryType)}」と判定されました。適切なスキーマを実装してください。`);
        
        // 具体的な実装提案を追加
        const primarySchema = pageTypeAnalysis.primaryType;
        const schemaTemplate = templates.generateSchema(primarySchema, pageData, $);
        
        specificIssues.push({
          type: 'missing',
          element: 'structured_data',
          location: 'head/body',
          description: '構造化データが完全に存在しません',
          fix: `以下のJSON-LDを<head>セクションに追加してください：\n\n<script type="application/ld+json">\n${JSON.stringify(schemaTemplate.schema, null, 2)}\n</script>`,
          pageType: pageTypeAnalysis.primaryType,
          confidence: pageTypeAnalysis.confidence,
          implementationGuide: schemaTemplate.implementationGuide,
          template: schemaTemplate.schema
        });
      }

      // 不足スキーマの具体的な実装提案
      if (structuredDataRecommendations.recommendations.missing.length > 0) {
        structuredDataRecommendations.recommendations.missing.forEach((item, index) => {
          const schemaTemplate = templates.generateSchema(item.schema, pageData, $);
          
          specificIssues.push({
            type: 'missing_schema',
            element: 'structured_data',
            location: 'head',
            schema: item.schema,
            priority: item.priority,
            description: item.reason,
            fix: `以下の${item.schema}スキーマを追加してください：\n\n<script type="application/ld+json">\n${JSON.stringify(schemaTemplate.schema, null, 2)}\n</script>`,
            implementationGuide: schemaTemplate.implementationGuide,
            requiredData: schemaTemplate.requiredData,
            template: schemaTemplate.schema,
            seoValue: item.seoValue,
            estimatedTime: this.getImplementationTime(item.schema)
          });
        });
      }

      // 改善可能なスキーマの提案
      if (structuredDataRecommendations.recommendations.improvements.length > 0) {
        structuredDataRecommendations.recommendations.improvements.forEach(item => {
          const schemaTemplate = templates.generateSchema(item.schema, pageData, $);
          
          specificIssues.push({
            type: 'improvement',
            element: 'structured_data',
            location: 'head',
            schema: item.schema,
            priority: item.priority,
            description: item.reason,
            fix: `以下の${item.schema}スキーマを追加することでSEO効果が向上します：\n\n<script type="application/ld+json">\n${JSON.stringify(schemaTemplate.schema, null, 2)}\n</script>`,
            implementationGuide: schemaTemplate.implementationGuide,
            template: schemaTemplate.schema,
            impact: item.impact,
            difficulty: item.difficulty
          });
        });
      }

      // ページタイプ特有の推奨事項
      if (structuredDataRecommendations.businessSpecific.length > 0) {
        structuredDataRecommendations.businessSpecific.forEach(item => {
          specificIssues.push({
            type: 'business_specific',
            element: 'structured_data',
            location: 'head',
            businessType: item.type,
            description: item.description,
            fix: item.implementation,
            suggestion: item.suggestion
          });
        });
      }

    } catch (error) {
      console.error('構造化データ詳細分析エラー:', error);
      
      // フォールバック：従来の分析
      this.performBasicStructuredDataAnalysis(
        $, jsonLd, microdata, rdfa, issues, recommendations, specificIssues
      );
    }

    const foundSchemas = new Set();
    jsonLd.forEach(schema => {
      if (schema.isValid && schema.data && schema.data['@type']) {
        if (Array.isArray(schema.data['@type'])) {
          schema.data['@type'].forEach(type => foundSchemas.add(type));
        } else {
          foundSchemas.add(schema.data['@type']);
        }
      }
    });

    return {
      jsonLd: jsonLd,
      microdata: microdata,
      rdfa: rdfa,
      foundSchemas: Array.from(foundSchemas),
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateStructuredDataScore(jsonLd, microdata, rdfa),
      // 新機能の結果
      pageTypeAnalysis: pageTypeAnalysis,
      structuredDataRecommendations: structuredDataRecommendations,
      implementationPriority: this.calculateImplementationPriority(specificIssues)
    };
  }

  /**
   * 基本的な構造化データ分析（フォールバック用）
   */
  performBasicStructuredDataAnalysis($, jsonLd, microdata, rdfa, issues, recommendations, specificIssues) {
    const foundSchemas = new Set();
    jsonLd.forEach(schema => {
      if (schema.isValid && schema.data && schema.data['@type']) {
        if (Array.isArray(schema.data['@type'])) {
          schema.data['@type'].forEach(type => foundSchemas.add(type));
        } else {
          foundSchemas.add(schema.data['@type']);
        }
      }
    });

    const requiredSchemas = ['Organization', 'WebSite', 'Article'];
    const missingSchemas = requiredSchemas.filter(schema => !foundSchemas.has(schema));
    
    if (missingSchemas.length > 0) {
      issues.push(`推奨スキーマが不足しています: ${missingSchemas.join(', ')}`);
      recommendations.push(`不足しているスキーマを実装してください: ${missingSchemas.join(', ')}`);
      specificIssues.push({
        type: 'missing_schema',
        element: 'structured_data',
        location: 'head',
        missingSchemas: missingSchemas,
        description: `推奨スキーマが不足しています: ${missingSchemas.join(', ')}`,
        fix: `不足しているスキーマを実装してください: ${missingSchemas.join(', ')}`
      });
    }
  }

  /**
   * 実装優先度を計算
   */
  calculateImplementationPriority(specificIssues) {
    const priorities = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    specificIssues.forEach(issue => {
      const priority = issue.priority || this.determinePriority(issue);
      if (priorities[priority]) {
        priorities[priority].push(issue);
      } else {
        priorities.medium.push(issue);
      }
    });

    return priorities;
  }

  /**
   * 優先度を決定
   */
  determinePriority(issue) {
    if (issue.type === 'missing' || issue.type === 'jsonld_syntax') {
      return 'critical';
    } else if (issue.type === 'missing_schema' && 
               ['Article', 'Product', 'LocalBusiness'].includes(issue.schema)) {
      return 'high';
    } else if (issue.type === 'improvement') {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 実装時間を取得
   */
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
      'Course': '1-2時間',
      'Organization': '45分',
      'Person': '30分',
      'BreadcrumbList': '30分'
    };
    return times[schema] || '1時間';
  }

  /**
   * その他SEO要素の詳細分析
   */
  analyzeOtherSEOElements($, url) {
    const issues = [];
    const recommendations = [];
    const specificIssues = [];

    // URL構造チェック
    try {
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'https:') {
        issues.push('URLがHTTPSではありません');
        recommendations.push('HTTPSを使用してください');
        specificIssues.push({
          type: 'protocol',
          element: 'url',
          location: 'url',
          current: urlObj.protocol,
          description: 'URLがHTTPSではありません',
          fix: 'HTTPSを使用してください'
        });
      }

      if (url.length > 255) {
        issues.push('URLが長すぎます（255文字超過）');
        recommendations.push('URLを255文字以下にしてください');
        specificIssues.push({
          type: 'length',
          element: 'url',
          location: 'url',
          current: url,
          length: url.length,
          description: `URLが${url.length}文字で長すぎます`,
          fix: 'URLを255文字以下に短縮してください'
        });
      }

      const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
      if (pathSegments.length > 5) {
        issues.push('URLのディレクトリが深すぎます');
        recommendations.push('URLのディレクトリを5階層以下にしてください');
        specificIssues.push({
          type: 'depth',
          element: 'url',
          location: 'url',
          current: urlObj.pathname,
          depth: pathSegments.length,
          description: `URLのディレクトリが${pathSegments.length}階層で深すぎます`,
          fix: 'URLのディレクトリを5階層以下にしてください'
        });
      }
    } catch (error) {
      issues.push('URLの形式が正しくありません');
      recommendations.push('有効なURLを使用してください');
      specificIssues.push({
        type: 'format',
        element: 'url',
        location: 'url',
        current: url,
        description: 'URLの形式が正しくありません',
        fix: '有効なURLを使用してください'
      });
    }

    // viewportメタタグのチェック
    const viewport = $('meta[name="viewport"]');
    if (viewport.length === 0) {
      issues.push('viewportメタタグがありません');
      recommendations.push('viewportメタタグを追加してください');
      specificIssues.push({
        type: 'missing',
        element: 'meta[name="viewport"]',
        location: 'head',
        description: 'viewportメタタグが存在しません',
        fix: '<meta name="viewport" content="width=device-width, initial-scale=1.0">を追加してください'
      });
    } else {
      const viewportContent = viewport.attr('content') || '';
      if (!viewportContent.includes('width=device-width')) {
        issues.push('viewportメタタグにwidth=device-widthがありません');
        recommendations.push('viewportメタタグにwidth=device-widthを追加してください');
        specificIssues.push({
          type: 'viewport_content',
          element: 'meta[name="viewport"]',
          location: 'head',
          current: viewportContent,
          description: 'viewportメタタグにwidth=device-widthがありません',
          fix: 'viewportメタタグにwidth=device-widthを追加してください'
        });
      }
    }

    // noindexチェック
    const robots = $('meta[name="robots"]');
    if (robots.length > 0) {
      const robotsContent = robots.attr('content') || '';
      if (robotsContent.includes('noindex')) {
        issues.push('ページがnoindexに設定されています');
        recommendations.push('検索エンジンにインデックスされるようにnoindexを削除してください');
        specificIssues.push({
          type: 'noindex',
          element: 'meta[name="robots"]',
          location: 'head',
          current: robotsContent,
          description: 'ページがnoindexに設定されています',
          fix: 'noindexを削除して検索エンジンにインデックスされるようにしてください'
        });
      }
    }

    return {
      issues: issues,
      recommendations: recommendations,
      specificIssues: specificIssues,
      score: this.calculateOtherSEOScore(issues)
    };
  }

  /**
   * スコア計算メソッド群
   */
  calculateTitleScore(title, length) {
    if (!title) return 0;
    // 全角基準での文字数チェック
    if (length < 15 || length > 30) return 50;
    return 100;
  }

  calculateDescriptionScore(description, length) {
    if (!description) return 0;
    // 全角基準での文字数チェック
    if (length < 60 || length > 80) return 50;
    return 100;
  }

  calculateHeadingScore(headings) {
    let score = 0;
    
    const h1Count = headings.filter(h => h.level === 1).length;
    const h2Count = headings.filter(h => h.level === 2).length;
    const h3Count = headings.filter(h => h.level === 3).length;
    
    if (h1Count === 1) score += 30;
    if (h2Count >= 2) score += 25;
    if (h3Count >= 3) score += 20;
    if (headings.every(h => h.text)) score += 15;
    if (headings.length > 0) score += 10;
    
    return Math.min(score, 100);
  }

  calculateImageAltScore(images) {
    if (images.length === 0) return 50;
    const imagesWithAlt = images.filter(img => img.hasAlt && !img.hasEmptyAlt).length;
    return Math.round((imagesWithAlt / images.length) * 100);
  }

  calculateLinkScore(links, internalLinks, externalLinks) {
    if (links.length === 0) return 0;
    
    let score = 0;
    if (internalLinks.length >= 10) score += 50;
    if (externalLinks.length > 0) score += 30;
    if (links.every(link => link.hasText)) score += 20;
    
    return Math.min(score, 100);
  }

  calculateStructuredDataScore(jsonLd, microdata, rdfa) {
    let score = 0;
    
    if (jsonLd.length > 0) score += 40;
    if (microdata.length > 0) score += 30;
    if (rdfa.length > 0) score += 30;
    
    return Math.min(score, 100);
  }

  calculateOtherSEOScore(issues) {
    let score = 100;
    score -= issues.length * 10;
    return Math.max(score, 0);
  }
}

module.exports = DetailedAnalyzer;
