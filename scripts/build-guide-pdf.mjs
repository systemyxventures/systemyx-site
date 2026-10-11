// npm run build-guide-pdf: src/guides/claude-guide-v1.md -> tools/claude-guide.pdf (A5, phone-readable, running header with the last-verified date).
// The markdown is the source; edit it, bump "Last verified", re-run, commit both. Needs Chrome or Edge (headless print).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { marked } from 'marked';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/guides/claude-guide-v1.md');
const OUT = path.join(ROOT, 'tools/claude-guide.pdf');
const md = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');
const verified = (md.match(/\*\*Last verified:\*\*\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
if (!verified) throw new Error('no "Last verified" date in the markdown');

marked.setOptions({ gfm: true, breaks: true });
const body = marked.parse(md);

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>The Claude Efficiency System</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<style>
@page{size:148mm 210mm;margin:20mm 13mm 17mm}
*{box-sizing:border-box}
body{font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;font-size:10.6pt;line-height:1.5;color:#1b1720;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-size:24pt;line-height:1.1;letter-spacing:-.02em;margin:6mm 0 3mm;color:#141115}
h1+p{font-size:11.5pt;color:#4d4752;border-left:1.2mm solid #B80C09;padding-left:4mm;margin:0 0 5mm}
h2{font-size:15pt;line-height:1.2;margin:8mm 0 2.5mm;color:#141115;break-after:avoid;border-top:.5pt solid #d8d4dc;padding-top:5mm}
h3{font-size:11.5pt;margin:5mm 0 1.5mm;color:#B80C09;break-after:avoid}
p{margin:0 0 2.6mm}
hr{display:none}
ul,ol{margin:0 0 3mm;padding-left:5.5mm}li{margin-bottom:1.2mm}
strong{color:#141115}
a{color:#B80C09;text-decoration:none}
code{font-family:"IBM Plex Mono",monospace;font-size:8.8pt;background:#f1eff3;border-radius:1mm;padding:.2mm 1mm}
pre{font-family:"IBM Plex Mono",monospace;font-size:8pt;line-height:1.45;background:#f6f4f8;border:.5pt solid #d8d4dc;border-left:1.2mm solid #B80C09;border-radius:1.5mm;padding:3mm;white-space:pre-wrap;word-wrap:break-word;break-inside:avoid;margin:0 0 3.5mm}
pre code{background:none;padding:0;font-size:inherit}
blockquote{margin:0 0 3mm;padding:2mm 3.5mm;background:#f6f4f8;border-left:1.2mm solid #8b8490;color:#4d4752}blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:0 0 4mm;font-size:8.6pt;line-height:1.4;break-inside:avoid}
th{background:#141115;color:#fff;text-align:left;font-weight:600;padding:1.6mm 2mm}
td{border-bottom:.5pt solid #d8d4dc;padding:1.6mm 2mm;vertical-align:top}
tr:nth-child(even) td{background:#faf9fb}
</style></head><body>
${body}
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-'));
const htmlFile = path.join(tmp, 'guide.html');
fs.writeFileSync(htmlFile, html);
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
if (!browser) throw new Error('Chrome or Edge not found');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=15000',
  `--print-to-pdf=${OUT}`, 'file:///' + htmlFile.split(path.sep).join('/')], { stdio: 'inherit', timeout: 120000 });
// Running header (brand mark, title, last-verified date) and footer (site, page x of y) stamped on every page.
const pdf = await PDFDocument.load(fs.readFileSync(OUT));
const sans = await pdf.embedFont(StandardFonts.HelveticaBold), mono = await pdf.embedFont(StandardFonts.Courier);
const pages = pdf.getPages(), mm = v => v * 72 / 25.4, grey = rgb(.36, .33, .39), red = rgb(.722, .047, .035);
pages.forEach((pg, i) => {
  const { width: w, height: h } = pg.getSize(), x0 = mm(13), x1 = w - mm(13), y = h - mm(11);
  pg.drawRectangle({ x: x0, y: y - 2, width: mm(6.2), height: mm(4.2), color: red });
  pg.drawText('LP', { x: x0 + 3.2, y: y + 1, size: 6.5, font: mono, color: rgb(1, 1, 1) });
  pg.drawText('The Leverage Point Co  |  Claude Efficiency System', { x: x0 + mm(8), y: y + 1, size: 7, font: mono, color: grey });
  const right = `Last verified ${verified}`;
  pg.drawText(right, { x: x1 - mono.widthOfTextAtSize(right, 7), y: y + 1, size: 7, font: mono, color: grey });
  pg.drawLine({ start: { x: x0, y: y - 6 }, end: { x: x1, y: y - 6 }, thickness: .5, color: rgb(.85, .83, .86) });
  const foot = 'systemyxventures.com/tools  |  one tool at a time', pn = `${i + 1} / ${pages.length}`;
  pg.drawText(foot, { x: x0, y: mm(9), size: 6.5, font: mono, color: rgb(.55, .52, .56) });
  pg.drawText(pn, { x: x1 - mono.widthOfTextAtSize(pn, 6.5), y: mm(9), size: 6.5, font: mono, color: rgb(.55, .52, .56) });
});
pdf.setTitle('The Claude Efficiency System'); pdf.setAuthor('The Leverage Point Co'); pdf.setSubject(`Last verified ${verified}`);
fs.writeFileSync(OUT, await pdf.save());
console.log(`wrote tools/claude-guide.pdf (${fs.statSync(OUT).size} B), last verified ${verified}`);
