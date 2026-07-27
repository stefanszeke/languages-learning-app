'use strict';

// One-time build step: streams the FreeDict deu-eng TEI dictionary (GPLv3+/AGPLv3+,
// generated from the Ding dictionary, https://freedict.org/) into a flat headword ->
// English gloss lookup table, mirroring build-dictionary.js's JMdict pipeline. The
// source file is ~450MB (517k headwords, including inflected verb forms like
// "redet"), too big to keep in the repo, so this reads it from vendor/dict/deu-eng.tei
// and expects that file to be deleted again once the .gz output below is produced.
//
// Re-run manually if the dictionary is ever refreshed:
//   1. Download the "*.src.tar.xz" release from https://download.freedict.org/dictionaries/deu-eng/
//   2. Extract it and copy deu-eng/deu-eng.tei into vendor/dict/deu-eng.tei
//   3. node scripts/build-german-english-dictionary.js
//   4. Delete vendor/dict/deu-eng.tei again (only the .gz output is committed)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourcePath = path.join(DICT_DIR, 'deu-eng.tei');
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Expected ${sourcePath}. Download freedict-deu-eng-*.src.tar.xz from https://download.freedict.org/dictionaries/deu-eng/ and extract deu-eng.tei there first.`);
}

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Unlike jmdict-simplified (which flags entries "common" and orders them by
// that), Ding/FreeDict has no frequency signal at all, and its own entry
// order isn't reliable either: e.g. "Hund" has 3 entries, and the mining-jargon
// one ("mine car"/"mine tub") happens to come *before* the everyday "dog" one.
// So instead of "first entry wins", each headword's competing entries are
// compared by their own first gloss's word count then length, and the entry
// with the shortest first gloss wins -- a short, plain gloss is a reasonable
// proxy for "the common/basic sense" when nothing better is available.
//
// That alone still prefers an obscure short synonym over a longer common one
// (e.g. "aye" beats "always" for "immer"). Ding tags some glosses with a
// <usg type="hint">obs.</usg>-style marker for exactly this case -- but only
// the small set below, which flags the gloss itself as outdated/rare/archaic.
// Domain markers like <usg type="dom">zool.</usg> or <usg type="hint">jur.</usg>
// are deliberately NOT included here: they categorize subject matter, not
// obscurity, and often sit on the *correct* everyday sense (Hund's "dog" entry
// carries "zool."), so treating them as deprioritizing would break more than
// it fixes. An entry whose first gloss carries one of these markers only loses
// to an unmarked entry for the same headword; if every entry is marked, the
// normal shortest-first-gloss comparison still picks one.
const RESTRICTIVE_HINTS = new Set(['obs.', 'veraltet', 'veraltend', 'archaic', 'dated', 'becoming dated', 'rare', 'selten']);
const bestByHeadword = Object.create(null);
let entryCount = 0;

// The TEI is pretty-printed with a consistent 2-space indent, which is enough to
// tell a headword's direct <sense><cit type="trans"><quote xml:lang="en"> glosses
// (what we want) apart from the same tags nested one level deeper inside an
// <cit type="example"> block (a translated example sentence, not a headword
// gloss) -- both can appear at the same nominal tag depth, but the example's
// English quote is indented 2 spaces further than a direct gloss quote.
let entryIndent = -1;
let headword = '';
let inForm = false;
let glosses = [];
let glossRestricted = [];

function firstGlossWeight(gloss) {
  return [gloss.split(/\s+/).length, gloss.length];
}

function isBetter(weightA, weightB) {
  return weightA[0] !== weightB[0] ? weightA[0] < weightB[0] : weightA[1] < weightB[1];
}

function flushEntry() {
  if (headword && glosses.length) {
    const restricted = glossRestricted[0] || false;
    const weight = firstGlossWeight(glosses[0]);
    const existing = bestByHeadword[headword];
    if (!existing) {
      bestByHeadword[headword] = {glosses, weight, restricted};
    } else if (existing.restricted && !restricted) {
      bestByHeadword[headword] = {glosses, weight, restricted};
    } else if (existing.restricted === restricted && isBetter(weight, existing.weight)) {
      bestByHeadword[headword] = {glosses, weight, restricted};
    }
    entryCount += 1;
  }
  entryIndent = -1;
  headword = '';
  inForm = false;
  glosses = [];
  glossRestricted = [];
}

const rl = readline.createInterface({input: fs.createReadStream(sourcePath, 'utf8'), crlfDelay: Infinity});

rl.on('line', line => {
  const indent = line.length - line.trimStart().length;
  const trimmed = line.trim();

  if (/^<entry[\s>]/.test(trimmed)) {
    flushEntry();
    entryIndent = indent;
    return;
  }
  if (trimmed === '</entry>') {
    flushEntry();
    return;
  }
  if (entryIndent < 0) return;

  if (trimmed === '<form>') { inForm = true; return; }
  if (trimmed === '</form>') { inForm = false; return; }
  if (inForm && !headword) {
    const orthMatch = trimmed.match(/^<orth[^>]*>(.*)<\/orth>$/);
    if (orthMatch) { headword = decodeXmlEntities(orthMatch[1]); return; }
  }

  if (indent === entryIndent + 6) {
    const quoteMatch = trimmed.match(/^<quote xml:lang="en">(.*)<\/quote>$/);
    if (quoteMatch) {
      glosses.push(decodeXmlEntities(quoteMatch[1]));
      glossRestricted.push(false);
      return;
    }
    const hintMatch = trimmed.match(/^<usg type="hint">(.*)<\/usg>$/);
    if (hintMatch && glosses.length && RESTRICTIVE_HINTS.has(decodeXmlEntities(hintMatch[1]))) {
      glossRestricted[glossRestricted.length - 1] = true;
    }
  }
});

rl.on('close', () => {
  const lookup = Object.create(null);
  for (const [word, best] of Object.entries(bestByHeadword)) {
    lookup[word] = best.glosses.slice(0, 3).join('; ');
  }

  const json = JSON.stringify(lookup);
  const outPath = path.join(DICT_DIR, 'german-english-lookup.json.gz');
  fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

  console.log(`${entryCount} entries, ${Object.keys(lookup).length} headwords, ${(json.length / 1024 / 1024).toFixed(1)}MB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
  console.log(`Written to ${outPath}`);
});
