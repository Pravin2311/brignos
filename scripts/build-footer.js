#!/usr/bin/env node
/**
 * Normalizes the shared site footer so every page links to every tool and to
 * the legal pages. Reuses the markup/classes the site already defines
 * (.footer-col, .footer-bottom, .footer-bottom-links) rather than adding CSS.
 * Idempotent.  Usage: node scripts/build-footer.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PAGES = [
  'index.html', 'domains.html', 'valuation.html', 'analyze.html',
  'handles.html', 'trademarks.html', 'vc-score.html', 'autodng-upgraded.html',
];

const TOOLS_COL = `    <nav class="footer-col" aria-label="Core Tools">
      <h4>Tools</h4>
      <ul>
        <li><a href="index.html">AI Name Generator</a></li>
        <li><a href="domains.html">Premium Domains</a></li>
        <li><a href="valuation.html">Domain Valuation</a></li>
        <li><a href="trademarks.html">Trademark Checker</a></li>
      </ul>
    </nav>`;

const ANALYTICS_COL = `    <nav class="footer-col" aria-label="Analytics Tools">
      <h4>Analytics</h4>
      <ul>
        <li><a href="vc-score.html">VC Brand Score</a></li>
        <li><a href="handles.html">Social Handle Checker</a></li>
        <li><a href="analyze.html">Domain Analyzer</a></li>
        <li><a href="autodng-domain-intelligence.html">Domain Intelligence</a></li>
      </ul>
    </nav>`;

const SERVICES_COL = `    <nav class="footer-col" aria-label="Services">
      <h4>More</h4>
      <ul>
        <li><a href="brand-naming-consulting.html">Brand Naming Advisory</a></li>
        <li><a href="blog/index.html">Blog</a></li>
      </ul>
    </nav>`;

const BOTTOM = `  <div class="footer-bottom">
    <p>© 2026 autoDNG. All rights reserved. Built for founders, domainers, and brand strategists.</p>
    <div class="footer-bottom-links">
      <a href="sitemap.xml">Sitemap</a>
      <a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>
    </div>
  </div>`;

const BRAND_FALLBACK = `    <div class="footer-brand">
      <h3>auto<em>DNG</em></h3>
      <p>AI brand name generation, live domain availability, valuation and trademark screening — in one place.</p>
      <div class="footer-socials">
        <a href="https://twitter.com/autodng" target="_blank" rel="noopener" aria-label="Twitter">𝕏</a>
        <a href="https://github.com/autodng" target="_blank" rel="noopener" aria-label="GitHub">⌘</a>
        <a href="mailto:support@teachings.ai" aria-label="Email Support">✉</a>
      </div>
    </div>`;

// Counts open vs close tags so we can prove the emitted block is balanced.
function tagBalance(s, tag) {
  const open = (s.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
  const close = (s.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  return open === close;
}

// The original footers carried stray unmatched </nav> and </div> tags. An
// unmatched </div> closes an ancestor wrapper, which pops <footer> off the
// parser stack and reparents the legal strip onto <body> — where the shared
// .site-footer rules no longer match it. Rebuilding the whole block from a
// fixed template is the only way to guarantee that cannot recur.
function buildFooter(existingBlock) {
  const brandMatch = existingBlock.match(/[ \t]*<div class="footer-brand">[\s\S]*?<\/div>\s*<\/div>/i);
  let brand = brandMatch ? brandMatch[0] : BRAND_FALLBACK;
  if (!tagBalance(brand, 'div')) brand = BRAND_FALLBACK;

  return `<footer class="site-footer">
  <div class="footer-inner">
${brand}
${TOOLS_COL}
${ANALYTICS_COL}
${SERVICES_COL}
  </div>
${BOTTOM}
</footer>`;
}

let changed = 0;
for (const file of PAGES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }
  let html = fs.readFileSync(full, 'utf8');
  const before = html;

  // Operate ONLY inside the <footer class="site-footer"> block. index.html also
  // has an earlier <footer class="footer">, and a bare /<\/footer>/ match put the
  // legal strip in that one — rendering it above the real footer.
  const blockRe = /<footer class="site-footer">[\s\S]*?<\/footer>/i;
  const blockMatch = html.match(blockRe);
  if (!blockMatch) { console.log(`skip (no site-footer): ${file}`); continue; }
  const block = buildFooter(blockMatch[0]);

  if (!tagBalance(block, 'div') || !tagBalance(block, 'nav') || !tagBalance(block, 'footer')) {
    console.log(`ABORT (unbalanced output): ${file}`);
    continue;
  }

  html = html.replace(blockRe, () => block);

  if (html !== before) {
    fs.writeFileSync(full, html);
    changed++;
    console.log(`footer -> ${file}`);
  } else {
    console.log(`unchanged: ${file}`);
  }
}
console.log(`\n${changed} page(s) updated.`);
