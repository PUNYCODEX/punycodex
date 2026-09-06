#!/usr/bin/env node
/**
 * PuniCodex — Movie / Screen Guide generator (Phase B).
 *
 * Sources of truth:
 *   - data/screen-index.json (productions)
 *   - type/js/lexicon.js (entry names)
 *   - type/js/pantheon-meta.js (pantheon labels)
 *
 * Outputs:
 *   - /screen/index.html — hub page with all productions grouped by pantheon
 *   - /screen/{id}/index.html — one detail page per production
 *
 * Uses the canonical nav / mobile-menu / footer builders.
 * Idempotent and byte-deterministic for unchanged inputs.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const { LEXICON } = require(path.join(ROOT, 'type', 'js', 'lexicon.js'));
const { PANTHEON_META } = require(path.join(ROOT, 'type', 'js', 'pantheon-meta.js'));

const { fullNavHtml } = require('./sync-desktop-nav.js');
const { menuForPage } = require('./sync-mobile-menu.js');
const { footerHtml } = require('./sync-footer.js');
const { writeFileWithRetry } = require('./write-file-retry.js');

const BASE_URL = 'https://punicodex.com';
const OG_IMAGE = `${BASE_URL}/assets/images/og-default.png`;

const SCHEMA_BY_TYPE = {
  film: 'Movie',
  series: 'TVSeries',
  animation: 'Movie',
  game: 'VideoGame',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const lexiconById = new Map(LEXICON.map((e) => [e.id, e]));

function entryName(entryId) {
  const entry = lexiconById.get(entryId);
  return entry ? (entry.unicode || entry.ascii || entry.id) : null;
}

function pantheonLabel(pantheonId) {
  const meta = PANTHEON_META[pantheonId];
  return meta ? (meta.label || meta.proseLabel || pantheonId) : pantheonId;
}

function typeLabel(type) {
  if (type === 'film') return 'Film';
  if (type === 'series') return 'Series';
  if (type === 'animation') return 'Animation';
  if (type === 'game') return 'Game';
  return type;
}

function productionUrl(production) {
  return `${BASE_URL}/screen/${production.id}/`;
}

function templeUrl(entryId) {
  return `${BASE_URL}/${entryId}/`;
}

function detailJsonLd(production, cast) {
  const type = SCHEMA_BY_TYPE[production.type] || 'Movie';
  const data = {
    '@context': 'https://schema.org',
    '@type': type,
    name: production.title,
    url: productionUrl(production),
    description: production.summary,
    datePublished: production.year ? String(production.year) : undefined,
    productionCompany: production.studio || undefined,
    character: cast.map((entry) => ({
      '@type': 'Character',
      name: entry.name,
      url: templeUrl(entry.id),
    })),
  };
  if (!data.datePublished) delete data.datePublished;
  if (!data.productionCompany) delete data.productionCompany;
  return JSON.stringify(data, null, 2);
}

function breadcrumbJsonLd(production, isDetail) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${BASE_URL}/`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Screen Guide',
      item: `${BASE_URL}/screen/`,
    },
  ];
  if (isDetail) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: production.title,
      item: productionUrl(production),
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }, null, 2);
}

function hubJsonLd(productions) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Screen Guide — Mythology in Film, TV & Games — PuniCodex',
    description:
      'A curated guide to films, series, animations, and games that draw on mythological names restored by PuniCodex.',
    url: `${BASE_URL}/screen/`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'PuniCodex',
      url: BASE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: productions.length,
      itemListElement: productions.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.title,
        url: productionUrl(p),
      })),
    },
  };
  return JSON.stringify(data, null, 2);
}

function headHtml({ title, description, canonical, ldJson = [] }) {
  const ldBlocks = ldJson.map((json) => `    <script type="application/ld+json">
    ${json}
    </script>`).join('\n');
  return `<!DOCTYPE html>
<!-- GENERATED FILE — do not edit by hand. Regenerate with: node scripts/generate-screen-guide.js -->
<html lang="en">
<head>
<!-- PUNICODEX-ANALYTICS-START -->
<script src="/js/analytics-beacon.js?v=1" defer></script>
<!-- PUNICODEX-ANALYTICS-END -->

    <meta charset="UTF-8">
    <meta name="google" content="notranslate">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#050505">
    <meta name="color-scheme" content="dark">
    <link rel="canonical" href="${canonical}">

    <!-- Open Graph -->
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${OG_IMAGE}">
    <meta name="twitter:image" content="${OG_IMAGE}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="PuniCodex">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">

    <!-- Schema.org -->
${ldBlocks}

    <link rel="icon" type="image/svg+xml" href="/assets/brand/02-favicons/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/02-favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/brand/02-favicons/favicon-16x16.png">
    <link rel="icon" href="/assets/brand/02-favicons/favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="/assets/brand/02-favicons/apple-touch-icon.png">
    <link rel="mask-icon" href="/assets/brand/02-favicons/mask-icon.svg" color="#D4AF37">
    <link rel="manifest" href="/assets/brand/06-code/site.webmanifest">

    <link rel="stylesheet" href="/assets/fonts/fonts.css">
    <link rel="stylesheet" href="/css/main.css?v=perf25">
    <link rel="stylesheet" href="/css/screen-guide.css?v=1">
</head>`;
}

function productionCardHtml(production) {
  const typeBadge = `<span class="sg-tag sg-tag--type">${escapeHtml(typeLabel(production.type))}</span>`;
  const yearTag = production.year ? `<span class="sg-tag">${escapeHtml(String(production.year))}</span>` : '';
  const pantheonTags = production.pantheons
    .map((p) => `<span class="sg-tag">${escapeHtml(pantheonLabel(p))}</span>`)
    .join('');
  return `<a class="sg-card" href="/screen/${production.id}/">
                <div class="sg-card-body">
                    <h3 class="sg-card-title">${escapeHtml(production.title)}</h3>
                    <p class="sg-card-meta">${escapeHtml(production.studio || '')}</p>
                    <p class="sg-card-summary">${escapeHtml(production.summary)}</p>
                    <div class="sg-card-tags">
                        ${typeBadge}
                        ${yearTag}
                        ${pantheonTags}
                    </div>
                </div>
            </a>`;
}

function castCardHtml(entry) {
  return `<a class="sg-cast-link" href="/${entry.id}/">
                    <p class="sg-cast-name">${escapeHtml(entry.name)}</p>
                    <p class="sg-cast-pantheon">${escapeHtml(pantheonLabel(entry.pantheon))}</p>
                </a>`;
}

function relatedCardHtml(production) {
  return `<a class="sg-related-link" href="/screen/${production.id}/">
                    <h4 class="sg-related-title">${escapeHtml(production.title)}</h4>
                    <p class="sg-related-meta">${escapeHtml(typeLabel(production.type))} · ${escapeHtml(String(production.year || 'Unknown'))}</p>
                </a>`;
}

function productionsByPantheon(productions) {
  const map = new Map();
  for (const production of productions) {
    for (const pantheonId of production.pantheons) {
      if (!map.has(pantheonId)) map.set(pantheonId, []);
      map.get(pantheonId).push(production);
    }
  }
  return map;
}

function hubPageHtml(productions) {
  const title = 'Screen Guide — Mythology in Film, TV & Games — PuniCodex';
  const description =
    'A curated guide to films, series, animations, and games that draw on the mythological names restored by PuniCodex.';
  const canonical = `${BASE_URL}/screen/`;
  const byPantheon = productionsByPantheon(productions);
  const sortedPantheonIds = Array.from(byPantheon.keys()).sort((a, b) => a.localeCompare(b));

  const groupsHtml = sortedPantheonIds
    .map((pantheonId) => {
      const label = pantheonLabel(pantheonId);
      const groupProductions = byPantheon.get(pantheonId).sort((a, b) => a.title.localeCompare(b.title));
      return `        <section class="sg-section" data-pantheon="${escapeHtml(pantheonId)}">
            <div class="container">
                <div class="sg-section-header">
                    <h2 class="sg-section-title">${escapeHtml(label)}</h2>
                    <p class="sg-section-subtitle">${groupProductions.length} production${groupProductions.length === 1 ? '' : 's'}</p>
                </div>
                <div class="sg-grid">
${groupProductions.map(productionCardHtml).join('\n')}
                </div>
            </div>
        </section>`;
    })
    .join('\n\n');

  const types = ['film', 'series', 'animation', 'game'];
  const filterButtons = types
    .map(
      (type) =>
        `                <button class="sg-filter" data-filter="${type}" aria-pressed="false">${escapeHtml(typeLabel(type))}</button>`
    )
    .join('\n');

  const allProductionsGrid = `            <div class="sg-grid" id="sg-production-grid">
${productions.map(productionCardHtml).join('\n')}
            </div>`;

  return `${headHtml({
    title,
    description,
    canonical,
    ldJson: [hubJsonLd(productions), breadcrumbJsonLd(null, false)],
  })}
<body>

    ${fullNavHtml('/screen/')}

    ${menuForPage('/screen/')}

    <main class="page-screen-guide">
        <section class="sg-hero">
            <div class="sg-hero-overlay">
                <div class="container">
                    <p class="sg-eyebrow">Screen Guide</p>
                    <h1 class="sg-hero-title">Mythology in Film, TV & Games</h1>
                    <p class="sg-hero-lead">A curated guide to productions that borrow names, stories, and imagery from the mythological traditions restored across PuniCodex.</p>
                </div>
            </div>
        </section>

        <div class="sg-toolbar">
            <div class="sg-toolbar-inner">
                <input class="sg-search" type="search" id="sg-search" placeholder="Search productions…" aria-label="Search productions">
                <div class="sg-filters" role="group" aria-label="Filter by type">
                    <button class="sg-filter" data-filter="all" aria-pressed="true">All</button>
${filterButtons}
                </div>
            </div>
        </div>

        <section class="sg-section" id="sg-all-productions">
            <div class="container">
                <div class="sg-section-header">
                    <h2 class="sg-section-title">All productions</h2>
                    <p class="sg-section-subtitle">${productions.length} film, series, animation, and game entries linked to restored names.</p>
                </div>
${allProductionsGrid}
            </div>
        </section>

${groupsHtml}
    </main>

    ${footerHtml()}

    <script src="/js/px-core.js?v=perf21" defer></script>
    <script src="/js/main.js?v=perf20" defer></script>
    <script>
    (function () {
      const grid = document.getElementById('sg-production-grid');
      const cards = grid ? Array.from(grid.querySelectorAll('.sg-card')) : [];
      const search = document.getElementById('sg-search');
      const buttons = document.querySelectorAll('.sg-filter');
      let activeFilter = 'all';
      let query = '';

      function apply() {
        const q = query.trim().toLowerCase();
        cards.forEach(function (card) {
          const text = card.textContent.toLowerCase();
          const type = card.dataset.type || '';
          const matchesQuery = !q || text.includes(q);
          const matchesFilter = activeFilter === 'all' || type === activeFilter;
          card.style.display = matchesQuery && matchesFilter ? '' : 'none';
        });
      }

      if (search) {
        search.addEventListener('input', function () {
          query = search.value;
          apply();
        });
      }

      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeFilter = btn.dataset.filter || 'all';
          buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
          apply();
        });
      });

      cards.forEach(function (card) {
        const typeBadge = card.querySelector('.sg-tag--type');
        if (typeBadge) card.dataset.type = typeBadge.textContent.toLowerCase();
      });
    })();
    </script>
</body>
</html>
`;
}

function detailPageHtml(production, allProductions) {
  const yearLabel = production.year ? ` (${production.year})` : '';
  const title = `${production.title}${yearLabel} — Screen Guide — PuniCodex`;
  const description = `${production.summary} (${production.year || 'Unknown'}, ${typeLabel(production.type)}).`;
  const canonical = productionUrl(production);

  const unresolved = [];
  const cast = [];
  for (const entryId of production.entries) {
    const name = entryName(entryId);
    const entry = lexiconById.get(entryId);
    if (!name || !entry) {
      unresolved.push(entryId);
      continue;
    }
    cast.push({ id: entryId, name, pantheon: entry.pantheon || 'unknown' });
  }

  const related = allProductions
    .filter((p) => p.id !== production.id && p.pantheons.some((pantheon) => production.pantheons.includes(pantheon)))
    .sort((a, b) => a.title.localeCompare(b.title));

  const castGrid = cast.length
    ? `                <div class="sg-cast-grid">
${cast.map(castCardHtml).join('\n')}
                </div>`
    : `                <p class="sg-section-subtitle">No mythological cast members resolved.</p>`;

  const relatedList = related.length
    ? `                <div class="sg-related-list">
${related.map(relatedCardHtml).join('\n')}
                </div>`
    : `                <p class="sg-section-subtitle">No related productions in the guide yet.</p>`;

  const typeBadge = production.type
    ? `<span class="sg-tag sg-tag--type">${escapeHtml(typeLabel(production.type))}</span>`
    : '';
  const pantheonTags = production.pantheons
    .map((p) => `<span class="sg-tag">${escapeHtml(pantheonLabel(p))}</span>`)
    .join(' ');

  return `${headHtml({
    title,
    description,
    canonical,
    ldJson: [detailJsonLd(production, cast), breadcrumbJsonLd(production, true)],
  })}
<body>

    ${fullNavHtml('/screen/')}

    ${menuForPage('/screen/')}

    <main class="page-screen-detail" data-production="${escapeHtml(production.id)}">
        <section class="sg-detail-hero">
            <div class="sg-detail-inner">
                <p class="sg-eyebrow">Screen Guide</p>
                <h1 class="sg-hero-title">${escapeHtml(production.title)}</h1>
                <div class="sg-detail-meta">
                    ${typeBadge}
                    ${pantheonTags ? `<span class="sg-detail-year">${pantheonTags}</span>` : ''}
                    ${production.year ? `<span class="sg-detail-year">${escapeHtml(String(production.year))}</span>` : ''}
                    ${production.studio ? `<span class="sg-detail-studio">${escapeHtml(production.studio)}</span>` : ''}
                </div>
                <p class="sg-detail-summary">${escapeHtml(production.summary)}</p>
            </div>
        </section>

        <section class="sg-section">
            <div class="container">
                <div class="sg-section-header">
                    <h2 class="sg-section-title">Mythological cast</h2>
                    <p class="sg-section-subtitle">Restored names appearing in or inspiring this production.</p>
                </div>
${castGrid}
            </div>
        </section>

        <section class="sg-section">
            <div class="container">
                <div class="sg-section-header">
                    <h2 class="sg-section-title">Related productions</h2>
                    <p class="sg-section-subtitle">Other Screen Guide entries sharing a pantheon.</p>
                </div>
${relatedList}
                <a class="sg-back" href="/screen/" aria-label="Back to Screen Guide">← Back to Screen Guide</a>
            </div>
        </section>
    </main>

    ${footerHtml()}

    <script src="/js/px-core.js?v=perf21" defer></script>
    <script src="/js/main.js?v=perf20" defer></script>
</body>
</html>
`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'screen-index.json'), 'utf8'));
  const productions = (data.productions || []).slice();

  // Validate all entries resolve before generating.
  const unresolved = [];
  for (const production of productions) {
    for (const entryId of production.entries || []) {
      if (!lexiconById.has(entryId)) {
        unresolved.push({ production: production.id, entryId });
      }
    }
  }

  if (unresolved.length) {
    for (const { production, entryId } of unresolved) {
      console.warn(`Unresolved lexicon id "${entryId}" in production "${production}"`);
    }
  }

  // Generate hub.
  const screenDir = path.join(ROOT, 'screen');
  fs.mkdirSync(screenDir, { recursive: true });
  const hubHtml = hubPageHtml(productions);
  writeFileWithRetry(path.join(screenDir, 'index.html'), hubHtml, 'utf8');

  // Generate detail pages.
  let generated = 1;
  for (const production of productions) {
    const detailDir = path.join(screenDir, production.id);
    fs.mkdirSync(detailDir, { recursive: true });
    const detailHtml = detailPageHtml(production, productions);
    writeFileWithRetry(path.join(detailDir, 'index.html'), detailHtml, 'utf8');
    generated++;
  }

  console.log(`Screen guide generated: ${generated} pages (${productions.length} productions).`);
  if (unresolved.length) {
    console.warn(`Unresolved entries: ${unresolved.length}`);
  }
}

if (require.main === module) main();

module.exports = { hubPageHtml, detailPageHtml };
