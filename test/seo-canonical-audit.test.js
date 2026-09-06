#!/usr/bin/env node
/**
 * SEO Canonical Audit Gate
 *
 * Runs scripts/audit-seo-canonicals.js and asserts zero canonical issues.
 */

const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');

const result = spawnSync(process.execPath, ['scripts/audit-seo-canonicals.js'], {
  cwd: root,
  encoding: 'utf8',
});

assert.strictEqual(
  result.status,
  0,
  `Canonical audit exited ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
);
assert.ok(
  result.stdout.includes('0 issues'),
  `Canonical audit did not report zero issues:\n${result.stdout}`
);

console.log(result.stdout.trim());
