#!/usr/bin/env node
/**
 * Unifies typography across the site.
 *
 * The pages had drifted onto four different typefaces — Geist, Syne,
 * Space Grotesk and Inter — plus three different monos and two serifs, so the
 * product read as several separate websites. This rewrites each page's font
 * tokens to the canonical stack and points its Google Fonts request at the
 * same families. Variable NAMES are left alone: pages use --font or --sans
 * interchangeably and their rules depend on that.
 *
 * Idempotent.  Usage: node scripts/unify-fonts.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1'
  + '&family=Geist+Mono:wght@300;400;500'
  + '&family=Geist:wght@300;400;500;600;700&display=swap';

const SANS  = "'Geist',ui-sans-serif,system-ui,-apple-system,sans-serif";
const MONO  = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const SERIF = "'Instrument Serif',Georgia,serif";

const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html', 'handles.html',
  'trademarks.html', 'vc-score.html', 'autodng-upgraded.html',
  'autodng-domain-intelligence.html', 'privacy.html', 'terms.html', '404.html',
];

let changed = 0;
for (const file of PAGES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  let html = fs.readFileSync(full, 'utf8');
  const before = html;

  // 1. Point every Google Fonts stylesheet at the canonical families.
  html = html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/g, FONTS_HREF);

  // 2. Rewrite the token VALUES, preserving whichever names the page uses.
  html = html.replace(/(--(?:font|sans)\s*:\s*)[^;}]+/g, `$1${SANS}`);
  html = html.replace(/(--mono\s*:\s*)[^;}]+/g, `$1${MONO}`);
  html = html.replace(/(--serif\s*:\s*)[^;}]+/g, `$1${SERIF}`);

  if (html === before) { console.log(`unchanged: ${file}`); continue; }
  if (!DRY) fs.writeFileSync(full, html);
  changed++;
  console.log(`${DRY ? '[dry] ' : ''}fonts -> ${file}`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${changed} page(s) updated.`);
