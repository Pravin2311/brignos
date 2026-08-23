#!/usr/bin/env node
/**
 * Injects one shared site header into every page.
 *
 * The site had six different header patterns (.header div, header.hd, bare
 * <header>, .nav ...) ranging 60-329px tall with different nav sets, so moving
 * between tools felt like moving between websites. This replaces the outer
 * chrome only — page-specific controls such as API-key fields are left where
 * they are, inside the page body.
 *
 * Idempotent: re-running replaces the marked block rather than stacking.
 * Usage: node scripts/build-header.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const START = '<!-- autodng:header:start -->';
const END = '<!-- autodng:header:end -->';

// href -> label. Order is deliberate: generator first, then the analysis
// tools, then commercial. Blog last.
const NAV = [
  ['/index.html',                        'Generator'],
  ['/autodng-upgraded.html',             'Advanced'],
  ['/domains.html',                      'Domains'],
  ['/valuation.html',                    'Valuation'],
  ['/analyze.html',                      'Analyzer'],
  ['/trademarks.html',                   'Trademarks'],
  ['/vc-score.html',                     'VC Score'],
  ['/handles.html',                      'Handles'],
  ['/autodng-domain-intelligence.html',  'Intelligence'],
  ['/blog/index.html',                   'Blog'],
];

const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html', 'handles.html',
  'trademarks.html', 'vc-score.html', 'autodng-upgraded.html',
  'autodng-domain-intelligence.html', 'privacy.html', 'terms.html', '404.html',
];

function headerFor(file) {
  const self = '/' + file;
  const links = NAV.map(([href, label]) => {
    const current = href === self ? ' aria-current="page"' : '';
    return `      <a href="${href}"${current}>${label}</a>`;
  }).join('\n');

  return `${START}
<header class="adng-header">
  <div class="adng-header__inner">
    <a class="adng-brand" href="/index.html">auto<em>DNG</em></a>
    <nav class="adng-nav" aria-label="Tools">
${links}
    </nav>
    <a class="adng-btn adng-btn--secondary adng-header__cta" href="/brand-naming-consulting.html">Advisory</a>
  </div>
</header>
${END}`;
}

let changed = 0;
for (const file of PAGES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  let html = fs.readFileSync(full, 'utf8');
  const before = html;

  // Remove any previously injected block so this stays idempotent.
  html = html.replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'g'), '');

  // Insert immediately after <body ...>, above whatever chrome the page has.
  const m = html.match(/<body[^>]*>/i);
  if (!m) { console.log(`skip (no <body>): ${file}`); continue; }
  const at = m.index + m[0].length;
  html = html.slice(0, at) + '\n' + headerFor(file) + html.slice(at);

  if (html === before) { console.log(`unchanged: ${file}`); continue; }
  if (!DRY) fs.writeFileSync(full, html);
  changed++;
  console.log(`${DRY ? '[dry] ' : ''}header -> ${file}`);
}
console.log(`\n${DRY ? '[dry] ' : ''}${changed} page(s) updated.`);
