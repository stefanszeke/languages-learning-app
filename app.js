(() => {
  'use strict';

  const LEGACY_STORAGE_KEY = 'japanese-study-list-v1';
  const THEME_KEY = 'japanese-study-theme';
  const LANGUAGE_KEY = 'study-language';
  const OCR_ASSET_ROOT = './vendor';

  // Populated lazily by ensureGermanGenderDictionary(); declared up front
  // since init() below may call it before its definition further down runs.
  let germanGenderDictionaryPromise = null;
  let germanGenderDictionaryCache = null;

  const LANGUAGES = {
    ja: {
      id: 'ja',
      label: 'Japanese',
      shortLabel: '日',
      storagePrefix: 'japanese-study',
      fields: [
        {key: 'english', label: 'English', role: 'gloss', required: true},
        {key: 'romaji', label: 'Romaji', role: 'secondary'},
        {key: 'kanji', label: 'Kanji / Japanese', role: 'native', required: true},
        {key: 'kana', label: 'Kana', role: 'native-alt'},
      ],
      columnGroups: [
        {key: 'reading', label: 'Romaji / Kanji / Japanese / Kana', fields: ['romaji', 'kanji', 'kana']},
      ],
      identityFields: ['kanji', 'kana'],
      seedWords: () => window.INITIAL_WORDS || [],
      seedSentences: () => window.INITIAL_SENTENCES || [],
      supportsOcr: true,
      supportsMarkdownImport: true,
    },
    de: {
      id: 'de',
      label: 'German',
      shortLabel: 'DE',
      storagePrefix: 'german-study',
      fields: [
        {key: 'english', label: 'English', role: 'gloss', required: true},
        {key: 'german', label: 'German', role: 'native', required: true},
      ],
      identityFields: ['german'],
      seedWords: () => window.INITIAL_WORDS_DE || [],
      seedSentences: () => window.INITIAL_SENTENCES_DE || [],
      supportsOcr: false,
      supportsMarkdownImport: false,
    },
  };

  const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
  const initialLanguage = LANGUAGES[storedLanguage] ? storedLanguage : 'ja';
  const initialLanguageConfig = LANGUAGES[initialLanguage];

  const state = {
    language: initialLanguage,
    collections: loadCollections(initialLanguageConfig),
    screen: 'list',
    view: 'word',
    search: '',
    sortDirection: 'desc',
    covered: new Set(),
    cellOverrides: new Set(),
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
    brandMark: document.querySelector('#brandMark'),
    tabs: [...document.querySelectorAll('.tab')],
    importTab: document.querySelector('[data-view="import"]'),
    coverControls: document.querySelector('#coverControls'),
    addButton: document.querySelector('#addButton'),
    tableHeadRow: document.querySelector('#tableHeadRow'),
    languageSelect: document.querySelector('#languageSelect'),
    idFilterFrom: document.querySelector('#idFilterFrom'),
    idFilterTo: document.querySelector('#idFilterTo'),
    idFilterResetButton: document.querySelector('#idFilterResetButton'),
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
    dialogFieldGrid: document.querySelector('#dialogFieldGrid'),
    closeDialogButton: document.querySelector('#closeDialogButton'),
    cancelDialogButton: document.querySelector('#cancelDialogButton'),
    themeButton: document.querySelector('#themeButton'),
    toast: document.querySelector('#toast'),
    cardsSetup: document.querySelector('#cardsSetup'),
    cardSetupForm: document.querySelector('#cardSetupForm'),
    cardDirectionChoices: document.querySelector('#cardDirectionChoices'),
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
    importWordsButton: document.querySelector('#importWordsButton'),
  };

  initTheme();
  renderStructuralElements();
  saveCollections();
  if (state.language === 'de') ensureGermanGenderDictionary();
  bindEvents();
  setCardCategory('word', true);
  resetIdFilterToFullRange();
  elements.serverNotice.hidden = location.protocol !== 'file:';
  render();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function languageConfig(id = state.language) {
    return LANGUAGES[id] || LANGUAGES.ja;
  }

  function activeFields() {
    return languageConfig().fields;
  }

  // Groups multiple data fields (e.g. romaji/kanji/kana) into a single
  // table column with one cover button, per the language's columnGroups
  // config. Fields not listed in any group each become their own column.
  function activeColumns() {
    const fields = activeFields();
    const groupByField = new Map();
    (languageConfig().columnGroups || []).forEach(group => {
      group.fields.forEach(fieldKey => groupByField.set(fieldKey, group));
    });
    const columns = [];
    const emittedGroups = new Set();
    fields.forEach(field => {
      const group = groupByField.get(field.key);
      if (group) {
        if (emittedGroups.has(group.key)) return;
        emittedGroups.add(group.key);
        columns.push({key: group.key, label: group.label, fields: group.fields});
      } else {
        columns.push({key: field.key, label: field.label, fields: [field.key]});
      }
    });
    return columns;
  }

  function wordsKey(config) {
    return `${config.storagePrefix}-words-v2`;
  }

  function sentencesKey(config) {
    return `${config.storagePrefix}-sentences-v2`;
  }

  function seedCollections(config) {
    return {
      word: normalizeCollection(clone(config.seedWords() || []), 'word', config),
      sentence: normalizeCollection(clone(config.seedSentences() || []), 'sentence', config),
    };
  }

  function loadCollections(config) {
    const wordsSaved = readJsonStorage(wordsKey(config));
    const sentencesSaved = readJsonStorage(sentencesKey(config));

    if (Array.isArray(wordsSaved) || Array.isArray(sentencesSaved)) {
      return {
        word: normalizeCollection(Array.isArray(wordsSaved) ? wordsSaved : clone(config.seedWords() || []), 'word', config),
        sentence: normalizeCollection(Array.isArray(sentencesSaved) ? sentencesSaved : clone(config.seedSentences() || []), 'sentence', config),
      };
    }

    if (config.id === 'ja') {
      const legacy = readJsonStorage(LEGACY_STORAGE_KEY);
      if (Array.isArray(legacy)) {
        const ordered = legacy
          .map((item, index) => ({...item, _legacyOrder: parseNumericId(item.id) || index + 1}))
          .sort((a, b) => a._legacyOrder - b._legacyOrder);
        const words = ordered.filter(item => item.type !== 'sentence').map((item, index) => ({...item, id: index + 1}));
        const sentences = ordered.filter(item => item.type === 'sentence').map((item, index) => ({...item, id: index + 1}));
        return {
          word: normalizeCollection(words, 'word', config),
          sentence: normalizeCollection(sentences, 'sentence', config),
        };
      }
    }

    return seedCollections(config);
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

  function normalizeCollection(items, type, config = languageConfig()) {
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
      const entry = {id, type};
      for (const field of config.fields) {
        entry[field.key] = String(raw[field.key] || '').trim();
      }
      if (raw.article) entry.article = raw.article;
      if (raw.source) entry.source = raw.source;
      normalized.push(entry);
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
    const config = languageConfig();
    localStorage.setItem(wordsKey(config), JSON.stringify(state.collections.word));
    localStorage.setItem(sentencesKey(config), JSON.stringify(state.collections.sentence));
  }

  function bindEvents() {
    elements.tabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));

    elements.searchInput.addEventListener('input', event => {
      state.search = event.target.value.trim().toLocaleLowerCase();
      renderTable();
    });

    elements.coverControls.addEventListener('click', event => {
      const button = event.target.closest('.cover-button');
      if (!button) return;
      const column = button.dataset.column;
      state.covered.has(column) ? state.covered.delete(column) : state.covered.add(column);
      state.cellOverrides.clear();
      renderCoverButtons();
      renderTable();
    });

    elements.languageSelect.addEventListener('change', event => switchLanguage(event.target.value));

    elements.revealButton.addEventListener('click', () => {
      state.covered.clear();
      state.cellOverrides.clear();
      renderCoverButtons();
      renderTable();
    });

    elements.shuffleButton.addEventListener('click', () => {
      state.shuffledIds = shuffle(filteredItems().map(item => item.id));
      renderTable();
      showToast('Current list shuffled');
    });

    elements.idFilterFrom.addEventListener('input', () => { state.idFilterCustom = true; renderTable(); });
    elements.idFilterTo.addEventListener('input', () => { state.idFilterCustom = true; renderTable(); });
    elements.idFilterResetButton.addEventListener('click', () => {
      resetIdFilterToFullRange();
      renderTable();
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
      const cell = event.target.closest('.study-cell[data-reveal-key]');
      if (cell) {
        const key = cell.dataset.revealKey;
        state.cellOverrides.has(key) ? state.cellOverrides.delete(key) : state.cellOverrides.add(key);
        renderTable();
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
    elements.importScannedButton.addEventListener('click', importSelectedSentences);
    elements.importWordsButton.addEventListener('click', importSelectedWords);
    elements.scanReviewList.addEventListener('input', updateScanDraftFromInput);
    elements.scanReviewList.addEventListener('change', updateScanDraftFromInput);
    elements.refreshNewWordsButton.addEventListener('click', renderNewWordsSummary);
    elements.newWordsList.addEventListener('input', updateNewWordDraftFromInput);
    elements.newWordsList.addEventListener('change', updateNewWordDraftFromInput);
    elements.newWordsList.addEventListener('click', handleNewWordsClick);
  }

  function switchView(view) {
    if (view === 'import' && !languageConfig().supportsOcr) {
      showToast(`Screenshot import isn't available for ${languageConfig().label} yet`);
      return;
    }
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
      state.cellOverrides.clear();
      resetIdFilterToFullRange();
    }
    render();
  }

  function renderStructuralElements() {
    const config = languageConfig();

    elements.brandMark.textContent = config.shortLabel;

    elements.languageSelect.innerHTML = Object.values(LANGUAGES)
      .map(lang => `<option value="${lang.id}"${lang.id === state.language ? ' selected' : ''}>${escapeHtml(lang.label)}</option>`)
      .join('');

    const dataHeaders = activeColumns().map(column => `<th scope="col">${escapeHtml(column.label)}</th>`).join('');
    elements.tableHeadRow.innerHTML = `
      <th scope="col" class="id-column"><button type="button" class="sort-button" id="idSortButton" aria-label="Sort by ID">ID <span id="idSortIndicator" aria-hidden="true">▼</span></button></th>
      ${dataHeaders}
      <th scope="col" class="actions-column"><span class="sr-only">Actions</span></th>
    `;
    elements.idSortButton = document.querySelector('#idSortButton');
    elements.idSortIndicator = document.querySelector('#idSortIndicator');
    elements.idSortButton.addEventListener('click', () => {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      state.shuffledIds = null;
      renderTable();
    });

    elements.coverControls.innerHTML = activeColumns()
      .map(column => `<button type="button" class="cover-button" data-column="${column.key}">${escapeHtml(column.label)}</button>`)
      .join('');

    elements.cardDirectionChoices.innerHTML = `
      <label class="choice-card"><input type="radio" name="cardDirection" value="native-en" checked><span>${escapeHtml(config.label)} → English</span></label>
      <label class="choice-card"><input type="radio" name="cardDirection" value="en-native"><span>English → ${escapeHtml(config.label)}</span></label>
    `;

    elements.importTab.hidden = !config.supportsOcr;

    renderDialogFieldGrid();
  }

  function switchLanguage(id) {
    if (!LANGUAGES[id] || id === state.language) return;
    state.language = id;
    localStorage.setItem(LANGUAGE_KEY, id);
    if (id === 'de') ensureGermanGenderDictionary();
    state.collections = loadCollections(languageConfig());
    state.covered.clear();
    state.cellOverrides.clear();
    state.shuffledIds = null;
    state.search = '';
    elements.searchInput.value = '';
    state.view = 'word';
    state.screen = 'list';
    renderStructuralElements();
    resetIdFilterToFullRange();
    saveCollections();
    setCardCategory('word', true);
    render();
  }

  function resetIdFilterToFullRange() {
    state.idFilterCustom = false;
    const items = collection(state.view);
    if (!items.length) {
      elements.idFilterFrom.value = '';
      elements.idFilterTo.value = '';
      return;
    }
    const ids = items.map(item => item.id);
    // Prefilled highest-to-lowest to match the default descending sort.
    elements.idFilterFrom.value = Math.max(...ids);
    elements.idFilterTo.value = Math.min(...ids);
  }

  // Keeps an untouched (non-custom) ID filter tracking the full range as
  // entries are added or removed in the current tab, so a freshly added
  // or imported item doesn't silently fall outside the visible range.
  function syncIdFilterIfNotCustom() {
    if (!state.idFilterCustom) resetIdFilterToFullRange();
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
    elements.coverControls.querySelectorAll('.cover-button').forEach(button => button.classList.toggle('is-covered', state.covered.has(button.dataset.column)));
  }

  // The From/To fields only ever reflect the currently active tab's range
  // (they're reset on every tab switch), so the filter they express only
  // applies to that tab's type -- the other type's export stays unfiltered.
  function filteredItemsForType(type) {
    let items = [...collection(type)];
    if (type === state.view) {
      if (state.search) {
        items = items.filter(item => {
          const haystack = [item.id, ...activeFields().map(field => item[field.key])].join(' ').toLocaleLowerCase();
          return haystack.includes(state.search);
        });
      }
      const fromValue = elements.idFilterFrom.value;
      const toValue = elements.idFilterTo.value;
      if (fromValue !== '' && toValue !== '') {
        const lo = Math.min(Number(fromValue), Number(toValue));
        const hi = Math.max(Number(fromValue), Number(toValue));
        items = items.filter(item => item.id >= lo && item.id <= hi);
      }
    }
    return items.sort((a, b) => a.id - b.id);
  }

  function filteredItems() {
    const items = filteredItemsForType(state.view);
    if (state.shuffledIds) {
      const order = new Map(state.shuffledIds.map((id, index) => [id, index]));
      return [...items].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    return state.sortDirection === 'asc' ? items : [...items].reverse();
  }

  function renderSortIndicator() {
    const shuffled = Boolean(state.shuffledIds);
    elements.idSortIndicator.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    elements.idSortButton.title = shuffled
      ? 'Shuffled — click to sort by ID'
      : `Sorted by ID, ${state.sortDirection === 'asc' ? 'ascending' : 'descending'}. Click to reverse.`;
    elements.idSortButton.setAttribute('aria-sort', shuffled ? 'none' : state.sortDirection === 'asc' ? 'ascending' : 'descending');
  }

  function renderTable() {
    renderSortIndicator();
    const items = filteredItems();
    const categoryTotal = collection(state.view).length;
    elements.resultSummary.textContent = state.search
      ? `${items.length} of ${categoryTotal} entries`
      : `${items.length} ${items.length === 1 ? 'entry' : 'entries'} · ${state.view === 'word' ? 'Word' : 'Sentence'} IDs 1–${categoryTotal ? Math.max(...collection(state.view).map(item => item.id)) : 0}`;
    elements.emptyState.hidden = items.length > 0;

    elements.tbody.innerHTML = items.map(item => `
      <tr>
        <td class="entry-id">${item.id}</td>
        ${activeColumns().map(column => cellTemplate(item, column)).join('')}
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
    const key = `${compositeKey(item.type, item.id)}:${column.key}`;
    // XOR: a column's own default (state.covered) is flipped whenever this
    // specific cell has been individually clicked (state.cellOverrides).
    const covered = state.covered.has(column.key) !== state.cellOverrides.has(key);
    const fieldDefs = column.fields.map(fieldKey => activeFields().find(field => field.key === fieldKey));
    const isNative = fieldDefs.some(field => field.role === 'native' || field.role === 'native-alt');
    const badge = isNative && !covered ? articleBadge(item) : '';
    const text = fieldDefs.map(field => escapeHtml(item[field.key] || '—')).join(' · ');
    return `<td data-column="${column.key}"${isNative ? ' data-script="native"' : ''}><div class="study-cell${covered ? ' covered' : ''}" data-reveal-key="${key}">${badge}${text}</div></td>`;
  }

  // Nice-to-have autofill for nouns typed without their article (e.g. "Tisch"
  // instead of "der Tisch"), backed by a bundled lemma -> der/die/das lookup.
  // Fails quietly like the English dictionary/tokenizer: if the lookup isn't
  // loaded yet or doesn't recognize the word, the article is simply left blank
  // for the user to fill in by hand.
  function ensureGermanGenderDictionary() {
    if (!germanGenderDictionaryPromise) {
      germanGenderDictionaryPromise = prepareGermanGenderDictionary()
        .then(dictionary => { germanGenderDictionaryCache = dictionary; return dictionary; })
        .catch(error => {
          console.warn('German gender dictionary unavailable, article badges will be left blank:', error);
          return null;
        });
    }
    return germanGenderDictionaryPromise;
  }

  async function prepareGermanGenderDictionary() {
    const response = await fetch('./api/german-gender-status', {cache: 'no-store'});
    const status = await response.json().catch(() => ({}));
    if (!response.ok || !status.ready) throw new Error(status.message || 'German gender dictionary is not available.');

    const dictResponse = await fetch('./vendor/dict/german-gender-lookup.json.gz', {cache: 'no-store'});
    if (!dictResponse.ok) throw new Error(`Could not load the German gender dictionary (HTTP ${dictResponse.status}).`);
    return dictResponse.json();
  }

  function deriveGermanArticle(text) {
    const value = String(text || '').trim();
    const leadMatch = value.match(/^(der|die|das)\b/i);
    if (leadMatch) return leadMatch[1].toLowerCase();
    if (!value) return '';

    const candidate = value.split('/')[0].trim().split(/\s+/)[0];
    if (candidate && /^[A-ZÄÖÜ]/.test(candidate) && germanGenderDictionaryCache?.[candidate]) {
      return germanGenderDictionaryCache[candidate];
    }
    return value.includes('/') ? 'plural' : '';
  }

  function articleBadge(item) {
    if (!item.article) return '';
    return `<span class="badge badge-${item.article}">${escapeHtml(item.article)}</span>`;
  }

  function primaryDisplayField() {
    const fields = activeFields().filter(field => field.role !== 'gloss');
    return fields.find(field => field.role === 'native') || fields.find(field => field.role === 'native-alt') || fields[0] || null;
  }

  function openDialog(item = null) {
    elements.form.reset();
    const type = item?.type || state.view;
    elements.entryId.value = item?.id || '';
    elements.entryOriginalType.value = item?.type || '';
    elements.form.querySelector(`input[name="entryType"][value="${type}"]`).checked = true;
    renderDialogFieldGrid(item || {});
    elements.dialogTitle.textContent = item ? 'Edit entry' : 'Add entry';
    elements.dialogEyebrow.dataset.mode = item ? 'edit' : 'new';
    updateDialogIdPreview();
    elements.dialog.showModal();
    setTimeout(() => elements.dialogFieldGrid.querySelector('input')?.focus(), 0);
  }

  function renderDialogFieldGrid(values = {}) {
    elements.dialogFieldGrid.innerHTML = activeFields().map(field => {
      const attrs = `data-field="${field.key}"${field.required ? ' required' : ''} maxlength="240"`;
      return `<label>${escapeHtml(field.label)}<input ${attrs} value="${escapeHtml(values[field.key] || '')}"></label>`;
    }).join('');
  }

  function readDialogFields() {
    const data = {};
    elements.dialogFieldGrid.querySelectorAll('[data-field]').forEach(input => {
      data[input.dataset.field] = input.value.trim();
    });
    applyDerivedFields(data);
    return data;
  }

  function applyDerivedFields(data) {
    if (state.language === 'de' && 'german' in data) {
      data.article = deriveGermanArticle(data.german);
    }
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
    const itemData = {type, ...readDialogFields()};

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
    syncIdFilterIfNotCustom();
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
    syncIdFilterIfNotCustom();
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
        if (!languageConfig().supportsMarkdownImport) {
          throw new Error(`Markdown import isn't set up for ${languageConfig().label} yet.`);
        }
        entries = parseMarkdown(text);
      }

      if (!entries.length) throw new Error('No valid entries were found.');
      const summary = mergeImportedEntries(entries, `file:${file.name}`);
      saveCollections();
      syncIdFilterIfNotCustom();
      render();
      showToast(`${summary.added} imported · ${summary.duplicates} duplicates skipped`);
    } catch (error) {
      alert(`Could not import the file.\n\n${error.message}`);
    }
  }

  function mergeImportedEntries(entries, sourceLabel = '') {
    const config = languageConfig();
    let added = 0;
    let duplicates = 0;
    let invalid = 0;
    const counters = {word: nextId('word'), sentence: nextId('sentence')};

    for (const raw of entries) {
      const type = raw.type === 'sentence' ? 'sentence' : 'word';
      const candidate = {type};
      for (const field of config.fields) {
        candidate[field.key] = String(raw[field.key] || '').trim();
      }
      if (raw.source) candidate.source = raw.source;
      else if (sourceLabel) candidate.source = {kind: sourceLabel, importedAt: new Date().toISOString()};
      applyDerivedFields(candidate);

      // Sentences need an English translation to be useful as a flashcard prompt,
      // but words are still worth saving without one — the tokenizer that finds
      // them has no English glosses, and the field stays editable after import.
      const hasIdentity = config.identityFields.some(key => candidate[key]);
      const missingRequiredField = type === 'sentence'
        ? !candidate.english || !hasIdentity
        : !hasIdentity;
      if (missingRequiredField) {
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
    const items = filteredItemsForType(type);
    downloadFile(`${label}.json`, JSON.stringify(items, null, 2), 'application/json');
    const filtered = items.length !== collection(type).length;
    showToast(`${items.length} ${label} exported${filtered ? ' (filtered)' : ''}`);
  }

  function exportMarkdown() {
    const config = languageConfig();
    const sections = [
      ['Words', filteredItemsForType('word')],
      ['Sentences', filteredItemsForType('sentence')],
    ].map(([heading, items]) => {
      const lines = items.map(item => activeFields().map(field => item[field.key] || '').join(' . '));
      return `## ${heading}\n\n${lines.join('\n')}`;
    });
    downloadFile(`${config.storagePrefix}-list.md`, sections.join('\n\n###\n\n'), 'text/markdown');
    showToast('Markdown exported');
  }

  function resetData() {
    if (!confirm('Reset all edits and restore the original words and sentences?')) return;
    state.collections = seedCollections(languageConfig());
    state.shuffledIds = null;
    state.search = '';
    elements.searchInput.value = '';
    state.view = 'word';
    resetIdFilterToFullRange();
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
    elements.cardSideLabel.textContent = state.card.revealed ? 'Answer revealed' : (direction === 'native-en' ? `${languageConfig().label} → English` : `English → ${languageConfig().label}`);
    elements.cardContent.innerHTML = cardContentTemplate(item, direction, state.card.revealed);
    elements.answerActions.hidden = !state.card.revealed;
    elements.cardRevealHint.textContent = state.card.revealed ? 'Choose how well you knew it' : 'Click the card to reveal';
    elements.studyCard.setAttribute('aria-label', state.card.revealed ? 'Answer revealed' : 'Reveal answer');
  }

  function cardContentTemplate(item, direction, revealed) {
    if (direction === 'native-en') {
      const native = primaryFieldsTemplate(item);
      if (!revealed) return native;
      return `${native}<div class="card-answer-label">English</div><div class="card-secondary">${escapeHtml(item.english)}</div>`;
    }

    const english = `<div class="card-primary english-front">${escapeHtml(item.english)}</div>`;
    if (!revealed) return english;
    return `${english}<div class="card-answer-label">${escapeHtml(languageConfig().label)}</div>${primaryFieldsTemplate(item)}`;
  }

  function primaryFieldsTemplate(item) {
    const fields = activeFields().filter(field => field.role !== 'gloss');
    const byRole = role => fields.find(field => field.role === role);
    const primaryField = primaryDisplayField();
    if (!primaryField) return '<div class="card-primary">—</div>';
    const primaryValue = item[primaryField.key] || '—';
    const badge = articleBadge(item);
    const restFields = [byRole('native-alt'), byRole('secondary')].filter(field => field && field !== primaryField);
    const lines = restFields
      .map((field, index) => {
        const value = item[field.key];
        if (!value || value === primaryValue) return '';
        return `<div class="${index === 0 ? 'card-secondary' : 'card-tertiary'}">${escapeHtml(value)}</div>`;
      })
      .join('');
    return `<div class="card-primary">${badge}${escapeHtml(primaryValue)}</div>${lines}`;
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
    const fields = activeFields().filter(field => field.role !== 'gloss');
    const primaryField = primaryDisplayField();
    elements.reviewList.innerHTML = unknown.length
      ? unknown.map(item => {
          const primaryValue = primaryField ? item[primaryField.key] : '';
          const restText = fields
            .filter(field => field !== primaryField)
            .map(field => item[field.key])
            .filter(Boolean)
            .join(' · ');
          return `
          <div class="review-item">
            <span class="review-id">${item.type === 'word' ? 'W' : 'S'}#${item.id}</span>
            <span>${escapeHtml(item.english)}</span>
            <span class="review-japanese">${escapeHtml(primaryValue)}${restText ? `<small>${escapeHtml(restText)}</small>` : ''}</span>
          </div>
        `;
        }).join('')
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

    ensureTokenizerAnalyzer();
    ensureEnglishDictionary();

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

  // Filling in kana/romaji/word readings is a nice-to-have on top of OCR, not a
  // requirement, so every step here is designed to fail quietly (leaving fields
  // blank as before) rather than ever interrupt a scan.
  let tokenizerAnalyzerPromise = null;

  function ensureTokenizerAnalyzer() {
    if (!tokenizerAnalyzerPromise) {
      tokenizerAnalyzerPromise = prepareTokenizerAnalyzer().catch(error => {
        console.warn('Japanese tokenizer unavailable, word readings will be left blank:', error);
        return null;
      });
    }
    return tokenizerAnalyzerPromise;
  }

  async function prepareTokenizerAnalyzer() {
    const status = await getLocalTokenizerStatus();
    if (!status.ready) throw new Error(status.message);

    const assetRoot = new URL(`${OCR_ASSET_ROOT}/`, window.location.href).href.replace(/\/$/, '');
    await loadTokenizerScript(`${assetRoot}/tokenizer.min.js`);
    if (!window.KuromojiAnalyzer) throw new Error('The local tokenizer library could not be loaded.');

    // kuromoji's bundled path.join mangles the "//" in an absolute http:// URL
    // (collapsing it to "http:/host/...", which the browser then re-resolves
    // relative to the page origin), so it needs a root-relative path here
    // instead of the full assetRoot URL used for the other libraries.
    const analyzer = new window.KuromojiAnalyzer({dictPath: '/vendor/tokenizer-dict/'});
    await analyzer.init();
    return analyzer;
  }

  async function getLocalTokenizerStatus() {
    try {
      const response = await fetch('./api/tokenizer-status', {cache: 'no-store'});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {ready: false, message: payload.message || `Tokenizer server check failed with HTTP ${response.status}.`};
      }
      return payload;
    } catch (error) {
      return {ready: false, message: 'The local Node server is not providing the tokenizer package.'};
    }
  }

  function loadTokenizerScript(source) {
    if (window.KuromojiAnalyzer) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load tokenizer script: ${source}`));
      document.head.appendChild(script);
    });
  }

  // Filling in English glosses is a nice-to-have on top of word suggestions,
  // not a requirement, so it's designed to fail quietly like the tokenizer.
  let englishDictionaryPromise = null;

  function ensureEnglishDictionary() {
    if (!englishDictionaryPromise) {
      englishDictionaryPromise = prepareEnglishDictionary().catch(error => {
        console.warn('English dictionary unavailable, English fields will be left blank:', error);
        return null;
      });
    }
    return englishDictionaryPromise;
  }

  async function prepareEnglishDictionary() {
    const response = await fetch('./api/dictionary-status', {cache: 'no-store'});
    const status = await response.json().catch(() => ({}));
    if (!response.ok || !status.ready) throw new Error(status.message || 'English dictionary is not available.');

    const dictResponse = await fetch('./vendor/dict/jmdict-lookup.json.gz', {cache: 'no-store'});
    if (!dictResponse.ok) throw new Error(`Could not load the English dictionary (HTTP ${dictResponse.status}).`);
    return dictResponse.json();
  }

  function lookupEnglish(dictionary, kanji, kana) {
    if (!dictionary) return '';
    return dictionary[kanji] || dictionary[kana] || '';
  }

  function katakanaToHiragana(text) {
    return text.replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  }

  async function readingFor(analyzer, text) {
    if (!text) return '';
    try {
      const tokens = await analyzer.parse(text);
      return katakanaToHiragana(tokens.map(token => token.reading || token.surface_form).join(''));
    } catch (error) {
      console.warn('Tokenizer reading failed:', error);
      return '';
    }
  }

  const TOKENIZER_WORD_POS = new Set(['名詞', '動詞', '形容詞', '副詞']);

  async function enrichWithTokenizer(result) {
    const analyzer = await ensureTokenizerAnalyzer();
    if (!analyzer) return;
    const dictionary = await ensureEnglishDictionary();

    let sentenceTokens = [];
    if (result.sentence.kanji) {
      try {
        sentenceTokens = await analyzer.parse(result.sentence.kanji);
      } catch (error) {
        console.warn('Tokenizer parse failed:', error);
      }
    }

    if (sentenceTokens.length && !result.sentence.kana) {
      const kana = katakanaToHiragana(sentenceTokens.map(token => token.reading || token.surface_form).join(''));
      if (kana) {
        result.sentence.kana = kana;
        result.sentence.romaji = kanaToRomaji(kana);
      }
    }

    for (const word of result.words) {
      if (word.kanji && !word.kana) {
        const kana = await readingFor(analyzer, word.kanji);
        if (kana) {
          word.kana = kana;
          word.romaji = kanaToRomaji(kana);
        }
      }
      if (!word.english) word.english = lookupEnglish(dictionary, word.kanji, word.kana);
    }

    if (!sentenceTokens.length) return;
    const usedJapanese = new Set(result.words.map(word => normalizeDuplicateText(word.kanji || word.kana)));
    usedJapanese.add(normalizeDuplicateText(result.sentence.kanji));

    for (const token of sentenceTokens) {
      if (result.words.length >= 6) break;
      if (!TOKENIZER_WORD_POS.has(token.pos)) continue;
      const kanji = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form;
      if (!kanji || (kanji.length <= 1 && !containsKanji(kanji))) continue;
      const key = normalizeDuplicateText(kanji);
      if (!key || usedJapanese.has(key)) continue;
      usedJapanese.add(key);
      const kana = katakanaToHiragana(token.reading || '');
      result.words.push({
        id: makeDraftId('word'),
        selected: false,
        english: lookupEnglish(dictionary, kanji, kana),
        romaji: kana ? kanaToRomaji(kana) : '',
        kanji,
        kana,
      });
    }
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
    // A "NEW WORD" badge overlaid on a sentence exercise adds a short standalone
    // vocab-word line above the sentence; without this it gets merged into the
    // sentence itself (highest-Japanese-character-count wins the scoring in
    // extractJapanese). Only the hybrid case (badge + real sentence exercise)
    // needs it dropped — a genuine standalone "New word" flashcard wants it kept.
    const isHybridNewWord = hasNewWordBadge(`${regions.header}\n${mainText}`) && exerciseType !== 'New word';

    const upperJapanese = extractJapanese(regions.upper, {dropLeadingBadge: isHybridNewWord});
    const lowerJapanese = extractJapanese(regions.lower, {dropLeadingBadge: isHybridNewWord});
    const broadJapanese = extractJapanese(regions.content || mainText, {dropLeadingBadge: isHybridNewWord});
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
      english = pickBestEnglish(feedbackEnglish, upperEnglish, lowerEnglish, selectedEnglish);
    } else if (isTranslate) {
      // The "upper" region is cropped starting at 30% from the left to skip the
      // character illustration. Word-bank answer tiles can start at the very left
      // edge, so trusting "upper" alone drops tiles outside that crop. Blend in the
      // full-width regions and let bestJapaneseCandidate pick the most complete one.
      japanese = bestJapaneseCandidate(selectedJapanese, broadJapanese, upperJapanese, lowerJapanese);
      // English tiles are reconstructed by joining separately-recognized OCR blocks,
      // whose relative order Tesseract doesn't guarantee — so on a scoring tie, prefer
      // a naturally single-line candidate (upper/lower) over the reconstructed join.
      english = pickBestEnglish(feedbackEnglish, upperEnglish, lowerEnglish, selectedEnglish);
    } else if (isComplete || isFillBlank) {
      japanese = bestJapaneseCandidate(upperJapanese, lowerJapanese, broadJapanese);
      english = pickBestEnglish(feedbackEnglish, upperEnglish, lowerEnglish, selectedEnglish);
    } else {
      japanese = bestJapaneseCandidate(upperJapanese, lowerJapanese, selectedJapanese, broadJapanese);
      english = pickBestEnglish(feedbackEnglish, upperEnglish, lowerEnglish, selectedEnglish);
    }

    english = normalizeEnglishOcr(english);
    // Screenshots from a different Duolingo course (e.g. German) can end up in the
    // same folder. German is the main case seen in practice. Tesseract frequently
    // drops umlaut/eszett diacritics (e.g. "über" -> "uber", "Fußball" -> "FuBball"),
    // so umlaut characters alone are an unreliable signal — pair it with common German
    // stopwords, which aren't English words and survive OCR fine. A screenshot with
    // multiple German stopwords essentially can't be a genuine Japanese exercise, so
    // only a generous cap guards against stray Japanese-looking OCR noise here.
    const germanStopwordMatches = mainText.match(/\b(ist|nicht|und|der|die|das|dich|dir|mein|meine|meinen|dein|deine|kennst|warum|wieso|von|als|wahr)\b/gi) || [];
    const germanMarkerCount = (mainText.match(/[äöüßÄÖÜ]/g) || []).length + germanStopwordMatches.length;
    const isOtherLanguageCourse = germanMarkerCount >= 2 && japaneseCharacterCount(japanese) <= 5;
    if (isOtherLanguageCourse) {
      japanese = '';
      english = '';
    }
    // If not a single Japanese character showed up anywhere in the screenshot, this
    // likely isn't a Japanese-course exercise at all — don't leave unrelated OCR text
    // sitting in the English field.
    const hasAnyJapanese = !isOtherLanguageCourse && japaneseCharacterCount(`${mainText}\n${selectedText}`) > 0;
    if (!japanese && !hasAnyJapanese) english = '';
    const kana = japanese && !containsKanji(japanese) ? japanese : '';
    const romaji = kana ? kanaToRomaji(kana) : '';
    const words = suggestWords(japanese, english, `${mainText}\n${selectedText}`, exerciseType, selectedJapanese);
    const warnings = [];
    if (!japanese) warnings.push(hasAnyJapanese ? 'Japanese was not detected' : 'No Japanese detected — this may not be a Japanese exercise screenshot');
    if (!english) warnings.push('English meaning was not detected');
    if (containsKanji(japanese)) warnings.push('Check kana and romaji');
    if (isFillBlank) warnings.push(selectedJapanese ? `Insert/check selected answer: ${selectedJapanese}` : 'Check the missing word');

    const result = {
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
    await enrichWithTokenizer(result);
    return result;
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
    // "NEW WORD" can appear as a small badge overlaid on top of a Translate/Complete/
    // Fill-in exercise when it's introducing new vocabulary mid-sentence, not just on
    // its own dedicated flashcard screen. Check the sentence-exercise phrases first so
    // a badge doesn't misclassify (and garble) an otherwise-normal sentence exercise.
    if (/fill\s+in\s+the\s+blank/i.test(text)) return 'Fill in the blank';
    if (/complete\s+the\s+sentence/i.test(text)) return 'Complete the sentence';
    if (/translate\s+this\s+sentence/i.test(text)) return 'Translate the sentence';
    if (/new\s*word/i.test(text)) return 'New word';
    return 'Sentence screenshot';
  }

  function hasNewWordBadge(text) {
    return /new\s*word/i.test(text);
  }

  function extractJapanese(text, options = {}) {
    let lines = cleanOcrLines(text)
      .map(line => line.replace(/[|｜¦]/g, ''))
      // A play/audio icon before the sentence is consistently misread as a lone
      // ")" (or "q)"), often glued onto the same OCR line as the sentence text
      // itself, which otherwise survives into the middle of the extracted string.
      .map(line => line.replace(/^[a-zA-Z]?\s*[)\]]+\s*/, ''))
      .filter(line => hasJapanese(line));
    if (options.dropLeadingBadge && lines.length > 1) {
      const firstJapaneseChars = lines[0].replace(/[^ぁ-んァ-ヶ一-龯々ー]/g, '');
      if (firstJapaneseChars.length > 0 && firstJapaneseChars.length <= 2) {
        lines = lines.slice(1);
      }
    }
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
    // Translate exercises build the English answer from many single-word tapped
    // tiles (one per OCR line). The windowed combos above cap out at 3 lines, so
    // a 6+ word answer never gets reassembled. Add the full join as one more
    // candidate, but only from lines that actually look like a single tile word
    // (a play-icon before the tile row commonly misreads as noise like "q)").
    const tileLines = lines.filter(looksLikeAnswerTile);
    if (tileLines.length > 3) candidates.push(tileLines.join(' '));
    return chooseEnglishCandidate(candidates);
  }

  function looksLikeAnswerTile(line) {
    return /^[A-Za-zÀ-ž]+(?:['-][A-Za-zÀ-ž]+)*[.,!?]?$/.test(String(line || '').trim());
  }

  // Common short real words that are legitimately all-uppercase on their own line
  // (e.g. a standalone "UP" answer tile), so looksLikeGibberishLine doesn't reject them.
  const COMMON_UPPERCASE_WORDS = new Set(['I', 'A', 'ID', 'UP', 'OK', 'TV', 'US', 'NO', 'GO', 'SO', 'HI', 'MY', 'BY', 'OF', 'IN', 'ON', 'AT', 'TO', 'IT', 'IS', 'DO', 'WE', 'AM', 'PM']);

  // Word-bank tile regions sometimes contain OCR noise lines that aren't real
  // English at all (icon/border misreads) but still look like plausible "words"
  // to a length/word-count scorer — e.g. "ase eeeeee |" or "JIL JI". Reject them
  // at the source instead of letting them out-score a genuinely correct sentence.
  function looksLikeGibberishLine(line) {
    if (/[|;]/.test(line)) return true;
    if (/(.)\1{2,}/i.test(line.replace(/\s+/g, ''))) return true;
    const words = line.trim().split(/\s+/);
    return words.length > 0 && words.every(word => {
      const letters = word.replace(/[^A-Za-zÀ-ž]/g, '');
      return letters.length >= 2 && letters.length <= 4 && letters === letters.toUpperCase() && !COMMON_UPPERCASE_WORDS.has(letters.toUpperCase());
    });
  }

  function englishCandidates(text) {
    const rejected = /^(combo|translate this sentence|complete the sentence|fill in the blank|new word|previous mistake|correct|correct meaning|good job|great|amazing|excellent|nicely done|nice|meaning|explain my answer|continue)$/i;
    const uiMessage = /^(correct|good job|great|amazing|excellent|nicely done|nice)(!|\.|:|\s|$)/i;
    // A play/audio icon before the answer row is consistently misread as a lone
    // ")" or "q)". Reject it at the source so it can't taint any candidate,
    // including short 2-3 line combos (not just the full tile-join).
    const iconGlyphNoise = /^[a-z]?\s*[)\]]+$/i;
    return cleanOcrLines(text)
      .map(normalizeEnglishOcr)
      .filter(line => /[A-Za-zÀ-ž]/.test(line))
      .filter(line => !hasJapanese(line))
      .filter(line => !iconGlyphNoise.test(line))
      .filter(line => !looksLikeGibberishLine(line))
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
      .replace(/(^|\s)\|(?=\s|$)/g, '$1I')
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

  // Picking "first non-empty region" is unsafe: a region meant for post-answer
  // feedback banners often instead catches leftover word-bank distractor tiles
  // (e.g. "want", "no pizza subway"), which are non-empty but wrong. Score every
  // region's candidate and take the one that actually looks like a real sentence.
  function pickBestEnglish(...values) {
    const candidates = values.map(value => normalizeEnglishOcr(value || '')).filter(Boolean);
    if (!candidates.length) return '';
    const sentences = candidates.filter(looksLikeEnglishSentence);
    const pool = sentences.length ? sentences : candidates;
    return pool.sort((a, b) => englishLineScore(b) - englishLineScore(a))[0] || '';
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
      // Separate word-bank tiles on the same visual row often get read as one OCR
      // line with icon-glyph noise glued between them (e.g. "そのにんき (o | スピーカー").
      // Split on non-Japanese runs first so each real tile becomes its own candidate
      // instead of one garbled blob.
      .flatMap(line => line.split(/[^ぁ-んァ-ヶ一-龯々ー]+/))
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

  function updateScanDraftFromInput(event) {
    const target = event.target;
    const card = target.closest('[data-scan-id]');
    if (!card || !target.dataset.section || !target.dataset.field) return;
    const result = state.screenshots.results.find(item => item.id === card.dataset.scanId);
    if (!result) return;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    result.sentence[target.dataset.field] = value;
  }

  function updateNewWordDraftFromInput(event) {
    const target = event.target;
    if (!target.dataset.field) return;
    const row = target.closest('[data-scan-id]');
    if (!row) return;
    const result = state.screenshots.results.find(item => item.id === row.dataset.scanId);
    const word = result?.words.find(item => item.id === row.dataset.wordId);
    if (!word) return;
    word[target.dataset.field] = target.type === 'checkbox' ? target.checked : target.value;
  }

  function handleNewWordsClick(event) {
    const button = event.target.closest('[data-scan-action="remove-word"]');
    if (!button) return;
    const row = button.closest('[data-scan-id]');
    const result = state.screenshots.results.find(item => item.id === row?.dataset.scanId);
    if (!result) return;
    result.words = result.words.filter(word => word.id !== row.dataset.wordId);
    renderScanReviews();
  }

  function importSelectedSentences() {
    const entries = [];
    for (const result of state.screenshots.results) {
      if (result.sentence.selected) {
        entries.push({...result.sentence, type: 'sentence', source: screenshotSource(result)});
      }
    }

    if (!entries.length) {
      alert('Select at least one sentence to import.');
      return;
    }

    const summary = mergeImportedEntries(entries);
    saveCollections();
    renderCounts();
    setCardCategory(elements.cardSetupForm.elements.cardType.value, false);
    showToast(`${summary.added} added · ${summary.duplicates} duplicates · ${summary.invalid} incomplete`);

    for (const result of state.screenshots.results) {
      result.sentence.selected = false;
    }
    renderScanReviews();
  }

  function importSelectedWords() {
    const entries = [];
    for (const result of state.screenshots.results) {
      for (const word of result.words) {
        if (word.selected) entries.push({...word, type: 'word', source: screenshotSource(result)});
      }
    }

    if (!entries.length) {
      alert('Select at least one word to import.');
      return;
    }

    const summary = mergeImportedEntries(entries);
    saveCollections();
    renderCounts();
    setCardCategory(elements.cardSetupForm.elements.cardType.value, false);
    showToast(`${summary.added} added · ${summary.duplicates} duplicates · ${summary.invalid} incomplete`);

    for (const result of state.screenshots.results) {
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
    const config = languageConfig();
    const english = normalizeDuplicateText(candidate.english);
    return collection(candidate.type).find(item => {
      const identityMatch = config.identityFields.some(key => {
        const value = normalizeDuplicateText(candidate[key]);
        return value && value === normalizeDuplicateText(item[key]);
      });
      if (identityMatch) return true;
      if (!english || english !== normalizeDuplicateText(item.english)) return false;
      return config.identityFields.every(key => normalizeDuplicateText(candidate[key]) === normalizeDuplicateText(item[key]));
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
        candidates.push({resultId: result.id, wordId: word.id, selected: word.selected, kanji, kana, english, source: result.fileName});
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
        <li class="new-word-row" data-scan-id="${candidate.resultId}" data-word-id="${candidate.wordId}">
          <label class="select-entry" title="Import this word"><input type="checkbox" data-field="selected" ${candidate.selected ? 'checked' : ''}></label>
          <input class="new-word-field" data-field="kanji" value="${escapeHtml(candidate.kanji)}" placeholder="Kanji">
          <input class="new-word-field" data-field="kana" value="${escapeHtml(candidate.kana)}" placeholder="Kana">
          <input class="new-word-field" data-field="english" value="${escapeHtml(candidate.english)}" placeholder="English">
          <span class="new-word-source" title="${escapeHtml(candidate.source)}">${escapeHtml(candidate.source)}</span>
          <button class="row-action" type="button" data-scan-action="remove-word" title="Remove suggestion">×</button>
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
})();
