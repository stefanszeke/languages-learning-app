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

function setAssetHeaders(response, filePath) {
  response.setHeader('Cache-Control', 'no-cache');
  if (filePath.endsWith('.wasm')) {
    response.setHeader('Content-Type', 'application/wasm');
  } else if (filePath.endsWith('.js')) {
    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (filePath.endsWith('.traineddata.gz')) {
    // Do not set Content-Encoding: gzip. Tesseract.js receives and expands this file itself.
    response.setHeader('Content-Type', 'application/gzip');
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
  console.log(`Japanese Study List is running at ${url}`);
  console.log('Keep this window open while using the app. Press Ctrl+C to stop it.');
  openBrowser(url);
});
