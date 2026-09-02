'use strict';

// One-off audit: tokenizes every sentence in data/japanese-sentences.js with
// kuromoji and reports any content word (noun/verb/adjective/adverb) whose
// dictionary form isn't already present anywhere in data/japanese-words.js.
// Catches words that slipped in via a sentence without ever being tagged
// "NEW WORD" by Duolingo (e.g. mazui) -- Duolingo's tag reflects its own
// lesson sequencing, not what's actually missing from this collection.
//
// Usage: node scripts/audit-missing-words.js [--since=<sentenceId>]
//   --since=234   only check sentences with id >= 234 (e.g. the most recent
//                 screenshot batch), instead of the entire sentence history.
//                 Running against the full corpus is noisy: it also flags
//                 older sentences that were deliberately left off the word
//                 list, and sentences with no real kanji (kanji === kana)
//                 tokenize poorly, adding garbage candidates.

const fs = require('fs');
const path = require('path');
const kuromoji = require('kuromoji');

const ROOT = path.join(__dirname, '..');
const WORDS_PATH = path.join(ROOT, 'data', 'japanese-words.js');
const SENTENCES_PATH = path.join(ROOT, 'data', 'japanese-sentences.js');
const DIC_PATH = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');

const WORD_POS = new Set(['名詞', '動詞', '形容詞', '副詞']);

function loadDataFile(filePath, globalName) {
  const sandbox = {};
  new Function('window', fs.readFileSync(filePath, 'utf8'))(sandbox);
  return sandbox[globalName];
}

function katakanaToHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function buildKnownSet(words) {
  const known = new Set();
  for (const word of words) {
    for (const field of [word.kanji, word.kana]) {
      if (!field) continue;
      for (const form of String(field).split('/')) {
        const trimmed = katakanaToHiragana(form.trim());
        if (trimmed) known.add(trimmed);
      }
    }
  }
  return known;
}

function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({dicPath: DIC_PATH}).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });
}

async function main() {
  const sinceArg = process.argv.find((arg) => arg.startsWith('--since='));
  const since = sinceArg ? Number(sinceArg.slice('--since='.length)) : null;

  const words = loadDataFile(WORDS_PATH, 'INITIAL_WORDS');
  let sentences = loadDataFile(SENTENCES_PATH, 'INITIAL_SENTENCES');
  if (since !== null) sentences = sentences.filter((s) => s.id >= since);
  const known = buildKnownSet(words);
  const tokenizer = await buildTokenizer();

  const missing = new Map(); // normalized form -> {surfaceForms:Set, sentences:Set}

  for (const sentence of sentences) {
    const text = sentence.kanji || sentence.kana;
    if (!text) continue;
    const tokens = tokenizer.tokenize(text);
    for (const token of tokens) {
      if (!WORD_POS.has(token.pos)) continue;
      const basic = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form;
      const normalized = katakanaToHiragana(basic);
      if (normalized.length <= 1 && !/[一-龯]/.test(basic)) continue; // skip single-kana particles/fragments
      if (known.has(normalized) || known.has(katakanaToHiragana(token.surface_form))) continue;
      if (!missing.has(normalized)) missing.set(normalized, {surfaceForms: new Set(), sentences: new Set()});
      missing.get(normalized).surfaceForms.add(basic);
      missing.get(normalized).sentences.add(`${sentence.id}: ${sentence.english}`);
    }
  }

  if (!missing.size) {
    console.log('No missing words found -- every content word in the sentences is covered.');
    return;
  }

  console.log(`${missing.size} candidate word(s) appear in sentences but not in japanese-words.js:\n`);
  for (const [normalized, info] of missing) {
    console.log(`- ${[...info.surfaceForms].join(' / ')} (${normalized})`);
    for (const ex of info.sentences) console.log(`    e.g. ${ex}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
