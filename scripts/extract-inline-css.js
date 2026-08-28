#!/usr/bin/env node
/**
 * Moves every page's embedded <style> block into its own external file.
 *
 * Pure extraction: the CSS text is written out byte-for-byte and the <style>
 * tag is replaced with a <link> at the exact same position, so cascade order
 * is unchanged and no rule is rewritten from memory. Rewriting ~1,500 rules
 * by hand across 31 pages is how a "cleanup" introduces the exact bugs this
 * session has spent its time finding — a mechanical move is verifiable, a
 * hand rewrite is not.
 *
 * Output: assets/pages/<slug>.css, one per source page, versioned ?v=1 so a
 * re-run (edit + extract again) busts caches. <slug> mirrors the page's own
 * path (blog/foo/bar.html -> blog-foo-bar.css) so the mapping is legible.
 *
 * Usage: node scripts/extract-inline-css.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'pages');
const DRY = process.argv.includes('--dry');

function findHtmlFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findHtmlFiles(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function slugFor(relPath) {
  return relPath.replace(/\.html$/, '').replace(/[\\/]/g, '-') + '.css';
}

if (!DRY) fs.mkdirSync(OUT_DIR, { recursive: true });

let moved = 0, totalBytes = 0;
for (const full of findHtmlFiles(ROOT)) {
  const rel = path.relative(ROOT, full).split(path.sep).join('/');
  let html = fs.readFileSync(full, 'utf8');

  const m = html.match(/<style([^>]*)>([\s\S]*?)<\/style>/i);
  if (!m) { console.log(`skip (no <style>): ${rel}`); continue; }

  const [full_, attrs, css] = m;
  const slug = slugFor(rel);
  const cssPath = path.join(OUT_DIR, slug);
  const link = `<link rel="stylesheet" href="/assets/pages/${slug}?v=1">`;

  if (!DRY) {
    fs.writeFileSync(cssPath, css);
    html = html.replace(full_, link);
    fs.writeFileSync(full, html);
  }
  moved++;
  totalBytes += css.length;
  console.log(`${DRY ? '[dry] ' : ''}${rel.padEnd(46)} -> assets/pages/${slug} (${css.length} bytes)`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${moved} page(s), ${totalBytes} bytes of CSS extracted.`);
