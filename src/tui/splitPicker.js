import blessedPkg from 'blessed';
const blessed = blessedPkg;
import dayjs from 'dayjs';
import path from 'node:path';
import clipboard from 'clipboardy';
import chalk from 'chalk';
import { listSessionFiles } from '../utils/sessionFinder.js';
import { parseSessionFile } from '../utils/parser.js';
import { extractSessionMetaQuick } from '../utils/metaQuick.js';
import { selectRecentDialogMessages, formatPreviewLines } from '../utils/preview.js';

function safeString(s) { return typeof s === 'string' ? s : ''; }

function formatTopRow(file, meta) {
  const date = meta?.startTime ? dayjs(meta.startTime).format('YYYY-MM-DD HH:mm:ss') : dayjs(new Date(file.mtime)).format('YYYY-MM-DD HH:mm:ss');
  const cwd = meta?.cwd || '';
  const id = meta?.id || path.basename(file.path);
  const left = chalk.gray(date);
  const mid = chalk.cyan(cwd || '-');
  const right = chalk.magenta(id);
  return `${left} | ${mid} | ${right}`;
}

// meta quick extraction moved to utils/metaQuick

function buildDialogPreview(messages, { maxItems = 20, hide = [] } = {}) {
  const items = selectRecentDialogMessages(messages, { limit: maxItems }).filter(it => {
    if (it.role === 'user' && hide.includes('user')) return false;
    if (it.role === 'assistant' && hide.includes('assistant')) return false;
    return true;
  }).map(it => ({ ...it, text: safeString(it.text).replace(/\r/g, '') }));
  const lines = formatPreviewLines(items, { color: true, chalkLib: chalk });
  return lines.join('\n');
}

