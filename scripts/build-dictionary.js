'use strict';

// One-time build step: compresses the full jmdict-simplified "common words"
// export (nested JSON, ~16MB) down to a flat surface-form -> English gloss
// lookup table that's small enough to ship to the browser and load with a
// single fetch. Re-run this manually if vendor/dict/jmdict-eng-common-*.json
// is ever replaced with a newer release.
//
// Also emits a kana-reading -> preferred-kanji cross-reference. jmdict-simplified
// groups each word's kanji/kana forms together, but once flattened into
// {headword: gloss} that link is gone -- without it, picking a kana-only match
// (e.g. from Romaji autocomplete, which can only ever match kana readings)
// has no way to fill in the word's actual kanji, only its reading.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourceFile = fs.readdirSync(DICT_DIR).find(name => /^jmdict-eng-common-.*\.json$/.test(name));
if (!sourceFile) {
  throw new Error(`No jmdict-eng-common-*.json found in ${DICT_DIR}. Download it from https://github.com/scriptin/jmdict-simplified/releases first.`);
}

const source = JSON.parse(fs.readFileSync(path.join(DICT_DIR, sourceFile), 'utf8'));
const glosses = Object.create(null);
const kanaToKanji = Object.create(null);

for (const entry of source.words) {
  // A word can have several distinct senses (e.g. 肉 = "flesh" as sense 1,
  // "meat" as sense 2) -- taking only the first sense drops real, common
  // meanings. Take one representative gloss from each of the first several
  // senses instead, so multi-meaning words keep their other senses too.
  const senses = entry.sense.filter(sense => sense.gloss.some(gloss => gloss.lang === 'eng'));
  if (!senses.length) continue;
  const englishGlosses = senses.slice(0, 6).map(sense => sense.gloss.find(gloss => gloss.lang === 'eng').text);
  const english = englishGlosses.join('; ');

  const kanjiForms = entry.kanji.filter(item => item.common).map(item => item.text);
  const kanaForms = entry.kana.filter(item => item.common).map(item => item.text);
  const headwords = [...kanjiForms, ...kanaForms];
  for (const headword of headwords) {
    // Multiple JMdict entries can share a headword (e.g. homographs); keep
    // whichever gloss set we saw first, since jmdict-simplified already
    // orders entries by how common/well-known they are.
    if (!(headword in glosses)) glosses[headword] = english;
  }

  if (kanjiForms.length) {
    for (const kana of kanaForms) {
      if (!(kana in kanaToKanji)) kanaToKanji[kana] = kanjiForms[0];
    }
  }
}

const json = JSON.stringify({glosses, kanaToKanji});
const outPath = path.join(DICT_DIR, 'jmdict-lookup.json.gz');
fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

console.log(`${Object.keys(glosses).length} headwords, ${Object.keys(kanaToKanji).length} kana->kanji links, ${(json.length / 1024 / 1024).toFixed(1)}MB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
console.log(`Written to ${outPath}`);
