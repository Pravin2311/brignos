#!/usr/bin/env node
/**
 * Builds data/english-words.json, the word list behind the generator's
 * "Dictionary words" mode, and the licence notice that must ship with it.
 *
 * Source: SCOWL 2020.12.07 (permissive, commercial use allowed). Do not swap in
 * the Google Trillion Word lists: their terms exclude commercial use.
 *
 * Quality: common words (SCOWL levels 10-20) are kept unless negative, badly
 * shaped or bare verb forms. The rarer level 35 mixes "lantern" with "wart" and
 * no signal separates them, so its words need approval: scripts/brandable-words.txt
 * or one of the generator's own word banks. Negative words are rated by VADER (MIT).
 *
 * Usage: node scripts/build-english-words.js <scowl-dir> <vader_lexicon.txt> <vader-LICENSE>
 * SCOWL: deb.debian.org/debian/pool/main/s/scowl/scowl_2020.12.07.orig.tar.gz
 * VADER: github.com/cjhutto/vaderSentiment (vaderSentiment/vader_lexicon.txt)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [src, vaderFile, vaderLicense] = process.argv.slice(2);
if (!vaderLicense) { console.error('Usage: node scripts/build-english-words.js <scowl-dir> <vader_lexicon.txt> <vader-LICENSE>'); process.exit(1); }

// Levels 10-35 are SCOWL's common vocabulary. Proper names live in other files.
const FILES = ['english-words', 'american-words'].flatMap(f => [10, 20, 35].map(n => `${f}.${n}`));
const MIN_LEN = 3;
const MAX_LEN = 11; // matches MAX_NAME_LEN in index.html

const list = s => s.trim().split(/\s+/);

// Grammar words and fillers: real words, but not brand names.
const FUNCTION_WORDS = new Set(list(`the and but for nor yet not are was were been being has had have having does did doing
you your yours she her hers him his they them their theirs our ours its who whom whose which what when where why how
this that these those there here then than thus such some any all both each few many much more most other another
from into onto upon with within without about above after again against among around before behind below beneath
beside besides between beyond during except inside outside over under until unto toward towards through throughout
because although though while whereas whether unless since very too also just only even still shall should would
could might must may can will cannot ought myself yourself himself herself itself ourselves themselves everybody
everyone everything nobody nothing somebody someone something anybody anyone anything etc per via versus amen however therefore moreover latter null therein thereof yourselves withdrew`));

// Removed if the word starts with one of these (or, for stems under 4 letters,
// is the stem plus a simple ending). ALLOW rescues innocent words they catch.
const BLOCK_STEMS = list(`anal anus arse asshole bastard bitch bollock boob bugger bullshit butthole clit cock crap cum cunt
dick dildo dyke erotic fag fart feces fuck genital handjob horny incest masturb nigger nigga nude nudity orgasm orgy
penis piss porn prick prostitut pube pubic pussy queer rape rapist rectal rectum retard scrotum semen sex shit slut
smut sodom sperm tit tits turd twat urine vagina vulva wank whore
abort abuse addict aids alcoholic assault atroc behead bigot blood bomb brutal cadaver cancer carnage casualt
chemo cholera coma corpse crime criminal cripple cruel cult cyst dead death deform dement depress diabet diarrhea
disaster disease dread drown drug dung dying enema epidemic extort famine fatal fraud gang genocide ghetto
gonorrhea grief gun harass hate herpes heroin hitler holocaust homicid hostage hurt illness infect injur insane
kidnap kill leper leprosy leukemia lynch maim malaria massacre measles molest moron morgue murder mutilat nazi
nausea negro overdose pandemic paedophil pedophil pimp plague poison poverty racis rabies rot rotten rob sadis
scam slaughter slave smallpox stab stalk starv stupid suicid syphilis terror thief thieves torture tragedy
tragic traitor tumor tumour ulcer vermin victim violen vomit weapon whip widow wound
sexu sexis sexy faggot fagot chink gayer gayest gunfire gunman gunmen gunner gunpowder gunshot homosexual homophob
cocaine marijuana opium narcotic amphetamine excre urinat defecat coagulat tonsil
titillat lascivious entrails screw abnormal bisexual heterosexual transsexual asexual unisex`);
const ALLOW = new Set(list(`analog analogy analysis analyst analytic analyze analogue cockpit cocktail cockatoo dickens
title titan titanic titanium tithe titular prickle gangly hurtle cumin cumulus cumulative robot robe robin robust
rotary rotate rotor rotunda stalk whippet sextant sexton culture cultural cultivate dreadnought`));
const OTHER_BAD = new Set(list(`ass asses bum butt fat ugly idiot dumb loser pest pus sewer sewage tampon toilet
gay jew jews lesbian arab islam muslim christ jesus nun pope god gods satan devil hell damn evil mad sick
die dies war wars tax pain jail prison lie liar sin sad poor stink stench slum`));

function blocked(w) {
  if (ALLOW.has(w)) return false;
  if (OTHER_BAD.has(w)) return true;
  return BLOCK_STEMS.some(s => s.length >= 4
    ? w.startsWith(s)
    : new RegExp(`^${s}(s|es|ed|ing|er|ers)?$`).test(w));
}

const words = new Set();
const level = {};
for (const f of FILES) {
  const n = Number(f.split('.')[1]);
  for (const line of fs.readFileSync(path.join(src, 'final', f), 'latin1').split(/\r?\n/)) {
    if (/^[a-z]+$/.test(line)) { // skips capitalised names and contractions
      words.add(line);
      level[line] = Math.min(level[line] || 99, n);
    }
  }
}

// ── Quality ───────────────────────────────────────────────────────────────
const root = path.join(__dirname, '..');
const approved = new Set(fs.readFileSync(path.join(__dirname, 'brandable-words.txt'), 'utf8')
  .split(/\r?\n/).filter(l => !l.startsWith('#')).join(' ').trim().split(/\s+/));
const generator = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const bank of ['W_TECH', 'W_ACTION', 'W_NATURE', 'W_QUALITY', 'W_OBJECT', 'W_ANIMAL']) {
  const m = generator.match(new RegExp(`const ${bank}=\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`word bank ${bank} not found in index.html`);
  m[1].match(/[a-z]+/g).forEach(w => approved.add(w));
}
const intel = JSON.parse(fs.readFileSync(path.join(root, 'data', 'aftermarket-intelligence.json'), 'utf8'));
[...intel.nouns, ...intel.modifiers, ...intel.dictionary_words].forEach(w => approved.add(w));
approved.forEach(w => words.add(w));

const sentiment = {};
for (const line of fs.readFileSync(vaderFile, 'utf8').split(/\r?\n/)) {
  const [w, v] = line.split('\t');
  if (/^[a-z]+$/.test(w || '')) sentiment[w] = Number(v);
}
const NEGATIVE = -0.8;
// Forms of a negative word: "dreary" from "drear", "hostility" from "hostile".
const NEG_FORMS = [['ly', ''], ['ness', ''], ['ful', ''], ['ity', ''], ['ity', 'e'], ['ion', 'e'], ['ion', ''], ['ment', ''],
  ['ive', 'e'], ['or', 'e'], ['er', 'e'], ['er', ''], ['ous', ''], ['y', '']];
const isNegative = w => sentiment[w] <= NEGATIVE ||
  NEG_FORMS.some(([suffix, add]) => w.endsWith(suffix) && sentiment[w.slice(0, -suffix.length) + add] <= NEGATIVE);
const badShape = w => /(ness|ism|ology|itis|osis|ectomy|ical|ically)$/.test(w) ||
  ['un', 'dis', 'mis', 'non', 'anti', 'im', 'in', 'ir', 'il', 'mal'].some(p =>
    w.startsWith(p) && w.length - p.length >= 4 && words.has(w.slice(p.length)));
// Irregular verb forms the plural and -ed rules can't catch.
const VERB_FORMS = new Set(list(`ate awoke became began bent bit bled blew bought brought built burnt caught chose came crept dealt
did drank drew driven drove dug eaten fed felt flew forgave forgot fought found froze gave given goes going gone got gotten grew
grown had heard held hid hung kept knew known laid led left lent lit lost made meant met paid ran rang rode rose said sang sank
sat saw seen sent shook shot shown shut slept slid sold sought spent spoke spoken stole stood struck sung sunk swept swam swore
swum taken taught thought threw thrown told took tore torn understood went woke won wore worn wove written wrote
get gets say says make makes`));
const goodQuality = w => approved.has(w) || (level[w] <= 20 && !isNegative(w) && !badShape(w) && !VERB_FORMS.has(w));

// A plural or verb form makes a weak name next to its base word.
function inflected(w) {
  const has = x => x.length >= MIN_LEN && words.has(x);
  if (/ss$/.test(w)) return false;
  if (/ies$/.test(w) && has(w.slice(0, -3) + 'y')) return true;
  if (/es$/.test(w) && has(w.slice(0, -2))) return true;
  if (/s$/.test(w) && has(w.slice(0, -1))) return true;
  if (/ied$/.test(w) && has(w.slice(0, -3) + 'y')) return true;
  if (/ed$/.test(w) && (has(w.slice(0, -2)) || has(w.slice(0, -1)) || has(w.slice(0, -3)))) return true;
  if (/ing$/.test(w) && (has(w.slice(0, -3)) || has(w.slice(0, -3) + 'e') || has(w.slice(0, -4)))) return true;
  // Comparatives, superlatives and adverbs. An -er word only counts as a
  // comparative if its -est form exists: drop "loyaler", keep "reader".
  if (/iest$/.test(w) && has(w.slice(0, -4) + 'y')) return true;
  if (/est$/.test(w) && (has(w.slice(0, -3)) || has(w.slice(0, -2)) || has(w.slice(0, -4)))) return true;
  if (/er$/.test(w) && words.has(w.slice(0, -2) + 'est')) return true;
  if (/ier$/.test(w) && words.has(w.slice(0, -3) + 'iest')) return true;
  if (/ly$/.test(w) && (has(w.slice(0, -2)) || has(w.slice(0, -3) + 'y') || has(w.slice(0, -2) + 'e') || has(w.slice(0, -1) + 'e'))) return true;
  return false;
}

const out = [...words].filter(w =>
  w.length >= MIN_LEN && w.length <= MAX_LEN && /[aeiouy]/.test(w) &&
  !FUNCTION_WORDS.has(w) && !blocked(w) && (approved.has(w) || !inflected(w))
).sort();
const high = out.filter(goodQuality);
const broadOnly = out.filter(w => !goodQuality(w));

const data = path.join(root, 'data');
fs.writeFileSync(path.join(data, 'english-words.json'), JSON.stringify({
  _source: 'SCOWL 2020.12.07 and VADER, filtered by scripts/build-english-words.js. Licences: data/english-words-LICENSE.txt',
  words: high,      // Word quality: High
  broad: broadOnly  // added to the above for Word quality: Broad
}) + '\n');
fs.writeFileSync(path.join(data, 'english-words-LICENSE.txt'),
  `Word list: SCOWL\n\n${fs.readFileSync(path.join(src, 'Copyright'), 'latin1')}\n\nSentiment ratings used to filter the list: VADER\n\n${fs.readFileSync(vaderLicense, 'utf8')}`);
console.log(`${words.size} source words -> ${high.length} high quality, ${out.length} broad`);
