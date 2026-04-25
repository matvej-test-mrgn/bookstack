/* ════════════════════════════════════════════
   BookStack — api.js
   Cascade search: Google Books → Open Library → SBN OPAC
   Also retrieves cover URLs where available.
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

  /* Google sometimes returns http:// — force https */
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

/* ── 2. Open Library ── */
async function searchOpenLibrary(isbn) {
  const res = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return null;
  const data = await res.json();

  const book = data[`ISBN:${isbn}`];
  if (!book?.title) return null;

  /* Cover: Open Library returns direct CDN URLs in the data response */
  const coverUrl = book.cover?.medium || book.cover?.small || book.cover?.large || null;

  return {
    title:     book.title,
    author:    (book.authors    || []).map(a => a.name).join(', ') || '—',
    publisher: (book.publishers || []).map(p => p.name).join(', ') || '—',
    year:      book.publish_date?.match(/\d{4}/)?.[0] || '—',
    coverUrl,
    source:    'Open Library'
  };
}

/* ── 3. SBN OPAC (via CORS proxy, HTML scraping) ── */
async function searchSBN(isbn) {
  const sbnUrl   = `https://opac.sbn.it/opacsbn/opaclib?db=solr_remote&ricerca=SI&resultForward=opac%2Fopen-search.jsp&Text1=${isbn}&Indice1=ISBN&NumRec=1&lang=IT`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(sbnUrl)}`;

  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.contents) return null;

  const parser = new DOMParser();
  const doc    = parser.parseFromString(data.contents, 'text/html');

  /* SBN OPAC does not expose cover images in its search results */
  const titleEl =
    doc.querySelector('.titoloCard')       ||
    doc.querySelector('.risultatoTitolo')  ||
    doc.querySelector('span.title')        ||
    doc.querySelector('td.td_titolo')      ||
    [...doc.querySelectorAll('td')].find(td => td.className?.includes('titol'));

  if (!titleEl) return null;
  const title = titleEl.textContent.trim();
  if (!title) return null;

  const authorEl    = doc.querySelector('.autoreCard')  || doc.querySelector('td.td_autore');
  const publisherEl = doc.querySelector('.editoreCard') || doc.querySelector('td.td_editore');
  const yearEl      = doc.querySelector('.annoCard')    || doc.querySelector('td.td_anno');

  return {
    title,
    author:    authorEl?.textContent.trim()                   || '—',
    publisher: publisherEl?.textContent.trim()                || '—',
    year:      yearEl?.textContent.trim().match(/\d{4}/)?.[0] || '—',
    coverUrl:  null,   /* SBN does not provide cover images */
    source:    'SBN'
  };
}

/* ════════════════════════════════════════════
   Loading UI
   ════════════════════════════════════════════ */

const API_STEPS = [
  { label: 'Google Books'  },
  { label: 'Open Library'  },
  { label: 'Catalogo SBN'  }
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

  try { setSearchLoading(0); result = await searchGoogleBooks(isbn); } catch(e) {}
  if (!result) { try { setSearchLoading(1); result = await searchOpenLibrary(isbn); } catch(e) {} }
  if (!result) { try { setSearchLoading(2); result = await searchSBN(isbn);         } catch(e) {} }

  setSearchLoading(null);

  if (!result) return showToast('Nessun risultato trovato nelle fonti disponibili');

  /* Expose result to app.js */
  onSearchResult({ ...result, isbn: raw });
}
