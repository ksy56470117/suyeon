import { Transformer } from 'markmap-lib';
import { fillTemplate } from 'markmap-render';
import puppeteer from 'puppeteer';
import { readFile, readdir, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'pdf-output');

async function mdToMindmapPDF(inputFile, outputFile) {
  let markdown = await readFile(inputFile, 'utf-8');

  // frontmatter 제거
  markdown = markdown.replace(/^---[\s\S]*?---\s*/, '');
  // blockquote 관련 라인 제거
  markdown = markdown.replace(/^>\s*관련:.*$/gm, '');
  // 수평선 제거
  markdown = markdown.replace(/^---\s*$/gm, '');

  const transformer = new Transformer();
  const { root, features } = transformer.transform(markdown);
  const assets = transformer.getUsedAssets(features);

  // fillTemplate으로 완전한 인라인 HTML 생성
  let html = fillTemplate(root, assets, {
    jsonOptions: {
      duration: 0,
      maxWidth: 350,
      initialExpandLevel: -1,
    },
  });

  // 한글 폰트 + 배경색 주입
  html = html.replace('</style>', `
  * { font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif !important; }
  body { background: white; }
</style>`);

  // fit 호출 주입 - 마인드맵이 뷰포트에 맞게
  html = html.replace('</body>', `
<script>
  setTimeout(() => {
    const mm = document.querySelector('#mindmap').__markmap;
    if (mm) mm.fit();
  }, 1000);
</script>
</body>`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: 2 });

  // file:// 대신 setContent로 직접 주입 (네트워크 불필요)
  await page.setContent(html, { waitUntil: 'load', timeout: 10000 });

  // 렌더링 대기
  await new Promise(r => setTimeout(r, 3000));

  // 콘솔 에러 체크 (디버깅)
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  // SVG에 실제 내용이 있는지 확인
  const hasContent = await page.evaluate(() => {
    const svg = document.querySelector('#mindmap');
    if (!svg) return false;
    const g = svg.querySelector('g');
    return g && g.children.length > 0;
  });

  if (!hasContent) {
    // 디버깅: HTML 저장
    const debugPath = outputFile.replace('.pdf', '.debug.html');
    await writeFile(debugPath, html);
    await browser.close();
    throw new Error(`마인드맵 렌더링 실패 (debug HTML 저장: ${path.basename(debugPath)})`);
  }

  // SVG 바운딩 박스 측정
  const svgBox = await page.evaluate(() => {
    const svg = document.querySelector('#mindmap');
    const g = svg.querySelector('g');
    const bbox = g.getBBox();
    return { width: bbox.width + 120, height: bbox.height + 120 };
  });

  const pdfWidth = Math.max(Math.ceil(svgBox.width / 1.5), 1200);
  const pdfHeight = Math.max(Math.ceil(svgBox.height / 1.5), 900);

  await page.pdf({
    path: outputFile,
    width: `${pdfWidth}px`,
    height: `${pdfHeight}px`,
    printBackground: true,
    margin: { top: 30, right: 30, bottom: 30, left: 30 },
  });

  await browser.close();
  const name = path.basename(outputFile);
  console.log(`✓ ${name} (${pdfWidth}x${pdfHeight})`);
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
