import { Transformer } from 'markmap-lib';
import { fillTemplate } from 'markmap-render';
import puppeteer from 'puppeteer';
import { readFile, readdir, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'pdf-output');

async function mdToPNG(inputFile, outputFile) {
  let md = await readFile(inputFile, 'utf-8');
  md = md.replace(/^---[\s\S]*?---\s*/, '');
  md = md.replace(/^>\s*관련:.*$/gm, '');
  md = md.replace(/^---\s*$/gm, '');

  const t = new Transformer();
  const { root, features } = t.transform(md);
  const assets = t.getUsedAssets(features);
  let html = fillTemplate(root, assets, { jsonOptions: { duration: 0, initialExpandLevel: -1 } });
  html = html.replace('</style>', '* { font-family: -apple-system, "Apple SD Gothic Neo", sans-serif !important; } body { background: white; }</style>');

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 4000, height: 3000, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: outputFile, fullPage: true });
  await browser.close();

  console.log(`✓ ${path.basename(outputFile)}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = (await readdir(INPUT_DIR)).filter(f => f.endsWith('-mindmap.md')).sort();
  console.log(`${files.length}개 변환 시작...\n`);

  for (const file of files) {
    const input = path.join(INPUT_DIR, file);
    const output = path.join(OUTPUT_DIR, file.replace('-mindmap.md', '.png'));
    try {
      await mdToPNG(input, output);
    } catch (err) {
      console.error(`✗ ${file}: ${err.message}`);
    }
  }
  console.log(`\n완료! 위치: ${OUTPUT_DIR}`);
}

main();
