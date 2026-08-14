#!/usr/bin/env node
/**
 * Links assets/autodng.css into every page that renders the shared footer.
 * Inserted just before the page's own <style> block so page CSS can still
 * override deliberately; the shared footer rules use a .site-footer parent
 * selector so they win on specificity without editing per-page CSS.
 * Idempotent.  Usage: node scripts/link-shared-css.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_VERSION = '6';   // bump to bust caches when autodng.css changes
const LINK = `<link rel="stylesheet" href="/assets/autodng.css?v=${CSS_VERSION}">`;
// Every page, not just the ones with the shared footer — the stylesheet also
// carries the mobile tap-target and sticky-header rules, which all pages need.
const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html',
  'handles.html', 'trademarks.html', 'vc-score.html',
  'autodng-domain-intelligence.html', 'privacy.html', 'terms.html', '404.html',
  'autodng-upgraded.html',
];

let changed = 0;
for (const file of PAGES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  let html = fs.readFileSync(full, 'utf8');

  if (html.includes('assets/autodng.css')) {
    // Already linked — just keep the cache-busting version current.
    const next = html.replace(/href="\/assets\/autodng\.css(\?v=[^"]*)?"/,
      `href="/assets/autodng.css?v=${CSS_VERSION}"`);
    if (next !== html) { fs.writeFileSync(full, next); changed++; console.log(`version -> ${file}`); }
    else console.log(`already current: ${file}`);
    continue;
  }

  // Place immediately before the first inline <style> so it loses to page CSS
  // on ties, and wins on the footer via the higher-specificity selectors.
  if (/<style[^>]*>/i.test(html)) {
    html = html.replace(/<style[^>]*>/i, m => `${LINK}\n${m}`);
  } else {
    html = html.replace(/<\/head>/i, `${LINK}\n</head>`);
  }

  fs.writeFileSync(full, html);
  changed++;
  console.log(`linked -> ${file}`);
}
console.log(`\n${changed} page(s) updated.`);
