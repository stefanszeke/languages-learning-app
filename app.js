(() => {
  'use strict';

  const LEGACY_STORAGE_KEY = 'japanese-study-list-v1';
  const WORDS_STORAGE_KEY = 'japanese-study-words-v2';
  const SENTENCES_STORAGE_KEY = 'japanese-study-sentences-v2';
  const THEME_KEY = 'japanese-study-theme';
  const OCR_ASSET_ROOT = './vendor';
  const columns = ['english', 'romaji', 'kanji', 'kana'];

  const state = {
    collections: loadCollections(),
    screen: 'list',
    view: 'word',
    search: '',
    covered: new Set(),
    revealedCells: new Set(),
    shuffledIds: null,
    card: {
      setup: null,
      deck: [],
      index: 0,
      revealed: false,
      results: [],
    },
    screenshots: {
      files: [],
      results: [],
      scanning: false,
    },
  };

  const elements = {
    listToolbar: document.querySelector('#listToolbar'),
    listView: document.querySelector('#listView'),
    cardsView: document.querySelector('#cardsView'),
    importView: document.querySelector('#importView'),
    tbody: document.querySelector('#studyTableBody'),
    emptyState: document.querySelector('#emptyState'),
    searchInput: document.querySelector('#searchInput'),
    viewTitle: document.querySelector('#viewTitle'),
    resultSummary: document.querySelector('#resultSummary'),
    wordCount: document.querySelector('#wordCount'),
    sentenceCount: document.querySelector('#sentenceCount'),
    tabs: [...document.querySelectorAll('.tab')],
    coverButtons: [...document.querySelectorAll('.cover-button')],
    addButton: document.querySelector('#addButton'),
    revealButton: document.querySelector('#revealButton'),
    shuffleButton: document.querySelector('#shuffleButton'),
    importButton: document.querySelector('#importButton'),
    exportMdButton: document.querySelector('#exportMdButton'),
    exportWordsJsonButton: document.querySelector('#exportWordsJsonButton'),
    exportSentencesJsonButton: document.querySelector('#exportSentencesJsonButton'),
    resetButton: document.querySelector('#resetButton'),
    fileInput: document.querySelector('#fileInput'),
    dialog: document.querySelector('#entryDialog'),
    form: document.querySelector('#entryForm'),
    entryId: document.querySelector('#entryId'),
    entryOriginalType: document.querySelector('#entryOriginalType'),
    dialogEyebrow: document.querySelector('#dialogEyebrow'),
    dialogTitle: document.querySelector('#dialogTitle'),
    englishField: document.querySelector('#englishField'),
    romajiField: document.querySelector('#romajiField'),
    kanjiField: document.querySelector('#kanjiField'),
    kanaField: document.querySelector('#kanaField'),
    closeDialogButton: document.querySelector('#closeDialogButton'),
    cancelDialogButton: document.querySelector('#cancelDialogButton'),
    themeButton: document.querySelector('#themeButton'),
    toast: document.querySelector('#toast'),
    cardsSetup: document.querySelector('#cardsSetup'),
    cardSetupForm: document.querySelector('#cardSetupForm'),
    cardFromId: document.querySelector('#cardFromId'),
    cardToId: document.querySelector('#cardToId'),
    cardRangeHint: document.querySelector('#cardRangeHint'),
    cardMatchCount: document.querySelector('#cardMatchCount'),
    startCardsButton: document.querySelector('#startCardsButton'),
    cardShuffle: document.querySelector('#cardShuffle'),
    cardSession: document.querySelector('#cardSession'),
    exitSessionButton: document.querySelector('#exitSessionButton'),
    cardProgressText: document.querySelector('#cardProgressText'),
    cardIdText: document.querySelector('#cardIdText'),
    cardProgressBar: document.querySelector('#cardProgressBar'),
    studyCard: document.querySelector('#studyCard'),
    cardSideLabel: document.querySelector('#cardSideLabel'),
    cardContent: document.querySelector('#cardContent'),
    cardRevealHint: document.querySelector('#cardRevealHint'),
    answerActions: document.querySelector('#answerActions'),
    unknownButton: document.querySelector('#unknownButton'),
    knownButton: document.querySelector('#knownButton'),
    cardSummary: document.querySelector('#cardSummary'),
    scoreRing: document.querySelector('#scoreRing'),
    scorePercent: document.querySelector('#scorePercent'),
    summaryTotal: document.querySelector('#summaryTotal'),
    summaryKnown: document.querySelector('#summaryKnown'),
    summaryUnknown: document.querySelector('#summaryUnknown'),
    reviewCountText: document.querySelector('#reviewCountText'),
    reviewList: document.querySelector('#reviewList'),
    backToSetupButton: document.querySelector('#backToSetupButton'),
    restartSessionButton: document.querySelector('#restartSessionButton'),
    serverNotice: document.querySelector('#serverNotice'),
    screenshotDropZone: document.querySelector('#screenshotDropZone'),
    screenshotInput: document.querySelector('#screenshotInput'),
    selectedFiles: document.querySelector('#selectedFiles'),
    selectedFileCount: document.querySelector('#selectedFileCount'),
    scanScreenshotsButton: document.querySelector('#scanScreenshotsButton'),
    ocrProgress: document.querySelector('#ocrProgress'),
    ocrProgressBar: document.querySelector('#ocrProgressBar'),
    ocrProgressText: document.querySelector('#ocrProgressText'),
    reviewPanel: document.querySelector('#reviewPanel'),
    scanReviewList: document.querySelector('#scanReviewList'),
    clearScansButton: document.querySelector('#clearScansButton'),
    importScannedButton: document.querySelector('#importScannedButton'),
    newWordsPanel: document.querySelector('#newWordsPanel'),
    newWordsSummaryText: document.querySelector('#newWordsSummaryText'),
    newWordsList: document.querySelector('#newWordsList'),
    refreshNewWordsButton: document.querySelector('#refreshNewWordsButton'),
  };

  initTheme();
  saveCollections();
  bindEvents();
  setCardCategory('word', true);
  elements.serverNotice.hidden = location.protocol !== 'file:';
  render();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadCollections() {
    const wordsSaved = readJsonStorage(WORDS_STORAGE_KEY);
    const sentencesSaved = readJsonStorage(SENTENCES_STORAGE_KEY);

    if (Array.isArray(wordsSaved) || Array.isArray(sentencesSaved)) {
      return {
        word: normalizeCollection(Array.isArray(wordsSaved) ? wordsSaved : clone(window.INITIAL_WORDS || []), 'word'),
        sentence: normalizeCollection(Array.isArray(sentencesSaved) ? sentencesSaved : clone(window.INITIAL_SENTENCES || []), 'sentence'),
      };
    }

    const legacy = readJsonStorage(LEGACY_STORAGE_KEY);
    if (Array.isArray(legacy)) {
      const ordered = legacy
        .map((item, index) => ({...item, _legacyOrder: parseNumericId(item.id) || index + 1}))
        .sort((a, b) => a._legacyOrder - b._legacyOrder);
      const words = ordered.filter(item => item.type !== 'sentence').map((item, index) => ({...item, id: index + 1}));
      const sentences = ordered.filter(item => item.type === 'sentence').map((item, index) => ({...item, id: index + 1}));
      return {
        word: normalizeCollection(words, 'word'),
        sentence: normalizeCollection(sentences, 'sentence'),
      };
    }

    return {
      word: normalizeCollection(clone(window.INITIAL_WORDS || []), 'word'),
      sentence: normalizeCollection(clone(window.INITIAL_SENTENCES || []), 'sentence'),
    };
  }

  function readJsonStorage(key) {
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn(`Could not read ${key}:`, error);
      return null;
    }
  }

  function normalizeCollection(items, type) {
    const normalized = [];
    const used = new Set();
    let highestId = 0;

    for (const raw of Array.isArray(items) ? items : []) {
      const parsed = parseNumericId(raw.id);
      const id = parsed && !used.has(parsed) ? parsed : null;
      if (id) {
        used.add(id);
        highestId = Math.max(highestId, id);
      }
      normalized.push({
        id,
        type,
        english: String(raw.english || '').trim(),
        romaji: String(raw.romaji || '').trim(),
        kanji: String(raw.kanji || '').trim(),
        kana: String(raw.kana || '').trim(),
        ...(raw.source ? {source: raw.source} : {}),
      });
    }

    for (const item of normalized) {
      if (item.id) continue;
      do { highestId += 1; } while (used.has(highestId));
      item.id = highestId;
      used.add(highestId);
    }

    return normalized.sort((a, b) => a.id - b.id);
  }

  function parseNumericId(value) {
    if (Number.isSafeInteger(value) && value > 0) return value;
    const text = String(value ?? '').trim();
    if (/^\d+$/.test(text)) return Number(text);
    const legacyMatch = text.match(/^item-(\d+)$/i);
    return legacyMatch ? Number(legacyMatch[1]) : null;
  }

  function collection(type) {
    return type === 'sentence' ? state.collections.sentence : state.collections.word;
  }

  function nextId(type) {
    return collection(type).reduce((highest, item) => Math.max(highest, item.id), 0) + 1;
  }

  function compositeKey(type, id) {
    return `${type}:${id}`;
  }

  function saveCollections() {
    localStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(state.collections.word));
    localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(state.collections.sentence));
  }

  function bindEvents() {
    elements.tabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));

    elements.searchInput.addEventListener('input', event => {
      state.search = event.target.value.trim().toLocaleLowerCase();
      renderTable();
    });

    elements.coverButtons.forEach(button => button.addEventListener('click', () => {
      const column = button.dataset.column;
      state.covered.has(column) ? state.covered.delete(column) : state.covered.add(column);
      state.revealedCells.clear();
      renderCoverButtons();
      renderTable();
    }));

    elements.revealButton.addEventListener('click', () => {
      state.covered.clear();
      state.revealedCells.clear();
      renderCoverButtons();
      renderTable();
    });

    elements.shuffleButton.addEventListener('click', () => {
      state.shuffledIds = shuffle(filteredItems().map(item => item.id));
      renderTable();
      showToast('Current list shuffled');
    });

    elements.addButton.addEventListener('click', () => openDialog());
    elements.closeDialogButton.addEventListener('click', closeDialog);
    elements.cancelDialogButton.addEventListener('click', closeDialog);
    elements.form.addEventListener('submit', saveEntryFromForm);
    elements.form.querySelectorAll('input[name="entryType"]').forEach(input => input.addEventListener('change', updateDialogIdPreview));

    elements.importButton.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', importDataFile);
    elements.exportWordsJsonButton.addEventListener('click', () => exportJson('word'));
    elements.exportSentencesJsonButton.addEventListener('click', () => exportJson('sentence'));
    elements.exportMdButton.addEventListener('click', exportMarkdown);
    elements.resetButton.addEventListener('click', resetData);
    elements.themeButton.addEventListener('click', toggleTheme);

    elements.tbody.addEventListener('click', event => {
      const revealTarget = event.target.closest('.study-cell.covered');
      if (revealTarget) {
        state.revealedCells.add(revealTarget.dataset.revealKey);
        revealTarget.classList.remove('covered');
        return;
      }

      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      const id = Number(actionButton.dataset.id);
      const type = actionButton.dataset.type === 'sentence' ? 'sentence' : 'word';
      const item = collection(type).find(entry => entry.id === id);
      if (!item) return;
      if (actionButton.dataset.action === 'edit') openDialog(item);
      if (actionButton.dataset.action === 'delete') deleteItem(item);
    });

    elements.cardSetupForm.addEventListener('submit', startCardSessionFromForm);
    elements.cardSetupForm.addEventListener('input', event => {
      if (event.target.name === 'cardType') setCardCategory(event.target.value, true);
      else updateCardSetupDetails();
    });
    elements.studyCard.addEventListener('click', revealCurrentCard);
    elements.unknownButton.addEventListener('click', () => recordCardAnswer(false));
    elements.knownButton.addEventListener('click', () => recordCardAnswer(true));
    elements.exitSessionButton.addEventListener('click', exitCardSession);
    elements.backToSetupButton.addEventListener('click', () => showCardStage('setup'));
    elements.restartSessionButton.addEventListener('click', restartCardSession);
    document.addEventListener('keydown', handleCardKeyboard);

    elements.screenshotInput.addEventListener('change', event => setScreenshotFiles([...event.target.files]));
    elements.screenshotDropZone.addEventListener('dragover', event => {
      event.preventDefault();
      elements.screenshotDropZone.classList.add('is-dragging');
    });
    elements.screenshotDropZone.addEventListener('dragleave', () => elements.screenshotDropZone.classList.remove('is-dragging'));
    elements.screenshotDropZone.addEventListener('drop', event => {
      event.preventDefault();
      elements.screenshotDropZone.classList.remove('is-dragging');
      setScreenshotFiles([...event.dataTransfer.files].filter(file => file.type.startsWith('image/')));
    });
    elements.scanScreenshotsButton.addEventListener('click', scanScreenshots);
    elements.clearScansButton.addEventListener('click', clearScreenshotWorkspace);
    elements.importScannedButton.addEventListener('click', importSelectedScans);
    elements.scanReviewList.addEventListener('input', updateScanDraftFromInput);
    elements.scanReviewList.addEventListener('change', updateScanDraftFromInput);
    elements.refreshNewWordsButton.addEventListener('click', renderNewWordsSummary);
    elements.scanReviewList.addEventListener('click', handleScanReviewClick);
  }

  function switchView(view) {
    if (view === 'cards' || view === 'import') {
      state.screen = view;
      if (view === 'cards') {
        const selectedType = elements.cardSetupForm.elements.cardType.value || state.view;
        setCardCategory(selectedType, false);
      }
    } else {
      state.screen = 'list';
      state.view = view === 'sentence' ? 'sentence' : 'word';
      state.shuffledIds = null;
      state.revealedCells.clear();
    }
    render();
  }

  function render() {
    elements.tabs.forEach(tab => {
      const target = tab.dataset.view;
      const active = state.screen === 'list' ? target === state.view : target === state.screen;
      tab.classList.toggle('is-active', active);
    });

    const listVisible = state.screen === 'list';
    elements.listToolbar.hidden = !listVisible;
    elements.listView.hidden = !listVisible;
    elements.cardsView.hidden = state.screen !== 'cards';
    elements.importView.hidden = state.screen !== 'import';
    renderCounts();

    if (listVisible) {
      elements.viewTitle.textContent = state.view === 'word' ? 'Words' : 'Sentences';
      renderCoverButtons();
      renderTable();
    } else if (state.screen === 'cards') {
      updateCardSetupDetails();
    } else {
      renderSelectedFiles();
      renderScanReviews();
    }
  }

  function renderCounts() {
    elements.wordCount.textContent = state.collections.word.length;
    elements.sentenceCount.textContent = state.collections.sentence.length;
  }

  function renderCoverButtons() {
    elements.coverButtons.forEach(button => button.classList.toggle('is-covered', state.covered.has(button.dataset.column)));
  }

  function filteredItems() {
    let items = [...collection(state.view)];
    if (state.search) {
      items = items.filter(item => {
        const haystack = [item.id, item.english, item.romaji, item.kanji, item.kana].join(' ').toLocaleLowerCase();
        return haystack.includes(state.search);
      });
    }

    if (state.shuffledIds) {
      const order = new Map(state.shuffledIds.map((id, index) => [id, index]));
      items.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    } else {
      items.sort((a, b) => a.id - b.id);
    }
    return items;
  }

  function renderTable() {
    const items = filteredItems();
    const categoryTotal = collection(state.view).length;
    elements.resultSummary.textContent = state.search
      ? `${items.length} of ${categoryTotal} entries`
      : `${items.length} ${items.length === 1 ? 'entry' : 'entries'} · ${state.view === 'word' ? 'Word' : 'Sentence'} IDs 1–${categoryTotal ? Math.max(...collection(state.view).map(item => item.id)) : 0}`;
    elements.emptyState.hidden = items.length > 0;

    elements.tbody.innerHTML = items.map(item => `
      <tr>
        <td class="entry-id">${item.id}</td>
        ${columns.map(column => cellTemplate(item, column)).join('')}
        <td>
          <div class="row-actions">
            <button class="row-action" type="button" data-action="edit" data-type="${item.type}" data-id="${item.id}" title="Edit" aria-label="Edit ${item.type} ${item.id}">✎</button>
            <button class="row-action" type="button" data-action="delete" data-type="${item.type}" data-id="${item.id}" title="Delete" aria-label="Delete ${item.type} ${item.id}">×</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function cellTemplate(item, column) {
    const key = `${compositeKey(item.type, item.id)}:${column}`;
    const covered = state.covered.has(column) && !state.revealedCells.has(key);
    return `<td data-column="${column}"><div class="study-cell${covered ? ' covered' : ''}" data-reveal-key="${key}">${escapeHtml(item[column] || '—')}</div></td>`;
  }

  function openDialog(item = null) {
    elements.form.reset();
    const type = item?.type || state.view;
    elements.entryId.value = item?.id || '';
    elements.entryOriginalType.value = item?.type || '';
    elements.form.querySelector(`input[name="entryType"][value="${type}"]`).checked = true;
    elements.englishField.value = item?.english || '';
    elements.romajiField.value = item?.romaji || '';
    elements.kanjiField.value = item?.kanji || '';
    elements.kanaField.value = item?.kana || '';
    elements.dialogTitle.textContent = item ? 'Edit entry' : 'Add entry';
    elements.dialogEyebrow.dataset.mode = item ? 'edit' : 'new';
    updateDialogIdPreview();
    elements.dialog.showModal();
    setTimeout(() => elements.englishField.focus(), 0);
  }

  function updateDialogIdPreview() {
    const type = elements.form.elements.entryType.value;
    const existingId = Number(elements.entryId.value);
    const originalType = elements.entryOriginalType.value;
    const id = existingId && originalType === type ? existingId : nextId(type);
    elements.dialogEyebrow.textContent = `${type === 'word' ? 'Word' : 'Sentence'} ID ${id}`;
  }

  function closeDialog() {
    elements.dialog.close();
  }

  function saveEntryFromForm(event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;

    const type = elements.form.elements.entryType.value === 'sentence' ? 'sentence' : 'word';
    const originalType = elements.entryOriginalType.value === 'sentence' ? 'sentence' : elements.entryOriginalType.value === 'word' ? 'word' : null;
    const originalId = Number(elements.entryId.value) || null;
    const itemData = {
      type,
      english: elements.englishField.value.trim(),
      romaji: elements.romajiField.value.trim(),
      kanji: elements.kanjiField.value.trim(),
      kana: elements.kanaField.value.trim(),
    };

    if (originalType && originalId) {
      const oldCollection = collection(originalType);
      const oldIndex = oldCollection.findIndex(item => item.id === originalId);
      if (oldIndex < 0) return;

      if (originalType === type) {
        oldCollection[oldIndex] = {...oldCollection[oldIndex], ...itemData, id: originalId};
      } else {
        oldCollection.splice(oldIndex, 1);
        collection(type).push({...itemData, id: nextId(type)});
        collection(type).sort((a, b) => a.id - b.id);
      }
    } else {
      collection(type).push({...itemData, id: nextId(type)});
    }

    saveCollections();
    state.view = type;
    state.screen = 'list';
    state.shuffledIds = null;
    closeDialog();
    render();
    showToast('Entry saved');
  }

  function deleteItem(item) {
    const label = item.type === 'word' ? 'Word' : 'Sentence';
    if (!confirm(`Delete ${label} ID ${item.id}: “${item.english}”?`)) return;
    const items = collection(item.type);
    const index = items.findIndex(entry => entry.id === item.id);
    if (index >= 0) items.splice(index, 1);
    saveCollections();
    state.shuffledIds = null;
    render();
    showToast(`${label} deleted`);
  }

  async function importDataFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let entries;
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        const array = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : null;
        if (!array) throw new Error('JSON must contain an array of entries.');
        const filenameType = /sentence/i.test(file.name) ? 'sentence' : /word/i.test(file.name) ? 'word' : null;
        entries = array.map(item => ({...item, type: item.type === 'sentence' ? 'sentence' : item.type === 'word' ? 'word' : filenameType || guessType(item.english || '')}));
      } else {
        entries = parseMarkdown(text);
      }

      if (!entries.length) throw new Error('No valid entries were found.');
      const summary = mergeImportedEntries(entries, `file:${file.name}`);
      saveCollections();
      render();
      showToast(`${summary.added} imported · ${summary.duplicates} duplicates skipped`);
    } catch (error) {
      alert(`Could not import the file.\n\n${error.message}`);
    }
  }

  function mergeImportedEntries(entries, sourceLabel = '') {
    let added = 0;
    let duplicates = 0;
    let invalid = 0;
    const counters = {word: nextId('word'), sentence: nextId('sentence')};

    for (const raw of entries) {
      const type = raw.type === 'sentence' ? 'sentence' : 'word';
      const candidate = {
        type,
        english: String(raw.english || '').trim(),
        romaji: String(raw.romaji || '').trim(),
        kanji: String(raw.kanji || '').trim(),
        kana: String(raw.kana || '').trim(),
        ...(raw.source ? {source: raw.source} : sourceLabel ? {source: {kind: sourceLabel, importedAt: new Date().toISOString()}} : {}),
      };
      if (!candidate.english || !(candidate.kanji || candidate.kana)) {
        invalid += 1;
        continue;
      }
      if (findDuplicate(candidate)) {
        duplicates += 1;
        continue;
      }
      collection(type).push({...candidate, id: counters[type]});
      counters[type] += 1;
      added += 1;
    }

    collection('word').sort((a, b) => a.id - b.id);
    collection('sentence').sort((a, b) => a.id - b.id);
    return {added, duplicates, invalid};
  }

  function parseMarkdown(text) {
    const entries = [];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line === '###') continue;
      const unmarked = line.replace(/^#\s*/, '').trim();
      const parts = unmarked.split(/\s+\.\s+/).map(part => part.trim());
      if (parts.length < 4) continue;
      const [english, romaji, kanji, ...kanaParts] = parts;
      entries.push({
        type: guessType(english),
        english,
        romaji,
        kanji,
        kana: kanaParts.join(' . '),
      });
    }
    return entries;
  }

  function guessType(english) {
    const text = String(english || '').trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const sentenceSignals = /[.!?]$|\b(i|i’m|i'll|we|you|he|she|it|they|let’s|don't|doesn't|did|is|are|was|were|want to|going to|takes about)\b/i;
    return wordCount >= 5 || sentenceSignals.test(text) ? 'sentence' : 'word';
  }

  function exportJson(type) {
    const label = type === 'sentence' ? 'sentences' : 'words';
    downloadFile(`${label}.json`, JSON.stringify(collection(type), null, 2), 'application/json');
    showToast(`${titleCase(label)} JSON exported`);
  }

  function exportMarkdown() {
    const sections = [
      ['Words', collection('word')],
      ['Sentences', collection('sentence')],
    ].map(([heading, items]) => {
      const lines = [...items].sort((a, b) => a.id - b.id).map(item => `${item.english} . ${item.romaji} . ${item.kanji} . ${item.kana}`);
      return `## ${heading}\n\n${lines.join('\n')}`;
    });
    downloadFile('japanese-study-list.md', sections.join('\n\n###\n\n'), 'text/markdown');
    showToast('Markdown exported');
  }

  function resetData() {
    if (!confirm('Reset all edits and restore the original words and sentences?')) return;
    state.collections = {
      word: normalizeCollection(clone(window.INITIAL_WORDS || []), 'word'),
      sentence: normalizeCollection(clone(window.INITIAL_SENTENCES || []), 'sentence'),
    };
    state.shuffledIds = null;
    state.search = '';
    elements.searchInput.value = '';
    saveCollections();
    setCardCategory('word', true);
    render();
    showToast('Original data restored');
  }

  function setCardCategory(type, resetRange) {
    const safeType = type === 'sentence' ? 'sentence' : 'word';
    const radio = elements.cardSetupForm.querySelector(`input[name="cardType"][value="${safeType}"]`);
    if (radio) radio.checked = true;
    const items = categoryItems(safeType);
    if (resetRange && items.length) {
      elements.cardFromId.value = items[0].id;
      elements.cardToId.value = items.at(-1).id;
    }
    updateCardSetupDetails();
  }

  function categoryItems(type) {
    return [...collection(type)].sort((a, b) => a.id - b.id);
  }

  function readCardSetup() {
    return {
      type: elements.cardSetupForm.elements.cardType.value === 'sentence' ? 'sentence' : 'word',
      from: Number(elements.cardFromId.value),
      to: Number(elements.cardToId.value),
      direction: elements.cardSetupForm.elements.cardDirection.value,
      shuffle: elements.cardShuffle.checked,
    };
  }

  function matchingCards(setup = readCardSetup()) {
    if (!Number.isSafeInteger(setup.from) || !Number.isSafeInteger(setup.to) || setup.from < 1 || setup.to < setup.from) return [];
    return categoryItems(setup.type).filter(item => item.id >= setup.from && item.id <= setup.to);
  }

  function updateCardSetupDetails() {
    const setup = readCardSetup();
    const category = categoryItems(setup.type);
    if (!category.length) {
      elements.cardRangeHint.textContent = 'No entries are available in this category.';
      elements.cardMatchCount.textContent = '0 matching cards';
      elements.startCardsButton.disabled = true;
      return;
    }

    const matching = matchingCards(setup);
    const typeLabel = setup.type === 'word' ? 'Word' : 'Sentence';
    elements.cardRangeHint.textContent = `${typeLabel} IDs: ${category[0].id}–${category.at(-1).id} · ${category.length} available`;
    elements.cardMatchCount.textContent = `${matching.length} matching ${matching.length === 1 ? 'card' : 'cards'}`;
    elements.startCardsButton.disabled = matching.length === 0;
  }

  function startCardSessionFromForm(event) {
    event.preventDefault();
    if (!elements.cardSetupForm.reportValidity()) return;
    const setup = readCardSetup();
    if (setup.from > setup.to) {
      alert('The From ID must be lower than or equal to the To ID.');
      return;
    }
    startCardSession(setup);
  }

  function startCardSession(setup) {
    let deck = matchingCards(setup);
    if (!deck.length) {
      alert('No cards match this category and ID range.');
      return;
    }
    if (setup.shuffle) deck = shuffle([...deck]);

    state.card = {
      setup: {...setup},
      deck,
      index: 0,
      revealed: false,
      results: [],
    };
    showCardStage('session');
    renderCurrentCard();
  }

  function showCardStage(stage) {
    elements.cardsSetup.hidden = stage !== 'setup';
    elements.cardSession.hidden = stage !== 'session';
    elements.cardSummary.hidden = stage !== 'summary';
    if (stage === 'setup') updateCardSetupDetails();
  }

  function currentCard() {
    return state.card.deck[state.card.index] || null;
  }

  function renderCurrentCard() {
    const item = currentCard();
    if (!item) return;
    const total = state.card.deck.length;
    const currentNumber = state.card.index + 1;
    const direction = state.card.setup.direction;
    const typeLabel = item.type === 'word' ? 'Word' : 'Sentence';

    elements.cardProgressText.textContent = `Card ${currentNumber} of ${total}`;
    elements.cardIdText.textContent = `${typeLabel} ID ${item.id}`;
    elements.cardProgressBar.style.width = `${(currentNumber / total) * 100}%`;
    elements.cardSideLabel.textContent = state.card.revealed ? 'Answer revealed' : (direction === 'jp-en' ? 'Japanese → English' : 'English → Japanese');
    elements.cardContent.innerHTML = cardContentTemplate(item, direction, state.card.revealed);
    elements.answerActions.hidden = !state.card.revealed;
    elements.cardRevealHint.textContent = state.card.revealed ? 'Choose how well you knew it' : 'Click the card to reveal';
    elements.studyCard.setAttribute('aria-label', state.card.revealed ? 'Answer revealed' : 'Reveal answer');
  }

  function cardContentTemplate(item, direction, revealed) {
    if (direction === 'jp-en') {
      const japanese = japaneseTemplate(item);
      if (!revealed) return japanese;
      return `${japanese}<div class="card-answer-label">English</div><div class="card-secondary">${escapeHtml(item.english)}</div>`;
    }

    const english = `<div class="card-primary english-front">${escapeHtml(item.english)}</div>`;
    if (!revealed) return english;
    return `${english}<div class="card-answer-label">Japanese</div>${japaneseTemplate(item)}`;
  }

  function japaneseTemplate(item) {
    const primary = item.kanji || item.kana || item.romaji || '—';
    const kana = item.kana && item.kana !== primary ? `<div class="card-secondary">${escapeHtml(item.kana)}</div>` : '';
    const romaji = item.romaji ? `<div class="card-tertiary">${escapeHtml(item.romaji)}</div>` : '';
    return `<div class="card-primary">${escapeHtml(primary)}</div>${kana}${romaji}`;
  }

  function revealCurrentCard() {
    if (elements.cardSession.hidden || state.card.revealed) return;
    state.card.revealed = true;
    renderCurrentCard();
  }

  function recordCardAnswer(known) {
    if (!state.card.revealed) return;
    const item = currentCard();
    state.card.results.push({type: item.type, id: item.id, known});
    state.card.index += 1;
    state.card.revealed = false;

    if (state.card.index >= state.card.deck.length) {
      renderCardSummary();
      showCardStage('summary');
      return;
    }
    renderCurrentCard();
  }

  function renderCardSummary() {
    const total = state.card.results.length;
    const known = state.card.results.filter(result => result.known).length;
    const unknownKeys = new Set(state.card.results.filter(result => !result.known).map(result => compositeKey(result.type, result.id)));
    const unknown = state.card.deck.filter(item => unknownKeys.has(compositeKey(item.type, item.id)));
    const percent = total ? Math.round((known / total) * 100) : 0;

    elements.scorePercent.textContent = `${percent}%`;
    elements.scoreRing.style.setProperty('--score', `${percent * 3.6}deg`);
    elements.summaryTotal.textContent = total;
    elements.summaryKnown.textContent = known;
    elements.summaryUnknown.textContent = unknown.length;
    elements.reviewCountText.textContent = `${unknown.length} ${unknown.length === 1 ? 'card' : 'cards'}`;
    elements.reviewList.innerHTML = unknown.length
      ? unknown.map(item => `
          <div class="review-item">
            <span class="review-id">${item.type === 'word' ? 'W' : 'S'}#${item.id}</span>
            <span>${escapeHtml(item.english)}</span>
            <span class="review-japanese">${escapeHtml(item.kanji || item.kana)}<small>${escapeHtml(item.kana)}${item.kana && item.romaji ? ' · ' : ''}${escapeHtml(item.romaji)}</small></span>
          </div>
        `).join('')
      : '<div class="review-empty">Excellent — you marked every card as known.</div>';
  }

  function restartCardSession() {
    if (!state.card.setup) return;
    const setup = {...state.card.setup};
    setCardCategory(setup.type, false);
    elements.cardFromId.value = setup.from;
    elements.cardToId.value = setup.to;
    elements.cardSetupForm.querySelector(`input[name="cardDirection"][value="${setup.direction}"]`).checked = true;
    elements.cardShuffle.checked = setup.shuffle;
    startCardSession(setup);
  }

  function exitCardSession() {
    if (state.card.results.length && !confirm('End this session and discard its current progress?')) return;
    showCardStage('setup');
  }

  function handleCardKeyboard(event) {
    if (state.screen !== 'cards' || elements.cardSession.hidden) return;
    if (event.target.matches('input, textarea, select, button')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      revealCurrentCard();
    }
    if (state.card.revealed && event.key === '1') recordCardAnswer(false);
    if (state.card.revealed && event.key === '2') recordCardAnswer(true);
  }

  function setScreenshotFiles(files) {
    if (state.screenshots.scanning) return;
    revokeScreenshotUrls();
    state.screenshots.files = files.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      file,
      url: URL.createObjectURL(file),
    }));
    state.screenshots.results = [];
    elements.screenshotInput.value = '';
    renderSelectedFiles();
    renderScanReviews();
  }

  function renderSelectedFiles() {
    const files = state.screenshots.files;
    elements.selectedFileCount.textContent = files.length
      ? `${files.length} screenshot${files.length === 1 ? '' : 's'} selected`
      : 'No screenshots selected';
    elements.scanScreenshotsButton.disabled = !files.length || state.screenshots.scanning;
    elements.selectedFiles.innerHTML = files.map(item => `
      <figure class="selected-file">
        <img src="${item.url}" alt="">
        <figcaption title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</figcaption>
      </figure>
    `).join('');
  }

  async function scanScreenshots() {
    if (!state.screenshots.files.length || state.screenshots.scanning) return;
    state.screenshots.scanning = true;
    state.screenshots.results = [];
    elements.scanScreenshotsButton.disabled = true;
    elements.ocrProgress.hidden = false;
    updateOcrProgress(2, 'Loading the Japanese and English OCR engine…');

    let worker = null;
    try {
      worker = await prepareOcrWorker(message => {
        if (message.status === 'loading language traineddata') {
          updateOcrProgress(4, 'Loading Japanese and English language data…');
        }
      });

      const total = state.screenshots.files.length;
      for (let index = 0; index < total; index += 1) {
        const selected = state.screenshots.files[index];
        const startPercent = 8 + (index / total) * 88;
        updateOcrProgress(startPercent, `Scanning ${index + 1} of ${total}: ${selected.file.name}`);
        try {
          const result = await scanOneScreenshot(worker, selected, index);
          state.screenshots.results.push(result);
        } catch (error) {
          console.warn(`OCR failed for ${selected.file.name}:`, error);
          state.screenshots.results.push(createEmptyScanResult(selected, index, error.message));
        }
        renderScanReviews();
      }
      updateOcrProgress(100, 'Scan complete. Review the drafts below.');
      showToast(`${state.screenshots.results.length} screenshots scanned`);
    } catch (error) {
      console.error('Could not start OCR:', error);
      state.screenshots.results = state.screenshots.files.map((selected, index) => createEmptyScanResult(selected, index, error.message));
      renderScanReviews();
      updateOcrProgress(100, 'OCR could not start. Manual review cards were created instead.');
      alert(`The OCR engine could not start.\n\n${error.message}\n\nYou can still type into the review cards. To restore OCR, close the server, run npm install, and then npm start again.`);
    } finally {
      if (worker) {
        try { await worker.terminate(); } catch (error) { console.warn('Could not close OCR worker:', error); }
      }
      state.screenshots.scanning = false;
      elements.scanScreenshotsButton.disabled = !state.screenshots.files.length;
      renderSelectedFiles();
    }
  }

  async function prepareOcrWorker(logger) {
    if (location.protocol === 'file:') {
      throw new Error('This version must be opened through the local Node server. Run npm start instead of opening index.html directly.');
    }

    const status = await getLocalOcrStatus();
    if (!status.ready) {
      throw new Error(status.message || 'Local OCR packages are missing. Close the server, run npm install, and start the app again.');
    }

    const assetRoot = new URL(`${OCR_ASSET_ROOT}/`, window.location.href).href.replace(/\/$/, '');
    await loadTesseractScript(`${assetRoot}/tesseract.min.js`);
    if (!window.Tesseract?.createWorker) {
      throw new Error('The local Tesseract.js browser library could not be loaded. Run npm install and restart the app.');
    }

    const worker = await window.Tesseract.createWorker(['jpn', 'eng'], 1, {
      workerPath: `${assetRoot}/worker.min.js`,
      corePath: `${assetRoot}/core`,
      langPath: `${assetRoot}/lang`,
      workerBlobURL: false,
      gzip: true,
      logger,
      errorHandler: error => console.error('OCR worker error:', error),
    });
    await worker.setParameters({
      tessedit_pageseg_mode: '11',
      preserve_interword_spaces: '1',
    });
    return worker;
  }

  async function getLocalOcrStatus() {
    try {
      const response = await fetch('./api/ocr-status', {cache: 'no-store'});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ready: false,
          message: payload.message || `OCR server check failed with HTTP ${response.status}.`,
        };
      }
      return payload;
    } catch (error) {
      return {
        ready: false,
        message: 'The local Node server is not providing the OCR packages. Run npm start from the app folder.',
      };
    }
  }

  function loadTesseractScript(source) {
    if (window.Tesseract?.createWorker) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load OCR script: ${source}`));
      document.head.appendChild(script);
    });
  }

  async function scanOneScreenshot(worker, selected, index) {
    const image = await loadImageBitmap(selected.file);
    await worker.setParameters({tessedit_pageseg_mode: '11', preserve_interword_spaces: '1'});

    const mainScan = await recognizeCropWithFallback(worker, image, {x: 0, y: 0.07, width: 1, height: 0.56}, 1.8, createTextMaskCrop, {text: true, blocks: true});
    const feedbackScan = await recognizeCropWithFallback(worker, image, {x: 0, y: 0.69, width: 1, height: 0.23}, 1.8, createTextMaskCrop);
    const selectedScan = await recognizeCropWithFallback(worker, image, {x: 0, y: 0.14, width: 1, height: 0.61}, 1.8, createSelectedTextCanvas);
    if (typeof image.close === 'function') image.close();

    const mainCanvas = mainScan.canvas;
    const main = mainScan.result;
    const feedback = feedbackScan.result;
    const selectedAnswer = selectedScan.result;

    const mainText = orderedOcrText(main.data?.blocks) || main.data?.text || '';
    const feedbackText = feedback.data?.text || '';
    const selectedText = selectedAnswer.data?.text || '';
    const regions = ocrRegionTexts(main.data?.blocks, mainCanvas.width, mainCanvas.height, mainText);
    const exerciseType = detectExerciseType(`${regions.header}\n${mainText}`);

    const upperJapanese = extractJapanese(regions.upper);
    const lowerJapanese = extractJapanese(regions.lower);
    const broadJapanese = extractJapanese(regions.content || mainText);
    const selectedJapanese = extractJapanese(selectedText);
    const upperEnglish = extractEnglishFromText(regions.upper);
    const lowerEnglish = extractEnglishFromText(regions.lower);
    const selectedEnglish = extractEnglishFromText(selectedText);
    const feedbackEnglish = extractEnglishFromText(feedbackText);

    let japanese = '';
    let english = '';
    const isTranslate = exerciseType === 'Translate the sentence';
    const isComplete = exerciseType === 'Complete the sentence';
    const isFillBlank = exerciseType === 'Fill in the blank';
    const isNewWord = exerciseType === 'New word';

    if (isNewWord) {
      japanese = bestJapaneseCandidate(upperJapanese, broadJapanese);
      if (selectedJapanese && !normalizeDuplicateText(japanese).includes(normalizeDuplicateText(selectedJapanese))) {
        japanese = cleanupJapanese(`${selectedJapanese}${japanese}`);
      }
      english = feedbackEnglish || selectedEnglish || lowerEnglish || upperEnglish;
    } else if (isTranslate) {
      // The "upper" region is cropped starting at 30% from the left to skip the
      // character illustration. Word-bank answer tiles can start at the very left
      // edge, so trusting "upper" alone drops tiles outside that crop. Blend in the
      // full-width regions and let bestJapaneseCandidate pick the most complete one.
      japanese = bestJapaneseCandidate(selectedJapanese, broadJapanese, upperJapanese, lowerJapanese);
      english = japaneseCharacterCount(upperJapanese) >= 3
        ? (feedbackEnglish || selectedEnglish || lowerEnglish || upperEnglish)
        : (feedbackEnglish || upperEnglish || selectedEnglish || lowerEnglish);
    } else if (isComplete || isFillBlank) {
      japanese = bestJapaneseCandidate(upperJapanese, lowerJapanese, broadJapanese);
      english = feedbackEnglish || selectedEnglish || upperEnglish || lowerEnglish;
    } else {
      japanese = bestJapaneseCandidate(upperJapanese, lowerJapanese, selectedJapanese, broadJapanese);
      english = feedbackEnglish || selectedEnglish || upperEnglish || lowerEnglish;
    }

    english = normalizeEnglishOcr(english);
    const kana = japanese && !containsKanji(japanese) ? japanese : '';
    const romaji = kana ? kanaToRomaji(kana) : '';
    const words = suggestWords(japanese, english, `${mainText}\n${selectedText}`, exerciseType, selectedJapanese);
    const warnings = [];
    if (!japanese) warnings.push('Japanese was not detected');
    if (!english) warnings.push('English meaning was not detected');
    if (containsKanji(japanese)) warnings.push('Check kana and romaji');
    if (isFillBlank) warnings.push(selectedJapanese ? `Insert/check selected answer: ${selectedJapanese}` : 'Check the missing word');

    return {
      id: `scan-${Date.now()}-${index}`,
      fileName: selected.file.name,
      imageUrl: selected.url,
      exerciseType,
      confidence: averageConfidence(main.data?.confidence, feedback.data?.confidence, selectedAnswer.data?.confidence),
      warning: warnings.join(' · '),
      rawMain: `${mainText}${selectedText ? `\n\n[Highlighted / selected text]\n${selectedText}` : ''}`,
      rawFeedback: feedbackText,
      sentence: {
        selected: Boolean(japanese && english),
        english,
        romaji,
        kanji: japanese,
        kana,
      },
      words,
    };
  }

  function createEmptyScanResult(selected, index, message) {
    return {
      id: `scan-${Date.now()}-${index}`,
      fileName: selected.file.name,
      imageUrl: selected.url,
      exerciseType: 'Manual review',
      confidence: 0,
      warning: message || 'OCR did not return text',
      rawMain: '',
      rawFeedback: '',
      sentence: {selected: false, english: '', romaji: '', kanji: '', kana: ''},
      words: [],
    };
  }

  // Colour-based text masking (createTextMaskCrop / createSelectedTextCanvas) is tuned to
  // Duolingo's usual light-on-dark and green/purple highlight colours. When a screenshot uses
  // different colours (theme, exercise type, device) the mask can come back empty, so fall back
  // to a plain contrast-stretched crop rather than losing the region entirely.
  function isWeakOcrData(data) {
    const text = String(data?.text || '');
    const meaningfulChars = (text.match(/[ぁ-んァ-ヶ一-龯々ーA-Za-z]/g) || []).length;
    const confidence = Number(data?.confidence) || 0;
    return meaningfulChars < 3 || confidence < 35;
  }

  async function recognizeCropWithFallback(worker, image, crop, scale, maskFn, recognizeOptions = {}) {
    const maskedCanvas = maskFn(image, crop, scale);
    let canvas = maskedCanvas;
    let result = await worker.recognize(maskedCanvas, {}, recognizeOptions);

    if (isWeakOcrData(result.data)) {
      const contrastCanvas = createOcrCrop(image, crop, scale);
      const fallback = await worker.recognize(contrastCanvas, {}, recognizeOptions);
      if (!isWeakOcrData(fallback.data) || (Number(fallback.data?.confidence) || 0) > (Number(result.data?.confidence) || 0)) {
        canvas = contrastCanvas;
        result = fallback;
      }
    }

    return {canvas, result};
  }

  async function loadImageBitmap(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image.'));
      };
      image.src = url;
    });
  }

  function createOcrCrop(image, crop, scale) {
    const canvas = drawImageCrop(image, crop, scale);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let minimum = 255;
    let maximum = 0;
    const grey = new Uint8Array(canvas.width * canvas.height);
    for (let pixel = 0, offset = 0; offset < pixels.data.length; pixel += 1, offset += 4) {
      const value = Math.round(0.2126 * pixels.data[offset] + 0.7152 * pixels.data[offset + 1] + 0.0722 * pixels.data[offset + 2]);
      grey[pixel] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    const range = Math.max(40, maximum - minimum);
    for (let pixel = 0, offset = 0; offset < pixels.data.length; pixel += 1, offset += 4) {
      const value = Math.round(Math.max(0, Math.min(255, ((grey[pixel] - minimum) / range) * 255)));
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }

  function drawImageCrop(image, crop, scale) {
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const sx = Math.round(sourceWidth * crop.x);
    const sy = Math.round(sourceHeight * crop.y);
    const sw = Math.round(sourceWidth * crop.width);
    const sh = Math.round(sourceHeight * crop.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function createTextMaskCrop(image, crop, scale) {
    const canvas = drawImageCrop(image, crop, scale);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const mask = new Uint8Array(canvas.width * canvas.height);

    for (let pixel = 0, offset = 0; offset < pixels.data.length; pixel += 1, offset += 4) {
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      const brightness = (red + green + blue) / 3;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const greenScore = green - (red + blue) / 2;
      const purpleScore = (red + blue) / 2 - green;
      const lightText = brightness > 148 && spread < 110;
      const greenText = green > 75 && greenScore > 7;
      const purpleText = red > 90 && blue > 90 && purpleScore > 22;
      mask[pixel] = lightText || greenText || purpleText ? 1 : 0;
    }

    return maskToCanvas(canvas, pixels, mask, {
      maxWidth: 220,
      maxHeight: 170,
      maxArea: 4400,
    });
  }

  function createSelectedTextCanvas(image, crop = {x: 0, y: 0.14, width: 1, height: 0.61}, scale = 1.8) {
    const canvas = drawImageCrop(image, crop, scale);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const mask = new Uint8Array(canvas.width * canvas.height);

    for (let pixel = 0, offset = 0; offset < pixels.data.length; pixel += 1, offset += 4) {
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      const greenScore = green - (red + blue) / 2;
      const purpleScore = (red + blue) / 2 - green;
      const greenText = green > 75 && greenScore > 9;
      const purpleText = red > 90 && blue > 90 && purpleScore > 24;
      mask[pixel] = greenText || purpleText ? 1 : 0;
    }

    return maskToCanvas(canvas, pixels, mask, {
      maxWidth: 230,
      maxHeight: 175,
      maxArea: 4800,
    });
  }

  function maskToCanvas(canvas, pixels, mask, limits) {
    const total = canvas.width * canvas.height;
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const output = new Uint8Array(total);
    const width = canvas.width;
    const height = canvas.height;

    for (let start = 0; start < total; start += 1) {
      if (!mask[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      queue[tail++] = start;
      visited[start] = 1;

      while (head < tail) {
        const current = queue[head++];
        const x = current % width;
        const y = Math.floor(current / width);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        if (x > 0) enqueue(current - 1);
        if (x + 1 < width) enqueue(current + 1);
        if (y > 0) enqueue(current - width);
        if (y + 1 < height) enqueue(current + width);
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;
      const keep = componentWidth <= limits.maxWidth && componentHeight <= limits.maxHeight && tail <= limits.maxArea;
      if (keep) {
        for (let index = 0; index < tail; index += 1) output[queue[index]] = 1;
      }

      function enqueue(index) {
        if (mask[index] && !visited[index]) {
          visited[index] = 1;
          queue[tail++] = index;
        }
      }
    }

    for (let pixel = 0; pixel < total; pixel += 1) {
      const value = output[pixel] ? 0 : 255;
      const offset = pixel * 4;
      pixels.data[offset] = value;
      pixels.data[offset + 1] = value;
      pixels.data[offset + 2] = value;
      pixels.data[offset + 3] = 255;
    }
    canvas.getContext('2d', {willReadFrequently: true}).putImageData(pixels, 0, 0);
    return canvas;
  }

  function collectOcrWords(blocks) {
    const words = [];
    const seen = new Set();

    const addWord = node => {
      if (!node?.bbox || typeof node.text !== 'string') return;
      const text = node.text.trim();
      if (!text) return;
      const bbox = node.bbox;
      const word = {
        text,
        confidence: Number(node.confidence ?? node.conf ?? 100),
        x0: Number(bbox.x0),
        y0: Number(bbox.y0),
        x1: Number(bbox.x1),
        y1: Number(bbox.y1),
      };
      if (![word.x0, word.y0, word.x1, word.y1].every(Number.isFinite)) return;
      const key = `${word.x0}:${word.y0}:${word.x1}:${word.y1}:${word.text}`;
      if (seen.has(key)) return;
      seen.add(key);
      words.push(word);
    };

    const visit = node => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }

      // Tesseract's block output keeps the useful bounding boxes on word
      // objects. A word may itself contain symbols, so do not require it to
      // be a leaf node.
      if (Array.isArray(node.words)) node.words.forEach(addWord);

      for (const key of ['blocks', 'paragraphs', 'lines']) {
        if (node[key]) visit(node[key]);
      }

      // Fallback for alternate/older block shapes that expose word-like
      // objects directly rather than inside a `words` array.
      if (!node.words && !node.lines && !node.paragraphs && !node.blocks) addWord(node);
    };

    visit(blocks);
    return words.filter(word => word.confidence >= 18);
  }

  function orderedOcrText(blocks, region = null) {
    let words = collectOcrWords(blocks);
    if (region && words.length) {
      words = words.filter(word => {
        const x = (word.x0 + word.x1) / 2;
        const y = (word.y0 + word.y1) / 2;
        return x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
      });
    }
    if (!words.length) return '';

    const heights = words.map(word => Math.max(1, word.y1 - word.y0)).sort((a, b) => a - b);
    const medianHeight = heights[Math.floor(heights.length / 2)] || 24;
    const rows = [];
    for (const word of words.sort((a, b) => ((a.y0 + a.y1) / 2) - ((b.y0 + b.y1) / 2) || a.x0 - b.x0)) {
      const centerY = (word.y0 + word.y1) / 2;
      let row = rows.find(candidate => Math.abs(candidate.centerY - centerY) <= Math.max(12, medianHeight * 0.72));
      if (!row) {
        row = {centerY, words: []};
        rows.push(row);
      }
      row.words.push(word);
      row.centerY = row.words.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / row.words.length;
    }
    return rows
      .sort((a, b) => a.centerY - b.centerY)
      .map(row => row.words.sort((a, b) => a.x0 - b.x0).map(word => word.text).join(' '))
      .join('\n');
  }

  function ocrRegionTexts(blocks, width, height, fallbackText) {
    const words = collectOcrWords(blocks);
    if (!words.length) return {header: fallbackText, upper: fallbackText, lower: fallbackText, content: fallbackText};
    const text = region => orderedOcrText(blocks, {
      x0: region.x0 * width,
      y0: region.y0 * height,
      x1: region.x1 * width,
      y1: region.y1 * height,
    });
    return {
      header: text({x0: 0, y0: 0, x1: 1, y1: 0.28}),
      upper: text({x0: 0.30, y0: 0.15, x1: 1, y1: 0.67}),
      lower: text({x0: 0.02, y0: 0.47, x1: 0.99, y1: 1}),
      content: text({x0: 0.02, y0: 0.15, x1: 0.99, y1: 1}),
    };
  }

  function detectExerciseType(text) {
    if (/new\s*word/i.test(text)) return 'New word';
    if (/fill\s+in\s+the\s+blank/i.test(text)) return 'Fill in the blank';
    if (/complete\s+the\s+sentence/i.test(text)) return 'Complete the sentence';
    if (/translate\s+this\s+sentence/i.test(text)) return 'Translate the sentence';
    return 'Sentence screenshot';
  }

  function extractJapanese(text) {
    const lines = cleanOcrLines(text)
      .map(line => line.replace(/[|｜¦]/g, ''))
      .filter(line => hasJapanese(line));
    if (!lines.length) return '';

    const candidates = [];
    for (let start = 0; start < lines.length; start += 1) {
      let combined = '';
      for (let end = start; end < Math.min(lines.length, start + 4); end += 1) {
        combined = normalizeJapaneseSpacing(`${combined}${lines[end]}`);
        const japaneseCount = (combined.match(/[ぁ-んァ-ヶ一-龯々ー]/g) || []).length;
        const punctuationBonus = /[。！？!?]$/.test(combined) ? 28 : 0;
        const kanjiBonus = containsKanji(combined) ? 5 : 0;
        const shortPenalty = japaneseCount <= 3 ? 15 : 0;
        candidates.push({value: combined, score: japaneseCount + punctuationBonus + kanjiBonus - shortPenalty});
        if (/[。！？!?]$/.test(combined)) break;
      }
    }

    candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
    return cleanupJapanese(candidates[0]?.value || '');
  }

  function extractEnglish(feedbackText, answerText, mainText) {
    return extractEnglishFromText(feedbackText) || extractEnglishFromText(answerText) || extractEnglishFromText(mainText);
  }

  function extractEnglishFromText(text) {
    const lines = englishCandidates(text);
    if (!lines.length) return '';
    const candidates = [...lines];
    for (let start = 0; start < lines.length; start += 1) {
      for (let length = 2; length <= 3 && start + length <= lines.length; length += 1) {
        candidates.push(lines.slice(start, start + length).join(' '));
      }
    }
    return chooseEnglishCandidate(candidates);
  }

  function englishCandidates(text) {
    const rejected = /^(combo|translate this sentence|complete the sentence|fill in the blank|new word|previous mistake|correct|correct meaning|good job|great|amazing|excellent|nicely done|nice|meaning|explain my answer|continue)$/i;
    const uiMessage = /^(correct|good job|great|amazing|excellent|nicely done|nice)(!|\.|:|\s|$)/i;
    return cleanOcrLines(text)
      .map(normalizeEnglishOcr)
      .filter(line => /[A-Za-zÀ-ž]/.test(line))
      .filter(line => !hasJapanese(line))
      .filter(line => !rejected.test(line.replace(/[.!:]+$/g, '').trim()))
      .filter(line => !uiMessage.test(line))
      .filter(line => !/^(\d{1,2}:\d{2}|\d+%|ID\s*\d+)$/i.test(line))
      .filter(line => line.length >= 2);
  }

  function chooseEnglishCandidate(lines) {
    if (!lines.length) return '';
    const unique = [...new Set(lines.map(normalizeEnglishOcr).filter(Boolean))];
    const sentenceLines = unique.filter(looksLikeEnglishSentence);
    const pool = sentenceLines.length ? sentenceLines : unique;
    return normalizeEnglishOcr(pool.sort((a, b) => englishLineScore(b) - englishLineScore(a))[0] || '');
  }

  function looksLikeEnglishSentence(line) {
    const text = normalizeEnglishOcr(line);
    const words = text.split(/\s+/).filter(Boolean);
    return words.length >= 3 || /[.!?]$/.test(text) || /\b(i|you|we|they|he|she|it|this|that|there|shall|did|do|does|is|are|was|were|want|going|takes?)\b/i.test(text);
  }

  function normalizeEnglishOcr(value) {
    return String(value || '')
      .replace(/^[✓✔✕×@!•:;\-\s]+/, '')
      .replace(/^\|(?=\s|$)/, 'I')
      .replace(/\s+/g, ' ')
      .replace(/^(correct!?\s*meaning|correct\s*meaning|nicely done\.?\s*meaning|nice!?\s*meaning|meaning)\s*:?\s*/i, '')
      .replace(/\s+([.!?,])/g, '$1')
      .replace(/\s+'\s*s\b/gi, "'s")
      .trim();
  }

  function englishLineScore(line) {
    const text = normalizeEnglishOcr(line);
    const words = text.split(/\s+/).filter(Boolean).length;
    const shortDistractorPenalty = words <= 2 ? 35 : 0;
    const uiPenalty = /\b(combo|continue|explain|good job|correct|amazing|excellent|previous mistake)\b/i.test(text) ? 80 : 0;
    return text.length + words * 6 + (/[.!?]$/.test(text) ? 22 : 0) - shortDistractorPenalty - uiPenalty;
  }

  function cleanOcrLines(text) {
    return String(text || '')
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function normalizeJapaneseSpacing(value) {
    return String(value || '')
      .replace(/\s*([ぁ-んァ-ヶ一-龯々ー])\s*/g, '$1')
      .replace(/\s*([。、！？「」『』（）])\s*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanupJapanese(value) {
    return normalizeJapaneseSpacing(value)
      .replace(/^[^ぁ-んァ-ヶ一-龯々ー]+/, '')
      .replace(/[^ぁ-んァ-ヶ一-龯々ー。、！？!?「」『』（）0-9０-９]+$/g, '')
      .trim();
  }

  function hasJapanese(value) {
    return /[ぁ-んァ-ヶ一-龯々ー]/.test(value);
  }

  function containsKanji(value) {
    return /[一-龯々]/.test(value);
  }

  function japaneseCharacterCount(value) {
    return (String(value || '').match(/[ぁ-んァ-ヶ一-龯々ー]/g) || []).length;
  }

  function bestJapaneseCandidate(...values) {
    return values
      .map(value => cleanupJapanese(value || ''))
      .filter(Boolean)
      .sort((a, b) => japaneseCharacterCount(b) - japaneseCharacterCount(a) || b.length - a.length)[0] || '';
  }

  function suggestWords(japanese, english, rawMain, exerciseType, selectedJapanese = '') {
    const suggestions = [];
    const usedJapanese = new Set();

    if (exerciseType === 'New word' && japanese) {
      const jp = japanese.replace(/[。！？!?]+$/g, '').replace(/(です|でした)$/g, '').trim();
      const en = english
        .replace(/[.!?]+$/g, '')
        .replace(/^(i am|i'm|it is|it's|we are|we're|you are|you're)\s+/i, '')
        .trim();
      if (jp) {
        usedJapanese.add(normalizeDuplicateText(jp));
        const kana = containsKanji(jp) ? '' : jp;
        suggestions.push({
          id: makeDraftId('word'),
          selected: true,
          english: en,
          romaji: kana ? kanaToRomaji(kana) : '',
          kanji: jp,
          kana,
        });
      }
    }

    if (selectedJapanese && exerciseType === 'Fill in the blank') {
      const selectedPieces = cleanOcrLines(selectedJapanese)
        .map(cleanupJapanese)
        .filter(piece => japaneseCharacterCount(piece) >= 1 && japaneseCharacterCount(piece) <= 12);
      for (const piece of selectedPieces) {
        const key = normalizeDuplicateText(piece);
        if (!key || usedJapanese.has(key)) continue;
        usedJapanese.add(key);
        const kana = containsKanji(piece) ? '' : piece;
        suggestions.push({
          id: makeDraftId('word'),
          selected: false,
          english: '',
          romaji: kana ? kanaToRomaji(kana) : '',
          kanji: piece,
          kana,
        });
      }
    }

    const particleStopList = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'の', 'へ', 'も', 'や', 'か', 'ね', 'よ', 'から', 'まで', 'です', 'ます']);
    const shortCandidates = cleanOcrLines(rawMain)
      .map(cleanupJapanese)
      .filter(candidate => candidate && candidate !== japanese)
      .filter(candidate => !/[。！？!?]/.test(candidate))
      .filter(candidate => {
        const count = (candidate.match(/[ぁ-んァ-ヶ一-龯々ー]/g) || []).length;
        return count >= 2 && count <= 10;
      })
      .filter(candidate => !particleStopList.has(candidate));

    for (const candidate of shortCandidates) {
      const key = normalizeDuplicateText(candidate);
      if (usedJapanese.has(key) || normalizeDuplicateText(japanese).includes(key)) continue;
      usedJapanese.add(key);
      const kana = containsKanji(candidate) ? '' : candidate;
      suggestions.push({
        id: makeDraftId('word'),
        selected: false,
        english: '',
        romaji: kana ? kanaToRomaji(kana) : '',
        kanji: candidate,
        kana,
      });
      if (suggestions.length >= 4) break;
    }

    return suggestions;
  }

  function averageConfidence(...values) {
    const valid = values.map(Number).filter(Number.isFinite);
    return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
  }

  function updateOcrProgress(percent, text) {
    elements.ocrProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    elements.ocrProgressText.textContent = text;
  }

  function renderScanReviews() {
    const results = state.screenshots.results;
    elements.reviewPanel.hidden = results.length === 0;
    renderNewWordsSummary();
    if (!results.length) {
      elements.scanReviewList.innerHTML = '';
      return;
    }

    elements.scanReviewList.innerHTML = results.map((result, index) => `
      <article class="scan-review-card" data-scan-id="${result.id}">
        <div class="scan-card-header">
          <img src="${result.imageUrl}" alt="Screenshot preview">
          <div class="scan-meta">
            <span class="scan-number">Screenshot ${index + 1}</span>
            <strong>${escapeHtml(result.fileName)}</strong>
            <span>${escapeHtml(result.exerciseType)} · OCR ${result.confidence}%</span>
            ${result.warning ? `<em>${escapeHtml(result.warning)}</em>` : ''}
          </div>
        </div>

        <section class="draft-section">
          <div class="draft-section-title">
            <label class="select-entry"><input type="checkbox" data-section="sentence" data-field="selected" ${result.sentence.selected ? 'checked' : ''}> Import sentence</label>
            <span>Sentence ID assigned on import</span>
          </div>
          <div class="draft-fields">
            ${draftField('English', 'sentence', 'english', result.sentence.english, true)}
            ${draftField('Romaji', 'sentence', 'romaji', result.sentence.romaji, true)}
            ${draftField('Kanji / Japanese', 'sentence', 'kanji', result.sentence.kanji, true)}
            ${draftField('Kana', 'sentence', 'kana', result.sentence.kana, true)}
          </div>
        </section>

        <section class="draft-section word-drafts">
          <div class="draft-section-title">
            <strong>Suggested words</strong>
            <button class="text-button" type="button" data-scan-action="add-word">＋ Add word</button>
          </div>
          <div class="word-draft-list">
            ${result.words.length ? result.words.map(word => wordDraftTemplate(word)).join('') : '<p class="no-word-suggestions">No confident word suggestion. Add one manually when useful.</p>'}
          </div>
        </section>

        <details class="raw-ocr">
          <summary>Show raw OCR text</summary>
          <div><strong>Main area</strong><pre>${escapeHtml(result.rawMain || 'No text')}</pre></div>
          <div><strong>Feedback area</strong><pre>${escapeHtml(result.rawFeedback || 'No text')}</pre></div>
        </details>
      </article>
    `).join('');
  }

  function draftField(label, section, field, value, multiline = false, wordId = '') {
    const attributes = `data-section="${section}" data-field="${field}"${wordId ? ` data-word-id="${wordId}"` : ''}`;
    if (multiline) {
      return `<label>${label}<textarea ${attributes} rows="1">${escapeHtml(value)}</textarea></label>`;
    }
    return `<label>${label}<input ${attributes} value="${escapeHtml(value)}"></label>`;
  }

  function wordDraftTemplate(word) {
    return `
      <div class="word-draft" data-word-id="${word.id}">
        <div class="word-draft-top">
          <label class="select-entry"><input type="checkbox" data-section="word" data-field="selected" data-word-id="${word.id}" ${word.selected ? 'checked' : ''}> Import word</label>
          <button class="row-action" type="button" data-scan-action="remove-word" data-word-id="${word.id}" title="Remove suggestion">×</button>
        </div>
        <div class="draft-fields">
          ${draftField('English', 'word', 'english', word.english, false, word.id)}
          ${draftField('Romaji', 'word', 'romaji', word.romaji, false, word.id)}
          ${draftField('Kanji / Japanese', 'word', 'kanji', word.kanji, false, word.id)}
          ${draftField('Kana', 'word', 'kana', word.kana, false, word.id)}
        </div>
      </div>
    `;
  }

  function updateScanDraftFromInput(event) {
    const target = event.target;
    const card = target.closest('[data-scan-id]');
    if (!card || !target.dataset.section || !target.dataset.field) return;
    const result = state.screenshots.results.find(item => item.id === card.dataset.scanId);
    if (!result) return;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    if (target.dataset.section === 'sentence') {
      result.sentence[target.dataset.field] = value;
      return;
    }

    const word = result.words.find(item => item.id === target.dataset.wordId);
    if (word) word[target.dataset.field] = value;
    renderNewWordsSummary();
  }

  function handleScanReviewClick(event) {
    const button = event.target.closest('[data-scan-action]');
    if (!button) return;
    const card = button.closest('[data-scan-id]');
    const result = state.screenshots.results.find(item => item.id === card?.dataset.scanId);
    if (!result) return;

    if (button.dataset.scanAction === 'add-word') {
      result.words.push({id: makeDraftId('word'), selected: true, english: '', romaji: '', kanji: '', kana: ''});
      renderScanReviews();
    }
    if (button.dataset.scanAction === 'remove-word') {
      result.words = result.words.filter(word => word.id !== button.dataset.wordId);
      renderScanReviews();
    }
  }

  function importSelectedScans() {
    const entries = [];
    for (const result of state.screenshots.results) {
      if (result.sentence.selected) {
        entries.push({...result.sentence, type: 'sentence', source: screenshotSource(result)});
      }
      for (const word of result.words) {
        if (word.selected) entries.push({...word, type: 'word', source: screenshotSource(result)});
      }
    }

    if (!entries.length) {
      alert('Select at least one sentence or word to import.');
      return;
    }

    const summary = mergeImportedEntries(entries);
    saveCollections();
    renderCounts();
    setCardCategory(elements.cardSetupForm.elements.cardType.value, false);
    showToast(`${summary.added} added · ${summary.duplicates} duplicates · ${summary.invalid} incomplete`);

    for (const result of state.screenshots.results) {
      result.sentence.selected = false;
      result.words.forEach(word => { word.selected = false; });
    }
    renderScanReviews();
  }

  function screenshotSource(result) {
    return {
      kind: 'duolingo-screenshot',
      filename: result.fileName,
      importedAt: new Date().toISOString(),
      ocrConfidence: result.confidence,
    };
  }

  function findDuplicate(candidate) {
    const japanese = normalizeDuplicateText(candidate.kanji || candidate.kana);
    const kana = normalizeDuplicateText(candidate.kana);
    const english = normalizeDuplicateText(candidate.english);
    return collection(candidate.type).find(item => {
      const itemJapanese = normalizeDuplicateText(item.kanji || item.kana);
      const itemKana = normalizeDuplicateText(item.kana);
      const itemEnglish = normalizeDuplicateText(item.english);
      return (japanese && japanese === itemJapanese) || (kana && kana === itemKana) || (english && japanese && english === itemEnglish && japanese === itemJapanese);
    });
  }

  function normalizeDuplicateText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[\s。、！？!?.,'"“”‘’()（）\-]/g, '');
  }

  function computeNewWordCandidates() {
    const seen = new Set();
    const candidates = [];
    for (const result of state.screenshots.results) {
      for (const word of result.words) {
        const kanji = String(word.kanji || '').trim();
        const kana = String(word.kana || '').trim();
        const english = String(word.english || '').trim();
        if (!kanji && !kana) continue;
        const key = normalizeDuplicateText(kanji || kana);
        if (!key || seen.has(key)) continue;
        if (findDuplicate({type: 'word', kanji, kana, english})) continue;
        seen.add(key);
        candidates.push({kanji, kana, english, source: result.fileName});
      }
    }
    return candidates;
  }

  function renderNewWordsSummary() {
    const hasScans = state.screenshots.results.length > 0;
    elements.newWordsPanel.hidden = !hasScans;
    if (!hasScans) return;

    const candidates = computeNewWordCandidates();
    elements.newWordsSummaryText.textContent = candidates.length
      ? `${candidates.length} new word${candidates.length === 1 ? '' : 's'} not already in your list`
      : 'No new words — everything suggested is already saved';
    elements.newWordsList.innerHTML = candidates.length
      ? candidates.map(candidate => `
        <li>
          <span class="new-word-jp">${escapeHtml(candidate.kanji || candidate.kana)}</span>
          <span class="new-word-en">${escapeHtml(candidate.english || '—')}</span>
          <span class="new-word-source">${escapeHtml(candidate.source)}</span>
        </li>
      `).join('')
      : '';
  }

  function clearScreenshotWorkspace() {
    if (state.screenshots.scanning) return;
    revokeScreenshotUrls();
    state.screenshots.files = [];
    state.screenshots.results = [];
    elements.ocrProgress.hidden = true;
    renderSelectedFiles();
    renderScanReviews();
  }

  function revokeScreenshotUrls() {
    for (const item of state.screenshots.files) URL.revokeObjectURL(item.url);
  }

  function makeDraftId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function kanaToRomaji(input) {
    const digraphs = {
      きゃ:'kya',きゅ:'kyu',きょ:'kyo',しゃ:'sha',しゅ:'shu',しょ:'sho',ちゃ:'cha',ちゅ:'chu',ちょ:'cho',
      にゃ:'nya',にゅ:'nyu',にょ:'nyo',ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',みゃ:'mya',みゅ:'myu',みょ:'myo',
      りゃ:'rya',りゅ:'ryu',りょ:'ryo',ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',じゃ:'ja',じゅ:'ju',じょ:'jo',
      びゃ:'bya',びゅ:'byu',びょ:'byo',ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',てぃ:'ti',でぃ:'di',ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo',
      うぃ:'wi',うぇ:'we',うぉ:'wo',しぇ:'she',じぇ:'je',ちぇ:'che',つぁ:'tsa',つぃ:'tsi',つぇ:'tse',つぉ:'tso',
    };
    const singles = {
      あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',
      た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
      ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',を:'wo',ん:'n',
      が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
      ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',ゔ:'vu',ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o',
    };
    const hiragana = katakanaToHiragana(String(input || '').normalize('NFKC'));
    let output = '';
    let geminate = false;
    for (let i = 0; i < hiragana.length; i += 1) {
      const char = hiragana[i];
      if (char === 'っ') {
        geminate = true;
        continue;
      }
      if (char === 'ー') {
        const vowel = output.match(/[aeiou](?!.*[aeiou])/g)?.at(-1);
        if (vowel) output += vowel;
        continue;
      }
      const pair = hiragana.slice(i, i + 2);
      let romaji = digraphs[pair];
      if (romaji) i += 1;
      else romaji = singles[char];
      if (!romaji) {
        output += char;
        geminate = false;
        continue;
      }
      if (geminate && /^[bcdfghjkmprstzw]/.test(romaji)) romaji = romaji[0] + romaji;
      output += romaji;
      geminate = false;
    }
    return output
      .replace(/n([bmp])/g, 'm$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function katakanaToHiragana(value) {
    return [...value].map(char => {
      const code = char.charCodeAt(0);
      return code >= 0x30A1 && code <= 0x30F6 ? String.fromCharCode(code - 0x60) : char;
    }).join('');
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }

  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], {type: `${type};charset=utf-8`});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function titleCase(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
