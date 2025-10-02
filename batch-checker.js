/**
 * バッチチェック機能
 * 複数のURLを一括でチェックし、比較分析やレポートを生成
 */
const SEOChecker = require('./index');

class BatchChecker {
  constructor() {
    this.maxConcurrent = 2; // 同時実行数を2に削減（リソース節約）
    this.timeout = 90000; // 90秒のタイムアウト（Puppeteer対応）
  }

  /**
   * バッチチェックの実行
   * @param {Array} urls - チェック対象のURL配列
   * @param {Object} options - チェックオプション
   * @param {Array} keywords - 重要なキーワード配列
   * @param {boolean} waitForJS - JavaScript描画待機の有効/無効
   * @returns {Object} バッチチェック結果
   */
  async checkBatch(urls, options = {}, keywords = [], waitForJS = false) {
    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      totalUrls: urls.length,
      successful: 0,
      failed: 0,
      results: [],
      summary: {},
      comparison: {},
      recommendations: []
    };

    try {
      console.log(`バッチチェック開始: ${urls.length}件のURL`);
      
      // 並列処理でチェック実行
      const batches = this.createBatches(urls, this.maxConcurrent);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`バッチ ${i + 1}/${batches.length} 処理中 (${batch.length}件)`);
        
        const batchPromises = batch.map(url => this.checkSingleUrl(url, options, keywords, waitForJS));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.results.push({
              url: batch[index],
              success: true,
              data: result.value
            });
            results.successful++;
          } else {
            results.results.push({
              url: batch[index],
              success: false,
              error: result.reason.message
            });
            results.failed++;
          }
        });
      }

      // サマリー分析
      results.summary = this.generateSummary(results);
      
      // 比較分析
      results.comparison = this.generateComparison(results);
      
      // 改善提案
      results.recommendations = this.generateBatchRecommendations(results);

      const endTime = Date.now();
      results.processingTime = endTime - startTime;
      
      console.log(`バッチチェック完了: ${results.successful}件成功, ${results.failed}件失敗`);
      return results;

    } catch (error) {
      console.error(`バッチチェックエラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * 単一URLのチェック
   * @param {string} url - チェック対象URL
   * @param {Object} options - チェックオプション
   * @param {Array} keywords - 重要なキーワード配列
   * @param {boolean} waitForJS - JavaScript描画待機の有効/無効
   * @returns {Object} チェック結果
   */
  async checkSingleUrl(url, options = {}, keywords = [], waitForJS = false) {
    const checker = new SEOChecker();
    
    try {
      const result = await Promise.race([
        checker.checkSEO(url, null, keywords, waitForJS),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('タイムアウト')), this.timeout)
        )
      ]);
      
      return result;
    } catch (error) {
      throw new Error(`URL ${url} のチェックに失敗: ${error.message}`);
    }
  }

  /**
   * URLをバッチに分割
   * @param {Array} urls - URL配列
   * @param {number} batchSize - バッチサイズ
   * @returns {Array} バッチ配列
   */
  createBatches(urls, batchSize) {
    const batches = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * サマリー分析の生成
   * @param {Object} results - バッチチェック結果
   * @returns {Object} サマリー分析
   */
  generateSummary(results) {
    const successfulResults = results.results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return {
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        scoreDistribution: {},
        commonIssues: [],
        performance: {
          averageTime: 0,
          fastestTime: 0,
          slowestTime: 0
        }
      };
    }

    const scores = successfulResults.map(r => r.data.overallScore || 0);
    const aioScores = successfulResults.map(r => r.data.aioOverallScore || 0);
    const combinedScores = successfulResults.map(r => r.data.combinedScore || 0);

    return {
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      averageAioScore: Math.round(aioScores.reduce((a, b) => a + b, 0) / aioScores.length),
      averageCombinedScore: Math.round(combinedScores.reduce((a, b) => a + b, 0) / combinedScores.length),
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
      scoreDistribution: this.calculateScoreDistribution(scores),
      commonIssues: this.findCommonIssues(successfulResults),
      performance: {
        averageTime: results.processingTime / results.totalUrls,
        fastestTime: Math.min(...successfulResults.map(r => r.data.processingTime || 0)),
        slowestTime: Math.max(...successfulResults.map(r => r.data.processingTime || 0))
      }
    };
  }

  /**
   * スコア分布の計算
   * @param {Array} scores - スコア配列
   * @returns {Object} スコア分布
   */
  calculateScoreDistribution(scores) {
    const distribution = {
      excellent: 0, // 90-100
      good: 0,      // 70-89
      fair: 0,      // 50-69
      poor: 0       // 0-49
    };

    scores.forEach(score => {
      if (score >= 90) distribution.excellent++;
      else if (score >= 70) distribution.good++;
      else if (score >= 50) distribution.fair++;
      else distribution.poor++;
    });

    return distribution;
  }

  /**
   * 共通の問題点の特定
   * @param {Array} successfulResults - 成功した結果の配列
   * @returns {Array} 共通の問題点
   */
  findCommonIssues(successfulResults) {
    const issueCounts = {};
    
    successfulResults.forEach(result => {
      if (result.data.checks) {
        Object.entries(result.data.checks).forEach(([category, check]) => {
          if (check.issues && check.issues.length > 0) {
            check.issues.forEach(issue => {
              issueCounts[issue] = (issueCounts[issue] || 0) + 1;
            });
          }
        });
      }
    });

    // 出現頻度順にソート
    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: Math.round((count / successfulResults.length) * 100)
      }));
  }

  /**
   * 比較分析の生成
   * @param {Object} results - バッチチェック結果
   * @returns {Object} 比較分析
   */
  generateComparison(results) {
    const successfulResults = results.results.filter(r => r.success);
    
    if (successfulResults.length < 2) {
      return {
        ranking: [],
        categoryComparison: {},
        performanceComparison: {}
      };
    }

    return {
      ranking: this.generateRanking(successfulResults),
      categoryComparison: this.generateCategoryComparison(successfulResults),
      performanceComparison: this.generatePerformanceComparison(successfulResults)
    };
  }

  /**
   * ランキングの生成
   * @param {Array} successfulResults - 成功した結果の配列
   * @returns {Array} ランキング
   */
  generateRanking(successfulResults) {
    return successfulResults
      .map(result => ({
        url: result.url,
        seoScore: result.data.overallScore || 0,
        aioScore: result.data.aioOverallScore || 0,
        combinedScore: result.data.combinedScore || 0,
        performance: result.data.performance?.overallScore || 0
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map((item, index) => ({
        rank: index + 1,
        ...item
      }));
  }

  /**
   * カテゴリ別比較の生成
   * @param {Array} successfulResults - 成功した結果の配列
   * @returns {Object} カテゴリ別比較
   */
  generateCategoryComparison(successfulResults) {
    const categories = [
      'titleTag', 'metaDescription', 'headingStructure', 
      'imageAltAttributes', 'internalLinkStructure', 
      'structuredData', 'otherSEOElements'
    ];

    const comparison = {};

    categories.forEach(category => {
      const scores = successfulResults
        .map(r => r.data.checks?.[category]?.score || 0)
        .filter(score => score > 0);

      if (scores.length > 0) {
        comparison[category] = {
          average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          best: Math.max(...scores),
          worst: Math.min(...scores),
          count: scores.length
        };
      }
    });

    return comparison;
  }

  /**
   * パフォーマンス比較の生成
   * @param {Array} successfulResults - 成功した結果の配列
   * @returns {Object} パフォーマンス比較
   */
  generatePerformanceComparison(successfulResults) {
    const performanceResults = successfulResults
      .filter(r => r.data.performance && !r.data.performance.error)
      .map(r => r.data.performance);

    if (performanceResults.length === 0) {
      return {};
    }

    const categories = ['performance', 'accessibility', 'bestPractices', 'seo'];
    const comparison = {};

    categories.forEach(category => {
      const scores = performanceResults
        .map(p => p.categories?.[category]?.score || 0)
        .filter(score => score > 0);

      if (scores.length > 0) {
        comparison[category] = {
          average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          best: Math.max(...scores),
          worst: Math.min(...scores),
          count: scores.length
        };
      }
    });

    return comparison;
  }

  /**
   * バッチ推奨事項の生成
   * @param {Object} results - バッチチェック結果
   * @returns {Array} 推奨事項
   */
  generateBatchRecommendations(results) {
    const recommendations = [];
    const summary = results.summary;

    // 全体的なスコアに関する推奨事項
    if (summary.averageScore < 50) {
      recommendations.push({
        type: 'critical',
        title: '全体的なSEOスコアが低いです',
        description: `平均スコアが${summary.averageScore}と低いため、基本的なSEO対策から見直してください`,
        actions: [
          'タイトルタグとメタディスクリプションの最適化',
          '見出し構造の改善',
          '内部リンク構造の整備',
          '画像のalt属性の追加'
        ]
      });
    }

    // 共通の問題に関する推奨事項
    if (summary.commonIssues.length > 0) {
      const topIssue = summary.commonIssues[0];
      recommendations.push({
        type: 'high',
        title: '共通の問題が多数のページで発生しています',
        description: `「${topIssue.issue}」が${topIssue.count}件（${topIssue.percentage}%）のページで発生しています`,
        actions: [
          'サイト全体の統一的な修正',
          'テンプレートやCMSの設定見直し',
          '開発チームとの連携強化'
        ]
      });
    }

    // パフォーマンスに関する推奨事項
    if (results.comparison.performanceComparison && 
        results.comparison.performanceComparison.performance) {
      const perfAvg = results.comparison.performanceComparison.performance.average;
      if (perfAvg < 70) {
        recommendations.push({
          type: 'high',
          title: 'パフォーマンススコアが低いです',
          description: `平均パフォーマンススコアが${perfAvg}と低いため、サイト速度の改善が必要です`,
          actions: [
            '画像の最適化',
            'CSSとJavaScriptの最小化',
            'CDNの導入',
            'キャッシュ設定の最適化'
          ]
        });
      }
    }

    // アクセシビリティに関する推奨事項
    if (results.comparison.performanceComparison && 
        results.comparison.performanceComparison.accessibility) {
      const accAvg = results.comparison.performanceComparison.accessibility.average;
      if (accAvg < 80) {
        recommendations.push({
          type: 'medium',
          title: 'アクセシビリティの改善が必要です',
          description: `平均アクセシビリティスコアが${accAvg}と低いため、アクセシビリティの改善が必要です`,
          actions: [
            'カラーコントラストの改善',
            'キーボードナビゲーションの対応',
            'スクリーンリーダー対応',
            'alt属性の追加'
          ]
        });
      }
    }

    return recommendations;
  }

  /**
   * バッチレポートの生成
   * @param {Object} results - バッチチェック結果
   * @returns {Object} バッチレポート
   */
  generateBatchReport(results) {
    return {
      summary: {
        timestamp: results.timestamp,
        totalUrls: results.totalUrls,
        successful: results.successful,
        failed: results.failed,
        successRate: Math.round((results.successful / results.totalUrls) * 100),
        processingTime: results.processingTime,
        averageTime: Math.round(results.processingTime / results.totalUrls)
      },
      analysis: results.summary,
      comparison: results.comparison,
      recommendations: results.recommendations,
      detailedResults: results.results
    };
  }

  /**
   * CSVエクスポート用データの生成
   * @param {Object} results - バッチチェック結果
   * @returns {Array} CSVデータ
   */
  generateCSVData(results) {
    const csvData = [];
    
    // ヘッダー行
    csvData.push([
      'URL',
      'SEO Score',
      'AIO Score',
      'Combined Score',
      'Performance Score',
      'Accessibility Score',
      'Best Practices Score',
      'Title Tag Score',
      'Meta Description Score',
      'Heading Structure Score',
      'Image Alt Score',
      'Internal Links Score',
      'Structured Data Score',
      'Status',
      'Processing Time'
    ]);

    // データ行
    results.results.forEach(result => {
      const row = [
        result.url,
        result.success ? (result.data.overallScore || 0) : 'N/A',
        result.success ? (result.data.aioOverallScore || 0) : 'N/A',
        result.success ? (result.data.combinedScore || 0) : 'N/A',
        result.success ? (result.data.performance?.categories?.performance?.score || 'N/A') : 'N/A',
        result.success ? (result.data.performance?.categories?.accessibility?.score || 'N/A') : 'N/A',
        result.success ? (result.data.performance?.categories?.bestPractices?.score || 'N/A') : 'N/A',
        result.success ? (result.data.checks?.titleTag?.score || 0) : 'N/A',
        result.success ? (result.data.checks?.metaDescription?.score || 0) : 'N/A',
        result.success ? (result.data.checks?.headingStructure?.score || 0) : 'N/A',
        result.success ? (result.data.checks?.imageAltAttributes?.score || 0) : 'N/A',
        result.success ? (result.data.checks?.internalLinkStructure?.score || 0) : 'N/A',
        result.success ? (result.data.checks?.structuredData?.score || 0) : 'N/A',
        result.success ? 'Success' : 'Failed',
        result.success ? (result.data.processingTime || 0) : 'N/A'
      ];
      csvData.push(row);
    });

    return csvData;
  }
}

module.exports = BatchChecker;

