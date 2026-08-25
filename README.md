# Lingo Study List — local Node edition

A local multi-language (Japanese, German) study app with:

- Words and sentences with stable numeric IDs
- Searchable, coverable tables
- Flashcard sessions by category and ID range
- Offline Duolingo screenshot OCR
- Editable review cards before import
- Separate selection of sentences and suggested words
- JSON and Markdown import/export

## Start

```bash
npm install
npm start
```

On the first run, `npm install` needs internet once to fetch the OCR packages. Later starts work offline because the OCR packages and language models are stored locally. The browser opens at `http://127.0.0.1:8000`. Keep the terminal open while using the app.

### Requirements

- Node.js 16 or newer
- npm, normally installed together with Node.js

## Why this version uses Node

The previous static downloader copied only some Tesseract.js-core builds. Tesseract.js 7 can select additional Relaxed SIMD builds depending on the browser. Firefox therefore requested a file that was not installed.

This project pins compatible versions of:

- `tesseract.js` 7.0.0
- `tesseract.js-core` 7.0.0

The local Express server exposes the complete installed core directory and uses explicit MIME types for JavaScript, WebAssembly, and compressed language data. Nothing is uploaded to an external service.

## Screenshot import

1. Open **Screenshot import**.
2. Add one or more screenshots.
3. Select **Scan screenshots**.
4. Correct the extracted English, romaji, Japanese, and kana.
5. Check only the sentences and words you want.
6. Select **Import selected**.

OCR is only a draft generator. Duolingo layouts, furigana, highlighted text, word banks, and inferred kanji can still require manual corrections.

## Data saving and publishing

The dictionary files are the single source of truth:

- `data/japanese-words.js`
- `data/japanese-sentences.js`
- `data/german-words.js`
- `data/german-sentences.js`

The app no longer stores a second copy of words or sentences in browser local storage. Every page load reads the dictionary directly from those project files. Browser storage is used only for browser-specific study/settings data such as hard markers, selected language, and theme.

When the app is opened through `npm start`, add/edit/delete/import actions are available and every dictionary change is written automatically to the relevant `data/*.js` file. There is no **Sync to disk** and no **Reload app from project files** step.

If you replace any `data/*.js` dictionary file outside the app, simply refresh the page. When you are ready to publish, commit and push the changed project files. GitHub Pages then serves those files directly; refresh the deployed page after the deployment completes to see the new entries.

On GitHub Pages there is no Node server, so dictionary editing/import actions are hidden. Study-only state such as hard markers can still be stored in that browser without changing the published dictionary.

### Normal workflows

**Editing through the local app:** edit/import → automatic write to `data/*.js` → commit → push.

**Replacing dictionary files directly:** replace `data/*.js` → refresh the local app if it is open → commit → push.

## Backup

The project files are the publishable source of truth. JSON/Markdown export is still useful as an extra backup or for moving data between copies of the app.

background-image: url("https://wallpapercat.com/w/full/1/a/1/34391-1920x1200-desktop-hd-germany-wallpaper.jpg");
background-size: cover;
background-position: center;
background-repeat: no-repeat;

background-image: url("https://blog.globalbasecamps.com/hs-fs/hubfs/mount-fuji-sunset-cherry-blossom-spring-pagoda-16811%20(1).jpg?width=3000&name=mount-fuji-sunset-cherry-blossom-spring-pagoda-16811%20(1).jpg");
background-size: cover;
background-position: center;
background-repeat: no-repeat;