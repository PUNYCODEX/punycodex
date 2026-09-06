/**
 * PUNICODEX — Generate OWNED_DOMAINS.md from canonical sources.
 *
 * Sources of truth:
 *   - platform/db/owned-domains.json  (the raw owned list)
 *   - js/archetypes-v2.js             (flagship archetypes + tier info)
 *   - type/js/lexicon.js              (all entries, pantheons)
 *   - middleware.js                   (DOMAIN_MAP — current routing)
 *
 * Run: node scripts/generate-owned-domains-md.js
 *      npm run generate will also invoke it.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { domainToASCII } = require('url');

const ROOT = path.join(__dirname, '..');
const OWNED_DOMAINS_PATH = path.join(ROOT, 'platform', 'db', 'owned-domains.json');
const ARCHETYPES_PATH = path.join(ROOT, 'js', 'archetypes-v2.js');
const LEXICON_PATH = path.join(ROOT, 'type', 'js', 'lexicon.js');
const MIDDLEWARE_PATH = path.join(ROOT, 'middleware.js');
const OUTPUT_PATH = path.join(ROOT, 'OWNED_DOMAINS.md');

function puny(d) {
  try {
    return domainToASCII(d).toLowerCase();
  } catch (e) {
    return null;
  }
}

function normalizeDomain(d) {
  return d.toLowerCase().trim().replace(/^www\./, '');
}

function loadJsArray(filePath, varName) {
  const src = fs.readFileSync(filePath, 'utf8');
  return vm.runInNewContext(`(function(){\n${src}\nreturn ${varName};\n})()`);
}

function loadMiddlewareDomainMap() {
  const src = fs.readFileSync(MIDDLEWARE_PATH, 'utf8');
  const mapMatch = src.match(/const DOMAIN_MAP = \{([\s\S]*?)\n\};/);
  if (!mapMatch) throw new Error('Could not find DOMAIN_MAP in middleware.js');

  const map = {};
  const lineRegex = /^\s*'([^']+)':\s*'([^']+)',?/gm;
  let m;
  while ((m = lineRegex.exec(mapMatch[1])) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

function classifyTier(archetype, entry) {
  if (archetype) {
    if (archetype.tierDetail === 'dual-tier' || archetype.tier === 'dual') return 'dual';
    if (archetype.tier === 'tier-1') return 'tier-1';
    if (archetype.tier === 'tier-2') return 'tier-2';
  }
  if (entry?.tier) return entry.tier;
  return 'unknown';
}

function pantheonName(archetype, entry) {
  if (archetype?.pantheon) return archetype.pantheon;
  if (entry?.pantheon) return entry.pantheon;
  return 'unknown';
}

function displayName(archetype, entry, siteId) {
  if (archetype?.name) return archetype.name;
  if (entry?.unicode) return entry.unicode;
  return siteId;
}

function escapeMdCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ─── Load canonical sources ─────────────────────────────────────────────────
const archetypes = loadJsArray(ARCHETYPES_PATH, 'ARCHETYPES');
const lexicon = loadJsArray(LEXICON_PATH, 'LEXICON');
const ownedDomainsRaw = JSON.parse(fs.readFileSync(OWNED_DOMAINS_PATH, 'utf8'));
const domainMap = loadMiddlewareDomainMap();

const archetypeById = new Map(archetypes.map((a) => [a.id, a]));
const entryById = new Map(lexicon.map((e) => [e.id, e]));

// ─── Build site -> domains mapping ──────────────────────────────────────────
// siteId -> { domains: Set<string>, archetype?, entry? }
const sites = new Map();

function ensureSite(id) {
  if (!sites.has(id)) {
    sites.set(id, {
      id,
      archetype: archetypeById.get(id) || null,
      entry: entryById.get(id) || null,
      domains: new Set(),
    });
  }
  return sites.get(id);
}

const unmapped = [];
const seenDomains = new Set();

for (const raw of ownedDomainsRaw) {
  const d = normalizeDomain(raw);
  if (!d) continue;
  if (seenDomains.has(d)) continue;
  seenDomains.add(d);

  // Prefer direct lookup in DOMAIN_MAP; fallback to punycode form.
  let target = domainMap[d] || domainMap[puny(d)] || domainMap['www.' + d] || domainMap['www.' + puny(d)];

  if (!target) {
    // Some owned domains may route via www. only or punycode only in the map.
    const p = puny(d);
    for (const [mapDomain, mapTarget] of Object.entries(domainMap)) {
      if (normalizeDomain(mapDomain) === d) {
        target = mapTarget;
        break;
      }
      if (p && normalizeDomain(mapDomain) === p) {
        target = mapTarget;
        break;
      }
    }
  }

  if (!target) {
    unmapped.push(raw);
    continue;
  }

  const siteId = target.replace(/^\/sites\//, '');
  const site = ensureSite(siteId);
  site.domains.add(raw); // keep original casing for display
}

// ─── Group by tier ──────────────────────────────────────────────────────────
const dual = [];
const tier1 = [];
const tier2 = [];
const base = []; // owned domains for non-flagship (base) temples
const platform = []; // non-/sites/ routing, if any

for (const site of sites.values()) {
  const tier = classifyTier(site.archetype, site.entry);
  const isFlagship = Boolean(site.archetype);
  const sortedDomains = Array.from(site.domains).sort((a, b) => a.localeCompare(b, 'en'));

  const record = {
    id: site.id,
    name: displayName(site.archetype, site.entry, site.id),
    pantheon: pantheonName(site.archetype, site.entry),
    rentalTier: site.archetype?.rentalTier || null,
    domains: sortedDomains,
    isFlagship,
    tier,
  };

  if (!isFlagship) {
    base.push(record);
  } else if (tier === 'dual') {
    dual.push(record);
  } else if (tier === 'tier-1') {
    tier1.push(record);
  } else {
    tier2.push(record);
  }
}

const sortRecords = (records) =>
  records.sort((a, b) => {
    // Greek/Olympian first, then alphabetical by display name
    const pa = a.pantheon.toLowerCase();
    const pb = b.pantheon.toLowerCase();
    if (pa !== pb) return pa.localeCompare(pb, 'en');
    return a.name.localeCompare(b.name, 'en');
  });

sortRecords(dual);
sortRecords(tier1);
sortRecords(tier2);
sortRecords(base);

// ─── Helpers for markdown tables ────────────────────────────────────────────
function renderMultiDomainTable(records, showTierDetail = false) {
  const lines = [
    '| Archetype | Display Name | Domains (owned redirects) | Pantheon | Rental Tier |',
    '|-----------|--------------|---------------------------|----------|-------------|',
  ];
  for (const r of records) {
    const domainList = r.domains.map((d) => `\`${d}\``).join('<br>');
    lines.push(
      `| ${escapeMdCell(r.id)} | ${escapeMdCell(r.name)} | ${domainList} | ${escapeMdCell(r.pantheon)} | ${escapeMdCell(r.rentalTier || '—')} |`
    );
  }
  return lines.join('\n');
}

function renderSimpleDomainTable(records) {
  const lines = [
    '| Domain | Unicode / Display | Site | Pantheon |',
    '|--------|-------------------|------|----------|',
  ];
  for (const r of records) {
    for (const d of r.domains) {
      lines.push(
        `| \`${escapeMdCell(d)}\` | ${escapeMdCell(r.name)} | /sites/${escapeMdCell(r.id)}/ | ${escapeMdCell(r.pantheon)} |`
      );
    }
  }
  return lines.join('\n');
}

// ─── Compose markdown ───────────────────────────────────────────────────────
const totalUniqueOwned = seenDomains.size;
const totalFlagshipDomains = dual.length + tier1.length + tier2.length;
const totalBaseDomains = base.length;

const sections = [];

sections.push(`# PUNICODEX — Owned Domain Inventory`);
sections.push(`> Canonical record of all domains owned by PUNICODEX.`);
sections.push(`> Auto-generated: ${new Date().toISOString().slice(0, 10)}`);
sections.push(`> Source: \`platform/db/owned-domains.json\` + \`js/archetypes-v2.js\` + \`middleware.js\` DOMAIN_MAP`);
sections.push(`> Tier system: The Definitive Tier System (CANONICAL) — see AGENTS.md`);
sections.push('');
sections.push('---');
sections.push('');

sections.push('## Overview');
sections.push('');
sections.push(`- **Total unique owned domains:** ${totalUniqueOwned}`);
sections.push(`- **Flagship temples covered:** ${totalFlagshipDomains}`);
sections.push(`  - Dual-tier: ${dual.length}`);
sections.push(`  - Single-tier Tier-1: ${tier1.length}`);
sections.push(`  - Single-tier Tier-2: ${tier2.length}`);
sections.push(`- **Base temples covered:** ${totalBaseDomains}`);
sections.push(`- **Unmapped owned domains:** ${unmapped.length}`);
sections.push('');

if (unmapped.length > 0) {
  sections.push('## ⚠️ Unmapped Owned Domains');
  sections.push('');
  sections.push('These owned domains do not currently resolve to a temple via `middleware.js` DOMAIN_MAP:');
  sections.push('');
  for (const d of unmapped.sort((a, b) => a.localeCompare(b, 'en'))) {
    sections.push(`- \`${d}\``);
  }
  sections.push('');
}

sections.push('## Dual-Tier Names');
sections.push('');
sections.push('A name is dual-tier when the Greek original has BOTH stress AND long vowel, multiple historically valid Unicode spellings exist, and we own multiple domain variants.');
sections.push('');
if (dual.length > 0) {
  sections.push(renderMultiDomainTable(dual));
} else {
  sections.push('*No dual-tier owned domains currently mapped.*');
}
sections.push('');

sections.push('## Single-Tier Tier-1 Names');
sections.push('');
sections.push('Mechanically information-rich: Greek has both stress AND long vowel; non-Greek preserves a distinctive diacritic or atomic letter.');
sections.push('');
if (tier1.length > 0) {
  sections.push(renderMultiDomainTable(tier1));
} else {
  sections.push('*No Tier-1 owned domains currently mapped.*');
}
sections.push('');

sections.push('## Single-Tier Tier-2 Names');
sections.push('');
sections.push('Greek has only stress OR length (or neither); non-Greek preserves nothing distinctive vs ASCII.');
sections.push('');
if (tier2.length > 0) {
  sections.push(renderMultiDomainTable(tier2));
} else {
  sections.push('*No Tier-2 owned domains currently mapped.*');
}
sections.push('');

if (base.length > 0) {
  sections.push('## Base Temple Domains');
  sections.push('');
  sections.push('Owned domains that route to generated base temples (not full flagships).');
  sections.push('');
  sections.push(renderSimpleDomainTable(base));
  sections.push('');
}

sections.push('## Platform Domains');
sections.push('');
sections.push(`| Domain | Purpose |`);
sections.push(`|--------|---------|`);
sections.push(`| \`punicodex.com\` | Main platform |`);
sections.push('');

sections.push('---');
sections.push('');
sections.push('## Notes');
sections.push('');
sections.push('- Domains are shown in their owned Unicode form; punycode equivalents are routed automatically by `middleware.js`.');
sections.push('- `www.` variants are also routed for every owned domain.');
sections.push('- Run `node scripts/generate-owned-domains-md.js` (or `npm run generate`) to refresh this file after acquiring new domains.');
sections.push('');

const markdown = sections.join('\n');
fs.writeFileSync(OUTPUT_PATH, markdown, 'utf8');

console.log(`✓ Generated ${OUTPUT_PATH}`);
console.log(`  Unique owned domains: ${totalUniqueOwned}`);
console.log(`  Flagship temples:     ${totalFlagshipDomains}`);
console.log(`    Dual-tier:          ${dual.length}`);
console.log(`    Tier-1:             ${tier1.length}`);
console.log(`    Tier-2:             ${tier2.length}`);
console.log(`  Base temples:         ${totalBaseDomains}`);
console.log(`  Unmapped:             ${unmapped.length}`);
