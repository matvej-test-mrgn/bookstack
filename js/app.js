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
   Init
   ════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  renderCollection();
});
