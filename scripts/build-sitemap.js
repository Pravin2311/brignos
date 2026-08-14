#!/usr/bin/env node
/**
 * Regenerates sitemap.xml from the HTML files actually present in the repo.
 * Run after adding or removing a page:  node scripts/build-sitemap.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://autodng.com';

// Superseded drafts / duplicate builds / thin pages — kept in the repo, excluded from search.
const EXCLUDE = new Set([
  'v2.html', 'old.html', 'in.html', 'local.html',
  '404.html', 'payment-success.html',
]);

// Crawl priority by role. Anything unlisted falls back to 0.6.
const PRIORITY = {
  'index.html': '1.0',
  'domains.html': '0.9',
  'valuation.html': '0.9',
  'analyze.html': '0.8',
  'trademarks.html': '0.8',
  'vc-score.html': '0.8',
  'handles.html': '0.8',
  'autodng-domain-intelligence.html': '0.7',
  'brand-naming-consulting.html': '0.7',
  'autodng-upgraded.html': '0.8',
  'blog/index.html': '0.7',
  'privacy.html': '0.3',
  'terms.html': '0.3',
  'pricing-checkout.html': '0.4',
};

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return acc;
}

const pages = walk(ROOT)
  .filter(p => !EXCLUDE.has(p))
  .sort((a, b) => (PRIORITY[b] || '0.6').localeCompare(PRIORITY[a] || '0.6') || a.localeCompare(b));

const urls = pages.map(p => {
  // Serve index pages under their directory URL so the canonical doesn't split.
  const loc = `${ORIGIN}/${p.replace(/(^|\/)index\.html$/, '$1')}`;
  const lastmod = fs.statSync(path.join(ROOT, p)).mtime.toISOString().slice(0, 10);
  const priority = PRIORITY[p] || '0.6';
  const changefreq = priority >= '0.8' ? 'weekly' : 'monthly';
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${pages.length} URLs`);
