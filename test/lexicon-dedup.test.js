/**
 * Lexicon dedup contract — one entry per deity; alternate forms live as
 * variants on the canonical entry; stale duplicate temples redirect.
 *
 * Guards the class found 2026-07: Latinized/transliteration duplicates
 * (achilles/khaos/delphi/europa/pegasus) coexisting with canonical flagships.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { LEXICON } = require('../type/js/lexicon.js');
const { autoLink } = require('../scripts/lib/crosslink.js');

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
    console.error(`    ${err.message}`);
  }
}

const REDIRECTS = {
  achilles: 'achilleus',
  khaos: 'chaos',
  delphi: 'delphoi',
  europa: 'europe',
  pegasus: 'pegasos',
};

function run() {
  console.log('\n▸ Lexicon Dedup Contract\n');

  test('no duplicate original-script clusters remain in the lexicon', () => {
    const byScript = new Map();
    for (const e of LEXICON) {
      const g = (e.greek || '').trim();
      if (!g || g === '—') continue;
      const list = byScript.get(g) || [];
      list.push(e.id);
      byScript.set(g, list);
    }
    const dups = [...byScript.entries()].filter(([, ids]) => ids.length > 1);
    assert.deepStrictEqual(
      dups.map(([g, ids]) => `${g}: ${ids.join(', ')}`),
      [],
      `${dups.length} duplicate clusters`
    );
  });

  test('every variant form belongs to an existing canonical entry', () => {
    const bad = [];
    for (const e of LEXICON) {
      for (const v of e.variants || []) {
        if (!v.unicode || !v.type) bad.push(`${e.id}: malformed variant ${JSON.stringify(v)}`);
        if (v.type === 'alt' && !v.sources?.length) {
          bad.push(`${e.id}: alt variant '${v.unicode}' lacks sources`);
        }
      }
    }
    assert.deepStrictEqual(bad.slice(0, 8), [], `${bad.length} variant problems`);
  });

  test('stale duplicate temples redirect to the canonical temple', () => {
    for (const [from, to] of Object.entries(REDIRECTS)) {
      const file = path.join(ROOT, 'sites', from, 'index.html');
      assert.ok(fs.existsSync(file), `missing stub: sites/${from}/`);
      const html = fs.readFileSync(file, 'utf8');
      assert.ok(html.includes('noindex'), `${from}: stub must be noindex`);
      assert.ok(
        html.includes(`rel="canonical" href="https://punicodex.com/${to}/"`),
        `${from}: canonical must point to ${to}`
      );
      assert.ok(html.includes(`url=https://punicodex.com/${to}/`), `${from}: refresh target`);
    }
  });

  test('crosslink resolves variant forms to the canonical temple', () => {
    const out = autoLink('<p>Achillēs and Pégasos stood with Khaos at Delphí, near Eurōpē.</p>', {
      selfId: null,
    });
    for (const [form, id] of [
      ['Achillēs', 'achilleus'],
      ['Pégasos', 'pegasos'],
      ['Khaos', 'chaos'],
      ['Delphí', 'delphoi'],
      ['Eurōpē', 'europe'],
    ]) {
      assert.ok(
        out.includes(`href="/${id}/"`) && out.includes(`>${form}</a>`),
        `${form} must link to ${id}`
      );
    }
  });

  console.log(`\nLexicon Dedup: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
