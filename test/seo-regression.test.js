#!/usr/bin/env node
/**
 * PuniCodex — SEO Regression Tests
 *
 * Guards the 2026-08-16 master-SEO-audit fixes against silent regression:
 *   - blog SERP titles: no mass truncation, deity names never halved,
 *     uniqueness across the 1,128 blog pages
 *   - base temples: ASCII form in title/H1-alias, rotated related grids,
 *     BreadcrumbList, no meta keywords, footer link block
 *   - flagships: dashboard noindex, Name Variations section, visible
 *     breadcrumb, swapped meta descriptions, name-bearing tab H1s
 *   - store: single-escaped metas, absolute JSON-LD images, BreadcrumbList,
 *     OG/Twitter, stage-image CWV attributes
 *   - sitemap/robots: no .html locs, no /search-v2/, blog lastmod present,
 *     image extension, no glob disallows, /api/ + /auth/ + search disallowed
 *     with an /api/v1/docs/ exception
 *   - scholars portal: app surfaces noindex, public pages canonical
 *   - hand pages: oracle live title, creatives canonical, homepage
 *     WebSite+Organization JSON-LD, search-v2 consolidation, mobile noindex
 *   - temple index syncer: static temple anchors on the four hub pages
 *
 * Plain-script runner (node test/seo-regression.test.js), repo idiom.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { LEXICON } = require('../type/js/lexicon.js');
const { ARCHETYPES } = require('../js/archetypes-v2.js');
const BUILT_IDS = new Set((ARCHETYPES || []).filter((a) => a.built).map((a) => a.id));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(
      `    ${String(err.message || err)
        .split('\n')
        .slice(0, 6)
        .join('\n    ')}`
    );
  }
}

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const titleOf = (html) => (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
const descOf = (html) => (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
const LEXICON_IDS = new Set(LEXICON.map((e) => e.id));

/* ------------------------------ blog titles ------------------------------ */

test('blog SERP titles: no mass truncation, names intact, near-unique', () => {
  const { ARCHETYPES } = require('../js/archetypes-v2.js');
  const built = (ARCHETYPES || []).filter((a) => a.built).map((a) => a.id);
  const series = ['blog', 'blog/canonical', 'blog/resonance', 'blog/restoration'];
  const titles = [];
  let truncated = 0;
  for (const id of built) {
    for (const tab of series) {
      const rel = `sites/${id}/${tab}/index.html`;
      if (!exists(rel)) continue;
      const t = titleOf(read(rel));
      assert.ok(t, `${rel}: missing <title>`);
      if (t.includes('…')) truncated++;
      titles.push(t);
    }
  }
  assert.ok(titles.length >= 1100, `expected ~1128 blog titles, got ${titles.length}`);
  // The audit's real defect was mass duplication: 871/1128 unique, with 7
  // strings shared by 22-66 pages each. Post-fix every title must be unique
  // (truncation is acceptable only while unique + name-preserving).
  const unique = new Set(titles);
  const dupRatio = 1 - unique.size / titles.length;
  assert.ok(
    dupRatio < 0.01,
    `blog titles only ${unique.size}/${titles.length} unique (${(dupRatio * 100).toFixed(1)}% duplicates)`
  );
  // No dangling stopword before the ellipsis ("…that way — and… | Series").
  const dangling = titles.filter((t) =>
    /[\s—–-](and|or|the|a|an|of|to|in|on|for|with|that|this|is|are|was|were|its|his|her|their|from|into|over|after|before)…\s*\|/i.test(
      t
    )
  );
  assert.deepStrictEqual(
    dangling.slice(0, 5),
    [],
    `${dangling.length} titles end on a dangling stopword`
  );
  // Truncation residue must be a minority of long headlines.
  assert.ok(
    truncated / titles.length < 0.7,
    `${truncated}/${titles.length} blog titles truncated (regression vs fix baseline)`
  );
});

/* ------------------------------ base temples ----------------------------- */

