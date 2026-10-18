// IndexNow ping (Bing, Yandex, Naver, Seznam, Yep; Google does not use it). Run after the Pages deploy is live.
//   node scripts/indexnow.mjs --since HEAD~1     URLs of pages changed since a git ref (default HEAD~1)
//   node scripts/indexnow.mjs --all              every URL in sitemap.xml
//   add --dry-run to print the request without sending. The key is public by design (it is served at /<key>.txt).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'systemyxventures.com', SITE = `https://${HOST}`;
const args = process.argv.slice(2);
const key = fs.readFileSync(path.join(ROOT, 'src/indexnow-key.txt'), 'utf8').trim();
const fileUrl = rel => (rel === 'index.html' ? `${SITE}/` : rel.endsWith('/index.html') ? `${SITE}/${rel.slice(0, -'index.html'.length)}` : `${SITE}/${rel}`);

let urls;
if (args.includes('--all')) {
  urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
} else {
  const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : 'HEAD~1';
  const files = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', since, 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  urls = files.filter(f => f.endsWith('.html') && !f.startsWith('src/') && !f.startsWith('scripts/') && !f.startsWith('node_modules/')).map(fileUrl);
}
urls = [...new Set(urls)];
if (!urls.length) { console.log('indexnow: no changed pages, nothing to send'); process.exit(0); }
const payload = { host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls };
console.log(`indexnow: ${urls.length} URL(s)\n${urls.join('\n')}`);
if (args.includes('--dry-run')) process.exit(0);
const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
console.log(`indexnow: HTTP ${r.status}`); // 200 or 202 = accepted; 403 = key file not reachable yet; 422 = URL/key mismatch; 429 = too many
process.exit(r.status === 200 || r.status === 202 ? 0 : 1);
