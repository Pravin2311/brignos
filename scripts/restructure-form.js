#!/usr/bin/env node
/**
 * Rebuilds index.html's generator form onto Advanced Mode's structure.
 *
 * Advanced Mode groups fields into labelled bands:
 *     .fc > .fsec > .fsec-label + .fg4 > .field
 * index.html had a flat list with one heading, which is why the two pages read
 * so differently despite sharing almost identical CSS.
 *
 * Also lifts "Optimise for" out of the Refine disclosure: resale vs startup
 * changes what the engine generates, so it is a primary choice, not a refinement.
 *
 * Idempotent-ish — it detects the already-migrated shape and exits.
 * Usage: node scripts/restructure-form.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');

if (html.includes('class="fsec"')) {
  console.log('already restructured — nothing to do');
  process.exit(0);
}

/** Extract the .field block whose label targets `id`, returning [block, htmlWithout]. */
function takeField(src, id) {
  const labelAt = src.indexOf(`<label for="${id}"`);
  if (labelAt === -1) throw new Error(`label for ${id} not found`);
  const start = src.lastIndexOf('<div class="field">', labelAt);
  if (start === -1) throw new Error(`.field wrapper for ${id} not found`);

  // Walk divs to find the matching close.
  let i = start, depth = 0, end = -1;
  const tag = /<\/?div\b/g;
  tag.lastIndex = start;
  let m;
  while ((m = tag.exec(src))) {
    depth += m[0] === '<div' ? 1 : -1;
    if (depth === 0) { end = m.index + '</div>'.length; break; }
  }
  if (end === -1) throw new Error(`unbalanced .field for ${id}`);
  return [src.slice(start, end), src.slice(0, start) + src.slice(end)];
}

// 1. Pull the mode field out of the Refine group.
const [modeField, without] = takeField(html, 'mode');
html = without;

// 2. Band the model picker.
html = html.replace(
  /<!-- Model row -->\s*<div style="margin-bottom:18px">\s*<div style="[^"]*">AI Model<\/div>\s*<div class="model-row" id="mrow"><\/div>\s*<\/div>/,
  `<!-- Model row -->
  <div class="fsec">
    <div class="fsec-label">AI Model</div>
    <div class="model-row" id="mrow"></div>
  </div>`
);

// 3. Band the primary parameters, with Optimise-for restored alongside them.
html = html.replace(
  /(\s*<!-- Row 1: Industry, Archetype, Language -->\s*)<div class="fg4">/,
  `$1<div class="fsec">
    <div class="fsec-label">Core parameters</div>
    <div class="fg4">
${modeField.split('\n').map(l => '  ' + l).join('\n')}`
);

// Close the extra .fsec wrapper opened above, just before the Refine disclosure.
html = html.replace(
  /(\s*)<details class="adng-refine">/,
  `$1</div>\n$1<details class="adng-refine">`
);

// 4. Band the refined groups.
html = html.replace(
  /<div class="fg3">/,
  `<div class="fsec">
    <div class="fsec-label">Naming controls</div>
    <div class="fg3">`
);
html = html.replace(
  /<div class="fg2"([^>]*)>/,
  `</div>
  <div class="fsec">
    <div class="fsec-label">Audience &amp; keywords</div>
    <div class="fg2"$1>`
);
// Close the final .fsec before the disclosure ends.
html = html.replace(
  /(\s*)<\/details>/,
  `$1  </div>\n$1</details>`
);

fs.writeFileSync(FILE, html);
console.log('form restructured onto .fsec bands; Optimise-for promoted to Core parameters');