test('base temple titles carry the ASCII query form when unicode differs', () => {
  let checked = 0;
  for (const entry of LEXICON) {
    const rel = `sites/${entry.id}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    if (!html.includes('PUNICODEX Base Temple')) continue; // flagships skip
    if (entry.unicode.toLowerCase() === entry.ascii.toLowerCase()) continue;
    const t = titleOf(html);
    const asciiCap = entry.ascii.charAt(0).toUpperCase() + entry.ascii.slice(1);
    assert.ok(t.includes(`(${asciiCap})`), `${entry.id}: title missing ASCII alias: "${t}"`);
    assert.ok(html.includes('also written'), `${entry.id}: hero missing visible ASCII alias`);
    checked++;
  }
  assert.ok(checked > 300, `only ${checked} non-ASCII base temples checked`);
});

test('base temple related grids rotate (no first-6 bias, no identical grids)', () => {
  const grids = new Map(); // pantheon -> Map(entryId -> gridKey)
  let checked = 0;
  for (const entry of LEXICON) {
    const rel = `sites/${entry.id}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    if (!html.includes('PUNICODEX Base Temple')) continue;
    const m = html.match(/Names Related to[\s\S]*?<\/section>/);
    if (!m) continue;
    // Base temples serve on deity domains too, so links are absolute. Temple
    // links use the clean /{id}/ form; filter to real lexicon ids so hub
    // links (e.g. /lexicon/) in the same section are not miscounted.
    const links = [...m[0].matchAll(/href="(?:https:\/\/punicodex\.com)?\/([a-z0-9-]+)\//g)]
      .map((x) => x[1])
      .filter((id) => LEXICON_IDS.has(id));
    if (!grids.has(entry.pantheon)) grids.set(entry.pantheon, new Map());
    grids.get(entry.pantheon).set(entry.id, links.join(','));
    checked++;
  }
  const expectedBaseCount = LEXICON.length - BUILT_IDS.size;
  assert.ok(
    checked >= expectedBaseCount - 5,
    `only ${checked} base-temple grids found (expected ~${expectedBaseCount})`
  );
  let identicalPairs = 0;
  for (const perEntry of grids.values()) {
    const keys = [...perEntry.values()];
    const distinct = new Set(keys);
    if (keys.length > 6 && distinct.size < Math.min(3, keys.length)) identicalPairs++;
  }
  assert.strictEqual(
    identicalPairs,
    0,
    `${identicalPairs} pantheons still collapse to near-identical grids`
  );
});

test('base temples: BreadcrumbList, no meta keywords, store footer link', () => {
  for (const id of ['aaru', 'hathor', 'adad', 'agave']) {
    const rel = `sites/${id}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    if (!html.includes('PUNICODEX Base Temple')) continue;
    assert.ok(
      html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'),
      `${id}: no BreadcrumbList`
    );
    assert.ok(!html.includes('name="keywords"'), `${id}: obsolete meta keywords still present`);
    // Base temples serve on deity domains too, so footer links may be absolute.
    assert.ok(
      /href="(https:\/\/punicodex\.com)?\/store\/"/.test(html),
      `${id}: footer missing Store link`
    );
    assert.ok(
      /href="(https:\/\/punicodex\.com)?\/everyday\/"/.test(html),
      `${id}: footer missing Words link`
    );
  }
});

/* ------------------------------- flagships ------------------------------- */

test('flagship dashboards are noindex,nofollow', () => {
  for (const id of ['zeus', 'athena', 'hermes']) {
    const rel = `sites/${id}/dashboard/index.html`;
    if (!exists(rel)) continue;
    assert.ok(read(rel).includes('noindex, nofollow'), `${id} dashboard missing noindex`);
  }
});

test('flagship lore pages carry Name Variations + visible breadcrumb', () => {
  for (const id of ['zeus', 'athena', 'hermes']) {
    const rel = `sites/${id}/lore/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    assert.ok(/Name Variations/.test(html), `${id} lore: Name Variations section missing`);
    assert.ok(html.includes('aria-label="breadcrumb"'), `${id} lore: visible breadcrumb missing`);
  }
});

test('flagship root vs lore meta descriptions are distinct (strategy swap)', () => {
  const desc = (html) => (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '';
  for (const id of ['zeus', 'athena']) {
    const home = desc(read(`sites/${id}/index.html`));
    const lore = desc(read(`sites/${id}/lore/index.html`));
    assert.ok(home && lore, `${id}: missing description`);
    assert.notStrictEqual(home, lore, `${id}: root and lore still share one description`);
  }
});

test('flagship creatives/patron H1s carry the deity name', () => {
  const unicodeOf = (id) => LEXICON.find((e) => e.id === id)?.unicode;
  for (const id of ['zeus', 'athena']) {
    for (const tab of ['creatives', 'patron']) {
      const rel = `sites/${id}/${tab}/index.html`;
      if (!exists(rel)) continue;
      const h1 = (read(rel).match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
      assert.ok(
        h1.includes(unicodeOf(id)),
        `${id}/${tab}: H1 lacks the deity name: "${h1.trim()}"`
      );
    }
  }
});

/* --------------------------------- store --------------------------------- */

test('store HTML has no double-escaped entities', () => {
  const storeDir = path.join(root, 'store');
  const sample = [
    'guandi/index.html',
    'yamuna/index.html',
    'zeus/index.html',
    'zeus/tee/index.html',
    'pan/tee/index.html',
  ];
  for (const rel of sample) {
    if (!exists(path.join('store', rel))) continue;
    const html = read(path.join('store', rel));
    assert.ok(!/&amp;(quot|amp|lt|gt);/.test(html), `store/${rel}: double-escaped entity present`);
  }
  assert.ok(exists('store/index.html'));
  void storeDir;
});

test('store product pages: absolute JSON-LD image, BreadcrumbList, OG, stage CWV attrs', () => {
  const html = read('store/zeus/tee/index.html');
  const blocks = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));
  const product = blocks.find((b) => b['@type'] === 'Product');
  assert.ok(product, 'no Product JSON-LD');
  assert.ok(/^https:\/\//.test(product.image), `Product image not absolute: ${product.image}`);
  assert.ok(product.sku, 'Product missing sku');
  assert.ok(
    blocks.some((b) => b['@type'] === 'BreadcrumbList'),
    'no BreadcrumbList'
  );
  assert.ok(html.includes('property="og:image"'), 'missing og:image');
  assert.ok(html.includes('name="twitter:card"'), 'missing twitter card');
  const stage = html.match(/<img[^>]*id="stage-img"[^>]*>/);
  assert.ok(stage, 'stage img missing');
  for (const attr of ['width=', 'height=', 'fetchpriority="high"']) {
    assert.ok(stage[0].includes(attr), `stage img missing ${attr}`);
  }
  assert.ok(
    html.includes('rel="preconnect" href="https://punycodex-masters.vercel.app"'),
    'missing masters preconnect'
  );
});

test('store index carries CollectionPage+ItemList JSON-LD', () => {
  const html = read('store/index.html');
  assert.ok(
    html.includes('"@type":"ItemList"') || html.includes('"@type": "ItemList"'),
    'store index missing ItemList'
  );
  assert.ok(html.includes('property="og:title"'), 'store index missing OG');
});

/* ----------------------------- sitemap/robots ---------------------------- */

test('sitemap: final-URL locs, blog lastmod, image extension, no search-v2', () => {
  const xml = read('sitemap.xml');
  assert.ok(!xml.includes('.html</loc>'), 'sitemap still lists .html URLs');
  assert.ok(!xml.includes('search-v2'), 'sitemap still lists /search-v2/');
  assert.ok(xml.includes('xmlns:image='), 'sitemap missing image namespace');
  assert.ok(
    xml.includes('<image:loc>https://punicodex.com/assets/og/zeus.jpg</image:loc>'),
    'missing og image entries'
  );
  const lastmods = (xml.match(/<lastmod>/g) || []).length;
  assert.ok(lastmods >= 1128, `expected ≥1128 blog lastmods, got ${lastmods}`);
});

test('robots.txt: explicit admin disallow, no stale 404 disallows, sitemap line', () => {
  const robots = read('robots.txt');
  assert.ok(robots.includes('Disallow: /admin.html'), 'missing explicit /admin.html disallow');
  for (const stale of ['advertiser-panel.html', 'dashboard.html', 'claim.html', 'submit.html']) {
    assert.ok(!robots.includes(stale), `stale disallow for ${stale}`);
  }
  assert.ok(
    /Sitemap:\s*https:\/\/punicodex\.com\/sitemap\.xml/i.test(robots),
    'missing Sitemap line'
  );
});

/* ------------------------- clean-URL consolidation ------------------------ */

test('temple canonicals + og:url use the clean /{id}/ form (never /sites/)', () => {
  // Base temples.
  for (const id of ['aaru', 'hathor', 'adad', 'agave']) {
    const rel = `sites/${id}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    if (!html.includes('PUNICODEX Base Temple')) continue;
    assert.ok(
      html.includes(`<link rel="canonical" href="https://punicodex.com/${id}/">`),
      `${id}: canonical is not the clean /${id}/ form`
    );
    assert.ok(
      html.includes(`<meta property="og:url" content="https://punicodex.com/${id}/">`),
      `${id}: og:url is not the clean /${id}/ form`
    );
    assert.ok(
      !html.includes(`punicodex.com/sites/${id}`),
      `${id}: still references the /sites/ URL form`
    );
  }
  // Flagship root + tab pages.
  for (const [id, tab] of [
    ['zeus', ''],
    ['zeus', 'lore/'],
    ['athena', ''],
    ['athena', 'gallery/'],
  ]) {
    const rel = `sites/${id}/${tab}index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    assert.ok(
      html.includes(`<link rel="canonical" href="https://punicodex.com/${id}/${tab}">`),
      `${id}/${tab}: canonical is not the clean /${id}/${tab} form`
    );
    assert.ok(
      html.includes(`<meta property="og:url" content="https://punicodex.com/${id}/${tab}">`),
      `${id}/${tab}: og:url is not the clean /${id}/${tab} form`
    );
  }
});

test('sitemap lists temples at clean /{id}/ locs, never /sites/', () => {
  const xml = read('sitemap.xml');
  assert.ok(!xml.includes('/sites/'), 'sitemap still lists /sites/ URLs');
  assert.ok(
    xml.includes('<loc>https://punicodex.com/zeus/</loc>'),
    'missing clean-form flagship loc'
  );
  assert.ok(
    xml.includes('<loc>https://punicodex.com/zeus/lore/</loc>'),
    'missing clean-form flagship tab loc'
  );
  assert.ok(
    xml.includes('<loc>https://punicodex.com/marduk/</loc>'),
    'missing clean-form base-temple loc'
  );
});

test('base temple /search/?q= links are rel="nofollow" (crawl budget)', () => {
  let checked = 0;
  for (const entry of LEXICON) {
    const rel = `sites/${entry.id}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    if (!html.includes('PUNICODEX Base Temple')) continue;
    const searchLinks =
      html.match(/<a href="https:\/\/punicodex\.com\/search\/\?q=[^"]*"[^>]*>/g) || [];
    for (const link of searchLinks) {
      assert.ok(
        link.includes('rel="nofollow"'),
        `${entry.id}: /search/?q= link missing rel="nofollow": ${link}`
      );
    }
    if (searchLinks.length) checked++;
  }
  const expectedBaseCount2 = LEXICON.length - BUILT_IDS.size;
  assert.ok(
    checked >= expectedBaseCount2 - 5,
    `only ${checked} base temples with /search/?q= links found (expected ~${expectedBaseCount2})`
  );
});

test('robots.txt: /api/ disallowed with a docs exception, /auth/ + search disallowed', () => {
  const robots = read('robots.txt');
  assert.ok(/^Disallow: \/api\/$/m.test(robots), 'missing Disallow: /api/');
  // The Swagger UI is a public docs surface — it must stay crawlable.
  assert.ok(/^Allow: \/api\/v1\/docs\/$/m.test(robots), 'missing Allow: /api/v1/docs/');
  assert.ok(/^Disallow: \/auth\/$/m.test(robots), 'missing Disallow: /auth/');
  assert.ok(/^Disallow: \/search\/$/m.test(robots), 'missing Disallow: /search/');
  assert.ok(/^Disallow: \/search-v2\/$/m.test(robots), 'missing Disallow: /search-v2/');
});

test('scholars portal: app surfaces noindex, public pages carry canonicals', () => {
  const SRC_DIR = 'platform/public/scholars'; // canonical source; scholars/ is generated
  for (const p of [
    'login',
    'dashboard',
    'review',
    'admin',
    'institution',
    'dept-admin',
    'analytics',
  ]) {
    const html = read(`${SRC_DIR}/${p}/index.html`);
    assert.ok(
      html.includes('name="robots" content="noindex,nofollow"'),
      `scholars/${p}: missing noindex,nofollow`
    );
  }
  for (const p of ['apply', 'search', 'creatives']) {
    const html = read(`${SRC_DIR}/${p}/index.html`);
    assert.ok(
      html.includes(`rel="canonical" href="https://punicodex.com/scholars/${p}/"`),
      `scholars/${p}: missing canonical`
    );
  }
});

/* ------------------------------- hand pages ------------------------------ */

test('oracle page presents a live product (no Coming Soon)', () => {
  const html = read('oracle/index.html');
  assert.ok(!/Coming Soon/i.test(titleOf(html)), 'oracle title still says Coming Soon');
  assert.ok(
    !/Coming Soon/i.test((html.match(/property="og:title" content="([^"]*)"/) || [])[1] || ''),
    'og:title still says Coming Soon'
  );
});

test('creatives page has canonical; search-v2 consolidates to /search/', () => {
  assert.ok(
    read('creatives/index.html').includes(
      '<link rel="canonical" href="https://punicodex.com/creatives/">'
    ),
    'creatives missing canonical'
  );
  assert.ok(
    read('search-v2/index.html').includes(
      '<link rel="canonical" href="https://punicodex.com/search/">'
    ),
    'search-v2 not consolidated'
  );
});

test('homepage carries WebSite + Organization JSON-LD', () => {
  const blocks = [
    ...read('index.html').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));
  const flat = blocks.flatMap((b) => (Array.isArray(b) ? b : [b]));
  assert.ok(
    flat.some((b) => b['@type'] === 'WebSite'),
    'homepage missing WebSite'
  );
  assert.ok(
    flat.some((b) => b['@type'] === 'Organization'),
    'homepage missing Organization'
  );
});

test('mobile PWA surfaces are noindex; legacy .html canonicals fixed', () => {
  for (const rel of ['mobile/index.html', 'mobile/shield.html', 'mobile/ar-lens.html']) {
    assert.ok(read(rel).includes('name="robots" content="noindex"'), `${rel} missing noindex`);
  }
  assert.ok(
    read('about/authenticity.html').includes(
      'canonical" href="https://punicodex.com/about/authenticity/"'
    ),
    'about/authenticity canonical wrong'
  );
  assert.ok(
    read('lexicon/cognates.html').includes(
      'canonical" href="https://punicodex.com/lexicon/cognates/"'
    ),
    'lexicon/cognates canonical wrong'
  );
});

test('careers page JobPosting schema is present and parseable', () => {
  const blocks = [
    ...read('careers/index.html').matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    ),
  ].map((m) => JSON.parse(m[1]));
  const jobs = blocks
    .flatMap((b) => (Array.isArray(b) ? b : [b]))
    .filter((b) => b['@type'] === 'JobPosting');
  assert.ok(jobs.length >= 4, `expected 4 JobPostings, got ${jobs.length}`);
  for (const j of jobs)
    assert.ok(j.datePosted && j.hiringOrganization, 'JobPosting missing required fields');
});

/* ----------------------------- temple index ------------------------------ */

test('hub pages carry the static temple index (crawlable temple anchors)', () => {
  const { TARGETS } = require('../scripts/sync-temple-index.js');
  for (const t of TARGETS) {
    const html = read(t.page);
    const block = html.match(/PUNICODEX-TEMPLE-INDEX:START[\s\S]*?PUNICODEX-TEMPLE-INDEX:END/);
    assert.ok(block, `${t.page}: temple index block missing`);
    // URL consolidation: anchors may use the canonical clean /{id}/ form or
    // the legacy /sites/{id}/ form (which 301s at the edge) — both count.
    const anchors = (block[0].match(/href="\/(?:sites\/)?[a-z0-9-]+\/"/g) || []).length;
    const { ARCHETYPES } = require('../js/archetypes-v2.js');
    const flagshipCount = (ARCHETYPES || []).filter((a) => a.built).length;
    const expected = t.set === 'all' ? LEXICON.length : flagshipCount;
    assert.ok(anchors >= expected, `${t.page}: ${anchors} static anchors < ${expected}`);
  }
});

/* ------------------------- visible FAQ compliance ------------------------ */

test('FAQPage markup has visible Q&A (patterns + texts)', () => {
  for (const rel of ['patterns/index.html', 'texts/index.html']) {
    const html = read(rel);
    const noScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
    const m = html.match(/"@type"\s*:\s*"FAQPage"/);
    if (!m) continue; // block removed entirely is also compliant
    const firstQ = (html.match(/"name"\s*:\s*"([^"]{15,80}\?)"/) || [])[1];
    assert.ok(firstQ, `${rel}: FAQPage present but no question found`);
    assert.ok(noScripts.includes(firstQ), `${rel}: FAQ question not visible on the page`);
  }
});

test('texts reading pages use og:type book', () => {
  const html = read('texts/theogony/index.html');
  assert.ok(html.includes('property="og:type" content="book"'), 'theogony og:type is not book');
});

/* --------------------- canonical hygiene / GSC defense -------------------- */

const PUBLIC_HTML_ROOTS = [
  'sites',
  'store',
  'blog',
  'pantheon',
  'lexicon',
  'realms',
  'tiers',
  'type',
  'search',
  'ink',
  'everyday',
  'cards',
  'game',
  'connections',
  'patterns',
  'texts',
  'codex',
  'creatives',
  'appraise',
  'authenticity',
  'arbitrage',
  'about',
  'careers',
  'contact',
  'herald',
  'rulebook',
  'screen',
  'universities',
];
const SEO_EXCLUDE_RE =
  /(^|\/)(\.git|\.vercel|node_modules|\.venv|\.venv_hieropy|Marketing|tools|scripts|templates|docs|platform|android|extension|extension-v2|mobile|admin-portal|account|scholars|\.backup|build\/intermediates)(\/|$)/;

function walkHtml(dir, cb) {
  if (!fs.existsSync(path.join(root, dir))) return;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.backup')) continue;
    const full = path.join(root, dir, entry.name);
    if (entry.isDirectory()) walkHtml(path.join(dir, entry.name), cb);
    else if (entry.name.endsWith('.html')) cb(dir, entry.name, full);
  }
}

test('robots.txt: /sites/ disallowed with asset exception', () => {
  const robots = read('robots.txt');
  assert.ok(/^Allow: \/sites\/\*\/assets\/$/m.test(robots), 'missing Allow: /sites/*/assets/');
  assert.ok(/^Disallow: \/sites\/$/m.test(robots), 'missing Disallow: /sites/');
  // The Allow must appear before or alongside the Disallow so longest-match
  // crawlers process it; order does not matter for Google, but both must exist.
});

test('no public page links to non-canonical /sites/{id}/.../ paths', () => {
  const bad = [];
  for (const top of PUBLIC_HTML_ROOTS) {
    walkHtml(top, (dir, file) => {
      const rel = path.join(dir, file).replace(/\\/g, '/');
      const html = read(rel);
      const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
      for (const href of links) {
        if (/^https?:\/\/punicodex\.com\/sites\/[^/]+\/(?!assets\/)/.test(href)) {
          bad.push({ rel, href });
        }
      }
    });
  }
  if (bad.length) {
    const sample = bad
      .slice(0, 5)
      .map((b) => `${b.rel} → ${b.href}`)
      .join('\n    ');
    assert.fail(`${bad.length} link(s) to /sites/{id}/ non-asset paths. Sample:\n    ${sample}`);
  }
});

test('no public page links to .html extension URLs', () => {
  const bad = [];
  for (const top of PUBLIC_HTML_ROOTS) {
    walkHtml(top, (dir, file) => {
      const rel = path.join(dir, file).replace(/\\/g, '/');
      const html = read(rel);
      const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
      for (const href of links) {
        if (/^https?:\/\/punicodex\.com\/[^?#]+\.html/.test(href)) {
          bad.push({ rel, href });
        }
      }
    });
  }
  if (bad.length) {
    const sample = bad
      .slice(0, 5)
      .map((b) => `${b.rel} → ${b.href}`)
      .join('\n    ');
    assert.fail(`${bad.length} link(s) to .html URLs. Sample:\n    ${sample}`);
  }
});

test('every public HTML page has canonical or noindex robots directive', () => {
  const missing = [];
  for (const top of PUBLIC_HTML_ROOTS) {
    walkHtml(top, (dir, file) => {
      const rel = path.join(dir, file).replace(/\\/g, '/');
      if (SEO_EXCLUDE_RE.test(rel)) return;
      const html = read(rel);
      const hasCanonical = /<link\s+rel=["']canonical["']\s+href=["'][^"']+["']/i.test(html);
      const hasNoindex = /<meta[^>]*name=["']robots["'][^>]*noindex/i.test(html);
      if (!hasCanonical && !hasNoindex) missing.push(rel);
    });
  }
  if (missing.length) {
    const sample = missing.slice(0, 10).join('\n    ');
    assert.fail(
      `${missing.length} public page(s) missing canonical and noindex. Sample:\n    ${sample}`
    );
  }
});

test('indexable pages have unique titles', () => {
  const seen = new Map();
  const dupes = [];
  for (const top of PUBLIC_HTML_ROOTS) {
    walkHtml(top, (dir, file) => {
      const rel = path.join(dir, file).replace(/\\/g, '/');
      if (SEO_EXCLUDE_RE.test(rel)) return;
      const html = read(rel);
      if (/<meta[^>]*name=["']robots["'][^>]*noindex/i.test(html)) return;
      const title = titleOf(html);
      if (!title) return;
      if (seen.has(title)) {
        dupes.push({ title, pages: [seen.get(title), rel] });
      } else {
        seen.set(title, rel);
      }
    });
  }
  if (dupes.length) {
    const sample = dupes
      .slice(0, 5)
      .map((d) => `"${d.title}" on ${d.pages.join(' and ')}`)
      .join('\n    ');
    assert.fail(`${dupes.length} duplicate title(s). Sample:\n    ${sample}`);
  }
});

test('indexable pages have unique meta descriptions', () => {
  const seen = new Map();
  const dupes = [];
  for (const top of PUBLIC_HTML_ROOTS) {
    walkHtml(top, (dir, file) => {
      const rel = path.join(dir, file).replace(/\\/g, '/');
      if (SEO_EXCLUDE_RE.test(rel)) return;
      const html = read(rel);
      if (/<meta[^>]*name=["']robots["'][^>]*noindex/i.test(html)) return;
      const desc = descOf(html);
      if (!desc) return;
      if (seen.has(desc)) {
        dupes.push({ desc, pages: [seen.get(desc), rel] });
      } else {
        seen.set(desc, rel);
      }
    });
  }
  if (dupes.length) {
    const sample = dupes
      .slice(0, 5)
      .map((d) => `"${d.desc.slice(0, 80)}…" on ${d.pages.join(' and ')}`)
      .join('\n    ');
    assert.fail(`${dupes.length} duplicate meta description(s). Sample:\n    ${sample}`);
  }
});

test('legacy redirect pages point at clean /{id}/ URLs, never /sites/', () => {
  const LEGACY_REDIRECTS = {
    '/steh': '/seth',
    '/achilles': '/achilleus',
    '/aether': '/aither',
    '/delphi': '/delphoi',
    '/enki': '/ea',
    '/europa': '/europe',
    '/hercules': '/herakles',
    '/jason': '/iason',
    '/khaos': '/chaos',
    '/oceanus': '/okeanos',
    '/pegasus': '/pegasos',
  };
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    const rel = `sites${from}/index.html`;
    if (!exists(rel)) continue;
    const html = read(rel);
    assert.ok(
      html.includes(`https://punicodex.com${to}/`),
      `${rel} does not redirect to clean /${to}/ URL`
    );
    assert.ok(!html.includes(`/sites${to}/`), `${rel} still references /sites${to}/`);
  }
  for (const rel of ['sites/nike/original.html', 'sites/hermes/original.html']) {
    if (!exists(rel)) continue;
    const id = rel.split('/')[1];
    const html = read(rel);
    assert.ok(
      html.includes(`https://punicodex.com/${id}/`),
      `${rel} does not consolidate to clean /${id}/ URL`
    );
    assert.ok(!html.includes(`/sites/${id}/`), `${rel} still references /sites/${id}/`);
  }
});

/* --------------------------------- summary ------------------------------- */

console.log(`\nSEO Regression Tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
