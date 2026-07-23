'use strict';

// One-time build step: compresses the German nouns dataset (gambolputty/german-nouns,
// ~100k lemmas with grammatical gender, CC BY-SA 4.0, sourced from Wiktionary DE) down
// to a flat lemma -> der/die/das lookup table small enough to ship to the browser.
// Re-run manually if vendor/dict/nouns.csv is ever replaced with a newer release:
// https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourcePath = path.join(DICT_DIR, 'nouns.csv');
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Expected ${sourcePath}. Download it from https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv first.`);
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const GENDER_BY_LETTER = {m: 'der', f: 'die', n: 'das'};
const NOUN_LEMMA_PATTERN = /^[A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ]*$/;

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).filter(Boolean);
const header = parseCsvLine(lines[0]);
const lemmaIndex = header.indexOf('lemma');
const posIndex = header.indexOf('pos');
const genusIndex = header.indexOf('genus');

const lookup = Object.create(null);
const conflicted = new Set();

for (let i = 1; i < lines.length; i++) {
  const columns = parseCsvLine(lines[i]);
  const lemma = columns[lemmaIndex];
  const pos = columns[posIndex] || '';
  const article = GENDER_BY_LETTER[columns[genusIndex]];
  if (!article || !lemma || !NOUN_LEMMA_PATTERN.test(lemma) || !pos.includes('Substantiv')) continue;

  if (lemma in lookup) {
    if (lookup[lemma] !== article) conflicted.add(lemma);
    continue;
  }
  lookup[lemma] = article;
}

// Homonyms with different genders (e.g. "der Kiefer" jaw vs "die Kiefer" pine) are
// ambiguous from the lemma alone, so drop them rather than guess wrong.
conflicted.forEach(lemma => delete lookup[lemma]);

const json = JSON.stringify(lookup);
const outPath = path.join(DICT_DIR, 'german-gender-lookup.json.gz');
fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

console.log(`${Object.keys(lookup).length} lemmas (${conflicted.size} ambiguous dropped), ${(json.length / 1024 / 1024).toFixed(1)}MB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
console.log(`Written to ${outPath}`);
