/* ════════════════════════════════════════════
   BookStack — categories.js
   Category & tag management.
   Depends on: app.js (state, save, escHtml, showToast,
               renderSettingsLocations-style pattern)
   ════════════════════════════════════════════ */

/* ── Pastel palette for the color picker ── */
var PASTEL_PALETTE = [
  { name: 'Lavanda', bg: '#EDE9F8', text: '#5B4A8A' },
  { name: 'Menta',   bg: '#E6F4EC', text: '#2E7D52' },
  { name: 'Cielo',   bg: '#E3EEF8', text: '#1A5C8A' },
  { name: 'Pesca',   bg: '#F8EDE6', text: '#8A4A2E' },
  { name: 'Sole',    bg: '#F8F4E3', text: '#7A6020' },
  { name: 'Rosa',    bg: '#F8E6EE', text: '#8A2E5B' },
  { name: 'Salvia',  bg: '#E6F0EB', text: '#2E5E42' },
  { name: 'Sabbia',  bg: '#F5F0E6', text: '#6B5A3A' },
  { name: 'Lilla',   bg: '#F0E6F8', text: '#6A2E8A' },
  { name: 'Acqua',   bg: '#E3F3F8', text: '#1A6878' }
];

/* ── Default categories ── */
var DEFAULT_CATEGORIES = [
  { id: 'cat_poesia',     name: 'Poesia',      bg: '#EDE9F8', text: '#5B4A8A' },
  { id: 'cat_narrativa',  name: 'Narrativa',   bg: '#E6F4EC', text: '#2E7D52' },
  { id: 'cat_saggistica', name: 'Saggistica',  bg: '#E3EEF8', text: '#1A5C8A' },
  { id: 'cat_misc',       name: 'Miscellanea', bg: '#F5F0E6', text: '#6B5A3A' }
];

/* ── Initialise categories on state (called from app.js init) ── */
function initCategories() {
  if (!state.categories) {
    var stored = localStorage.getItem('bookstack_categories');
    state.categories = stored ? JSON.parse(stored) : deepCopy(DEFAULT_CATEGORIES);
  }
}

/* Auto-initialise as soon as categories.js is parsed (fixes timing issue
   where DOMContentLoaded in app.js fires before categories.js is ready) */
if (typeof state !== 'undefined') { initCategories(); }

function saveCategories() {
  localStorage.setItem('bookstack_categories', JSON.stringify(state.categories));
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* ── Look up a category by name ── */
function getCategoryByName(name) {
  if (!name || !state.categories) return null;
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].name === name) return state.categories[i];
  }
  return null;
}

/* ════════════════════════════════════════════
   Dropdown population
   prefix: 'r' | 'ne' | 'ed'
   ════════════════════════════════════════════ */
function populateCategorySelect(selectId, currentValue) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Nessuna categoria</option>'
    + (state.categories || []).map(function(c) {
        return '<option value="' + escHtml(c.name) + '"'
          + (c.name === currentValue ? ' selected' : '') + '>'
          + escHtml(c.name) + '</option>';
      }).join('');
}

/* ════════════════════════════════════════════
   Inline "add custom category" (edit-icon trigger)
   prefix: 'r' | 'ne' | 'ed'
   ════════════════════════════════════════════ */

/* Selected swatch per prefix */
var _selectedSwatch = {};

function toggleCustomCategory(prefix) {
  var wrap = document.getElementById(prefix + '-category-custom-wrap');
  var isOpen = wrap.style.display !== 'none';
  wrap.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    document.getElementById(prefix + '-category-custom-name').value = '';
    _selectedSwatch[prefix] = PASTEL_PALETTE[0];
    renderSwatches(prefix);
  }
}

function renderSwatches(prefix) {
  var container = document.getElementById(prefix + '-swatches');
  if (!container) return;
  container.innerHTML = PASTEL_PALETTE.map(function(p, i) {
    var selected = (_selectedSwatch[prefix] && _selectedSwatch[prefix].bg === p.bg) ? ' swatch-selected' : '';
    return '<button type="button" class="color-swatch' + selected + '"'
      + ' style="background:' + p.bg + '; border-color:' + p.text + ';"'
      + ' title="' + escHtml(p.name) + '"'
      + ' onclick="selectSwatch(\'' + prefix + '\',' + i + ')"></button>';
  }).join('');
}

function selectSwatch(prefix, index) {
  _selectedSwatch[prefix] = PASTEL_PALETTE[index];
  renderSwatches(prefix);
}

