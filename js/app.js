/* ════════════════════════════════════════════
   BookStack — app.js
   State management, collection rendering,
   pagination, locations, settings, toast.
   ════════════════════════════════════════════ */

/* ── Default data ── */
const DEFAULT_LOCATIONS = ['Scaffale studio', 'Camera da letto', 'Soggiorno'];

/* ── State ── */
const state = {
  collection: JSON.parse(localStorage.getItem('bookstack_collection') || '[]'),
  locations:  JSON.parse(localStorage.getItem('bookstack_locations')  || 'null') || [...DEFAULT_LOCATIONS],
  currentBook: null,
  page:        0,
  perPage:     10
};

/* ── Persistence ── */
function save() {
  localStorage.setItem('bookstack_collection', JSON.stringify(state.collection));
  localStorage.setItem('bookstack_locations',  JSON.stringify(state.locations));
}

/* ════════════════════════════════════════════
   Callback from api.js — called after a
   successful ISBN search.
   ════════════════════════════════════════════ */
function onSearchResult(book) {
  state.currentBook = book;
  renderResult(book);
}

/* ── Result card ── */
function renderResult(book) {
  document.getElementById('r-title').textContent     = book.title;
  document.getElementById('r-author').textContent    = book.author;
  document.getElementById('r-year').textContent      = book.year;
  document.getElementById('r-publisher').textContent = book.publisher;
  document.getElementById('r-isbn').textContent      = book.isbn;
  document.getElementById('r-notes').value           = '';
  document.getElementById('r-location-custom').value = '';

  /* Source badge */
  const sourceEl  = document.getElementById('r-source');
  const sourceMap = {
    'Google Books': 'source-google',
    'Open Library': 'source-openlibrary',
    'SBN':          'source-sbn'
  };
  if (book.source) {
    sourceEl.textContent   = book.source;
    sourceEl.className     = 'tag ' + (sourceMap[book.source] || '');
    sourceEl.style.display = '';
  } else {
    sourceEl.style.display = 'none';
  }

  populateLocationSelect();

  const section = document.getElementById('result-section');
  section.classList.add('visible');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function dismissResult() {
  document.getElementById('result-section').classList.remove('visible');
  document.getElementById('isbn-input').value = '';
  state.currentBook = null;
}

/* ── Add to collection ── */
function addToCollection() {
  if (!state.currentBook) return;

  const custom   = document.getElementById('r-location-custom').value.trim();
  const select   = document.getElementById('r-location').value;
  const location = custom || select || 'Non specificato';
  const status   = document.getElementById('r-status').value;
  const notes    = document.getElementById('r-notes').value.trim();
  const dateAdded = new Date().toLocaleDateString('it-IT');

  const entry = {
    ...state.currentBook,
    location,
    status,
    notes,
    dateAdded,
    id: Date.now()
  };

  state.collection.unshift(entry);
  state.page = 0;   /* Jump to first page after adding */
  save();
  renderCollection();
  dismissResult();
  showToast('Libro aggiunto alla collezione');
}

/* ════════════════════════════════════════════
   Collection rendering
   ════════════════════════════════════════════ */

const STATUS_CLASS = {
  'Letto':       'status-letto',
  'In lettura':  'status-in-lettura',
  'Da leggere':  'status-da-leggere',
  'Sospeso':     'status-sospeso'
};

const DELETE_SVG = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
  <path d="M4 4l12 12M16 4L4 16"/>
</svg>`;

function renderCollection() {
  const list  = document.getElementById('collection-list');
  const empty = document.getElementById('collection-empty');
  const pagination = document.getElementById('pagination');

  document.getElementById('collection-count').textContent = state.collection.length;

  /* Empty state */
  if (state.collection.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    pagination.style.display = 'none';
    return;
  }

  /* Pagination math */
  const total      = state.collection.length;
  const totalPages = Math.ceil(total / state.perPage);
  state.page       = Math.min(state.page, totalPages - 1);  /* guard after deletion */

  const start = state.page * state.perPage;
  const end   = Math.min(start + state.perPage, total);
  const slice = state.collection.slice(start, end);

  /* Render items */
  list.innerHTML = slice.map(book => bookItemHTML(book)).join('');

  /* Pagination controls */
  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('page-info').textContent = `${state.page + 1} / ${totalPages}`;
    document.getElementById('page-prev').disabled = state.page === 0;
    document.getElementById('page-next').disabled = state.page === totalPages - 1;
  } else {
    pagination.style.display = 'none';
  }
}

/* ── Single book item HTML ── */
function bookItemHTML(book) {
  const coverHTML = book.coverUrl
    /* Cover image with spine fallback on error */
    ? `<img
        class="book-cover-img"
        src="${escHtml(book.coverUrl)}"
        alt="Copertina"
        loading="lazy"
        onerror="this.replaceWith(buildSpine(${escHtml(JSON.stringify(book.title))}))"
      >`
    /* No URL at all — render spine directly */
    : `<div class="book-spine">${escHtml(book.title)}</div>`;

  return `
    <div class="book-item">
      ${coverHTML}
      <div class="book-info">
        <div class="book-item-title">${escHtml(book.title)}</div>
        <div class="book-item-meta">${escHtml(book.author)} · ${escHtml(book.year)}</div>
        <div class="book-item-footer">
          <span class="status-pill ${STATUS_CLASS[book.status] || ''}">${escHtml(book.status)}</span>
          <span class="location-pill">${escHtml(book.location)}</span>
        </div>
      </div>
      <button class="btn-delete" onclick="deleteBook(${book.id})" title="Rimuovi">${DELETE_SVG}</button>
    </div>`;
}

/* Helper: builds a .book-spine element (used by onerror inline handler) */
function buildSpine(title) {
  const div = document.createElement('div');
  div.className   = 'book-spine';
  div.textContent = title;
  return div;
}

/* ── Delete ── */
function deleteBook(id) {
  state.collection = state.collection.filter(b => b.id !== id);
  save();
  renderCollection();
  showToast('Libro rimosso');
}

/* ════════════════════════════════════════════
   Pagination controls
   ════════════════════════════════════════════ */

function changePage(delta) {
  const totalPages = Math.ceil(state.collection.length / state.perPage);
  state.page = Math.max(0, Math.min(state.page + delta, totalPages - 1));
  renderCollection();
  /* Scroll collection into view */
  document.getElementById('collection-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changePerPage(value) {
  state.perPage = parseInt(value, 10);
  state.page    = 0;
  renderCollection();
}

/* ════════════════════════════════════════════
   Tabs
   ════════════════════════════════════════════ */

function switchTab(tab) {
  document.getElementById('panel-camera').style.display = tab === 'camera' ? 'block' : 'none';
  document.getElementById('panel-manual').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('tab-camera').classList.toggle('active', tab === 'camera');
  document.getElementById('tab-manual').classList.toggle('active', tab === 'manual');
  /* Stop camera stream when leaving camera tab */
  if (tab === 'manual' && cameraActive) stopCamera();
}

/* ════════════════════════════════════════════
   Locations
   ════════════════════════════════════════════ */

function populateLocationSelect() {
  const sel = document.getElementById('r-location');
  sel.innerHTML =
    '<option value="">Seleziona un luogo…</option>' +
    state.locations
      .map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`)
      .join('');
}

