/* ════════════════════════════════════════════
   BookStack — app.js
   ════════════════════════════════════════════ */

var DEFAULT_LOCATIONS = ['Scaffale studio', 'Camera da letto', 'Soggiorno'];

var state = {
  collection: JSON.parse(localStorage.getItem('bookstack_collection') || '[]'),
  locations:  JSON.parse(localStorage.getItem('bookstack_locations')  || 'null') || DEFAULT_LOCATIONS.slice(),
  categories: null,   /* initialised by categories.js initCategories() */
  currentBook: null,
  editingId:   null,
  page:        0,
  perPage:     10
};

function save() {
  localStorage.setItem('bookstack_collection', JSON.stringify(state.collection));
  localStorage.setItem('bookstack_locations',  JSON.stringify(state.locations));
  /* categories persisted separately by saveCategories() in categories.js */
}

/* ── API callback ── */
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

  var sourceEl  = document.getElementById('r-source');
  var sourceMap = { 'Google Books':'source-google', 'Open Library':'source-openlibrary', 'Open Library (ISBN)':'source-openlibrary' };
  if (book.source) {
    sourceEl.textContent   = book.source;
    sourceEl.className     = 'tag ' + (sourceMap[book.source] || '');
    sourceEl.style.display = '';
  } else {
    sourceEl.style.display = 'none';
  }

  populateLocationSelect('r-location', '');
  if (typeof populateCategorySelect === 'function') populateCategorySelect('r-category', '');

  var section = document.getElementById('result-section');
  section.classList.add('visible');
  section.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function dismissResult() {
  document.getElementById('result-section').classList.remove('visible');
  document.getElementById('isbn-input').value = '';
  state.currentBook = null;
}

function addToCollection() {
  if (!state.currentBook) return;
  var location = document.getElementById('r-location').value || 'Non specificato';
  var entry = Object.assign({}, state.currentBook, {
    location:  location,
    status:    document.getElementById('r-status').value,
    notes:     document.getElementById('r-notes').value.trim(),
    category:  document.getElementById('r-category').value || '',
    tags:      document.getElementById('r-tags').value.trim(),
    dateAdded: new Date().toLocaleDateString('it-IT'),
    id:        Date.now()
  });
  state.collection.unshift(entry);
  state.page = 0;
  save();
  renderCollection();
  dismissResult();
  showToast('Libro aggiunto alla collezione');
}

/* ════════════════════════════════════════════
   Custom location — inline add + save to settings
   prefix: 'r' | 'ne' | 'ed'
   ════════════════════════════════════════════ */
function toggleCustomLocation(prefix) {
  var wrap = document.getElementById(prefix + '-location-custom-wrap');
  var inp  = document.getElementById(prefix + '-location-custom');
  var isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) { inp.value = ''; inp.focus(); }
}

function confirmCustomLocation(prefix) {
  var inp = document.getElementById(prefix + '-location-custom');
  var val = inp.value.trim();
  if (!val) return showToast('Inserisci un nome per il luogo');

  /* Save to settings if not already present */
  if (state.locations.indexOf(val) === -1) {
    state.locations.push(val);
    save();
    /* Refresh settings list if modal is open */
    var settingsOpen = document.getElementById('settings-modal').classList.contains('open');
    if (settingsOpen) renderSettingsLocations();
  }

  /* Refresh all location dropdowns and select the new value */
  var selIds = ['r-location', 'ne-location', 'ed-location'];
  selIds.forEach(function(id) { populateLocationSelect(id, ''); });
  var sel = document.getElementById(prefix + '-location');
  sel.value = val;

  /* Close the inline input */
  document.getElementById(prefix + '-location-custom-wrap').style.display = 'none';
  inp.value = '';
  showToast('"' + val + '" aggiunto ai luoghi');
}

/* ════════════════════════════════════════════
   Collection rendering
   ════════════════════════════════════════════ */

var STATUS_CLASS = {
  'Letto':'status-letto', 'In lettura':'status-in-lettura',
  'Da leggere':'status-da-leggere', 'Sospeso':'status-sospeso'
};

