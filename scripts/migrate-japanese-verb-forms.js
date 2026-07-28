// One-time migration: expands every verb entry in data/japanese-words.js
// into this app's 4-form set (dictionary / polite / past / negative), the
// Japanese analogue of the German 5-form conjugation strings already stored
// in data/german-words.js. Mirrors the conjugation engine and dictionary-form
// reduction now built into app.js's autoFillJapaneseDialogFields/
// enrichWithTokenizer so migrated entries behave identically to a freshly
// typed or OCR'd verb.
//
// Usage:
//   node scripts/migrate-japanese-verb-forms.js            (dry run, prints diff)
//   node scripts/migrate-japanese-verb-forms.js --apply     (writes data/japanese-words.js)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const kuromoji = require('kuromoji');

const ROOT = path.join(__dirname, '..');
const WORDS_PATH = path.join(ROOT, 'data', 'japanese-words.js');
const DICT_PATH = path.join(ROOT, 'vendor', 'dict', 'jmdict-lookup.json.gz');
const DIC_PATH = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');

const APPLY = process.argv.includes('--apply');

// ---- kanaToRomaji / katakanaToHiragana, copied verbatim from app.js -------
function katakanaToHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

const ROMAJI_MAP = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', っ: '',
  ー: '',
};
const SMALL_Y = new Set(['ゃ', 'ゅ', 'ょ']);
function kanaToRomaji(input) {
  if (!input) return '';
  const kana = katakanaToHiragana(input);
  let result = '';
  for (let i = 0; i < kana.length; i += 1) {
    const char = kana[i];
    const next = kana[i + 1];
    if (char === 'っ' && next) {
      const nextRomaji = ROMAJI_MAP[next];
      if (nextRomaji) {
        result += nextRomaji[0];
        continue;
      }
    }
    if (SMALL_Y.has(next) && ROMAJI_MAP[char]) {
      const base = ROMAJI_MAP[char].replace(/i$/, '');
      result += base + ROMAJI_MAP[next];
      i += 1;
      continue;
    }
    result += ROMAJI_MAP[char] !== undefined ? ROMAJI_MAP[char] : char;
  }
  return result;
}

// ---- conjugation engine, copied verbatim from app.js -----------------------
const GODAN_TAILS = {
  'う': {nai: 'わない', masu: 'います', ta: 'った'},
  'く': {nai: 'かない', masu: 'きます', ta: 'いた'},
  'ぐ': {nai: 'がない', masu: 'ぎます', ta: 'いだ'},
  'す': {nai: 'さない', masu: 'します', ta: 'した'},
  'つ': {nai: 'たない', masu: 'ちます', ta: 'った'},
  'ぬ': {nai: 'なない', masu: 'にます', ta: 'んだ'},
  'ぶ': {nai: 'ばない', masu: 'びます', ta: 'んだ'},
  'む': {nai: 'まない', masu: 'みます', ta: 'んだ'},
  'る': {nai: 'らない', masu: 'ります', ta: 'った'},
};

function buildTailForms(base, stripLen, tails) {
  const stem = base.slice(0, -stripLen);
  return {dict: base, masu: stem + tails.masu, ta: stem + tails.ta, nai: stem + tails.nai};
}

async function conjugateJapaneseVerb(analyzer, kanjiBase, kanaBase) {
  if (!analyzer || !kanaBase || !kanjiBase) return null;
  if (kanjiBase.includes('/') || kanaBase.includes('/')) return null;

  if (kanaBase.endsWith('する')) {
    const tails = {masu: 'します', ta: 'した', nai: 'しない'};
    return {kanji: buildTailForms(kanjiBase, 2, tails), kana: buildTailForms(kanaBase, 2, tails)};
  }

  if (kanaBase === 'くる') {
    const kanaForms = {dict: 'くる', masu: 'きます', ta: 'きた', nai: 'こない'};
    const hasKanji = kanjiBase !== kanaBase;
    return {
      kanji: hasKanji ? buildTailForms(kanjiBase, 1, {masu: 'ます', ta: 'た', nai: 'ない'}) : kanaForms,
      kana: kanaForms,
    };
  }

  if (kanaBase === 'いる') {
    const tails = {masu: 'ます', ta: 'た', nai: 'ない'};
    return {kanji: buildTailForms(kanjiBase, 1, tails), kana: buildTailForms(kanaBase, 1, tails)};
  }

  let verbToken;
  try {
    verbToken = (await analyzer.parse(kanjiBase))[0];
  } catch (error) {
    return null;
  }
  if (!verbToken || verbToken.pos !== '動詞') return null;
  const type = verbToken.conjugated_type || '';
  const lastChar = kanaBase.slice(-1);

  if (type.startsWith('一段')) {
    const tails = {masu: 'ます', ta: 'た', nai: 'ない'};
    return {kanji: buildTailForms(kanjiBase, 1, tails), kana: buildTailForms(kanaBase, 1, tails)};
  }

  if (type.startsWith('五段')) {
    const tails = GODAN_TAILS[lastChar];
    if (!tails) return null;
    const effectiveTails = lastChar === 'く' && type.includes('促音便') ? {...tails, ta: 'った'} : tails;
    const forms = {
      kanji: buildTailForms(kanjiBase, 1, effectiveTails),
      kana: buildTailForms(kanaBase, 1, effectiveTails),
    };
    if (kanaBase === 'ある') {
      forms.kanji.nai = 'ない';
      forms.kana.nai = 'ない';
    }
    return forms;
  }

  return null;
}

