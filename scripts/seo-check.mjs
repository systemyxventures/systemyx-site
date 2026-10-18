// npm run seo-check: static SEO gate for the built site (W1a / T-0031 DO 6-7; funnel-align runs it).
// Per page: unique title and description, canonical = its own URL, og tags, JSON-LD parses with required fields, sitemap entry.
// Site: sitemap.xml lists only files that exist and every page is listed; robots.txt names the sitemap; IndexNow key file matches src/indexnow-key.txt.
// VideoObject must appear exactly when the page has a YouTube embed (and never without one). Exit 1 on any failure.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://systemyxventures.com';
const fails = [];
const fail = (page, msg) => fails.push(`${page}: ${msg}`);

function listPages(dir = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'src' || e.name === 'scripts') continue;
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...listPages(rel)); else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
const urlOf = rel => (rel === 'index.html' ? `${SITE}/` : rel.endsWith('/index.html') ? `${SITE}/${rel.slice(0, -'index.html'.length)}` : `${SITE}/${rel}`);

const sitemapFile = path.join(ROOT, 'sitemap.xml');
const sitemap = fs.existsSync(sitemapFile) ? [...fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]) : [];
if (!sitemap.length) fail('sitemap.xml', 'missing or empty');

const titles = new Map(), descs = new Map();
const pages = listPages();
for (const rel of pages) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const url = urlOf(rel);
  const get = re => (html.match(re) || [])[1];
  const title = get(/<title>([^<]*)<\/title>/), desc = get(/<meta name="description" content="([^"]*)"/), canon = get(/<link rel="canonical" href="([^"]*)"/);
  if (!title) fail(rel, 'no <title>'); else if (titles.has(title)) fail(rel, `duplicate title (also ${titles.get(title)})`); else titles.set(title, rel);
  if (!desc) fail(rel, 'no meta description'); else if (descs.has(desc)) fail(rel, `duplicate description (also ${descs.get(desc)})`); else descs.set(desc, rel);
  if (desc && desc.length > 320) fail(rel, `meta description ${desc.length} chars`);
  if (canon !== url) fail(rel, `canonical ${canon} != ${url}`);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:type']) if (!html.includes(`property="${p}"`)) fail(rel, `missing ${p}`);
  if (get(/<meta property="og:url" content="([^"]*)"/) !== url) fail(rel, 'og:url differs from canonical');
  if (!sitemap.includes(url)) fail(rel, `not in sitemap.xml (${url})`);
  const types = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j;
    try { j = JSON.parse(m[1]); } catch (e) { fail(rel, `JSON-LD does not parse: ${e.message}`); continue; }
    types.push(j['@type']);
    if (j['@context'] !== 'https://schema.org') fail(rel, `JSON-LD ${j['@type']} lacks @context`);
    if (!j.name) fail(rel, `JSON-LD ${j['@type']} lacks name`);
    if (j['@type'] === 'VideoObject') for (const k of ['description', 'thumbnailUrl', 'uploadDate', 'embedUrl']) if (!j[k]) fail(rel, `VideoObject lacks ${k}`);
    if (j['@type'] === 'Product' && j.offers && !(Number(j.offers.price) > 0)) fail(rel, 'Product offer has no positive price (price must come from the D1 kits row)');
  }
  const embed = html.includes('class="vplayer"');
  if (embed !== types.includes('VideoObject')) fail(rel, embed ? 'YouTube embed without VideoObject' : 'VideoObject without a YouTube embed');
  if (/<iframe[^>]+youtube/i.test(html)) fail(rel, 'static YouTube iframe in HTML (the player must be created on click, no autoplay on load)');
}
for (const u of sitemap) {
  const rel = u === `${SITE}/` ? 'index.html' : u.endsWith('/') ? `${u.slice(SITE.length + 1)}index.html` : u.slice(SITE.length + 1);
  if (!u.startsWith(`${SITE}/`) || !fs.existsSync(path.join(ROOT, rel))) fail('sitemap.xml', `lists ${u} but ${rel} does not exist`);
}
const robots = fs.existsSync(path.join(ROOT, 'robots.txt')) ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8') : '';
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt', 'missing or no Sitemap line');
const keyFile = path.join(ROOT, 'src/indexnow-key.txt');
if (!fs.existsSync(keyFile)) fail('indexnow', 'src/indexnow-key.txt missing');
else {
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  const kf = path.join(ROOT, `${key}.txt`);
  if (!fs.existsSync(kf) || fs.readFileSync(kf, 'utf8').trim() !== key) fail('indexnow', `${key}.txt missing or wrong content`);
}
console.log(`${pages.length} pages, ${sitemap.length} sitemap URLs checked`);
if (fails.length) { console.error(fails.map(f => 'FAIL ' + f).join('\n')); process.exit(1); }
console.log('seo-check: PASS');
