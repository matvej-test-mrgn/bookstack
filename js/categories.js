/* ════════════════════════════════════════════
   BookStack — categories.js
   Category & tag management.
   Depends on: app.js (state, save, escHtml, showToast)
   ════════════════════════════════════════════ */

/* ── Pastel palette ── */
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

/* ── Init ── */
function initCategories() {
  if (!state.categories) {
    var stored = localStorage.getItem('bookstack_categories');
    state.categories = stored ? JSON.parse(stored) : deepCopy(DEFAULT_CATEGORIES);
  }
}
if (typeof state !== 'undefined') { initCategories(); }

function saveCategories() {
  localStorage.setItem('bookstack_categories', JSON.stringify(state.categories));
}

function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

function getCategoryByName(name) {
  if (!name || !state.categories) return null;
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].name === name) return state.categories[i];
  }
  return null;
}

/* ════════════════════════════════════════════
   Dropdown population
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
   Tag visibility on category change
   ════════════════════════════════════════════ */
function onCategoryChange(prefix) {
  var sel     = document.getElementById(prefix + '-category');
  var tagWrap = document.getElementById(prefix + '-tags-wrap');
  if (!sel || !tagWrap) return;
  tagWrap.style.display = sel.value ? 'block' : 'none';
}

/* ════════════════════════════════════════════
   Book item visuals
   ════════════════════════════════════════════ */
function categoryStyle(categoryName) {
  var cat = getCategoryByName(categoryName);
  if (!cat) return '';
  return 'background:' + cat.bg + ';';
}

function categoryPillHTML(book) {
  if (!book.category) return '';
  var cat  = getCategoryByName(book.category);
  var bg   = cat ? cat.bg   : '#F0EDE7';
  var text = cat ? cat.text : '#6B6860';
  return '<span class="category-pill" style="background:' + bg + ';color:' + text
    + ';border-color:' + text + '20;">' + escHtml(book.category) + '</span>';
}

/* ════════════════════════════════════════════
   Settings panel — category list with
   inline colour picker per category
   ════════════════════════════════════════════ */

/* Which category index has the colour picker open (-1 = none) */
var _openColorPickerIdx  = -1;
/* Which category index is being renamed (-1 = none) */
var _renamingCategoryIdx = -1;

function renderSettingsCategories() {
  var container = document.getElementById('settings-category-list');
  if (!container) return;

  container.innerHTML = (state.categories || []).map(function(c, i) {
    var pickerOpen  = (_openColorPickerIdx  === i);
    var isRenaming  = (_renamingCategoryIdx === i);

    var swatchesHTML = pickerOpen
      ? '<div class="cat-color-picker">'
        + PASTEL_PALETTE.map(function(p, pi) {
            var isCurrent = (c.bg === p.bg);
            return '<button type="button"'
              + ' class="color-swatch' + (isCurrent ? ' swatch-selected' : '') + '"'
              + ' style="background:' + p.bg + '; border-color:' + p.text + ';"'
              + ' title="' + escHtml(p.name) + '"'
              + ' onclick="pickCategoryColor(' + i + ',' + pi + ')"></button>';
          }).join('')
        + '</div>'
      : '';

    var nameHTML = isRenaming
      ? '<input type="text" class="rename-input" id="rename-cat-' + i + '" value="' + escHtml(c.name) + '"'
        + ' onkeydown="if(event.key===\'Enter\') confirmRenameCategory(' + i + '); if(event.key===\'Escape\') cancelRename(\'category\');"'
        + ' />'
        + '<button class="btn-action btn-confirm-rename" onclick="confirmRenameCategory(' + i + ')" title="Conferma">✓</button>'
        + '<button class="btn-action btn-cancel-rename" onclick="cancelRename(\'category\')" title="Annulla">✕</button>'
      : '<span>' + escHtml(c.name) + '</span>'
        + '<button class="btn-action btn-edit" onclick="startRenameCategory(' + i + ')" title="Rinomina">' + EDIT_SVG + '</button>'
        + '<button class="btn-action btn-delete" onclick="removeCategory(' + i + ')" title="Rimuovi">'
        + '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
        + '<path d="M4 4l12 12M16 4L4 16"/></svg></button>';

    return '<div class="category-settings-item' + (pickerOpen ? ' picker-open' : '') + '">'
      + '<button type="button" class="cat-color-btn" title="Cambia colore"'
      + '  style="background:' + c.bg + '; border-color:' + c.text + ';"'
      + '  onclick="toggleColorPicker(' + i + ')"></button>'
      + nameHTML
      + '</div>'
      + swatchesHTML;
  }).join('');

  /* Focus rename input if active */
  if (_renamingCategoryIdx !== -1) {
    var inp = document.getElementById('rename-cat-' + _renamingCategoryIdx);
    if (inp) { inp.focus(); inp.select(); }
  }
}

