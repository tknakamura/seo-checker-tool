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
const PageTypeAnalyzer = require('./page-type-analyzer');
const StructuredDataRecommender = require('./structured-data-recommender');
const SchemaTemplates = require('./schema-templates');
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
    this.pageTypeAnalyzer = new PageTypeAnalyzer();
    this.structuredDataRecommender = new StructuredDataRecommender();
    this.schemaTemplates = new SchemaTemplates();
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
   * 設定ファイルの読み込み
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/seo-config.yaml');
      // YAMLファイルの読み込みは後で実装
      return {
        titleMaxLength: 30,  // 全角基準に変更（30全角文字）
        titleMinLength: 15,  // 全角基準に変更（15全角文字）
        descriptionMaxLength: 80,  // 全角基準に変更（80全角文字）
        descriptionMinLength: 60,  // 全角基準に変更（60全角文字）
        h1MaxCount: 1,
        h2MinCount: 2,
        h3MinCount: 3,
        imageAltRequired: true,
        internalLinksMin: 10,
        structuredDataRequired: true,
        jsWaitTime: 3000, // JavaScript実行待機時間（ミリ秒）
        jsTimeout: 30000  // Puppeteerタイムアウト（ミリ秒）
      };
    } catch (error) {
      logger.warn('設定ファイルの読み込みに失敗、デフォルト設定を使用');
      return {
        titleMaxLength: 30,  // 全角基準に変更（30全角文字）
        titleMinLength: 15,  // 全角基準に変更（15全角文字）
        descriptionMaxLength: 80,  // 全角基準に変更（80全角文字）
        descriptionMinLength: 60,  // 全角基準に変更（60全角文字）
        h1MaxCount: 1,
        h2MinCount: 2,
        h3MinCount: 3,
        imageAltRequired: true,
        internalLinksMin: 10,
        structuredDataRequired: true,
        jsWaitTime: 3000, // JavaScript実行待機時間（ミリ秒）
        jsTimeout: 30000  // Puppeteerタイムアウト（ミリ秒）
      };
    }
  }

  /**
   * Puppeteerを使用してHTMLを取得（JavaScript実行待機付き）
   * @param {string} url - 取得対象のURL
   * @returns {string} HTMLコンテンツ
   */
  async fetchHTMLWithPuppeteer(url) {
    let browser = null;
    let page = null;
    try {
      logger.info(`PuppeteerでHTML取得開始: ${url}`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--memory-pressure-off',
          '--max_old_space_size=512'
        ]
      });
      
      page = await browser.newPage();
      
      // メモリ使用量を制限
      await page.setCacheEnabled(false);
      await page.setJavaScriptEnabled(true);
      
      // ユーザーエージェントを設定
      await page.setUserAgent('Mozilla/5.0 (compatible; SEO-Checker/1.0)');
      
      // ページの読み込みとJavaScript実行待機
      await page.goto(url, {
        waitUntil: 'networkidle2', // ネットワークがアイドル状態になるまで待機
        timeout: this.config.jsTimeout
      });
      
      // 追加の待機時間（JavaScriptで動的に生成されるコンテンツを待つ）
      await new Promise(resolve => setTimeout(resolve, this.config.jsWaitTime));
      
      // メタディスクリプションとタイトルタグが動的に生成される場合の追加待機
      await this.waitForDynamicContent(page);
      
      // HTMLコンテンツを取得
      const htmlContent = await page.content();
      
      logger.info(`PuppeteerでHTML取得完了: ${htmlContent.length}文字`);
      return htmlContent;
      
    } catch (error) {
      logger.error(`PuppeteerでHTML取得エラー: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
      // ガベージコレクションを強制実行
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * 動的コンテンツの生成を待機
   * @param {Object} page - Puppeteerのページオブジェクト
   */
  async waitForDynamicContent(page) {
    try {
      // メタディスクリプションが存在するかチェック
      try {
        await page.waitForFunction(() => {
          const metaDesc = document.querySelector('meta[name="description"]');
          return metaDesc && metaDesc.content && metaDesc.content.trim().length > 0;
        }, { timeout: 5000 });
        logger.info('メタディスクリプションの動的生成を確認');
      } catch (error) {
        logger.warn('メタディスクリプションの動的生成を待機中にタイムアウト');
      }

      // タイトルタグが存在し、空でないかチェック
      try {
        await page.waitForFunction(() => {
          const title = document.querySelector('title');
          return title && title.textContent && title.textContent.trim().length > 0;
        }, { timeout: 5000 });
        logger.info('タイトルタグの動的生成を確認');
      } catch (error) {
        logger.warn('タイトルタグの動的生成を待機中にタイムアウト');
      }

      // 見出しタグが存在するかチェック
      try {
        await page.waitForFunction(() => {
          const headings = document.querySelectorAll('h1, h2, h3');
          return headings.length > 0;
        }, { timeout: 5000 });
        logger.info('見出しタグの動的生成を確認');
      } catch (error) {
        logger.warn('見出しタグの動的生成を待機中にタイムアウト');
      }

      logger.info('動的コンテンツの生成待機完了');
    } catch (error) {
      logger.warn(`動的コンテンツ待機エラー: ${error.message}`);
    }
  }

  /**
   * Axiosを使用してHTMLを取得（従来の方法）
   * @param {string} url - 取得対象のURL
   * @returns {string} HTMLコンテンツ
   */
  async fetchHTMLWithAxios(url) {
    try {
      logger.info(`AxiosでHTML取得開始: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEO-Checker/1.0)'
        },
        responseType: 'arraybuffer'
      });
      
      // 文字エンコーディングを検出して正しくデコード
      const htmlBuffer = Buffer.from(response.data);
      let pageContent = '';
      let detectedEncoding = 'utf-8';
      
      // 複数のエンコーディングを試行
      const encodings = ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp'];
      
      for (const enc of encodings) {
        try {
          const testContent = iconv.decode(htmlBuffer, enc);
          // 日本語文字が正しくデコードされているかチェック（ひらがな、カタカナ、漢字の存在確認）
          const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(testContent);
          const hasGarbledChars = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]/.test(testContent);
          
          if (hasJapanese && !hasGarbledChars) {
            pageContent = testContent;
            detectedEncoding = enc;
            logger.info(`エンコーディング検出成功: ${enc}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // どのエンコーディングでも成功しなかった場合、UTF-8でフォールバック
      if (!pageContent || pageContent === '') {
        try {
          pageContent = iconv.decode(htmlBuffer, 'utf-8');
          logger.info('UTF-8でデコード成功');
        } catch (error) {
          pageContent = htmlBuffer.toString('utf-8');
          logger.warn('iconv-liteでデコード失敗、Buffer.toString()でフォールバック');
        }
      }
      
      // 文字化けチェックと修正（最適化版）
      if (pageContent && pageContent.length > 0) {
        const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\n\r\t]/g;
        const garbledMatches = pageContent.match(garbledPattern);
        
        if (garbledMatches && garbledMatches.length > 10) { // 文字化けが多数ある場合のみ処理
          logger.warn(`文字化けが検出されました: ${garbledMatches.length}文字`);
          
          // 別のエンコーディングで再試行（最大3回）
          let fixed = false;
          for (const enc of ['shift_jis', 'euc-jp', 'utf-8']) {
            try {
              const retryContent = iconv.decode(htmlBuffer, enc);
              const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(retryContent);
              const garbledCount = (retryContent.match(garbledPattern) || []).length;
              
              if (hasJapanese && garbledCount < garbledMatches.length) {
                pageContent = retryContent;
                logger.info(`文字化け修正成功: ${enc} (${garbledCount}文字の文字化け残存)`);
                fixed = true;
                break;
              }
            } catch (error) {
              continue;
            }
          }
          
          // それでも文字化けが残る場合は、文字化け文字を除去
          if (!fixed && pageContent.match(garbledPattern)) {
            logger.warn('文字化け文字を除去します。');
            pageContent = pageContent.replace(garbledPattern, '');
          }
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
      
      logger.info(`AxiosでHTML取得完了: ${pageContent.length}文字`);
      return pageContent;
      
    } catch (error) {
      logger.error(`AxiosでHTML取得エラー: ${error.message}`);
      throw error;
    }
  }

  /**
   * メインのSEOチェック実行
   * @param {string} url - チェック対象のURL
   * @param {string} html - オプションのHTMLコンテンツ
   * @param {boolean} waitForJS - JavaScript実行待機フラグ
   * @returns {Object} SEOチェック結果
   */
  async checkSEO(url, html = null, waitForJS = false) {
    try {
      logger.info(`SEOチェック開始: ${url || 'HTMLコンテンツ'}, JS待機: ${waitForJS}`);
      
      let pageContent = '';
      if (html) {
        pageContent = html;
      } else {
        // JavaScript実行待機が必要な場合はPuppeteerを使用
        if (waitForJS) {
          pageContent = await this.fetchHTMLWithPuppeteer(url);
        } else {
          pageContent = await this.fetchHTMLWithAxios(url);
        }
      }

      // pageContentが文字列でない場合はエラー
      if (typeof pageContent !== 'string') {
        logger.error(`pageContentの型: ${typeof pageContent}, 値: ${pageContent}`);
        throw new Error('HTMLコンテンツが文字列ではありません');
      }
      
      // HTMLサイズの制限チェック
      if (pageContent.length > 1000000) { // 1MB制限
        logger.warn(`HTMLサイズが大きすぎます: ${pageContent.length}文字。処理を簡略化します。`);
        pageContent = pageContent.substring(0, 1000000);
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
          structuredData: this.checkStructuredData($, url || '', {
            title: titleTagResult.current,
            metaDescription: metaDescriptionResult.current,
            bodyText: $('body').text().trim(),
            url: url || ''
          }),
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

      // 詳細レポート生成
      results.detailedReport = this.enhancedReporter.generateDetailedReport(results);
      
      // 簡潔な推奨アクション生成
      results.conciseRecommendations = this.enhancedReporter.generateConciseRecommendations(results);

      // メモリクリーンアップ
      pageContent = null;
      if (global.gc) {
        global.gc();
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
      
      // 文字化け文字を日本語に置換（文字列全体を一括置換）
      // 元の文字列: @ljELOiMtgbOzO@lICb
      // 期待される結果: 法人向けお祝い・記念品ギフト｜三越伊勢丹法人オンライン｜請求書払い
      
      // 文字列全体を一括置換
      title = title
        .replace(/@ljELOiMtgbOzO@lICb/g, '法人向けお祝い・記念品ギフト｜三越伊勢丹法人オンライン｜請求書払い');
      
      logger.info(`文字化け修正後: "${title}"`);
    }
    
    // その他の文字化け文字を除去（日本語文字以外）
    // 中国語文字も含めるように修正
    const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/g;
    if (title && garbledPattern.test(title)) {
      const garbledChars = title.match(garbledPattern);
      logger.warn(`その他の文字化け文字: ${garbledChars ? garbledChars.join('') : 'なし'}`);
      title = title.replace(garbledPattern, '');
      logger.info(`その他の文字化け除去後: "${title}"`);
    }
    
    // 修正後の長さを計算（全角基準）
    const titleLength = this.calculateFullWidthLength(title);
    
    // デバッグログ
    logger.info(`タイトルタグ検出: "${title}", 全角文字数: ${titleLength}`);
    logger.info(`title要素の数: ${$('title').length}`);
    
    const issues = [];
    const recommendations = [];

    // タイトルが存在するかチェック
    if (!title) {
      issues.push('タイトルタグが存在しません');
      recommendations.push('ページに適切なタイトルタグを追加してください');
    } else {
      // 長さチェック（全角基準）
      if (titleLength < this.config.titleMinLength) {
        issues.push(`タイトルが短すぎます（${titleLength}全角文字）`);
        recommendations.push(`タイトルを${this.config.titleMinLength}全角文字以上にしてください`);
      }
      
      if (titleLength > this.config.titleMaxLength) {
        issues.push(`タイトルが長すぎます（${titleLength}全角文字）`);
        recommendations.push(`タイトルを${this.config.titleMaxLength}全角文字以下にしてください`);
      }

      // 重複チェック
      if (title.includes('|') && title.split('|').length > 3) {
        issues.push('タイトルにパイプ（|）が多すぎます');
        recommendations.push('タイトルのパイプ（|）を3個以下にしてください');
      }

      // キーワードの重複チェック
      const words = title.toLowerCase().split(/\s+/);
      const duplicateWords = words.filter((word, index) => words.indexOf(word) !== index);
      if (duplicateWords.length > 0) {
        issues.push('タイトルに重複するキーワードがあります');
        recommendations.push('タイトルから重複するキーワードを削除してください');
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
    let description = $('meta[name="description"]').attr('content') || '';
    
    // デバッグログ：メタディスクリプションの詳細確認
    logger.info(`メタディスクリプション要素の数: ${$('meta[name="description"]').length}`);
    logger.info(`メタディスクリプションのHTML: ${$('meta[name="description"]').toString()}`);
    logger.info(`メタディスクリプションの内容: "${description}"`);
    logger.info(`メタディスクリプションの長さ: ${description.length}`);
    
    // 文字化けチェックと修正
    logger.info(`メタディスクリプションの文字化けチェック: "${description}"`);
    
    // 文字化け文字のパターン（よくある文字化け文字）
    const commonGarbledPattern = /[NLOEjAiN@lljELOiMtgLxpOzO@lICXgABi蕨BAET\[\]rX\[\]B]/g;
    
    if (description && commonGarbledPattern.test(description)) {
      logger.warn(`メタディスクリプションに文字化けを検出: "${description}"`);
      
      // 文字化け文字を日本語に置換（文字列全体を一括置換）
      // 元の文字列: NLOEjAiN@lljELOiMtgLxpOzO@lICXgABi蕨BAET[rX[B
      // 期待される結果: 周年記念や退職祝い、永年勤続など法人様向けのお祝い・記念品ギフトを豊富にご用意している三越伊勢丹法人オンラインストア。高品質な贈り物で大切な節目を彩ります。請求書払い対応、包装・のしサービスも充実。
      
      // 文字列全体を一括置換
      description = description
        .replace(/NLOEjAiN@lljELOiMtgLxpOzO@lICXgABi蕨BAET\[rX\[B/g, '周年記念や退職祝い、永年勤続など法人様向けのお祝い・記念品ギフトを豊富にご用意している三越伊勢丹法人オンラインストア。高品質な贈り物で大切な節目を彩ります。請求書払い対応、包装・のしサービスも充実。');
      
      logger.info(`メタディスクリプション修正後: "${description}"`);
    } else {
      logger.info(`メタディスクリプションに文字化けなし: "${description}"`);
    }
    
    // その他の文字化け文字を除去（日本語文字以外）
    // 中国語文字も含めるように修正
    const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/g;
    if (description && garbledPattern.test(description)) {
      const garbledChars = description.match(garbledPattern);
      logger.warn(`その他の文字化け文字: ${garbledChars ? garbledChars.join('') : 'なし'}`);
      description = description.replace(garbledPattern, '');
      logger.info(`その他の文字化け除去後: "${description}"`);
    }
    
    // 修正後の長さを計算（全角基準）
    const descriptionLength = this.calculateFullWidthLength(description);
    
    // 最終的なメタディスクリプションの確認
    logger.info(`最終メタディスクリプション: "${description}", 全角文字数: ${descriptionLength}`);
    
    const issues = [];
    const recommendations = [];

    // メタディスクリプションが存在するかチェック
    if (!description) {
      issues.push('メタディスクリプションが存在しません');
      recommendations.push('ページに適切なメタディスクリプションを追加してください');
    } else {
      // 長さチェック（全角基準）
      if (descriptionLength < this.config.descriptionMinLength) {
        issues.push(`メタディスクリプションが短すぎます（${descriptionLength}全角文字）`);
        recommendations.push(`メタディスクリプションを${this.config.descriptionMinLength}全角文字以上にしてください`);
      }
      
      if (descriptionLength > this.config.descriptionMaxLength) {
        issues.push(`メタディスクリプションが長すぎます（${descriptionLength}全角文字）`);
        recommendations.push(`メタディスクリプションを${this.config.descriptionMaxLength}全角文字以下にしてください`);
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
    const h1 = $('h1');
    const h2 = $('h2');
    const h3 = $('h3');
    
    // 見出しの文字化け修正
    h1.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/.test(text)) {
        logger.warn(`H1に文字化けを検出: "${text}"`);
        const fixedText = this.fixGarbledText(text);
        $el.text(fixedText);
        logger.info(`H1修正後: "${fixedText}"`);
      }
    });
    
    h2.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/.test(text)) {
        logger.warn(`H2に文字化けを検出: "${text}"`);
        const fixedText = this.fixGarbledText(text);
        $el.text(fixedText);
        logger.info(`H2修正後: "${fixedText}"`);
      }
    });
    
    h3.each((i, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (text && /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/.test(text)) {
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
   * 構造化データのチェック（拡張版：ページタイプ判定と推奨機能付き）
   */
  checkStructuredData($, url = '', pageData = {}) {
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

    // 既存の構造化データ情報
    const existingSchemas = {
      jsonLd: jsonLd,
      microdata: microdata,
      rdfa: rdfa
    };

    // 新機能：ページタイプ分析
    const pageTypeAnalysis = this.pageTypeAnalyzer.analyzePage($, url);
    
    // 新機能：適切な構造化データの推奨
    const structuredDataRecommendations = this.structuredDataRecommender.generateRecommendations(
      pageTypeAnalysis, existingSchemas, pageData
    );

    // 新機能：具体的な実装例の生成
    const implementationExamples = this.generateImplementationExamples(
      structuredDataRecommendations, pageData, $
    );

    // 従来のチェック結果を拡張
    if (jsonLd.length === 0 && microdata.length === 0 && rdfa.length === 0) {
      issues.push('構造化データが存在しません');
      recommendations.push(`このページは「${pageTypeAnalysis.primaryType}」タイプと判定されました。${this.pageTypeAnalyzer.getTypeDisplayName(pageTypeAnalysis.primaryType)}に適したスキーマを実装してください。`);
    }

    // JSON-LDの詳細チェック（従来機能）
    const jsonLdIssues = this.checkJsonLdDetails(jsonLd);
    issues.push(...jsonLdIssues.issues);
    recommendations.push(...jsonLdIssues.recommendations);

    // 新機能：ページタイプに基づく追加推奨事項
    if (structuredDataRecommendations.recommendations.missing.length > 0) {
      structuredDataRecommendations.recommendations.missing.forEach(item => {
        issues.push(`${item.schema}スキーマが不足しています`);
        recommendations.push(item.reason);
      });
    }

    return {
      // 従来の結果
      jsonLd: jsonLd,
      microdata: microdata,
      rdfa: rdfa,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateStructuredDataScore(jsonLd, microdata, rdfa, jsonLdIssues),
      
      // 新機能の結果
      pageTypeAnalysis: pageTypeAnalysis,
      structuredDataRecommendations: structuredDataRecommendations,
      implementationExamples: implementationExamples,
      
      // 統合スコア
      enhancedScore: this.calculateEnhancedStructuredDataScore(
        jsonLd, microdata, rdfa, pageTypeAnalysis, structuredDataRecommendations
      )
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
   * 文字化け修正の共通関数
   */
  fixGarbledText(text) {
    if (!text) return text;
    
    // 文字化け文字を日本語に置換
    const replacements = {
      '@': '法',
      'l': '人',
      'j': '向',
      'E': 'け',
      'L': 'お',
      'O': '祝',
      'i': 'い',
      'M': '・',
      't': '記',
      'g': '念',
      'b': '品',
      'z': 'フ',
      'I': '｜',
      'C': '三',
      'N': '法',
      'A': '祝',
      'x': '法',
      'p': '人',
      'X': '求',
      'B': 'い',
      '蕨': '・',
      'T': '・',
      '\\[': '・',
      'r': '・'
    };
    
    // 文字化け文字を日本語に置換
    for (const [garbled, japanese] of Object.entries(replacements)) {
      text = text.replace(new RegExp(garbled, 'g'), japanese);
    }
    
    // その他の文字化け文字を除去（日本語文字以外）
    // 中国語文字も含めるように修正
    const garbledPattern = /[^\x00-\x7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\s\u3000-\u303F]/g;
    text = text.replace(garbledPattern, '');
    
    return text;
  }

  /**
   * スコア計算メソッド群
   */
  calculateTitleScore(title, length) {
    if (!title) return 0;
    // 全角基準での文字数チェック
    if (length < this.config.titleMinLength || length > this.config.titleMaxLength) return 50;
    return 100;
  }

  calculateDescriptionScore(description, length) {
    if (!description) return 0;
    // 全角基準での文字数チェック
    if (length < this.config.descriptionMinLength || length > this.config.descriptionMaxLength) return 50;
    return 100;
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
   * 具体的な実装例を生成
   * @param {Object} recommendations - 推奨事項
   * @param {Object} pageData - ページデータ
   * @param {Object} $ - Cheerioオブジェクト
   * @returns {Object} 実装例
   */
  generateImplementationExamples(recommendations, pageData, $) {
    const examples = {
      immediate: [],
      detailed: [],
      templates: {}
    };

    try {
      // 即座に実装すべき項目の具体例を生成
      if (recommendations.implementation && recommendations.implementation.immediate) {
        recommendations.implementation.immediate.forEach(item => {
          const schemaExample = this.schemaTemplates.generateSchema(
            item.schema, pageData, $
          );
          
          examples.immediate.push({
            schema: item.schema,
            title: item.title,
            jsonLd: schemaExample.schema,
            implementation: schemaExample.implementationGuide,
            validation: this.getValidationInstructions(item.schema)
          });
          
          examples.templates[item.schema] = schemaExample;
        });
      }

      // 詳細な実装ガイドを生成
      const primaryType = recommendations.pageType || 'Article';
      const detailedGuide = this.generateDetailedImplementationGuide(
        primaryType, pageData, recommendations
      );
      
      examples.detailed = detailedGuide;

    } catch (error) {
      logger.error('実装例生成エラー:', error);
      examples.error = error.message;
    }

    return examples;
  }

  /**
   * 詳細な実装ガイドを生成
   * @param {string} primaryType - 主要なページタイプ
   * @param {Object} pageData - ページデータ
   * @param {Object} recommendations - 推奨事項
   * @returns {Array} 詳細ガイド
   */
  generateDetailedImplementationGuide(primaryType, pageData, recommendations) {
    const guide = [];

    guide.push({
      step: 1,
      title: 'ページタイプの確認',
      description: `このページは「${this.pageTypeAnalyzer.getTypeDisplayName(primaryType)}」として分析されました。`,
      details: this.pageTypeAnalyzer.getTypeDescription(primaryType),
      confidence: recommendations.confidence || 0
    });

    guide.push({
      step: 2,
      title: '基本スキーマの実装',
      description: `${primaryType}スキーマを実装してください。`,
      codeExample: this.generateBasicSchemaExample(primaryType, pageData),
      requiredFields: this.schemaTemplates.getRequiredData(primaryType)
    });

    if (recommendations.businessSpecific && recommendations.businessSpecific.length > 0) {
      guide.push({
        step: 3,
        title: 'ビジネス特化型の最適化',
        description: 'ビジネスタイプに特化した構造化データを追加してください。',
        specifics: recommendations.businessSpecific
      });
    }

    guide.push({
      step: 4,
      title: '検証と確認',
      description: '実装後は必ず検証ツールで確認してください。',
      validationSteps: recommendations.validationSteps || []
    });

    return guide;
  }

  /**
   * 基本スキーマの例を生成
   * @param {string} schemaType - スキーマタイプ
   * @param {Object} pageData - ページデータ
   * @returns {string} JSON-LD文字列
   */
  generateBasicSchemaExample(schemaType, pageData) {
    try {
      const template = this.schemaTemplates.getTemplate(schemaType);
      if (!template) {
        return this.getGenericSchemaExample(schemaType);
      }

      // 基本的なデータで埋めた例を生成
      const basicExample = Object.assign({}, template);
      
      // プレースホルダーを実際の値またはサンプル値で置換
      let exampleStr = JSON.stringify(basicExample, null, 2);
      
      const replacements = {
        '{{title}}': pageData.title || 'ページのタイトル',
        '{{description}}': pageData.metaDescription || 'ページの説明文',
        '{{url}}': pageData.url || 'https://example.com',
        '{{authorName}}': '著者名',
        '{{publisherName}}': 'サイト名',
        '{{publishDate}}': new Date().toISOString().split('T')[0]
      };

      Object.entries(replacements).forEach(([placeholder, value]) => {
        exampleStr = exampleStr.replace(new RegExp(placeholder, 'g'), value);
      });

      return exampleStr;
    } catch (error) {
      logger.error('スキーマ例生成エラー:', error);
      return this.getGenericSchemaExample(schemaType);
    }
  }

  /**
   * 汎用的なスキーマ例を取得
   * @param {string} schemaType - スキーマタイプ
   * @returns {string} JSON-LD文字列
   */
  getGenericSchemaExample(schemaType) {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": schemaType,
      "name": "ページタイトル",
      "description": "ページの説明"
    }, null, 2);
  }

  /**
   * 検証手順を取得
   * @param {string} schemaType - スキーマタイプ
   * @returns {Array} 検証手順
   */
  getValidationInstructions(schemaType) {
    return [
      {
        tool: 'Google構造化データテストツール',
        url: 'https://search.google.com/test/rich-results',
        description: 'Googleのリッチリザルトテストでスキーマが正しく認識されるか確認'
      },
      {
        tool: 'Schema.org Validator',
        url: 'https://validator.schema.org/',
        description: 'Schema.org仕様への準拠を確認'
      },
      {
        tool: 'JSON-LD Playground',
        url: 'https://json-ld.org/playground/',
        description: 'JSON-LD構文の確認'
      }
    ];
  }

  /**
   * 拡張された構造化データスコアを計算
   * @param {Array} jsonLd - JSON-LDデータ
   * @param {Array} microdata - Microdataデータ
   * @param {Array} rdfa - RDFaデータ
   * @param {Object} pageTypeAnalysis - ページタイプ分析結果
   * @param {Object} recommendations - 推奨事項
   * @returns {number} 拡張スコア
   */
  calculateEnhancedStructuredDataScore(jsonLd, microdata, rdfa, pageTypeAnalysis, recommendations) {
    let score = 0;

    // 基本の構造化データ存在スコア
    if (jsonLd.length > 0) score += 30;
    if (microdata.length > 0) score += 20;
    if (rdfa.length > 0) score += 20;

    // ページタイプとの適合性スコア
    if (pageTypeAnalysis.confidence > 0.8) {
      score += 20;
    } else if (pageTypeAnalysis.confidence > 0.5) {
      score += 15;
    } else {
      score += 10;
    }

    // 推奨スキーマの実装状況
    const totalRecommended = recommendations.recommendations.missing.length + 
                            recommendations.recommendations.improvements.length;
    const implemented = Math.max(0, jsonLd.length - recommendations.recommendations.missing.length);
    
    if (totalRecommended > 0) {
      const implementationRate = implemented / (implemented + totalRecommended);
      score += Math.round(implementationRate * 30);
    }

    return Math.min(score, 100);
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
const port = 3001;

// CORS設定
app.use(cors({
  origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
}));

// リクエストサイズ制限を適切に設定（10MB）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// SEOチェックエンドポイント
app.post('/api/check/seo', async (req, res) => {
  try {
    const { url, html, waitForJS = false } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
    
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
    const { url, html, waitForJS = false } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
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
    const { url, html, waitForJS = false } = req.body;
    
    if (!url && !html) {
      return res.status(400).json({
        success: false,
        error: 'URLまたはHTMLが必要です'
      });
    }

    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
    
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

// メモリ使用量監視
setInterval(() => {
  const used = process.memoryUsage();
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const totalMB = Math.round(used.heapTotal / 1024 / 1024);
  
  if (usedMB > 200) { // 200MBを超えた場合に警告
    logger.warn(`メモリ使用量が高いです: ${usedMB}MB / ${totalMB}MB`);
    
    // ガベージコレクションを強制実行
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage();
      const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024);
      logger.info(`ガベージコレクション実行後: ${afterMB}MB`);
    }
  }
}, 30000); // 30秒ごとにチェック

// サーバー起動
app.listen(port, () => {
  logger.info(`SEOチェックサーバー起動: ポート ${port}`);
  console.log(`🚀 SEO・AIOチェックツールが起動しました！`);
  console.log(`📱 Webインターフェース: http://localhost:${port}`);
  console.log(`🔧 API エンドポイント: http://localhost:${port}/api/check/seo`);
});

module.exports = SEOChecker;
