/* Biblioteca de Acordes — lógica da aplicação */
(function () {
  'use strict';

  const DB = window.CHORDS_DB;
  const $ = (sel) => document.querySelector(sel);
  const STORAGE_KEY = 'acordes.custom';
  const PREFS_KEY = 'acordes.prefs';
  const SELECTION_KEY = 'acordes.selecao';
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const isMobile = () => mobileQuery.matches;
  // Web Share com ficheiros → "Guardar nas Fotos" no telemóvel
  const canShareFiles = !!(navigator.canShare && navigator.share &&
    navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }));

  // ---------- Nomes das notas ----------
  const KEY_NAMES = {
    C: ['C', 'C'], Csharp: ['C#', 'Db'], D: ['D', 'D'], Eb: ['D#', 'Eb'], E: ['E', 'E'], F: ['F', 'F'],
    Fsharp: ['F#', 'Gb'], G: ['G', 'G'], Ab: ['G#', 'Ab'], A: ['A', 'A'], Bb: ['A#', 'Bb'], B: ['B', 'B'],
  };
  const ENHARMONIC = { 'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#', 'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#', 'A#': 'Bb', 'Bb': 'A#' };
  const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'];

  function noteName(note, acc) {
    if (!ENHARMONIC[note]) return note;
    const isSharp = SHARPS.includes(note);
    if (acc === 'sharp') return isSharp ? note : ENHARMONIC[note];
    return isSharp ? ENHARMONIC[note] : note;
  }

  function chordName(dbKey, suffix, acc) {
    const root = noteName(KEY_NAMES[dbKey][0], acc);
    if (suffix === 'major') return root;
    if (suffix === 'minor') return root + 'm';
    const slash = suffix.match(/^(m?)\/(.+)$/);
    if (slash) return root + slash[1] + '/' + noteName(slash[2], acc);
    return root + suffix;
  }

  // ---------- Estado ----------
  const state = {
    acc: 'sharp',
    key: 'C',
    suffix: 'major',
    position: 0,
    customId: null,        // id do acorde personalizado selecionado (ou null)
    theme: 'black',
    ink: 'white',
    showFingers: false,
    showTitle: true,
    format: 'png',
    scale: 2,
    customName: '',
    search: '',
    // seleção múltipla: [{ key, suffix, position } | { customId }]
    selected: [],
  };

  let customChords = loadJSON(STORAGE_KEY, []);
  state.selected = loadJSON(SELECTION_KEY, []);

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function saveCustom() { localStorage.setItem(STORAGE_KEY, JSON.stringify(customChords)); }
  function saveSelection() { localStorage.setItem(SELECTION_KEY, JSON.stringify(state.selected)); }
  function loadPrefs() {
    const p = loadJSON(PREFS_KEY, {});
    for (const k of ['acc', 'theme', 'ink', 'showFingers', 'showTitle', 'format', 'scale']) if (k in p) state[k] = p[k];
  }
  function savePrefs() {
    const { acc, theme, ink, showFingers, showTitle, format, scale } = state;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ acc, theme, ink, showFingers, showTitle, format, scale }));
  }

  // ---------- Acesso à base de dados ----------
  function dbChord(key, suffix) {
    return (DB.chords[key] || []).find((c) => c.suffix === suffix);
  }

  /** Resolve um item (da seleção ou o atual) para um acorde renderizável. */
  function resolveItem(item, name) {
    if (item.customId) {
      const c = customChords.find((x) => x.id === item.customId);
      return c ? { ...c, name: name || c.name } : null;
    }
    const c = dbChord(item.key, item.suffix);
    if (!c) return null;
    const pos = c.positions[Math.min(item.position || 0, c.positions.length - 1)];
    return { ...pos, name: name || chordName(item.key, item.suffix, state.acc) };
  }

  function currentItem() {
    return state.customId ? { customId: state.customId } : { key: state.key, suffix: state.suffix, position: state.position };
  }

  function currentChord() {
    return resolveItem(currentItem(), state.customName);
  }

  function currentPositions() {
    if (state.customId) return null;
    const c = dbChord(state.key, state.suffix);
    return c ? c.positions : [];
  }

  function renderOpts() {
    return { theme: state.theme, ink: state.ink, showFingers: state.showFingers, showTitle: state.showTitle };
  }

  function sameItem(a, b) {
    return a.customId ? a.customId === b.customId : (!b.customId && a.key === b.key && a.suffix === b.suffix && (a.position || 0) === (b.position || 0));
  }

  function selectChord(key, suffix) {
    state.key = key; state.suffix = suffix; state.customId = null; state.position = 0;
    state.customName = ''; $('#custom-name').value = '';
    if (isMobile()) showView('chord');
    update();
  }

  function selectCustom(id) {
    state.customId = id; state.customName = ''; $('#custom-name').value = '';
    if (isMobile()) showView('chord');
    update();
  }

  function showView(view) {
    document.body.dataset.view = view;
    window.scrollTo(0, 0);
  }

  // ---------- Render da UI ----------
  function renderKeys() {
    const el = $('#keys');
    el.innerHTML = '';
    for (const k of DB.keys) {
      const dbKey = k.replace('#', 'sharp');
      const b = document.createElement('button');
      b.textContent = noteName(KEY_NAMES[dbKey][0], state.acc);
      b.classList.toggle('on', !state.customId && !state.search && state.key === dbKey);
      b.onclick = () => {
        state.key = dbKey; state.customId = null; state.search = ''; $('#search').value = '';
        state.position = 0; state.customName = ''; $('#custom-name').value = '';
        update();
      };
      el.appendChild(b);
    }
  }

  function normalize(s) { return s.toLowerCase().replace(/\s+/g, '').replace(/♯/g, '#').replace(/♭/g, 'b'); }

  function renderSuffixes() {
    const el = $('#suffixes');
    el.innerHTML = '';
    let items = [];
    if (state.search) {
      const q = normalize(state.search);
      for (const key of Object.keys(DB.chords)) {
        for (const c of DB.chords[key]) {
          const name = chordName(key, c.suffix, state.acc);
          const n = normalize(name);
          if (n.includes(q)) items.push({ key, suffix: c.suffix, name, count: c.positions.length, rank: n.startsWith(q) ? 0 : 1 });
        }
      }
      items.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name));
      items = items.slice(0, 80);
      if (!items.length) { el.innerHTML = '<div class="empty">Sem resultados</div>'; return; }
    } else {
      items = (DB.chords[state.key] || []).map((c) => ({ key: state.key, suffix: c.suffix, name: chordName(state.key, c.suffix, state.acc), count: c.positions.length }));
    }
    for (const it of items) {
      const item = { key: it.key, suffix: it.suffix, position: 0 };
      const inSel = state.selected.some((s) => sameItem(s, item));
      const b = document.createElement('button');
      b.innerHTML = `<span>${it.name}</span><span class="count">${it.count} pos.</span><span class="add ${inSel ? 'in' : ''}" title="Adicionar à seleção">${inSel ? '✓' : '+'}</span>`;
      b.classList.toggle('on', !state.customId && state.key === it.key && state.suffix === it.suffix);
      b.onclick = () => selectChord(it.key, it.suffix);
      b.querySelector('.add').onclick = (e) => { e.stopPropagation(); toggleSelected(item); };
      el.appendChild(b);
    }
  }

  function renderCustomList() {
    const el = $('#custom-list');
    el.innerHTML = '';
    if (!customChords.length) { el.innerHTML = '<div class="empty">Ainda não criaste acordes.</div>'; return; }
    for (const c of customChords) {
      const item = { customId: c.id };
      const inSel = state.selected.some((s) => sameItem(s, item));
      const b = document.createElement('button');
      b.innerHTML = `<span>${escapeHtml(c.name)}</span><span class="count edit" title="Editar">✎</span><span class="add ${inSel ? 'in' : ''}" title="Adicionar à seleção">${inSel ? '✓' : '+'}</span>`;
      b.classList.toggle('on', state.customId === c.id);
      b.onclick = () => selectCustom(c.id);
      b.querySelector('.edit').onclick = (e) => { e.stopPropagation(); openEditor(c); };
      b.querySelector('.add').onclick = (e) => { e.stopPropagation(); toggleSelected(item); };
      el.appendChild(b);
    }
  }

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderPreview() {
    const chord = currentChord();
    const preview = $('#preview');
    preview.className = 'preview theme-' + state.theme;
    if (!chord) { preview.innerHTML = ''; $('#chord-title').textContent = '—'; $('#chord-meta').textContent = ''; return; }
    preview.innerHTML = renderChordSVG(chord, renderOpts());
    $('#chord-title').textContent = chord.name;
    $('#mobile-title').textContent = chord.name;
    const abs = chord.frets.map((f) => f < 0 ? 'x' : f === 0 ? '0' : String(f + chord.baseFret - 1)).join(' ');
    $('#chord-meta').textContent = (state.customId ? 'Acorde personalizado · ' : '') + 'Trastes: ' + abs;
    $('#custom-name').placeholder = state.customId ? chord.name : chordName(state.key, state.suffix, state.acc);
  }

  function renderPositions() {
    const el = $('#positions');
    el.innerHTML = '';
    const positions = currentPositions();
    if (!positions || positions.length < 2) { $('#btn-download-all').hidden = true; return; }
    $('#btn-download-all').hidden = false;
    positions.forEach((p, i) => {
      const b = document.createElement('button');
      b.title = `Posição ${i + 1}`;
      b.innerHTML = renderChordSVG({ ...p, name: '' }, { theme: 'black', showFingers: false, showTitle: false });
      b.classList.toggle('on', i === state.position);
      b.onclick = () => { state.position = i; update(); };
      el.appendChild(b);
    });
  }

  function renderControls() {
    setSegmented('#accidentals', state.acc);
    setSegmented('#theme', state.theme);
    setSegmented('#ink', state.ink);
    setSegmented('#format', state.format);
    setSegmented('#scale', String(state.scale));
    $('#ink-field').hidden = state.theme !== 'transparent';
    $('#format-hint').hidden = !(state.theme === 'transparent' && state.format === 'jpeg');
    $('#show-fingers').checked = state.showFingers;
    $('#show-title').checked = state.showTitle;
    $('#btn-edit').textContent = state.customId ? 'Editar este acorde' : 'Editar como novo acorde';
    $('#btn-save').hidden = !canShareFiles;
    const inSel = state.selected.some((s) => sameItem(s, currentItem()));
    $('#btn-add').textContent = inSel ? '✓ Na seleção (remover)' : '＋ Adicionar à seleção';
    $('#btn-add').classList.toggle('primary', !inSel);
  }

  function renderSelectionBar() {
    const bar = $('#selection-bar');
    const n = state.selected.length;
    bar.hidden = n === 0;
    document.body.classList.toggle('has-selection', n > 0);
    if (!n) return;
    $('#sel-count').textContent = n === 1 ? '1 acorde' : `${n} acordes`;
    $('#btn-sel-save').textContent = canShareFiles ? 'Guardar nas Fotos' : 'Descarregar todos';
    const el = $('#sel-thumbs');
    el.innerHTML = '';
    state.selected.forEach((item, i) => {
      const chord = resolveItem(item);
      if (!chord) return;
      const d = document.createElement('div');
      d.className = 'sel-thumb';
      d.innerHTML = renderChordSVG(chord, { theme: 'black', showFingers: false, showTitle: true }) + `<span class="x" title="Remover">✕</span>`;
      d.querySelector('.x').onclick = () => { state.selected.splice(i, 1); saveSelection(); update(); };
      d.onclick = (e) => { if (e.target.classList.contains('x')) return; if (item.customId) selectCustom(item.customId); else { selectChord(item.key, item.suffix); state.position = item.position || 0; update(); } };
      el.appendChild(d);
    });
  }

  function setSegmented(sel, value) {
    for (const b of document.querySelectorAll(sel + ' button')) b.classList.toggle('on', b.dataset.v === value);
  }

  function update() {
    renderKeys();
    renderSuffixes();
    renderCustomList();
    renderPreview();
    renderPositions();
    renderControls();
    renderSelectionBar();
    savePrefs();
    schedulePrepare();
  }

  // ---------- Seleção múltipla ----------
  function toggleSelected(item) {
    const idx = state.selected.findIndex((s) => sameItem(s, item));
    if (idx >= 0) state.selected.splice(idx, 1); else state.selected.push(item);
    saveSelection();
    update();
  }

  // As imagens da seleção são pré-geradas em segundo plano, para que "Guardar nas Fotos"
  // possa chamar navigator.share() imediatamente (o iOS exige que seja logo após o toque).
  let prepared = { sig: '', files: null };
  let prepareTimer = null;

  function selectionSignature() {
    return JSON.stringify([state.selected, state.acc, renderOpts(), state.format, state.scale, customChords.length]);
  }

  function schedulePrepare() {
    clearTimeout(prepareTimer);
    if (!state.selected.length) { prepared = { sig: '', files: null }; return; }
    prepareTimer = setTimeout(prepareSelection, 300);
  }

  async function prepareSelection() {
    const sig = selectionSignature();
    if (prepared.sig === sig && prepared.files) return prepared.files;
    const files = [];
    const used = new Set();
    for (const item of state.selected) {
      const chord = resolveItem(item);
      if (!chord) continue;
      const blob = await makeBlob(chord);
      let name = fileName(chord, 0);
      for (let k = 2; used.has(name); k++) name = fileName(chord, k - 1);
      used.add(name);
      files.push(new File([blob], name, { type: blob.type }));
    }
    prepared = { sig, files };
    return files;
  }

  async function saveSelectionImages() {
    if (!state.selected.length) return;
    try {
      const ready = prepared.sig === selectionSignature() && prepared.files;
      if (!ready) setStatus('A preparar imagens…');
      const files = await prepareSelection();
      await shareOrDownload(files);
    } catch (e) {
      if (e.name !== 'AbortError') setStatus('Erro: ' + e.message);
    }
  }

  async function shareOrDownload(files) {
    if (canShareFiles && navigator.canShare({ files })) {
      await navigator.share({ files, title: 'Acordes' });
      setStatus(files.length === 1 ? 'Imagem partilhada.' : `${files.length} imagens partilhadas.`);
    } else {
      for (const f of files) { triggerDownload(f, f.name); await new Promise((r) => setTimeout(r, 400)); }
      setStatus(files.length === 1 ? 'Descarregado.' : `${files.length} imagens descarregadas.`);
    }
  }

  // ---------- Descarregar / copiar ----------
  function fileName(chord, index) {
    const base = chord.name.replace(/\//g, '_').replace(/[\\:*?"<>|]/g, '');
    const suffix = index > 0 ? ` (${index + 1})` : '';
    return `${base}${suffix}.${state.format === 'jpeg' ? 'jpg' : 'png'}`;
  }

  async function makeBlob(chord) {
    const svg = renderChordSVG(chord, renderOpts());
    return svgToImageBlob(svg, { format: state.format, scale: state.scale, theme: state.theme, ink: state.ink });
  }

  function triggerDownload(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function setStatus(msg) { $('#status').textContent = msg; }

  async function download() {
    const chord = currentChord();
    if (!chord) return;
    try {
      setStatus('A gerar imagem…');
      const blob = await makeBlob(chord);
      triggerDownload(blob, fileName(chord, state.customId ? 0 : state.position));
      setStatus('Descarregado.');
    } catch (e) { setStatus('Erro: ' + e.message); }
  }

  async function saveCurrent() {
    const chord = currentChord();
    if (!chord) return;
    try {
      const blob = await makeBlob(chord);
      await shareOrDownload([new File([blob], fileName(chord, state.customId ? 0 : state.position), { type: blob.type })]);
    } catch (e) { if (e.name !== 'AbortError') setStatus('Erro: ' + e.message); }
  }

  async function downloadAll() {
    const positions = currentPositions();
    if (!positions) return;
    const name = state.customName || chordName(state.key, state.suffix, state.acc);
    try {
      const files = [];
      for (let i = 0; i < positions.length; i++) {
        setStatus(`A gerar ${i + 1}/${positions.length}…`);
        const blob = await makeBlob({ ...positions[i], name });
        files.push(new File([blob], fileName({ name }, i), { type: blob.type }));
      }
      await shareOrDownload(files);
    } catch (e) { if (e.name !== 'AbortError') setStatus('Erro: ' + e.message); }
  }

  async function copyImage() {
    const chord = currentChord();
    if (!chord) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('o browser não suporta copiar imagens');
      setStatus('A copiar…');
      const svg = renderChordSVG(chord, renderOpts());
      const blob = await svgToImageBlob(svg, { format: 'png', scale: state.scale, theme: state.theme, ink: state.ink });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Imagem copiada (PNG).');
    } catch (e) { setStatus('Erro ao copiar: ' + e.message); }
  }

  // ---------- Exportar / importar acordes personalizados ----------
  function exportCustom() {
    const blob = new Blob([JSON.stringify(customChords, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'os-meus-acordes.json');
  }

  function importCustom(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('formato inválido');
        let added = 0;
        for (const c of data) {
          if (!c || !Array.isArray(c.frets) || c.frets.length !== 6 || !c.name) continue;
          const id = c.id && !customChords.some((x) => x.id === c.id) ? c.id : newId();
          customChords.push({ id, name: String(c.name), frets: c.frets.map(Number), fingers: (c.fingers || [0, 0, 0, 0, 0, 0]).map(Number), baseFret: Number(c.baseFret) || 1, barres: (c.barres || []).map(Number), nFrets: Number(c.nFrets) || 5 });
          added++;
        }
        saveCustom();
        update();
        setStatus(`${added} acordes importados.`);
      } catch (e) { setStatus('Erro ao importar: ' + e.message); }
    };
    reader.readAsText(file);
  }

  function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- Editor ----------
  const editor = { id: null, name: '', frets: [-1, -1, -1, -1, -1, -1], fingers: [0, 0, 0, 0, 0, 0], baseFret: 1, nFrets: 5 };

  function openEditor(chord) {
    if (chord) {
      editor.id = chord.id || null;
      editor.name = chord.name || '';
      editor.frets = [...chord.frets];
      editor.fingers = [...(chord.fingers || [0, 0, 0, 0, 0, 0])];
      editor.baseFret = chord.baseFret || 1;
      editor.nFrets = Math.max(chord.nFrets || 5, ...chord.frets);
    } else {
      editor.id = null; editor.name = ''; editor.frets = [-1, -1, -1, -1, -1, -1]; editor.fingers = [0, 0, 0, 0, 0, 0]; editor.baseFret = 1; editor.nFrets = 5;
    }
    $('#editor-title').textContent = editor.id ? 'Editar acorde' : 'Criar acorde';
    $('#editor-delete').hidden = !editor.id;
    $('#editor-name').value = editor.name;
    $('#editor-basefret').value = editor.baseFret;
    $('#editor-nfrets').value = editor.nFrets;
    $('#editor').hidden = false;
    renderEditor();
    if (!isMobile()) $('#editor-name').focus();
  }

  function closeEditor() { $('#editor').hidden = true; }

  function editorBarres() {
    // dedos iguais no mesmo traste em ≥ 2 cordas = pestana
    const barres = [];
    for (let f = 1; f <= editor.nFrets; f++) {
      const byFinger = {};
      for (let i = 0; i < 6; i++) if (editor.frets[i] === f && editor.fingers[i] > 0) byFinger[editor.fingers[i]] = (byFinger[editor.fingers[i]] || 0) + 1;
      if (Object.values(byFinger).some((n) => n >= 2)) barres.push(f);
    }
    return barres;
  }

  function editorChord() {
    return { id: editor.id, name: editor.name, frets: [...editor.frets], fingers: [...editor.fingers], baseFret: editor.baseFret, barres: editorBarres(), nFrets: editor.nFrets };
  }

  function renderEditor() {
    const grid = $('#editor-grid');
    grid.innerHTML = '';
    // linha dos marcadores X / O
    grid.appendChild(cell('', 'fretnum'));
    for (let i = 0; i < 6; i++) {
      const f = editor.frets[i];
      const c = cell(f === -1 ? '✕' : f === 0 ? '○' : '', 'marker');
      c.title = 'Alternar corda muda / solta';
      c.onclick = () => { editor.frets[i] = editor.frets[i] === -1 ? 0 : -1; renderEditor(); };
      grid.appendChild(c);
    }
    for (let r = 1; r <= editor.nFrets; r++) {
      grid.appendChild(cell(String(editor.baseFret + r - 1), 'fretnum'));
      for (let i = 0; i < 6; i++) {
        const on = editor.frets[i] === r;
        const c = cell(on && editor.fingers[i] ? String(editor.fingers[i]) : (on ? '●' : ''), on ? 'on' : '');
        c.onclick = () => { editor.frets[i] = on ? 0 : r; renderEditor(); };
        grid.appendChild(c);
      }
    }
    // dedos
    const row = $('#editor-finger-row');
    row.innerHTML = '';
    row.appendChild(cell('', 'fretnum'));
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('select');
      for (let d = 0; d <= 4; d++) { const o = document.createElement('option'); o.value = d; o.textContent = d === 0 ? '–' : d; s.appendChild(o); }
      s.value = editor.fingers[i];
      s.disabled = editor.frets[i] <= 0;
      s.onchange = () => { editor.fingers[i] = Number(s.value); renderEditor(); };
      row.appendChild(s);
    }
    $('#editor-preview').className = 'editor-preview theme-' + state.theme;
    $('#editor-preview').innerHTML = renderChordSVG(editorChord(), { ...renderOpts(), showFingers: true });
  }

  function cell(text, cls) {
    const d = document.createElement('div');
    d.className = 'cell ' + (cls || '');
    d.textContent = text;
    return d;
  }

  function saveEditor() {
    editor.name = $('#editor-name').value.trim();
    if (!editor.name) { $('#editor-name').focus(); return; }
    if (!editor.frets.some((f) => f >= 0)) { alert('O acorde precisa de pelo menos uma corda a tocar.'); return; }
    const chord = editorChord();
    if (editor.id) {
      const idx = customChords.findIndex((c) => c.id === editor.id);
      if (idx >= 0) customChords[idx] = chord; else { chord.id = newId(); customChords.push(chord); }
    } else {
      chord.id = newId();
      customChords.push(chord);
    }
    saveCustom();
    closeEditor();
    selectCustom(chord.id);
  }

  function deleteEditor() {
    if (!editor.id || !confirm(`Apagar o acorde "${editor.name}"?`)) return;
    customChords = customChords.filter((c) => c.id !== editor.id);
    state.selected = state.selected.filter((s) => s.customId !== editor.id);
    saveCustom();
    saveSelection();
    if (state.customId === editor.id) state.customId = null;
    closeEditor();
    update();
  }

  // ---------- Eventos ----------
  function bindSegmented(sel, onPick) {
    for (const b of document.querySelectorAll(sel + ' button')) b.onclick = () => { onPick(b.dataset.v); update(); };
  }

  bindSegmented('#accidentals', (v) => { state.acc = v; });
  bindSegmented('#theme', (v) => { state.theme = v; });
  bindSegmented('#ink', (v) => { state.ink = v; });
  bindSegmented('#format', (v) => { state.format = v; });
  bindSegmented('#scale', (v) => { state.scale = Number(v); });
  $('#show-fingers').onchange = (e) => { state.showFingers = e.target.checked; update(); };
  $('#show-title').onchange = (e) => { state.showTitle = e.target.checked; update(); };
  $('#custom-name').oninput = (e) => { state.customName = e.target.value.trim(); renderPreview(); };
  $('#search').oninput = (e) => { state.search = e.target.value.trim(); renderKeys(); renderSuffixes(); };

  $('#btn-add').onclick = () => toggleSelected(currentItem());
  $('#btn-save').onclick = saveCurrent;
  $('#btn-download').onclick = download;
  $('#btn-download-all').onclick = downloadAll;
  $('#btn-copy').onclick = copyImage;
  $('#btn-edit').onclick = () => {
    const chord = currentChord();
    if (!chord) return;
    openEditor(state.customId ? chord : { ...chord, id: null });
  };
  $('#btn-new').onclick = () => openEditor(null);
  $('#btn-export').onclick = exportCustom;
  $('#btn-import').onclick = () => $('#import-file').click();
  $('#import-file').onchange = (e) => { if (e.target.files[0]) importCustom(e.target.files[0]); e.target.value = ''; };
  $('#btn-back').onclick = () => showView('list');

  $('#btn-sel-save').onclick = saveSelectionImages;
  $('#btn-sel-clear').onclick = () => { state.selected = []; saveSelection(); update(); };

  $('#editor-close').onclick = closeEditor;
  $('#editor-save').onclick = saveEditor;
  $('#editor-delete').onclick = deleteEditor;
  $('#editor-name').oninput = (e) => { editor.name = e.target.value; renderEditor(); };
  $('#editor-basefret').onchange = (e) => { editor.baseFret = Math.max(1, Number(e.target.value) || 1); e.target.value = editor.baseFret; renderEditor(); };
  $('#editor-nfrets').onchange = (e) => {
    editor.nFrets = Math.min(8, Math.max(4, Number(e.target.value) || 5));
    e.target.value = editor.nFrets;
    for (let i = 0; i < 6; i++) if (editor.frets[i] > editor.nFrets) editor.frets[i] = 0;
    renderEditor();
  };
  $('#editor').addEventListener('click', (e) => { if (e.target.id === 'editor') closeEditor(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#editor').hidden) closeEditor(); });

  // no telemóvel as opções ficam recolhidas por defeito
  $('#options').open = !isMobile();
  mobileQuery.addEventListener('change', () => { if (!isMobile()) showView('list'); });

  // ---------- PWA ----------
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline; a app funciona na mesma */ });
  }

  // ---------- Arranque ----------
  loadPrefs();
  // começa em Am, como na imagem de referência
  state.key = 'A'; state.suffix = 'minor';
  update();
})();
