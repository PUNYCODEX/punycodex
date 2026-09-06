/**
 * PUNICODEX — Master generator
 *
 * Orchestrates all source-to-output generation scripts so that a single
 * canonical change propagates to every consumer.
 *
 * Sources of truth:
 *   - type/js/lexicon.js
 *   - js/archetypes-v2.js
 *
 * Generated outputs:
 *   - extension/shared/lexicon.js
 *   - mobile/shared/lexicon.js
 *   - android/app/src/main/assets/shared/lexicon.json
 *   - android/app/src/main/assets/shared/keyboard-palette.json
 *   - platform/browser/renderer/lexicon.json
 *   - platform/api/cards.json + game/cards.json (card game set)
 *   - platform/api/similarities.json
 *   - platform/browser/renderer/similarities.json
 *   - js/owned-entries.js
 *   - middleware.js (DOMAIN_MAP)
 *   - sites/{id}/ base temples (skipped if they already exist)
 *   - sites/{id}/ flagship temples (regenerated if --regenerate-all)
 *
 * Usage: npm run generate
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

// Steps whose outputs are gitignored binary assets (multi-GB merch composites,
// .masters/ copies). On a fresh CI checkout they regenerate gigabytes of PNGs
// that `git diff` can never see — pure cost, zero divergence signal. The
// divergence gate and evolution cycles set PUNICODEX_GENERATE_SKIP_BINARY=1 to
// skip them; local `npm run generate` always builds the full set.
const BINARY_ONLY_STEPS = new Set([
  'scripts/generate-merch-composites.js',
  'scripts/sync-masters-composites.js',
]);

const SKIP_BINARY = process.env.PUNICODEX_GENERATE_SKIP_BINARY === '1';

const allScripts = [
  'platform/generate-unicode-dir-v2.js',
  'scripts/sync-shared-lexicon.js',
  'scripts/sync-shared-engine.js',
  'scripts/build-android-assets.js',
  'scripts/export-platform-lexicon.js',
  'scripts/generate-similarities.js',
  'scripts/generate-industry-patterns.js',
  'scripts/generate-owned-entries.js',
  'scripts/export-codex-data.js',
  'scripts/build-original-script-lookup.js',
  'scripts/export-lore-catalog.js',
  'scripts/generate-cards.js',
  'scripts/generate-cards-page.js',
  'scripts/sync-middleware-domains.js',
  'scripts/generate-owned-domains-md.js',
  'scripts/sync-public-copy.js',
  'scripts/generate-temples.js',
  'scripts/create-flagship.js --regenerate-all',
  // Bakes 1200×630 OG share cards for every entry into assets/og/; templates
  // reference them by convention (/assets/og/{id}.jpg).
  'scripts/generate-og-images.js',
  // Must run AFTER create-flagship: flagship regeneration rewrites pages with
  // bare <img> markup, so the WebP/dimension enrichment only survives if applied last.
  'scripts/convert-images-to-webp.js',
  // Merch composites are the print-ready PNG sheets used by Printful and the
  // cards full-art renderer. generate-merch-composites builds them from the
  // temple assets; sync-masters-composites copies them to .masters/ root so
  // punycodex-masters.vercel.app can serve them and mockups never 404 again.
  'scripts/generate-merch-composites.js',
  'scripts/sync-masters-composites.js',
  'scripts/generate-scholars-taxonomy.js',
  'scripts/generate-scholars-content.js',
  'scripts/backfill-scholars-content.js',
  'scripts/generate-scholars-manifests.js',
  'scripts/generate-scholars.js',
  'scripts/generate-blog-content.js',
  'scripts/generate-blog-series-restoration.js',
  'scripts/backfill-series-restoration.js',
  'scripts/generate-blog-series-resonance.js',
  'scripts/generate-blog-series-canonical.js',
  'scripts/generate-blog-pages.js',
  'scripts/generate-blog-series-pages.js',
  'scripts/generate-blog-index.js',
  // Sacred Texts (/texts/): registry-driven library + reading pages. Must run
  // before the injectors so its fresh pages keep their beacon/consent blocks.
  'scripts/generate-text-pages.js',
  // Per-pantheon landing pages (/greek/, /norse/, etc.). Runs after texts so
  // the Sacred Texts registry is already on disk, and before the injectors so
  // the new pages receive analytics / beacon / consent blocks.
  'scripts/generate-pantheon-landings.js',
  // Movie / Screen Guide (/screen/): reads data/screen-index.json; before the
  // injectors so the new pages receive analytics / beacon / consent blocks.
  'scripts/generate-screen-guide.js',
  // Quarterly Unicode Herald (/herald/): reads data/herald-editions.json;
  // before the injectors so the page receives analytics / beacon / consent.
  'scripts/generate-herald.js',
  'scripts/generate-trending-page.js',
  'scripts/generate-trending-temple-page.js',
  // ItemList JSON-LD on /lexicon/ + /pantheon/ (SEO structured data).
  'scripts/generate-itemlist-schemas.js',
  // Pattern Atlas (/patterns/ + /patterns/methodology/): reads the generated
  // industry-patterns.json produced at step 5; before the injectors so the
  // fresh pages keep their beacon/consent blocks.
  'scripts/generate-patterns-page.js',
  // Everyday Words (/everyday/) + Ink verifier index (data/ink-index.json):
  // canonical word/script registries; before the sitemap and injectors.
  'scripts/generate-everyday-page.js',
  'scripts/generate-ink-index.js',
  // Tattoo-artist reference cards (assets/ink/*.png|svg): reads the ink
  // index; skips existing bakes (platform fonts — committed artifacts).
  'scripts/generate-ink-downloads.js',
  'scripts/sync-scholars-portal.js',
  // Home-page fleet stats from canonical sources (never hand-maintained).
  'scripts/sync-hero-stats.js',
  // Stale counter sweep for hand-edited marketing/pitch pages.
  'scripts/sync-stale-counters.js',
  'scripts/gen-sitemap.js',
  'scripts/inject-analytics.js',
  'scripts/inject-university-collaborators.js',
  'scripts/inject-herald-beacon.js',
  'scripts/sync-admin-portal.js',
  'scripts/sync-interstitial.js',
  // Desktop nav must precede the mobile menu: fresh pages (everyday, ink)
  // get their <nav> + nav-toggle from the desktop sync before the mobile
  // sync inserts its menu (which requires both to exist).
  'scripts/sync-desktop-nav.js',
  'scripts/sync-mobile-menu.js',
  'scripts/sync-footer.js',
  // Static crawlable temple index on the hub pages (lexicon/pantheon grids
  // are JS-rendered; without this the long tail has no static inbounds).
  'scripts/sync-temple-index.js',
  'scripts/generate-pod-products.js',
  // Store pages (collections/collection/product) consume products.json and
  // must run after it; the injectors then re-run (idempotent) so the fresh
  // pages also receive analytics, collaborators, and beacon blocks.
  'scripts/generate-store-pages.js',
  'scripts/inject-analytics.js',
  'scripts/inject-university-collaborators.js',
  'scripts/inject-herald-beacon.js',
  'scripts/inject-cookie-consent.js',
  // Content-addressed ?v= pins for data-driven JS (self-busting cache).
  // Runs after all HTML injectors so placeholder pins are replaced with hashes.
  'scripts/stamp-asset-versions.js',
  'scripts/update-data-version.js',
  // Writes data/corpus/entries.jsonl + manifest.json. MUST run before the
  // corpus generators below, several of which read entries.jsonl — running it
  // after them makes corpus content lag one generate behind canonical changes.
  'scripts/export-model-corpus.js',
  'scripts/generate-synthetic-qa.js',
  'scripts/generate-safety-corpus.js',
  'scripts/generate-dialogue-corpus.js',
  'scripts/generate-tool-use-corpus.js',
  'scripts/generate-multimodal-corpus.js',
  'scripts/generate-preference-corpus.js',
  'scripts/generate-reasoning-corpus.js',
  'scripts/generate-benchmark-suite.js',
  'scripts/generate-mythology-synthesis-corpus.js',
  'scripts/generate-oracle-corpus.js',
  // Doctrine SFT corpus: reads entries.jsonl and the served Oracle system
  // prompt; must follow export-model-corpus.js like the other phase generators.
  'scripts/generate-oracle-doctrine-corpus.js',
  'scripts/generate-symbolic-corpus.js',
  'scripts/generate-scientific-analogies-corpus.js',
  'scripts/generate-pretrain-corpus.js',
  'scripts/generate-unified-corpus.js',
  // Pronunciation records for voice/TTS consumers (rules engine + atlas).
  'scripts/generate-pronunciation-corpus.js',
  'scripts/generate-eval-benchmark.js',
  'scripts/generate-data-card.js',
  // Second pass: manifest.json embeds counts from pretrain-manifest.json and
  // the other corpus manifests, which only exist in their final form after
  // the corpus generators above. Without this closing pass the manifest lags
  // one generate behind and the CI divergence gate fails on a fresh clone.
  // The pass is deterministic and leaves entries.jsonl byte-identical.
  'scripts/export-model-corpus.js',
];

const scripts = SKIP_BINARY
  ? allScripts.filter((script) => !BINARY_ONLY_STEPS.has(script.split(/\s+/)[0]))
  : allScripts;

if (SKIP_BINARY) {
  console.log('  (PUNICODEX_GENERATE_SKIP_BINARY=1 — skipping gitignored binary asset steps)');
}

function run(script) {
  const parts = script.split(/\s+/);
  const scriptPath = path.join(root, parts[0]);
  const args = parts.slice(1);
  console.log(`\n▸ ${script}`);
  // Retry transient write failures: on Windows, AV/indexer locks on freshly
  // written files intermittently fail a spawn with UNKNOWN(-4094). All
  // generate scripts are idempotent, so a retry is always safe.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = spawnSync(process.execPath, ['--max-old-space-size=8192', scriptPath, ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    if (result.status === 0) return;
    console.error(`\n✗ ${script} failed with exit code ${result.status} (attempt ${attempt}/5)`);
    if (attempt < 5) {
      const wait = 2000 * attempt;
      console.error(`  retrying in ${wait}ms (idempotent script)...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  process.exit(1);
}

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  PuniCodex — Generating all derived artifacts          ║');
console.log('╚════════════════════════════════════════════════════════╝');

for (const script of scripts) {
  run(script);
}

console.log('\n✓ All generated artifacts are in sync with canonical sources.');