var EDIT_SVG   = '<img src="svg/edit.svg" width="14" height="14" alt="Modifica" style="display:block;opacity:0.55;">';
var DELETE_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg>';

/* Empty state rendered as pure HTML — avoids detached-element bugs entirely */
function emptyStateHTML(isFiltered) {
  var msg = isFiltered
    ? 'Nessun risultato.<br>Prova a modificare la ricerca o i filtri.'
    : 'Nessun libro presente.<br>Scansiona o inserisci un ISBN per aggiungere libri al catalogo.';
  return '<div class="collection-empty">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"'
    + ' stroke-linecap="round" stroke-linejoin="round"'
    + ' style="display:block;width:32px;height:32px;opacity:0.3;margin:0 auto 0.75rem;">'
    + '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>'
    + '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'
    + '</svg>' + msg + '</div>';
}

function renderCollection() {
  var list       = document.getElementById('collection-list');
  var pagination = document.getElementById('pagination');

  document.getElementById('collection-count').textContent = state.collection.length;

  /* Delegate filtering/sorting to search.js if loaded */
  var display = (typeof getDisplayCollection === 'function')
    ? getDisplayCollection()
    : state.collection.slice();

  var isFiltered = (typeof searchState !== 'undefined') && (
    searchState.query.trim() !== '' ||
    searchState.filters.status.length > 0 ||
    searchState.filters.location.length > 0 ||
    (searchState.filters.category && searchState.filters.category.length > 0)
  );

  if (display.length === 0) {
    list.innerHTML           = emptyStateHTML(isFiltered);
    pagination.style.display = 'none';
    if (typeof updateResultsCount === 'function') updateResultsCount(0);
    return;
  }

  var total      = display.length;
  var totalPages = Math.ceil(total / state.perPage);
  state.page     = Math.min(state.page, totalPages - 1);

  var start = state.page * state.perPage;
  var end   = Math.min(start + state.perPage, total);
  list.innerHTML = display.slice(start, end).map(bookItemHTML).join('');

  if (typeof updateResultsCount === 'function') updateResultsCount(total);

  if (totalPages > 1) {
    pagination.style.display = 'flex';
    document.getElementById('page-info').textContent = (state.page + 1) + ' / ' + totalPages;
    document.getElementById('page-prev').disabled    = state.page === 0;
    document.getElementById('page-next').disabled    = state.page === totalPages - 1;
  } else {
    pagination.style.display = 'none';
  }
}

function bookItemHTML(book) {
  var coverHTML = book.coverUrl
    ? '<img class="book-cover-img" src="' + escHtml(book.coverUrl)
      + '" alt="Copertina" loading="lazy" onerror="this.replaceWith(buildSpine('
      + JSON.stringify(escHtml(book.title)) + '))">'
    : '<div class="book-spine">' + escHtml(book.title) + '</div>';

  var catStyle = (typeof categoryStyle === 'function') ? categoryStyle(book.category) : '';
  var catClass = book.category ? ' has-category' : '';
  var catHTML  = (typeof categoryPillHTML === 'function') ? categoryPillHTML(book) : '';

  return '<div class="book-item' + catClass + '" style="' + catStyle + '">'
    + coverHTML
    + '<div class="book-info">'
    + '<div class="book-item-title">' + escHtml(book.title) + '</div>'
    + '<div class="book-item-meta">'  + escHtml(book.author) + ' · ' + escHtml(book.year) + '</div>'
    + '<div class="book-item-footer">'
    + '<span class="status-pill ' + (STATUS_CLASS[book.status]||'') + '">' + escHtml(book.status) + '</span>'
    + '<span class="location-pill">' + escHtml(book.location) + '</span>'
    + catHTML
    + '</div></div>'
    + '<div class="book-actions">'
    + '<button class="btn-action btn-edit"   onclick="openEdit('   + book.id + ')" title="Modifica">' + EDIT_SVG   + '</button>'
    + '<button class="btn-action btn-delete" onclick="deleteBook(' + book.id + ')" title="Rimuovi">'  + DELETE_SVG + '</button>'
    + '</div></div>';
}

