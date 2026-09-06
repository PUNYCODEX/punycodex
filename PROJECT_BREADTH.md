# PuniCodex — Internal Breadth & Architecture Inventory

> Private reference. Every figure below is derived directly from the repo as of the latest `npm run generate` / `data-version.json`.

---

## 1. What PuniCodex Is

PuniCodex is a multi-platform product built on **Unicode (IDN) domain names** — the scholarly restoration of mythological names as real, ownable web addresses such as `apóllōn.com` (punycode `xn--aplln-1ta64d.com`). It is simultaneously:

- a **scholarly lexicon** of mythological name restorations;
- a **temple-page network** (one generated page per entry);
- a **search engine for the Unicode web** (live crawler of `xn--` domains);
- a **domain-leasing / sponsorship marketplace**;
- a **brand-protection / authenticity** service;
- a **print-on-demand store**, a **TCG**, a **mobile app**, browser extensions, SDKs, and an AI oracle.

Everything is produced from a small set of hand-edited canonical sources via `npm run generate`.

---

## 2. Canonical Data Layer

| Source | File | Count |
|--------|------|-------|
| Lexicon | `type/js/lexicon.js` | **983 entries** |
| Pantheons | `type/js/lexicon.js` | **25 traditions** |
| Flagship archetypes | `js/archetypes-v2.js` | **546 built flagships** |
| Base temples | `sites/` minus flagships | **437 base temples** |
| Owned Unicode domains | `platform/db/owned-domains.json` | **357 domains** |
| Original scripts | `type/js/original-scripts.js` + extra | **128 scripts** |
| Source catalog | `type/js/source-catalog.js` | **226 entries** |
| Pronunciation atlas | `type/js/pronunciation-atlas.js` | **966 entries** |
| Glyph atlas | `type/js/glyph-atlas.js` | **778 entries** |
| Scholarly blog posts | `platform/blog/content/*.json` | **546 posts** |
| Scholarly editions | `platform/scholars/content/*.json` | **546 entries** |
| Bespoke hero effects | `templates/flagship/effects/effects.json` | **546 registries / 533 unique canvas effects** |
| AI corpus | `data/corpus/` | **28 files, ~233k JSONL lines, ~231 MB** |

**Site directories:** `sites/` contains **990** immediate subdirectories, including alias/variant pages (`achilles`, `ambika`, `bhudevi`, `delphi`, `europa`, `hercules`, `jason`, `khaos`, `pallas`, `pegasus`).

**Data version:** `2.0.152` (`data-version.json`).

---

## 3. The Generation Flywheel

`npm run generate` runs `scripts/generate.js`, which orchestrates **46 scripts** in dependency order. A representative subset:

- lexicon copies to `extension/shared/`, `mobile/shared/`, `android/app/src/main/assets/shared/`, `platform/browser/renderer/`;
- `middleware.js` domain map (`scripts/sync-middleware-domains.js`);
- base + flagship temples (`scripts/generate-temples.js`, `scripts/create-flagship.js --regenerate-all`);
- blog, scholars, sitemap, store pages, POD products, AI corpora;
- OG cards, asset versioning, analytics injection.

**Core rule:** never hand-edit generated outputs. CI enforces this with the **divergence gate**.

---

## 4. Testing & Quality Gates

### Test runner
- `test/run-all.js` runs **269 declared suites** serially (45 are forced single-flight).
- **280 `*.test.js` files** under `test/`.
- Recent full runs pass **~250,000 assertions**.

### Specialized validators
- `type/js/validate.js` — **90,606 assertions** on lexicon structure, pantheons, scripts, etc.
- `type/js/test-engine.js` — engine unit tests.
- `scripts/validate-flywheel.js` — 10-section integrity check: archetypes ↔ lexicon, `DOMAIN_MAP`, owned domains, lexicon-copy byte identity, temple existence, sitemap, flagship completeness.
- `scripts/validate-accuracy.js` — philological accuracy gate.

### Gates in CI / local
| Gate | Command |
|------|---------|
| Format | `npm run format:check` (Biome 2.5) |
| Lint | `npm run lint` |
| Full test | `npm test` |
| Divergence | `npm run generate:check` / `npm run prepush` |
| Pre-push | `npm run prepush` = test + generate:check |

### CI
- `.github/workflows/ci.yml` — Node 22, format, lint, test, then regenerate + `git diff --exit-code`.
- `.github/workflows/evolve.yml` — nightly evolution cycle.
- `.github/workflows/red-team.yml` — weekly authenticity red-team.
- `.github/workflows/deploy-prebuilt.yml` — production deploy after CI passes.

---

