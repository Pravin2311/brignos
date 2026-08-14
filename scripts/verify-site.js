#!/usr/bin/env node
/**
 * Whole-site health check: inline JS parses, JSON-LD parses, data files parse,
 * and every indexable page carries canonical + description + og:image.
 * Usage: node scripts/verify-site.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];

function walk(dir, ext, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(full);
  }
  return acc;
}

const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

// 1. Data files must be valid JSON — a malformed one silently disables the engine.
for (const f of walk(path.join(ROOT, 'data'), '.json')) {
  try { JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { problems.push(`invalid JSON: ${rel(f)} — ${e.message}`); }
}

const html = walk(ROOT, '.html');
let jsBlocks = 0, ldBlocks = 0;

for (const f of html) {
  const src = fs.readFileSync(f, 'utf8');

  for (const m of src.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1], body = m[2];
    if (/\ssrc=/i.test(attrs)) continue;
    if (/application\/ld\+json/i.test(attrs)) {
      ldBlocks++;
      try { JSON.parse(body); }
      catch (e) { problems.push(`invalid JSON-LD: ${rel(f)} — ${e.message.slice(0, 70)}`); }
      continue;
    }
    jsBlocks++;
    try { new Function(body); }
    catch (e) { problems.push(`JS syntax error: ${rel(f)} — ${e.message.slice(0, 70)}`); }
  }

  // Markdown link syntax leaking into attributes breaks the resource entirely.
  if (/(href|src)="\[[^\]]*\]\(/.test(src)) problems.push(`markdown link in attribute: ${rel(f)}`);
}

// 2. Indexable pages need canonical + description + og:image.
const INDEXABLE = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html', 'handles.html',
  'trademarks.html', 'vc-score.html', 'autodng-domain-intelligence.html',
  'brand-naming-consulting.html', 'privacy.html', 'terms.html',
];
for (const p of INDEXABLE) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) { problems.push(`missing page: ${p}`); continue; }
  const src = fs.readFileSync(full, 'utf8');
  if (!/rel="canonical"/i.test(src)) problems.push(`no canonical: ${p}`);
  if (!/name="description"/i.test(src)) problems.push(`no description: ${p}`);
  if (!/property="og:image"/i.test(src)) problems.push(`no og:image: ${p}`);
}

// 3. Infrastructure files.
for (const p of ['robots.txt', 'sitemap.xml', '404.html', 'privacy.html', 'terms.html', 'img/og-cover.png']) {
  if (!fs.existsSync(path.join(ROOT, p))) problems.push(`missing: ${p}`);
}

console.log(`checked ${html.length} HTML files — ${jsBlocks} inline JS blocks, ${ldBlocks} JSON-LD blocks`);
if (!problems.length) {
  console.log('\nAll checks passed.');
} else {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  - ' + p);
}
process.exit(problems.length ? 1 : 0);
