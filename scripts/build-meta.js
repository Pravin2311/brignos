#!/usr/bin/env node
/**
 * Injects canonical + Open Graph + Twitter Card meta into the main pages.
 * Existing <meta name="description"> and <link rel="canonical"> are respected;
 * everything else is inserted once, inside a marked block, so re-runs replace
 * rather than duplicate.  Usage: node scripts/build-meta.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://autodng.com';
const OG_IMAGE = `${ORIGIN}/img/og-cover.png`;
const START = '<!-- autodng:meta:start -->';
const END = '<!-- autodng:meta:end -->';

const PAGES = {
  'index.html': {
    url: '/',
    title: 'autoDNG — AI Brand Name Generator with Live Domain Checks',
    desc: 'Generate brandable startup names with 7 AI naming agents, then check .com/.ai/.io availability live. Free, runs in your browser, bring your own API key.',
  },
  'domains.html': {
    url: '/domains.html',
    title: 'Premium Brandable Domains for Sale — autoDNG',
    desc: 'Browse a curated inventory of premium brandable domains for startups, with valuation signals and instant enquiry.',
  },
  'valuation.html': {
    url: '/valuation.html',
    title: 'Domain & Brand Name Valuation Engine — autoDNG',
    desc: 'Estimate what a brand name or domain is worth using comparable sales, phonetic quality and extension signals.',
  },
  'analyze.html': {
    url: '/analyze.html',
    title: 'Domain Analyzer — Phonetics, Structure & Risk — autoDNG',
    desc: 'Break down any domain: syllable structure, pronounceability, brandability, and trademark risk signals.',
  },
  'handles.html': {
    url: '/handles.html',
    title: 'Social Handle Availability Checker — autoDNG',
    desc: 'Check whether a brand name is free across major social platforms before you commit to it.',
  },
  'trademarks.html': {
    url: '/trademarks.html',
    title: 'Trademark Risk Screening for Brand Names — autoDNG',
    desc: 'Screen a candidate brand name for obvious trademark conflict signals before you invest in it.',
  },
  'vc-score.html': {
    url: '/vc-score.html',
    title: 'VC Brand Score — Rate Your Startup Name — autoDNG',
    desc: 'Score a startup name against the naming patterns of venture-backed companies across memorability, fit and trend alignment.',
  },
  'autodng-domain-intelligence.html': {
    url: '/autodng-domain-intelligence.html',
    title: 'Domain Intelligence — Should You Build On This Domain? — autoDNG',
    desc: 'A full intelligence read on any domain: history, risk, brand fit, and whether it is worth building a company on.',
  },
  'brand-naming-consulting.html': {
    url: '/brand-naming-consulting.html',
    title: 'Brand Naming Advisory & Consulting — autoDNG',
    desc: 'Work with autoDNG on naming strategy, shortlisting, and domain acquisition for your startup.',
  },
  'autodng-upgraded.html': {
    url: '/autodng-upgraded.html',
    title: 'Advanced Brand Name Generator — 12-Strategy Engine — autoDNG',
    desc: 'The advanced autoDNG generator: 12 combinatorial naming strategies, 19-signal quality gates, bulk analysis and live RDAP domain checks.',
  },
  'pricing-checkout.html': {
    url: '/pricing-checkout.html',
    title: 'Checkout — Brand Naming Advisory — autoDNG',
    desc: 'Confirm your brand naming advisory engagement with autoDNG.',
    robots: 'noindex,follow',
  },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let changed = 0;
for (const [file, cfg] of Object.entries(PAGES)) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) { console.log(`skip (missing): ${file}`); continue; }

  let html = fs.readFileSync(full, 'utf8');
  const canonical = ORIGIN + cfg.url;

  // Drop any previously injected block so this script stays idempotent.
  html = html.replace(new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, 'g'), '\n');

  const hasDesc = /<meta\s+name="description"/i.test(html);
  const hasCanon = /<link\s+rel="canonical"/i.test(html);

  const lines = [START];
  if (!hasDesc) lines.push(`<meta name="description" content="${esc(cfg.desc)}">`);
  if (!hasCanon) lines.push(`<link rel="canonical" href="${canonical}">`);
  lines.push(
    `<meta name="robots" content="${cfg.robots || 'index,follow'}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="autoDNG">`,
    `<meta property="og:title" content="${esc(cfg.title)}">`,
    `<meta property="og:description" content="${esc(cfg.desc)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${OG_IMAGE}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(cfg.title)}">`,
    `<meta name="twitter:description" content="${esc(cfg.desc)}">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
    END,
  );

  html = html.replace(/<\/title>/i, `</title>\n${lines.join('\n')}`);
  fs.writeFileSync(full, html);
  changed++;
  console.log(`meta -> ${file}`);
}
console.log(`\n${changed} page(s) updated.`);
