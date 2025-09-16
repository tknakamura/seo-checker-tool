/**
 * パフォーマンスチェック機能
 * Lighthouseを活用してページのパフォーマンス、アクセシビリティ、ベストプラクティスをチェック
 */
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');

class PerformanceChecker {
  constructor() {
    this.lighthouseConfig = {
      extends: 'lighthouse:default',
      settings: {
        onlyAudits: [
          'first-contentful-paint',
          'largest-contentful-paint',
          'speed-index',
          'cumulative-layout-shift',
          'total-blocking-time',
          'interactive',
          'render-blocking-resources',
          'unused-css-rules',
          'unused-javascript',
          'modern-image-formats',
          'offscreen-images',
          'unminified-css',
          'unminified-javascript',
          'efficient-animated-content',
          'uses-text-compression',
          'uses-optimized-images',
          'uses-webp-images',
          'uses-responsive-images',
          'accessibility/color-contrast',
          'accessibility/image-alt',
          'accessibility/label',
          'accessibility/link-name',
          'accessibility/button-name',
          'accessibility/form-field-multiple-labels',
          'accessibility/heading-order',
          'accessibility/list',
          'accessibility/listitem',
          'accessibility/definition-list',
          'accessibility/document-title',
          'accessibility/frame-title',
          'accessibility/html-has-lang',
          'accessibility/html-lang-valid',
          'accessibility/landmark-one-main',
          'accessibility/landmark-unique',
          'accessibility/meta-refresh',
          'accessibility/meta-viewport',
          'accessibility/object-alt',
          'accessibility/tabindex',
          'accessibility/td-headers-attr',
          'accessibility/th-has-data-cells',
          'accessibility/valid-lang',
          'accessibility/video-caption',
          'accessibility/video-description',
          'accessibility/aria-allowed-attr',
          'accessibility/aria-required-attr',
          'accessibility/aria-required-children',
          'accessibility/aria-required-parent',
          'accessibility/aria-roles',
          'accessibility/aria-valid-attr',
          'accessibility/aria-valid-attr-value',
          'accessibility/duplicate-id',
          'accessibility/duplicate-id-aria',
          'accessibility/focus-traps',
          'accessibility/focusable-controls',
          'accessibility/heading-order',
          'accessibility/interactive-element-affordance',
          'accessibility/logical-tab-order',
          'accessibility/managed-focus',
          'accessibility/meta-refresh',
          'accessibility/offscreen-content-hidden',
          'accessibility/use-landmarks',
          'accessibility/visual-order-follows-dom',
          'best-practices/appcache-manifest',
          'best-practices/doctype',
          'best-practices/errors-in-console',
          'best-practices/geolocation-on-start',
          'best-practices/is-on-https',
          'best-practices/mixed-content',
          'best-practices/no-vulnerable-libraries',
          'best-practices/notification-on-start',
          'best-practices/password-inputs-can-be-pasted-into',
          'best-practices/uses-http2',
          'best-practices/uses-passive-event-listeners'
        ]
      }
    };
  }

