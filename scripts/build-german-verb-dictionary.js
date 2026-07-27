'use strict';

// One-time build step: turns viorelsfetea/german-verbs-database's conjugation
// CSV (sourced from Wiktionary DE, CC BY-SA -- same lineage as the gambolputty
// german-nouns dataset already used for the gender lookup) into two small
// lookup tables that let suggestGermanWords() expand a single OCR'd verb
// token (e.g. "bricht") into this app's personal-collection convention of a
// full 5-form entry, matching the pattern already used throughout
// data/german-words.js:
//   english: "sound / I sound / it sounds / you sound / we sound"
//   german:  "klingen / ich klinge / es klingt / du klingst / wir klingen"
//
// Output shape (vendor/dict/german-verb-lookup.json.gz):
//   {
//     forms: { <lowercased inflected token>: <infinitive>, ... },
//     verbs: { <infinitive>: {german: "<5-slot string>", english: "<5-slot string>"}, ... }
//   }
// `forms` is an index so app.js can look up any raw token in one step; `verbs`
// holds the actual precomputed 5-slot strings so no conjugation logic (English
// 3rd-person inflection, wir-form derivation, pronoun choice) needs to run in
// the browser at all -- it's all baked in here at build time.
//
// Re-run manually if the source data or the curated gloss list changes:
//   1. Download https://raw.githubusercontent.com/viorelsfetea/german-verbs-database/master/output/verbs.csv
//      into vendor/dict/german-verbs-raw.csv
//   2. node scripts/build-german-verb-dictionary.js
//   3. Delete vendor/dict/german-verbs-raw.csv again (only the .gz output is committed)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DICT_DIR = path.join(__dirname, '..', 'vendor', 'dict');
const sourcePath = path.join(DICT_DIR, 'german-verbs-raw.csv');
if (!fs.existsSync(sourcePath)) {
  throw new Error(`Expected ${sourcePath}. Download verbs.csv from https://github.com/viorelsfetea/german-verbs-database (output/verbs.csv) and place it there first.`);
}

const commonGlosses = require('./german-common-verb-glosses.js');

const englishDictPath = path.join(DICT_DIR, 'german-english-lookup.json.gz');
const freedictLookup = fs.existsSync(englishDictPath)
  ? JSON.parse(zlib.gunzipSync(fs.readFileSync(englishDictPath)))
  : {};

function freedictGloss(infinitive) {
  const raw = freedictLookup[infinitive];
  if (!raw) return '';
  // Ding glosses are often "sense one; sense two; ..." -- take just the first,
  // shortest-and-plainest sense (the same one the base dictionary already
  // picked), since this feature needs one clean base verb, not an inventory.
  return raw.split(';')[0].trim();
}

// Minimal state-machine CSV parser (not a naive split-on-comma): a handful of
// rows in this dataset have HTML-comment junk or nested quoted commas in
// their later columns (e.g. `"derwischt, derwuschen"`, or a stray
// `<!-- |Hilfsverb*=sein -->` line swallowed into a quoted field spanning two
// physical lines) which would otherwise misalign every column after it.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// A small verb has no plain 1st/2nd/3rd-person present tense at all (it's
// only ever used impersonally, "es regnet"), so it's excluded from the
// conjugation-set output entirely rather than producing a nonsensical
// "ich regne" slot -- weather verbs are the only ones removed for this reason.
const IMPERSONAL_ONLY_VERBS = new Set(['regnen', 'schneien', 'hageln', 'donnern', 'blitzen']);

// Verbs whose natural 3rd-person subject in everyday speech is "it", not
// "he" -- confirmed against the user's own collection (klingen/riechen
// already use "es"/"it" in data/german-words.js), extended to the same
// small set of sense/appearance/success verbs the curated gloss list covers.
const IT_PRONOUN_VERBS = new Set([
  'klingen', 'riechen', 'schmecken', 'aussehen', 'scheinen', 'vorkommen',
  'gelingen', 'misslingen', 'funktionieren', 'klappen', 'stattfinden'
]);

// English modals (can/must/should/may/might/shall/will) take no 3rd-person
// -s at all ("he can", not "he cans") -- mapped to themselves so the normal
// inflection rule below never touches them.
const IRREGULAR_ENGLISH_3RD = {
  be: 'is', have: 'has', do: 'does', go: 'goes',
  can: 'can', must: 'must', should: 'should', may: 'may',
  might: 'might', shall: 'shall', will: 'will'
};

// "sein" is the sole verb whose wir-form isn't its bare infinitive ("wir
// sind", not "wir sein") -- a standard-grammar constant, not derivable from
// the CSV's columns, so it's special-cased the same way as sein's missing
// row above.
const WIR_FORM_OVERRIDES = {sein: 'sind'};

