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

## Existing browser data

Data is saved in browser local storage for `http://127.0.0.1:8000`. If moving from a version opened directly as a file, export its Words JSON and Sentences JSON first, then import those files here.

## Backup

Use the export buttons regularly. Browser storage is convenient but should not be the only copy of your study list.

background-image: url("https://wallpapercat.com/w/full/1/a/1/34391-1920x1200-desktop-hd-germany-wallpaper.jpg");
background-size: cover;
background-position: center;
background-repeat: no-repeat;

background-image: url("https://blog.globalbasecamps.com/hs-fs/hubfs/mount-fuji-sunset-cherry-blossom-spring-pagoda-16811%20(1).jpg?width=3000&name=mount-fuji-sunset-cherry-blossom-spring-pagoda-16811%20(1).jpg");
background-size: cover;
background-position: center;
background-repeat: no-repeat;