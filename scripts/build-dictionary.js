'use strict';

// One-time build step: compresses the full jmdict-simplified "common words"
// export (nested JSON, ~16MB) down to a flat surface-form -> English gloss
// lookup table that's small enough to ship to the browser and load with a
// single fetch. Re-run this manually if vendor/dict/jmdict-eng-common-*.json
// is ever replaced with a newer release.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourceFile = fs.readdirSync(DICT_DIR).find(name => /^jmdict-eng-common-.*\.json$/.test(name));
if (!sourceFile) {
  throw new Error(`No jmdict-eng-common-*.json found in ${DICT_DIR}. Download it from https://github.com/scriptin/jmdict-simplified/releases first.`);
}

const source = JSON.parse(fs.readFileSync(path.join(DICT_DIR, sourceFile), 'utf8'));
const lookup = Object.create(null);

for (const entry of source.words) {
  const firstSense = entry.sense.find(sense => sense.gloss.some(gloss => gloss.lang === 'eng'));
  if (!firstSense) continue;
  const glosses = firstSense.gloss.filter(gloss => gloss.lang === 'eng').map(gloss => gloss.text);
  if (!glosses.length) continue;
  const english = glosses.slice(0, 3).join('; ');

  const headwords = [...entry.kanji, ...entry.kana].filter(item => item.common).map(item => item.text);
  for (const headword of headwords) {
    // Multiple JMdict entries can share a headword (e.g. homographs); keep
    // whichever gloss set we saw first, since jmdict-simplified already
    // orders entries by how common/well-known they are.
    if (!(headword in lookup)) lookup[headword] = english;
  }
}

const json = JSON.stringify(lookup);
const outPath = path.join(DICT_DIR, 'jmdict-lookup.json.gz');
fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

console.log(`${Object.keys(lookup).length} headwords, ${(json.length / 1024 / 1024).toFixed(1)}MB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
console.log(`Written to ${outPath}`);
