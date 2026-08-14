#!/usr/bin/env node
/**
 * Verifies every rel=canonical points at a URL this site actually serves.
 * A canonical aimed at a 404 tells Google the real page is somewhere that does
 * not exist, which suppresses the page from search entirely.
 * Usage: node scripts/check-canonicals.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://autodng.com';

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
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/rel="canonical"\s+href="([^"]+)"/i);
  if (!m) continue;

  let rel = m[1].startsWith(ORIGIN) ? m[1].slice(ORIGIN.length) : m[1];
  rel = rel.replace(/^\//, '') || 'index.html';
  const candidates = rel.endsWith('/')
    ? [path.join(ROOT, rel, 'index.html')]
    : [path.join(ROOT, rel), path.join(ROOT, rel + '.html'), path.join(ROOT, rel, 'index.html')];

  if (!candidates.some(c => fs.existsSync(c))) {
    broken.push({ page: path.relative(ROOT, file).split(path.sep).join('/'), canonical: m[1] });
  }
}

if (!broken.length) console.log('All canonicals resolve to a served page.');
else {
  console.log(`${broken.length} canonical(s) pointing at a non-existent URL:\n`);
  for (const b of broken) console.log(`  ${b.page}\n    -> ${b.canonical}`);
}
process.exit(broken.length ? 1 : 0);
