#!/usr/bin/env node
/**
 * Reports internal links that do not resolve to a file on disk.
 * Resolves each href relative to the page it appears on (root-relative hrefs
 * resolve against the repo root, matching how GitHub Pages serves the site).
 * Usage: node scripts/check-links.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const broken = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let href = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(href)) continue;
    if (href.includes('${')) continue; // built at runtime inside a JS template literal
    href = href.split('#')[0].split('?')[0];
    if (!href) continue;

    const target = href.startsWith('/')
      ? path.join(ROOT, href)
      : path.resolve(path.dirname(file), href);

    // A directory URL is served by its index.html.
    const candidates = href.endsWith('/') || !path.extname(target)
      ? [target, path.join(target, 'index.html')]
      : [target];

    if (!candidates.some(c => fs.existsSync(c))) {
      broken.push({ page: rel, href: m[1] });
    }
  }
}

if (!broken.length) {
  console.log('No broken internal links.');
} else {
  console.log(`${broken.length} broken internal link(s):\n`);
  for (const b of broken) console.log(`  ${b.page}\n    -> ${b.href}`);
}
process.exit(broken.length ? 1 : 0);
