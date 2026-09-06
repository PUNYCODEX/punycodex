/**
 * Fix legacy redirect pages under sites/ so their canonical + refresh + link
 * all point at the clean /{id}/ form instead of /sites/{id}/.
 *
 * Source of truth: LEGACY_REDIRECTS in scripts/sync-middleware-domains.js and
 * the known original-script variant pages.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Mirrors LEGACY_REDIRECTS in scripts/sync-middleware-domains.js.
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

// Files that are *not* legacy renames but original-script variant pages that
// should consolidate to the clean /{id}/ form.
const VARIANT_TARGETS = {
  'sites/nike/original.html': '/nike/',
  'sites/hermes/original.html': '/hermes/',
};

function cleanUrl(targetPath) {
  return `https://punicodex.com${targetPath}`;
}

function fixFile(rel, targetPath) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) return false;
  let html = fs.readFileSync(filePath, 'utf8');
  const targetUrl = cleanUrl(targetPath);

  const original = html;

  // Replace canonical href.
  html = html.replace(
    /(<link rel=["']canonical["'] href=["'])https?:\/\/punicodex\.com\/sites\/[^"']+(["'])/i,
    `$1${targetUrl}$2`
  );

  // Replace meta refresh URL.
  html = html.replace(
    /(<meta http-equiv=["']refresh["'] content=["'][^;]+; url=)https?:\/\/punicodex\.com\/sites\/[^"']+(["'])/i,
    `$1${targetUrl}$2`
  );

  // Replace anchor href.
  html = html.replace(
    /(<a href=["'])https?:\/\/punicodex\.com\/sites\/[^"']+(["'])/gi,
    `$1${targetUrl}$2`
  );

  // Replace visible URL text inside the anchor if it mirrors the old URL.
  html = html.replace(
    /https:\/\/punicodex\.com\/sites\/[^\s<]+/g,
    targetUrl
  );

  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✓ ${rel} → ${targetUrl}`);
    return true;
  }
  console.log(`  ${rel} unchanged`);
  return false;
}

let changed = 0;

for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  // from is like '/achilles', to is like '/achilleus'
  const rel = `sites${from}/index.html`; // '/achilles' -> 'sites/achilles/index.html'
  changed += fixFile(rel, `${to}/`) ? 1 : 0;
}

for (const [rel, targetPath] of Object.entries(VARIANT_TARGETS)) {
  changed += fixFile(rel, targetPath) ? 1 : 0;
}

console.log(`\n${changed} redirect page(s) updated.`);
