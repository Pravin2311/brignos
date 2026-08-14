#!/usr/bin/env node
/**
 * Removes per-page footer-component CSS so assets/autodng.css is the only
 * source of truth for the shared footer.
 *
 * Each page had its own copy of .site-footer / .footer-col / .footer-bottom
 * rules, which is why the same footer rendered in six different greys. Raising
 * specificity in the shared sheet only papers over that; deleting the duplicates
 * is the actual fix.
 *
 * Careful: `.footer` (index.html's separate top footer) and `.footer-bottom`
 * inside it are NOT part of the shared component and must survive. Only
 * selectors whose FIRST class is in COMPONENT below are removed, and a rule is
 * dropped only when every selector in its list qualifies.
 *
 * Usage: node scripts/strip-footer-css.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html',
  'handles.html', 'trademarks.html', 'vc-score.html',
];

const COMPONENT = [
  'site-footer', 'footer-inner', 'footer-brand', 'footer-socials',
  'footer-col', 'footer-bottom', 'footer-bottom-links',
];

// True when the selector's leading class is one of the shared components.
function isComponentSelector(sel) {
  const s = sel.trim();
  if (!s.startsWith('.')) return false;
  const first = s.slice(1).split(/[\s>+~:.,\[]/)[0];
  return COMPONENT.includes(first);
}

/**
 * Splits CSS into top-level chunks, recursing one level into at-rules.
 * Returns the rewritten CSS with qualifying rules removed.
 */
function stripRules(css, removed) {
  let out = '';
  let i = 0;

  while (i < css.length) {
    // Preserve comments verbatim.
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }

    const rawPrelude = css.slice(i, brace);

    // A comment sitting above a rule lands in the prelude. Split it off, or
    // `/* SEO FOOTER */ .site-footer` reads as a non-component selector and
    // `/* Responsive */ @media` stops being recognised as an at-rule.
    const lastComment = rawPrelude.lastIndexOf('*/');
    const leading = lastComment === -1 ? '' : rawPrelude.slice(0, lastComment + 2);
    const prelude = lastComment === -1 ? rawPrelude : rawPrelude.slice(lastComment + 2);

    // Find the matching close brace for this block.
    let depth = 0, j = brace;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (depth === 0) break; }
    }
    const body = css.slice(brace + 1, j);
    const full = css.slice(i, j + 1);

    if (/^\s*@(media|supports)/i.test(prelude)) {
      // Recurse: drop matching rules inside, and drop the at-rule if emptied.
      const inner = stripRules(body, removed);
      out += inner.trim() ? `${leading}${prelude}{${inner}}` : leading;
    } else {
      const selectors = prelude.split(',').map(s => s.trim()).filter(Boolean);
      const allComponent = selectors.length > 0 && selectors.every(isComponentSelector);
      if (allComponent) {
        removed.push(selectors.join(', '));
        out += leading;                       // keep the comment, drop the rule
      } else {
        // Mixed list: keep the rule but strip only the component selectors.
        const keep = selectors.filter(s => !isComponentSelector(s));
        if (keep.length !== selectors.length) {
          removed.push(selectors.filter(isComponentSelector).join(', '));
          out += `${leading}${keep.join(',')}{${body}}`;
        } else {
          out += full;
        }
      }
    }
    i = j + 1;
  }
  return out;
}

let totalRemoved = 0;
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

  const next = html.replace(styleRe, () => m[1] + stripped + m[3]);
  if (!DRY) fs.writeFileSync(full, next);
  totalRemoved += removed.length;
  console.log(`${DRY ? '[dry] ' : ''}${file}: removed ${removed.length} rule(s)`);
  for (const r of removed) console.log(`    - ${r.slice(0, 72)}`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${totalRemoved} rule(s) removed in total.`);
