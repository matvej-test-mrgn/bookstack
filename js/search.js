/* ════════════════════════════════════════════
   BookStack — search.js
   Loaded after app.js. Uses state, escHtml,
   renderCollection defined in app.js.
   ════════════════════════════════════════════ */

var searchState = {
  query:   '',
  sortBy:  'dateAdded_desc',
  filters: { status: [], location: [] }
};

/* ── Parse Italian date dd/mm/yyyy to timestamp ── */
function parseDateIt(s) {
  if (!s) return 0;
  var p = String(s).split('/');
  if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]).getTime();
  return new Date(s).getTime() || 0;
}

/* ════════════════════════════════════════════
   Returns filtered + sorted collection array.
   Called by renderCollection() in app.js.
   ════════════════════════════════════════════ */
function getDisplayCollection() {
  var col = state.collection.slice();

  /* Free-text search */
  var q = searchState.query.trim().toLowerCase();
  if (q) {
    col = col.filter(function(b) {
      return ['author','title','year','publisher','isbn','location'].some(function(k) {
        return String(b[k] || '').toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  /* Status filter */
  if (searchState.filters.status.length > 0) {
    col = col.filter(function(b) {
      return searchState.filters.status.indexOf(b.status) !== -1;
    });
  }

  /* Location filter */
  if (searchState.filters.location.length > 0) {
    col = col.filter(function(b) {
      return searchState.filters.location.indexOf(b.location) !== -1;
    });
  }

  /* Sort */
  col.sort(function(a, b) {
    switch (searchState.sortBy) {
      case 'dateAdded_desc': return parseDateIt(b.dateAdded) - parseDateIt(a.dateAdded);
      case 'dateAdded_asc':  return parseDateIt(a.dateAdded) - parseDateIt(b.dateAdded);
      case 'title_asc':      return String(a.title||'').localeCompare(String(b.title||''),'it');
      case 'author_asc':     return String(a.author||'').localeCompare(String(b.author||''),'it');
      case 'year_desc':      return (parseInt(b.year,10)||0) - (parseInt(a.year,10)||0);
      case 'year_asc':       return (parseInt(a.year,10)||0) - (parseInt(b.year,10)||0);
      default:               return 0;
    }
  });

  return col;
}

/* ════════════════════════════════════════════
   Search
   ════════════════════════════════════════════ */
function onSearchInput(value) {
  searchState.query = value;
  state.page = 0;
  renderCollection();
  /* Show/hide clear button */
  var clr = document.getElementById('search-clear');
  if (clr) clr.style.display = value.length > 0 ? 'flex' : 'none';
}

function clearSearch() {
  searchState.query = '';
  var inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  var clr = document.getElementById('search-clear');
  if (clr) clr.style.display = 'none';
  state.page = 0;
  renderCollection();
}

/* ════════════════════════════════════════════
   Sort
   ════════════════════════════════════════════ */
function onSortChange(value) {
  searchState.sortBy = value;
  state.page = 0;
  renderCollection();
}

/* ════════════════════════════════════════════
   Filter modal
   ════════════════════════════════════════════ */
function openFilterModal() {
  renderFilterModal();
  document.getElementById('filter-modal').classList.add('open');
}

function closeFilterModal() {
  document.getElementById('filter-modal').classList.remove('open');
}

function closeFilterOutside(e) {
  if (e.target === document.getElementById('filter-modal')) closeFilterModal();
}

function renderFilterModal() {
  var STATUSES = ['Letto','In lettura','Da leggere','Sospeso'];

  document.getElementById('filter-status-list').innerHTML = STATUSES.map(function(s) {
    var chk = searchState.filters.status.indexOf(s) !== -1 ? ' checked' : '';
    return '<label class="filter-check"><input type="checkbox" value="' + escHtml(s) + '"' + chk
      + ' onchange="toggleFilter(\'status\',this.value,this.checked)"><span>' + escHtml(s) + '</span></label>';
  }).join('');

  var locs = [];
  state.collection.forEach(function(b) {
    if (b.location && locs.indexOf(b.location) === -1) locs.push(b.location);
  });
  locs.sort(function(a,b){ return a.localeCompare(b,'it'); });

  document.getElementById('filter-location-list').innerHTML = locs.length
    ? locs.map(function(l) {
        var chk = searchState.filters.location.indexOf(l) !== -1 ? ' checked' : '';
        return '<label class="filter-check"><input type="checkbox" value="' + escHtml(l) + '"' + chk
          + ' onchange="toggleFilter(\'location\',this.value,this.checked)"><span>' + escHtml(l) + '</span></label>';
      }).join('')
    : '<span class="filter-empty-note">Nessun luogo assegnato in catalogo</span>';

  updateFilterBadge();
}

function toggleFilter(type, value, checked) {
  var arr = searchState.filters[type];
  var idx = arr.indexOf(value);
  if (checked && idx === -1)  arr.push(value);
  if (!checked && idx !== -1) arr.splice(idx,1);
  state.page = 0;
  renderCollection();
  updateFilterBadge();
}

function clearFilters() {
  searchState.filters.status   = [];
  searchState.filters.location = [];
  state.page = 0;
  renderCollection();
  renderFilterModal();
}

function updateFilterBadge() {
  var count = searchState.filters.status.length + searchState.filters.location.length;
  var badge = document.getElementById('filter-badge');
  if (!badge) return;
  badge.textContent   = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}