function startRenameCategory(i) {
  _openColorPickerIdx  = -1;
  _renamingCategoryIdx = i;
  renderSettingsCategories();
}

function confirmRenameCategory(i) {
  var inp = document.getElementById('rename-cat-' + i);
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) return showToast('Il nome non può essere vuoto');
  if (newName === state.categories[i].name) { _renamingCategoryIdx = -1; renderSettingsCategories(); return; }
  if (getCategoryByName(newName)) return showToast('Categoria già esistente');

  var oldName = state.categories[i].name;
  state.categories[i].name = newName;
  saveCategories();

  /* Global rename across collection */
  state.collection.forEach(function(b) {
    if (b.category === oldName) b.category = newName;
  });
  if (typeof save === 'function') save();

  _renamingCategoryIdx = -1;
  renderSettingsCategories();
  if (typeof renderCollection === 'function') renderCollection();
  showToast('"' + oldName + '" → "' + newName + '"');
}

function toggleColorPicker(idx) {
  _openColorPickerIdx = (_openColorPickerIdx === idx) ? -1 : idx;
  renderSettingsCategories();
}

function pickCategoryColor(catIdx, paletteIdx) {
  var swatch = PASTEL_PALETTE[paletteIdx];
  state.categories[catIdx].bg   = swatch.bg;
  state.categories[catIdx].text = swatch.text;
  saveCategories();
  _openColorPickerIdx = -1;   /* close picker after picking */
  renderSettingsCategories();
  /* Refresh collection so book-item backgrounds update immediately */
  if (typeof renderCollection === 'function') renderCollection();
}

function removeCategory(i) {
  if (_openColorPickerIdx  === i) _openColorPickerIdx  = -1;
  if (_renamingCategoryIdx === i) _renamingCategoryIdx = -1;
  state.categories.splice(i, 1);
  saveCategories();
  renderSettingsCategories();
}

/* ════════════════════════════════════════════
   Settings panel — add new category
   (colour can be changed after adding via the
    inline picker on the category row)
   ════════════════════════════════════════════ */
function addCategoryFromSettings() {
  var input = document.getElementById('new-category-name-input');
  var name  = input.value.trim();
  if (!name) return showToast('Inserisci un nome per la categoria');
  if (getCategoryByName(name)) return showToast('Categoria già presente');

  /* Pick a palette colour not already in use, or cycle through */
  var usedBgs = (state.categories || []).map(function(c){ return c.bg; });
  var swatch  = PASTEL_PALETTE[0];
  for (var i = 0; i < PASTEL_PALETTE.length; i++) {
    if (usedBgs.indexOf(PASTEL_PALETTE[i].bg) === -1) { swatch = PASTEL_PALETTE[i]; break; }
  }

  var newCat = { id: 'cat_' + Date.now(), name: name, bg: swatch.bg, text: swatch.text };
  state.categories.push(newCat);
  saveCategories();
  renderSettingsCategories();
  input.value = '';
  showToast('"' + name + '" aggiunta — tocca il pallino per cambiare colore');
}