function buildSpine(title) {
  var div = document.createElement('div');
  div.className   = 'book-spine';
  div.textContent = title;
  return div;
}

function deleteBook(id) {
  state.collection = state.collection.filter(function(b){ return b.id !== id; });
  save();
  renderCollection();
  showToast('Libro rimosso');
}

/* ════════════════════════════════════════════
   Pagination
   ════════════════════════════════════════════ */
function changePage(delta) {
  var display    = (typeof getDisplayCollection === 'function') ? getDisplayCollection() : state.collection;
  var totalPages = Math.ceil(display.length / state.perPage);
  state.page     = Math.max(0, Math.min(state.page + delta, totalPages - 1));
  renderCollection();
  document.getElementById('collection-list').scrollIntoView({ behavior:'smooth', block:'start' });
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
  if (tab === 'manual' && typeof cameraActive !== 'undefined' && cameraActive) stopCamera();
}

/* ════════════════════════════════════════════
   Locations
   ════════════════════════════════════════════ */
function populateLocationSelect(selectId, currentValue) {
  var sel = document.getElementById(selectId || 'r-location');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleziona un luogo…</option>'
    + state.locations.map(function(l) {
        return '<option value="' + escHtml(l) + '"'
          + (l === currentValue ? ' selected' : '') + '>' + escHtml(l) + '</option>';
      }).join('');
}

function renderSettingsLocations() {
  document.getElementById('settings-location-list').innerHTML =
    state.locations.map(function(l, i) {
      return '<div class="location-item"><div class="loc-dot"></div><span>' + escHtml(l) + '</span>'
        + '<button class="btn-action btn-delete" onclick="removeLocation(' + i + ')" title="Rimuovi">' + DELETE_SVG + '</button></div>';
    }).join('');
}

function addLocation() {
  var input = document.getElementById('new-location-input');
  var val   = input.value.trim();
  if (!val) return;
  if (state.locations.indexOf(val) !== -1) return showToast('Luogo già presente');
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
  if (typeof renderSettingsCategories === 'function') renderSettingsCategories();
  document.getElementById('settings-modal').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}
function closeSettingsOutside(e) {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
}

/* ════════════════════════════════════════════
   Edit modal
   ════════════════════════════════════════════ */
function openEdit(id) {
  var book = null;
  for (var i = 0; i < state.collection.length; i++) {
    if (state.collection[i].id === id) { book = state.collection[i]; break; }
  }
  if (!book) return;
  state.editingId = id;

  document.getElementById('ed-title').value     = book.title     || '';
  document.getElementById('ed-author').value    = book.author    !== '—' ? (book.author    || '') : '';
  document.getElementById('ed-publisher').value = book.publisher !== '—' ? (book.publisher || '') : '';
  document.getElementById('ed-year').value      = book.year      !== '—' ? (book.year      || '') : '';
  document.getElementById('ed-isbn').value      = book.isbn      !== '—' ? (book.isbn      || '') : '';
  document.getElementById('ed-cover').value     = book.coverUrl  || '';
  document.getElementById('ed-notes').value     = book.notes     || '';
  document.getElementById('ed-status').value    = book.status    || 'Da leggere';
  document.getElementById('ed-location-custom').value = '';

  /* Category & tags */
  if (typeof populateCategorySelect === 'function') {
    populateCategorySelect('ed-category', book.category || '');
  }
  document.getElementById('ed-tags').value = book.tags || '';
  var edTagWrap = document.getElementById('ed-tags-wrap');
  if (edTagWrap) edTagWrap.style.display = book.category ? 'block' : 'none';

  var inList = state.locations.indexOf(book.location) !== -1;
  /* If location isn't in the list yet, add it silently so the dropdown can select it */
  if (!inList && book.location && book.location !== 'Non specificato') {
    state.locations.push(book.location);
    save();
  }
  populateLocationSelect('ed-location', book.location);

  document.getElementById('edit-modal').classList.add('open');
}

