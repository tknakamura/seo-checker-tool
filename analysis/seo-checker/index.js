/**
 * メルカリSEOチェックツール - render.com最適化版
 * 軽量・高速化バージョン（全角文字数カウント対応）
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');

/**
 * 軽量版SEOチェッククラス
 */
class OptimizedSEOChecker {
  constructor() {
    this.config = {
      titleMaxLength: 30,    // 全角基準（30全角文字）
      titleMinLength: 15,    // 全角基準（15全角文字）
      descriptionMaxLength: 80,  // 全角基準（80全角文字）
      descriptionMinLength: 60,  // 全角基準（60全角文字）
      timeout: 8000,         // 8秒タイムアウト
      maxContentSize: 200000 // 200KB制限
    };
  }

  /**
   * 全角文字数を計算する（日本語SEO基準）
   * 全角文字（ひらがな、カタカナ、漢字、全角英数字）= 1文字
   * 半角文字（半角英数字、半角記号）= 0.5文字
   */
  calculateFullWidthLength(text) {
    if (!text) return 0;
    
    let length = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      const code = char.charCodeAt(0);
      
      // 全角文字の判定（最適化版）
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
        code === 0x3000
      ) {
        length += 1; // 全角文字は1文字
      } else {
        length += 0.5; // 半角文字は0.5文字
      }
    }
    
    return length;
  }

  /**
   * 軽量HTML取得（Puppeteerを使用しない）
   */
  async fetchHTML(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Mercari-SEO-Checker/2.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
        },
        maxContentLength: this.config.maxContentSize,
        maxRedirects: 3
      });
      
      return response.data;
    } catch (error) {
      console.error(`HTML取得エラー: ${error.message}`);
      throw new Error(`HTML取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * 高速SEOチェック（コア機能のみ）
   */
  async checkSEO(url, html = null) {
    const startTime = Date.now();
    
    try {
      let pageContent = html;
      if (!pageContent && url) {
        pageContent = await this.fetchHTML(url);
      }

      if (!pageContent) {
        throw new Error('HTML content is required');
      }

      // サイズ制限チェック
      if (pageContent.length > this.config.maxContentSize) {
        pageContent = pageContent.substring(0, this.config.maxContentSize);
      }

      const $ = cheerio.load(pageContent, { decodeEntities: true });
      
      // 高速チェック（必須項目のみ）
      const checks = {
        titleTag: this.checkTitleTag($),
        metaDescription: this.checkMetaDescription($),
        headingStructure: this.checkHeadingStructure($),
        basicElements: this.checkBasicElements($)
      };

      // 総合スコア計算
      const overallScore = this.calculateOverallScore(checks);
      
      const processingTime = Date.now() - startTime;
      
      return {
        url: url || 'HTML Content',
        timestamp: new Date().toISOString(),
        processingTimeMS: processingTime,
        checks: checks,
        overallScore: overallScore,
        recommendations: this.getRecommendations(checks)
      };
    } catch (error) {
      console.error(`SEOチェックエラー: ${error.message}`);
      throw new Error(`SEOチェックに失敗しました: ${error.message}`);
    }
  }

  /**
   * タイトルタグチェック
   */
  checkTitleTag($) {
    const title = $('title').first().text().trim();
    const titleLength = this.calculateFullWidthLength(title);
    
    const issues = [];
    let score = 100;

    if (!title) {
      issues.push('タイトルタグが存在しません');
      score = 0;
    } else {
      if (titleLength < this.config.titleMinLength) {
        issues.push(`タイトルが短すぎます（${titleLength}全角文字 < ${this.config.titleMinLength}全角文字）`);
        score = 40;
      } else if (titleLength > this.config.titleMaxLength) {
        issues.push(`タイトルが長すぎます（${titleLength}全角文字 > ${this.config.titleMaxLength}全角文字）`);
        score = 60;
      }
      
      // 重複チェック
      if ($('title').length > 1) {
        issues.push('複数のタイトルタグが存在します');
        score -= 20;
      }
    }

    return {
      element: 'title',
      current: title,
      length: titleLength,
      fullWidthLength: titleLength, // 全角文字数
      issues: issues,
      score: Math.max(score, 0),
      recommendations: this.getTitleRecommendations(title, titleLength)
    };
  }

  /**
   * メタディスクリプションチェック
   */
  checkMetaDescription($) {
    const description = $('meta[name="description"]').attr('content') || '';
    const descriptionLength = this.calculateFullWidthLength(description);
    
    const issues = [];
    let score = 100;

    if (!description) {
      issues.push('メタディスクリプションが存在しません');
      score = 0;
    } else {
      if (descriptionLength < this.config.descriptionMinLength) {
        issues.push(`メタディスクリプションが短すぎます（${descriptionLength}全角文字 < ${this.config.descriptionMinLength}全角文字）`);
        score = 40;
      } else if (descriptionLength > this.config.descriptionMaxLength) {
        issues.push(`メタディスクリプションが長すぎます（${descriptionLength}全角文字 > ${this.config.descriptionMaxLength}全角文字）`);
        score = 60;
      }
      
      // 重複チェック
      if ($('meta[name="description"]').length > 1) {
        issues.push('複数のメタディスクリプションが存在します');
        score -= 20;
      }
    }

    return {
      element: 'meta[name="description"]',
      current: description,
      length: descriptionLength,
      fullWidthLength: descriptionLength, // 全角文字数
      issues: issues,
      score: Math.max(score, 0),
      recommendations: this.getDescriptionRecommendations(description, descriptionLength)
    };
  }

  /**
   * 見出し構造チェック
   */
  checkHeadingStructure($) {
    const h1Count = $('h1').length;
    const h2Count = $('h2').length;
    const h3Count = $('h3').length;
    
    const issues = [];
    let score = 100;

    if (h1Count === 0) {
      issues.push('H1タグが存在しません');
      score = 30;
    } else if (h1Count > 1) {
      issues.push(`H1タグが複数存在します（${h1Count}個）`);
      score = 70;
    }

    // H1の内容チェック
    if (h1Count === 1) {
      const h1Text = $('h1').first().text().trim();
      const h1Length = this.calculateFullWidthLength(h1Text);
      if (h1Length > 40) {
        issues.push(`H1タグが長すぎます（${h1Length}全角文字）`);
        score -= 10;
      }
    }

    return {
      element: 'heading structure',
      h1Count: h1Count,
      h2Count: h2Count,
      h3Count: h3Count,
      h1Text: h1Count > 0 ? $('h1').first().text().trim() : '',
      issues: issues,
      score: Math.max(score, 0)
    };
  }

  /**
   * 基本要素チェック
   */
  checkBasicElements($) {
    const imgCount = $('img').length;
    const imgWithAlt = $('img[alt]').length;
    const hasViewport = $('meta[name="viewport"]').length > 0;
    const hasCharset = $('meta[charset]').length > 0 || $('meta[http-equiv="Content-Type"]').length > 0;
    
    const issues = [];
    let score = 100;

    // alt属性チェック
    if (imgCount > 0 && imgWithAlt < imgCount) {
      const missingAlt = imgCount - imgWithAlt;
      issues.push(`${missingAlt}個の画像にalt属性がありません`);
      score -= Math.min(missingAlt * 5, 30);
    }

    // viewport設定チェック
    if (!hasViewport) {
      issues.push('viewportメタタグが存在しません');
      score -= 15;
    }

    // 文字エンコーディングチェック
    if (!hasCharset) {
      issues.push('文字エンコーディング設定が存在しません');
      score -= 10;
    }

    return {
      element: 'basic elements',
      imageCount: imgCount,
      imageWithAlt: imgWithAlt,
      hasViewport: hasViewport,
      hasCharset: hasCharset,
      issues: issues,
      score: Math.max(score, 0)
    };
  }

  /**
   * 総合スコア計算
   */
  calculateOverallScore(checks) {
    const weights = {
      titleTag: 0.3,
      metaDescription: 0.3,
      headingStructure: 0.25,
      basicElements: 0.15
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (checks[key]) {
        totalScore += checks[key].score * weight;
      }
    }

    return Math.round(totalScore);
  }

  /**
   * 推奨事項生成
   */
  getRecommendations(checks) {
    const recommendations = [];

    // タイトル推奨事項
    if (checks.titleTag.score < 80) {
      recommendations.push({
        category: 'タイトルタグ',
        priority: 'high',
        message: '適切な長さ（15-30全角文字）のタイトルを設定してください'
      });
    }

    // メタディスクリプション推奨事項
    if (checks.metaDescription.score < 80) {
      recommendations.push({
        category: 'メタディスクリプション',
        priority: 'high',
        message: '適切な長さ（60-80全角文字）のメタディスクリプションを設定してください'
      });
    }

    // 見出し推奨事項
    if (checks.headingStructure.score < 80) {
      recommendations.push({
        category: '見出し構造',
        priority: 'medium',
        message: 'H1タグを1個だけ設定し、適切な見出し構造を構築してください'
      });
    }

    return recommendations;
  }

  /**
   * タイトル推奨事項
   */
  getTitleRecommendations(title, length) {
    if (!title) {
      return ['ページの内容を表す魅力的なタイトルを設定してください'];
    }
    
    const recommendations = [];
    if (length < this.config.titleMinLength) {
      recommendations.push(`もう${Math.ceil(this.config.titleMinLength - length)}文字程度追加してください`);
    } else if (length > this.config.titleMaxLength) {
      recommendations.push(`${Math.ceil(length - this.config.titleMaxLength)}文字程度短縮してください`);
    }
    
    return recommendations;
  }

  /**
   * ディスクリプション推奨事項
   */
  getDescriptionRecommendations(description, length) {
    if (!description) {
      return ['ページの内容を簡潔に説明するメタディスクリプションを設定してください'];
    }
    
    const recommendations = [];
    if (length < this.config.descriptionMinLength) {
      recommendations.push(`もう${Math.ceil(this.config.descriptionMinLength - length)}文字程度追加してください`);
    } else if (length > this.config.descriptionMaxLength) {
      recommendations.push(`${Math.ceil(length - this.config.descriptionMaxLength)}文字程度短縮してください`);
    }
    
    return recommendations;
  }
}

// Express アプリケーション設定
const app = express();
const port = process.env.PORT || 3001;

// CORS設定
app.use(cors({
  origin: true,
  credentials: true
}));

// JSON設定
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// 静的ファイル
app.use(express.static(path.join(__dirname, 'public')));

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Mercari SEO Checker - Optimized',
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// メイン SEOチェック エンドポイント
app.post('/api/check/seo', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { url, html } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLコンテンツが必要です'
      });
    }

    console.log(`SEOチェック開始: ${url || 'HTML Content'}`);

    const checker = new OptimizedSEOChecker();
    const results = await checker.checkSEO(url, html);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`SEOチェック完了: ${totalTime}ms, スコア: ${results.overallScore}`);
    
    res.json({
      success: true,
      data: {
        ...results,
        apiProcessingTimeMS: totalTime
      }
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    console.error(`SEOチェックエラー (${errorTime}ms): ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      processingTimeMS: errorTime
    });
  }
});

// 軽量版 全角文字数カウンター エンドポイント
app.post('/api/count/fullwidth', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'テキストが必要です'
      });
    }

    const checker = new OptimizedSEOChecker();
    const fullWidthLength = checker.calculateFullWidthLength(text);
    
    res.json({
      success: true,
      data: {
        text: text,
        length: text.length,
        fullWidthLength: fullWidthLength,
        ratio: text.length > 0 ? (fullWidthLength / text.length).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error(`全角文字数カウントエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// サーバー起動
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 メルカリSEOチェックツール（最適化版）起動: ポート ${port}`);
  console.log(`📊 全角文字数カウント機能: 有効`);
  console.log(`⚡ render.com最適化: 有効`);
  console.log(`🕒 起動時刻: ${new Date().toISOString()}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM受信 - サーバーをシャットダウンします');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT受信 - サーバーをシャットダウンします');
  process.exit(0);
});

module.exports = OptimizedSEOChecker;