export async function pickSessionSplitTUI(root, presetList = null, options = {}) {
  const { hide = [], currentDirOnly = false } = options || {};
  const files = presetList || await listSessionFiles(root);
  if (!files.length) return null;

  const screen = blessed.screen({ smartCSR: true, warnings: false, title: 'cxresume - Sessions / Preview', fullUnicode: true });
  const gap = 1;
  const totalH = screen.height || 40;
  let topH = Math.max(8, Math.floor(totalH * 0.35));
  const bottomTop = topH + gap;
  const bottomH = Math.max(6, totalH - bottomTop);

  const topBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: topH,
    border: { type: 'line' },
    borderColor: 'cyan',
    label: '  Sessions  ',
  });

  const header = blessed.box({
    parent: topBox,
    top: 0,
    left: 1,
    height: 1,
    width: '100%-2',
    tags: false,
    content: chalk.gray('ccresume-like mode: ') +
      chalk.yellow('←/→') + ' pages • ' +
      chalk.yellow('↑/↓') + ' select • ' +
      chalk.yellow('j/k') + ' scroll • ' +
      chalk.yellow('Enter') + ' resume • ' +
      chalk.yellow('n') + ' new • ' +
      chalk.yellow('-') + ' edit options • ' +
      chalk.yellow('c') + ' copy ID • ' +
      chalk.yellow('f') + ' full • ' +
      chalk.yellow('q') + ' quit'
  });

  const list = blessed.list({
    parent: topBox,
    top: 2,
    left: 1,
    width: '100%-2',
    height: '100%-3',
    keys: true,
    vi: false,
    mouse: true,
    style: { selected: { inverse: true } },
    scrollbar: { ch: ' ', track: { bg: 'gray' }, style: { bg: 'white' } },
    items: [],
  });

  const bottomBox = blessed.box({
    top: bottomTop,
    left: 0,
    width: '100%',
    height: bottomH,
    border: { type: 'line' },
    borderColor: 'green',
    label: '  Dialog Preview (recent, chronological)  ',
  });

  const preview = blessed.box({
    parent: bottomBox,
    top: 1,
    left: 1,
    width: '100%-2',
    height: '100%-2',
    tags: false,
    wrap: true,
    keys: true,
    vi: true,
    mouse: true,
    alwaysScroll: true,
    scrollable: true,
    scrollbar: { ch: ' ', track: { bg: 'gray' }, style: { bg: 'white' } },
    content: '',
  });

  screen.append(topBox);
  screen.append(bottomBox);

  const metaCache = new Map();
  const previewCache = new Map();
  let destroyed = false;
  let fullView = false;
  let editedArgs = '';

  // Pagination state
  const ITEMS_PER_PAGE = 30;
  let currentPage = 0;
  let pageItems = [];

  let visibleFiles = files.slice();
  if (currentDirOnly) {
    // Pre-filter visible files asynchronously based on cwd
    (async () => {
      const matches = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const meta = await extractSessionMetaQuick(files[i].path);
          if (meta.cwd && path.resolve(meta.cwd) === path.resolve(process.cwd())) {
            matches.push(files[i]);
          }
        } catch {}
      }
      if (!destroyed && matches.length) {
        visibleFiles = matches.sort((a,b) => b.mtime - a.mtime);
        currentPage = 0;
        updatePageItems();
        screen.render();
        await updatePreviewForIndex(0);
      }
    })();
  }

  function updatePageItems() {
    const start = currentPage * ITEMS_PER_PAGE;
    const end = Math.min(visibleFiles.length, start + ITEMS_PER_PAGE);
    pageItems = visibleFiles.slice(start, end);
    list.setItems(pageItems.map(f => formatTopRow(f, metaCache.get(f.path) || null)));
    list.select(0);
  }

  function updateHeader() {
    const totalPages = Math.max(1, Math.ceil(visibleFiles.length / ITEMS_PER_PAGE));
    const info = `Page ${currentPage + 1}/${totalPages} | Showing ${pageItems.length}/${visibleFiles.length}`;
    const opts = editedArgs ? ` | Options: ${editedArgs}` : '';
    header.setContent(`ccresume-like mode: ←/→ pages • ↑/↓ select • j/k scroll • Enter resume • n new • - edit options • c copy ID • f full • q quit${opts} | ${info}`);
  }

  function refreshListRow(i) {
    const f = pageItems[i];
    if (!f) return;
    const meta = metaCache.get(f.path) || null;
    const row = formatTopRow(f, meta);
    try { list.setItem(i, row); } catch {}
  }

  async function loadMeta(i) {
    const f = pageItems[i];
    if (metaCache.has(f.path)) return;
    try {
      const meta = await extractSessionMetaQuick(f.path);
      metaCache.set(f.path, meta);
      if (!destroyed) {
        refreshListRow(i);
        screen.render();
      }
    } catch {}
  }

  async function updatePreviewForIndex(idx) {
    if (idx < 0 || idx >= pageItems.length) return;
    const f = pageItems[idx];
    if (previewCache.has(f.path)) {
      preview.setContent(previewCache.get(f.path));
      screen.render();
      return;
    }
    preview.setContent('Loading…');
    screen.render();
    try {
      const parsed = await parseSessionFile(f.path);
      const body = buildDialogPreview(parsed.messages, { maxItems: 20, hide });
      previewCache.set(f.path, body);
      if (!destroyed) {
        preview.setContent(body);
        screen.render();
      }
    } catch (e) {
      if (!destroyed) {
        preview.setContent('Preview failed: ' + (e?.message || e));
        screen.render();
      }
    }
  }

  // pagination init
  updatePageItems();
  updateHeader();

  // preload meta with limited concurrency
  const concurrency = 8;
  let idxLoad = 0;
  for (let c = 0; c < concurrency; c++) {
    (async function worker() {
      while (idxLoad < pageItems.length && !destroyed) {
        const i = idxLoad++;
        await loadMeta(i);
      }
    })();
  }

  list.select(0);
  list.focus();
  await updatePreviewForIndex(0);

  const navKeys = ['up','down','pageup','pagedown','home','end'];
  for (const k of navKeys) {
    list.key(k, async () => {
      const sel = list.selected;
      screen.render();
      await updatePreviewForIndex(sel);
      loadMeta(sel);
      if (sel + 1 < pageItems.length) loadMeta(sel + 1);
      if (sel - 1 >= 0) loadMeta(sel - 1);
    });
  }

  // Page navigation
  screen.key(['left'], async () => {
    if (currentPage > 0) {
      currentPage--;
      updatePageItems();
      updateHeader();
      idxLoad = 0; // reload meta for new page
      await updatePreviewForIndex(0);
    }
  });
  screen.key(['right'], async () => {
    const totalPages = Math.ceil(visibleFiles.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages - 1) {
      currentPage++;
      updatePageItems();
      updateHeader();
      idxLoad = 0;
      await updatePreviewForIndex(0);
    }
  });

  // preview scroll via j/k
  screen.key(['j'], () => { preview.scroll(1); screen.render(); });
  screen.key(['k'], () => { preview.scroll(-1); screen.render(); });

  // Toggle full view
  screen.key(['f'], () => {
    fullView = !fullView;
    if (fullView) {
      topH = 3; // header only
    } else {
      topH = Math.max(8, Math.floor(totalH * 0.35));
    }
    topBox.height = topH;
    bottomBox.top = topH + gap;
    bottomBox.height = Math.max(6, totalH - (topH + gap));
    screen.render();
  });

  function askEditOptions() {
    const overlay = blessed.box({
      parent: screen,
      top: 'center', left: 'center', width: '80%', height: 7,
      border: { type: 'line' }, label: ' Edit Codex Options ',
      keys: true
    });
    const prompt = blessed.text({ parent: overlay, top: 1, left: 2, content: 'Enter extra command arguments (Enter to confirm / Esc to cancel):' });
    const input = blessed.textbox({ parent: overlay, top: 3, left: 2, width: '95%', height: 1, inputOnFocus: true, keys: true, mouse: true, value: editedArgs });
    input.focus();
    function cleanup() { overlay.destroy(); screen.render(); }
    input.key('escape', () => cleanup());
    input.on('submit', (val) => { editedArgs = String(val || ''); updateHeader(); cleanup(); });
    screen.render();
  }

  function selectedFile() { return pageItems[list.selected]; }

  // Copy session id (relative path)
  screen.key(['c'], async () => {
    const f = selectedFile();
    if (!f) return;
    let meta = metaCache.get(f.path);
    if (!meta) { try { meta = await extractSessionMetaQuick(f.path); metaCache.set(f.path, meta); } catch {} }
    const id = meta?.id || f.rel || f.path;
    try { await clipboard.write(id); } catch {}
  });

  return await new Promise(resolve => {
    list.key('enter', () => {
      destroyed = true;
      const f = selectedFile();
      screen.destroy();
      resolve({ path: f.path, extraArgs: editedArgs, action: 'resume' });
    });
    screen.key(['-'], () => { askEditOptions(); });
    screen.key(['n'], async () => {
      const f = selectedFile(); if (!f) return;
      let cwd;
      try { cwd = (await extractSessionMetaQuick(f.path))?.cwd; } catch {}
      destroyed = true;
      screen.destroy();
      resolve({ action: 'startNew', workingDir: cwd, extraArgs: editedArgs });
    });
    screen.key(['q','C-c','escape'], () => {
      destroyed = true;
      screen.destroy();
      resolve(null);
    });
    screen.render();
  });
}
