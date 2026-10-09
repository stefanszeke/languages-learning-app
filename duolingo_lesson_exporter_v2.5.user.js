// ==UserScript==
// @name         Duolingo Lesson Scorecard JSON Exporter
// @namespace    local.duolingo.scorecard.exporter
// @version      2.5.0
// @description  Review lesson answers and export German/Japanese JSON with configurable exercise-type rules.
// @match        https://www.duolingo.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const PREFIX = 'dlse-';
  // Stop an earlier hot-reload-capable version before installing this one.
  try { window.DuolingoExporter?.destroy?.(); } catch (err) { console.warn('Exporter cleanup:', err); }
  let destroyed = false;
  let scheduled = false;
  let observer = null;
  let frameId = null;
  const abort = new AbortController();
  // v2.4 had no destroy(). Preserve its toolbar position but discard its
  // existing click handlers by replacing the actual DOM node.
  document.getElementById('dlse-overlay')?.remove();
  const legacyButton = document.getElementById('dlse-launch');
  if (legacyButton) legacyButton.replaceWith(legacyButton.cloneNode(true));
  // Remove CSS injected by v2.4 (which had no stable style id).
  for (const el of document.querySelectorAll('style')) {
    if (el.textContent?.includes('#dlse-launch{') && el.textContent?.includes('#dlse-overlay{')) el.remove();
  }
  const CARD_SELECTOR = '.WXKLe .HPdUG';
  const STORAGE_ID = PREFIX + 'next-id';
  const STORAGE_LANGUAGE = PREFIX + 'language';
  const STORAGE_RULES = PREFIX + 'rules-v24';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normal = value => (value || '').replace(/\s+/g, ' ').trim();
  const isJapanese = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(value || '');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEFAULT_RULES = [
    {pattern:'Write in English', match:'starts', mode:'to-english'},
    {pattern:'Write in German', match:'starts', mode:'to-foreign'},
    {pattern:'Write in Japanese', match:'starts', mode:'to-foreign'},
    {pattern:'How do you say', match:'starts', mode:'quoted'},
    {pattern:'Complete the chat', match:'starts', mode:'review'},
    {pattern:'Fill in the blank', match:'starts', mode:'review'},
    {pattern:'Select the missing word', match:'starts', mode:'skip'},
    {pattern:'Match the pairs', match:'starts', mode:'skip'}
  ];
  const MODES = [
    ['to-english','Translate into English'],
    ['to-foreign','Translate into German/Japanese'],
    ['quoted','English quoted in title → foreign answer'],
    ['review','Needs review'],
    ['skip','Skip']
  ];
  function validRule(r) {
    return r && typeof r.pattern === 'string' && r.pattern.trim() &&
      ['starts','exact','contains'].includes(r.match) && MODES.some(m => m[0] === r.mode);
  }
  function loadRules() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_RULES));
      if (Array.isArray(saved) && saved.every(validRule)) return saved;
    } catch {}
    return DEFAULT_RULES.map(r => ({...r}));
  }
  let rules = loadRules();
  function ruleFor(title) {
    const value = normal(title).toLocaleLowerCase();
    return rules.find(rule => {
      const p = normal(rule.pattern).toLocaleLowerCase();
      return rule.match === 'exact' ? value === p : rule.match === 'contains' ? value.includes(p) : value.startsWith(p);
    });
  }
  function saveRules() { localStorage.setItem(STORAGE_RULES, JSON.stringify(rules)); }
  const states = { language: localStorage.getItem(STORAGE_LANGUAGE) || 'de', startId: Number(localStorage.getItem(STORAGE_ID)) || 278, entries: [], extracting: false };

  const style = document.createElement('style');
  style.id = 'dlse-style';
  style.textContent = `
    #${PREFIX}launch{display:block;position:relative;z-index:2147483000;grid-column:1 / -1;justify-self:end;align-self:start;margin:10px 12px 16px auto;background:#58cc02;color:#122000;border:0;border-radius:12px;padding:13px 20px;font:bold 14px system-ui;box-shadow:0 4px 0 #438f09;cursor:pointer}
    #${PREFIX}overlay{position:fixed;inset:0;z-index:2147483001;background:#000c;display:flex;justify-content:center;align-items:center;padding:20px;font:14px system-ui;color:#e6eef2}
    #${PREFIX}dialog{background:#172932;border:1px solid #526976;border-radius:16px;width:min(1050px,98vw);max-height:94vh;overflow:auto;padding:22px;box-sizing:border-box}
    #${PREFIX}dialog *{box-sizing:border-box}
    #${PREFIX}dialog h2{font-size:22px;margin:0}
    #${PREFIX}dialog button{cursor:pointer;background:#304956;color:white;border:1px solid #5c7580;border-radius:8px;padding:9px 12px;font:600 13px system-ui}
    #${PREFIX}dialog button:hover{background:#40616c}
    #${PREFIX}dialog button:disabled{opacity:.5;cursor:wait}
    #${PREFIX}dialog input,#${PREFIX}dialog select,#${PREFIX}dialog textarea{color:#ecf3f5;background:#0c1b23;border:1px solid #5b7581;border-radius:7px;padding:8px;font:13px system-ui;min-width:0}
    #${PREFIX}dialog textarea{width:100%;resize:vertical;font:12px/1.5 ui-monospace,monospace}
    #${PREFIX}dialog .${PREFIX}row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}
    #${PREFIX}dialog .${PREFIX}row label{display:flex;align-items:center;gap:8px}
    #${PREFIX}dialog .${PREFIX}entry{border:1px solid #45606b;padding:12px;border-radius:10px;margin:9px 0;background:#1e3540}
    #${PREFIX}dialog .${PREFIX}fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    #${PREFIX}dialog .${PREFIX}field{display:flex;flex-direction:column;gap:4px}
    #${PREFIX}dialog .${PREFIX}field input{width:100%}
    #${PREFIX}dialog .${PREFIX}source{color:#a9c6d2;white-space:pre-wrap;margin:7px 0;font-size:12px}
    #${PREFIX}dialog .${PREFIX}status{font-size:12px;color:#ffcd75;font-weight:bold}
    #${PREFIX}dialog .${PREFIX}complete{color:#a9ef92}
    #${PREFIX}dialog .${PREFIX}duplicate{color:#deb7fa}
    #${PREFIX}dialog .${PREFIX}muted{font-size:12px;color:#abc0c9}
    #${PREFIX}dialog .${PREFIX}head{display:flex;align-items:center;justify-content:space-between;gap:10px}
    #${PREFIX}dialog .${PREFIX}empty{padding:20px;color:#b8ced7}
    #${PREFIX}dialog .${PREFIX}skipped{color:#aab8c0}
    #${PREFIX}dialog .${PREFIX}rules{border:1px solid #49636f;padding:12px;border-radius:10px;margin:15px 0;background:#10212a}
    #${PREFIX}dialog .${PREFIX}rule{display:grid;grid-template-columns:minmax(110px,1fr) 94px minmax(160px,1.3fr) auto;gap:8px;margin:7px 0;align-items:center}
    #${PREFIX}dialog .${PREFIX}rule input,#${PREFIX}dialog .${PREFIX}rule select{width:100%}
    #${PREFIX}dialog .${PREFIX}rules[hidden]{display:none}
    @media(max-width:760px){#${PREFIX}dialog .${PREFIX}rule{grid-template-columns:1fr 1fr}.${PREFIX}rule input{grid-column:1 / -1}}
    @media(max-width:650px){#${PREFIX}dialog .${PREFIX}fields{grid-template-columns:1fr}}
  `;
  document.head.append(style);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function visibleResponse() {
    const found = {};
    for (const label of $$('._2iYax')) {
      const key = normal(label.textContent).toLowerCase();
      if (key !== 'your response:' && key !== 'correct response:') continue;
      const answer = label.parentElement?.querySelector('._19Lhw');
      if (!answer || !answer.getClientRects().length) continue;
      found[key === 'your response:' ? 'your' : 'correct'] = normal(answer.innerText);
    }
    return found;
  }
  async function waitForResponse(timeoutMs = 1600) {
    for (let elapsed = 0; elapsed < timeoutMs; elapsed += 80) {
      if (destroyed) throw Error('Exporter was reloaded during extraction');
      const value = visibleResponse();
      if (value.correct || value.your) return value;
      await delay(80);
    }
    return {};
  }
  async function closeCurrent(cards) {
    if (!visibleResponse().correct && !visibleResponse().your) return;
    const openCard = cards.find(c => c.getAttribute('aria-expanded') === 'true' || c.classList.contains('_3VIox'));
    // If the page already has a tile opened, try to close it before extracting.
    if (openCard) { openCard.click(); await delay(150); }
  }
  async function readCards(onProgress) {
    const cards = $$(CARD_SELECTOR);
    if (!cards.length) throw Error('No lesson scorecard tiles found. Open the lesson scorecard first.');
    await closeCurrent(cards);
    const output = [];
    for (let i = 0; i < cards.length; i++) {
      if (destroyed) throw Error('Exporter was reloaded during extraction');
      const card = cards[i];
      const exerciseType = normal($('.' + '_22vpX', card)?.innerText);
      const prompt = normal($('.' + '_31ibb', card)?.innerText);
      // Cards display answers outside their HTML when activated. We read only after a fresh open.
      const before = visibleResponse();
      if (before.correct || before.your) {
        const previouslyOpened = cards.find(c => c !== card && (c.getAttribute('aria-expanded') === 'true' || c.classList.contains('_3VIox')));
        if (previouslyOpened) { previouslyOpened.click(); await delay(150); }
      }
      card.click();
      await delay(110);
      const answers = await waitForResponse();
      output.push({exerciseType, prompt, yourResponse: answers.your || '', correctResponse: answers.correct || ''});
      onProgress(i + 1, cards.length);
      card.click();
      await delay(130);
    }
    return output;
  }
  function newEntry(raw) {
    const rule = ruleFor(raw.exerciseType);
    const mode = rule?.mode || 'review';
    const target = states.language === 'de' ? 'german' : 'kanji';
    let english = '', foreign = '';
    if (mode === 'to-english') { foreign = raw.prompt; english = raw.correctResponse; }
    else if (mode === 'to-foreign') { english = raw.prompt; foreign = raw.correctResponse; }
    else if (mode === 'quoted') {
      const phrase = raw.exerciseType.match(/[“"'‘]([^”"'’]+)[”"'’]/);
      if (phrase) { english = normal(phrase[1]); foreign = raw.correctResponse; }
    } else if (mode === 'review' && states.language === 'ja' &&
               isJapanese(raw.prompt) && !/_{2,}/.test(raw.prompt)) {
      foreign = raw.prompt;
    }
    return { english, [target]:foreign,
      ...(states.language === 'ja' ? {romaji:'',kana:''} : {}), _raw:raw };
  }
  function isSkipped(entry) { return (ruleFor(entry._raw.exerciseType)?.mode || 'review') === 'skip'; }
  function remapEntries() {
    states.entries = states.entries.map(old => {
      const next = newEntry(old._raw);
      for (const key of fields()) if (normal(old[key])) next[key] = old[key];
      return next;
    });
    render();
  }
  function fields() { return states.language === 'de' ? ['english','german'] : ['english','romaji','kanji','kana']; }
  function complete(entry) { return fields().every(key => normal(entry[key])); }
  function signature(entry) {
    return fields().map(key => normal(entry[key]).normalize('NFKC').toLocaleLowerCase()).join('\u0001');
  }
  function duplicateIndices() {
    const firstSeen = new Set();
    const duplicates = new Set();
    states.entries.forEach((entry,index) => {
      if (isSkipped(entry) || !complete(entry)) return;
      const key = signature(entry);
      if (firstSeen.has(key)) duplicates.add(index);
      else firstSeen.add(key);
    });
    return duplicates;
  }
  function output(includeIncomplete=false) {
    let id = Number(states.startId);
    const duplicates = duplicateIndices();
    return states.entries.filter((e,index) => !isSkipped(e) && !duplicates.has(index) && (includeIncomplete || complete(e))).map(entry => {
      const out = {type:'sentence'};
      for (const key of fields()) out[key] = normal(entry[key]);
      out.id = id++;
      return out;
    });
  }
  function entryStatus(entry,index,duplicates) {
    if (isSkipped(entry)) return 'Skipped';
    if (!complete(entry)) return 'Incomplete';
    return duplicates.has(index) ? 'Duplicate' : 'Complete';
  }
  function updateCounts() {
    const duplicates = duplicateIndices();
    const ready = states.entries.filter((entry,index) => complete(entry) && !isSkipped(entry) && !duplicates.has(index)).length;
    const incomplete = states.entries.filter(entry => !isSkipped(entry) && !complete(entry)).length;
    const skipped = states.entries.filter(isSkipped).length;
    const unknown = [...new Set(states.entries.filter(e => !ruleFor(e._raw.exerciseType)).map(e => e._raw.exerciseType))].length;
    $('#' + PREFIX + 'counts').textContent = `${ready} complete / ${incomplete} incomplete / ${duplicates.size} duplicates / ${skipped} skipped / ${unknown} unknown types`;

  }
  function render() {
    const modal = $('#' + PREFIX + 'overlay');
    if (!modal) return;
    const duplicates = duplicateIndices();
    updateCounts();
    const list = $('#' + PREFIX + 'entries');
    list.innerHTML = '';
    states.entries.forEach((entry, index) => {
      const container = document.createElement('div');
      container.className = PREFIX + 'entry';
      const status = entryStatus(entry,index,duplicates);
      const badgeClass = PREFIX + (status === 'Complete' ? 'complete' : status === 'Duplicate' ? 'duplicate' : status === 'Skipped' ? 'skipped' : 'status');
      const source = entry._raw;
      container.innerHTML = `
        <div class="${PREFIX}head"><strong>Exercise ${index + 1} · ${escapeHTML(source.exerciseType)}</strong><span class="${badgeClass}">${status}</span></div>
        <div class="${PREFIX}source">Rule: ${escapeHTML(ruleFor(source.exerciseType)?.mode || 'Unknown → needs review')} ${ruleFor(source.exerciseType) ? '' : '<strong>(configure in Exercise types)</strong>'}</div>
        <div class="${PREFIX}source">Prompt: ${escapeHTML(source.prompt)}\nCorrect response: ${escapeHTML(source.correctResponse || '(not available)')}</div>
        <div class="${PREFIX}fields">${fields().map(key => `<label class="${PREFIX}field"><span>${escapeHTML(key)}</span><input data-entry="${index}" data-field="${key}" value="${escapeHTML(entry[key])}" /></label>`).join('')}</div>`;
      list.append(container);
    });
    $('#' + PREFIX + 'json').value = JSON.stringify(output(), null, 2);
  }
  function updatePreview() {
    const modal = $('#' + PREFIX + 'overlay');
    if (!modal) return;
    const duplicates = duplicateIndices();
    updateCounts();
    $$('.' + PREFIX + 'entry', modal).forEach((row, index) => {
      const tag = $('.' + PREFIX + 'status', row) || $('.' + PREFIX + 'complete', row) || $('.' + PREFIX + 'duplicate', row);
      if (tag) { const status = entryStatus(states.entries[index],index,duplicates); tag.textContent = status; tag.className = PREFIX + (status === 'Complete' ? 'complete' : status === 'Duplicate' ? 'duplicate' : status === 'Skipped' ? 'skipped' : 'status'); }
    });
    $('#' + PREFIX + 'json').value = JSON.stringify(output(), null, 2);
  }
  async function copyJSON() {
    const value = $('#' + PREFIX + 'json').value;
    if (!value.trim() || value.trim() === '[]') { alert('No completed sentences to copy.'); return; }
    await navigator.clipboard.writeText(value);
    $('#' + PREFIX + 'message').textContent = 'Copied JSON to clipboard.';
  }
  function downloadJSON() {
    const value = $('#' + PREFIX + 'json').value;
    if (!value.trim() || value.trim() === '[]') { alert('No completed sentences to download.'); return; }
    const url = URL.createObjectURL(new Blob([value], {type:'application/json'}));
    const a = document.createElement('a');
    a.href = url; a.download = `duolingo-${states.language}-${states.startId}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function downloadFile(text, filename) {
    const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function renderUnknownTypes() {
    const container = $('#' + PREFIX + 'unknown-types'); if (!container) return;
    const unknown = [...new Set(states.entries.map(e => e._raw.exerciseType).filter(t => !ruleFor(t)))];
    container.replaceChildren();
    if (!unknown.length) return;
    const title = document.createElement('p'); title.textContent = `New exercise types detected (${unknown.length}):`;
    container.append(title);
    unknown.forEach(t => {
      const btn = document.createElement('button'); btn.textContent = `+ Add: ${t}`;
      btn.dataset.unknown = t; btn.style.margin = '4px'; container.append(btn);
    });
  }
  function renderRules() {
    const list = $('#' + PREFIX + 'rule-list'); if (!list) return;
    list.replaceChildren();
    rules.forEach((rule, index) => {
      const row = document.createElement('div'); row.className = PREFIX + 'rule';
      const pattern = document.createElement('input'); pattern.placeholder='Exercise title / prefix';
      pattern.value=rule.pattern; pattern.dataset.rule=index; pattern.dataset.property='pattern';
      const match = document.createElement('select');
      [['starts','Starts with'],['exact','Exact'],['contains','Contains']].forEach(([v,t]) => match.add(new Option(t,v)));
      match.value=rule.match; match.dataset.rule=index; match.dataset.property='match';
      const mode = document.createElement('select');
      MODES.forEach(([v,t]) => mode.add(new Option(t,v)));
      mode.value=rule.mode; mode.dataset.rule=index; mode.dataset.property='mode';
      const del = document.createElement('button'); del.textContent='×'; del.title='Delete rule'; del.dataset.removeRule=index;
      row.append(pattern,match,mode,del); list.append(row);
    });
    renderUnknownTypes();
  }
  function openModal() {
    if (destroyed) return;
    if ($('#' + PREFIX + 'overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = PREFIX + 'overlay';
    overlay.innerHTML = `<section id="${PREFIX}dialog" role="dialog" aria-modal="true" aria-label="Duolingo lesson exporter">
      <div class="${PREFIX}head"><h2>Duolingo Lesson Exporter</h2><button id="${PREFIX}close">Close ×</button></div>
      <div class="${PREFIX}row"><label>Language <select id="${PREFIX}language"><option value="de">German</option><option value="ja">Japanese</option></select></label><label>First ID <input id="${PREFIX}id" type="number" min="1" step="1" style="width:100px" /></label><button id="${PREFIX}extract">Extract scorecard</button></div>
      <div class="${PREFIX}row"><button id="${PREFIX}toggle-rules">Exercise types / rules ▾</button><span class="${PREFIX}muted">New types default to Needs review. Rules are saved in this browser.</span></div>
      <section class="${PREFIX}rules" id="${PREFIX}rules" hidden>
        <div class="${PREFIX}head"><strong>Exercise type rules (first matching rule wins)</strong><button id="${PREFIX}reset-rules">Reset defaults</button></div>
        <p class="${PREFIX}muted">Use Starts with for variable titles. For example, “How do you say” matches “How do you say \"wood\"?”. Unknown titles appear below after extraction.</p>
        <div id="${PREFIX}rule-list"></div>
        <div class="${PREFIX}row"><button id="${PREFIX}add-rule">+ Add rule</button><button id="${PREFIX}export-rules">Download rule settings</button><button id="${PREFIX}import-rules">Import rule settings</button><input type="file" id="${PREFIX}rule-file" accept=".json,application/json" hidden></div>
        <div id="${PREFIX}unknown-types"></div>
      </section>
      <p class="${PREFIX}muted">Fill missing translations yourself. Japanese kana/romaji are not auto-generated. Only complete, non-skipped, unique entries are exported.</p>
      <div id="${PREFIX}message" class="${PREFIX}muted">Ready.</div><strong id="${PREFIX}counts">0 complete / 0 incomplete</strong>
      <div id="${PREFIX}entries" class="${PREFIX}empty">Click Extract scorecard to begin.</div>
      <h3>Editable JSON export (complete, unique entries only)</h3><textarea id="${PREFIX}json" rows="12" spellcheck="false">[]</textarea>
      <div class="${PREFIX}row"><button id="${PREFIX}refresh">Regenerate from entries</button><button id="${PREFIX}copy">Copy JSON</button><button id="${PREFIX}download">Download JSON</button></div>
      <p class="${PREFIX}muted">IDs increment across exported complete entries, not missing entries. You can edit the JSON area before copying or downloading.</p>
    </section>`;
    // Keep the exporter inside the scorecard DOM hierarchy so Duolingo does
    // not interpret a click in the export window as a click outside the scorecard.
    const launch = $('#' + PREFIX + 'launch');
    (launch?.parentElement || document.body).append(overlay);
    // Stop bubbling into scorecard handlers without blocking the controls.
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      overlay.addEventListener(type, e => e.stopPropagation());
    }
    $('#' + PREFIX + 'language').value = states.language;
    $('#' + PREFIX + 'id').value = states.startId;
    $('#' + PREFIX + 'close').onclick = () => { if (!states.extracting) overlay.remove(); };
    overlay.addEventListener('click', event => { if (event.target === overlay && !states.extracting) overlay.remove(); });
    $('#' + PREFIX + 'id').addEventListener('input', e => {
      const id = Number(e.target.value);
      if (Number.isSafeInteger(id) && id > 0) { states.startId = id; localStorage.setItem(STORAGE_ID, String(id)); updatePreview(); }
    });
    $('#' + PREFIX + 'language').addEventListener('change', e => {
      states.language = e.target.value;
      localStorage.setItem(STORAGE_LANGUAGE, states.language);
      // Re-map source answers when changing language.
      states.entries = states.entries.map(entry => newEntry(entry._raw));
      render();
    });
    $('#' + PREFIX + 'entries').addEventListener('input', event => {
      const input = event.target.closest('[data-entry][data-field]');
      if (!input) return;
      states.entries[Number(input.dataset.entry)][input.dataset.field] = input.value;
      updatePreview();
    });
    $('#' + PREFIX + 'extract').onclick = async () => {
      if (states.extracting) return;
      states.extracting = true;
      const button = $('#' + PREFIX + 'extract');
      button.disabled = true;
      try {
        $('#' + PREFIX + 'message').textContent = 'Reading scorecard...';
        const raw = await readCards((done,total) => {
          const message = $('#' + PREFIX + 'message');
          if (message) message.textContent = `Reading ${done}/${total}...`;
        });
        states.entries = raw.map(newEntry);
        render(); renderRules();
        $('#' + PREFIX + 'message').textContent = `Extracted ${raw.length} exercises. Review incomplete entries.`;
      } catch(err) { const msg = $('#' + PREFIX + 'message'); if (msg) msg.textContent = `Extraction error: ${err.message}`; }
      finally { states.extracting = false; if (button.isConnected) button.disabled = false; }
    };
    $('#' + PREFIX + 'refresh').onclick = updatePreview;
    $('#' + PREFIX + 'copy').onclick = () => copyJSON().catch(err => { $('#' + PREFIX + 'message').textContent = `Copy failed: ${err.message}`; });
    $('#' + PREFIX + 'download').onclick = downloadJSON;
    $('#' + PREFIX + 'toggle-rules').onclick = () => {
      const panel = $('#' + PREFIX + 'rules');
      panel.hidden = !panel.hidden;
      renderRules();
    };
    $('#' + PREFIX + 'add-rule').onclick = () => {
      rules.push({pattern:'',match:'starts',mode:'review'});
      renderRules();
    };
    $('#' + PREFIX + 'rule-list').addEventListener('input', e => {
      const el = e.target.closest('[data-rule]'); if (!el) return;
      const idx = Number(el.dataset.rule); const key = el.dataset.property;
      if (!rules[idx] || !['pattern','match','mode'].includes(key)) return;
      rules[idx][key] = el.value;
      // Blank draft rules are kept in the editor, but not saved until valid.
      if (rules.every(validRule)) saveRules();
      remapEntries(); renderUnknownTypes();
    });
    $('#' + PREFIX + 'rule-list').addEventListener('click', e => {
      const button = e.target.closest('[data-remove-rule]'); if (!button) return;
      rules.splice(Number(button.dataset.removeRule), 1);
      saveRules(); renderRules(); remapEntries();
    });
    $('#' + PREFIX + 'reset-rules').onclick = () => {
      if (!confirm('Restore default exercise rules?')) return;
      rules = DEFAULT_RULES.map(r => ({...r})); saveRules(); renderRules(); remapEntries();
    };
    $('#' + PREFIX + 'export-rules').onclick = () => downloadFile(JSON.stringify(rules.filter(validRule),null,2),'duolingo-exporter-rules.json');
    $('#' + PREFIX + 'import-rules').onclick = () => $('#' + PREFIX + 'rule-file').click();
    $('#' + PREFIX + 'rule-file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const incoming = JSON.parse(await f.text());
        if (!Array.isArray(incoming) || incoming.length > 200 || !incoming.every(validRule)) throw Error('Not a valid rule list');
        rules = incoming; saveRules(); renderRules(); remapEntries();
      } catch(err) { $('#' + PREFIX + 'message').textContent = 'Import failed: ' + err.message; }
      e.target.value = '';
    };
    $('#' + PREFIX + 'unknown-types').addEventListener('click', e => {
      const btn = e.target.closest('[data-unknown]'); if (!btn) return;
      const title = btn.dataset.unknown;
      if (!rules.some(r => normal(r.pattern).toLowerCase() === normal(title).toLowerCase())) {
        rules.unshift({pattern:title,match:'exact',mode:'review'});
        saveRules(); renderRules(); remapEntries();
      }
    });
    if (states.entries.length) render();
    renderRules();
  }
  function syncLaunch() {
    const grid = $('.WXKLe');
    const visible = !!grid?.querySelector('.HPdUG');
    let launch = $('#' + PREFIX + 'launch');
    if (destroyed) return;
    if (!visible) { launch?.remove(); return; }
    if (!launch || !launch.dataset.dlseV25) {
      launch?.remove();
      launch = document.createElement('button');
      launch.dataset.dlseV25 = '1';
      launch.id = PREFIX + 'launch';
      launch.type = 'button';
      launch.textContent = 'Export lesson';
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        launch.addEventListener(type, e => e.stopPropagation());
      }
      launch.addEventListener('click', openModal);
    }
    // Put the launcher INSIDE the actual tile grid. Inserting it BEFORE the grid
    // made v2.1 invisible on some Duolingo layouts (clipping/conditional CSS).
    if (launch.parentElement !== grid) grid.prepend(launch);
  }
  syncLaunch();
  observer = new MutationObserver(() => {
    if (destroyed || scheduled) return;
    scheduled = true;
    frameId = requestAnimationFrame(() => {
      scheduled = false;
      frameId = null;
      if (!destroyed) syncLaunch();
    });
  });
  observer.observe(document.body, {childList:true,subtree:true});

  // Available from the Firefox console for subsequent updates:
  // window.DuolingoExporter.destroy();
  // window.DuolingoExporter.open();
  window.DuolingoExporter = {
    version: '2.5.0',
    open: () => { if (!destroyed) openModal(); },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
      abort.abort();
      document.getElementById(PREFIX + 'overlay')?.remove();
      document.getElementById(PREFIX + 'launch')?.remove();
      document.getElementById(PREFIX + 'style')?.remove();
      if (window.DuolingoExporter?.version === '2.5.0') delete window.DuolingoExporter;
    }
  };
})();
