#!/usr/bin/env node
/**
 * Removes per-page copies of form/provider component CSS so
 * assets/autodng-system.css is the only definition.
 *
 * Each tool carried its own version of the same components, which is why
 * the identical control rendered differently depending on the page:
 *
 *     form card   16px/26px on the generator, 18px/30px in Advanced Mode
 *     .fg4        3 columns on one page, 4 on another
 *     .mchip      7px radius vs 6px
 *     .fsec-label two slightly different greys
 *
 * Same technique used for the footer: delete the duplicates rather than
 * escalate specificity, so there is one source of truth.
 *
 * Idempotent.  Usage: node scripts/strip-form-css.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');

const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html', 'handles.html',
  'trademarks.html', 'vc-score.html', 'autodng-upgraded.html',
  'autodng-domain-intelligence.html',
];

// Leading class of any selector the shared layer now owns.
const OWNED = new Set([
  'fcard', 'fc', 'fsec', 'fsec-label',
  'fg2', 'fg3', 'fg4', 'field', 'flbl',
  'mrow', 'mchip',
  'ptabs', 'ptab', 'kwrap', 'eyebtn', 'spill', 'sdot', 'kdot',
]);

function isOwned(sel) {
  const s = sel.trim();
  if (!s.startsWith('.')) return false;
  const first = s.slice(1).split(/[\s>+~:.,\[(]/)[0];
  return OWNED.has(first);
}

/** Walks CSS, dropping rules whose selectors are all owned. Recurses into at-rules. */
function stripRules(css, removed) {
  let out = '', i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop); i = stop; continue;
    }
    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }

    const rawPrelude = css.slice(i, brace);
    const lastComment = rawPrelude.lastIndexOf('*/');
    const leading = lastComment === -1 ? '' : rawPrelude.slice(0, lastComment + 2);
    const prelude = lastComment === -1 ? rawPrelude : rawPrelude.slice(lastComment + 2);

    let depth = 0, j = brace;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (depth === 0) break; }
    }
    const body = css.slice(brace + 1, j);
    const full = css.slice(i, j + 1);

    if (/^\s*@(media|supports)/i.test(prelude)) {
      const inner = stripRules(body, removed);
      out += inner.trim() ? `${leading}${prelude}{${inner}}` : leading;
    } else {
      const sels = prelude.split(',').map(s => s.trim()).filter(Boolean);
      const keep = sels.filter(s => !isOwned(s));
      if (sels.length && keep.length === 0) {
        removed.push(sels.join(', '));
        out += leading;
      } else if (keep.length !== sels.length) {
        removed.push(sels.filter(isOwned).join(', '));
        out += `${leading}${keep.join(',')}{${body}}`;
      } else {
        out += full;
      }
    }
    i = j + 1;
  }
  return out;
}

let total = 0;
for (const file of PAGES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  const html = fs.readFileSync(full, 'utf8');

  const styleRe = /(<style[^>]*>)([\s\S]*?)(<\/style>)/i;
  const m = html.match(styleRe);
  if (!m) { console.log(`skip (no <style>): ${file}`); continue; }

  const removed = [];
  const stripped = stripRules(m[2], removed);
  if (!removed.length) { console.log(`nothing to strip: ${file}`); continue; }

  if (!DRY) fs.writeFileSync(full, html.replace(styleRe, () => m[1] + stripped + m[3]));
  total += removed.length;
  console.log(`${DRY ? '[dry] ' : ''}${file}: removed ${removed.length} rule(s)`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${total} rule(s) removed in total.`);
