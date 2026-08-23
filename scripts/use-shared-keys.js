#!/usr/bin/env node
/**
 * Points every tool page at the shared API key store.
 *
 * Rewrites each page's own localStorage calls for the provider key to
 * autodngKeys.get/set, so a key entered on one tool works on all of them.
 * Only the KEY is unified — provider and model selection stay per-page,
 * since the pages legitimately offer different model lists.
 *
 * Idempotent.  Usage: node scripts/use-shared-keys.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const TAG = '<script src="/assets/autodng-keys.js?v=1"></script>';

// page -> the localStorage prefix it used for the provider key
const PAGES = {
  'index.html': 'bl_k_',
  'valuation.html': 'dv2_k_',
  'handles.html': 'sh_k_',
  'trademarks.html': 'tm2_k_',
  'vc-score.html': 'vcs_k_',
  'autodng-upgraded.html': 'dngk',
};

let changed = 0;
for (const [file, prefix] of Object.entries(PAGES)) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  let html = fs.readFileSync(full, 'utf8');
  const before = html;

  // Load the store before page scripts run so migration happens first.
  if (!html.includes('autodng-keys.js')) {
    html = html.replace('</head>', `${TAG}\n</head>`);
  }

  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // getItem('<prefix>' + expr)  ->  autodngKeys.get(expr)
  const getRe = new RegExp(`localStorage\\.getItem\\(\\s*'${esc}'\\s*\\+\\s*([A-Za-z_$][\\w$]*)\\s*\\)`, 'g');
  // setItem('<prefix>' + expr, value)  ->  autodngKeys.set(expr, value)
  const setRe = new RegExp(`localStorage\\.setItem\\(\\s*'${esc}'\\s*\\+\\s*([A-Za-z_$][\\w$]*)\\s*,\\s*`, 'g');

  const gets = (html.match(getRe) || []).length;
  const sets = (html.match(setRe) || []).length;

  html = html.replace(getRe, 'autodngKeys.get($1)');
  html = html.replace(setRe, 'autodngKeys.set($1, ');

  if (html === before) { console.log(`unchanged: ${file}`); continue; }
  if (!DRY) fs.writeFileSync(full, html);
  changed++;
  console.log(`${DRY ? '[dry] ' : ''}${file}: ${gets} read(s), ${sets} write(s) -> shared store`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${changed} page(s) updated.`);
