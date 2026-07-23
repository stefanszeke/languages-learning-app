'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');

const app = express();
const ROOT = __dirname;
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 8000;

function resolvePackageDirectory(packageName) {
  return path.dirname(require.resolve(`${packageName}/package.json`));
}

let tesseractDirectory = '';
let coreDirectory = '';
let packageResolutionError = null;
try {
  tesseractDirectory = resolvePackageDirectory('tesseract.js');
  coreDirectory = resolvePackageDirectory('tesseract.js-core');
} catch (error) {
  packageResolutionError = error;
}

// The tokenizer (used to fill in kana/romaji/word readings) is an optional
// enrichment step, not required for OCR itself, so it gets its own
// resolution/error path and must never block the OCR feature if missing.
let kuromojiDirectory = '';
let tokenizerAnalyzerDirectory = '';
let tokenizerResolutionError = null;
try {
  kuromojiDirectory = resolvePackageDirectory('kuromoji');
  tokenizerAnalyzerDirectory = resolvePackageDirectory('kuroshiro-analyzer-kuromoji');
} catch (error) {
  tokenizerResolutionError = error;
}

function setAssetHeaders(response, filePath) {
  response.setHeader('Cache-Control', 'no-cache');
  if (filePath.endsWith('.wasm')) {
    response.setHeader('Content-Type', 'application/wasm');
  } else if (filePath.endsWith('.js')) {
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (filePath.endsWith('.traineddata.gz') || filePath.endsWith('.dat.gz')) {
    // Do not set Content-Encoding: gzip. The consuming library expands this file itself.
    response.setHeader('Content-Type', 'application/gzip');
  } else if (filePath.endsWith('.json.gz')) {
    // Here the file IS the gzip transport encoding of plain JSON, so telling
    // the browser that lets fetch() hand back already-inflated JSON text.
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Encoding', 'gzip');
  }
}

function requiredOcrFiles() {
  if (!tesseractDirectory || !coreDirectory) return [];
  const coreNames = [
    'tesseract-core.wasm.js',
    'tesseract-core.wasm',
    'tesseract-core-simd.wasm.js',
    'tesseract-core-simd.wasm',
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-lstm.wasm',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm',
    'tesseract-core-relaxedsimd.wasm.js',
    'tesseract-core-relaxedsimd.wasm',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm'
  ];

  return [
    path.join(tesseractDirectory, 'dist', 'tesseract.min.js'),
    path.join(tesseractDirectory, 'dist', 'worker.min.js'),
    ...coreNames.map(name => path.join(coreDirectory, name)),
    path.join(ROOT, 'vendor', 'lang', 'jpn.traineddata.gz'),
    path.join(ROOT, 'vendor', 'lang', 'eng.traineddata.gz')
  ];
}

app.get('/api/ocr-status', (request, response) => {
  if (packageResolutionError) {
    response.status(503).json({
      ready: false,
      message: 'OCR dependencies are not installed. Close the server, run npm install, and start it again.'
    });
    return;
  }

  const missing = requiredOcrFiles().filter(filePath => !fs.existsSync(filePath));
  response.status(missing.length ? 503 : 200).json({
    ready: missing.length === 0,
    message: missing.length
      ? `OCR installation is incomplete. Missing ${missing.length} required file(s). Run npm install again.`
      : 'Local OCR packages are ready.',
    missing: missing.map(filePath => path.basename(filePath))
  });
});

app.get('/api/tokenizer-status', (request, response) => {
  if (tokenizerResolutionError) {
    response.status(503).json({
      ready: false,
      message: 'Tokenizer dependencies are not installed. Close the server, run npm install, and start it again.'
    });
    return;
  }
  const dictReady = fs.existsSync(path.join(kuromojiDirectory, 'dict', 'base.dat.gz'));
  response.status(dictReady ? 200 : 503).json({
    ready: dictReady,
    message: dictReady ? 'Local tokenizer is ready.' : 'Tokenizer dictionary is missing. Run npm install again.'
  });
});

// The English lookup is a nice-to-have on top of word suggestions, not a
// requirement, so it gets its own status/route pair that never blocks OCR
// or tokenization if the bundled dictionary file is missing.
const dictionaryFile = path.join(ROOT, 'vendor', 'dict', 'jmdict-lookup.json.gz');

app.get('/api/dictionary-status', (request, response) => {
  const ready = fs.existsSync(dictionaryFile);
  response.status(ready ? 200 : 503).json({
    ready,
    message: ready ? 'Local English dictionary is ready.' : 'English dictionary file is missing.'
  });
});

app.get('/vendor/dict/jmdict-lookup.json.gz', (request, response) => {
  setAssetHeaders(response, dictionaryFile);
  response.sendFile(dictionaryFile, error => {
    if (error) response.status(404).end();
  });
});

// The German gender lookup is a nice-to-have on top of the article badge,
// not a requirement, so it gets its own status/route pair that never blocks
// entry editing if the bundled dictionary file is missing.
const germanGenderDictionaryFile = path.join(ROOT, 'vendor', 'dict', 'german-gender-lookup.json.gz');

app.get('/api/german-gender-status', (request, response) => {
  const ready = fs.existsSync(germanGenderDictionaryFile);
  response.status(ready ? 200 : 503).json({
    ready,
    message: ready ? 'Local German gender dictionary is ready.' : 'German gender dictionary file is missing.'
  });
});

app.get('/vendor/dict/german-gender-lookup.json.gz', (request, response) => {
  setAssetHeaders(response, germanGenderDictionaryFile);
  response.sendFile(germanGenderDictionaryFile, error => {
    if (error) response.status(404).end();
  });
});

if (tesseractDirectory) {
  app.get('/vendor/tesseract.min.js', (request, response) => {
    response.sendFile(path.join(tesseractDirectory, 'dist', 'tesseract.min.js'), {headers: {'Cache-Control': 'no-cache'}});
  });
  app.get('/vendor/worker.min.js', (request, response) => {
    response.sendFile(path.join(tesseractDirectory, 'dist', 'worker.min.js'), {headers: {'Cache-Control': 'no-cache'}});
  });
}

if (coreDirectory) {
  app.use('/vendor/core', express.static(coreDirectory, {
    fallthrough: false,
    etag: false,
    setHeaders: setAssetHeaders
  }));
}

if (tokenizerAnalyzerDirectory) {
  app.get('/vendor/tokenizer.min.js', (request, response) => {
    response.sendFile(path.join(tokenizerAnalyzerDirectory, 'dist', 'kuroshiro-analyzer-kuromoji.min.js'), {headers: {'Cache-Control': 'no-cache'}});
  });
}

if (kuromojiDirectory) {
  app.use('/vendor/tokenizer-dict', express.static(path.join(kuromojiDirectory, 'dict'), {
    fallthrough: false,
    etag: false,
    setHeaders: setAssetHeaders
  }));
}

app.use('/vendor/lang', express.static(path.join(ROOT, 'vendor', 'lang'), {
  fallthrough: false,
  etag: false,
  setHeaders: setAssetHeaders
}));

app.use(express.static(ROOT, {
  extensions: ['html'],
  etag: false,
  setHeaders: setAssetHeaders
}));

app.get('*', (request, response) => {
  response.sendFile(path.join(ROOT, 'index.html'));
});

function openBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command, () => {});
}

app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Lingo Study List is running at ${url}`);
  console.log('Keep this window open while using the app. Press Ctrl+C to stop it.');
  openBrowser(url);
});
