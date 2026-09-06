/**
 * Middleware execution tests — runs the real shipped edge middleware
 * (middleware.js, ESM) against a request matrix, plus an exhaustive sweep of
 * every generated DOMAIN_MAP entry (Unicode, punycode, and www variants).
 *
 * Complements the static flywheel validator: this proves the routing logic
 * actually produces the right response for every owned domain, the defensive
 * domains, external redirects, direct-serve domains, legacy paths, clean-URL
 * rewrites, and the API trailing-slash shim — without standing up Vercel.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'middleware.js');

// Fetch pass-throughs are how the middleware says "serve this instead" — stub
// global fetch to capture the URL it would fetch instead of hitting network.
const realFetch = globalThis.fetch;
globalThis.fetch = async (input) => ({
  __fetched: String(input instanceof Request ? input.url : input),
});

let middleware;
let domainMap;

async function loadMiddleware() {
  const tmp = path.join(os.tmpdir(), `punicodex-middleware-${process.pid}.mjs`);
  fs.copyFileSync(SRC, tmp);
  const mod = await import(`file://${tmp.replace(/\\/g, '/')}`);
  middleware = mod.default;

  // Parse the generated DOMAIN_MAP block (single-quoted 'domain': '/sites/id').
  const src = fs.readFileSync(SRC, 'utf8');
  const block = src.match(/const DOMAIN_MAP = \{([\s\S]*?)\n\};/)[1];
  domainMap = new Map();
  for (const m of block.matchAll(/'([^']+)':\s*'\/sites\/([^']+)'/g)) {
    domainMap.set(m[1], m[2]);
  }
}

function req(url, host) {
  return new Request(url, { headers: { host: host || new URL(url).host } });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function run() {
  console.log('\n▸ Middleware Execution Tests\n');
  await loadMiddleware();
  assert.ok(domainMap.size > 500, `expected 500+ domain mappings, got ${domainMap.size}`);

  await test('unicode deity domain 301s to the clean punicodex.com path', async () => {
    const res = await middleware(req('https://achérōn.com/'));
    assert.strictEqual(res.status, 301);
    const loc = res.headers.get('Location');
    assert.ok(loc.startsWith('https://punicodex.com/acheron'), loc);
  });

  await test('paths and query survive the domain redirect', async () => {
    const res = await middleware(req('https://achérōn.com/lore/?x=1'));
    const loc = res.headers.get('Location');
    assert.ok(loc.includes('/acheron/lore/'), loc);
    assert.ok(loc.includes('x=1'), loc);
  });

  await test('www variant routes identically', async () => {
    const res = await middleware(req('https://www.achérōn.com/'));
    assert.strictEqual(res.status, 301);
    assert.ok(res.headers.get('Location').includes('/acheron'));
  });

  await test('http deity domain 301s to the https clean punicodex path', async () => {
    const res = await middleware(req('http://achérōn.com/'));
    assert.strictEqual(res.status, 301);
    const loc = res.headers.get('Location');
    assert.strictEqual(loc, 'https://punicodex.com/acheron/');
  });

  await test('http punicodex path 301s to https', async () => {
    const res = await middleware(req('http://punicodex.com/zeus/'));
    assert.strictEqual(res.status, 301);
    assert.strictEqual(res.headers.get('Location'), 'https://punicodex.com/zeus/');
  });

  await test('punycode host routes to the same temple as its Unicode form', async () => {
    const { domainToASCII } = require('node:url');
    const ascii = domainToASCII('achérōn.com');
    assert.ok(ascii.startsWith('xn--'));
    const res = await middleware(req(`https://${ascii}/`));
    assert.strictEqual(res.status, 301);
    assert.ok(res.headers.get('Location').includes('/acheron'));
  });

  await test('defensive brand domains 301 to punicodex.com', async () => {
    for (const host of ['punycodex.com', 'www.punycodex.com', 'www.punicodex.com']) {
      const res = await middleware(req(`https://${host}/lexicon/`));
      assert.strictEqual(res.status, 301);
      const loc = res.headers.get('Location');
      assert.ok(loc.startsWith('https://punicodex.com/lexicon/'), `${host}: ${loc}`);
    }
  });

  await test('external-redirect domain goes to its canonical target', async () => {
    const res = await middleware(req('https://xn--kxaqik.com/'));
    assert.strictEqual(res.status, 301);
    assert.strictEqual(res.headers.get('Location'), 'https://punicodex.com/nike/');
  });

  await test('direct-serve domain serves the temple in place (no redirect)', async () => {
    const res = await middleware(req('https://helheimr.com/lore/'));
    assert.ok(res.__fetched, 'must be a fetch pass-through, not a redirect');
    assert.ok(res.__fetched.includes('/sites/helheimr/lore/'), res.__fetched);
    // Root-relative static assets are served from the project root.
    const asset = await middleware(req('https://helheimr.com/js/temple-base.js'));
    assert.ok(asset.__fetched.endsWith('/js/temple-base.js'), asset.__fetched);
  });

  await test('legacy archetype paths 301 to the current canonical id', async () => {
    const res = await middleware(req('https://punicodex.com/enki'));
    assert.strictEqual(res.status, 301);
    assert.ok(res.headers.get('Location').includes('/ea'), res.headers.get('Location'));
  });

  await test('clean archetype URLs rewrite internally to /sites/{id}', async () => {
    const res = await middleware(req('https://punicodex.com/zeus/gallery/'));
    assert.ok(res.__fetched, 'must be a fetch pass-through');
    assert.ok(res.__fetched.includes('/sites/zeus/gallery/'), res.__fetched);
  });

  await test('base-temple clean URLs rewrite internally to /sites/{id}', async () => {
    // marduk/korinthos are lexicon entries WITHOUT an archetype/owned domain —
    // historically these 404ed at the clean URL.
    for (const id of ['marduk', 'korinthos']) {
      const res = await middleware(req(`https://punicodex.com/${id}/`));
      assert.ok(res.__fetched, `${id}: must be a fetch pass-through`);
      assert.ok(res.__fetched.includes(`/sites/${id}/`), res.__fetched);
    }
  });

  await test('LEXICON_IDS in the generated block covers the whole lexicon', async () => {
    const src = fs.readFileSync(SRC, 'utf8');
    const m = src.match(/const LEXICON_IDS = new Set\(\[([\s\S]*?)\]\);/);
    assert.ok(m, 'LEXICON_IDS block missing from middleware.js');
    const ids = new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
    const { LEXICON } = require('../type/js/lexicon.js');
    assert.strictEqual(ids.size, LEXICON.length, 'LEXICON_IDS size != lexicon size');
    const missing = LEXICON.filter((e) => !ids.has(e.id)).map((e) => e.id);
    assert.deepStrictEqual(missing.slice(0, 10), [], `${missing.length} lexicon ids not routed`);
  });

  await test('every lexicon id has a clean-URL rewrite (exhaustive)', async () => {
    const { LEXICON } = require('../type/js/lexicon.js');
    const failures = [];
    for (const entry of LEXICON) {
      const res = await middleware(req(`https://punicodex.com/${entry.id}/`));
      if (!res.__fetched?.includes(`/sites/${entry.id}/`)) {
        failures.push(entry.id);
      }
    }
    assert.deepStrictEqual(failures.slice(0, 10), [], `${failures.length} ids without a rewrite`);
  });

  await test('/sites/{id}/ page requests 301 to the clean /{id}/ form', async () => {
    for (const id of ['marduk', 'zeus']) {
      for (const suffix of ['', '/', '/index.html']) {
        const res = await middleware(req(`https://punicodex.com/sites/${id}${suffix}`));
        assert.strictEqual(res.status, 301, `/sites/${id}${suffix}: status ${res.status}`);
        assert.strictEqual(
          res.headers.get('Location'),
          `https://punicodex.com/${id}/`,
          `/sites/${id}${suffix}`
        );
      }
    }
  });

  await test('/sites/{id}/ subpaths 301 with subpath, slash, and query intact', async () => {
    const res = await middleware(req('https://punicodex.com/sites/zeus/lore/?utm=x'));
    assert.strictEqual(res.status, 301);
    assert.strictEqual(res.headers.get('Location'), 'https://punicodex.com/zeus/lore/?utm=x');
    // A trailing index.html collapses to the slash form in the SAME hop.
    const deep = await middleware(req('https://punicodex.com/sites/zeus/lore/index.html'));
    assert.strictEqual(deep.status, 301);
    assert.strictEqual(deep.headers.get('Location'), 'https://punicodex.com/zeus/lore/');
  });

  await test('/sites/{id}/assets/* passes through untouched (media proxy)', async () => {
    const res = await middleware(req('https://punicodex.com/sites/zeus/assets/mascot.png'));
    assert.ok(res.__fetched, 'assets must not redirect');
    assert.ok(res.__fetched.includes('/sites/zeus/assets/mascot.png'), res.__fetched);
  });

  await test('legacy stale dirs 301 to their current temple ids', async () => {
    const stale = {
      achilles: 'achilleus',
      delphi: 'delphoi',
      europa: 'europe',
      hercules: 'herakles',
      jason: 'iason',
      khaos: 'chaos',
      pegasus: 'pegasos',
    };
    for (const [legacy, current] of Object.entries(stale)) {
      const res = await middleware(req(`https://punicodex.com/${legacy}/lore/`));
      assert.strictEqual(res.status, 301, `/${legacy}/: status ${res.status}`);
      assert.ok(
        res.headers.get('Location').includes(`/${current}/lore/`),
        `/${legacy}/ -> ${res.headers.get('Location')}`
      );
      // The /sites/{legacy}/ form resolves to the same target in one hop.
      const viaSites = await middleware(req(`https://punicodex.com/sites/${legacy}/`));
      assert.strictEqual(viaSites.status, 301, `/sites/${legacy}/: status ${viaSites.status}`);
      assert.strictEqual(
        viaSites.headers.get('Location'),
        `https://punicodex.com/${current}/`,
        `/sites/${legacy}/`
      );
    }
  });

  await test('API calls without trailing slash are shimmed internally (no 308)', async () => {
    const res = await middleware(req('https://punicodex.com/api/v1/names'));
    assert.ok(res.__fetched, 'must be a fetch pass-through');
    assert.ok(res.__fetched.includes('/api/v1/names/'), res.__fetched);
  });

  await test('unknown hosts and paths pass through untouched', async () => {
    const res = await middleware(req('https://example.com/anything'));
    assert.ok(res.__fetched);
    assert.ok(!res.__fetched.includes('/sites/'), res.__fetched);
  });

  await test('every DOMAIN_MAP entry routes to a live temple path (exhaustive)', async () => {
    const failures = [];
    for (const [domain, id] of domainMap) {
      // Skip external-redirect domains (they point off-host by design).
      if (['νίκη.com', 'xn--kxaqik.com', 'www.νίκη.com', 'www.xn--kxaqik.com'].includes(domain)) {
        continue;
      }
      if (domain === 'helheimr.com' || domain === 'www.helheimr.com') continue; // direct-serve
      const res = await middleware(req(`https://${domain}/`));
      if (res.status !== 301) {
        failures.push(`${domain}: status ${res.status}`);
        continue;
      }
      const loc = res.headers.get('Location') || '';
      if (!loc.includes(`/${id}`)) failures.push(`${domain}: ${loc} missing /${id}`);
    }
    assert.deepStrictEqual(failures.slice(0, 10), [], `${failures.length} routing failures`);
  });

  globalThis.fetch = realFetch;
  console.log(
    `\nMiddleware Execution: ${passed} passed, ${failed} failed (${domainMap.size} domains swept)`
  );
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  globalThis.fetch = realFetch;
  console.error(err);
  process.exit(1);
});
