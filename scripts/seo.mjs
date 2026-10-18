// SEO + per-video embed helpers for build-tools.mjs (W1a / T-0031, T-0123). Pure functions: no I/O, no globals.
// A tool's embed, VideoObject and the video page exist only when the D1 tools row has youtube_id (nullable). Set it after the video is public.

export const SITE = 'https://systemyxventures.com';
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export const ytId = t => (t && YT_ID.test(t.youtube_id || '') ? t.youtube_id : null);
export const ytThumb = t => (t.thumbnail_url && /^https:\/\//.test(t.thumbnail_url) ? t.thumbnail_url : `https://i.ytimg.com/vi/${t.youtube_id}/maxresdefault.jpg`);
export const watchUrl = (id, sec) => `https://www.youtube.com/watch?v=${id}${sec ? `&t=${sec}s` : ''}`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON-LD block; "<" is escaped so a value can never close the script tag.
export const ldScript = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const publisher = () => ({ '@type': 'Organization', name: 'The Leverage Point Co', url: `${SITE}/` });

export const toSeconds = t => String(t).split(':').map(Number).reduce((a, n) => a * 60 + n, 0);
export const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---- click-to-play embed: a poster button; the iframe is created only on click (no autoplay on load, no YouTube request before).
export const EMBED_CSS = `
.vid{padding:32px 0 8px;border-bottom:none;}
.vplayer{position:relative;aspect-ratio:16/9;background:#000;border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.vplayer iframe,.vplay{position:absolute;inset:0;width:100%;height:100%;border:0;}
.vplay{display:block;padding:0;margin:0;background:#000;cursor:pointer;}
.vplay img{width:100%;height:100%;object-fit:cover;display:block;}
.vtri{position:absolute;left:50%;top:50%;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;background:var(--strategy);box-shadow:0 4px 24px rgba(0,0,0,.5);}
.vtri::after{content:"";position:absolute;left:30px;top:22px;border-left:26px solid var(--ink);border-top:16px solid transparent;border-bottom:16px solid transparent;}
.vplay:focus-visible{outline:3px solid var(--ai);outline-offset:-3px;}
.vlinks{margin-top:12px;font-size:14px;color:var(--muted);}
.vlinks a{color:var(--ink-soft);}
.chapters{list-style:none;display:grid;gap:6px;margin-top:12px;font-size:15px;}
.chapters a{text-decoration:none;color:var(--ink-soft);}
.chapters a:hover{color:var(--ink);text-decoration:underline;}
.chapters .ts,.transcript .ts{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--muted);margin-right:10px;}
.transcript summary{cursor:pointer;font-weight:600;}
.transcript p{margin-top:12px;color:var(--ink-soft);font-size:15px;line-height:1.7;}
.credits p{color:var(--muted);font-size:13px;margin-top:8px;max-width:70ch;}
`;

export function embedHtml({ id, title, thumb, moreHref }) {
  return `
<section class="wrap vid" id="video" aria-label="Watch the video">
  <div class="vplayer" data-yt="${esc(id)}" data-title="${esc(title)}">
    <button type="button" class="vplay" aria-label="Play video: ${esc(title)}"><img src="${esc(thumb)}" width="1280" height="720" alt="" loading="lazy" decoding="async"><span class="vtri" aria-hidden="true"></span></button>
  </div>
  <p class="vlinks"><a href="${esc(watchUrl(id))}" target="_blank" rel="noopener">Watch on YouTube</a>${moreHref ? ` · <a href="${esc(moreHref)}">Chapters &amp; transcript</a>` : ''}</p>
</section>`;
}

export const EMBED_SCRIPT = `<script>
(function(){
  var p = document.querySelector('.vplayer[data-yt]'); if (!p) return;
  var b = p.querySelector('.vplay'); if (!b) return;
  b.addEventListener('click', function(){
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(p.getAttribute('data-yt')) + '?autoplay=1&rel=0';
    f.title = p.getAttribute('data-title') || 'Video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    p.replaceChild(f, b); f.focus();
  });
})();
</script>`;

// ---- SRT -> timed paragraphs (about 30 s each) for the transcript.
export function parseSrt(text) {
  const cues = [];
  for (const block of String(text).replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const m = lines[i].match(/(\d+):(\d\d):(\d\d)[,.](\d{3})/);
    if (!m) continue;
    const t = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000;
    const body = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (body) cues.push({ t, body });
  }
  return cues;
}
export function transcriptParas(cues, span = 30) {
  const paras = [];
  for (const c of cues) {
    const last = paras[paras.length - 1];
    if (last && c.t - last.t < span) last.text += ' ' + c.body; else paras.push({ t: c.t, text: c.body });
  }
  return paras;
}

// ---- JSON-LD builders
export function videoObject({ id, name, description, thumb, uploadDate, duration, chapters }) {
  const o = {
    '@context': 'https://schema.org', '@type': 'VideoObject', name, description, thumbnailUrl: [thumb], uploadDate,
    embedUrl: `https://www.youtube.com/embed/${id}`, publisher: publisher()
  };
  if (duration) o.duration = duration;
  if (chapters && chapters.length) {
    o.hasPart = chapters.map((c, i) => ({
      '@type': 'Clip', name: c.title, startOffset: c.start,
      ...(chapters[i + 1] ? { endOffset: chapters[i + 1].start } : {}), url: watchUrl(id, c.start)
    }));
  }
  return o;
}
export function softwareApplication({ name, description, url, free = true }) {
  return {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name, description, url,
    applicationCategory: 'BusinessApplication', operatingSystem: 'Web', isAccessibleForFree: free,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: publisher()
  };
}
export function creativeWork({ name, description, url }) {
  return { '@context': 'https://schema.org', '@type': 'CreativeWork', name, description, url, isAccessibleForFree: true, publisher: publisher() };
}
// Price comes from the D1 kits row (price_standard); the launch code price is a promotion and is not marked up.
export function kitProduct({ kit, url }) {
  const o = {
    '@type': 'Product', name: kit.name, description: kit.tagline || kit.name, url, brand: { '@type': 'Brand', name: 'The Leverage Point Co' }
  };
  if (kit.price_standard != null) o.offers = { '@type': 'Offer', price: String(kit.price_standard), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url };
  return o;
}

// ---- sitemap + robots
export function sitemapXml(pages) {
  const rows = pages.map(p => `  <url><loc>${esc(p.loc)}</loc>${p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : ''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}
export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;