function renderSettingsLocations() {
  document.getElementById('settings-location-list').innerHTML =
    state.locations.map((l, i) => `
      <div class="location-item">
        <div class="loc-dot"></div>
        <span>${escHtml(l)}</span>
        <button class="btn-delete" onclick="removeLocation(${i})" title="Rimuovi">${DELETE_SVG}</button>
      </div>`
    ).join('');
}

function addLocation() {
  const input = document.getElementById('new-location-input');
  const val   = input.value.trim();
  if (!val) return;
  if (state.locations.includes(val)) return showToast('Luogo già presente');
  state.locations.push(val);
  save();
  renderSettingsLocations();
  input.value = '';
}

function removeLocation(i) {
  state.locations.splice(i, 1);
  save();
  renderSettingsLocations();
}

/* ════════════════════════════════════════════
   Settings modal
   ════════════════════════════════════════════ */

function openSettings() {
  renderSettingsLocations();
  document.getElementById('settings-modal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function closeSettingsOutside(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

/* ════════════════════════════════════════════
   Toast
   ════════════════════════════════════════════ */

let toastTimer;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ════════════════════════════════════════════
   Utilities
   ════════════════════════════════════════════ */

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* ════════════════════════════════════════════
   Google Drive config
   Set your OAuth 2.0 Client ID from Google Cloud Console.
   Authorized JS origins must include the URL where BookStack is hosted.
   ════════════════════════════════════════════ */
const GOOGLE_CLIENT_ID = '352776428431-2l9bk0gjtbdkof13q1dai7pro92749as.apps.googleusercontent.com'; /* ← paste your Client ID here */
const DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file';
let   driveToken       = null;

/* ════════════════════════════════════════════
   Confirm dialog
   ════════════════════════════════════════════ */

let _confirmCallback = null;

function showConfirm(title, message, dangerLabel, onConfirm) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  const btn = document.getElementById('confirm-ok');
  btn.textContent = dangerLabel || 'Conferma';
  _confirmCallback = onConfirm;
  document.getElementById('confirm-modal').classList.add('open');
}

function confirmAction() {
  closeConfirm();
  if (typeof _confirmCallback === 'function') _confirmCallback();
}

function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
  _confirmCallback = null;
}

