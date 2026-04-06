#!/usr/bin/env node
/**
 * mindmap-export.js
 * 마크다운 파일을 markmap 마인드맵으로 렌더링하여 PNG/PDF로 내보내기
 * Usage: node mindmap-export.js <markdown-file> [png|pdf|both]
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Transformer } = require('markmap-lib');

async function main() {
  const inputFile = process.argv[2];
  const format = (process.argv[3] || 'both').toLowerCase();

  if (!inputFile) {
    console.error('Usage: node mindmap-export.js <markdown-file> [png|pdf|both]');
    process.exit(1);
  }

  const mdContent = fs.readFileSync(inputFile, 'utf-8');
  const baseName = path.basename(inputFile, path.extname(inputFile));
  const outputDir = path.dirname(inputFile);

  // markmap 변환
  const transformer = new Transformer();
  const { root, features } = transformer.transform(mdContent);
  const assets = transformer.getUsedAssets(features);

  // CSS/JS 자산 URL
  const cssList = (assets.styles || []).map(s => {
    if (s.type === 'stylesheet' && s.data && s.data.href) return s.data.href;
    return null;
  }).filter(Boolean);

  const jsList = (assets.scripts || []).map(s => {
    if (s.type === 'script' && s.data && s.data.src) return s.data.src;
    return null;
  }).filter(Boolean);

  // markmap-view CDN
  const markmapViewJS = 'https://cdn.jsdelivr.net/npm/markmap-view/dist/browser/index.js';
  const d3JS = 'https://cdn.jsdelivr.net/npm/d3@7';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; }
  #mindmap { width: 100%; height: 100%; }
  svg.markmap { width: 100%; height: 100%; }
  ${cssList.map(url => `@import url("${url}");`).join('\n')}
</style>
</head>
<body>
<svg id="mindmap"></svg>
<script src="${d3JS}"><\/script>
<script src="${markmapViewJS}"><\/script>
<script>
  const rootData = ${JSON.stringify(root)};

  window.addEventListener('load', () => {
    const { Markmap } = markmap;
    const svg = document.getElementById('mindmap');
    const mm = Markmap.create(svg, {
      autoFit: true,
      duration: 0,
      maxWidth: 300,
      paddingX: 16,
      spacingVertical: 8,
      spacingHorizontal: 80,
    }, rootData);

    // 렌더링 완료 신호
    setTimeout(() => {
      mm.fit();
      setTimeout(() => {
        document.body.setAttribute('data-ready', 'true');
      }, 500);
    }, 1000);
  });
<\/script>
</body>
</html>`;

  // Puppeteer 실행
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // 렌더링 완료 대기
  await page.waitForSelector('body[data-ready="true"]', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));

  const outputs = [];

  if (format === 'png' || format === 'both') {
    const pngPath = path.join(outputDir, `${baseName}-mindmap.png`);
    await page.screenshot({ path: pngPath, fullPage: true, type: 'png' });
    outputs.push(pngPath);
    console.log(`PNG: ${pngPath}`);
  }

  if (format === 'pdf' || format === 'both') {
    const pdfPath = path.join(outputDir, `${baseName}-mindmap.pdf`);
    await page.pdf({
      path: pdfPath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      landscape: true,
    });
    outputs.push(pdfPath);
    console.log(`PDF: ${pdfPath}`);
  }

  await browser.close();
  console.log('Done!');
  return outputs;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