async function expandJapaneseVerbForms(analyzer, kanjiBase, kanaBase) {
  const forms = await conjugateJapaneseVerb(analyzer, kanjiBase, kanaBase);
  if (!forms) return null;
  const kanaForms = [forms.kana.dict, forms.kana.masu, forms.kana.ta, forms.kana.nai];
  return {
    kanji: [forms.kanji.dict, forms.kanji.masu, forms.kanji.ta, forms.kanji.nai].join(' / '),
    kana: kanaForms.join(' / '),
    romaji: kanaForms.map(kanaToRomaji).join(' / '),
  };
}

// ---- dictionaryFormOf / readingFor, copied verbatim from app.js -----------
const TOKENIZER_WORD_POS = new Set(['名詞', '動詞', '形容詞', '副詞']);
const TOKENIZER_INFLECTION_POS = new Set(['助動詞', '助詞', '記号']);

async function dictionaryFormOf(analyzer, dictionary, text) {
  if (!text) return null;
  let tokens;
  try {
    tokens = await analyzer.parse(text);
  } catch (error) {
    return null;
  }
  const [token] = tokens;
  if (!token || !TOKENIZER_WORD_POS.has(token.pos)) return null;
  if (!tokens.slice(1).every((t) => TOKENIZER_INFLECTION_POS.has(t.pos))) return null;
  if (!token.basic_form || token.basic_form === '*' || token.basic_form === token.surface_form) return null;
  return (dictionary && dictionary.kanaToKanji[token.basic_form]) || token.basic_form;
}

async function readingFor(analyzer, text) {
  if (!text) return '';
  try {
    const tokens = await analyzer.parse(text);
    return katakanaToHiragana(tokens.map((t) => t.reading || t.surface_form).join(''));
  } catch (error) {
    return '';
  }
}

// ---- pre-existing data-entry issues, found by inspecting this migration's --
// dry run before applying it. Fixed here rather than by touching the
// conjugation engine, since each is specific to a single stored word:
//   #56  kanji "上ります" is missing okurigana -- the gloss ("go up") and
//        stored kana (あがります) are 上がる, not 上る (which reads のぼる).
//   #131 "いません"/"いません" auto-reduces to the 射る homograph (also
//        read いる) instead of 居る -- forced straight to dictionary form.
//   #159 kana "かたづけ" is missing its trailing る (kanji is already correct
//        dictionary form かたづける).
//   #163 kana "おき" is missing its trailing る (kanji is already correct
//        dictionary form おきる).
const PRE_FIXES = {
  56: {kanji: '上がります'},
  131: {kanji: 'いる', kana: 'いる', skipReduction: true},
  159: {kana: 'かたづける'},
  163: {kana: 'おきる'},
};

function loadWords() {
  const text = fs.readFileSync(WORDS_PATH, 'utf8');
  const json = text.replace(/^window\.INITIAL_WORDS = /, '').replace(/;\s*$/, '');
  return {text, words: JSON.parse(json)};
}

function writeWords(words) {
  const out = `window.INITIAL_WORDS = ${JSON.stringify(words, null, 2)};\n`;
  fs.writeFileSync(WORDS_PATH, out);
}

async function main() {
  const {words} = loadWords();
  const dictionary = JSON.parse(zlib.gunzipSync(fs.readFileSync(DICT_PATH)));

  await new Promise((resolve, reject) => {
    kuromoji.builder({dicPath: DIC_PATH}).build(async (err, tokenizer) => {
      if (err) return reject(err);
      const analyzer = {parse: async (text) => tokenizer.tokenize(text)};

      let changed = 0;
      for (const item of words) {
        const fix = PRE_FIXES[item.id];
        let kanji = (fix && fix.kanji) || item.kanji;
        let kana = (fix && fix.kana) || item.kana;

        if (!(fix && fix.skipReduction)) {
          const reduced = await dictionaryFormOf(analyzer, dictionary, kanji);
          if (reduced && reduced !== kanji) {
            kanji = reduced;
            kana = (await readingFor(analyzer, kanji)) || kana;
          }
        }

        const forms = await expandJapaneseVerbForms(analyzer, kanji, kana);
        if (!forms) continue;

        changed += 1;
        console.log(`#${item.id}  BEFORE: ${item.kanji} / ${item.kana}`);
        console.log(`     AFTER:  ${forms.kanji}  ||  ${forms.kana}`);

        item.kanji = forms.kanji;
        item.kana = forms.kana;
        item.romaji = forms.romaji;
      }

      console.log(`\n${changed} of ${words.length} words expanded into verb form sets.`);

      if (APPLY) {
        writeWords(words);
        console.log(`\nWrote ${WORDS_PATH}`);
      } else {
        console.log('\nDry run only -- rerun with --apply to write data/japanese-words.js');
      }

      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
