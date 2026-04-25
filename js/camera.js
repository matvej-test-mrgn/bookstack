/* ════════════════════════════════════════════
   BookStack — camera.js
   Barcode scanning via ZXing BrowserMultiFormatReader.
   On successful ISBN read → triggers searchISBN() via manual tab.
   ════════════════════════════════════════════ */

let codeReader  = null;
let cameraActive = false;

function toggleCamera() {
  cameraActive ? stopCamera() : startCamera();
}

async function startCamera() {
  const btn     = document.getElementById('btn-camera-toggle');
  const status  = document.getElementById('camera-status');
  const video   = document.getElementById('camera-video');
  const idle    = document.getElementById('camera-idle');
  const overlay = document.getElementById('scan-overlay');

  try {
    status.textContent = 'Avvio fotocamera…';
    status.className   = 'camera-status';
    btn.disabled       = true;

    if (typeof ZXing === 'undefined')
      throw new Error('Libreria ZXing non disponibile. Controlla la connessione.');

    codeReader = new ZXing.BrowserMultiFormatReader();

    /* Prefer rear camera on mobile */
    const constraints = {
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;
    await video.play();

    idle.style.display    = 'none';
    video.style.display   = 'block';
    overlay.style.display = 'flex';
    cameraActive          = true;
    btn.disabled          = false;
    btn.textContent       = 'Interrompi scansione';
    status.textContent    = 'Inquadra il codice a barre del libro';
    status.className      = 'camera-status active';

    /* Decode loop — fires callback on every decoded frame */
    codeReader.decodeFromStream(stream, video, (result, err) => {
      if (!result) return;

      const raw   = result.getText();
      const clean = raw.replace(/[^0-9X]/gi, '');

      /* Accept only ISBN-10 or ISBN-13 */
      if (clean.length !== 10 && clean.length !== 13) return;

      stopCamera();

      /* Hand off to manual tab and trigger search */
      document.getElementById('isbn-input').value = raw;
      switchTab('manual');
      showToast('Codice rilevato — ricerca in corso');
      searchISBN();
    });

  } catch(err) {
    let msg = 'Impossibile avviare la fotocamera.';
    if (err.name === 'NotAllowedError')
      msg = 'Accesso alla fotocamera negato. Controlla i permessi del browser.';
    else if (err.name === 'NotFoundError')
      msg = 'Nessuna fotocamera trovata su questo dispositivo.';
    else if (err.message)
      msg = err.message;

    status.textContent = msg;
    status.className   = 'camera-status error';
    btn.disabled       = false;
    btn.textContent    = 'Riprova';
    cameraActive       = false;
  }
}

function stopCamera() {
  const video   = document.getElementById('camera-video');
  const idle    = document.getElementById('camera-idle');
  const overlay = document.getElementById('scan-overlay');
  const status  = document.getElementById('camera-status');
  const btn     = document.getElementById('btn-camera-toggle');

  if (codeReader) {
    try { codeReader.reset(); } catch(e) {}
    codeReader = null;
  }

  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  video.style.display   = 'none';
  overlay.style.display = 'none';
  idle.style.display    = 'flex';
  cameraActive          = false;
  btn.disabled          = false;
  btn.textContent       = 'Attiva fotocamera';
  status.textContent    = 'Fotocamera non attiva';
  status.className      = 'camera-status';
}