function closeEdit() {
  document.getElementById('edit-modal').classList.remove('open');
  state.editingId = null;
}
function closeEditOutside(e) {
  if (e.target === document.getElementById('edit-modal')) closeEdit();
}

function saveEdit() {
  if (state.editingId === null) return;
  var title = document.getElementById('ed-title').value.trim();
  if (!title) {
    var el = document.getElementById('ed-title');
    el.style.borderColor = 'var(--red)';
    el.focus();
    setTimeout(function(){ el.style.borderColor = ''; }, 2000);
    return showToast('Il titolo è obbligatorio');
  }
  var location = document.getElementById('ed-location').value || 'Non specificato';

  var idx = -1;
  for (var i = 0; i < state.collection.length; i++) {
    if (state.collection[i].id === state.editingId) { idx = i; break; }
  }
  if (idx === -1) return;

  state.collection[idx] = Object.assign({}, state.collection[idx], {
    title:     title,
    author:    document.getElementById('ed-author').value.trim()    || '—',
    publisher: document.getElementById('ed-publisher').value.trim() || '—',
    year:      document.getElementById('ed-year').value.trim()      || '—',
    isbn:      document.getElementById('ed-isbn').value.trim()      || '—',
    coverUrl:  document.getElementById('ed-cover').value.trim()     || null,
    location:  location,
    status:    document.getElementById('ed-status').value,
    notes:     document.getElementById('ed-notes').value.trim()     || '',
    category:  document.getElementById('ed-category').value         || '',
    tags:      document.getElementById('ed-tags').value.trim()      || ''
  });

  save();
  renderCollection();
  closeEdit();
  showToast('Modifiche salvate');
}

/* ════════════════════════════════════════════
   Confirm modal — keyed action registry
   ════════════════════════════════════════════ */
var CONFIRM_ACTIONS = {};

function showConfirm(title, message, dangerLabel, actionKey) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  var btn = document.getElementById('confirm-ok');
  btn.textContent    = dangerLabel || 'Conferma';
  btn.dataset.action = actionKey;
  document.getElementById('confirm-modal').classList.add('open');
}

function confirmAction() {
  var key = document.getElementById('confirm-ok').dataset.action;
  closeConfirm();
  if (key && CONFIRM_ACTIONS[key]) { CONFIRM_ACTIONS[key](); delete CONFIRM_ACTIONS[key]; }
}

function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
  var btn = document.getElementById('confirm-ok');
  if (btn) btn.dataset.action = '';
}

function confirmDeleteAll() {
  if (state.collection.length === 0) return showToast('Il catalogo è già vuoto');
  var key = 'deleteAll';
  CONFIRM_ACTIONS[key] = function() {
    state.collection = [];
    state.page = 0;
    save();
    renderCollection();
    showToast('Catalogo eliminato');
  };
  showConfirm(
    'Elimina catalogo',
    'Stai per eliminare tutti i ' + state.collection.length + ' libri. L\'operazione è irreversibile.',
    'Elimina tutto',
    key
  );
}

/* ════════════════════════════════════════════
   CSV export / import
   ════════════════════════════════════════════ */
var CSV_HEADERS = ['id','coverUrl','author','title','year','publisher','isbn','source','location','status','notes','dateAdded','category','tags'];

