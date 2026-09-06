#!/usr/bin/env node
/**
 * PuniCodex — Quarterly Unicode Herald generator
 *
 * Reads the canonical edition registry in data/herald-editions.json and the
 * templates in templates/herald/, then writes:
 *   - herald/index.html (publication landing page / cover)
 *   - herald/{editionId}/{chapter}/index.html (book chapters)
 *   - herald/{editionId}/book/index.html (complete print-ready edition, 1084+ pages)
 *
 * Usage:
 *   node scripts/generate-herald.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const EDITIONS_PATH = path.join(ROOT, 'data', 'herald-editions.json');
const TEMPLATES_DIR = path.join(ROOT, 'templates', 'herald');
const OUT_DIR = path.join(ROOT, 'herald');

const { mdToHtml, escapeHtml } = require('./lib/blog-render.js');

const archetypeSrc = fs.readFileSync(path.join(ROOT, 'js', 'archetypes-v2.js'), 'utf8');
const ARCHETYPES = vm.runInNewContext(
  `(function(){
${archetypeSrc}
return ARCHETYPES;
})()`
);
const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

const lexiconSrc = fs.readFileSync(path.join(ROOT, 'type', 'js', 'lexicon.js'), 'utf8');
const LEXICON = vm.runInNewContext(
  `(function(){
${lexiconSrc}
return LEXICON;
})()`
);
const LEXICON_BY_ID = new Map(LEXICON.map((e) => [e.id, e]));

const {
  getOriginalScript,
  getOriginalScriptLabel,
  getScriptName,
  getProvenance,
} = require(path.join(ROOT, 'type', 'js', 'original-scripts.js'));

let LORE_CATALOG = {};
try {
  LORE_CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'lore-catalog.json'), 'utf8'));
} catch {
  // lore catalog is optional for the herald
}

let GALLERY_DATA = {};
try {
  GALLERY_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'gallery-data.json'), 'utf8'));
} catch {
  // gallery data is optional for the herald
}

let INDUSTRY_PATTERNS = { byEntry: {} };
try {
  INDUSTRY_PATTERNS = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'platform', 'api', 'industry-patterns.json'), 'utf8')
  );
} catch {
  // patterns are optional
}

const PANTHEON_LABELS = {
  greek: 'Greek',
  'greek-location': 'Greek Location',
  norse: 'Norse',
  egyptian: 'Egyptian',
  sanskrit: 'Sanskrit',
  japanese: 'Japanese',
  nahuatl: 'Nahuatl',
  yoruba: 'Yoruba',
  chinese: 'Chinese',
  taoist: 'Daoist',
  mesopotamian: 'Mesopotamian',
  phoenician: 'Phoenician',
  canaanite: 'Canaanite',
  roman: 'Roman',
  polynesian: 'Polynesian',
  zoroastrian: 'Zoroastrian',
  incan: 'Incan',
  celtic: 'Celtic',
  buddhist: 'Buddhist',
  aboriginal: 'Aboriginal',
  slavic: 'Slavic',
  korean: 'Korean',
  hittite: 'Hittite',
  mapuche: 'Mapuche',
  baltic: 'Baltic',
};

const PANTHEON_THEMES = {
  greek: { accent: '#D4AF37', ink: '#f5f2e8', motif: 'marble & laurel' },
  'greek-location': { accent: '#D4AF37', ink: '#f5f2e8', motif: 'marble & olive' },
  norse: { accent: '#5F9EA0', ink: '#e8f5f5', motif: 'runestone & frost' },
  egyptian: { accent: '#228B22', ink: '#f0f5e8', motif: 'papyrus & gold' },
  sanskrit: { accent: '#FF8C00', ink: '#fff5e8', motif: 'saffron & flame' },
  japanese: { accent: '#DC143C', ink: '#fff0f2', motif: 'ink & vermillion' },
  nahuatl: { accent: '#8B4513', ink: '#f5ede8', motif: 'obsidian & feather' },
  yoruba: { accent: '#4B0082', ink: '#f3e8f5', motif: 'indigo & cowrie' },
  chinese: { accent: '#C41E3A', ink: '#fff0f2', motif: 'porcelain & cinnabar' },
  taoist: { accent: '#4682B4', ink: '#e8f4f5', motif: 'mist & scroll' },
  mesopotamian: { accent: '#8B4513', ink: '#f5ede8', motif: 'clay & lapis' },
  phoenician: { accent: '#800080', ink: '#f5e8f5', motif: 'purple & cedar' },
  canaanite: { accent: '#A0522D', ink: '#f5eee8', motif: 'bronze & terebinth' },
  roman: { accent: '#B22222', ink: '#fff0f0', motif: 'marble & eagle' },
  polynesian: { accent: '#20B2AA', ink: '#e8f5f4', motif: 'shell & ocean' },
  zoroastrian: { accent: '#FFD700', ink: '#fff9e8', motif: 'fire & sun' },
  incan: { accent: '#CD853F', ink: '#f5f0e8', motif: 'gold & mountain' },
  celtic: { accent: '#2E8B57', ink: '#e8f5ed', motif: 'knot & mistletoe' },
  buddhist: { accent: '#FF4500', ink: '#fff3e8', motif: 'lotus & prayer wheel' },
  aboriginal: { accent: '#B7410E', ink: '#f5ebe8', motif: 'ochre & songline' },
  slavic: { accent: '#4682B4', ink: '#e8f0f5', motif: 'birch & frost' },
  korean: { accent: '#C71585', ink: '#f5e8f0', motif: 'hanbok & magpie' },
  hittite: { accent: '#8B0000', ink: '#f5e8e8', motif: 'cuneiform & lion' },
  mapuche: { accent: '#556B2F', ink: '#eef5e8', motif: 'silver & mountain' },
  baltic: { accent: '#006400', ink: '#e8f5e8', motif: 'oak & amber' },
};

function fmtNumber(n) {
  return Number(n).toLocaleString('en-US');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function pantheonName(id) {
  return PANTHEON_LABELS[id] || id;
}

function mascotPath(id) {
  const archetype = ARCHETYPE_BY_ID.get(id);
  if (archetype?.mascotPath) return archetype.mascotPath;
  return `/sites/${id}/assets/mascot.png`;
}

function logomarkPath(id) {
  const archetype = ARCHETYPE_BY_ID.get(id);
  if (archetype?.logomarkPath) return archetype.logomarkPath;
  return `/sites/${id}/assets/logomark.webp`;
}

function wordmarkPath(id) {
  const archetype = ARCHETYPE_BY_ID.get(id);
  if (archetype?.wordmarkPath) return archetype.wordmarkPath;
  return `/sites/${id}/assets/${id}_logolockup.webp`;
}

function getOriginalScriptInfo(id) {
  const entry = LEXICON_BY_ID.get(id);
  if (!entry) return null;
  const script = getOriginalScript(entry);
  if (script) {
    return {
      script,
      name: getScriptName(entry),
      provenance: getProvenance(entry),
    };
  }
  return null;
}

function getPronunciation(id) {
  const lore = LORE_CATALOG[id];
  if (lore?.pronunciation) {
    return {
      ipa: lore.pronunciation.ipa,
      label: lore.pronunciation.ipaLabel || 'Scholarly reconstruction',
      approximation: lore.pronunciation.approximation || '',
    };
  }
  const entry = LEXICON_BY_ID.get(id);
  if (entry?.pronunciation?.ipa) {
    return {
      ipa: entry.pronunciation.ipa,
      label: entry.pronunciation.label || 'Pronunciation',
      approximation: entry.pronunciation.approximation || '',
    };
  }
  return null;
}

function getLoreLead(id) {
  const lore = LORE_CATALOG[id];
  if (lore?.domains?.lead) return lore.domains.lead;
  if (lore?.mythology?.lead) return lore.mythology.lead;
  const entry = LEXICON_BY_ID.get(id);
  const archetype = ARCHETYPE_BY_ID.get(id);
  if (entry && archetype) {
    return `<p class="lead-text">${escapeHtml(entry.unicode)} is ${escapeHtml(archetype.domain)}. ${escapeHtml(entry.meaning || '')}</p>`;
  }
  return '';
}

function getPatterns(id) {
  const data = INDUSTRY_PATTERNS.byEntry?.[id];
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.slice(0, 5).map((p) => p.name || p.industry || String(p));
  }
  const primaries = (data.primary || []).slice(0, 3);
  const resonant = (data.resonant || []).slice(0, 3);
  return [...primaries, ...resonant].slice(0, 5);
}

function heroMotif(archetype, entry) {
  const theme = PANTHEON_THEMES[entry?.pantheon] || PANTHEON_THEMES.greek;
  return theme.motif;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderGallery(id, unicode) {
  const data = GALLERY_DATA[id];
  const images = data?.images?.slice(0, 3) || [];
  if (images.length === 0) {
    return (
      `<div class="spread-gallery">` +
      `<figure class="gallery-fallback"><img src="${mascotPath(id)}" alt="${unicode} mascot" loading="lazy" onerror="this.style.display='none'"><figcaption>Brand mascot</figcaption></figure>` +
      `</div>`
    );
  }
  let html = '<div class="spread-gallery">';
  for (const img of images) {
    const caption = stripHtml(img.caption || img.alt || '');
    html += `<figure><img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || unicode)}" loading="lazy"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
  }
  html += '</div>';
  return html;
}

function renderNameVariations(id, unicode) {
  const entry = LEXICON_BY_ID.get(id);
  if (!entry) return '';
  const items = [];
  items.push(`<li><span class="variation-form">${unicode}</span> <span class="variation-role">Canonical</span></li>`);
  if (entry.ascii && entry.ascii !== entry.unicode) {
    items.push(`<li><span class="variation-form">${escapeHtml(entry.ascii)}</span> <span class="variation-role">ASCII</span></li>`);
  }
  if (Array.isArray(entry.variants)) {
    for (const v of entry.variants) {
      const role = v.type
        ? v.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Scholarly variant';
      items.push(`<li><span class="variation-form">${escapeHtml(v.unicode)}</span> <span class="variation-role">${escapeHtml(role)}</span></li>`);
    }
  }
  return `<div class="spread-name-variations"><span class="variations-label">Name variations</span><ul>${items.join('')}</ul></div>`;
}

function renderModernBridge(id) {
  const entry = LEXICON_BY_ID.get(id);
  const archetype = ARCHETYPE_BY_ID.get(id);
  if (!entry || !archetype) return '';
  const patterns = getPatterns(id);
  const patternNames = patterns.slice(0, 3);
  let text = `${entry.unicode || archetype.name}—${entry.domain || archetype.domain || ''}`;
  if (patternNames.length) {
    text += `—resonates today across ${patternNames.join(', ')}`;
  }
  const lore = getLoreLead(id);
  const strippedLore = stripHtml(lore).replace(/^[^\w]+/, '');
  const firstSentence = strippedLore.split(/[.!?]/, 1)[0];
  if (firstSentence) {
    text += patternNames.length ? `; ${firstSentence.toLowerCase()}.` : `. ${firstSentence}.`;
  } else {
    text += '.';
  }
  text += ` The restored Unicode form preserves distinctions flattened by the plain ASCII name.`;
  return text;
}

function getRelatedTemples(id) {
  const entry = LEXICON_BY_ID.get(id);
  if (!entry) return [];
  const built = ARCHETYPES.filter((a) => a.built && a.id !== id);
  const samePantheon = built
    .filter((a) => {
      const e = LEXICON_BY_ID.get(a.id);
      return e && e.pantheon === entry.pantheon;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  function industriesFor(entryId) {
    const data = INDUSTRY_PATTERNS.byEntry?.[entryId];
    if (!data) return [];
    if (Array.isArray(data)) return data.map((p) => p.industry);
    return (data.primary || []).map((p) => p.industry);
  }

  const ownPatterns = new Set(industriesFor(id));
  const patternMatches = built
    .filter((a) => {
      if (samePantheon.some((s) => s.id === a.id)) return false;
      const e = LEXICON_BY_ID.get(a.id);
      if (e && e.pantheon === entry.pantheon) return false;
      return industriesFor(a.id).some((ind) => ownPatterns.has(ind));
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const used = new Set([...samePantheon, ...patternMatches].map((a) => a.id));
  const fallback = built
    .filter((a) => !used.has(a.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return [...samePantheon, ...patternMatches, ...fallback].slice(0, 4).map((a) => a.id);
}

function renderRelatedTemples(relatedIds) {
  if (!relatedIds.length) return '';
  const items = relatedIds
    .map((rid) => {
      const entry = LEXICON_BY_ID.get(rid);
      const archetype = ARCHETYPE_BY_ID.get(rid);
      const unicode = escapeHtml(entry?.unicode || archetype?.name || rid);
      return (
        `<a class="related-item" href="#temple-${rid}">` +
        `<img class="related-mascot" src="${mascotPath(rid)}" alt="${unicode}" loading="lazy" onerror="this.style.display='none'">` +
        `<span class="related-name">${unicode}</span>` +
        `</a>`
      );
    })
    .join('');
  return `<div class="spread-related-temples"><span class="related-label">Kindred temples</span><div class="related-grid">${items}</div></div>`;
}

function getPronunciationDetail(id) {
  const lore = LORE_CATALOG[id];
  const parts = [];
  if (lore?.pronunciation?.phonemes?.length) {
    parts.push(`${lore.pronunciation.phonemes.length} phonemes`);
  }
  if (lore?.pronunciation?.approximation) {
    const syllableMatch = lore.pronunciation.approximation.match(/(\d+)\s+syllable/i);
    if (syllableMatch) parts.push(`${syllableMatch[1]} syllables`);
  }
  return parts.join(' · ');
}

function renderTrendingTemple(item) {
  const entry = LEXICON_BY_ID.get(item.id);
  const pantheon = pantheonName(item.pantheon || entry?.pantheon || '');
  const unicode = escapeHtml(item.unicode || entry?.unicode || item.id);
  return (
    `<div class="temple">` +
    `<img src="${mascotPath(item.id)}" alt="${unicode}" loading="lazy" onerror="this.style.display='none'">` +
    `<div>` +
    `<div class="name">${unicode}</div>` +
    `<div class="meta">${escapeHtml(pantheon)} · ${fmtNumber(item.views)} views</div>` +
    `</div></div>`
  );
}

function renderChapterBody(chapter, edition) {
  let html = '';

  if (chapter.slug === 'by-the-numbers') {
    html += `<div class="herald-stat-row">`;
    html += `<div class="herald-stat-cell"><span class="value">${fmtNumber(edition.fleet.entries)}</span><span class="label">Lexicon Entries</span></div>`;
    html += `<div class="herald-stat-cell"><span class="value">${fmtNumber(edition.fleet.flagships)}</span><span class="label">Flagship Temples</span></div>`;
    html += `<div class="herald-stat-cell"><span class="value">${fmtNumber(edition.fleet.pantheons)}</span><span class="label">Pantheons</span></div>`;
    html += `<div class="herald-stat-cell"><span class="value">${fmtNumber(edition.fleet.domainsOwned)}</span><span class="label">Domains Owned</span></div>`;
    html += `</div>`;

    html += `<div class="herald-analytics-grid">`;
    html += `<div class="metric"><strong>${fmtNumber(edition.analytics.humanViews)}</strong>Human views</div>`;
    html += `<div class="metric"><strong>${fmtNumber(edition.analytics.uniqueSessions)}</strong>Unique sessions</div>`;
    html += `<div class="metric"><strong>${edition.analytics.avgAttention}</strong>Avg. attention</div>`;
    html += `<div class="metric"><strong>${edition.analytics.botShare}%</strong>Bot share</div>`;
    html += `<div class="metric"><strong>${fmtNumber(edition.analytics.botViewsFiltered)}</strong>Bot views filtered</div>`;
    html += `</div>`;

    const leader = edition.trending.leader;
    const leaderEntry = LEXICON_BY_ID.get(leader.id);
    const leaderPantheon = pantheonName(leader.pantheon || leaderEntry?.pantheon || '');
    html += `<div class="herald-trending-leader">`;
    html += `<img src="${mascotPath(leader.id)}" alt="${escapeHtml(leader.unicode)}" loading="lazy" onerror="this.style.display='none'">`;
    html += `<div><div class="name">${escapeHtml(leader.unicode)}</div><div class="meta">${escapeHtml(leaderPantheon)} · ${fmtNumber(leader.views)} views</div></div>`;
    html += `</div>`;
    html += `<div class="herald-trending-list">${edition.trending.runnersUp.map(renderTrendingTemple).join('')}</div>`;
  }

  if (chapter.body) {
    const paragraphs = Array.isArray(chapter.body) ? chapter.body : [chapter.body];
    for (const p of paragraphs) {
      html += mdToHtml(p).html;
    }
  }

  if (chapter.sections) {
    for (const section of chapter.sections) {
      html += `<div class="herald-section">`;
      html += `<h3>${escapeHtml(section.title)}</h3>`;
      html += mdToHtml(section.body).html;
      html += `</div>`;
    }
  }

  return html;
}

function renderTocItems(chapters) {
  return chapters
    .map(
      (chapter, idx) =>
        `<li><a href="/herald/q3-2026/${chapter.slug}/"><span class="toc-title">${idx + 1}. ${escapeHtml(chapter.title)}</span><span class="toc-subtitle">${escapeHtml(chapter.subtitle)}</span></a></li>`
    )
    .join('\n');
}

function renderBookToc(edition, spreads) {
  let html = '<ol class="herald-book-toc">';
  html += `<li><a href="#editors-note">Editor's Note</a><span class="toc-page">p. 3</span></li>`;
  edition.chapters.forEach((chapter, idx) => {
    html += `<li><a href="#chapter-${chapter.slug}">${idx + 1}. ${escapeHtml(chapter.title)}</a><span class="toc-page">p. ${chapter.startPage || 5 + idx * 4}</span></li>`;
  });
  html += `<li><a href="#temple-gazetteer">Temple Gazetteer</a><span class="toc-page">p. ${spreads.startPage}</span></li>`;
  html += `<li><a href="#colophon">Colophon</a><span class="toc-page">p. ${spreads.endPage}</span></li>`;
  html += '</ol>';
  return html;
}

function renderFlagshipSpread(id, index, edition) {
  const archetype = ARCHETYPE_BY_ID.get(id);
  const entry = LEXICON_BY_ID.get(id);
  if (!archetype || !entry) return '';

  const theme = PANTHEON_THEMES[entry.pantheon] || PANTHEON_THEMES.greek;
  const unicode = escapeHtml(entry.unicode || archetype.name);
  const script = getOriginalScriptInfo(id);
  const pronunciation = getPronunciation(id);
  const loreLead = getLoreLead(id);
  const patterns = getPatterns(id);
  const pageBase = 50; // front matter ends around page 50
  const leftPage = pageBase + index * 2 + 1;
  const rightPage = leftPage + 1;

  const domainHtml = entry.domain
    ? `<div class="spread-domain">${escapeHtml(entry.domain)}</div>`
    : `<div class="spread-domain">${escapeHtml(archetype.domain || '')}</div>`;

  const scriptLabel = script ? getOriginalScriptLabel(entry) : 'Scholarly form';
  const scriptValue = script ? escapeHtml(script.script) : unicode;
  const scriptTitle = script && script.provenance?.original ? ` title="${escapeHtml(script.provenance.original)}"` : '';

  const pronDetail = getPronunciationDetail(id);
  const pronunciationHtml = pronunciation
    ? `<div class="spread-pronunciation"><span class="pron-label">${escapeHtml(pronunciation.label)}</span><span class="pron-ipa">${escapeHtml(pronunciation.ipa)}</span>${pronunciation.approximation ? `<span class="pron-approx">${escapeHtml(pronunciation.approximation)}</span>` : ''}${pronDetail ? `<span class="pron-detail">${escapeHtml(pronDetail)}</span>` : ''}</div>`
    : '';

  const patternsHtml = patterns.length
    ? `<div class="spread-patterns"><span class="patterns-label">Aligned industries</span><span class="patterns-list">${patterns.map(escapeHtml).join(' · ')}</span></div>`
    : '';

  const galleryHtml = renderGallery(id, unicode);
  const variationsHtml = renderNameVariations(id, unicode);
  const modernBridgeHtml = renderModernBridge(id);
  const relatedIds = getRelatedTemples(id);
  const relatedHtml = renderRelatedTemples(relatedIds);

  const tierLabel = entry.tierLabel || (entry.tier === 'dual' ? 'Dual-Tier' : entry.tier === '1' ? 'Tier 1' : 'Tier 2');

  return (
    `<section class="herald-spread spread-${entry.pantheon}" id="temple-${id}" data-page-left="${leftPage}" data-page-right="${rightPage}">` +
    `<section class="spread-page spread-left" style="--spread-accent:${theme.accent};--spread-ink:${theme.ink}">` +
    `<header class="spread-running-header"><span class="spread-pantheon">${escapeHtml(pantheonName(entry.pantheon))}</span><span class="spread-page-num">${leftPage}</span></header>` +
    `<div class="spread-hero">` +
    `<h2 class="spread-name">${unicode}</h2>` +
    `<div class="spread-script"><span class="script-label">${scriptLabel}</span><span class="script-value"${scriptTitle}>${scriptValue}</span></div>` +
    domainHtml +
    `<div class="spread-badges"><span class="spread-badge tier-${entry.tier}">${escapeHtml(tierLabel)}</span><span class="spread-badge">${escapeHtml(pantheonName(entry.pantheon))}</span></div>` +
    `</div>` +
    `<div class="spread-visual">` +
    `<img class="spread-mascot" src="${mascotPath(id)}" alt="${unicode} mascot" loading="lazy" onerror="this.style.display='none'">` +
    `<div class="spread-mark-row">` +
    `<img class="spread-logomark" src="${logomarkPath(id)}" alt="${unicode} logomark" loading="lazy" onerror="this.style.display='none'">` +
    `<img class="spread-wordmark" src="${wordmarkPath(id)}" alt="${unicode} wordmark" loading="lazy" onerror="this.style.display='none'">` +
    `</div>` +
    `</div>` +
    galleryHtml +
    `<div class="spread-motif">Motif: ${escapeHtml(heroMotif(archetype, entry))}</div>` +
    `<footer class="spread-running-footer"><span class="spread-page-num">${leftPage}</span></footer>` +
    `</section>` +
    `<section class="spread-page spread-right" style="--spread-accent:${theme.accent};--spread-ink:${theme.ink}">` +
    `<header class="spread-running-header"><span class="spread-pantheon">${escapeHtml(pantheonName(entry.pantheon))}</span><span class="spread-page-num">${rightPage}</span></header>` +
    `<p class="spread-tagline">${escapeHtml(archetype.tagline || '')}</p>` +
    `<div class="spread-lore">${loreLead}</div>` +
    (modernBridgeHtml ? `<div class="spread-modern-bridge"><span class="modern-label">Modern resonance</span><p>${escapeHtml(modernBridgeHtml)}</p></div>` : '') +
    variationsHtml +
    pronunciationHtml +
    patternsHtml +
    `<div class="spread-meaning"><span class="meaning-label">Meaning</span><span>${escapeHtml(entry.meaning || '')}</span></div>` +
    relatedHtml +
    `<a class="spread-temple-link" href="/${id}/" target="_blank" rel="noopener">Visit the temple →</a>` +
    `<footer class="spread-running-footer"><span class="spread-page-num">${rightPage}</span></footer>` +
    `</section>` +
    `</section>`
  );
}

function renderTimeline(edition) {
  const newPantheons = edition.fleet?.newPantheons || [];
  const milestones = [
    {
      date: edition.originDate || '2026-05-25',
      title: 'Origin',
      body: 'The first Unicode domain was registered and the PuniCodex fleet began.',
    },
  ];
  const originTime = new Date(edition.originDate || '2026-05-25').getTime();
  const publishTime = new Date(edition.publishedAt || '2026-09-01').getTime();
  const span = Math.max(1, publishTime - originTime);
  for (let i = 0; i < newPantheons.length; i++) {
    const p = newPantheons[i];
    const t = originTime + (span * (i + 1)) / (newPantheons.length + 1);
    const d = new Date(t);
    const iso = d.toISOString().split('T')[0];
    milestones.push({
      date: iso,
      title: `${pantheonName(p)} pantheon launched`,
      body: 'Added to the flagship fleet for this edition.',
    });
  }
  milestones.push({
    date: edition.publishedAt || '2026-09-01',
    title: `${edition.quarter} release`,
    body: `First edition of The Unicode Herald, ${fmtNumber(edition.fleet?.flagships || 0)} flagship temples.`,
  });
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let html = '<section class="herald-book-timeline" id="timeline">';
  html += '<header class="herald-book-chapter-header"><h2 class="herald-chapter-title">Timeline</h2><p class="herald-chapter-subtitle">From the first registration to this edition</p></header>';
  html += '<div class="timeline">';
  for (const m of milestones) {
    html += `<div class="timeline-entry"><time datetime="${escapeHtml(m.date)}">${fmtDate(m.date)}</time><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.body)}</p></div>`;
  }
  html += '</div></section>';
  return html;
}

function renderAtlas(flagships) {
  const byPantheon = new Map();
  for (const a of flagships) {
    const entry = LEXICON_BY_ID.get(a.id);
    const p = entry?.pantheon || a.pantheon || 'unknown';
    if (!byPantheon.has(p)) byPantheon.set(p, []);
    byPantheon.get(p).push(a);
  }
  const pantheonIds = Array.from(byPantheon.keys()).sort();

  let html = '<section class="herald-book-atlas" id="pantheon-atlas">';
  html += '<header class="herald-book-chapter-header"><h2 class="herald-chapter-title">Pantheon Atlas</h2><p class="herald-chapter-subtitle">A guide to the traditions represented in this edition</p></header>';
  html += '<div class="atlas-grid">';
  for (const p of pantheonIds) {
    const list = byPantheon.get(p);
    const rep = list[0];
    const entry = LEXICON_BY_ID.get(rep.id);
    const theme = PANTHEON_THEMES[entry?.pantheon || p] || PANTHEON_THEMES.greek;
    const unicode = escapeHtml(entry?.unicode || rep.name || rep.id);
    html += `<article class="atlas-card" style="--spread-accent:${theme.accent};--spread-ink:${theme.ink}"><h3>${escapeHtml(pantheonName(p))}</h3><span class="atlas-count">${fmtNumber(list.length)} temples</span><span class="atlas-rep">${unicode}</span></article>`;
  }
  html += '</div></section>';
  return html;
}

function renderNameIndex(flagships) {
  const sorted = flagships.slice().sort((a, b) => {
    const ea = LEXICON_BY_ID.get(a.id);
    const eb = LEXICON_BY_ID.get(b.id);
    const ua = (ea?.unicode || a.name || a.id).toLowerCase();
    const ub = (eb?.unicode || b.name || b.id).toLowerCase();
    return ua.localeCompare(ub);
  });

  let html = '<section class="herald-book-index" id="name-index">';
  html += '<header class="herald-book-chapter-header"><h2 class="herald-chapter-title">Name Index</h2><p class="herald-chapter-subtitle">Every flagship temple in this edition</p></header>';
  html += '<ol class="index-list">';
  for (const a of sorted) {
    const entry = LEXICON_BY_ID.get(a.id);
    const unicode = escapeHtml(entry?.unicode || a.name || a.id);
    const ascii = escapeHtml(entry?.ascii || a.id);
    html += `<li><a href="#temple-${a.id}"><span class="index-unicode">${unicode}</span> <span class="index-ascii">${ascii}</span></a></li>`;
  }
  html += '</ol></section>';
  return html;
}

function renderFullBook(edition) {
  const flagships = ARCHETYPES.filter((a) => a.built).sort((a, b) => a.id.localeCompare(b.id));
  const spreadCount = flagships.length;
  const pageCount = spreadCount * 2 + 50; // front matter + spreads + back matter

  const bookTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'book.html'), 'utf8');

  const spreadsStart = 50;
  const spreadsEnd = spreadsStart + spreadCount * 2 + 1;

  const toc = renderBookToc(edition, { startPage: spreadsStart, endPage: spreadsEnd });

  const chapterBodies = edition.chapters
    .map(
      (chapter, idx) =>
        `<article class="herald-book-chapter" id="chapter-${chapter.slug}">` +
        `<header class="herald-book-chapter-header">` +
        `<p class="herald-chapter-kicker">${escapeHtml(edition.masthead.title)} — ${escapeHtml(edition.quarter)}</p>` +
        `<h2 class="herald-chapter-title">${idx + 1}. ${escapeHtml(chapter.title)}</h2>` +
        `<p class="herald-chapter-subtitle">${escapeHtml(chapter.subtitle)}</p>` +
        `</header>` +
        `<div class="herald-chapter-body">${renderChapterBody(chapter, edition)}</div>` +
        `</article>`
    )
    .join('\n');

  const spreadBodies = flagships.map((a, idx) => renderFlagshipSpread(a.id, idx, edition)).join('\n');

  const replacements = {
    TITLE: `The Unicode Herald — ${edition.quarter} First Edition | PuniCodex`,
    DESCRIPTION: `${edition.label} — complete ${edition.quarter} edition. ${edition.landing.blurb}`,
    OG_TITLE: `The Unicode Herald — ${edition.quarter} First Edition`,
    OG_DESCRIPTION: `${edition.label} — complete ${edition.quarter} edition. ${edition.landing.blurb}`,
    JSON_TITLE: JSON.stringify(`The Unicode Herald — ${edition.quarter} First Edition`),
    JSON_DESCRIPTION: JSON.stringify(`${edition.label} — complete ${edition.quarter} edition. ${edition.landing.blurb}`),
    EDITION_ID: edition.id,
    PUBLISHED_AT: edition.publishedAt,
    PUBLISHED_AT_DISPLAY: fmtDate(edition.publishedAt),
    ORIGIN_DATE_DISPLAY: fmtDate(edition.originDate),
    QUARTER: edition.quarter,
    MASTHEAD_TITLE: edition.masthead.title,
    MASTHEAD_SUBTITLE: edition.masthead.subtitle,
    VOLUME: String(edition.volume),
    NUMBER: String(edition.number),
    LABEL: edition.label,
    COVER_HEADLINE: edition.cover.headline,
    COVER_DEK: edition.cover.dek,
    COVER_BODY: edition.cover.body.map((p) => mdToHtml(p).html).join(''),
    TOC: toc,
    PAGE_COUNT: fmtNumber(pageCount),
    SPREAD_COUNT: fmtNumber(spreadCount),
    TIMELINE_BODY: renderTimeline(edition),
    ATLAS_BODY: renderAtlas(flagships),
    CHAPTER_BODY: chapterBodies,
    SPREAD_BODIES: spreadBodies,
    NAME_INDEX_BODY: renderNameIndex(flagships),
    BACK_MATTER: renderBackMatter(edition),
  };

  return applyReplacements(bookTemplate, replacements);
}

function renderBackMatter(edition) {
  return (
    `<section class="herald-book-chapter" id="colophon">` +
    `<header class="herald-book-chapter-header">` +
    `<h2 class="herald-chapter-title">Colophon</h2>` +
    `<p class="herald-chapter-subtitle">Credits, print note, and canary policy</p>` +
    `</header>` +
    `<div class="herald-chapter-body">` +
    `<p><em>The Unicode Herald</em> is the quarterly publication of the Unicode Pantheon, published by PuniCodex in virtual and physical editions. Temple content is drawn from the project's Scholarly Edition and peer-reviewed under university sponsorship. Analytics are bot-filtered and reflect human engagement across the pantheon.</p>` +
    `<p>This first edition was generated from the same canonical sources that power every temple, card, and API response in the PuniCodex flywheel. The typographical and phonological signatures embedded in the text are part of the project's anti-scraping integrity program and are disclosed in the <a href="/terms/data-use/">Data Use Policy</a>.</p>` +
    `<p>Proudly built and maintained by <a href="https://hekaweb.com" target="_blank" rel="noopener">HEKAWEB</a>. © 2026 PuniCodex. All rites reserved.</p>` +
    `</div>` +
    `</section>`
  );
}

function latestEdition(editions) {
  return editions
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
}

function applyReplacements(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(`{{${key}}}`).join(value);
  }
  return html;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const editions = JSON.parse(fs.readFileSync(EDITIONS_PATH, 'utf8')).editions;
  const edition = latestEdition(editions);

  const landingTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'landing.html'), 'utf8');
  const chapterTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'chapter.html'), 'utf8');

  const baseTitle = edition.masthead.title;
  const bookUrl = `/herald/${edition.id}/book/`;

  // Landing page
  const landingReplacements = {
    CANONICAL: `https://punicodex.com/herald/`,
    TITLE: `${baseTitle} | PuniCodex`,
    DESCRIPTION: edition.landing.blurb,
    OG_TITLE: baseTitle,
    OG_DESCRIPTION: edition.landing.blurb,
    JSON_TITLE: JSON.stringify(baseTitle),
    JSON_DESCRIPTION: JSON.stringify(edition.landing.blurb),
    MASTHEAD_TITLE: baseTitle,
    MASTHEAD_SUBTITLE: edition.landing.tagline,
    VOLUME: String(edition.volume),
    NUMBER: String(edition.number),
    QUARTER: edition.quarter,
    LABEL: edition.label,
    PUBLISHED_AT_DISPLAY: fmtDate(edition.publishedAt),
    COVER_HEADLINE: edition.cover.headline,
    COVER_DEK: edition.cover.dek,
    COVER_BODY: edition.cover.body.map((p) => mdToHtml(p).html).join(''),
    CTA_PRIMARY: edition.landing.ctaPrimary,
    CTA_SECONDARY: edition.landing.ctaSecondary,
    BOOK_URL: bookUrl,
    TOC_ITEMS: renderTocItems(edition.chapters),
  };
  writeFile(path.join(OUT_DIR, 'index.html'), applyReplacements(landingTemplate, landingReplacements));

  // Book edition cover/TOC duplicate
  const editionIndexTitle = `${baseTitle} — ${edition.label} (${edition.quarter}) | PuniCodex`;
  const editionIndexDescription = `${edition.label} of ${baseTitle}: ${edition.landing.blurb}`;
  writeFile(
    path.join(OUT_DIR, edition.id, 'index.html'),
    applyReplacements(landingTemplate, {
      ...landingReplacements,
      CANONICAL: `https://punicodex.com/herald/${edition.id}/`,
      TITLE: editionIndexTitle,
      DESCRIPTION: editionIndexDescription,
      OG_TITLE: `${baseTitle} — ${edition.label} (${edition.quarter})`,
      OG_DESCRIPTION: editionIndexDescription,
      JSON_TITLE: JSON.stringify(`${baseTitle} — ${edition.label} (${edition.quarter})`),
      JSON_DESCRIPTION: JSON.stringify(editionIndexDescription),
    })
  );

  // Chapter pages
  edition.chapters.forEach((chapter, idx) => {
    const prev = idx > 0 ? edition.chapters[idx - 1] : null;
    const next = idx < edition.chapters.length - 1 ? edition.chapters[idx + 1] : null;

    const prevLink = prev
      ? `<a href="../${prev.slug}/"><span class="nav-label">Previous</span>${escapeHtml(prev.title)}</a>`
      : '<span></span>';
    const nextLink = next
      ? `<a class="nav-next" href="../${next.slug}/"><span class="nav-label">Next</span>${escapeHtml(next.title)}</a>`
      : '<span></span>';

    const chapterReplacements = {
      TITLE: `${chapter.title} — ${baseTitle} ${edition.quarter} | PuniCodex`,
      DESCRIPTION: chapter.subtitle,
      OG_TITLE: `${chapter.title} — ${baseTitle} ${edition.quarter}`,
      OG_DESCRIPTION: chapter.subtitle,
      JSON_TITLE: JSON.stringify(`${chapter.title} — ${baseTitle} ${edition.quarter}`),
      JSON_DESCRIPTION: JSON.stringify(chapter.subtitle),
      EDITION_ID: edition.id,
      CHAPTER_SLUG: chapter.slug,
      PUBLISHED_AT: edition.publishedAt,
      QUARTER: edition.quarter,
      MASTHEAD_TITLE: baseTitle,
      CHAPTER_TITLE: chapter.title,
      CHAPTER_SUBTITLE: chapter.subtitle,
      CHAPTER_BODY: renderChapterBody(chapter, edition),
      PREV_LINK: prevLink,
      NEXT_LINK: nextLink,
    };

    writeFile(
      path.join(OUT_DIR, edition.id, chapter.slug, 'index.html'),
      applyReplacements(chapterTemplate, chapterReplacements)
    );
  });

  // Complete print-ready book
  const fullBook = renderFullBook(edition);
  writeFile(path.join(OUT_DIR, edition.id, 'book', 'index.html'), fullBook);

  console.log(
    `Herald generated: landing page + edition ${edition.id} with ${edition.chapters.length} chapters + ${ARCHETYPES.filter((a) => a.built).length} flagship spreads (${fmtNumber(fullBook.length)} bytes)`
  );
}

main();
