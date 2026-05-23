const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Puppeteer が require される前にキャッシュパスを設定（Render でビルド時に入れた Chrome を参照するため）
if (!process.env.PUPPETEER_CACHE_DIR) {
  process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
}

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
// Phase 1.4: lighthouse は v10+ で ESM-only になり require() で失敗してテストを阻害していた。
// 実コードからは未使用だったため除去（モバイル指標の Lighthouse 連携を入れる場合は
// dynamic import: const { default: lighthouse } = await import('lighthouse'); を使うこと）
const puppeteer = require('puppeteer');
const winston = require('winston');
const iconv = require('iconv-lite');
const cors = require('cors');
const compression = require('compression');
const AIOChecker = require('./aio-checker');
const EnhancedReporter = require('./enhanced-reporter');
const DetailedAnalyzer = require('./detailed-analyzer');
const PageTypeAnalyzer = require('./page-type-analyzer');
const StructuredDataRecommender = require('./structured-data-recommender');
const SchemaTemplates = require('./schema-templates');
const { connectDB, isDBConnected } = require('./db');
const AnalysisHistory = require('./models/AnalysisHistory');

// ログ用ディレクトリを用意（Render 等では存在しない場合がある）
const logsDir = path.join(__dirname, 'logs');
try {
  fs.mkdirSync(logsDir, { recursive: true });
} catch (_) { /* 無視 */ }

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    ...(fs.existsSync(logsDir) ? [new winston.transports.File({ filename: path.join(logsDir, 'seo-checker.log') })] : []),
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
   * 設定ファイルの読み込み（seo-config.json があれば使用、なければデフォルト）
   */
  loadConfig() {
    // Phase 1.5: 業界実務 + Google検索セントラル基準にキャリブレーション
    const defaults = {
      titleMaxLength: 32,            // Google検索結果の切り捨て基準
      titleMinLength: 15,
      descriptionMaxLength: 120,     // PC表示で見える上限
      descriptionMinLength: 70,      // SP表示で見える下限
      h1MaxCount: 1,
      h2MinCount: 1,                 // 短いページの基準。コンテンツ長で動的調整
      h3MinCount: 0,                 // 短いページでは不要
      imageAltRequired: true,
      internalLinksMin: 3,           // 短いページの基準。コンテンツ長で動的調整
      structuredDataRequired: true,
      jsWaitTime: 2500,
      jsTimeout: 20000
    };
    const configPath = path.join(__dirname, 'seo-config.json');
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const loaded = JSON.parse(raw);
        const merged = { ...defaults, ...loaded };
        logger.info('設定を seo-config.json から読み込みました');
        return merged;
      }
    } catch (error) {
      logger.warn('設定ファイルの読み込みに失敗、デフォルト設定を使用:', error.message);
    }
    return defaults;
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

      const launchOptions = {
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
      };

      // Render 等の本番環境では @sparticuz/chromium のバイナリを使用（ビルド成果物に Chrome が含まれないため）
      if (process.env.NODE_ENV === 'production') {
        try {
          const chromium = require('@sparticuz/chromium');
          launchOptions.executablePath = await chromium.executablePath();
          launchOptions.args = chromium.args || launchOptions.args;
          launchOptions.headless = 'shell'; // @sparticuz/chromium 推奨
        } catch (chromiumErr) {
          logger.warn('@sparticuz/chromium の読み込みに失敗、通常の Puppeteer を使用:', chromiumErr.message);
        }
      }

      browser = await puppeteer.launch(launchOptions);

      page = await browser.newPage();

      // メモリ使用量を制限
      await page.setCacheEnabled(false);
      await page.setJavaScriptEnabled(true);

      // 小さめのビューポート (省メモリ)
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

      // ユーザーエージェントを設定
      await page.setUserAgent('Mozilla/5.0 (compatible; SEO-AIO-Doctor/1.1)');

      // 🆙 Phase 1.1: メモリ&時間節約のため不要リソースをブロック
      //   - 画像/フォント/メディア: SEO診断には不要（alt属性等の解析はDOMで完結）
      //   - トラッキングや広告系のドメインを軽くブロックして処理を高速化
      await page.setRequestInterception(true);
      const blockedResourceTypes = new Set(['image', 'media', 'font']);
      const blockedDomainsRegex = /(googletagmanager|google-analytics|doubleclick|facebook\.net|hotjar|segment|adsystem|amazon-adsystem|criteo|optimizely|gtag|adservice|cdn\.taboola|cdn\.outbrain)/i;
      page.on('request', (req) => {
        try {
          const type = req.resourceType();
          const reqUrl = req.url();
          if (blockedResourceTypes.has(type) || blockedDomainsRegex.test(reqUrl)) {
            return req.abort();
          }
          return req.continue();
        } catch (_) {
          try { req.continue(); } catch (_) { /* ignore */ }
        }
      });

      // ページの読み込みとJavaScript実行待機
      // 🆙 networkidle2 は SPA だとサードパーティ通信が止まらず常にタイムアウトしがち。
      //    domcontentloaded で確実に止めつつ、後段で待機を入れて動的コンテンツに対応する。
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.jsTimeout
      });

      // 追加の待機時間（JavaScriptで動的に生成されるコンテンツを待つ）
      await new Promise(resolve => setTimeout(resolve, this.config.jsWaitTime));

      // ネットワークがアイドルになるなら追加で待機（最大 jsWaitTime までで打ち切り）
      try {
        await page.waitForNetworkIdle({ idleTime: 500, timeout: this.config.jsWaitTime });
      } catch (_) { /* タイムアウトは無視（SPAで永久にidleにならない場合がある） */ }

      // メタディスクリプションとタイトルタグが動的に生成される場合の追加待機
      await this.waitForDynamicContent(page);

      // HTMLコンテンツを取得
      // Phase 1.5.1: page.content() は重いSPAだと数十MB単位の文字列を一気に確保する。
      // 失敗時にどこで死んだか分かるよう、前後でメモリ使用量を記録する。
      const heapBefore = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`page.content() 取得開始 (heap=${heapBefore}MB)`);
      const htmlContent = await page.content();
      const heapAfter = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`PuppeteerでHTML取得完了: ${htmlContent.length}文字 (heap=${heapAfter}MB, Δ=${heapAfter - heapBefore}MB)`);
      return htmlContent;
      
    } catch (error) {
      logger.error(`PuppeteerでHTML取得エラー: ${error.message}`);
      throw error;
    } finally {
      if (page) {
        try { await page.close(); } catch (_) { /* ignore */ }
      }
      if (browser) {
        try { await browser.close(); } catch (_) { /* ignore */ }
      }
      // ガベージコレクションを強制実行
      if (global.gc) {
        global.gc();
      }
      // Phase 1.5.1: 終了時メモリも記録（OOM 切れの境界調査用）
      const heapEnd = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`Puppeteer cleanup 完了 (heap=${heapEnd}MB)`);
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
      // 403 を避けるためブラウザと同様の User-Agent とヘッダーを使用
      const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      };
      const response = await axios.get(url, {
        timeout: 10000,
        headers: browserHeaders,
        responseType: 'arraybuffer',
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
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
      // Advanced Check で Puppeteer が失敗した場合に Simple Check へフォールバックしたかの記録
      // （後段でメタ情報として results.warnings に積む）
      let advancedFallbackReason = null;
      if (html) {
        pageContent = html;
      } else {
        // JavaScript実行待機が必要な場合、または Axios が 403 の場合は Puppeteer を使用
        if (waitForJS) {
          try {
            pageContent = await this.fetchHTMLWithPuppeteer(url);
          } catch (puppeteerError) {
            const msg = puppeteerError && puppeteerError.message ? puppeteerError.message : 'unknown';
            logger.warn(`Advanced Check (Puppeteer) 失敗、Simple Check にフォールバック: ${msg}`);
            advancedFallbackReason = msg;
            // Puppeteer失敗時は通常のAxiosフェッチに自動フォールバック
            try {
              pageContent = await this.fetchHTMLWithAxios(url);
            } catch (axiosError2) {
              // Axiosも失敗した場合のみ元のエラーを投げる
              const status = axiosError2.response && axiosError2.response.status;
              const err = new Error(
                `JavaScript実行モード(Advanced)に失敗し、フォールバックの通常取得も失敗しました（Puppeteer: ${msg}, Axios: ${status || axiosError2.message}）。URLが正しいか、サイトがアクセス可能かをご確認ください。`
              );
              err.code = 'BOTH_FETCH_FAILED';
              throw err;
            }
          }
        } else {
          try {
            pageContent = await this.fetchHTMLWithAxios(url);
          } catch (axiosError) {
            const status = axiosError.response && axiosError.response.status;
            if (status === 403 || status === 429 || status === 401) {
              logger.warn(`Axios で ${status} のため Puppeteer にフォールバック: ${url}`);
              try {
                pageContent = await this.fetchHTMLWithPuppeteer(url);
              } catch (puppeteerError) {
                const msg = puppeteerError && puppeteerError.message ? puppeteerError.message : '';
                if (/Could not find Chrome|Browser was not found|executablePath/i.test(msg)) {
                  const err = new Error('このURLはアクセス制限のため取得できません。ページのHTMLをコピーして「HTMLを直接入力」に貼り付けてチェックしてください。');
                  err.code = 'CHROME_UNAVAILABLE';
                  throw err;
                }
                throw puppeteerError;
              }
            } else {
              throw axiosError;
            }
          }
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
      
      // Phase 1.5.1: heap 観測（重いSPAでの OOM 切れ場所特定用）
      const heapAtParseStart = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`pageContentの長さ: ${pageContent.length}文字 (heap=${heapAtParseStart}MB)`);

      // cheerioでHTMLを解析
      const $ = cheerio.load(pageContent);

      const heapAfterParse = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`cheerio解析完了: HTML長=${$.html().length}, title存在=${$('title').length > 0} (heap=${heapAfterParse}MB)`);
      
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
        recommendations: [],
        warnings: advancedFallbackReason ? [{
          code: 'ADVANCED_FALLBACK_TO_SIMPLE',
          message: `Advanced Check（JS実行）に失敗したため、Simple Check（静的HTML取得）の結果を表示しています。SPAサイトの場合、JS実行後にしか出ない見出し・画像・構造化データが検出されない可能性があります。`,
          detail: advancedFallbackReason
        }] : []
      };

      // AIOチェックの実行
      const heapBeforeAIO = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`AIOチェック開始 (heap=${heapBeforeAIO}MB)`);
      const aioResults = await this.aioChecker.checkAIO(results, url || '', $);
      results.aio = aioResults;
      const heapAfterAIO = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      logger.info(`AIOチェック完了 (heap=${heapAfterAIO}MB, Δ=${heapAfterAIO - heapBeforeAIO}MB)`);

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

    // Phase 1.5: コンテンツ長に応じた動的閾値
    // 短いページに H2/H3 を多数要求するのは過剰要求になるため、語数で調整する
    const earlyWordCount = this.estimateContentLength($);
    let h2Needed, h3Needed;
    if (earlyWordCount >= 2000) {
      h2Needed = 3;
      h3Needed = 5;
    } else if (earlyWordCount >= 500) {
      h2Needed = 2;
      h3Needed = 2;
    } else {
      h2Needed = Math.max(1, this.config.h2MinCount || 1);
      h3Needed = 0;
    }

    // H1のチェック
    if (h1Count === 0) {
      issues.push('H1タグが存在しません');
      recommendations.push('ページにH1タグを1つ追加してください');
    } else if (h1Count > this.config.h1MaxCount) {
      issues.push(`H1タグが多すぎます（${h1Count}個）`);
      recommendations.push(`H1タグを${this.config.h1MaxCount}個以下にしてください`);
    }

    // H2のチェック（コンテンツ長による動的閾値）
    if (h2Count < h2Needed) {
      issues.push(`H2タグが少なすぎます（${h2Count}個）`);
      recommendations.push(`H2タグを${h2Needed}個以上追加してください`);
    }

    // H3のチェック（コンテンツ長による動的閾値、不要なら警告しない）
    if (h3Needed > 0 && h3Count < h3Needed) {
      issues.push(`H3タグが少なすぎます（${h3Count}個）`);
      recommendations.push(`H3タグを${h3Needed}個以上追加してください`);
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

    // Phase 1.5: コンテンツ長を計測し、見出し評価の動的閾値に使う
    const wordCount = this.estimateContentLength($);

    return {
      h1Count: h1Count,
      h2Count: h2Count,
      h3Count: h3Count,
      h1Texts: h1.map((i, el) => $(el).text().trim()).get(),
      h2Texts: h2.map((i, el) => $(el).text().trim()).get(),
      h3Texts: h3.map((i, el) => $(el).text().trim()).get(),
      contentWordCount: wordCount,
      issues: issues,
      recommendations: recommendations,
      score: this.calculateHeadingScore(h1Count, h2Count, h3Count, headingHierarchy, headingContent, wordCount)
    };
  }

  /**
   * コンテンツ長を概算（Phase 1.5）
   * 日本語+英語混在を考慮し、ざっくり「語数相当」に正規化する。
   * - 英単語は1語=1
   * - 日本語は約2文字=1語相当
   * - script/style/nav/footer/header の中身は除外
   *
   * Phase 1.5.1: 同じ $ オブジェクトに対して見出しチェック + リンクチェックで
   * 計4回呼ばれる（heading 内2回、link 内2回）。重いSPAでは $('body').clone()
   * の繰り返しがメモリスパイクの一因になるため、$ にメモ化する。
   */
  estimateContentLength($) {
    if (!$ || typeof $ !== 'function') return 0;
    if (typeof $._wordCountCache === 'number') return $._wordCountCache;
    try {
      // 主要本文要素を優先的に取得（無ければ body）
      const $clone = $('body').clone();
      $clone.find('script, style, nav, footer, header, aside').remove();
      const text = $clone.text().replace(/\s+/g, ' ').trim();
      if (!text) {
        $._wordCountCache = 0;
        return 0;
      }
      // 英数字の "語" を数える
      const enWords = (text.match(/[a-zA-Z0-9]+(?:[''][a-zA-Z]+)?/g) || []).length;
      // 日本語文字（ひらがな・カタカナ・漢字）の数 / 2 を語数相当に
      const jpChars = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g) || []).length;
      const result = enWords + Math.round(jpChars / 2);
      $._wordCountCache = result;
      return result;
    } catch (_) {
      return 0;
    }
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
      // Phase 1.5: コンテンツ長に応じた動的閾値
      const wordCountForLinks = this.estimateContentLength($);
      let internalNeeded;
      if (wordCountForLinks >= 2000) internalNeeded = 12;
      else if (wordCountForLinks >= 500) internalNeeded = 7;
      else internalNeeded = 3;

      if (internalLinks.length < internalNeeded) {
        issues.push(`内部リンクが少なすぎます（${internalLinks.length}個）`);
        recommendations.push(`内部リンクを${internalNeeded}個以上追加してください`);
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
      score: this.calculateLinkScore(totalLinks, internalLinks.length, externalLinks.length, this.estimateContentLength($))
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
   *
   * Phase 1.5: 全関数を区分線形（piecewise linear）で評価するよう刷新。
   * 旧実装は「範囲内なら100、範囲外なら50」の3段階だったため、
   * 「ちょっと長い」「やや短い」を「明らかに長すぎ」と同じ50点扱いにする問題があった。
   * 新実装では業界実務 + Google検索セントラルの基準を反映し、滑らかにスコアが変化する。
   */

  /**
   * 区分線形スコアリングの汎用ヘルパー (Phase 1.5)
   * 与えられた値が控えめ→理想→過剰の範囲をどう移動するかをスコア（0-100）に変換する。
   *
   * @param {number} value - 評価対象の値（文字数、要素数など）
   * @param {Array<{x: number, score: number}>} points - 区分点の配列（x昇順）
   *   例: [
   *     { x: 0,   score: 0 },
   *     { x: 50,  score: 60 },   // 50で60点
   *     { x: 80,  score: 100 },  // 80で100点
   *     { x: 120, score: 100 },  // 120まで100点維持
   *     { x: 160, score: 80 },   // 160で80点まで下がる
   *     { x: 200, score: 50 },   // 200以上は50点
   *   ]
   * @returns {number} 整数化されたスコア (0-100)
   */
  piecewiseLinearScore(value, points) {
    if (!Array.isArray(points) || points.length < 2) return 0;
    if (typeof value !== 'number' || isNaN(value)) return 0;
    // x昇順を前提
    if (value <= points[0].x) return Math.round(points[0].score);
    if (value >= points[points.length - 1].x) return Math.round(points[points.length - 1].score);
    // 該当区間を見つけて線形補間
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (value >= a.x && value <= b.x) {
        const t = (b.x === a.x) ? 0 : (value - a.x) / (b.x - a.x);
        return Math.round(a.score + (b.score - a.score) * t);
      }
    }
    return 0;
  }

  /**
   * タイトルスコア計算 (Phase 1.5)
   * 業界実務: Google検索結果は全角約32文字で切り捨て、20-32文字が理想。
   *           15文字未満は短すぎ、50超は明らかに長すぎ。
   */
  calculateTitleScore(title, length) {
    if (!title) return 0;
    return this.piecewiseLinearScore(length, [
      { x: 0,  score: 0 },
      { x: 5,  score: 30 },   // 極端に短い
      { x: 15, score: 70 },   // 旧 minLength。許容ライン
      { x: 20, score: 90 },   // やや短いが許容
      { x: 25, score: 100 },  // 理想
      { x: 32, score: 100 },  // 理想 (Google切り捨て直前)
      { x: 40, score: 85 },   // やや長い
      { x: 50, score: 65 },   // 長すぎ
      { x: 80, score: 50 },   // 明らかに長すぎ
    ]);
  }

  /**
   * メタディスクリプションスコア計算 (Phase 1.5)
   * 業界実務: PC表示は約120文字、SP表示は約70文字。
   *           80-120が両方をカバーする理想。
   *           50未満は短すぎ、200超は確実に切り捨てられる。
   */
  calculateDescriptionScore(description, length) {
    if (!description) return 0;
    return this.piecewiseLinearScore(length, [
      { x: 0,   score: 0 },
      { x: 20,  score: 30 },   // 極端に短い
      { x: 50,  score: 60 },   // SP表示でかろうじて
      { x: 70,  score: 85 },   // SP表示でしっかり
      { x: 80,  score: 100 },  // 理想開始
      { x: 120, score: 100 },  // 理想終了 (PC表示上限)
      { x: 140, score: 92 },   // やや長い（PC表示でほぼ全部見える）
      { x: 160, score: 78 },   // 長い（PCでも切れ始める）
      { x: 200, score: 60 },   // 長すぎ
      { x: 300, score: 50 },   // 明らかに長すぎ
    ]);
  }

  /**
   * 見出しスコア計算 (Phase 1.5)
   *
   * コンテンツ長に応じて H2/H3 の必要数を動的に決定する:
   *   - 短いページ (< 500語): H2 ≥ 1, H3 不要
   *   - 中ページ (500-2000語): H2 ≥ 2, H3 ≥ 2
   *   - 長いページ (> 2000語): H2 ≥ 3, H3 ≥ 5
   *
   * @param {number} h1Count - H1 タグの数
   * @param {number} h2Count - H2 タグの数
   * @param {number} h3Count - H3 タグの数
   * @param {Object} hierarchy - 階層チェック結果
   * @param {Object} content - 見出し内容チェック結果
   * @param {number} [wordCount=0] - コンテンツの語数（estimateContentLength の結果）
   */
  calculateHeadingScore(h1Count, h2Count, h3Count, hierarchy, content, wordCount = 0) {
    let score = 0;

    // H1: 正確に1つで満点、0個または複数で減点
    if (h1Count === 1) {
      score += 35;
    } else if (h1Count === 0) {
      score += 0;  // 重大
    } else {
      score += 15;  // 複数あるとSEO上問題
    }

    // H2: コンテンツ長に応じた閾値
    let h2Needed = 1;
    let h3Needed = 0;
    if (wordCount >= 2000) {
      h2Needed = 3;
      h3Needed = 5;
    } else if (wordCount >= 500) {
      h2Needed = 2;
      h3Needed = 2;
    } else {
      // 短いページは設定の最小値（デフォルト 1）
      h2Needed = Math.max(1, this.config.h2MinCount || 1);
      h3Needed = 0;
    }

    // H2 加点（25点満点を区分線形で）
    if (h2Needed > 0) {
      const h2Ratio = Math.min(1, h2Count / h2Needed);
      score += Math.round(25 * h2Ratio);
    } else {
      score += 25;  // H2不要なら満点
    }

    // H3 加点（15点満点）
    if (h3Needed > 0) {
      const h3Ratio = Math.min(1, h3Count / h3Needed);
      score += Math.round(15 * h3Ratio);
    } else {
      score += 15;  // H3不要なら満点
    }

    // 階層問題なし: 15点
    if (hierarchy.issues.length === 0) score += 15;

    // 内容問題なし: 10点
    if (content.issues.length === 0) score += 10;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * 画像 alt スコア計算 (Phase 1.5)
   * - 画像が無い場合は 50 (中立。コンテンツによっては画像不要なため)
   * - alt 付与率が高いほど高スコア（線形）
   * 注: alt が空文字 (alt="") のものは別途 issue として検出される。
   * このスコアは「alt属性自体が付与されている画像の比率」を反映する。
   */
  calculateImageAltScore(totalImages, imagesWithAlt) {
    if (totalImages === 0) return 50;
    const ratio = imagesWithAlt / totalImages;
    return Math.round(ratio * 100);
  }

  /**
   * リンクスコア計算 (Phase 1.5)
   * コンテンツ長に応じて必要な内部リンク数を動的に調整。
   * 短いページに過剰な内部リンクを要求しない。
   */
  calculateLinkScore(totalLinks, internalLinks, externalLinks, wordCount = 0) {
    if (totalLinks === 0) return 0;

    let score = 0;

    // コンテンツ長に応じた内部リンク必要数
    let internalNeeded;
    if (wordCount >= 2000) internalNeeded = 12;
    else if (wordCount >= 500) internalNeeded = 7;
    else internalNeeded = 3;

    // 内部リンク（最大40点、線形）
    const internalRatio = Math.min(1, internalLinks / internalNeeded);
    score += Math.round(40 * internalRatio);

    // 外部リンク（信頼性向上、最大30点）
    if (externalLinks >= 1) score += 20;
    if (externalLinks >= 3) score += 10;  // ボーナス

    // 総リンク数（最大30点）
    if (totalLinks >= 5)  score += 10;
    if (totalLinks >= 10) score += 10;
    if (totalLinks >= 20) score += 10;

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
const port = Number(process.env.PORT) || 3001;

// CORS設定（Render 等では CORS_ORIGIN で指定、未設定時は localhost + 同一オリジン許可）
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  origin: corsOrigin ? corsOrigin.split(',').map(s => s.trim()) : ['http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
};
app.use(cors(corsOptions));

// レスポンスを gzip 圧縮（大きい JSON を制限内に収めるため）
app.use(compression({ threshold: 1024 }));

// リクエストサイズ制限を適切に設定（10MB）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 分析履歴をDBに保存（MONGODB_URI が設定されている場合のみ）
async function saveAnalysisHistory(results, options = {}) {
  if (!isDBConnected()) return;
  const { url, html, waitForJS = false, sessionId = null, userId = null } = options;
  try {
    await AnalysisHistory.create({
      url: url || null,
      inputType: url ? 'url' : 'html',
      waitForJS: !!waitForJS,
      overallScore: results.overallScore,
      aioOverallScore: results.aioOverallScore,
      combinedScore: results.combinedScore,
      sessionId: sessionId || null,
      userId: userId || null,
    });
  } catch (err) {
    logger.warn('Failed to save analysis history:', err.message);
  }
}

// 統一APIレスポンスヘルパー（OpenAPI仕様に準拠）
function sendApiError(res, statusCode, message, code = null) {
  const body = {
    success: false,
    error: message,
    ...(code && { code }),
    timestamp: new Date().toISOString()
  };
  return res.status(statusCode).json(body);
}

function sendApiSuccess(res, data) {
  return res.json({ success: true, data });
}

// バリデーション: URL または HTML 必須
function validateSeoRequest(body) {
  const { url, html } = body || {};
  if (!url && !html) {
    return { valid: false, error: 'URLまたはHTMLが必要です', code: 'MISSING_INPUT' };
  }
  return { valid: true };
}

// SEOチェックエンドポイント
app.post('/api/check/seo', async (req, res) => {
  try {
    const validation = validateSeoRequest(req.body);
    if (!validation.valid) {
      return sendApiError(res, 400, validation.error, validation.code);
    }
    const { url, html, waitForJS = false, sessionId, userId, slim = false } = req.body;
    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
    await saveAnalysisHistory(results, { url, html, waitForJS, sessionId, userId });
    // レスポンスサイズ制限対策: slim 時は詳細を省略
    const data = slim ? { ...results, detailedAnalysis: undefined, detailedReport: undefined } : results;
    return sendApiSuccess(res, data);
  } catch (error) {
    logger.error(`API エラー: ${error.message}`);
    const code = error.code === 'CHROME_UNAVAILABLE' ? 'CHROME_UNAVAILABLE' : 'INTERNAL_ERROR';
    const status = code === 'CHROME_UNAVAILABLE' ? 503 : 500;
    return sendApiError(res, status, error.message, code);
  }
});

// レポート生成エンドポイント
app.post('/api/report/seo', async (req, res) => {
  try {
    const validation = validateSeoRequest(req.body);
    if (!validation.valid) {
      return sendApiError(res, 400, validation.error, validation.code);
    }
    const { url, html, waitForJS = false, sessionId, userId } = req.body;
    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
    await saveAnalysisHistory(results, { url, html, waitForJS, sessionId, userId });
    const report = checker.generateReport(results);
    return sendApiSuccess(res, { results, report });
  } catch (error) {
    logger.error(`レポート生成エラー: ${error.message}`);
    return sendApiError(res, 500, error.message, 'REPORT_ERROR');
  }
});

// 詳細レポート生成エンドポイント
app.post('/api/report/detailed', async (req, res) => {
  try {
    const validation = validateSeoRequest(req.body);
    if (!validation.valid) {
      return sendApiError(res, 400, validation.error, validation.code);
    }
    const { url, html, waitForJS = false, sessionId, userId } = req.body;
    const checker = new SEOChecker();
    const results = await checker.checkSEO(url, html, waitForJS);
    await saveAnalysisHistory(results, { url, html, waitForJS, sessionId, userId });
    return sendApiSuccess(res, { results, detailedReport: results.detailedReport });
  } catch (error) {
    logger.error(`詳細レポート生成エラー: ${error.message}`);
    return sendApiError(res, 500, error.message, 'DETAILED_REPORT_ERROR');
  }
});

// Phase 2-B: 競合URL比較エンドポイント
// 2つのURLを並列診断し、自分(primary) vs 競合(competitor) のスコア差分を返す。
// 片方が失敗しても続行（partial failure 対応）。
app.post('/api/compare', async (req, res) => {
  try {
    const { primaryUrl, competitorUrl, waitForJS = false, sessionId, userId } = req.body || {};
    if (!primaryUrl || typeof primaryUrl !== 'string') {
      return sendApiError(res, 400, 'primaryUrl は必須です', 'MISSING_PRIMARY_URL');
    }
    if (!competitorUrl || typeof competitorUrl !== 'string') {
      return sendApiError(res, 400, 'competitorUrl は必須です', 'MISSING_COMPETITOR_URL');
    }
    // 簡易URLバリデーション
    for (const u of [primaryUrl, competitorUrl]) {
      try { new URL(u); } catch (_) {
        return sendApiError(res, 400, `URLが不正です: ${u}`, 'INVALID_URL');
      }
    }
    if (primaryUrl === competitorUrl) {
      return sendApiError(res, 400, '比較対象URLが同じです。別のURLを指定してください', 'SAME_URL');
    }

    logger.info(`比較診断開始: primary=${primaryUrl} vs competitor=${competitorUrl}, JS待機=${waitForJS}`);
    const checker = new SEOChecker();

    // 並列実行。Promise.allSettled で片方失敗でも結果を返す
    const settled = await Promise.allSettled([
      checker.checkSEO(primaryUrl, null, waitForJS),
      checker.checkSEO(competitorUrl, null, waitForJS),
    ]);

    const primary = settled[0].status === 'fulfilled' ? settled[0].value : null;
    const competitor = settled[1].status === 'fulfilled' ? settled[1].value : null;
    const primaryError = settled[0].status === 'rejected' ? (settled[0].reason && settled[0].reason.message) : null;
    const competitorError = settled[1].status === 'rejected' ? (settled[1].reason && settled[1].reason.message) : null;

    if (!primary && !competitor) {
      return sendApiError(res, 502, `両方のURLの取得に失敗しました (primary: ${primaryError}, competitor: ${competitorError})`, 'BOTH_FETCH_FAILED');
    }

    // 比較結果を組み立てる
    const comparison = buildComparison(primary, competitor);

    // 履歴保存（成功した方のみ）
    if (primary) await saveAnalysisHistory(primary, { url: primaryUrl, waitForJS, sessionId, userId, comparedWith: competitorUrl });
    if (competitor) await saveAnalysisHistory(competitor, { url: competitorUrl, waitForJS, sessionId, userId, comparedWith: primaryUrl });

    return sendApiSuccess(res, {
      primary,
      competitor,
      comparison,
      warnings: [
        ...(primaryError ? [{ code: 'PRIMARY_FETCH_FAILED', message: `自分のサイトの取得に失敗: ${primaryError}`, detail: primaryError }] : []),
        ...(competitorError ? [{ code: 'COMPETITOR_FETCH_FAILED', message: `競合サイトの取得に失敗: ${competitorError}`, detail: competitorError }] : []),
      ]
    });
  } catch (error) {
    logger.error(`比較診断エラー: ${error.message}`);
    return sendApiError(res, 500, error.message, 'COMPARE_ERROR');
  }
});

/**
 * 比較結果オブジェクトを構築
 * - スコア差分（SEO/AIO/総合）
 * - カテゴリ別差分
 * - 勝ち負け判定（あなたが優位 / 競合が優位 / 同等）
 * - 「競合が対応していてあなたが未対応」のハイライト項目
 */
function buildComparison(primary, competitor) {
  if (!primary || !competitor) {
    return {
      available: false,
      reason: '片方の診断データが取得できなかったため、比較できません'
    };
  }
  const sp = primary.overallScore || 0;
  const sc = competitor.overallScore || 0;
  const ap = (primary.aio && primary.aio.overallScore) || 0;
  const ac = (competitor.aio && competitor.aio.overallScore) || 0;
  const cp = primary.combinedScore || Math.round((sp + ap) / 2);
  const cc = competitor.combinedScore || Math.round((sc + ac) / 2);

  // カテゴリ別差分
  const categoryDiffs = [];
  // SEO 側
  const seoKeys = Object.keys(primary.checks || {});
  for (const key of seoKeys) {
    const myScore = (primary.checks[key] && primary.checks[key].score) || 0;
    const competitorScore = (competitor.checks && competitor.checks[key] && competitor.checks[key].score) || 0;
    categoryDiffs.push({
      category: key,
      type: 'seo',
      primary: myScore,
      competitor: competitorScore,
      diff: myScore - competitorScore,
      winner: myScore > competitorScore ? 'primary' : myScore < competitorScore ? 'competitor' : 'tie',
    });
  }
  // AIO 側
  const aioKeys = Object.keys((primary.aio && primary.aio.checks) || {});
  for (const key of aioKeys) {
    const myScore = (primary.aio.checks[key] && primary.aio.checks[key].score) || 0;
    const competitorScore = (competitor.aio && competitor.aio.checks && competitor.aio.checks[key] && competitor.aio.checks[key].score) || 0;
    categoryDiffs.push({
      category: key,
      type: 'aio',
      primary: myScore,
      competitor: competitorScore,
      diff: myScore - competitorScore,
      winner: myScore > competitorScore ? 'primary' : myScore < competitorScore ? 'competitor' : 'tie',
    });
  }

  // 「競合が対応していてあなたが未対応」のハイライト
  // = 競合のスコアが80以上、かつ あなたのスコアが50未満
  const gapsToClose = categoryDiffs.filter(d =>
    d.competitor >= 80 && d.primary < 50
  ).sort((a, b) => (b.competitor - b.primary) - (a.competitor - a.primary));

  // 「あなたが優位、競合が未対応」のハイライト
  const myAdvantages = categoryDiffs.filter(d =>
    d.primary >= 80 && d.competitor < 50
  ).sort((a, b) => (a.competitor - a.primary) - (b.competitor - b.primary));

  // 勝ち負け判定（5点以上の差で勝敗、それ以下は引き分け扱い）
  const TIE_THRESHOLD = 5;
  function judge(myScore, theirScore) {
    if (Math.abs(myScore - theirScore) <= TIE_THRESHOLD) return 'tie';
    return myScore > theirScore ? 'primary' : 'competitor';
  }
  const verdict = {
    seo: { primary: sp, competitor: sc, diff: sp - sc, winner: judge(sp, sc) },
    aio: { primary: ap, competitor: ac, diff: ap - ac, winner: judge(ap, ac) },
    combined: { primary: cp, competitor: cc, diff: cp - cc, winner: judge(cp, cc) },
  };

  // カテゴリ別の勝ち数集計
  const winCounts = {
    primary: categoryDiffs.filter(d => d.winner === 'primary').length,
    competitor: categoryDiffs.filter(d => d.winner === 'competitor').length,
    tie: categoryDiffs.filter(d => d.winner === 'tie').length,
  };

  return {
    available: true,
    verdict,
    categoryDiffs,
    gapsToClose,
    myAdvantages,
    winCounts,
    totalCategories: categoryDiffs.length,
  };
}

// ヘルスチェック（Render 等の監視用）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// バージョン情報（Phase 2-B: フッタの動的バージョン表示用）
// package.json から version / license / name を読み込んで返す
// 起動時に1度だけ読み込みキャッシュ
let _versionInfo = null;
function getVersionInfo() {
  if (_versionInfo) return _versionInfo;
  try {
    const pkg = require('./package.json');
    _versionInfo = {
      name: pkg.name || 'seo-aio-doctor',
      version: pkg.version || '0.0.0',
      license: pkg.license || 'UNLICENSED',
    };
  } catch (e) {
    _versionInfo = { name: 'seo-aio-doctor', version: '0.0.0', license: 'UNLICENSED' };
  }
  return _versionInfo;
}
app.get('/api/version', (req, res) => {
  // 軽くキャッシュ（5分。リリース時はnew deployで自然更新）
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getVersionInfo());
});

// 分析履歴一覧（MONGODB_URI 設定時のみ有効）
app.get('/api/history', async (req, res) => {
  if (!isDBConnected()) {
    return sendApiError(res, 503, '履歴機能は利用できません（データベース未接続）', 'DB_UNAVAILABLE');
  }
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const sessionId = req.query.sessionId || null;
    const userId = req.query.userId || null;
    const filter = {};
    if (sessionId) filter.sessionId = sessionId;
    if (userId) filter.userId = userId;
    const items = await AnalysisHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return sendApiSuccess(res, { items });
  } catch (error) {
    logger.error(`履歴取得エラー: ${error.message}`);
    return sendApiError(res, 500, error.message, 'HISTORY_ERROR');
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
}, 30000).unref(); // 30秒ごとにチェック（.unref() でテストプロセスを終わらせない）

// サーバー起動（Render 等では 0.0.0.0 でバインド）
async function start() {
  await connectDB();
  const host = process.env.HOST || '0.0.0.0';
  app.listen(port, host, () => {
    logger.info(`SEOチェックサーバー起動: ${host}:${port}`);
    console.log(`🚀 SEO AIO Doctor が起動しました！`);
    console.log(`📱 Webインターフェース: http://localhost:${port}`);
    console.log(`🔧 API エンドポイント: http://localhost:${port}/api/check/seo`);
    if (isDBConnected()) {
      console.log(`📊 分析履歴: MONGODB_URI 接続済み - /api/history が利用可能です`);
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    logger.error('Server start failed:', err);
    process.exit(1);
  });
}

module.exports = SEOChecker;