  /**
   * パフォーマンスチェックの実行
   * @param {string} url - チェック対象URL
   * @returns {Object} パフォーマンスチェック結果
   */
  async checkPerformance(url) {
    try {
      console.log(`パフォーマンスチェック開始: ${url}`);
      
      // Puppeteerでブラウザを起動
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Lighthouseでパフォーマンスチェックを実行
      const result = await lighthouse(url, {
        port: new URL(browser.wsEndpoint()).port,
        output: 'json',
        logLevel: 'info'
      }, this.lighthouseConfig);

      await browser.close();

      // 結果の解析
      const performanceResults = this.analyzeLighthouseResults(result);

      console.log(`パフォーマンスチェック完了: ${url}`);
      return performanceResults;

    } catch (error) {
      console.error(`パフォーマンスチェックエラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lighthouse結果の解析
   * @param {Object} lighthouseResult - Lighthouseの結果
   * @returns {Object} 解析結果
   */
  analyzeLighthouseResults(lighthouseResult) {
    const lhr = lighthouseResult.lhr;
    
    const performanceResults = {
      timestamp: new Date().toISOString(),
      url: lhr.finalUrl,
      categories: {
        performance: this.analyzePerformanceCategory(lhr.categories.performance),
        accessibility: this.analyzeAccessibilityCategory(lhr.categories.accessibility),
        bestPractices: this.analyzeBestPracticesCategory(lhr.categories['best-practices']),
        seo: this.analyzeSEOCategory(lhr.categories.seo)
      },
      audits: this.analyzeAudits(lhr.audits),
      overallScore: this.calculateOverallScore(lhr.categories),
      recommendations: []
    };

    // 改善提案の生成
    performanceResults.recommendations = this.generatePerformanceRecommendations(performanceResults);

    return performanceResults;
  }

  /**
   * パフォーマンスカテゴリの解析
   */
  analyzePerformanceCategory(performanceCategory) {
    const score = performanceCategory.score * 100;
    const audits = performanceCategory.auditRefs.map(ref => ref.id);
    
    const issues = [];
    const recommendations = [];

    if (score < 50) {
      issues.push('パフォーマンススコアが非常に低いです');
      recommendations.push('ページの読み込み速度を大幅に改善してください');
    } else if (score < 70) {
      issues.push('パフォーマンススコアが低いです');
      recommendations.push('ページの読み込み速度を改善してください');
    } else if (score < 90) {
      issues.push('パフォーマンススコアが中程度です');
      recommendations.push('さらなるパフォーマンス最適化を検討してください');
    }

    return {
      score: Math.round(score),
      issues: issues,
      recommendations: recommendations,
      metrics: this.getPerformanceMetrics(audits)
    };
  }

  /**
   * アクセシビリティカテゴリの解析
   */
  analyzeAccessibilityCategory(accessibilityCategory) {
    const score = accessibilityCategory.score * 100;
    const audits = accessibilityCategory.auditRefs.map(ref => ref.id);
    
    const issues = [];
    const recommendations = [];

    if (score < 70) {
      issues.push('アクセシビリティスコアが低いです');
      recommendations.push('アクセシビリティを大幅に改善してください');
    } else if (score < 90) {
      issues.push('アクセシビリティスコアが中程度です');
      recommendations.push('アクセシビリティの改善を検討してください');
    }

    return {
      score: Math.round(score),
      issues: issues,
      recommendations: recommendations,
      metrics: this.getAccessibilityMetrics(audits)
    };
  }

  /**
   * ベストプラクティスカテゴリの解析
   */
  analyzeBestPracticesCategory(bestPracticesCategory) {
    const score = bestPracticesCategory.score * 100;
    const audits = bestPracticesCategory.auditRefs.map(ref => ref.id);
    
    const issues = [];
    const recommendations = [];

    if (score < 70) {
      issues.push('ベストプラクティスのスコアが低いです');
      recommendations.push('Web開発のベストプラクティスに従ってください');
    } else if (score < 90) {
      issues.push('ベストプラクティスのスコアが中程度です');
      recommendations.push('ベストプラクティスの改善を検討してください');
    }

    return {
      score: Math.round(score),
      issues: issues,
      recommendations: recommendations,
      metrics: this.getBestPracticesMetrics(audits)
    };
  }

  /**
   * SEOカテゴリの解析
   */
  analyzeSEOCategory(seoCategory) {
    const score = seoCategory.score * 100;
    const audits = seoCategory.auditRefs.map(ref => ref.id);
    
    const issues = [];
    const recommendations = [];

    if (score < 70) {
      issues.push('SEOスコアが低いです');
      recommendations.push('SEO対策を大幅に改善してください');
    } else if (score < 90) {
      issues.push('SEOスコアが中程度です');
      recommendations.push('SEO対策の改善を検討してください');
    }

    return {
      score: Math.round(score),
      issues: issues,
      recommendations: recommendations,
      metrics: this.getSEOMetrics(audits)
    };
  }

  /**
   * 監査結果の解析
   */
  analyzeAudits(audits) {
    const auditResults = {
      performance: [],
      accessibility: [],
      bestPractices: [],
      seo: []
    };

    Object.entries(audits).forEach(([auditId, audit]) => {
      if (audit.score !== null && audit.score < 0.9) {
        const auditResult = {
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: Math.round(audit.score * 100),
          displayValue: audit.displayValue,
          details: audit.details,
          issues: this.extractAuditIssues(audit)
        };

        // カテゴリ別に分類
        if (auditId.includes('first-contentful-paint') || 
            auditId.includes('largest-contentful-paint') ||
            auditId.includes('speed-index') ||
            auditId.includes('cumulative-layout-shift') ||
            auditId.includes('total-blocking-time') ||
            auditId.includes('interactive') ||
            auditId.includes('render-blocking') ||
            auditId.includes('unused-css') ||
            auditId.includes('unused-javascript') ||
            auditId.includes('image') ||
            auditId.includes('compression')) {
          auditResults.performance.push(auditResult);
        } else if (auditId.startsWith('accessibility/')) {
          auditResults.accessibility.push(auditResult);
        } else if (auditId.startsWith('best-practices/')) {
          auditResults.bestPractices.push(auditResult);
        } else if (auditId.includes('seo') || 
                   auditId.includes('meta') || 
                   auditId.includes('title') ||
                   auditId.includes('description')) {
          auditResults.seo.push(auditResult);
        }
      }
    });

    return auditResults;
  }

  /**
   * 監査から問題点を抽出
   */
  extractAuditIssues(audit) {
    const issues = [];
    
    if (audit.score === null) {
      issues.push('この監査項目は適用できません');
    } else if (audit.score < 0.5) {
      issues.push('重大な問題があります');
    } else if (audit.score < 0.8) {
      issues.push('改善が必要です');
    } else if (audit.score < 0.9) {
      issues.push('軽微な改善が推奨されます');
    }

    // 詳細な問題点を抽出
    if (audit.details && audit.details.items) {
      audit.details.items.forEach(item => {
        if (item.node) {
          issues.push(`要素の問題: ${item.node.selector}`);
        }
        if (item.url) {
          issues.push(`リソースの問題: ${item.url}`);
        }
      });
    }

    return issues;
  }

  /**
   * パフォーマンスメトリクスの取得
   */
  getPerformanceMetrics(audits) {
    return {
      firstContentfulPaint: this.getMetricValue('first-contentful-paint'),
      largestContentfulPaint: this.getMetricValue('largest-contentful-paint'),
      speedIndex: this.getMetricValue('speed-index'),
      cumulativeLayoutShift: this.getMetricValue('cumulative-layout-shift'),
      totalBlockingTime: this.getMetricValue('total-blocking-time'),
      interactive: this.getMetricValue('interactive')
    };
  }

  /**
   * アクセシビリティメトリクスの取得
   */
  getAccessibilityMetrics(audits) {
    return {
      colorContrast: audits.includes('accessibility/color-contrast'),
      imageAlt: audits.includes('accessibility/image-alt'),
      headingOrder: audits.includes('accessibility/heading-order'),
      linkNames: audits.includes('accessibility/link-name'),
      buttonNames: audits.includes('accessibility/button-name')
    };
  }

  /**
   * ベストプラクティスメトリクスの取得
   */
  getBestPracticesMetrics(audits) {
    return {
      https: audits.includes('best-practices/is-on-https'),
      consoleErrors: audits.includes('best-practices/errors-in-console'),
      vulnerableLibraries: audits.includes('best-practices/no-vulnerable-libraries'),
      http2: audits.includes('best-practices/uses-http2')
    };
  }

  /**
   * SEOメトリクスの取得
   */
  getSEOMetrics(audits) {
    return {
      metaDescription: audits.includes('meta-description'),
      documentTitle: audits.includes('document-title'),
      headingStructure: audits.includes('heading-order')
    };
  }

  /**
   * メトリクス値の取得
   */
  getMetricValue(metricId) {
    // 実際の実装では、lighthouseResultから該当するメトリクスの値を取得
    return null;
  }

  /**
   * 総合スコアの計算
   */
  calculateOverallScore(categories) {
    const weights = {
      performance: 0.25,
      accessibility: 0.25,
      bestPractices: 0.25,
      seo: 0.25
    };

    let totalScore = 0;
    Object.entries(weights).forEach(([category, weight]) => {
      if (categories[category]) {
        totalScore += categories[category].score * weight * 100;
      }
    });

    return Math.round(totalScore);
  }

  /**
   * パフォーマンス改善提案の生成
   */
  generatePerformanceRecommendations(results) {
    const recommendations = [];

    // パフォーマンス関連の推奨事項
    if (results.categories.performance.score < 70) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'ページ読み込み速度の改善',
        description: 'ページの読み込み速度を改善してユーザーエクスペリエンスを向上させてください',
        actions: [
          '画像の最適化（WebP形式の使用、適切なサイズ）',
          'CSSとJavaScriptの最小化',
          '不要なリソースの削除',
          'CDNの使用',
          'ブラウザキャッシュの設定'
        ],
        tools: ['PageSpeed Insights', 'GTmetrix', 'WebPageTest']
      });
    }

    // アクセシビリティ関連の推奨事項
    if (results.categories.accessibility.score < 80) {
      recommendations.push({
        category: 'accessibility',
        priority: 'high',
        title: 'アクセシビリティの改善',
        description: 'すべてのユーザーがアクセスできるようにアクセシビリティを改善してください',
        actions: [
          '画像にalt属性を追加',
          '適切な見出し構造の実装',
          'カラーコントラストの改善',
          'キーボードナビゲーションの対応',
          'スクリーンリーダー対応'
        ],
        tools: ['WAVE', 'axe DevTools', 'Lighthouse']
      });
    }

    // ベストプラクティス関連の推奨事項
    if (results.categories.bestPractices.score < 80) {
      recommendations.push({
        category: 'bestPractices',
        priority: 'medium',
        title: 'Web開発ベストプラクティスの適用',
        description: 'セキュリティとパフォーマンスのベストプラクティスを適用してください',
        actions: [
          'HTTPSの使用',
          'コンソールエラーの修正',
          '脆弱なライブラリの更新',
          'HTTP/2の使用',
          'パッシブイベントリスナーの使用'
        ],
        tools: ['Security Headers', 'Snyk', 'npm audit']
      });
    }

    return recommendations;
  }

  /**
   * パフォーマンスレポートの生成
   */
  generatePerformanceReport(results) {
    const report = {
      summary: {
        url: results.url,
        timestamp: results.timestamp,
        overallScore: results.overallScore,
        categories: {
          performance: results.categories.performance.score,
          accessibility: results.categories.accessibility.score,
          bestPractices: results.categories.bestPractices.score,
          seo: results.categories.seo.score
        }
      },
      details: results.audits,
      recommendations: results.recommendations,
      metrics: {
        performance: results.categories.performance.metrics,
        accessibility: results.categories.accessibility.metrics,
        bestPractices: results.categories.bestPractices.metrics,
        seo: results.categories.seo.metrics
      }
    };

    return report;
  }
}

module.exports = PerformanceChecker;

