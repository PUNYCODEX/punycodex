#!/usr/bin/env node
/**
 * Canonical sitemap generator.
 *
 * Sources of truth:
 *   - type/js/lexicon.js (all temple ids)
 *   - js/archetypes-v2.js (flagship ids and their secondary pages)
 *
 * Output: sitemap.xml at project root.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function writeFileWithRetry(filePath, data, encoding = 'utf8', retries = 5, delay = 100) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.writeFileSync(filePath, data, encoding);
      return;
    } catch (err) {
      const isTransient =
        err.code === 'EBUSY' || err.code === 'EAGAIN' || err.code === 'UNKNOWN' || err.code === 'EPERM';
      if (attempt === retries || !isTransient) {
        throw err;
      }
      const ms = delay * attempt;
      console.warn(`  transient write error for ${filePath} (${err.code}), retrying in ${ms}ms...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    }
  }
}
const { LEXICON } = require(path.join(ROOT, 'type', 'js', 'lexicon.js'));
const { PANTHEON_META } = require(path.join(ROOT, 'type', 'js', 'pantheon-meta.js'));
const SCREEN_INDEX = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'screen-index.json'), 'utf8')
);

const archetypeSrc = fs.readFileSync(path.join(ROOT, 'js', 'archetypes-v2.js'), 'utf8');
const ARCHETYPES = vm.runInNewContext(
  `(function(){\n${archetypeSrc}\nreturn ARCHETYPES;\n})()`
);
const flagshipIds = new Set(ARCHETYPES.filter((a) => a.built).map((a) => a.id));

const BASE_URL = 'https://punicodex.com';

const mainPages = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/pantheon/', priority: '0.9', changefreq: 'weekly' },
  { loc: '/lexicon/', priority: '0.9', changefreq: 'weekly' },
  { loc: '/blog/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/texts/', priority: '0.7', changefreq: 'monthly' },
  { loc: '/type/', priority: '0.9', changefreq: 'weekly' },
  { loc: '/tiers/', priority: '0.8', changefreq: 'monthly' },
  { loc: '/realms/', priority: '0.8', changefreq: 'monthly' },
  { loc: '/codex/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/search/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/about/', priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/store/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/university-sponsorship/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/api/v1/docs/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/appraise/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/terms/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/advertising/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/analytics/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/privacy/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/herald/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/authenticity/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/art/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/game/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/connections/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/creatives/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/about/authenticity/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/codex/anatomy-of-a-punycode-domain/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/codex/building-the-temple/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/codex/why-greek-accents-matter/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/codex/restoring-the-names/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/scholars/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/scholars/search/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/scholars/analytics/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/scholars/creatives/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/oracle/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/lexicon/cognates/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/terms/data-use/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/store/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/creatives/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/extension/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/app/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/innovation/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/trending/', priority: '0.7', changefreq: 'weekly' },
  { loc: '/patterns/', priority: '0.8', changefreq: 'weekly' },
  { loc: '/everyday/', priority: '0.8', changefreq: 'monthly' },
  { loc: '/ink/', priority: '0.8', changefreq: 'monthly' },
  { loc: '/terms/ink/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/appraise/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/game/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/api/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/authenticity/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/terms/oracle/', priority: '0.4', changefreq: 'yearly' },
  { loc: '/patterns/methodology/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/careers/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/about/founder/', priority: '0.5', changefreq: 'monthly' },
  { loc: '/arbitrage/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/cards/', priority: '0.6', changefreq: 'weekly' },
  { loc: '/rulebook/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/pronunciation/', priority: '0.6', changefreq: 'monthly' },
  { loc: '/engineering/', priority: '0.6', changefreq: 'monthly' },
];

// Per-pantheon landing pages (/greek/, /norse/, etc.).
for (const id of Object.keys(PANTHEON_META).sort((a, b) => a.localeCompare(b))) {
  mainPages.push({ loc: `/${id}/`, priority: '0.8', changefreq: 'monthly' });
}

// Screen Guide (/screen/ and /screen/{id}/).
mainPages.push({ loc: '/screen/', priority: '0.7', changefreq: 'weekly' });
for (const production of SCREEN_INDEX.productions) {
  mainPages.push({ loc: `/screen/${production.id}/`, priority: '0.6', changefreq: 'monthly' });
}

// Unicode Herald (/herald/ and book chapters).
const HERALD_EDITIONS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'herald-editions.json'), 'utf8')
);
for (const heraldEdition of HERALD_EDITIONS.editions) {
  mainPages.push({ loc: `/herald/${heraldEdition.id}/`, priority: '0.7', changefreq: 'monthly' });
  mainPages.push({
    loc: `/herald/${heraldEdition.id}/book/`,
    priority: '0.8',
    changefreq: 'monthly',
  });
  for (const chapter of heraldEdition.chapters) {
    mainPages.push({
      loc: `/herald/${heraldEdition.id}/${chapter.slug}/`,
      priority: '0.6',
      changefreq: 'monthly',
    });
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, priority, changefreq, extra = {}) {
  const lastmod = extra.lastmod ? `    <lastmod>${escapeXml(extra.lastmod)}</lastmod>\n` : '';
  const image = extra.image
    ? `    <image:image>\n      <image:loc>${escapeXml(extra.image)}</image:loc>\n    </image:image>\n`
    : '';
  return `  <url>\n    <loc>${escapeXml(BASE_URL + loc)}</loc>\n${lastmod}    <priority>${priority}</priority>\n    <changefreq>${changefreq}</changefreq>\n${image}  </url>\n`;
}

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml +=
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

// Main pages
for (const p of mainPages) {
  xml += urlEntry(p.loc, p.priority, p.changefreq);
}

// Sacred Texts: one reading page per registered text.
const TEXT_REGISTRY = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'platform', 'texts', 'registry.json'), 'utf8')
);
for (const t of TEXT_REGISTRY.texts) {
  xml += urlEntry(`/texts/${t.id}/`, '0.6', 'monthly');
}

// Blog <lastmod> dates come from the committed post JSONs alone — never from
// git, the clock, or data-version.json: CI re-runs this generator on a
// shallow clone and the sitemap bytes must not move. A URL whose post JSON
// cannot be resolved simply gets no <lastmod>.
function blogLastmod(...parts) {
  try {
    const post = JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
    const date = typeof post.publishedAt === 'string' ? post.publishedAt.slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

// Temple pages — canonical clean form /{id}/ (middleware serves /sites/{id}).
for (const entry of LEXICON) {
  const isFlagship = flagshipIds.has(entry.id);
  const priority = isFlagship ? '0.8' : '0.6';
  xml += urlEntry(`/${entry.id}/`, priority, 'monthly', {
    image: isFlagship ? `${BASE_URL}/assets/og/${entry.id}.jpg` : null,
  });

  if (isFlagship) {
    xml += urlEntry(`/${entry.id}/lore/`, '0.7', 'monthly');
    xml += urlEntry(`/${entry.id}/lore/extended/`, '0.6', 'monthly');
    xml += urlEntry(`/${entry.id}/gallery/`, '0.5', 'monthly');
    xml += urlEntry(`/${entry.id}/blog/`, '0.6', 'monthly', {
      lastmod: blogLastmod('platform', 'blog', 'content', `${entry.id}.json`),
    });
    xml += urlEntry(`/${entry.id}/blog/restoration/`, '0.6', 'monthly', {
      lastmod: blogLastmod('platform', 'blog', 'series', 'restoration', `${entry.id}.json`),
    });
    xml += urlEntry(`/${entry.id}/blog/resonance/`, '0.6', 'monthly', {
      lastmod: blogLastmod('platform', 'blog', 'series', 'resonance', `${entry.id}.json`),
    });
    xml += urlEntry(`/${entry.id}/blog/canonical/`, '0.7', 'monthly', {
      lastmod: blogLastmod('platform', 'blog', 'series', 'canonical', `${entry.id}.json`),
    });
    xml += urlEntry(`/${entry.id}/patterns/`, '0.5', 'monthly');
    xml += urlEntry(`/${entry.id}/scholars/`, '0.7', 'monthly');
    xml += urlEntry(`/${entry.id}/creatives/`, '0.5', 'monthly');
    xml += urlEntry(`/${entry.id}/patron/`, '0.5', 'monthly');
  }
}

// Reliquary store pages: one collection + one product page per catalog item.
const POD = JSON.parse(fs.readFileSync(path.join(ROOT, 'store', 'products.json'), 'utf8'));
const storeCollectionIds = new Set();
for (const product of POD.products) {
  const templeId = product.temple || 'punicodex';
  if (!storeCollectionIds.has(templeId)) {
    storeCollectionIds.add(templeId);
    xml += urlEntry(`/store/${templeId}/`, '0.6', 'weekly');
  }
  xml += urlEntry(`/store/${templeId}/${product.id.split('-').pop()}/`, '0.5', 'weekly');
}

xml += '</urlset>\n';

writeFileWithRetry(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');

// 11 secondary URLs per flagship: lore, extended lore, gallery, the four
// blog dispatches, patterns, scholars, creatives, patron.
const urlCount =
  mainPages.length +
  TEXT_REGISTRY.texts.length +
  LEXICON.length +
  flagshipIds.size * 11 +
  storeCollectionIds.size +
  POD.count;
console.log(`Sitemap generated: ${urlCount} URLs`);
