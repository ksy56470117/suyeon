import { Transformer } from 'markmap-lib';
import { fillTemplate } from 'markmap-render';
import puppeteer from 'puppeteer';
import { readFile, readdir, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'pdf-output');

async function mdToMindmapPDF(inputFile, outputFile) {
  let markdown = await readFile(inputFile, 'utf-8');

  // frontmatter 제거
  markdown = markdown.replace(/^---[\s\S]*?---\s*/, '');
  // blockquote/링크 라인 제거 (마인드맵 렌더링에 불필요)
  markdown = markdown.replace(/^>\s*관련:.*$/gm, '');
  // 수평선 제거
  markdown = markdown.replace(/^---\s*$/gm, '');

  const transformer = new Transformer();
  const { root, features } = transformer.transform(markdown);
  const assets = transformer.getUsedAssets(features);

  // 커스텀 HTML: 마인드맵을 꽉 채우고, 한글 폰트 적용
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  #mindmap { width: 100vw; height: 100vh; }
  /* 한글 폰트 */
  * { font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif !important; }
</style>
${assets.styles.map(s => `<link rel="stylesheet" href="${s.data.href}">`).join('\n')}
${assets.scripts.map(s => `<script src="${s.data.src}"><\/script>`).join('\n')}
</head>
<body>
<svg id="mindmap"></svg>
<script>
  const { Markmap, loadCSS, loadJS } = window.markmap;
  const root = ${JSON.stringify(root)};
  const mm = Markmap.create('svg#mindmap', {
    duration: 0,
    maxWidth: 400,
    initialExpandLevel: -1,
    fitRatio: 0.92,
    paddingX: 20,
  }, root);
  // 렌더 후 fit
  setTimeout(() => mm.fit(), 500);
<\/script>
</body>
</html>`;

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // 큰 뷰포트로 마인드맵이 잘 펼쳐지게
  await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle2' });

  // SVG 렌더링 대기
  await new Promise(r => setTimeout(r, 3000));

  // SVG 크기 측정해서 PDF 크기 맞추기
  const svgBox = await page.evaluate(() => {
    const svg = document.querySelector('#mindmap');
    const g = svg.querySelector('g');
    if (!g) return null;
    const bbox = g.getBBox();
    return { width: bbox.width + 100, height: bbox.height + 100 };
  });

  const pdfWidth = svgBox ? Math.max(svgBox.width / 2, 1200) : 1600;
  const pdfHeight = svgBox ? Math.max(svgBox.height / 2, 900) : 1200;

  await page.pdf({
    path: outputFile,
    width: `${pdfWidth}px`,
    height: `${pdfHeight}px`,
    printBackground: true,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
  });

  await browser.close();
  const name = path.basename(outputFile);
  console.log(`✓ ${name}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await readdir(INPUT_DIR))
    .filter(f => f.endsWith('-mindmap.md'))
    .sort();

  console.log(`${files.length}개 마인드맵 변환 시작...\n`);

  for (const file of files) {
    const input = path.join(INPUT_DIR, file);
    const output = path.join(OUTPUT_DIR, file.replace('-mindmap.md', '.pdf'));
    try {
      await mdToMindmapPDF(input, output);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
    }
  }

  console.log(`\n완료! PDF 위치: ${OUTPUT_DIR}`);
}

main();
