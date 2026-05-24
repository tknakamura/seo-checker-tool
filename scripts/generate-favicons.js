#!/usr/bin/env node
/**
 * favicon 一括生成スクリプト (Phase: favicon)
 *
 * public/favicon.svg をベースに以下のサイズの PNG/ICO を生成:
 *   - favicon-16x16.png
 *   - favicon-32x32.png
 *   - favicon-48x48.png (ICO 用)
 *   - apple-touch-icon.png (180x180)
 *   - android-chrome-192x192.png
 *   - android-chrome-512x512.png
 *   - favicon.ico (16 + 32 + 48 のマルチサイズ)
 *
 * 使い方:
 *   PUPPETEER_SKIP_DOWNLOAD=false npm install puppeteer  # Chrome 取得
 *   node scripts/generate-favicons.js
 *
 * 注: このスクリプトはビルド時 (CI/Render) では実行しません。
 *     手動実行で生成した PNG/ICO をリポジトリに commit するスタイル。
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SVG_PATH = path.join(PUBLIC_DIR, 'favicon.svg');

const SIZES = [
  { size: 16,  out: 'favicon-16x16.png' },
  { size: 32,  out: 'favicon-32x32.png' },
  { size: 48,  out: 'favicon-48x48.png' },
  { size: 180, out: 'apple-touch-icon.png' },
  { size: 192, out: 'android-chrome-192x192.png' },
  { size: 512, out: 'android-chrome-512x512.png' },
];

async function renderPng(browser, svgContent, size, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  // SVGのwidth/heightを上書きしてHTMLでレンダリング
  const html = `<!DOCTYPE html><html><head><style>
    body { margin: 0; padding: 0; background: transparent; }
    svg { display: block; width: ${size}px; height: ${size}px; }
  </style></head><body>${svgContent.replace(/<svg([^>]*)>/, `<svg$1 width="${size}" height="${size}">`)}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({
    path: outPath,
    type: 'png',
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  console.log(`  ✓ ${outPath} (${size}x${size})`);
}

async function generateIco(pngPaths, outPath) {
  // ICO は複数 PNG を 1ファイルに束ねた形式
  // 依存追加せずに ICO バイナリを手書きする (16/32/48 マルチサイズ)
  // ICO 仕様: https://en.wikipedia.org/wiki/ICO_(file_format)
  const images = pngPaths.map(p => ({
    size: parseInt(path.basename(p).match(/(\d+)x\1/)[1], 10),
    data: fs.readFileSync(p),
  }));

  // ICONDIR (6 bytes)
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);          // Reserved
  iconDir.writeUInt16LE(1, 2);          // Type: 1 = ICO
  iconDir.writeUInt16LE(images.length, 4); // # of images

  // ICONDIRENTRY (16 bytes each)
  const headerSize = 6 + images.length * 16;
  let offset = headerSize;
  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width (0 = 256)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
    entry.writeUInt8(0, 2);                                // color palette
    entry.writeUInt8(0, 3);                                // reserved
    entry.writeUInt16LE(1, 4);                             // planes
    entry.writeUInt16LE(32, 6);                            // bpp
    entry.writeUInt32LE(img.data.length, 8);               // size
    entry.writeUInt32LE(offset, 12);                       // offset
    entries.push(entry);
    offset += img.data.length;
  }

  const buf = Buffer.concat([iconDir, ...entries, ...images.map(i => i.data)]);
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ ${outPath} (multi-size ICO: ${images.map(i => i.size).join('+')})`);
}

(async () => {
  if (!fs.existsSync(SVG_PATH)) {
    console.error(`❌ ${SVG_PATH} が見つかりません`);
    process.exit(1);
  }
  const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');

  console.log('🎨 favicon 生成開始...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // 各サイズの PNG を生成
    for (const { size, out } of SIZES) {
      const outPath = path.join(PUBLIC_DIR, out);
      await renderPng(browser, svgContent, size, outPath);
    }

    // ICO (16+32+48 マルチサイズ)
    const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
    await generateIco(
      [
        path.join(PUBLIC_DIR, 'favicon-16x16.png'),
        path.join(PUBLIC_DIR, 'favicon-32x32.png'),
        path.join(PUBLIC_DIR, 'favicon-48x48.png'),
      ],
      icoPath
    );

    // site.webmanifest (PWA 対応の最小限)
    const manifest = {
      name: 'SEO AIO Doctor',
      short_name: 'SEO AIO Doctor',
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#2563eb',
      background_color: '#ffffff',
      display: 'standalone',
    };
    fs.writeFileSync(
      path.join(PUBLIC_DIR, 'site.webmanifest'),
      JSON.stringify(manifest, null, 2) + '\n'
    );
    console.log('  ✓ public/site.webmanifest');

    console.log('\n✅ favicon 一式の生成完了');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('❌ 生成失敗:', err);
  process.exit(1);
});