## 5. Frontend Architecture

- **No frontend framework.** Static HTML, CSS, vanilla JS.
- **Shared CSS:** 37 files in `css/` (`temple-base.css`, `main.css`, `punicodex-tokens.css`, etc.).
- **Shared JS:** 65 files in `js/` (`temple-base.js`, `px-core.js`, `ink.js`, `flagship-canvas.js`, etc.).
- **Flagship templates:** 10 HTML tab templates + `dashboard.html` under `templates/flagship/`.
- **Hero canvas:** `js/flagship-canvas.js` (~2,691 lines, 49+ labeled effect families) drives 533 unique flagship effects.
- **Source lines:** ~**262,607** tracked lines across `.js`, `.html`, `.css`, `.json`.

---

## 6. API & Platform

- **Serverless functions:** `api/` contains **33 `.js` files**, including **12 catch-all routers** (`api/[[...slug]].js`, `api/v1/[[...slug]].js`, etc.).
- **Handler modules:** `platform/api-handlers/` contains **201 `.js` files**:
  - `admin/` 69, `v1/` 52, `root/` 39, `v2/` 16, `search/` 12, `analytics/` 8, `crawler/` 5.
- **Vercel routing:** `vercel.json` — 34 rewrites, 9 header routes, 12 crons.
- **Local server:** Express 5, `npm run platform` → `:3456`.
- **Databases:** SQLite (`better-sqlite3`) locally / `/tmp` on Vercel; Postgres for operational data in production; Redis for rate limits.
- **Edge middleware:** `middleware.js` handles Unicode/punycode deity domain routing, canonical `/sites/{id}/` → `/{id}/` redirects, HTTPS, and `www.` stripping.

---

## 7. Clients

| Client | Path | Notes |
|--------|------|-------|
| Type-tool browser extension | `extension/` | MV3; shared generated lexicon |
| Authenticity extension | `extension-v2/` | MV3; brand-protection interstitials |
| Mobile PWA | `mobile/` | Capacitor-wrapped; includes shield / keyboard directory |
| Android app | `android/` | Capacitor 8; AAB build pipeline |
| Desktop browser | `platform/browser/` | Electron shell with oracle, tabs, omnibox |
| SDKs | `sdk/` | JS, iOS, Android, Flutter, React Native, embedded, wearables, WordPress |

---

## 8. AI / Corpus / Oracle

- **NVIDIA Nemotron** integration: `platform/api/oracle.js` routes philosophical, philological, and pattern-weaving queries through the Nemotron LLM with a custom system prompt grounded in the lexicon.
- **Corpus:** `data/corpus/` produces pretrain, instruction, chat, dialogue, safety, reasoning, and oracle datasets exported for Hugging Face.
- **Manifests & cards:** `DATA_CARD.md`, `MODEL_CARD.md`, eval benchmarks.

---

## 9. Infrastructure & SEO Hardening

Recent hardening (this branch):
- `middleware.js`: HTTP → HTTPS, generic `www.` stripping for deity domains.
- Canonical audit gate: `scripts/audit-seo-canonicals.js` + `test/seo-canonical-audit.test.js`.
- Meta uniqueness tests: every indexable page must have unique title + description.
- robots.txt: `/sites/` disallowed (assets allowed), `/api/` disallowed, legacy search disallowed.
- Internal link cleanup: no `/sites/{id}/...` page links, no `.html` links on `punicodex.com`.

---

## 10. Scale in One View

| Dimension | Figure |
|-----------|--------|
| Tracked source lines (JS/HTML/CSS/JSON) | ~262,600 |
| Lexicon entries | 983 |
| Flagship temples | 546 |
| Owned Unicode domains | 357 |
| Test suites | 269 |
| Test files | 280 |
| API handler modules | 201 |
| Vercel serverless functions/routers | 33 |
| Bespoke hero effects | 546 (533 unique) |
| AI corpus lines | ~233,000 |
| Workflows | 4 |
| Client platforms | 6 |

---

## 11. How to Keep This Document True

This file is **not generated**. After any major expansion (new flagships, new API areas, client additions), re-run the metric commands below and update the table in §10:

```bash
# counts
git ls-files -z | grep -zE '\.(js|html|css|json)$' | grep -zEv '^(node_modules|\.vercel|\.venv|\.git|package-lock\.json)' | xargs -0 wc -l | tail -1
node -e "const d=require('./data-version.json'); console.log(d.counts)"
ls test/*.test.js | wc -l
ls platform/api-handlers/**/*.js | wc -l
ls api/*.js | wc -l
wc -l data/corpus/*.jsonl | tail -1
```