function csvEscape(v) {
  var s = String(v == null ? '' : v);
  return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
    ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function exportCSV() {
  if (state.collection.length === 0) return showToast('Nessun libro da esportare');
  var rows = [CSV_HEADERS.join(',')].concat(
    state.collection.map(function(b){ return CSV_HEADERS.map(function(k){ return csvEscape(b[k]); }).join(','); })
  );
  var blob = new Blob([rows.join('\r\n')], { type:'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'bookstack_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV scaricato');
}

function parseCSV(text) {
  var lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  return lines.map(function(line) {
    var cols=[], cur='', inQ=false;
    for (var i=0; i<line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch==='"' && line[i+1]==='"') { cur+='"'; i++; }
        else if (ch==='"') inQ=false;
        else cur+=ch;
      } else {
        if (ch==='"') inQ=true;
        else if (ch===',') { cols.push(cur); cur=''; }
        else cur+=ch;
      }
    }
    cols.push(cur); return cols;
  });
}

function importCatalog(event) {
  var file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  var feedback = document.getElementById('import-feedback');
  function show(msg,type){ feedback.textContent=msg; feedback.className='import-feedback '+type; feedback.style.display='block'; }
  if (!file.name.toLowerCase().endsWith('.csv')) return show('Formato non supportato. Seleziona un .csv esportato da BookStack.','error');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var rows    = parseCSV(e.target.result.trim());
      var headers = rows[0].map(function(h){ return h.trim(); });
      var missing = CSV_HEADERS.filter(function(h){ return headers.indexOf(h)===-1; });
      if (missing.length>0) return show('File non riconosciuto. Campi mancanti: '+missing.join(', ')+'.','error');
      var idx={};
      headers.forEach(function(h,i){ idx[h]=i; });
      var imported=[], errors=[];
      rows.slice(1).forEach(function(cols,rowNum) {
        if (cols.length<2 || cols.every(function(c){ return !c.trim(); })) return;
        function get(k){ return (cols[idx[k]]||'').trim(); }
        var isbn=get('isbn'), title=get('title');
        if (!isbn||!title){ errors.push('Riga '+(rowNum+2)); return; }
        imported.push({ id:parseInt(get('id'),10)||Date.now()+rowNum, isbn:isbn, title:title,
          author:get('author')||'—', publisher:get('publisher')||'—', year:get('year')||'—',
          source:get('source')||'', location:get('location')||'Non specificato',
          status:get('status')||'Da leggere', notes:get('notes')||'',
          dateAdded:get('dateAdded')||new Date().toLocaleDateString('it-IT'), coverUrl:get('coverUrl')||null });
      });
      if (imported.length===0) return show('Nessun record valido trovato.','error');
      var existing={};
      state.collection.forEach(function(b){ existing[b.isbn]=true; });
      var newBooks   = imported.filter(function(b){ return !existing[b.isbn]; });
      var duplicates = imported.length - newBooks.length;
      state.collection = newBooks.concat(state.collection);
      state.page=0; save(); renderCollection(); closeSettings();
      var msg = newBooks.length+(newBooks.length===1?' libro importato':' libri importati');
      if (duplicates>0) msg+=' · '+duplicates+' già presenti (ignorati)';
      if (errors.length>0) msg+=' · '+errors.length+' righe con errori';
      show(msg,'success');
      showToast('Importazione completata: '+newBooks.length+' libri');
    } catch(err){ show('Errore: '+err.message,'error'); }
  };
  reader.readAsText(file,'utf-8');
}

/* ════════════════════════════════════════════
   Google Drive export
   ════════════════════════════════════════════ */
var GOOGLE_CLIENT_ID = '';
var DRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.file';
var driveToken       = null;

function exportToGoogleDrive() {
  if (state.collection.length===0) return showToast('Nessun libro da esportare');
  if (!GOOGLE_CLIENT_ID) return showToast('Client ID Google non configurato in js/app.js');
  if (driveToken) uploadToDrive(driveToken); else authenticateGoogle();
}

function authenticateGoogle() {
  var redirectUri = window.location.origin + window.location.pathname;
  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=token&scope=' + encodeURIComponent(DRIVE_SCOPE);
  var popup = window.open(authUrl,'google-auth','width=500,height=620,left=200,top=100');
  if (!popup) return showToast('Abilita i popup per autenticarti con Google');
  var timer = setInterval(function() {
    try {
      var href = popup.location.href;
      if (href.indexOf('access_token=')!==-1) {
        clearInterval(timer); popup.close();
        var params = new URLSearchParams((href.split('#')[1]||''));
        driveToken = params.get('access_token');
        if (driveToken) uploadToDrive(driveToken);
        else showToast('Autenticazione fallita');
      }
    } catch(e){}
    if (popup.closed){ clearInterval(timer); if (!driveToken) showToast('Autenticazione annullata'); }
  },400);
}