function inflectEnglishFirstWord(word) {
  if (IRREGULAR_ENGLISH_3RD[word]) return IRREGULAR_ENGLISH_3RD[word];
  if (/[sxz]$|[cs]h$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function englishThirdPerson(base) {
  const words = base.split(' ');
  words[0] = inflectEnglishFirstWord(words[0]);
  return words.join(' ');
}

function buildEnglishSet(base, pronoun) {
  const third = englishThirdPerson(base);
  return `${base} / I ${base} / ${pronoun} ${third} / you ${base} / we ${base}`;
}

function buildGermanSet(infinitive, ich, du, er, pronoun) {
  const wir = deriveWirForm(infinitive, ich);
  return `${infinitive} / ich ${ich} / ${pronoun} ${er} / du ${du} / wir ${wir}`;
}

// German 1st-person-plural present tense equals the bare infinitive for
// virtually every verb. For separable-prefix verbs (whose ich-form is two
// words, e.g. "stehe auf"), the infinitive already has the prefix glued to
// the front ("aufstehen"), so the wir-form needs the prefix moved back to
// the end instead ("stehen auf") -- verified against the user's own
// "aufstehen" entry ("wir stehen auf").
function deriveWirForm(infinitive, ich) {
  if (WIR_FORM_OVERRIDES[infinitive]) return WIR_FORM_OVERRIDES[infinitive];
  const spaceIndex = ich.indexOf(' ');
  if (spaceIndex === -1) return infinitive;
  const prefix = ich.slice(spaceIndex + 1);
  return infinitive.startsWith(prefix) ? `${infinitive.slice(prefix.length)} ${prefix}` : infinitive;
}

// A malformed/unusable row: markup leftovers (<small>, HTML comments),
// placeholder dashes for missing imperative forms leaking into a field we
// use, or empty required columns.
function isUsableToken(value) {
  return Boolean(value) && !/[<>=]/.test(value) && value !== '—';
}

const rows = parseCsv(fs.readFileSync(sourcePath, 'utf8'));
const header = rows[0];
if (!header || header[0] !== 'Infinitive') {
  throw new Error('Unexpected CSV header -- has the source format changed?');
}

// `sein` ("to be"), German's single most important and irregular verb, has no
// row in this dataset at all -- confirmed by an explicit grep for `^sein,`
// returning nothing. Its forms are standard-grammar constants, not sourced
// data, so they're hardcoded here rather than left out of the feature.
const verbRows = [{infinitive: 'sein', ich: 'bin', du: 'bist', er: 'ist'}];
for (let i = 1; i < rows.length; i += 1) {
  const [infinitive, ich, du, er] = rows[i];
  if (![infinitive, ich, du, er].every(isUsableToken)) continue;
  verbRows.push({infinitive, ich, du, er});
}

const verbs = Object.create(null);
const forms = Object.create(null);
let skippedNoGloss = 0;

// Bare verbs are claimed first so a separable/prefixed sibling sharing the
// same stem token (e.g. "breche" from both bare "brechen" and prefixed
// "abbrechen") never overwrites the bare verb's claim -- see the module
// doc comment above about why a single stem token can't disambiguate which
// prefixed verb it belongs to from the token alone. Sorting bare-first
// makes claim order deterministic instead of depending on CSV row order.
verbRows.sort((a, b) => {
  const aBare = a.ich.indexOf(' ') === -1;
  const bBare = b.ich.indexOf(' ') === -1;
  return aBare === bBare ? 0 : aBare ? -1 : 1;
});

for (const {infinitive, ich, du, er} of verbRows) {
  if (IMPERSONAL_ONLY_VERBS.has(infinitive)) continue;
  if (verbs[infinitive]) continue;

  const base = commonGlosses[infinitive] || freedictGloss(infinitive);
  if (!base) { skippedNoGloss += 1; continue; }

  const pronoun = IT_PRONOUN_VERBS.has(infinitive) ? 'it' : 'he';
  const germanPronoun = IT_PRONOUN_VERBS.has(infinitive) ? 'es' : 'er';
  verbs[infinitive] = {
    german: buildGermanSet(infinitive, ich, du, er, germanPronoun),
    english: buildEnglishSet(base, pronoun)
  };

  const ichStem = ich.split(' ')[0];
  const duStem = du.split(' ')[0];
  const erStem = er.split(' ')[0];
  const isBare = ich.indexOf(' ') === -1;
  for (const token of new Set([infinitive, ichStem, duStem, erStem])) {
    const key = token.toLowerCase();
    if (!forms[key]) forms[key] = infinitive;
    // Bare verbs were sorted first above, so the first claim already IS the
    // bare form when one exists; nothing to overwrite here.
  }
}

const output = {forms, verbs};
const json = JSON.stringify(output);
const outPath = path.join(DICT_DIR, 'german-verb-lookup.json.gz');
fs.writeFileSync(outPath, zlib.gzipSync(json, {level: 9}));

console.log(`${Object.keys(verbs).length} verbs, ${Object.keys(forms).length} surface forms, ${skippedNoGloss} skipped for lack of an English gloss`);
console.log(`${(json.length / 1024).toFixed(0)}KB raw -> ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB gzipped`);
console.log(`Written to ${outPath}`);
