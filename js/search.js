/* ════════════════════════════════════════════
   BookStack — search.js
   Text search, filter state, sorting.
   Exposes getDisplayCollection() used by
   renderCollection() in app.js.
   ════════════════════════════════════════════ */

var searchState = {
  query:   '',
  sort:    'date-desc',   /* default: most recently added first */
  filters: {
    status:   [],   /* empty = all statuses */
    location: []    /* empty = all locations */
  }
};

var SEARCH_FIELDS = ['title', 'author', 'year', 'publisher', 'isbn', 'location'];

/* ── Returns a filtered + sorted copy of state.collection ── */
function getDisplayCollection() {
  var col = state.collection.slice();

  /* 1 — Text search across key fields */
  var q = searchState.query.trim().toLowerCase();
  if (q) {
    col = col.filter(function(b) {
      return SEARCH_FIELDS.some(function(f) {
        return String(b[f] || '').toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  /* 2 — Status filter */
  if (searchState.filters.status.length > 0) {
    col = col.filter(function(b) {
      return searchState.filters.status.indexOf(b.status) !== -1;
    });
  }

  /* 3 — Location filter */
  if (searchState.filters.location.length > 0) {
    col = col.filter(function(b) {
      return searchState.filters.location.indexOf(b.location) !== -1;
    });
  }

  /* 4 — Sort */
  col.sort(function(a, b) {
    switch (searchState.sort) {
      case 'date-desc':  return b.id - a.id;
      case 'date-asc':   return a.id - b.id;
      case 'title-asc':  return String(a.title  || '').localeCompare(String(b.title  || ''), 'it');
      case 'author-asc': return String(a.author || '').localeCompare(String(b.author || ''), 'it');
      case 'year-desc':  return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
      case 'year-asc':   return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
      default:           return b.id - a.id;
    }
  });

  return col;
}

/* ── Called when the user types in the search bar ── */
function onSearchInput(value) {
  searchState.query = value;
  state.page = 0;
  renderCollection();
  updateSearchClearBtn();
}

function clearSearch() {
  searchState.query = '';
  document.getElementById('collection-search').value = '';
  state.page = 0;
  renderCollection();
  updateSearchClearBtn();
}

function updateSearchClearBtn() {
  var btn = document.getElementById('search-clear-btn');
  if (btn) btn.style.display = searchState.query ? 'flex' : 'none';
}

/* ── Sort ── */
function onSortChange(value) {
  searchState.sort = value;
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

/* Collect unique locations from current collection */
function uniqueLocations() {
  var seen = {}, result = [];
  state.collection.forEach(function(b) {
    if (b.location && !seen[b.location]) { seen[b.location] = true; result.push(b.location); }
  });
  return result.sort();
}

function renderFilterModal() {
  var statuses  = ['Letto', 'In lettura', 'Da leggere', 'Sospeso'];
  var locations = uniqueLocations();

  var html = '';

  /* Active filter count badge */
  var activeCount = searchState.filters.status.length + searchState.filters.location.length;

  /* Status checkboxes */
  html += '<div class="filter-group"><div class="filter-group-label">Stato di lettura</div><div class="filter-options">';
  statuses.forEach(function(s) {
    var checked = searchState.filters.status.indexOf(s) !== -1 ? 'checked' : '';
    html += '<label class="filter-check"><input type="checkbox" value="' + escHtml(s) + '" '
          + checked + ' onchange="toggleFilterStatus(this.value, this.checked)"><span>' + escHtml(s) + '</span></label>';
  });
  html += '</div></div>';

  /* Location checkboxes — only if there are locations */
  if (locations.length > 0) {
    html += '<div class="filter-group"><div class="filter-group-label">Luogo</div><div class="filter-options">';
    locations.forEach(function(l) {
      var checked = searchState.filters.location.indexOf(l) !== -1 ? 'checked' : '';
      html += '<label class="filter-check"><input type="checkbox" value="' + escHtml(l) + '" '
            + checked + ' onchange="toggleFilterLocation(this.value, this.checked)"><span>' + escHtml(l) + '</span></label>';
    });
    html += '</div></div>';
  }

  document.getElementById('filter-modal-body').innerHTML = html;

  /* Update filter button badge */
  var badge = document.getElementById('filter-badge');
  if (badge) {
    badge.textContent    = activeCount;
    badge.style.display  = activeCount > 0 ? 'inline-flex' : 'none';
  }
}

function toggleFilterStatus(value, checked) {
  var arr = searchState.filters.status;
  var idx = arr.indexOf(value);
  if (checked && idx === -1) arr.push(value);
  if (!checked && idx !== -1) arr.splice(idx, 1);
  state.page = 0;
  renderCollection();
  updateFilterBadge();
}

function toggleFilterLocation(value, checked) {
  var arr = searchState.filters.location;
  var idx = arr.indexOf(value);
  if (checked && idx === -1) arr.push(value);
  if (!checked && idx !== -1) arr.splice(idx, 1);
  state.page = 0;
  renderCollection();
  updateFilterBadge();
}

function resetFilters() {
  searchState.filters.status   = [];
  searchState.filters.location = [];
  state.page = 0;
  renderCollection();
  renderFilterModal();   /* re-render checkboxes unchecked */
  updateFilterBadge();
}

function updateFilterBadge() {
  var count = searchState.filters.status.length + searchState.filters.location.length;
  var badge = document.getElementById('filter-badge');
  if (badge) {
    badge.textContent   = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}