async function uploadToDrive(token) {
  var rows = [CSV_HEADERS.join(',')].concat(state.collection.map(function(b){ return CSV_HEADERS.map(function(k){ return csvEscape(b[k]); }).join(','); }));
  var csvContent = rows.join('\r\n');
  var filename   = 'bookstack_'+new Date().toISOString().slice(0,10)+'.csv';
  var boundary   = '-------BookStackBoundary';
  var metadata   = JSON.stringify({ name:filename, mimeType:'text/csv' });
  var body = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata
           + '\r\n--'+boundary+'\r\nContent-Type: text/csv\r\n\r\n'+csvContent
           + '\r\n--'+boundary+'--';
  try {
    showToast('Caricamento su Google Drive…');
    var res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'multipart/related; boundary="'+boundary+'"'},
      body:body
    });
    if (res.status===401){ driveToken=null; return showToast('Sessione Google scaduta — riprova'); }
    if (!res.ok) throw new Error('HTTP '+res.status);
    var data = await res.json();
    showToast('Salvato su Drive: '+data.name);
  } catch(err){ showToast('Errore Drive: '+err.message); }
}

/* ════════════════════════════════════════════
   Manual entry
   ════════════════════════════════════════════ */
var newEntryOpen = false;

function toggleNewEntry(forceClose) {
  var form    = document.getElementById('new-entry-form');
  var chevron = document.getElementById('new-entry-chevron');
  if (forceClose || newEntryOpen) {
    newEntryOpen=false; form.style.display='none'; chevron.style.transform='rotate(0deg)'; clearNewEntryForm();
  } else {
    newEntryOpen=true; form.style.display='block'; chevron.style.transform='rotate(180deg)';
    populateLocationSelect('ne-location','');
    if (typeof populateCategorySelect === 'function') populateCategorySelect('ne-category', '');
    setTimeout(function(){ form.scrollIntoView({ behavior:'smooth', block:'nearest' }); },50);
  }
}

function clearNewEntryForm() {
  ['ne-title','ne-author','ne-publisher','ne-year','ne-isbn','ne-cover','ne-location-custom','ne-notes'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var s=document.getElementById('ne-status'); if(s) s.value='Da leggere';
}

function addManualEntry() {
  var title = document.getElementById('ne-title').value.trim();
  if (!title) {
    var el=document.getElementById('ne-title'); el.style.borderColor='var(--red)'; el.focus();
    setTimeout(function(){ el.style.borderColor=''; },2000);
    return showToast('Il titolo è obbligatorio');
  }
  var location = document.getElementById('ne-location').value || 'Non specificato';
  var entry = {
    id:Date.now(), isbn:document.getElementById('ne-isbn').value.trim()||'—', title:title,
    author:document.getElementById('ne-author').value.trim()||'—',
    publisher:document.getElementById('ne-publisher').value.trim()||'—',
    year:document.getElementById('ne-year').value.trim()||'—',
    source:'', location:location, status:document.getElementById('ne-status').value,
    notes:document.getElementById('ne-notes').value.trim()||'',
    category:document.getElementById('ne-category').value||'',
    tags:document.getElementById('ne-tags').value.trim()||'',
    dateAdded:new Date().toLocaleDateString('it-IT'),
    coverUrl:document.getElementById('ne-cover').value.trim()||null
  };
  state.collection.unshift(entry); state.page=0; save(); renderCollection();
  toggleNewEntry(true);
  showToast('"'+title+'" aggiunto alla collezione');
}

/* ════════════════════════════════════════════
   Toast
   ════════════════════════════════════════════ */
var _toastTimer;
function showToast(msg) {
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){ t.classList.remove('show'); },2400);
}

/* ════════════════════════════════════════════
   Utilities
   ════════════════════════════════════════════ */
function escHtml(s) {
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* ════════════════════════════════════════════
   Init
   ════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  if (typeof initCategories === 'function') initCategories();
  renderCollection();
});