/* ════════════════════════════════════════════
   Delete all
   ════════════════════════════════════════════ */

function confirmDeleteAll() {
  if (state.collection.length === 0) return showToast('Il catalogo è già vuoto');
  showConfirm(
    'Elimina catalogo',
    `Stai per eliminare tutti i ${state.collection.length} libri dal catalogo. L'operazione è irreversibile.`,
    'Elimina tutto',
    () => {
      state.collection = [];
      state.page = 0;
      save();
      renderCollection();
      showToast('Catalogo eliminato');
    }
  );
}

/* ════════════════════════════════════════════
   CSV export / import
   ════════════════════════════════════════════ */

const CSV_HEADERS = ['id','coverUrl','author','title','year','publisher','isbn','source','location','status','notes','dateAdded'];

function exportCSV() {
  if (state.collection.length === 0) return showToast('Nessun libro da esportare');

  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [
    CSV_HEADERS.join(','),
    ...state.collection.map(b => CSV_HEADERS.map(k => escape(b[k])).join(','))
  ];

  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `bookstack_${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV scaricato');
}

/* ── CSV parser (handles quoted fields) ── */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const parse = line => {
    const cols = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { cols.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  };
  return lines.map(parse);
}

/* ── Import catalog ── */
function importCatalog(event) {
  const file = event.target.files?.[0];
  event.target.value = ''; /* reset so same file can be re-selected */
  if (!file) return;

  const feedback = document.getElementById('import-feedback');
  const show = (msg, type) => {
    feedback.textContent   = msg;
    feedback.className     = `import-feedback ${type}`;
    feedback.style.display = 'block';
  };

  if (!file.name.toLowerCase().endsWith('.csv')) {
    return show('Formato non supportato. Seleziona un file .csv esportato da BookStack.', 'error');
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const rows    = parseCSV(e.target.result.trim());
      const headers = rows[0].map(h => h.trim());

      /* ── Integrity check: all expected headers must be present ── */
      const missing = CSV_HEADERS.filter(h => !headers.includes(h));
      if (missing.length > 0) {
        return show(
          `File non riconosciuto come esportazione BookStack.\nCampi mancanti: ${missing.join(', ')}.`,
          'error'
        );
      }

      /* ── Build index map ── */
      const idx = {};
      headers.forEach((h, i) => idx[h] = i);

      /* ── Parse rows ── */
      const imported = [];
      const errors   = [];

      rows.slice(1).forEach((cols, rowNum) => {
        if (cols.length < 2 || cols.every(c => !c.trim())) return; /* skip blank rows */

        const get = key => (cols[idx[key]] ?? '').trim();
        const isbn  = get('isbn');
        const title = get('title');

        if (!isbn || !title) {
          errors.push(`Riga ${rowNum + 2}: isbn o titolo mancante`);
          return;
        }

        imported.push({
          id:        parseInt(get('id'), 10) || Date.now() + rowNum,
          isbn,
          title,
          author:    get('author')    || '—',
          publisher: get('publisher') || '—',
          year:      get('year')      || '—',
          source:    get('source')    || '',
          location:  get('location')  || 'Non specificato',
          status:    get('status')    || 'Da leggere',
          notes:     get('notes')     || '',
          dateAdded: get('dateAdded') || new Date().toLocaleDateString('it-IT'),
          coverUrl:  get('coverUrl')  || null,
        });
      });

      if (imported.length === 0) {
        return show('Nessun record valido trovato nel file.', 'error');
      }

      /* ── Merge: add only books not already in collection (by ISBN) ── */
      const existingISBNs = new Set(state.collection.map(b => b.isbn));
      const newBooks      = imported.filter(b => !existingISBNs.has(b.isbn));
      const duplicates    = imported.length - newBooks.length;

      state.collection = [...newBooks, ...state.collection];
      state.page = 0;
      save();
      renderCollection();
      closeSettings();

      let msg = `${newBooks.length} libr${newBooks.length === 1 ? 'o importato' : 'i importati'}`;
      if (duplicates > 0) msg += ` · ${duplicates} già presenti (ignorati)`;
      if (errors.length > 0) msg += ` · ${errors.length} righe con errori`;
      show(msg, 'success');
      showToast(`Importazione completata: ${newBooks.length} libri`);

    } catch(err) {
      show('Errore durante la lettura del file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
}

/* ════════════════════════════════════════════
   Google Drive export
   ════════════════════════════════════════════ */

function exportToGoogleDrive() {
  if (state.collection.length === 0) return showToast('Nessun libro da esportare');

  if (!GOOGLE_CLIENT_ID) {
    showConfirm(
      'Client ID non configurato',
      'Per esportare su Google Drive devi inserire il tuo OAuth 2.0 Client ID nel file js/app.js (costante GOOGLE_CLIENT_ID). Consulta la documentazione di Google Cloud Console per crearlo.',
      'Ho capito',
      () => {}
    );
    document.getElementById('confirm-ok').className = 'btn-primary';
    return;
  }

  if (driveToken) {
    uploadToDrive(driveToken);
  } else {
    authenticateGoogle();
  }
}

function authenticateGoogle() {
  const redirectUri = window.location.origin + window.location.pathname;
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(DRIVE_SCOPE)}`;

  const popup = window.open(authUrl, 'google-auth', 'width=500,height=620,left=200,top=100');
  if (!popup) return showToast('Blocca popup disabilitato — consenti i popup per questo sito');

  const timer = setInterval(() => {
    try {
      const href = popup.location.href;
      if (href.includes('access_token=')) {
        clearInterval(timer);
        popup.close();
        const hash   = href.split('#')[1] || '';
        const params = new URLSearchParams(hash);
        driveToken   = params.get('access_token');
        if (driveToken) uploadToDrive(driveToken);
        else showToast('Autenticazione fallita — token non ricevuto');
      }
    } catch(e) { /* Still on Google's domain — cross-origin, ignore */ }

    if (popup.closed) {
      clearInterval(timer);
      if (!driveToken) showToast('Autenticazione annullata');
    }
  }, 400);
}

