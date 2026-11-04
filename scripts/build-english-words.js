#!/usr/bin/env node
/**
 * Builds data/english-words.json, the word list behind the generator's
 * "Dictionary words" mode, and the licence notice that must ship with it.
 *
 * Source: SCOWL 2020.12.07 (permissive, commercial use allowed). Do not swap in
 * the Google Trillion Word lists: their terms exclude commercial use.
 *
 * Usage: node scripts/build-english-words.js <path-to-extracted-scowl>
 * Download: deb.debian.org/debian/pool/main/s/scowl/scowl_2020.12.07.orig.tar.gz
 */
'use strict';
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/build-english-words.js <scowl-dir>'); process.exit(1); }

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
everyone everything nobody nothing somebody someone something anybody anyone anything etc per via versus amen`));

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
for (const f of FILES) {
  for (const line of fs.readFileSync(path.join(src, 'final', f), 'latin1').split(/\r?\n/)) {
    if (/^[a-z]+$/.test(line)) words.add(line); // skips capitalised names and contractions
  }
}

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
  !FUNCTION_WORDS.has(w) && !inflected(w) && !blocked(w)
).sort();

const data = path.join(__dirname, '..', 'data');
fs.writeFileSync(path.join(data, 'english-words.json'), JSON.stringify({
  _source: 'SCOWL 2020.12.07, filtered by scripts/build-english-words.js. Licence: data/english-words-LICENSE.txt',
  words: out
}) + '\n');
fs.copyFileSync(path.join(src, 'Copyright'), path.join(data, 'english-words-LICENSE.txt'));
console.log(`${words.size} source words -> ${out.length} kept`);
