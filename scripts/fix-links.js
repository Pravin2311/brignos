#!/usr/bin/env node
/**
 * Repairs two classes of broken internal links:
 *   1. Markdown link syntax pasted into href/src attributes:  href="[label](URL)"  ->  href="URL"
 *   2. Blog/tool URLs pointing at folders or slugs that do not exist on disk.
 * Idempotent: safe to re-run.  Usage: node scripts/fix-links.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Stale URL -> real URL. Longest keys are applied first so prefixes don't clobber.
const REDIRECTS = {
  '/blog/ai-naming-tech/how-ai-revolutionizes-brand-generation.html': '/blog/ai-and-naming-tech/how-ai-revolutionizes-brand-generation.html',
  '/blog/ai-naming-tech/how-ai-revolutionizes-brand-generation':      '/blog/ai-and-naming-tech/how-ai-revolutionizes-brand-generation.html',
  '/blog/ai-naming-tech/web3-vs-ai-domain-strategies.html':           '/blog/ai-and-naming-tech/web3-vs-ai-domain-strategies.html',
  '/blog/ai-naming-tech/web3-vs-ai-domain-strategies':                '/blog/ai-and-naming-tech/web3-vs-ai-domain-strategies.html',
  '/blog/ai-naming-tech/rise-of-neurotech-branding.html':             '/blog/ai-and-naming-tech/rise-of-neurotech-branding.html',
  '/blog/ai-naming-tech/rise-of-neurotech-branding':                  '/blog/ai-and-naming-tech/rise-of-neurotech-branding.html',
  '/blog/ai-naming-tech/algorithmic-appraisals-autodng.html':         '/blog/ai-and-naming-tech/algorithmic-appraisals-autodng.html',
  '/blog/ai-naming-tech/algorithmic-appraisals-autodng':              '/blog/ai-and-naming-tech/algorithmic-appraisals-autodng.html',
  '/blog/ai-naming-tech':                                             '/blog/ai-and-naming-tech/',
  '/blog/guides/gemini-api-key-format-autodng-fix':                   '/blog/autodng-guides/gemini-api-key-format-autodng-fix.html',
  '/blog/guides':                                                     '/blog/autodng-guides/',
  '/blog/startup-branding/psychology-of-naming-ai-startup':           '/blog/startup-branding/the-psychology-of-naming-your-ai-startup.html',
  '/blog/startup-branding/acquire-premium-domains.html':              '/blog/startup-branding/how-to-acquire-premium-domains.html',
  // This checklist lives under domain-investing, not startup-branding.
  '/blog/startup-branding/ultimate-domain-branding-checklist.html':   '/blog/domain-investing/ultimate-domain-branding-checklist.html',
  '/blog/startup-branding/ultimate-domain-branding-checklist':        '/blog/domain-investing/ultimate-domain-branding-checklist.html',
  '/blog/domain-investing/valuating-invented-brandable-domains':      '/blog/domain-investing/valuating-invented-brandable-domains.html',
  // Marketing-site URLs that were never built.
  '/tools/generator': '/index.html',
  '/tools/appraisal': '/valuation.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
};

const keys = Object.keys(REDIRECTS).sort((a, b) => b.length - a.length);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // 1. href="[label](URL)"  ->  href="URL"
  html = html.replace(/(href|src)="\[[^\]]*\]\((.*?)\)"/g, '$1="$2"');

  // 2. Rewrite stale paths, but only inside an href/src attribute.
  html = html.replace(/(href|src)="([^"]+)"/g, (full, attr, url) => {
    const hit = keys.find(k => url === k || url === k + '/');
    return hit ? `${attr}="${REDIRECTS[hit]}"` : full;
  });

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
    console.log(`fixed ${path.relative(ROOT, file).split(path.sep).join('/')}`);
  }
}
console.log(`\n${changed} file(s) updated.`);