async function uploadToDrive(token) {
  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    CSV_HEADERS.join(','),
    ...state.collection.map(b => CSV_HEADERS.map(k => escape(b[k])).join(','))
  ];
  const csvContent = rows.join('\r\n');
  const filename   = `bookstack_${new Date().toISOString().slice(0,10)}.csv`;

  /* Multipart upload: metadata + file content */
  const boundary = '-------BookStackBoundary';
  const metadata = JSON.stringify({ name: filename, mimeType: 'text/csv' });
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`,
    `\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\n${csvContent}`,
    `\r\n--${boundary}--`
  ].join('');

  try {
    showToast('Caricamento su Google Drive…');
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`
        },
        body
      }
    );

    if (res.status === 401) {
      driveToken = null; /* Token expired */
      return showToast('Sessione Google scaduta — riprova');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    showToast(`Salvato su Drive: ${data.name}`);
  } catch(err) {
    showToast('Errore Drive: ' + err.message);
  }
}

/* ════════════════════════════════════════════
   Manual entry (new voice)
   ════════════════════════════════════════════ */

let newEntryOpen = false;

function toggleNewEntry(forceClose = false) {
  const form    = document.getElementById('new-entry-form');
  const chevron = document.getElementById('new-entry-chevron');

  if (forceClose || newEntryOpen) {
    newEntryOpen = false;
    form.style.display = 'none';
    chevron.style.transform = 'rotate(0deg)';
    clearNewEntryForm();
  } else {
    newEntryOpen = true;
    form.style.display = 'block';
    chevron.style.transform = 'rotate(180deg)';
    populateNewEntrySelect();
    /* Scroll the form into view smoothly */
    setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
}

function clearNewEntryForm() {
  ['ne-title','ne-author','ne-publisher','ne-year','ne-isbn','ne-cover','ne-location-custom','ne-notes']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const statusEl = document.getElementById('ne-status');
  if (statusEl) statusEl.value = 'Da leggere';
}

function populateNewEntrySelect() {
  const sel = document.getElementById('ne-location');
  if (!sel) return;
  sel.innerHTML =
    '<option value="">Seleziona un luogo…</option>' +
    state.locations.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');
}

function addManualEntry() {
  const title = document.getElementById('ne-title').value.trim();
  if (!title) {
    /* Highlight the required field */
    const titleInput = document.getElementById('ne-title');
    titleInput.style.borderColor = 'var(--red)';
    titleInput.focus();
    setTimeout(() => titleInput.style.borderColor = '', 2000);
    return showToast('Il titolo è obbligatorio');
  }

  const custom   = document.getElementById('ne-location-custom').value.trim();
  const select   = document.getElementById('ne-location').value;
  const location = custom || select || 'Non specificato';

  const entry = {
    id:        Date.now(),
    isbn:      document.getElementById('ne-isbn').value.trim()        || '—',
    title,
    author:    document.getElementById('ne-author').value.trim()      || '—',
    publisher: document.getElementById('ne-publisher').value.trim()   || '—',
    year:      document.getElementById('ne-year').value.trim()        || '—',
    source:    '',   /* no API — left empty */
    location,
    status:    document.getElementById('ne-status').value,
    notes:     document.getElementById('ne-notes').value.trim()       || '',
    dateAdded: new Date().toLocaleDateString('it-IT'),
    coverUrl:  document.getElementById('ne-cover').value.trim()       || null,
  };

  state.collection.unshift(entry);
  state.page = 0;
  save();
  renderCollection();
  toggleNewEntry(true);   /* close and reset form */
  showToast(`"${title}" aggiunto alla collezione`);
}

/* ── Init ── */

document.addEventListener('DOMContentLoaded', () => {
  renderCollection();
});