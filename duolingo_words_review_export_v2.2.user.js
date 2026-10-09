// ==UserScript==
// @name         Duolingo Words - Hide Reveal and Range Export
// @namespace    duolingo-vocabulary-review
// @version      2.2.0
// @description  Review words and export a selected range as JSON
// @match        https://www.duolingo.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  // Cleanup allows re-pasting updated code in the console without a page refresh.
  window.DuolingoWordsTools?.destroy?.();

  const IDS = { style:'dlw-style-v2', toolbar:'dlw-toolbar-v2', modal:'dlw-modal-v2' };
  const SEL = { list:'ul._4JTMa', card:'li._2g-qq' };
  const state = { hidden:{source:false,en:true}, observer:null, scheduled:false, busy:false, canceled:false };
  const TRACK_KEY = 'dlw-v22-tracking';
  const tracked = (() => { try { return JSON.parse(localStorage.getItem(TRACK_KEY)) || {}; } catch { return {}; } })();
  function storeTracking() { localStorage.setItem(TRACK_KEY, JSON.stringify(tracked)); }
  function languageTracking(lang) { return tracked[lang] ||= {lastImported:0, identities:[]}; }
  function identity(row) { return JSON.stringify([row.source.normalize('NFKC').toLocaleLowerCase(), row.english.normalize('NFKC').toLocaleLowerCase()]); }
  function totalWords() {
    const list = document.querySelector(SEL.list);
    const section = list?.parentElement;
    const heading = section?.querySelector('h2');
    const match = heading?.textContent?.match(/([\d,.\s]+)\s+words?\b/i);
    return match ? Number(match[1].replace(/[^\d]/g,'')) : null;
  }
  function isRecentSort() {
    const list = document.querySelector(SEL.list);
    const heading = list?.parentElement?.querySelector('._3xxe1');
    return heading ? /recently learned/i.test(heading.textContent) : false;
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clean = text => (text || '').replace(/\s+/g, ' ').trim();
  const allCards = () => [...document.querySelectorAll(`${SEL.list} > ${SEL.card}`)];
  const isWordsPage = () => location.pathname.startsWith('/practice-hub') && !!document.querySelector(SEL.list);

  const css = `
    #${IDS.toolbar}{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 18px}
    #${IDS.toolbar} button, #${IDS.modal} button{background:#263b45;color:#e5f5ff;border:1px solid #435b65;border-radius:9px;padding:9px 12px;font:700 12px Arial,sans-serif;cursor:pointer}
    #${IDS.toolbar} button:hover, #${IDS.modal} button:hover{background:#355563}
    #${IDS.toolbar} button.dlw-primary, #${IDS.modal} button.dlw-primary{background:#58cc02;color:#10210c;border-color:#58cc02}
    ${SEL.list} > ${SEL.card}{position:relative}
    .dlw-word-number{position:absolute;top:10px;right:12px;color:#91aeba;font:700 12px Arial,sans-serif;pointer-events:none;opacity:.85;z-index:1}
    .dlw-word{position:relative;cursor:pointer;border-radius:5px;width:fit-content;min-width:90px}
    .dlw-word.dlw-hidden{color:transparent!important;user-select:none;background:#304751}
    .dlw-word.dlw-hidden::after{content:'Click to reveal';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8faab6;background:#304751;border:1px dashed #55717c;border-radius:5px;font-size:11px;font-weight:500;white-space:nowrap;pointer-events:none}
    .dlw-word.dlw-hidden:hover::after{background:#3d5965;color:#fff}
    #${IDS.modal}{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:16px;color:#e7f2f7;font:14px Arial,sans-serif;box-sizing:border-box}
    #${IDS.modal} .dlw-dialog{width:min(820px,96vw);max-height:92vh;overflow:auto;box-sizing:border-box;background:#14252c;border:1px solid #425864;border-radius:16px;padding:22px}
    #${IDS.modal} .dlw-head,#${IDS.modal} .dlw-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}
    #${IDS.modal} h2{margin:0;font-size:21px;color:#fff}
    #${IDS.modal} label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#aac5d0}
    #${IDS.modal} input,#${IDS.modal} select,#${IDS.modal} textarea{background:#0c1b22;color:#e7f2f7;border:1px solid #56707b;border-radius:8px;padding:9px;box-sizing:border-box;font:14px Arial,sans-serif}
    #${IDS.modal} input[type=number]{width:110px}
    #${IDS.modal} .dlw-controls{display:flex;gap:13px;flex-wrap:wrap;align-items:end;margin:20px 0}
    #${IDS.modal} textarea{width:100%;height:310px;resize:vertical;font:12px/1.55 monospace;white-space:pre}
    #${IDS.modal} .dlw-status{font-size:12px;color:#afd0df;margin:12px 0}
    #${IDS.modal} .dlw-actions{justify-content:flex-start;margin-top:12px}
    #${IDS.modal} button:disabled{opacity:.45;cursor:wait}
    #${IDS.modal} .dlw-note{font-size:12px;color:#a4bdc8;line-height:1.5}
    #${IDS.modal} .dlw-check{display:flex;flex-direction:row;align-items:center;gap:6px}
    #${IDS.modal} .dlw-secondary{background:#21343e;border:1px solid #526b75;border-radius:9px;padding:12px;margin:10px 0}
    #${IDS.modal} .dlw-secondary p{margin:0 0 8px}
    #${IDS.modal} .dlw-secondary input{margin-right:8px}
    #${IDS.modal} .dlw-warning{color:#ffce7d}
  `;
  const style = document.createElement('style');
  style.id = IDS.style;
  style.textContent = css;
  document.head.appendChild(style);

  // Source is Japanese on JP course, German on DE course; don't hardcode it as Japanese.
  function detectLanguage() {
    const card = allCards()[0];
    const value = card?.querySelector('h3')?.textContent || '';
    if (/[\u3040-\u30ff\u3400-\u9fff]/.test(value)) return 'ja';
    return 'de';
  }
  function records() {
    const total = totalWords();
    return allCards().map((card, index) => ({
      index:index + 1,
      number: total === null ? null : total - index,
      source:clean(card.querySelector('h3')?.textContent),
      english:clean(card.querySelector('p')?.textContent)
    })).filter(item => item.source && item.english);
  }
  function decorate() {
    // Re-number EVERY visible card on each update, including after Load more
    // and whenever Duolingo changes the selected sort order.
    const total = totalWords();
    const recent = isRecentSort();
    allCards().forEach((card, index) => {
      let label = card.querySelector(':scope > .dlw-word-number');
      if (!label) {
        label = document.createElement('span');
        label.className = 'dlw-word-number';
        label.setAttribute('aria-label', 'Duolingo word number');
        card.appendChild(label);
      }
      const position = recent && total !== null ? total - index : null;
      const number = position !== null && position > 0 ? `#${position}` : '';
      if (label.textContent !== number) {
        label.textContent = number;
        label.setAttribute('aria-label', position === null ? 'Numbers available in Recently Learned order' : `Duolingo word number ${position}`);
      }
    });
    for (const card of allCards()) {
      for (const [element, lang] of [[card.querySelector('h3'),'source'],[card.querySelector('p'),'en']]) {
        if (!element || element.classList.contains('dlw-word')) continue;
        element.classList.add('dlw-word');
        element.dataset.dlwLang = lang;
        element.classList.toggle('dlw-hidden', state.hidden[lang]);
      }
    }
  }
  function setVisibility(lang, value) {
    state.hidden[lang] = value;
    for (const el of document.querySelectorAll(`.dlw-word[data-dlw-lang="${lang}"]`)) el.classList.toggle('dlw-hidden',value);
  }
  function makeBtn(text, action, primary=false) {
    const btn = document.createElement('button');
    btn.type='button';
    btn.textContent=text;
    if(primary) btn.className='dlw-primary';
    btn.addEventListener('click',action);
    return btn;
  }
  function setup() {
    const toolbar = document.getElementById(IDS.toolbar);
    if(!isWordsPage()){ toolbar?.remove(); return; }
    decorate();
    if(toolbar) return;
    const bar=document.createElement('div');bar.id=IDS.toolbar;
    bar.append(
      makeBtn('Hide words',()=>setVisibility('source',true)),
      makeBtn('Show words',()=>setVisibility('source',false)),
      makeBtn('Hide English',()=>setVisibility('en',true)),
      makeBtn('Show English',()=>setVisibility('en',false)),
      makeBtn('Export words',openExporter,true)
    );
    document.querySelector(SEL.list).before(bar);
  }

  function findLoadMore() {
    const list=document.querySelector(SEL.list);
    if(!list) return null;
    // Duolingo's Load more is at the bottom of this vocabulary list.
    const matches=[...list.querySelectorAll('button,[role="button"],li,div')]
      .filter(el=>/^load more$/i.test(clean(el.textContent)) && el.getClientRects().length);
    // Prefer the most specific element; avoid clicking a container.
    matches.sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length);
    return matches.find(el=>el.matches('button,[role="button"]')) || matches[0] || null;
  }
  async function loadThrough(target, update) {
    const MAX_CLICKS=200;
    let clicks=0;
    while (allCards().length<target && clicks<MAX_CLICKS && !state.canceled) {
      const el=findLoadMore();
      if(!el) break;
      const before=allCards().length;
      el.click();
      clicks++;
      let changed=false;
      for(let n=0;n<30;n++) {
        await wait(150);
        if(state.canceled) break;
        if(allCards().length>before){changed=true;break;}
      }
      update(`Loaded ${allCards().length} word cards${changed?'':' (no further change)'}.`);
      if(!changed) break;
    }
    return allCards().length;
  }
  function openExporter() {
    document.getElementById(IDS.modal)?.remove();
    state.canceled=false;
    const overlay=document.createElement('div');overlay.id=IDS.modal;
    overlay.innerHTML=`
      <section class="dlw-dialog" role="dialog" aria-modal="true" aria-label="Export Duolingo words">
        <div class="dlw-head"><h2>Export Duolingo words</h2><button type="button" data-action="close">✕ Close</button></div>
        <div class="dlw-controls">
          <label>Language<select data-field="language"><option value="ja">Japanese</option><option value="de">German</option></select></label>
          <label>From word #<input data-field="from" type="number" min="1"></label>
          <label>To word #<input data-field="to" type="number" min="1"></label>
          <label>First app ID (optional)<input data-field="id" type="number" min="1" placeholder="Leave blank"></label>
          <label class="dlw-check"><input data-field="autoload" type="checkbox" checked> Auto-click Load more</label>
        </div>
        <p class="dlw-note">Duolingo numbering counts backwards: newest #<span data-field="total"></span>, next #<span data-field="next"></span>. Select <strong>Recently Learned</strong> sorting before exporting. Ranges are Duolingo word numbers, not your app's IDs.</p>
        <div class="dlw-secondary">
          <p><strong>Import tracking</strong> — saved separately for German and Japanese in this browser.</p>
          <label>Last confirmed imported Duolingo word #<input data-field="last" type="number" min="0" value="0"></label>
          <div class="dlw-actions"><button data-action="save-last">Save last imported</button><button data-action="mark-imported">Mark current export imported</button></div>
          <p class="dlw-note">Only mark an export imported <strong>after</strong> successfully adding it to your app. Word identities from confirmed imports help warn about duplicates after Duolingo reorders words. Tracking stays in this browser.</p>
        </div>
        <p class="dlw-status" data-field="status"></p>
        <textarea data-field="json" spellcheck="false" aria-label="Exported JSON" placeholder="Click Extract range to generate JSON. You can edit it before copying."></textarea>
        <div class="dlw-actions">
          <button class="dlw-primary" data-action="extract">Extract range</button>
          <button data-action="copy">Copy JSON</button>
          <button data-action="download">Download JSON</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    const $=name=>overlay.querySelector(`[data-field="${name}"]`);
    const action=name=>overlay.querySelector(`[data-action="${name}"]`);
    let currentExport=null;
    const status=message=>{$('status').textContent=message;};
    const lang=()=>$('language').value;
    function refreshTracking() {
      const saved=languageTracking(lang());
      $('last').value=String(saved.lastImported || 0);
      const total=totalWords();
      $('total').textContent=total ?? '?';
      $('next').textContent=total === null?'?':String(total-1);
      const from=saved.lastImported ? Math.min(total || saved.lastImported+1,saved.lastImported+1) : Math.max(1,(total||50)-49);
      $('from').value=String(from);
      $('to').value=String(Math.max(from,total||from));
      currentExport=null;
      $('json').value='';
      status(`${allCards().length} cards loaded. ${total === null ? 'Could not find Duolingo word total.' : `Duolingo total: ${total}.`} ${isRecentSort() ? 'Recently Learned order detected.' : 'Choose Recently Learned sorting to use chronological numbers.'}`);
    }
    $('language').value=detectLanguage();
    $('language').addEventListener('change',refreshTracking);
    refreshTracking();
    const close=()=>{state.canceled=true;overlay.remove();};
    action('close').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay&&!state.busy)close();});
    action('save-last').onclick=()=>{
      const value=Number($('last').value);
      if(!Number.isSafeInteger(value)||value<0){status('Last imported must be 0 or a positive whole number.');return;}
      languageTracking(lang()).lastImported=value;
      storeTracking();
      status(`Saved last imported #${value} for ${lang()==='ja'?'Japanese':'German'}. This number alone cannot guarantee stable ordering.`);
    };
    action('mark-imported').onclick=()=>{
      if(!currentExport||currentExport.language!==lang()){
        status('First extract a range, then import it into your app before marking it confirmed.');return;
      }
      let edited;
      try { edited=JSON.parse($('json').value); } catch { status('JSON is invalid; cannot confirm the export.');return; }
      if(!Array.isArray(edited) || edited.length!==currentExport.rows.length){status('Export was edited to a different number of records; cannot safely confirm.');return;}
      if(!confirm(`Confirm you successfully imported these ${currentExport.rows.length} words into your app?`))return;
      const tracking=languageTracking(lang());
      tracking.identities=[...new Set([...tracking.identities,...currentExport.rows.map(identity)])];
      // Only advance when the confirmed range directly continues the old imported frontier.
      if(currentExport.from <= tracking.lastImported+1 && currentExport.to > tracking.lastImported) tracking.lastImported=currentExport.to;
      storeTracking();
      $('last').value=String(tracking.lastImported);
      status(`Confirmed ${currentExport.rows.length} word identities. Last continuous imported #${tracking.lastImported}.`);
    };
    action('extract').onclick=async()=>{
      if(state.busy)return;
      const total=totalWords();
      if(total===null||total<=0){status('Duolingo total word count was not found. Do not export with guessed numbering.');return;}
      if(!isRecentSort()){status('Please select Recently Learned sort to use the stable-looking chronological numbering scheme.');return;}
      const from=Number($('from').value),to=Number($('to').value);
      if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<1||to<from||to>total){status(`Enter a valid range from 1 to ${total}, with From ≤ To.`);return;}
      if(to-from+1>3000){status('Select at most 3000 words at once.');return;}
      const idText=$('id').value.trim();
      const idBase=idText?Number(idText):null;
      if(idBase!==null&&(!Number.isSafeInteger(idBase)||idBase<1)){status('First app ID must be a positive integer or blank.');return;}
      state.busy=true;state.canceled=false;action('extract').disabled=true;
      try{
        // #total is the first card. To include #from, load total-from+1 cards.
        const required=total-from+1;
        if($('autoload').checked && allCards().length<required)await loadThrough(required,status);
        if(state.canceled)return;
        if(totalWords()!==total||!isRecentSort()){
          status('Word total or sorting changed during loading. Reopen exporter and verify your range.');return;
        }
        const count=allCards().length;
        if(count<required){status(`Only ${count} words loaded; need ${required} to reach #${from}. No partial export created. Click Load more and retry.`);return;}
        const selected=records().filter(row=>row.number>=from&&row.number<=to);
        if(selected.length!==to-from+1){status('Some word cards are missing text. Export stopped to avoid silently skipping words.');return;}
        const tracking=languageTracking(lang());
        const identitySet=new Set(tracking.identities);
        const known=selected.filter(row=>identitySet.has(identity(row)));
        const output=selected.map((row,i)=>{
          const entry={type:'word',english:row.english,[lang()==='ja'?'kanji':'german']:row.source};
          if(idBase!==null)entry.id=idBase+i;
          return entry;
        });
        $('json').value=JSON.stringify(output,null,2);
        currentExport={language:lang(),from,to,rows:selected};
        status(`Ready: ${output.length} words #${from}–#${to}; ${known.length} already-confirmed word identities found${known.length?` (e.g. ${known.slice(0,3).map(x=>x.source).join(', ')})`:''}. Review before importing; duplicate words are NOT silently removed.`);
      }catch(error){status(`Extraction error: ${error.message}`)}
      finally{state.busy=false;action('extract').disabled=false;}
    };
    action('copy').onclick=async()=>{
      if(!$('json').value.trim())return;
      try{await navigator.clipboard.writeText($('json').value);status('Copied JSON to clipboard.');}
      catch{$('json').focus();$('json').select();status('Clipboard blocked: press Ctrl+C.');}
    };
    action('download').onclick=()=>{
      if(!$('json').value.trim())return;
      const blob=new Blob([$('json').value],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');anchor.href=url;
      anchor.download=`duolingo-words-${lang()}-${$('from').value}-${$('to').value}.json`;
      anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    };
  }

  const onClick=event=>{
    const word=event.target.closest('.dlw-word');
    if(word)word.classList.toggle('dlw-hidden');
  };
  document.addEventListener('click',onClick);
  setup();
  state.observer=new MutationObserver(()=>{
    if(state.scheduled)return;
    state.scheduled=true;
    requestAnimationFrame(()=>{state.scheduled=false;setup();});
  });
  state.observer.observe(document.body,{childList:true,subtree:true});
  window.DuolingoWordsTools={
    version:'2.2.0',open:openExporter,
    destroy(){state.canceled=true;state.observer?.disconnect();document.removeEventListener('click',onClick);document.getElementById(IDS.toolbar)?.remove();document.getElementById(IDS.modal)?.remove();document.getElementById(IDS.style)?.remove();for(const el of document.querySelectorAll('.dlw-word-number'))el.remove();for(const el of document.querySelectorAll('.dlw-word')){el.classList.remove('dlw-word','dlw-hidden');delete el.dataset.dlwLang;}delete window.DuolingoWordsTools;}
  };
})();
