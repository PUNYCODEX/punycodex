/**
 * Fix stale /sites/{id}/ internal links in canonical blog + scholars content.
 *
 * The clean /{id}/ form is canonical; /sites/{id}/ is the on-disk layout that
 * middleware 301s. Canonical sources must never link to the legacy form.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function fixJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let updated = raw;

  // Absolute legacy URLs.
  updated = updated.replace(
    /https:\/\/punicodex\.com\/sites\/([a-z0-9-]+)\/(?!assets\/)/g,
    'https://punicodex.com/$1/'
  );

  // Relative legacy URLs (but leave /sites/{id}/assets/* alone).
  updated = updated.replace(
    /\/sites\/([a-z0-9-]+)\/(?!assets\/)/g,
    '/$1/'
  );

  if (updated !== raw) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

function walkJson(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, cb);
    else if (entry.name.endsWith('.json')) cb(full);
  }
}

let changed = 0;
let scanned = 0;

for (const base of ['platform/blog/content', 'platform/scholars/content']) {
  const dir = path.join(ROOT, base);
  if (!fs.existsSync(dir)) continue;
  walkJson(dir, (file) => {
    scanned++;
    if (fixJsonFile(file)) changed++;
  });
}

console.log(`Scanned ${scanned} canonical content JSON file(s), updated ${changed}.`);