function confirmCustomCategory(prefix) {
  var nameInput = document.getElementById(prefix + '-category-custom-name');
  var name = nameInput.value.trim();
  if (!name) return showToast('Inserisci un nome per la categoria');

  var existing = getCategoryByName(name);
  if (!existing) {
    var swatch = _selectedSwatch[prefix] || PASTEL_PALETTE[0];
    var newCat = { id: 'cat_' + Date.now(), name: name, bg: swatch.bg, text: swatch.text };
    state.categories.push(newCat);
    saveCategories();
    if (document.getElementById('settings-modal').classList.contains('open')) {
      renderSettingsCategories();
    }
  }

  /* Refresh all category dropdowns */
  ['r','ne','ed'].forEach(function(p) {
    populateCategorySelect(p + '-category', p === prefix ? name : null);
  });
  var sel = document.getElementById(prefix + '-category');
  if (sel) sel.value = name;

  document.getElementById(prefix + '-category-custom-wrap').style.display = 'none';
  showToast('"' + name + '" aggiunta alle categorie');
}

/* ════════════════════════════════════════════
   Tag input — show/hide based on category selection
   ════════════════════════════════════════════ */
function onCategoryChange(prefix) {
  var sel     = document.getElementById(prefix + '-category');
  var tagWrap = document.getElementById(prefix + '-tags-wrap');
  if (!sel || !tagWrap) return;
  tagWrap.style.display = sel.value ? 'block' : 'none';
}

/* ════════════════════════════════════════════
   Settings — category list
   ════════════════════════════════════════════ */
function renderSettingsCategories() {
  var container = document.getElementById('settings-category-list');
  if (!container) return;

  container.innerHTML = (state.categories || []).map(function(c, i) {
    return '<div class="category-settings-item">'
      + '<div class="category-color-dot" style="background:' + c.bg + '; border-color:' + c.text + ';"></div>'
      + '<span>' + escHtml(c.name) + '</span>'
      + '<button class="btn-action btn-delete" onclick="removeCategory(' + i + ')" title="Rimuovi">'
      + '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg>'
      + '</button></div>';
  }).join('');
}

function removeCategory(i) {
  state.categories.splice(i, 1);
  saveCategories();
  renderSettingsCategories();
}

/* ════════════════════════════════════════════
   Book item visual — category background
   Returns inline style string for the book-item div
   ════════════════════════════════════════════ */
function categoryStyle(categoryName) {
  var cat = getCategoryByName(categoryName);
  if (!cat) return '';
  return 'background:' + cat.bg + ';';
}

/* Returns HTML for category pill only (tags are CSV-only, not shown in list) */
function categoryPillHTML(book) {
  if (!book.category) return '';
  var cat = getCategoryByName(book.category);
  var bg   = cat ? cat.bg   : '#F0EDE7';
  var text = cat ? cat.text : '#6B6860';

  return '<span class="category-pill" style="background:' + bg + ';color:' + text + ';border-color:' + text + '20;">'
    + escHtml(book.category) + '</span>';
}

/* ── Settings panel: add category from the main settings modal ── */
var _settingsSwatch = PASTEL_PALETTE[0];

function initSettingsSwatches() {
  var container = document.getElementById('settings-swatches');
  if (!container) return;
  _settingsSwatch = PASTEL_PALETTE[0];
  container.innerHTML = PASTEL_PALETTE.map(function(p, i) {
    var sel = (p.bg === _settingsSwatch.bg) ? ' swatch-selected' : '';
    return '<button type="button" class="color-swatch' + sel + '"'
      + ' style="background:' + p.bg + '; border-color:' + p.text + ';"'
      + ' title="' + escHtml(p.name) + '"'
      + ' onclick="pickSettingsSwatch(' + i + ')"></button>';
  }).join('');
}

function pickSettingsSwatch(index) {
  _settingsSwatch = PASTEL_PALETTE[index];
  initSettingsSwatches();
}

function addCategoryFromSettings() {
  var input = document.getElementById('new-category-name-input');
  var name  = input.value.trim();
  if (!name) return showToast('Inserisci un nome per la categoria');
  if (getCategoryByName(name)) return showToast('Categoria già presente');
  var swatch = _settingsSwatch || PASTEL_PALETTE[0];
  state.categories.push({ id: 'cat_' + Date.now(), name: name, bg: swatch.bg, text: swatch.text });
  saveCategories();
  renderSettingsCategories();
  initSettingsSwatches();
  input.value = '';
  showToast('"' + name + '" aggiunta');
}