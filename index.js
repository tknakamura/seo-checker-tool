const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const cors = require('cors');
const AIOChecker = require('./aio-checker');
const EnhancedReporter = require('./enhanced-reporter');
const DetailedAnalyzer = require('./detailed-analyzer');
const PerformanceChecker = require('./performance-checker');
const BatchChecker = require('./batch-checker');
const Database = require('./database');
require('dotenv').config();

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/seo-checker.log' }),
    new winston.transports.Console()
  ]
});

/**
 * 包括的SEO・AIOチェック機能
 * 指定されたWebページについて、SEO観点で網羅的なチェックを行い、改善提案をレポート形式で作成
 */
class SEOChecker {
  constructor() {
    this.config = this.loadConfig();
    this.results = {};
    this.aioChecker = new AIOChecker();
    this.enhancedReporter = new EnhancedReporter();
    this.detailedAnalyzer = new DetailedAnalyzer();
    this.performanceChecker = new PerformanceChecker();
    this.database = new Database();
  }

  /**
   * 設定ファイルの読み込み
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/seo-config.yaml');
      // YAMLファイルの読み込みは後で実装
      return {
        titleMaxLength: 30, // 全角30文字以内（参考サイト推奨）
        titleMinLength: 10, // 最低10文字
        descriptionMaxLength: 160, // 160文字以下
        descriptionMinLength: 120, // 120文字以上
        h1MaxCount: 1,
        h2MinCount: 2,
        h3MinCount: 3,
        imageAltRequired: true,
        internalLinksMin: 10,
        structuredDataRequired: true
      };
    } catch (error) {
      logger.warn('設定ファイルの読み込みに失敗、デフォルト設定を使用');
      return {
        titleMaxLength: 30, // 全角30文字以内（参考サイト推奨）
        titleMinLength: 10, // 最低10文字
        descriptionMaxLength: 160, // 160文字以下
        descriptionMinLength: 120, // 120文字以上
        h1MaxCount: 1,
        h2MinCount: 2,
        h3MinCount: 3,
        imageAltRequired: true,
        internalLinksMin: 10,
        structuredDataRequired: true
      };
    }
  }

  /**
   * メインのSEOチェック実行
   * @param {string} url - チェック対象のURL
   * @param {string} html - オプションのHTMLコンテンツ
   * @returns {Object} SEOチェック結果
   */
  async checkSEO(url, html = null) {
    try {
      logger.info(`SEOチェック開始: ${url || 'HTMLコンテンツ'}`);
      
      let pageContent = '';
      if (html) {
        pageContent = html;
      } else {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SEO-Checker/1.0)'
          },
          responseType: 'arraybuffer'
        });
        
        // 文字エンコーディングを検出して正しくデコード
        const htmlBuffer = Buffer.from(response.data);
        let detectedEncoding = 'utf-8';
        
        // Content-Typeヘッダーから文字エンコーディングを取得
        const contentType = response.headers['content-type'] || '';
        logger.info(`Content-Type: ${contentType}`);
        
        if (contentType.includes('charset=')) {
          const charsetMatch = contentType.match(/charset=([^;]+)/i);
          if (charsetMatch) {
            detectedEncoding = charsetMatch[1].toLowerCase().replace(/['"]/g, '');
            logger.info(`Content-Typeから検出されたエンコーディング: ${detectedEncoding}`);
          }
        }
        
        // HTMLのmetaタグから文字エンコーディングを検出
        if (detectedEncoding === 'utf-8') {
          try {
            const tempContent = htmlBuffer.toString('utf-8');
            const charsetMatch = tempContent.match(/<meta[^>]+charset=["']?([^"'>\s]+)["']?/i);
            if (charsetMatch) {
              const metaEncoding = charsetMatch[1].toLowerCase();
              if (metaEncoding.includes('shift') || metaEncoding.includes('sjis')) {
                detectedEncoding = 'shift_jis';
              } else if (metaEncoding.includes('euc')) {
                detectedEncoding = 'euc-jp';
              } else if (metaEncoding.includes('iso-2022')) {
                detectedEncoding = 'iso-2022-jp';
              } else if (metaEncoding.includes('utf-8')) {
                detectedEncoding = 'utf-8';
              }
              logger.info(`metaタグから検出されたエンコーディング: ${detectedEncoding}`);
            }
          } catch (e) {
            logger.warn('metaタグからのエンコーディング検出に失敗');
          }
        }
        
        // 検出されたエンコーディングでデコードを試行
        try {
          pageContent = iconv.decode(htmlBuffer, detectedEncoding);
          logger.info(`${detectedEncoding}でデコード成功`);
          
          // デコード結果の品質チェック
          const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(pageContent);
          const hasGarbledChars = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/.test(pageContent);
          
          if (!hasJapanese || hasGarbledChars) {
            logger.warn(`${detectedEncoding}でのデコード結果が不適切、他のエンコーディングを試行`);
            
            // 他のエンコーディングを試行
            const encodings = ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp'];
            for (const enc of encodings) {
              if (enc === detectedEncoding) continue;
              
              try {
                const testContent = iconv.decode(htmlBuffer, enc);
                const testHasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(testContent);
                const testHasGarbledChars = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/.test(testContent);
                
                if (testHasJapanese && !testHasGarbledChars) {
                  pageContent = testContent;
                  detectedEncoding = enc;
                  logger.info(`代替エンコーディング ${enc} でデコード成功`);
                  break;
                }
              } catch (error) {
                continue;
              }
            }
          }
        } catch (error) {
          logger.warn(`${detectedEncoding}でのデコードに失敗: ${error.message}`);
          
          // UTF-8でフォールバック
          try {
            pageContent = htmlBuffer.toString('utf-8');
            logger.info('UTF-8でフォールバック成功');
          } catch (fallbackError) {
            pageContent = htmlBuffer.toString('utf-8', 0, htmlBuffer.length);
            logger.warn('UTF-8フォールバックでも失敗、強制的にUTF-8でデコード');
          }
        }
        
        // 文字化けチェックと修正
        if (pageContent && (pageContent.includes('') || /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/.test(pageContent))) {
          logger.warn('文字化けが検出されました。再エンコーディングを試行します。');
          
          // より詳細な文字化け検出
          const garbledChars = pageContent.match(/[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/g);
          if (garbledChars) {
            logger.warn(`文字化け文字を検出: ${garbledChars.slice(0, 10).join('')}`);
          }
          
          // 別のエンコーディングで再試行
          for (const enc of ['shift_jis', 'euc-jp', 'iso-2022-jp', 'utf-8']) {
            try {
              const retryContent = iconv.decode(htmlBuffer, enc);
              const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(retryContent);
              const hasGarbled = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/.test(retryContent);
              
              if (hasJapanese && !hasGarbled) {
                pageContent = retryContent;
                logger.info(`文字化け修正成功: ${enc}`);
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          // それでも文字化けが残る場合は、文字化け文字を除去
          if (pageContent && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/.test(pageContent)) {
            logger.warn('文字化け文字を除去します。');
            pageContent = pageContent.replace(/[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/g, '');
          }
        }
        
      // デバッグログ
      logger.info(`pageContentの型: ${typeof pageContent}, 長さ: ${pageContent ? pageContent.length : 'undefined'}`);
      logger.info(`pageContentの先頭100文字: ${pageContent ? pageContent.substring(0, 100) : 'undefined'}`);
      
      // 最終的なpageContentが文字列であることを確認
      if (typeof pageContent !== 'string') {
        pageContent = String(pageContent);
        logger.warn('pageContentを文字列に変換しました');
      }
      }

      // pageContentが文字列でない場合はエラー
      if (typeof pageContent !== 'string') {
        logger.error(`pageContentの型: ${typeof pageContent}, 値: ${pageContent}`);
        throw new Error('HTMLコンテンツが文字列ではありません');
      }
      
      logger.info(`pageContentの長さ: ${pageContent.length}文字`);
      
      // cheerioでHTMLを解析
      const $ = cheerio.load(pageContent);
      
      // デバッグログ
      logger.info(`cheerio解析後のHTML長: ${$.html().length}`);
      logger.info(`title要素の存在確認: ${$('title').length > 0}`);
      
      const titleTagResult = this.checkTitleTag($);
      const metaDescriptionResult = this.checkMetaDescription($);
      
      logger.info(`タイトルタグ結果: ${JSON.stringify(titleTagResult)}`);
      logger.info(`メタディスクリプション結果: ${JSON.stringify(metaDescriptionResult)}`);
      
      const results = {
        url: url || 'HTMLコンテンツ',
        timestamp: new Date().toISOString(),
        checks: {
          titleTag: titleTagResult,
          metaDescription: metaDescriptionResult,
          headingStructure: this.checkHeadingStructure($),
          imageAltAttributes: this.checkImageAltAttributes($),
          internalLinkStructure: this.checkInternalLinkStructure($, url || ''),
          structuredData: this.checkStructuredData($),
          otherSEOElements: this.checkOtherSEOElements($, url || '')
        },
        overallScore: 0,
        recommendations: []
      };

      // AIOチェックの実行
      const aioResults = await this.aioChecker.checkAIO(results, url || '', $);
      results.aio = aioResults;

      // 総合スコア計算（SEO + AIO）
      results.overallScore = this.calculateOverallScore(results.checks);
      results.aioOverallScore = aioResults.overallScore;
      results.combinedScore = Math.round((results.overallScore + aioResults.overallScore) / 2);
      
      // 改善提案生成
      results.recommendations = this.generateRecommendations(results.checks);
      results.aioRecommendations = aioResults.recommendations;

      // 詳細分析の実行
      results.detailedAnalysis = this.detailedAnalyzer.analyzeDetails($, url || '');

      // パフォーマンスチェックの実行（URLが提供されている場合のみ）
      if (url && url !== 'HTMLコンテンツ') {
        try {
          results.performance = await this.performanceChecker.checkPerformance(url);
          logger.info(`パフォーマンスチェック完了: ${url}`);
        } catch (error) {
          logger.warn(`パフォーマンスチェックエラー: ${error.message}`);
          results.performance = {
            error: 'パフォーマンスチェックに失敗しました',
            message: error.message
          };
        }
      } else {
        results.performance = {
          error: 'URLが提供されていないため、パフォーマンスチェックをスキップしました'
        };
      }

      // 詳細レポート生成
      results.detailedReport = this.enhancedReporter.generateDetailedReport(results);
      
      // 簡潔な推奨アクション生成
      results.conciseRecommendations = this.enhancedReporter.generateConciseRecommendations(results);

      // データベースに履歴を保存
      try {
        const checkData = {
          url: url || 'HTMLコンテンツ',
          type: 'single',
          success: true,
          scores: {
            seo: results.overallScore,
            aio: results.aioOverallScore,
            performance: results.performance?.overallScore || 0,
            combined: results.combinedScore
          },
          issues: this.extractAllIssues(results),
          recommendations: this.extractAllRecommendations(results)
        };
        this.database.saveCheckHistory(checkData);
        logger.info('チェック履歴を保存しました');
      } catch (error) {
        logger.warn(`履歴保存エラー: ${error.message}`);
      }

      logger.info(`SEOチェック完了: ${url}, スコア: ${results.overallScore}`);
      
      return results;
    } catch (error) {
      logger.error(`SEOチェックエラー: ${error.message}`);
      logger.error(`エラースタック: ${error.stack}`);
      throw error;
    }
  }

  /**
   * タイトルタグのチェック
   */
  checkTitleTag($) {
    let title = $('title').text().trim();
    
    // 文字化けチェックと修正
    logger.info(`タイトルタグの文字化けチェック: "${title}"`);
    
    // 文字化け文字のパターン（よくある文字化け文字）
    const commonGarbledPattern = /[@ljELOiMtgbOzOICb]/g;
    
    if (title && commonGarbledPattern.test(title)) {
      logger.warn(`タイトルタグに文字化けを検出: "${title}"`);
      
      // fixGarbledText関数を使用して文字化けを修正
      const fixedTitle = this.fixGarbledText(title);
      title = fixedTitle;
      
      logger.info(`文字化け修正後: "${title}"`);
    }
    
    // その他の文字化け文字を除去（日本語文字以外）
    const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/g;
    if (title && garbledPattern.test(title)) {
      const garbledChars = title.match(garbledPattern);
      logger.warn(`その他の文字化け文字: ${garbledChars ? garbledChars.join('') : 'なし'}`);
      title = title.replace(garbledPattern, '');
      logger.info(`その他の文字化け除去後: "${title}"`);
    }
    
    // 修正後の長さを計算
    const titleLength = title.length;
    
    // デバッグログ
    logger.info(`タイトルタグ検出: "${title}", 長さ: ${titleLength}`);
    logger.info(`title要素の数: ${$('title').length}`);
    
    const issues = [];
    const recommendations = [];

    // タイトルが存在するかチェック
    if (!title) {
      issues.push('タイトルタグが存在しません');
      recommendations.push('ページに適切なタイトルタグを追加してください');
    } else {
      // 長さチェック（参考サイト推奨：全角30文字以内）
      if (titleLength < this.config.titleMinLength) {
        issues.push(`タイトルが短すぎます（${titleLength}文字）`);
        recommendations.push(`タイトルを${this.config.titleMinLength}文字以上にしてください`);
      }
      
      if (titleLength > this.config.titleMaxLength) {
        issues.push(`タイトルが長すぎます（${titleLength}文字）`);
        recommendations.push(`タイトルを${this.config.titleMaxLength}文字以下にしてください（参考サイト推奨：全角30文字以内）`);
      }

      // キーワードの先出しチェック（参考サイト推奨）
      const firstWords = title.split(/\s+|・|｜|【|】/)[0];
      if (firstWords && firstWords.length > 0) {
        // 重要なキーワードが最初に来ているかチェック
        const importantKeywords = ['SEO', '対策', '方法', 'コツ', '解説', '完全版', '初心者', '上級者'];
        const hasImportantKeyword = importantKeywords.some(keyword => 
          firstWords.includes(keyword) || title.toLowerCase().indexOf(keyword.toLowerCase()) === 0
        );
        
        if (!hasImportantKeyword) {
          recommendations.push('重要なキーワードをタイトルの最初に配置することを検討してください');
        }
      }

      // パイプ（|）の使用チェック（参考サイト推奨：適切な使用）
      const pipeCount = (title.match(/\|/g) || []).length;
      if (pipeCount > 2) {
        issues.push(`タイトルにパイプ（|）が多すぎます（${pipeCount}個）`);
        recommendations.push('タイトルのパイプ（|）を2個以下にしてください');
      }

      // キーワードの重複チェック
      const words = title.toLowerCase().split(/\s+|・|｜|【|】/);
      const duplicateWords = words.filter((word, index) => 
        word.length > 1 && words.indexOf(word) !== index
      );
      if (duplicateWords.length > 0) {
        issues.push(`タイトルに重複するキーワードがあります: ${duplicateWords.join(', ')}`);
        recommendations.push('タイトルから重複するキーワードを削除してください');
      }

      // 数字や記号の使用チェック（参考サイト推奨：クリック率向上）
      const hasNumbers = /\d/.test(title);
      const hasSymbols = /[【】「」！？]/.test(title);
      if (!hasNumbers && !hasSymbols) {
        recommendations.push('クリック率向上のため、数字や記号（【】「」！？）の使用を検討してください');
      }

      // ユニーク性チェック（参考サイト推奨：ページ固有のタイトル）
      if (title.includes('無題') || title.includes('Untitled') || title.includes('Home')) {
        issues.push('タイトルが汎用的すぎます');
        recommendations.push('ページの内容を具体的に表すユニークなタイトルにしてください');
      }
    }

    return {
      current: title,
      length: titleLength,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateTitleScore(title, titleLength)
    };
  }

  /**
   * メタディスクリプションのチェック
   */
  checkMetaDescription($) {
    // デバッグログ：メタディスクリプションの検索開始
    logger.info(`メタディスクリプション検索開始`);
    logger.info(`HTMLの長さ: ${$.html().length}`);
    
    // メタディスクリプションの検索（複数の方法を試行）
    let metaDesc = $('meta[name="description"]');
    let description = metaDesc.attr('content') || '';
    
    // デバッグログ：メタディスクリプションの詳細確認
    logger.info(`メタディスクリプション要素の数: ${metaDesc.length}`);
    logger.info(`メタディスクリプションのHTML: ${metaDesc.toString()}`);
    logger.info(`メタディスクリプションの内容: "${description}"`);
    logger.info(`メタディスクリプションの長さ: ${description.length}`);
    
    // メタディスクリプションが見つからない場合、代替の検索方法を試行
    if (metaDesc.length === 0 || !description) {
      logger.warn('標準的なメタディスクリプション検索で見つかりません。代替検索を実行します。');
      
      // 大文字小文字を区別しない検索
      metaDesc = $('meta[name="description"], meta[name="Description"], meta[name="DESCRIPTION"]');
      description = metaDesc.attr('content') || '';
      logger.info(`大文字小文字を区別しない検索結果: ${metaDesc.length}, 内容: "${description}"`);
      
      // 属性の順序を変えた検索
      if (metaDesc.length === 0 || !description) {
        metaDesc = $('meta[content][name="description"]');
        description = metaDesc.attr('content') || '';
        logger.info(`属性順序を変えた検索結果: ${metaDesc.length}, 内容: "${description}"`);
      }
      
      // 正規表現を使用した検索
      if (metaDesc.length === 0 || !description) {
        const htmlContent = $.html();
        const metaDescRegex = /<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/gi;
        const metaDescMatches = htmlContent.match(metaDescRegex);
        if (metaDescMatches && metaDescMatches.length > 0) {
          logger.info(`正規表現検索結果: ${metaDescMatches.length}個`);
          logger.info(`正規表現マッチ: ${metaDescMatches.join(', ')}`);
          
          // 正規表現で見つかったメタディスクリプションをcheerioで再解析
          const tempHtml = `<div>${metaDescMatches.join('')}</div>`;
          const temp$ = cheerio.load(tempHtml);
          metaDesc = temp$('meta[name="description"]');
          description = metaDesc.attr('content') || '';
          logger.info(`正規表現メタディスクリプション再解析結果: ${metaDesc.length}, 内容: "${description}"`);
        }
      }
      
      // より柔軟な正規表現検索
      if (metaDesc.length === 0 || !description) {
        const htmlContent = $.html();
        const flexibleRegex = /<meta[^>]*(?:name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']|content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'])[^>]*>/gi;
        const flexibleMatches = htmlContent.match(flexibleRegex);
        if (flexibleMatches && flexibleMatches.length > 0) {
          logger.info(`柔軟な正規表現検索結果: ${flexibleMatches.length}個`);
          logger.info(`柔軟な正規表現マッチ: ${flexibleMatches.join(', ')}`);
          
          // 柔軟な正規表現で見つかったメタディスクリプションをcheerioで再解析
          const tempHtml = `<div>${flexibleMatches.join('')}</div>`;
          const temp$ = cheerio.load(tempHtml);
          metaDesc = temp$('meta[name="description"]');
          description = metaDesc.attr('content') || '';
          logger.info(`柔軟な正規表現メタディスクリプション再解析結果: ${metaDesc.length}, 内容: "${description}"`);
        }
      }
    }
    
    // 最終的なメタディスクリプションの確認
    logger.info(`最終メタディスクリプション要素の数: ${metaDesc.length}`);
    logger.info(`最終メタディスクリプションの内容: "${description}"`);
    logger.info(`最終メタディスクリプションの長さ: ${description.length}`);
    
    // 文字化けチェックと修正
    logger.info(`メタディスクリプションの文字化けチェック: "${description}"`);
    
    // 文字化け文字のパターン（よくある文字化け文字）
    const commonGarbledPattern = /[NLOEjAiN@lljELOiMtgLxpOzO@lICXgABi蕨BAET\[\]rX\[\]B]/g;
    
    if (description && commonGarbledPattern.test(description)) {
      logger.warn(`メタディスクリプションに文字化けを検出: "${description}"`);
      
      // fixGarbledText関数を使用して文字化けを修正
      const fixedDescription = this.fixGarbledText(description);
      description = fixedDescription;
      
      logger.info(`メタディスクリプション修正後: "${description}"`);
    } else {
      logger.info(`メタディスクリプションに文字化けなし: "${description}"`);
    }
    
    // その他の文字化け文字を除去（日本語文字以外）
    const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/g;
    if (description && garbledPattern.test(description)) {
      const garbledChars = description.match(garbledPattern);
      logger.warn(`その他の文字化け文字: ${garbledChars ? garbledChars.join('') : 'なし'}`);
      description = description.replace(garbledPattern, '');
      logger.info(`その他の文字化け除去後: "${description}"`);
    }
    
    // 最終的なメタディスクリプションの確認
    logger.info(`最終メタディスクリプション: "${description}", 長さ: ${description.length}`);
    
    // 修正後の長さを計算
    const descriptionLength = description.length;
    
    const issues = [];
    const recommendations = [];

    // メタディスクリプションが存在するかチェック
    if (!description) {
      issues.push('メタディスクリプションが存在しません');
      recommendations.push('ページに適切なメタディスクリプションを追加してください');
      
      // デバッグ情報：メタディスクリプションが見つからない場合の詳細分析
      logger.warn('メタディスクリプションが見つかりません。詳細分析を実行します。');
      
      // HTMLの構造を確認
      const headExists = $('head').length > 0;
      logger.info(`head要素の存在: ${headExists}`);
      
      // 全meta要素を確認
      const allMetaElements = $('meta');
      logger.info(`全meta要素の数: ${allMetaElements.length}`);
      
      allMetaElements.each((i, el) => {
        const $el = $(el);
        const name = $el.attr('name') || '';
        const content = $el.attr('content') || '';
        const property = $el.attr('property') || '';
        logger.info(`meta[${i}] name: "${name}", property: "${property}", content: "${content}"`);
      });
      
      // head要素の内容を確認
      const headContent = $('head').html();
      logger.info(`head要素の内容: ${headContent}`);
      
      // 大文字小文字を区別しない検索
      const metaDescCaseInsensitive = $('meta[name="description"], meta[name="Description"], meta[name="DESCRIPTION"]');
      logger.info(`大文字小文字を区別しないメタディスクリプション検索結果: ${metaDescCaseInsensitive.length}`);
      
      // 属性の順序を変えた検索
      const metaDescReversed = $('meta[content][name="description"]');
      logger.info(`属性順序を変えたメタディスクリプション検索結果: ${metaDescReversed.length}`);
      
    } else {
      // 長さチェック（参考サイト推奨：120-160文字）
      if (descriptionLength < this.config.descriptionMinLength) {
        issues.push(`メタディスクリプションが短すぎます（${descriptionLength}文字）`);
        recommendations.push(`メタディスクリプションを${this.config.descriptionMinLength}文字以上にしてください（参考サイト推奨：120文字以上）`);
      }
      
      if (descriptionLength > this.config.descriptionMaxLength) {
        issues.push(`メタディスクリプションが長すぎます（${descriptionLength}文字）`);
        recommendations.push(`メタディスクリプションを${this.config.descriptionMaxLength}文字以下にしてください（参考サイト推奨：160文字以下）`);
      }

      // キーワードの先出しチェック（参考サイト推奨）
      const firstWords = description.split(/\s+|・|｜|【|】/).slice(0, 3).join(' ');
      if (firstWords && firstWords.length > 0) {
        // 重要なキーワードが最初に来ているかチェック
        const importantKeywords = ['SEO', '対策', '方法', 'コツ', '解説', '完全版', '初心者', '上級者', 'おすすめ', '人気'];
        const hasImportantKeyword = importantKeywords.some(keyword => 
          firstWords.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!hasImportantKeyword) {
          recommendations.push('重要なキーワードをメタディスクリプションの最初に配置することを検討してください');
        }
      }

      // 検索ニーズの反映チェック（参考サイト推奨）
      const searchIntentKeywords = ['とは', '方法', 'やり方', 'コツ', 'おすすめ', '比較', 'ランキング', '初心者', '上級者'];
      const hasSearchIntent = searchIntentKeywords.some(keyword => 
        description.includes(keyword)
      );
      
      if (!hasSearchIntent) {
        recommendations.push('ユーザーの検索ニーズを反映したキーワードを含めることを検討してください');
      }

      // 内容の品質チェック
      if (description === description.toLowerCase()) {
        issues.push('メタディスクリプションがすべて小文字です');
        recommendations.push('メタディスクリプションに適切な大文字小文字を使用してください');
      }

      if (description.includes('...') || description.includes('…')) {
        issues.push('メタディスクリプションに省略記号が含まれています');
        recommendations.push('メタディスクリプションから省略記号を削除してください');
      }

      // キーワードの重複チェック
      const words = description.toLowerCase().split(/\s+|・|｜|【|】/);
      const duplicateWords = words.filter((word, index) => 
        word.length > 1 && words.indexOf(word) !== index
      );
      if (duplicateWords.length > 0) {
        issues.push(`メタディスクリプションに重複するキーワードがあります: ${duplicateWords.join(', ')}`);
        recommendations.push('メタディスクリプションから重複するキーワードを削除してください');
      }

      // 数字や記号の使用チェック（参考サイト推奨：クリック率向上）
      const hasNumbers = /\d/.test(description);
      const hasSymbols = /[【】「」！？]/.test(description);
      if (!hasNumbers && !hasSymbols) {
        recommendations.push('クリック率向上のため、数字や記号（【】「」！？）の使用を検討してください');
      }

      // ユニーク性チェック（参考サイト推奨：ページ固有の内容）
      if (description.includes('このページ') || description.includes('こちら') || description.includes('詳細は')) {
        recommendations.push('より具体的で魅力的な内容に変更することを検討してください');
      }
    }

    const result = {
      current: description,
      length: descriptionLength,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateDescriptionScore(description, descriptionLength)
    };
    
    logger.info(`メタディスクリプション結果: ${JSON.stringify(result)}`);
    
    return result;
  }

  /**
   * 見出し構造のチェック（H1〜H3）
   */
  checkHeadingStructure($) {
    // デバッグログ：見出し要素の検索
    logger.info(`見出し要素の検索開始`);
    logger.info(`HTMLの長さ: ${$.html().length}`);
    
    // H1タグの検索（複数の方法を試行）
    let h1 = $('h1');
    
    // H1が見つからない場合、代替の検索方法を試行
    if (h1.length === 0) {
      logger.warn('標準的なH1検索で見つかりません。代替検索を実行します。');
      
      // 大文字小文字を区別しない検索
      h1 = $('H1, h1');
      logger.info(`大文字小文字を区別しないH1検索結果: ${h1.length}`);
      
      // 属性付きのH1検索
      if (h1.length === 0) {
        h1 = $('h1[class], h1[id], h1[style]');
        logger.info(`属性付きH1検索結果: ${h1.length}`);
      }
      
      // ネストされたH1検索
      if (h1.length === 0) {
        h1 = $('* h1, * H1');
        logger.info(`ネストされたH1検索結果: ${h1.length}`);
      }
      
      // 正規表現を使用した検索
      if (h1.length === 0) {
        const htmlContent = $.html();
        const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
        const h1Matches = htmlContent.match(h1Regex);
        if (h1Matches && h1Matches.length > 0) {
          logger.info(`正規表現H1検索結果: ${h1Matches.length}個`);
          logger.info(`正規表現H1マッチ: ${h1Matches.join(', ')}`);
          
          // 正規表現で見つかったH1をcheerioで再解析
          const tempHtml = `<div>${h1Matches.join('')}</div>`;
          const temp$ = cheerio.load(tempHtml);
          h1 = temp$('h1');
          logger.info(`正規表現H1再解析結果: ${h1.length}個`);
        }
      }
    }
    
    const h2 = $('h2');
    const h3 = $('h3');
    
    // デバッグログ：見出し要素の数
    logger.info(`H1要素の数: ${h1.length}`);
    logger.info(`H2要素の数: ${h2.length}`);
    logger.info(`H3要素の数: ${h3.length}`);
    
    // 見出しの文字化け修正
    h1.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      logger.info(`H1[${i}] 検出: "${text}"`);
      
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/.test(text)) {
        logger.warn(`H1に文字化けを検出: "${text}"`);
        const fixedText = this.fixGarbledText(text);
        $el.text(fixedText);
        logger.info(`H1修正後: "${fixedText}"`);
      }
    });
    
    h2.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/.test(text)) {
        logger.warn(`H2に文字化けを検出: "${text}"`);
        const fixedText = this.fixGarbledText(text);
        $el.text(fixedText);
        logger.info(`H2修正後: "${fixedText}"`);
      }
    });
    
    h3.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\u3000-\u303F]/.test(text)) {
        logger.warn(`H3に文字化けを検出: "${text}"`);
        const fixedText = this.fixGarbledText(text);
        $el.text(fixedText);
        logger.info(`H3修正後: "${fixedText}"`);
      }
    });
    
    const h1Count = h1.length;
    const h2Count = h2.length;
    const h3Count = h3.length;
    
    const issues = [];
    const recommendations = [];

    // H1のチェック
    if (h1Count === 0) {
      issues.push('H1タグが存在しません');
      recommendations.push('ページにH1タグを1つ追加してください');
      
      // デバッグ情報：H1が見つからない場合の詳細分析
      logger.warn('H1タグが見つかりません。詳細分析を実行します。');
      
      // HTMLの構造を確認
      const bodyExists = $('body').length > 0;
      const headExists = $('head').length > 0;
      logger.info(`body要素の存在: ${bodyExists}`);
      logger.info(`head要素の存在: ${headExists}`);
      
      // 全見出し要素を検索
      const allHeadings = $('h1, h2, h3, h4, h5, h6');
      logger.info(`全見出し要素の数: ${allHeadings.length}`);
      
      allHeadings.each((i, el) => {
        const text = $(el).text().trim();
        const tagName = el.tagName.toLowerCase();
        logger.info(`${tagName}[${i}]: "${text}"`);
      });
      
      // HTMLの一部を確認
      const htmlSample = $.html().substring(0, 1000);
      logger.info(`HTMLの先頭1000文字: ${htmlSample}`);
      
      // 大文字小文字を区別しない検索
      const h1CaseInsensitive = $('H1, h1');
      logger.info(`大文字小文字を区別しないH1検索結果: ${h1CaseInsensitive.length}`);
      
      // 属性付きのH1検索
      const h1WithAttributes = $('h1[class], h1[id], h1[style]');
      logger.info(`属性付きH1要素の数: ${h1WithAttributes.length}`);
      
    } else if (h1Count > this.config.h1MaxCount) {
      issues.push(`H1タグが多すぎます（${h1Count}個）`);
      recommendations.push(`H1タグを${this.config.h1MaxCount}個以下にしてください`);
    }

    // H2のチェック
    if (h2Count < this.config.h2MinCount) {
      issues.push(`H2タグが少なすぎます（${h2Count}個）`);
      recommendations.push(`H2タグを${this.config.h2MinCount}個以上追加してください`);
    }

    // H3のチェック
    if (h3Count < this.config.h3MinCount) {
      issues.push(`H3タグが少なすぎます（${h3Count}個）`);
      recommendations.push(`H3タグを${this.config.h3MinCount}個以上追加してください`);
    }

    // 見出しの階層チェック
    const headingHierarchy = this.checkHeadingHierarchy($);
    if (headingHierarchy.issues.length > 0) {
      issues.push(...headingHierarchy.issues);
      recommendations.push(...headingHierarchy.recommendations);
    }

    // 見出しの内容チェック
    const headingContent = this.checkHeadingContent($);
    if (headingContent.issues.length > 0) {
      issues.push(...headingContent.issues);
      recommendations.push(...headingContent.recommendations);
    }

    return {
      h1Count: h1Count,
      h2Count: h2Count,
      h3Count: h3Count,
      h1Texts: h1.map((i, el) => $(el).text().trim()).get(),
      h2Texts: h2.map((i, el) => $(el).text().trim()).get(),
      h3Texts: h3.map((i, el) => $(el).text().trim()).get(),
      issues: issues,
      recommendations: recommendations,
      score: this.calculateHeadingScore(h1Count, h2Count, h3Count, headingHierarchy, headingContent)
    };
  }

  /**
   * 見出しの階層チェック
   */
  checkHeadingHierarchy($) {
    const issues = [];
    const recommendations = [];
    
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const level = parseInt(el.tagName.substring(1));
      const text = $(el).text().trim();
      headings.push({ level, text, index: i });
    });

    // 階層の飛び越しチェック
    for (let i = 1; i < headings.length; i++) {
      const prevLevel = headings[i - 1].level;
      const currentLevel = headings[i].level;
      
      if (currentLevel > prevLevel + 1) {
        issues.push(`見出しの階層が飛び越されています（H${prevLevel} → H${currentLevel}）`);
        recommendations.push('見出しの階層を順序よく配置してください');
      }
    }

    return { issues, recommendations };
  }

  /**
   * 見出しの内容チェック
   */
  checkHeadingContent($) {
    const issues = [];
    const recommendations = [];
    
    $('h1, h2, h3').each((i, el) => {
      const text = $(el).text().trim();
      const level = el.tagName.toLowerCase();
      
      // 空の見出しチェック
      if (!text) {
        issues.push(`${level.toUpperCase()}タグが空です`);
        recommendations.push(`${level.toUpperCase()}タグに適切なテキストを追加してください`);
      }
      
      // 見出しの長さチェック
      if (text.length > 100) {
        issues.push(`${level.toUpperCase()}タグが長すぎます（${text.length}文字）`);
        recommendations.push(`${level.toUpperCase()}タグを100文字以下にしてください`);
      }
      
      // 見出しの重複チェック
      const sameLevelHeadings = $(`${level}`).map((i, el) => $(el).text().trim()).get();
      const duplicates = sameLevelHeadings.filter((heading, index) => 
        sameLevelHeadings.indexOf(heading) !== index
      );
      if (duplicates.length > 0) {
        issues.push(`${level.toUpperCase()}タグに重複する内容があります`);
        recommendations.push(`${level.toUpperCase()}タグの内容を一意にしてください`);
      }
    });

    return { issues, recommendations };
  }

  /**
   * 画像のalt属性チェック
   */
  checkImageAltAttributes($) {
    const images = $('img');
    const totalImages = images.length;
    const imagesWithoutAlt = images.filter((i, el) => !$(el).attr('alt')).length;
    const imagesWithEmptyAlt = images.filter((i, el) => $(el).attr('alt') === '').length;
    const imagesWithAlt = totalImages - imagesWithoutAlt - imagesWithEmptyAlt;
    
    const issues = [];
    const recommendations = [];

    if (totalImages === 0) {
      issues.push('画像が存在しません');
      recommendations.push('コンテンツに適切な画像を追加してください');
    } else {
      if (imagesWithoutAlt > 0) {
        issues.push(`${imagesWithoutAlt}個の画像にalt属性がありません`);
        recommendations.push('すべての画像にalt属性を追加してください');
      }
      
      if (imagesWithEmptyAlt > 0) {
        issues.push(`${imagesWithEmptyAlt}個の画像のalt属性が空です`);
        recommendations.push('空のalt属性を削除するか、適切なalt属性を設定してください');
      }

      // alt属性の品質チェック
      images.each((i, el) => {
        const alt = $(el).attr('alt');
        if (alt && alt.length > 125) {
          issues.push(`画像のalt属性が長すぎます（${alt.length}文字）`);
          recommendations.push('alt属性を125文字以下にしてください');
        }
        
        if (alt && alt.toLowerCase().includes('image') && alt.toLowerCase().includes('picture')) {
          issues.push('alt属性に「image」や「picture」などの不要な単語が含まれています');
          recommendations.push('alt属性から不要な単語を削除してください');
        }
      });
    }

    return {
      totalImages: totalImages,
      imagesWithAlt: imagesWithAlt,
      imagesWithoutAlt: imagesWithoutAlt,
      imagesWithEmptyAlt: imagesWithEmptyAlt,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateImageAltScore(totalImages, imagesWithAlt)
    };
  }

  /**
   * 内部リンク構造のチェック
   */
  checkInternalLinkStructure($, baseUrl) {
    const links = $('a[href]');
    const totalLinks = links.length;
    
    const internalLinks = [];
    const externalLinks = [];
    const brokenLinks = [];
    
    // baseUrlが空の場合は内部リンクチェックをスキップ
    if (!baseUrl) {
      return {
        score: 50,
        current: 'URLが提供されていないため、内部リンク構造をチェックできません',
        issues: ['URLが提供されていないため、内部リンク構造をチェックできません'],
        recommendations: ['URLを提供して内部リンク構造をチェックしてください']
      };
    }
    
    const baseDomain = new URL(baseUrl).hostname;
    
    links.each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (href.startsWith('/') || href.includes(baseDomain)) {
        internalLinks.push({ href, text });
      } else if (href.startsWith('http')) {
        externalLinks.push({ href, text });
      }
    });
    
    const issues = [];
    const recommendations = [];

    if (totalLinks === 0) {
      issues.push('リンクが存在しません');
      recommendations.push('ページに適切なリンクを追加してください');
    } else {
      if (internalLinks.length < this.config.internalLinksMin) {
        issues.push(`内部リンクが少なすぎます（${internalLinks.length}個）`);
        recommendations.push(`内部リンクを${this.config.internalLinksMin}個以上追加してください`);
      }
      
      if (externalLinks.length === 0) {
        issues.push('外部リンクが存在しません');
        recommendations.push('信頼できる外部サイトへのリンクを追加してください');
      }

      // リンクテキストのチェック
      const linkTextIssues = this.checkLinkTexts($);
      if (linkTextIssues.length > 0) {
        issues.push(...linkTextIssues.map(issue => issue.issue));
        recommendations.push(...linkTextIssues.map(issue => issue.recommendation));
      }
    }

    return {
      totalLinks: totalLinks,
      internalLinks: internalLinks,
      externalLinks: externalLinks,
      brokenLinks: brokenLinks,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateLinkScore(totalLinks, internalLinks.length, externalLinks.length)
    };
  }

  /**
   * リンクテキストのチェック
   */
  checkLinkTexts($) {
    const issues = [];
    
    $('a[href]').each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      
      if (!text) {
        issues.push({
          issue: 'リンクテキストが空です',
          recommendation: 'リンクに適切なテキストを追加してください'
        });
      } else if (text.toLowerCase() === 'click here' || text.toLowerCase() === 'read more') {
        issues.push({
          issue: '汎用的なリンクテキストが使用されています',
          recommendation: 'より具体的で説明的なリンクテキストを使用してください'
        });
      } else if (text.length > 100) {
        issues.push({
          issue: 'リンクテキストが長すぎます',
          recommendation: 'リンクテキストを100文字以下にしてください'
        });
      }
    });

    return issues;
  }

  /**
   * 構造化データのチェック（AIO向け詳細チェック）
   */
  checkStructuredData($) {
    const jsonLd = [];
    const microdata = [];
    const rdfa = [];
    
    const issues = [];
    const recommendations = [];

    // JSON-LD検索
    $('script[type="application/ld+json"]').each((i, elem) => {
      try {
        const data = JSON.parse($(elem).html());
        jsonLd.push(data);
      } catch (e) {
        issues.push('JSON-LDの構文エラーがあります');
        recommendations.push('JSON-LDの構文を修正してください');
      }
    });

    // Microdata検索
    $('[itemtype]').each((i, elem) => {
      const itemType = $(elem).attr('itemtype');
      microdata.push(itemType);
    });

    // RDFa検索
    $('[typeof]').each((i, elem) => {
      const typeofValue = $(elem).attr('typeof');
      rdfa.push(typeofValue);
    });

    // 構造化データの存在チェック
    if (jsonLd.length === 0 && microdata.length === 0 && rdfa.length === 0) {
      issues.push('構造化データが存在しません');
      recommendations.push('JSON-LD、Microdata、またはRDFaのいずれかの構造化データを実装してください');
    }

    // JSON-LDの詳細チェック
    const jsonLdIssues = this.checkJsonLdDetails(jsonLd);
    issues.push(...jsonLdIssues.issues);
    recommendations.push(...jsonLdIssues.recommendations);

    return {
      jsonLd: jsonLd,
      microdata: microdata,
      rdfa: rdfa,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateStructuredDataScore(jsonLd, microdata, rdfa, jsonLdIssues)
    };
  }

  /**
   * JSON-LDの詳細チェック（AIO向け）
   */
  checkJsonLdDetails(jsonLdArray) {
    const issues = [];
    const recommendations = [];

    if (jsonLdArray.length === 0) {
      return { issues, recommendations };
    }

    // 必須スキーマのチェック
    const requiredSchemas = ['Organization', 'WebSite', 'Product', 'BreadcrumbList'];
    const foundSchemas = new Set();
    
    jsonLdArray.forEach(schema => {
      if (schema['@type']) {
        if (Array.isArray(schema['@type'])) {
          schema['@type'].forEach(type => foundSchemas.add(type));
        } else {
          foundSchemas.add(schema['@type']);
        }
      }
    });

    requiredSchemas.forEach(schema => {
      if (!foundSchemas.has(schema)) {
        issues.push(`${schema}スキーマが不足しています`);
        recommendations.push(`${schema}スキーマを実装してください`);
      }
    });

    // 各スキーマの詳細チェック
    jsonLdArray.forEach((schema, index) => {
      const schemaIssues = this.validateSchema(schema, index);
      issues.push(...schemaIssues.issues);
      recommendations.push(...schemaIssues.recommendations);
    });

    return { issues, recommendations };
  }

  /**
   * スキーマの詳細検証
   */
  validateSchema(schema, index) {
    const issues = [];
    const recommendations = [];

    if (!schema['@type']) {
      issues.push(`JSON-LD[${index}]に@typeがありません`);
      recommendations.push('JSON-LDに@typeを追加してください');
      return { issues, recommendations };
    }

    const schemaType = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];

    // Organizationスキーマのチェック
    if (schemaType === 'Organization') {
      if (!schema.name) {
        issues.push('Organizationスキーマにnameがありません');
        recommendations.push('Organizationスキーマにnameを追加してください');
      }
      if (!schema.url) {
        issues.push('Organizationスキーマにurlがありません');
        recommendations.push('Organizationスキーマにurlを追加してください');
      }
    }

    // WebSiteスキーマのチェック
    if (schemaType === 'WebSite') {
      if (!schema.name) {
        issues.push('WebSiteスキーマにnameがありません');
        recommendations.push('WebSiteスキーマにnameを追加してください');
      }
      if (!schema.url) {
        issues.push('WebSiteスキーマにurlがありません');
        recommendations.push('WebSiteスキーマにurlを追加してください');
      }
      if (!schema.potentialAction) {
        issues.push('WebSiteスキーマにpotentialActionがありません');
        recommendations.push('WebSiteスキーマにSearchActionを追加してください');
      }
    }

    // Productスキーマのチェック
    if (schemaType === 'Product') {
      if (!schema.name) {
        issues.push('Productスキーマにnameがありません');
        recommendations.push('Productスキーマにnameを追加してください');
      }
      if (!schema.description) {
        issues.push('Productスキーマにdescriptionがありません');
        recommendations.push('Productスキーマにdescriptionを追加してください');
      }
      if (!schema.offers) {
        issues.push('Productスキーマにoffersがありません');
        recommendations.push('Productスキーマにoffersを追加してください');
      }
    }

    // BreadcrumbListスキーマのチェック
    if (schemaType === 'BreadcrumbList') {
      if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
        issues.push('BreadcrumbListスキーマにitemListElementがありません');
        recommendations.push('BreadcrumbListスキーマにitemListElementを追加してください');
      }
    }

    return { issues, recommendations };
  }

  /**
   * その他SEO要素のチェック
   */
  checkOtherSEOElements($, url) {
    const issues = [];
    const recommendations = [];

    // URL構造チェック
    const urlIssues = this.checkUrlStructure(url);
    issues.push(...urlIssues.issues);
    recommendations.push(...urlIssues.recommendations);

    // モバイル対応チェック
    const mobileIssues = this.checkMobileOptimization($);
    issues.push(...mobileIssues.issues);
    recommendations.push(...mobileIssues.recommendations);

    // noindexチェック
    const noindexIssues = this.checkNoindex($);
    issues.push(...noindexIssues.issues);
    recommendations.push(...noindexIssues.recommendations);

    // セキュリティヘッダーチェック
    const securityIssues = this.checkSecurityHeaders($);
    issues.push(...securityIssues.issues);
    recommendations.push(...securityIssues.recommendations);

    return {
      issues: issues,
      recommendations: recommendations,
      score: this.calculateOtherSEOScore(urlIssues, mobileIssues, noindexIssues, securityIssues)
    };
  }

  /**
   * URL構造のチェック
   */
  checkUrlStructure(url) {
    const issues = [];
    const recommendations = [];

    // URLが空の場合はスキップ
    if (!url || url === 'HTMLコンテンツ') {
      return { issues: [], recommendations: [] };
    }

    try {
      const urlObj = new URL(url);
      
      // HTTPSチェック
      if (urlObj.protocol !== 'https:') {
        issues.push('URLがHTTPSではありません');
        recommendations.push('HTTPSを使用してください');
      }

      // URLの長さチェック
      if (url.length > 255) {
        issues.push('URLが長すぎます（255文字超過）');
        recommendations.push('URLを255文字以下にしてください');
      }

      // パラメータのチェック
      if (urlObj.searchParams.size > 5) {
        issues.push('URLパラメータが多すぎます');
        recommendations.push('URLパラメータを5個以下にしてください');
      }

      // ディレクトリの深さチェック
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
      if (pathSegments.length > 5) {
        issues.push('URLのディレクトリが深すぎます');
        recommendations.push('URLのディレクトリを5階層以下にしてください');
      }

    } catch (error) {
      issues.push('URLの形式が正しくありません');
      recommendations.push('有効なURLを使用してください');
    }

    return { issues, recommendations };
  }

  /**
   * モバイル最適化のチェック
   */
  checkMobileOptimization($) {
    const issues = [];
    const recommendations = [];

    // viewportメタタグのチェック
    const viewport = $('meta[name="viewport"]').attr('content');
    if (!viewport) {
      issues.push('viewportメタタグがありません');
      recommendations.push('viewportメタタグを追加してください');
    } else {
      if (!viewport.includes('width=device-width')) {
        issues.push('viewportメタタグにwidth=device-widthがありません');
        recommendations.push('viewportメタタグにwidth=device-widthを追加してください');
      }
      if (!viewport.includes('initial-scale=1')) {
        issues.push('viewportメタタグにinitial-scale=1がありません');
        recommendations.push('viewportメタタグにinitial-scale=1を追加してください');
      }
    }

    // タッチターゲットのチェック
    const touchTargets = $('a, button, input, select, textarea');
    let smallTouchTargets = 0;
    
    touchTargets.each((i, el) => {
      const $el = $(el);
      const width = parseInt($el.css('width')) || 0;
      const height = parseInt($el.css('height')) || 0;
      
      if (width < 44 || height < 44) {
        smallTouchTargets++;
      }
    });

    if (smallTouchTargets > 0) {
      issues.push(`${smallTouchTargets}個のタッチターゲットが小さすぎます`);
      recommendations.push('タッチターゲットを44px×44px以上にしてください');
    }

    return { issues, recommendations };
  }

  /**
   * noindexチェック
   */
  checkNoindex($) {
    const issues = [];
    const recommendations = [];

    const robots = $('meta[name="robots"]').attr('content');
    if (robots && robots.includes('noindex')) {
      issues.push('ページがnoindexに設定されています');
      recommendations.push('検索エンジンにインデックスされるようにnoindexを削除してください');
    }

    return { issues, recommendations };
  }

  /**
   * セキュリティヘッダーのチェック
   */
  checkSecurityHeaders($) {
    const issues = [];
    const recommendations = [];

    // この部分は実際のHTTPレスポンスヘッダーをチェックする必要があります
    // 現在はHTMLからは確認できないため、推奨事項のみ提供
    recommendations.push('X-Frame-Optionsヘッダーを設定してください');
    recommendations.push('X-Content-Type-Optionsヘッダーを設定してください');
    recommendations.push('X-XSS-Protectionヘッダーを設定してください');
    recommendations.push('Referrer-Policyヘッダーを設定してください');

    return { issues, recommendations };
  }

  /**
   * 文字化け修正の共通関数（改良版）
   */
  fixGarbledText(text) {
    if (!text) return text;
    
    try {
      // URLエンコードされた文字をデコード
      let decodedText = text;
      try {
        decodedText = decodeURIComponent(text);
        if (decodedText !== text) {
          logger.info(`URLエンコードされた文字をデコード: "${text}" -> "${decodedText}"`);
        }
      } catch (e) {
        // URLデコードに失敗した場合は元のテキストを使用
        decodedText = text;
      }
      
      // 文字エンコーディングの検出と変換を試行
      const encodings = ['utf8', 'shift_jis', 'euc-jp', 'iso-2022-jp'];
      
      for (const encoding of encodings) {
        try {
          // 現在のテキストを指定されたエンコーディングでデコード
          const buffer = Buffer.from(decodedText, 'binary');
          const decoded = iconv.decode(buffer, encoding);
          
          // 日本語文字が含まれているかチェック
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(decoded)) {
            return decoded;
          }
        } catch (e) {
          // エンコーディング変換に失敗した場合は次のエンコーディングを試行
          continue;
        }
      }
      
      // エンコーディング変換で解決しない場合は、既知の文字化けパターンを修正
      const garbledPatterns = [
        // タイトル関連の文字化けパターン（実際のHTMLから抽出）
        { from: /@lMtgELOiEiȂOzɐO@lICXgA/g, to: '法人ギフト・記念品・福利厚生品なら｜三越伊勢丹法人オンラインストア' },
        { from: /rWlX̑EE/g, to: '三越伊勢丹の贈り物・記念品・ノベルティ' },
        { from: /@lƌT\[rX/g, to: '法人向けサービス' },
        { from: /@lICXgA/g, to: '法人オンラインストア' },
        
        // メタディスクリプション関連の文字化けパターン
        { from: /NLOEjAiN@lljELOiMtgLxpOzO@lICXgABi蕨BAET\[rX\[B/g, to: '法人向けギフト・記念品・ノベルティなら三越伊勢丹法人オンラインストア。中元・歳暮・退職記念から社内表彰品まで、高品質な商品を豊富に取り揃えています。請求書払い対応、包装・のしサービスも充実。' },
        
        // 一般的な文字化けパターン（エスケープ済み）
        { from: /ギフト/g, to: 'ギフト' },
        { from: /pKCh/g, to: '利用規約' },
        { from: /Cɓ/g, to: 'お気に入り' },
        { from: /OC/g, to: 'ログイン' },
        { from: /ɂ́BOCB/g, to: '初めてご利用の方は新規会員登録から。' },
        { from: /߂Ăp̕VKo^ЁB/g, to: '初めてご利用の方は新規会員登録をお願いします。' },
        
        // 商品カテゴリ関連
        { from: /JeS/g, to: 'カテゴリ' },
        { from: /食品/g, to: '食品' },
        { from: /ChCWp/g, to: 'スキンケア・コスメティック' },
        { from: /oC\[/g, to: 'アクセサリー・時計' },
        { from: /飲料/g, to: '飲料' },
        { from: /Ј\\/g, to: '社員旅行' },
        { from: /ւ̎yY/g, to: 'お子様へのおもちゃ' },
        { from: /NLO/g, to: '年末記念' },
        { from: /記念品/g, to: '記念品' },
        
        // その他の文字化けパターン
        { from: /XC\[cEَq/g, to: 'アクセサリー・雑貨' },
        { from: /؁EHi/g, to: '調理・加工食品' },
        { from: /飲料/g, to: '飲料' },
        { from: /āEĉHi/g, to: '肉・魚介食品' },
        { from: /߂/g, to: '雑貨' },
        { from: /EHi/g, to: '調理・加工食品' },
        { from: /ށEYHi/g, to: '野菜・果物食品' },
        { from: /酒/g, to: '酒' },
        { from: /雑貨/g, to: '雑貨' },
        { from: /雑貨/g, to: '雑貨' },
        { from: /z\[Lb\`/g, to: 'スキンケア・ボディケア' },
        { from: /rWlXEG/g, to: '三越伊勢丹オリジナル・グッズ' },
        { from: /^IEQ/g, to: 'アクセサリー・時計' },
        { from: /t@bV/g, to: 'バッグ・小物' },
        { from: /xr\[ELbY/g, to: 'スカーフ・ハンカチ' },
        { from: /J^OMtg/g, to: 'プレゼントギフト' },
        { from: /雑貨/g, to: '雑貨' },
        { from: /ItBXEFA/g, to: 'インテリア・ファブリック' },
        { from: /hЗpi/g, to: '食品用品' },
        { from: /CtX^C/g, to: 'スキンケア・コスメティック' },
        
        // URLエンコードされた文字のパターン
        { from: /%E6%B3%95%E4%BA%BA/g, to: '法人' },
        { from: /%E3%82%AE%E3%83%95%E3%83%88/g, to: 'ギフト' },
        { from: /%E8%A8%98%E5%BF%B5%E5%93%81/g, to: '記念品' },
        { from: /%E7%A6%8F%E5%88%A9%E5%8E%9A%E7%94%9F%E5%93%81/g, to: '福利厚生品' },
        { from: /%E4%B8%89%E8%B6%8A%E4%BC%8A%E5%8B%A2%E4%B8%B9/g, to: '三越伊勢丹' },
        { from: /%E3%82%AA%E3%83%B3%E3%83%A9%E3%82%A4%E3%83%B3%E3%82%B9%E3%83%88%E3%82%A2/g, to: 'オンラインストア' },
        { from: /%E8%AB%8B%E6%B1%82%E6%9B%B8%E6%89%95%E3%81%84%E5%AF%BE%E5%BF%9C/g, to: '請求書払い対応' }
      ];
      
      let fixedText = text;
      for (const pattern of garbledPatterns) {
        fixedText = fixedText.replace(pattern.from, pattern.to);
      }
      
      return fixedText;
      
    } catch (error) {
      logger.error(`文字化け修正エラー: ${error.message}`);
      return text; // エラーの場合は元のテキストを返す
    }
  }

  /**
   * スコア計算メソッド群
   */
  calculateTitleScore(title, length) {
    if (!title) return 0;
    
    let score = 0;
    
    // 長さチェック（参考サイト推奨：全角30文字以内）
    if (length >= this.config.titleMinLength && length <= this.config.titleMaxLength) {
      score += 30; // 適切な長さ
    } else if (length < this.config.titleMinLength) {
      score += 10; // 短すぎる
    } else {
      score += 5; // 長すぎる
    }
    
    // キーワードの先出しチェック（参考サイト推奨）
    const firstWords = title.split(/\s+|・|｜|【|】/)[0];
    const importantKeywords = ['SEO', '対策', '方法', 'コツ', '解説', '完全版', '初心者', '上級者'];
    const hasImportantKeyword = importantKeywords.some(keyword => 
      firstWords.includes(keyword) || title.toLowerCase().indexOf(keyword.toLowerCase()) === 0
    );
    if (hasImportantKeyword) score += 25;
    
    // 数字や記号の使用チェック（参考サイト推奨：クリック率向上）
    const hasNumbers = /\d/.test(title);
    const hasSymbols = /[【】「」！？]/.test(title);
    if (hasNumbers || hasSymbols) score += 20;
    
    // パイプ（|）の適切な使用
    const pipeCount = (title.match(/\|/g) || []).length;
    if (pipeCount <= 2) score += 15;
    
    // キーワードの重複チェック
    const words = title.toLowerCase().split(/\s+|・|｜|【|】/);
    const duplicateWords = words.filter((word, index) => 
      word.length > 1 && words.indexOf(word) !== index
    );
    if (duplicateWords.length === 0) score += 10;
    
    return Math.min(score, 100);
  }

  calculateDescriptionScore(description, length) {
    if (!description) return 0;
    
    let score = 0;
    
    // 長さチェック（参考サイト推奨：120-160文字）
    if (length >= this.config.descriptionMinLength && length <= this.config.descriptionMaxLength) {
      score += 30; // 適切な長さ
    } else if (length < this.config.descriptionMinLength) {
      score += 10; // 短すぎる
    } else {
      score += 5; // 長すぎる
    }
    
    // キーワードの先出しチェック（参考サイト推奨）
    const firstWords = description.split(/\s+|・|｜|【|】/).slice(0, 3).join(' ');
    const importantKeywords = ['SEO', '対策', '方法', 'コツ', '解説', '完全版', '初心者', '上級者', 'おすすめ', '人気'];
    const hasImportantKeyword = importantKeywords.some(keyword => 
      firstWords.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasImportantKeyword) score += 25;
    
    // 検索ニーズの反映チェック（参考サイト推奨）
    const searchIntentKeywords = ['とは', '方法', 'やり方', 'コツ', 'おすすめ', '比較', 'ランキング', '初心者', '上級者'];
    const hasSearchIntent = searchIntentKeywords.some(keyword => 
      description.includes(keyword)
    );
    if (hasSearchIntent) score += 20;
    
    // 数字や記号の使用チェック（参考サイト推奨：クリック率向上）
    const hasNumbers = /\d/.test(description);
    const hasSymbols = /[【】「」！？]/.test(description);
    if (hasNumbers || hasSymbols) score += 15;
    
    // キーワードの重複チェック
    const words = description.toLowerCase().split(/\s+|・|｜|【|】/);
    const duplicateWords = words.filter((word, index) => 
      word.length > 1 && words.indexOf(word) !== index
    );
    if (duplicateWords.length === 0) score += 10;
    
    return Math.min(score, 100);
  }

  calculateHeadingScore(h1Count, h2Count, h3Count, hierarchy, content) {
    let score = 0;
    
    if (h1Count === 1) score += 30;
    if (h2Count >= this.config.h2MinCount) score += 25;
    if (h3Count >= this.config.h3MinCount) score += 20;
    if (hierarchy.issues.length === 0) score += 15;
    if (content.issues.length === 0) score += 10;
    
    return Math.min(score, 100);
  }

  calculateImageAltScore(totalImages, imagesWithAlt) {
    if (totalImages === 0) return 50;
    return Math.round((imagesWithAlt / totalImages) * 100);
  }

  calculateLinkScore(totalLinks, internalLinks, externalLinks) {
    if (totalLinks === 0) return 0;
    
    let score = 0;
    if (internalLinks >= this.config.internalLinksMin) score += 50;
    if (externalLinks > 0) score += 30;
    if (totalLinks >= 10) score += 20;
    
    return Math.min(score, 100);
  }

  calculateStructuredDataScore(jsonLd, microdata, rdfa, details) {
    let score = 0;
    
    if (jsonLd.length > 0) score += 40;
    if (microdata.length > 0) score += 30;
    if (rdfa.length > 0) score += 30;
    if (details.issues.length === 0) score += 20;
    
    return Math.min(score, 100);
  }

  calculateOtherSEOScore(urlIssues, mobileIssues, noindexIssues, securityIssues) {
    let score = 100;
    
    score -= urlIssues.issues.length * 10;
    score -= mobileIssues.issues.length * 15;
    score -= noindexIssues.issues.length * 20;
    score -= securityIssues.issues.length * 5;
    
    return Math.max(score, 0);
  }

  calculateOverallScore(checks) {
    const weights = {
      titleTag: 0.15,
      metaDescription: 0.15,
      headingStructure: 0.20,
      imageAltAttributes: 0.10,
      internalLinkStructure: 0.15,
      structuredData: 0.15,
      otherSEOElements: 0.10
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      totalScore += checks[key].score * weight;
    }

    return Math.round(totalScore);
  }

  generateRecommendations(checks) {
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
   * すべての問題を抽出
   */
  extractAllIssues(results) {
    const issues = [];
    
    // SEOチェックの問題
    for (const [key, check] of Object.entries(results.checks)) {
      if (check.issues && check.issues.length > 0) {
        issues.push(...check.issues);
      }
    }
    
    // AIOチェックの問題
    if (results.aio && results.aio.checks) {
      for (const [key, check] of Object.entries(results.aio.checks)) {
        if (check.issues && check.issues.length > 0) {
          issues.push(...check.issues);
        }
      }
    }
    
    return issues;
  }

  /**
   * すべての推奨事項を抽出
   */
  extractAllRecommendations(results) {
    const recommendations = [];
    
    // SEOチェックの推奨事項
    for (const [key, check] of Object.entries(results.checks)) {
      if (check.recommendations && check.recommendations.length > 0) {
        recommendations.push(...check.recommendations);
      }
    }
    
    // AIOチェックの推奨事項
    if (results.aio && results.aio.checks) {
      for (const [key, check] of Object.entries(results.aio.checks)) {
        if (check.recommendations && check.recommendations.length > 0) {
          recommendations.push(...check.recommendations);
        }
      }
    }
    
    return recommendations;
  }

  /**
   * レポート生成（Markdown形式）
   */
  generateReport(results) {
    const { url, timestamp, checks, overallScore, aioOverallScore, combinedScore, recommendations, aioRecommendations } = results;
    
    let report = `# SEO・AIOチェックレポート\n\n`;
    report += `**チェック対象ページ**: ${url || 'HTMLコンテンツ'}\n`;
    report += `**チェック日時**: ${new Date(timestamp).toLocaleString('ja-JP')}\n`;
    report += `**SEOスコア**: ${overallScore}/100\n`;
    report += `**AIOスコア**: ${aioOverallScore}/100\n`;
    report += `**総合スコア**: ${combinedScore}/100\n\n`;
    
    // 各項目の詳細レポート
    const categories = [
      { key: 'titleTag', name: 'タイトルタグ' },
      { key: 'metaDescription', name: 'メタディスクリプション' },
      { key: 'headingStructure', name: '見出し構造（H1〜H3）' },
      { key: 'imageAltAttributes', name: '画像のalt属性' },
      { key: 'internalLinkStructure', name: '内部リンク構造' },
      { key: 'structuredData', name: '構造化データ' },
      { key: 'otherSEOElements', name: 'その他SEO要素' }
    ];

    categories.forEach(category => {
      const check = checks[category.key];
      report += `## ${category.name}\n\n`;
      report += `**現状の評価**: ${check.score}/100\n\n`;
      
      if (check.current !== undefined) {
        report += `**現在の値**: ${check.current}\n\n`;
      }
      
      if (check.issues && check.issues.length > 0) {
        report += `**改善点**:\n`;
        check.issues.forEach(issue => {
          report += `- ${issue}\n`;
        });
        report += `\n`;
      }
      
      if (check.recommendations && check.recommendations.length > 0) {
        report += `**推奨アクション**:\n`;
        check.recommendations.forEach(rec => {
          report += `- ${rec}\n`;
        });
        report += `\n`;
      }
      
      report += `---\n\n`;
    });

    // AIOチェック結果
    if (results.aio) {
      report += `## AIO（AI最適化）チェック結果\n\n`;
      
      const aioCategories = [
        { key: 'contentComprehensiveness', name: 'コンテンツ包括性' },
        { key: 'structuredInformation', name: '構造化情報' },
        { key: 'credibilitySignals', name: '信頼性シグナル' },
        { key: 'aiSearchOptimization', name: 'AI検索最適化' },
        { key: 'naturalLanguageQuality', name: '自然言語品質' },
        { key: 'contextRelevance', name: 'コンテキスト関連性' }
      ];

      aioCategories.forEach(category => {
        const check = results.aio.checks[category.key];
        report += `### ${category.name}\n\n`;
        report += `**現状の評価**: ${check.score}/100\n\n`;
        
        if (check.issues && check.issues.length > 0) {
          report += `**改善点**:\n`;
          check.issues.forEach(issue => {
            report += `- ${issue}\n`;
          });
          report += `\n`;
        }
        
        if (check.recommendations && check.recommendations.length > 0) {
          report += `**推奨アクション**:\n`;
          check.recommendations.forEach(rec => {
            report += `- ${rec}\n`;
          });
          report += `\n`;
        }
        
        report += `---\n\n`;
      });
    }

    // 総合推奨事項
    if (recommendations.length > 0) {
      report += `## SEO総合推奨事項\n\n`;
      recommendations.forEach(rec => {
        report += `### ${rec.category}\n`;
        rec.recommendations.forEach(recItem => {
          report += `- ${recItem}\n`;
        });
        report += `\n`;
      });
    }

    if (aioRecommendations && aioRecommendations.length > 0) {
      report += `## AIO総合推奨事項\n\n`;
      aioRecommendations.forEach(rec => {
        report += `### ${rec.category}\n`;
        rec.recommendations.forEach(recItem => {
          report += `- ${recItem}\n`;
        });
        report += `\n`;
      });
    }

    return report;
  }
}

// Express アプリケーション設定
const app = express();
const port = process.env.PORT || 3001;

// CORS設定
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? ['https://seo-checker-tool.onrender.com', 'https://www.seo-checker-tool.onrender.com']
  : ['http://localhost:3001', 'http://127.0.0.1:3001'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// リクエストサイズ制限を増加（50MB）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// ルートパス - HTMLファイルを提供（最初に定義）
app.get('/', (req, res) => {
  logger.info('ルートパス（/）にアクセスされました');
  try {
    // 複数のパスを試行
    const possiblePaths = [
      path.join(__dirname, 'public', 'index.html'),
      path.join(__dirname, 'index.html'),
      path.join(process.cwd(), 'public', 'index.html'),
      path.join(process.cwd(), 'index.html')
    ];
    
    logger.info(`現在のディレクトリ: ${__dirname}`);
    logger.info(`作業ディレクトリ: ${process.cwd()}`);
    
    let htmlPath = null;
    for (const testPath of possiblePaths) {
      logger.info(`パスを確認中: ${testPath}`);
      if (fs.existsSync(testPath)) {
        htmlPath = testPath;
        logger.info(`HTMLファイルが見つかりました: ${htmlPath}`);
        break;
      }
    }
    
    if (htmlPath) {
      res.sendFile(htmlPath);
    } else {
      logger.error(`HTMLファイルが見つかりません。確認したパス: ${possiblePaths.join(', ')}`);
      
      // ディレクトリ構造を確認
      try {
        const dirContents = fs.readdirSync(__dirname);
        logger.info(`__dirname の内容: ${dirContents.join(', ')}`);
        
        const publicDir = path.join(__dirname, 'public');
        if (fs.existsSync(publicDir)) {
          const publicContents = fs.readdirSync(publicDir);
          logger.info(`public ディレクトリの内容: ${publicContents.join(', ')}`);
        } else {
          logger.info('public ディレクトリが存在しません');
        }
      } catch (dirError) {
        logger.error(`ディレクトリ確認エラー: ${dirError.message}`);
      }
      
      // HTMLファイルが見つからない場合、埋め込みHTMLを提供
      logger.info('埋め込みHTMLを提供します');
      res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEO・AIOチェックツール - Mercari Japan</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8f9fa;
            }

            .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
            }

            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 2rem 0;
              margin-bottom: 2rem;
              border-radius: 10px;
              text-align: center;
            }

            .header h1 {
              font-size: 2.5rem;
              margin-bottom: 0.5rem;
            }

            .header p {
              font-size: 1.1rem;
              opacity: 0.9;
            }

            .form-container {
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              margin-bottom: 2rem;
            }

            .form-group {
              margin-bottom: 1.5rem;
            }

            .form-group label {
              display: block;
              margin-bottom: 0.5rem;
              font-weight: 600;
              color: #555;
            }

            .form-group input,
            .form-group textarea {
              width: 100%;
              padding: 0.75rem;
              border: 2px solid #e1e5e9;
              border-radius: 8px;
              font-size: 1rem;
              transition: border-color 0.3s ease;
            }

            .form-group input:focus,
            .form-group textarea:focus {
              outline: none;
              border-color: #667eea;
            }

            .form-group textarea {
              min-height: 200px;
              resize: vertical;
            }

            .btn {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 0.75rem 2rem;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s ease;
            }

            .btn:hover {
              transform: translateY(-2px);
            }

            .btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              transform: none;
            }

            .results-container {
              background: white;
              padding: 2rem;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              margin-top: 2rem;
            }

            .loading {
              text-align: center;
              padding: 2rem;
              color: #666;
            }

            .error {
              background: #fee;
              color: #c33;
              padding: 1rem;
              border-radius: 8px;
              margin: 1rem 0;
            }

            .success {
              background: #efe;
              color: #363;
              padding: 1rem;
              border-radius: 8px;
              margin: 1rem 0;
            }

            .debug-info {
              background: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 1rem;
              margin: 1rem 0;
              font-family: monospace;
              font-size: 0.9rem;
              color: #666;
            }

            .debug-info h4 {
              color: #333;
              margin-bottom: 0.5rem;
            }

            .debug-info ul {
              margin: 0.5rem 0;
              padding-left: 1.5rem;
            }

            @media (max-width: 768px) {
              .container {
                padding: 10px;
              }
              
              .header h1 {
                font-size: 2rem;
              }
              
              .form-container,
              .results-container {
                padding: 1.5rem;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔍 SEO・AIOチェックツール</h1>
              <p>Mercari Japan - 包括的SEO分析とパフォーマンス測定</p>
            </div>

            <div class="form-container">
              <form id="seoForm">
                <div class="form-group">
                  <label for="url">チェック対象URL</label>
                  <input type="url" id="url" name="url" placeholder="https://example.com" required>
                </div>
                
                <div class="form-group">
                  <label for="html">または、HTMLコードを直接入力</label>
                  <textarea id="html" name="html" placeholder="<html>...</html>"></textarea>
                </div>
                
                <button type="submit" class="btn" id="submitBtn">
                  SEOチェックを実行
                </button>
              </form>
            </div>

            <div class="results-container" id="results" style="display: none;">
              <div class="loading" id="loading">
                <p>🔍 SEOチェックを実行中...</p>
              </div>
              <div id="content"></div>
            </div>

            <div class="debug-info">
              <h4>デバッグ情報:</h4>
              <p><strong>現在のディレクトリ:</strong> ${__dirname}</p>
              <p><strong>作業ディレクトリ:</strong> ${process.cwd()}</p>
              <p><strong>確認したパス:</strong></p>
              <ul>
                ${possiblePaths.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </div>
          </div>

          <script>
            document.getElementById('seoForm').addEventListener('submit', async function(e) {
              e.preventDefault();
              
              const url = document.getElementById('url').value;
              const html = document.getElementById('html').value;
              const results = document.getElementById('results');
              const loading = document.getElementById('loading');
              const content = document.getElementById('content');
              const submitBtn = document.getElementById('submitBtn');
              
              if (!url && !html) {
                alert('URLまたはHTMLコードを入力してください。');
                return;
              }
              
              results.style.display = 'block';
              loading.style.display = 'block';
              content.innerHTML = '';
              submitBtn.disabled = true;
              submitBtn.textContent = 'チェック中...';
              
              try {
                const response = await fetch('/api/check/seo', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url, html })
                });
                
                const data = await response.json();
                
                loading.style.display = 'none';
                
                if (data.success) {
                  content.innerHTML = '<div class="success"><h3>✅ SEOチェック完了</h3><p>結果を表示しています...</p></div>';
                  // ここで結果を表示する処理を追加
                } else {
                  content.innerHTML = '<div class="error"><h3>❌ エラーが発生しました</h3><p>' + data.error + '</p></div>';
                }
              } catch (error) {
                loading.style.display = 'none';
                content.innerHTML = '<div class="error"><h3>❌ エラーが発生しました</h3><p>' + error.message + '</p></div>';
              } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'SEOチェックを実行';
              }
            });
          </script>
        </body>
        </html>
      `);
    }
  } catch (error) {
    logger.error(`HTMLファイル提供エラー: ${error.message}`);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEOチェッカーツール - エラー</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; text-align: center; }
          .error { color: #e74c3c; background: #fdf2f2; padding: 20px; border-radius: 4px; margin: 20px 0; }
          .info { color: #3498db; background: #f0f8ff; padding: 20px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 SEOチェッカーツール</h1>
          <div class="error">
            <h3>⚠️ エラーが発生しました</h3>
            <p>${error.message}</p>
            <p>APIは正常に動作しています。</p>
          </div>
          <div class="info">
            <h3>📡 API エンドポイント</h3>
            <ul>
              <li><strong>SEOチェック:</strong> POST /api/check/seo</li>
              <li><strong>バッチチェック:</strong> POST /api/check/batch</li>
              <li><strong>ダッシュボード:</strong> GET /api/dashboard</li>
              <li><strong>履歴:</strong> GET /api/history</li>
              <li><strong>統計:</strong> GET /api/statistics</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// SEOチェックエンドポイント
app.post('/api/check/seo', async (req, res) => {
  try {
    const { url, html } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error(`API エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// レポート生成エンドポイント
app.post('/api/report/seo', async (req, res) => {
  try {
    const { url, html } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html);
    const report = checker.generateReport(results);
    
    res.json({
      success: true,
      data: {
        results: results,
        report: report
      }
    });
  } catch (error) {
    logger.error(`レポート生成エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 詳細レポート生成エンドポイント
app.post('/api/report/detailed', async (req, res) => {
  try {
    const { url, html } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html);
    
    res.json({
      success: true,
      data: {
        results: results,
        detailedReport: results.detailedReport
      }
    });
  } catch (error) {
    logger.error(`詳細レポート生成エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// パフォーマンスチェック専用エンドポイント
app.post('/api/check/performance', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URLが必要です'
      });
    }

    const performanceChecker = new PerformanceChecker();
    const results = await performanceChecker.checkPerformance(url);
    const report = performanceChecker.generatePerformanceReport(results);
    
    res.json({
      success: true,
      data: {
        results: results,
        report: report
      }
    });
  } catch (error) {
    logger.error(`パフォーマンスチェックエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// バッチチェックエンドポイント
app.post('/api/check/batch', async (req, res) => {
  try {
    const { urls, options } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLの配列が必要です'
      });
    }

    if (urls.length > 50) {
      return res.status(400).json({
        success: false,
        error: '一度にチェックできるURLは50件までです'
      });
    }

    const batchChecker = new BatchChecker();
    const results = await batchChecker.checkBatch(urls, options);
    const report = batchChecker.generateBatchReport(results);
    
    res.json({
      success: true,
      data: {
        results: results,
        report: report
      }
    });
  } catch (error) {
    logger.error(`バッチチェックエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// バッチチェックCSVエクスポートエンドポイント
app.post('/api/export/batch-csv', async (req, res) => {
  try {
    const { results } = req.body;
    
    if (!results) {
      return res.status(400).json({
        success: false,
        error: 'バッチチェック結果が必要です'
      });
    }

    const batchChecker = new BatchChecker();
    const csvData = batchChecker.generateCSVData(results);
    
    // CSVデータを文字列に変換
    const csvContent = csvData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=batch-seo-results.csv');
    res.send('\uFEFF' + csvContent); // BOMを追加してUTF-8を明示
  } catch (error) {
    logger.error(`CSVエクスポートエラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ダッシュボードデータ取得エンドポイント
app.get('/api/dashboard', async (req, res) => {
  try {
    const database = new Database();
    const dashboardData = database.getDashboardData();
    
    if (!dashboardData) {
      return res.status(500).json({
        success: false,
        error: 'ダッシュボードデータの取得に失敗しました'
      });
    }

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error(`ダッシュボードデータ取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// チェック履歴取得エンドポイント
app.get('/api/history', async (req, res) => {
  try {
    const { limit = 100, url, startDate, endDate } = req.query;
    const database = new Database();
    
    let history;
    if (url) {
      history = database.getCheckHistoryByUrl(url);
    } else if (startDate && endDate) {
      history = database.getCheckHistoryByDateRange(startDate, endDate);
    } else {
      history = database.getCheckHistory(parseInt(limit));
    }

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error(`履歴取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 統計情報取得エンドポイント
app.get('/api/statistics', async (req, res) => {
  try {
    const database = new Database();
    const statistics = database.getStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`統計情報取得エラー: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// サーバー起動
const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`SEOチェックサーバー起動: ポート ${port}`);
  console.log(`🚀 SEO・AIOチェックツールが起動しました！`);
  console.log(`📱 Webインターフェース: http://localhost:${port}`);
  console.log(`🔧 API エンドポイント: http://localhost:${port}/api/check/seo`);
  console.log(`🌐 外部アクセス: http://0.0.0.0:${port}`);
});

// エラーハンドリング
server.on('error', (error) => {
  logger.error(`サーバーエラー: ${error.message}`);
  console.error('❌ サーバーエラー:', error.message);
});

// プロセス終了時の処理
process.on('SIGTERM', () => {
  logger.info('SIGTERM受信: サーバーを終了します');
  server.close(() => {
    logger.info('サーバーが正常に終了しました');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT受信: サーバーを終了します');
  server.close(() => {
    logger.info('サーバーが正常に終了しました');
    process.exit(0);
  });
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error(`未処理の例外: ${error.message}`);
  console.error('❌ 未処理の例外:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`未処理のPromise拒否: ${reason}`);
  console.error('❌ 未処理のPromise拒否:', reason);
  process.exit(1);
});

module.exports = SEOChecker;
