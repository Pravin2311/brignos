#!/usr/bin/env node
/**
 * Repairs blog page metadata that pointed at URLs which do not exist:
 *   - rel=canonical rewritten to the file's real published URL
 *   - favicon/asset paths made root-relative (they resolved inside blog/<cat>/ before)
 *   - og:url / JSON-LD mainEntityOfPage aligned to the same canonical
 * Idempotent: safe to re-run.  Usage: node scripts/fix-blog-meta.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://autodng.com';

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const files = walk(path.join(ROOT, 'blog'));
let changed = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const canonical = `${ORIGIN}/${rel.replace(/(^|\/)index\.html$/, '$1')}`;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // 1. Point the canonical at the URL this file is actually served from.
  if (/rel="canonical"/.test(html)) {
    html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${canonical}">`);
  } else {
    html = html.replace(/<\/title>/i, `</title>\n    <link rel="canonical" href="${canonical}">`);
  }

  // 2. Favicon/asset hrefs were relative, so they resolved to blog/<cat>/img/... (404).
  html = html.replace(/(href|src)="img\//g, '$1="/img/');
  html = html.replace(/(href|src)="assets\//g, '$1="/assets/');

  // 3. Keep og:url and schema.org mainEntityOfPage in step with the canonical.
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/i, `$1${canonical}$2`);
  html = html.replace(/("mainEntityOfPage"\s*:\s*")[^"]*(")/i, `$1${canonical}$2`);
  html = html.replace(/("@id"\s*:\s*")https:\/\/autodng\.com\/blog\/[^"]*(")/i, `$1${canonical}$2`);

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
    console.log(`fixed ${rel}\n   -> ${canonical}`);
  }
}
console.log(`\n${changed} of ${files.length} blog files updated.`);
