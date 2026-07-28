'use strict';

// One-time build step: compresses the german-adjectives-dict dataset (RosaeNLG
// project, built from languagetool-org/german-pos-dict / Morphy, CC BY-SA 4.0
// -- same license family as the vendored gambolputty/german-nouns dataset) down
// to a flat array of adjective lemmas, small enough to ship to the browser.
// Only the lemmas are kept; the source file's full declension tables aren't
// needed for a simple "is this word an adjective" lookup.
// Re-run manually if vendor/dict/german-adjectives-raw.json is ever replaced
// with a newer release:
// https://unpkg.com/german-adjectives-dict@3.4.0/dist/adjectives.json

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourcePath = path.join(DICT_DIR, 'german-adjectives-raw.json');
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Expected ${sourcePath}. Download it from https://unpkg.com/german-adjectives-dict@3.4.0/dist/adjectives.json first.`);
}

const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const lemmas = Object.keys(data);

const json = JSON.stringify(lemmas);
const outPath = path.join(DICT_DIR, 'german-adjective-lookup.json.gz');
fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

console.log(`${lemmas.length} lemmas, ${(json.length / 1024 / 1024).toFixed(1)}MB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
console.log(`Written to ${outPath}`);
