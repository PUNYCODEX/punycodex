/**
 * SEO canonical-link audit.
 *
 * Scans public HTML pages and fails (exit code 1) if:
 *   - an indexable page is missing a canonical link tag
 *   - any page links to the legacy /sites/{id}/.../ form (assets excepted)
 *   - any page links to a .html extension URL on punicodex.com
 *
 * Pages that carry a robots noindex directive may omit canonical.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Public, crawlable surfaces only. App portals, generated client bundles,
// documentation, tooling, and root stub pages are out of scope.
const EXCLUDE_RE =
  /^\.git\/|^\.vercel\/|node_modules|^Marketing\/|^tools\/|^scripts\/|^templates\/|^docs\/|^admin-portal\/|^account\/|^android\/|^platform\/|^extension\/|^extension-v2\/|^mobile\/|\.backup|\.venv|\.venv_hieropy|build\/intermediates|^404\.html$|^admin\.html$|^browser\.html$|^entry\.html$|^interstitial\.html$/;

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else if (entry.name.endsWith('.html')) cb(full);
  }
}

function hasNoindex(html) {
  // <meta name="robots" content="noindex,..."> or <meta content="noindex" name="robots">
  return /<meta[^>]*(?:name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex["'][^>]*name=["']robots)/i.test(
    html
  );
}

const missingCanonical = [];
const badSiteLinks = [];
const badHtmlLinks = [];

walk(ROOT, (file) => {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (EXCLUDE_RE.test(rel)) return;

  const html = fs.readFileSync(file, 'utf8');
  const noindex = hasNoindex(html);

  const canonicalMatch = html.match(
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i
  );
  if (!canonicalMatch && !noindex) {
    missingCanonical.push(rel);
  }

  const links = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
  for (const href of links) {
    if (
      /^https?:\/\/punicodex\.com\/sites\/[^/]+\/(?!assets\/)/.test(href) ||
      /^\/sites\/[^/]+\/(?!assets\/)/.test(href)
    ) {
      badSiteLinks.push({ rel, href });
    }
    if (/^https?:\/\/punicodex\.com\/[^?#]+\.html/.test(href)) {
      badHtmlLinks.push({ rel, href });
    }
  }
});

console.log('\nSEO canonical audit results:');
console.log(`  Missing canonical: ${missingCanonical.length}`);
console.log(`  Bad /sites/ links: ${badSiteLinks.length}`);
console.log(`  Bad .html links: ${badHtmlLinks.length}`);

let failed = false;

if (missingCanonical.length) {
  failed = true;
  console.log(`\n✗ Indexable pages missing canonical (first 30):`);
  for (const rel of missingCanonical.slice(0, 30)) {
    console.log(`  - ${rel}`);
  }
}

if (badSiteLinks.length) {
  failed = true;
  console.log(`\n✗ Links to legacy /sites/{id}/ paths (first 30):`);
  for (const { rel, href } of badSiteLinks.slice(0, 30)) {
    console.log(`  - ${rel} → ${href}`);
  }
}

if (badHtmlLinks.length) {
  failed = true;
  console.log(`\n✗ Links to .html URLs (first 30):`);
  for (const { rel, href } of badHtmlLinks.slice(0, 30)) {
    console.log(`  - ${rel} → ${href}`);
  }
}

if (failed) {
  console.log(
    `\n✗ Canonical audit failed: ${missingCanonical.length + badSiteLinks.length + badHtmlLinks.length} issue(s).`
  );
  process.exit(1);
}

console.log('\n✓ Canonical audit passed: 0 issues.');
