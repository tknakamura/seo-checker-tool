// ConoHa WING 本番環境設定
module.exports = {
  // サーバー設定
  server: {
    port: process.env.PORT || 3001,
    host: '0.0.0.0',
    domain: 'api.checkseoaio.com',
    baseUrl: 'https://api.checkseoaio.com'
  },

  // ログ設定
  logging: {
    level: 'info',
    file: '/home/h6u8t_ve78vhk6/api.checkseoaio.com/logs/app.log',
    maxSize: '10m',
    maxFiles: 5
  },

  // セキュリティ設定
  security: {
    corsOrigin: 'https://checkseoaio.com',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分
      max: 100 // リクエスト数制限
    }
  },

  // Puppeteer設定
  puppeteer: {
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security'
    ],
    timeout: 60000
  },

  // タイムアウト設定
  timeouts: {
    request: 30000,
    puppeteer: 60000,
    lighthouse: 120000
  }
};

