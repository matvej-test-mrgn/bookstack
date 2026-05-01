/* ════════════════════════════════════════════
   BookStack — api.js
   Cascade search: Google Books → Open Library Search → Open Library ISBN
   ════════════════════════════════════════════ */

/* ── 1. Google Books ── */
async function searchGoogleBooks(isbn) {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
    { signal: AbortSignal.timeout(6000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;

  const info = data.items[0].volumeInfo;
  if (!info.title) return null;

  const rawCover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  const coverUrl = rawCover ? rawCover.replace(/^http:\/\//, 'https://') : null;

  return {
    title:     info.title,
    author:    (info.authors || []).join(', ') || '—',
    publisher: info.publisher || '—',
    year:      info.publishedDate?.substring(0, 4) || '—',
    coverUrl,
    source:    'Google Books'
  };
}

/* ── 2. Open Library — Search endpoint (more reliable than /api/books) ── */
async function searchOpenLibrary(isbn) {
  const res = await fetch(
    `https://openlibrary.org/search.json?isbn=${isbn}&limit=1`
    + `&fields=title,author_name,publisher,first_publish_year,cover_i`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();

  const doc = data.docs?.[0];
  if (!doc?.title) return null;

  const coverUrl = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
    : null;

  return {
    title:     doc.title,
    author:    (doc.author_name || []).join(', ') || '—',
    publisher: (doc.publisher   || []).join(', ') || '—',
    year:      doc.first_publish_year?.toString() || '—',
    coverUrl,
    source:    'Open Library'
  };
}

/* ── 3. Open Library — Direct ISBN lookup (different data, richer for Italian editions) ── */
async function searchOpenLibraryISBN(isbn) {
  const res = await fetch(
    `https://openlibrary.org/isbn/${isbn}.json`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const book = await res.json();
  if (!book?.title) return null;

  /* Cover from covers array */
  const coverUrl = book.covers?.length
    ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-M.jpg`
    : null;

  /* Year from publish_date string e.g. "2019", "January 1, 2019" */
  const year = book.publish_date?.match(/\d{4}/)?.[0] || '—';

  /* Author: attempt to resolve the first /authors/{key}.json — short timeout */
  let author = '—';
  if (book.authors?.length) {
    try {
      const authorKey = book.authors[0].key; // e.g. "/authors/OL123A"
      const ar = await fetch(
        `https://openlibrary.org${authorKey}.json`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (ar.ok) {
        const ad = await ar.json();
        if (ad.name) author = ad.name;
      }
    } catch(e) { /* leave as '—' */ }
  }

  return {
    title:     book.title,
    author,
    publisher: (book.publishers || []).join(', ') || '—',
    year,
    coverUrl,
    source:    'Open Library (ISBN)'
  };
}

/* ════════════════════════════════════════════
   Loading UI
   ════════════════════════════════════════════ */

const API_STEPS = [
  { label: 'Google Books'   },
  { label: 'Open Library'   },
  { label: 'Open Library +'  }
];

function setSearchLoading(step) {
  const btn   = document.getElementById('btn-search');
  const input = document.getElementById('isbn-input');

  if (step === null) {
    btn.disabled    = false;
    btn.textContent = 'Cerca libro';
    input.disabled  = false;
    const el = document.getElementById('search-status');
    if (el) el.remove();
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Ricerca in corso…';
  input.disabled  = true;

  let el = document.getElementById('search-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'search-status';
    el.style.cssText = 'padding: 0.75rem 0 0;';
    btn.parentElement.insertAdjacentElement('afterend', el);
  }

  el.innerHTML = `<div class="source-steps">${
    API_STEPS.map((s, i) => {
      const done   = i < step;
      const active = i === step;
      return `<div class="source-step ${done ? 'done' : active ? 'active' : ''}">
        <div class="dot"></div>
        <span>${s.label}</span>
        ${active ? '<div class="spinner" style="margin-left:4px;"></div>' : ''}
        ${done   ? '<span class="check">✓</span>' : ''}
      </div>`;
    }).join('')
  }</div>`;
}

/* ════════════════════════════════════════════
   Auto-open new entry form with ISBN pre-filled
   Called when all sources return no result.
   ════════════════════════════════════════════ */
function openNewEntryWithISBN(isbn) {
  /* Ensure the "Crea una nuova voce" section is open */
  if (typeof newEntryOpen !== 'undefined' && !newEntryOpen) {
    if (typeof toggleNewEntry === 'function') toggleNewEntry();
  }

  /* Pre-fill ISBN field */
  setTimeout(function() {
    var isbnField = document.getElementById('ne-isbn');
    if (isbnField) {
      isbnField.value = isbn;
      /* Highlight field briefly to draw attention */
      isbnField.style.borderColor = 'var(--accent)';
      setTimeout(function(){ isbnField.style.borderColor = ''; }, 2000);
    }
    /* Scroll form into view */
    var form = document.getElementById('new-entry-form');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80); /* slight delay to allow form to render */
}

/* ════════════════════════════════════════════
   Main search entry point
   (called by both manual input and camera scan)
   ════════════════════════════════════════════ */
async function searchISBN() {
  const raw = document.getElementById('isbn-input').value.trim();
  if (!raw) return showToast('Inserisci un codice ISBN');

  const isbn = raw.replace(/[^0-9X]/gi, '');
  if (isbn.length !== 10 && isbn.length !== 13)
    return showToast('ISBN non valido (10 o 13 cifre)');

  let result = null;

  try { setSearchLoading(0); result = await searchGoogleBooks(isbn);       } catch(e) {}
  if (!result) { try { setSearchLoading(1); result = await searchOpenLibrary(isbn);    } catch(e) {} }
  if (!result) { try { setSearchLoading(2); result = await searchOpenLibraryISBN(isbn);} catch(e) {} }

  setSearchLoading(null);

  if (!result) {
    showToast('Nessun risultato. Inserire manualmente i dettagli del volume.');
    openNewEntryWithISBN(raw);
    return;
  }

  onSearchResult({ ...result, isbn: raw });
}
