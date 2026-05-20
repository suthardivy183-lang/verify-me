'use strict';

/* ─── Asli — vanilla JS app ─── */

const API_BASE = (window.ASLI_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// ─── Firebase config ──────────────────────────────────────────────────────────
// Firebase configuration is now dynamically injected into window.asliFirebaseConfig
// from frontend/index.html.

let _firebaseReady = false;
let auth = null;
let db   = null;

// Use window.asliFirebaseConfig if available and not using placeholder values
if (window.asliFirebaseConfig && window.asliFirebaseConfig.apiKey && window.asliFirebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY') {
  try {
    firebase.initializeApp(window.asliFirebaseConfig);
    auth = firebase.auth();
    db   = firebase.firestore();
    _firebaseReady = true;
  } catch (e) {
    // Firebase unavailable — guest-only mode, scan flow unaffected
    console.warn('Firebase init skipped (invalid config or SDK error):', e.message);
  }
} else {
  console.warn('Firebase init skipped (configuration not found or using placeholder).');
}

// ─── i18n strings ──────────────────────────────────────────────────────────
const i18n = {
  hi: {
    hero: 'असली या नक़ली?',
    subhero: 'सेकंडों में पहचानें। मुफ़्त, आपकी भाषा में।',
    dropzone: 'तस्वीर यहाँ छोड़ें',
    dropzone_hint: 'या क्लिक करके चुनें (JPG, PNG)',
    or: 'या',
    camera: 'कैमरा खोलें',
    confidence_label: 'विश्वास स्तर',
    explanation_label: 'विश्लेषण',
    redflags_label: 'संकेत',
    tip_label: 'अगली बार के लिए सीखें',
    scan_another: 'और जाँचें',
    share: 'शेयर करें',
    evaluate: 'जाँच शुरू करें',
    change_image: 'बदलें',
    footer: 'Google Solution Challenge 2026 के लिए बनाया गया',
    error_title: 'कुछ ग़लत हो गया',
    error_network: 'सर्वर से जुड़ नहीं सके। कृपया दोबारा कोशिश करें।',
    retry: 'दोबारा कोशिश करें',
    scan_status: ['Pixels जाँच रहे हैं…', 'AI से विश्लेषण…', 'व्याख्या तैयार हो रही है…'],
    relang_status: ['भाषा बदली जा रही है…', 'व्याख्या नई भाषा में तैयार हो रही है…'],
    verdict: { Asli: 'असली', Nakli: 'नक़ली', 'Shak hai': 'शक़ है' },
    confidence_text: {
      Asli: 'असली होने का विश्वास',
      Nakli: 'नक़ली होने का विश्वास',
      'Shak hai': 'अनिश्चित',
    },
    share_text: 'मैंने Asli से एक तस्वीर जाँची — verdict: {verdict}. आप भी जाँचें: https://asli-solution-challenge.web.app',
    font_class: 'font-deva',
  },
  gu: {
    hero: 'અસલી કે નકલી?',
    subhero: 'સેકન્ડમાં જાણો. મફત, તમારી ભાષામાં.',
    dropzone: 'તસવીર અહીં મૂકો',
    dropzone_hint: 'અથવા ક્લિક કરીને પસંદ કરો (JPG, PNG)',
    or: 'અથવા',
    camera: 'કેમેરા ખોલો',
    confidence_label: 'વિશ્વાસ સ્તર',
    explanation_label: 'વિશ્લેષણ',
    redflags_label: 'સંકેતો',
    tip_label: 'આગલી વખત માટે શીખો',
    scan_another: 'બીજી તસવીર',
    share: 'શેર કરો',
    evaluate: 'તપાસ શરૂ કરો',
    change_image: 'બદલો',
    footer: 'Google Solution Challenge 2026 માટે બનાવ્યું',
    error_title: 'કંઈક ખોટું થયું',
    error_network: 'સર્વર સાથે જોડાઈ શકાયું નથી. કૃપા કરીને ફરી પ્રયાસ કરો.',
    retry: 'ફરી પ્રયાસ કરો',
    scan_status: ['Pixels તપાસી રહ્યા છીએ…', 'AI થી વિશ્લેષણ…', 'સમજૂતી તૈયાર થઈ રહી છે…'],
    relang_status: ['ભાષા બદલાઈ રહી છે…', 'સમજૂતી નવી ભાષામાં તૈયાર થઈ રહી છે…'],
    verdict: { Asli: 'અસલી', Nakli: 'નકલી', 'Shak hai': 'શંકા છે' },
    confidence_text: {
      Asli: 'અસલી હોવાનો વિશ્વાસ',
      Nakli: 'નકલી હોવાનો વિશ્વાસ',
      'Shak hai': 'અનિશ્ચિત',
    },
    share_text: 'મેં Asli થી તસવીર તપાસી — verdict: {verdict}. તમે પણ તપાસો: https://asli-solution-challenge.web.app',
    font_class: 'font-guja',
  },
  en: {
    hero: 'Real or fake?',
    subhero: 'Know in seconds. Free, in your language.',
    dropzone: 'Drop image here',
    dropzone_hint: 'or click to upload (JPG, PNG)',
    or: 'or',
    camera: 'Take a photo',
    confidence_label: 'Confidence',
    explanation_label: 'Explanation',
    redflags_label: 'Signals',
    tip_label: 'Learn for next time',
    scan_another: 'Scan another',
    share: 'Share',
    evaluate: 'Evaluate this image',
    change_image: 'Change',
    footer: 'Built for Google Solution Challenge 2026',
    error_title: 'Something went wrong',
    error_network: "Couldn't reach the server. Please try again.",
    retry: 'Try again',
    scan_status: ['Checking pixels…', 'Analyzing with AI…', 'Generating explanation…'],
    relang_status: ['Switching language…', 'Re-generating explanation in your language…'],
    verdict: { Asli: 'Real', Nakli: 'Fake', 'Shak hai': 'Suspicious' },
    confidence_text: {
      Asli: 'confidence this is real',
      Nakli: 'confidence this is fake',
      'Shak hai': 'uncertain',
    },
    share_text: 'I checked an image with Asli — verdict: {verdict}. Check yours: https://asli-solution-challenge.web.app',
    font_class: '',
  },
};

const VERDICT_STYLES = {
  Asli:       { bg: 'bg-asli-green', dot: 'bg-asli-green', icon: 'check-circle-2' },
  Nakli:      { bg: 'bg-nakli-red',  dot: 'bg-nakli-red',  icon: 'x-circle' },
  'Shak hai': { bg: 'bg-shak-amber', dot: 'bg-shak-amber', icon: 'help-circle' },
};

const LOCALIZED_TEXT_IDS = [
  'hero', 'subhero', 'dropzone-text', 'dropzone-hint', 'or-text', 'camera-text',
  'evaluate-text', 'change-image-text',
  'confidence-label-i18n', 'explanation-label', 'redflags-label', 'tip-label',
  'scan-another-text', 'share-text', 'footer-text', 'error-title', 'retry-text',
];

// ─── State ─────────────────────────────────────────────────────────────────
const state = {
  screen: 'upload',
  language: detectLanguage(),
  selectedFile: null,
  imagePreviewUrl: null,
  result: null,
  errorMessage: null,
  scanIntervalHandle: null,
};

// Current scan snapshot — populated by renderResult(), consumed by downloadReport()
let currentScan = null;

function detectLanguage() {
  // Returning users keep their chosen language; new accounts/guests
  // default to English (changeable anytime in Settings).
  const stored = localStorage.getItem('asli_lang');
  if (stored && i18n[stored]) return stored;
  return 'en';
}

// ─── DOM helpers ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function applyScriptFont(el, lang) {
  if (!el) return;
  el.classList.remove('font-deva', 'font-guja');
  const cls = i18n[lang].font_class;
  if (cls) el.classList.add(cls);
}

// ─── Language application ────────────────────────────────────────────────
function applyLanguage() {
  const t = i18n[state.language];
  setText('hero', t.hero);
  setText('subhero', t.subhero);
  setText('dropzone-text', t.dropzone);
  setText('dropzone-hint', t.dropzone_hint);
  setText('or-text', t.or);
  setText('camera-text', t.camera);
  setText('confidence-label-i18n', t.confidence_label);
  setText('explanation-label', t.explanation_label);
  setText('redflags-label', t.redflags_label);
  setText('tip-label', t.tip_label);
  setText('scan-another-text', t.scan_another);
  setText('share-text', t.share);
  setText('evaluate-text', t.evaluate);
  setText('change-image-text', t.change_image);
  setText('footer-text', t.footer);
  setText('error-title', t.error_title);
  setText('retry-text', t.retry);

  LOCALIZED_TEXT_IDS.forEach(id => applyScriptFont($(id), state.language));

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const active = btn.dataset.lang === state.language;
    btn.classList.toggle('bg-asli-text', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-asli-muted', !active);
  });

  document.documentElement.lang =
    state.language === 'hi' ? 'hi' : state.language === 'gu' ? 'gu' : 'en';
}

// ─── Screen switching ────────────────────────────────────────────────────
function showScreen(name) {
  ['upload', 'scanning', 'result', 'error'].forEach(s => {
    $(`screen-${s}`).classList.toggle('hidden', s !== name);
  });
  state.screen = name;
  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Upload sub-state switching (pick ↔ ready) ───────────────────────────
function showPickState() {
  $('upload-pick').classList.remove('hidden');
  $('upload-ready').classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function showReadyState(file) {
  $('preview-image').src = state.imagePreviewUrl;
  setText('preview-filename',
    (file.name || 'image').replace(/^.*[\\/]/, '').slice(0, 40));
  $('upload-pick').classList.add('hidden');
  $('upload-ready').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function selectFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    state.errorMessage = 'Please pick an image file (JPG or PNG).';
    setText('error-message', state.errorMessage);
    showScreen('error');
    return;
  }
  state.selectedFile = file;
  if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
  state.imagePreviewUrl = URL.createObjectURL(file);
  showReadyState(file);
}

function clearSelection() {
  state.selectedFile = null;
  if (state.imagePreviewUrl) {
    URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = null;
  }
  $('file-input').value = '';
  $('camera-input').value = '';
  showPickState();
}

// ─── Scanning status rotator ─────────────────────────────────────────────
function startScanStatusRotation(messageKey = 'scan_status') {
  const statuses = i18n[state.language][messageKey];
  let idx = 0;
  setText('scan-status', statuses[0]);
  applyScriptFont($('scan-status'), state.language);
  state.scanIntervalHandle = setInterval(() => {
    idx = (idx + 1) % statuses.length;
    setText('scan-status', statuses[idx]);
  }, 1200);
}

function stopScanStatusRotation() {
  if (state.scanIntervalHandle) {
    clearInterval(state.scanIntervalHandle);
    state.scanIntervalHandle = null;
  }
}

// ─── API call ────────────────────────────────────────────────────────────
async function uploadAndScan(file, opts = {}) {
  // opts.language overrides state.language for this single call (used when
  //   re-fetching after the user toggled the language on the result screen)
  // opts.statusKey selects which rotating-status array to display
  const file_ok = file && file.type && file.type.startsWith('image/');
  if (!file_ok) {
    state.errorMessage = 'Please pick an image file (JPG or PNG).';
    setText('error-message', state.errorMessage);
    showScreen('error');
    return;
  }

  const language = opts.language || state.language;
  const statusKey = opts.statusKey || 'scan_status';

  // Make sure the preview URL is fresh (we may be re-fetching the same file).
  if (!state.imagePreviewUrl || state.selectedFile !== file) {
    if (state.imagePreviewUrl) URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = URL.createObjectURL(file);
  }
  state.selectedFile = file;
  $('scanning-image').src = state.imagePreviewUrl;

  showScreen('scanning');
  startScanStatusRotation(statusKey);

  const formData = new FormData();
  formData.append('image', file);
  formData.append('target_language', language);

  try {
    const response = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status} — ${errBody.slice(0, 160)}`);
    }
    const data = await response.json();
    state.result = data;
    stopScanStatusRotation();
    renderResult();
    // Fire-and-forget — never block the result display
    if (_firebaseReady) {
      saveScanToHistory(data, file);
      incrementGlobalStats(data.verdict);
    }
  } catch (err) {
    stopScanStatusRotation();
    const t = i18n[state.language];
    state.errorMessage = err && err.message ? err.message : t.error_network;
    setText('error-message', state.errorMessage);
    showScreen('error');
  }
}

// ─── Result rendering ────────────────────────────────────────────────────
function renderResult() {
  const r = state.result;
  if (!r) return;
  const t = i18n[state.language];
  const verdictKey = r.verdict in VERDICT_STYLES ? r.verdict : 'Shak hai';
  const styles = VERDICT_STYLES[verdictKey];

  // Verdict badge
  const badge = $('verdict-badge');
  badge.className = `rounded-2xl p-6 text-center mb-5 ${styles.bg} text-white shadow-lg`;
  $('verdict-icon').innerHTML =
    `<i data-lucide="${styles.icon}" class="w-9 h-9 text-white"></i>`;
  setText('verdict-label', t.verdict[verdictKey] || verdictKey);
  applyScriptFont($('verdict-label'), state.language);
  setText('confidence-text',
    `${r.confidence_pct}% ${t.confidence_text[verdictKey] || ''}`);
  applyScriptFont($('confidence-text'), state.language);

  // Confidence + thumb row
  setText('confidence-num', String(r.confidence_pct ?? '—'));
  $('result-thumb').src = state.imagePreviewUrl;

  // Explanation
  const text = state.language === 'en'
    ? r.explanation_en
    : (r.explanation_local || r.explanation_en || '');
  setText('explanation-text', text);
  applyScriptFont($('explanation-text'), state.language);

  // Red flags
  const list = $('redflags-list');
  list.innerHTML = '';
  const flags = Array.isArray(r.red_flags) ? r.red_flags : [];
  if (flags.length === 0) {
    $('redflags-container').classList.add('hidden');
  } else {
    $('redflags-container').classList.remove('hidden');
    flags.forEach(flag => {
      const li = document.createElement('li');
      li.className = 'flex gap-2 items-start text-sm leading-relaxed';
      li.innerHTML =
        `<span class="inline-block w-1.5 h-1.5 rounded-full ${styles.dot} mt-2 shrink-0"></span>` +
        `<span class="${i18n[state.language].font_class}">${escapeHtml(flag)}</span>`;
      list.appendChild(li);
    });
  }

  // Tip
  setText('tip-text', r.learn_more_tip || '');
  applyScriptFont($('tip-text'), state.language);

  // ── Snapshot for PDF download ──────────────────────────────────────────────
  currentScan = {
    verdict:           r.verdict,
    confidence_pct:    r.confidence_pct,
    explanation_en:    r.explanation_en    || '',
    explanation_local: r.explanation_local || '',
    red_flags:         Array.isArray(r.red_flags) ? r.red_flags : [],
    learn_more_tip:    r.learn_more_tip    || '',
    language:          state.language,
    imageDataUrl:      null,
    fileName:          state.selectedFile ? state.selectedFile.name : 'image',
    imageHash:         '',
    timestamp:         new Date(),
    firestoreId:       null,
  };
  if (state.selectedFile) {
    const _f = state.selectedFile;
    Promise.all([resizeImageToBase64(_f, 400, 320), hashImage(_f)])
      .then(([dataUrl, hash]) => {
        if (currentScan) { currentScan.imageDataUrl = dataUrl; currentScan.imageHash = hash; }
      });
  } else if (state.imagePreviewUrl && state.imagePreviewUrl.startsWith('data:')) {
    currentScan.imageDataUrl = state.imagePreviewUrl;
  }

  // ── Download button label + border color ───────────────────────────────────
  const _pdfBtn = $('download-pdf-btn');
  if (_pdfBtn) {
    const PDF_LABELS = {
      Nakli:      '↓  Download Forensic Report',
      Asli:       '↓  Download Verification Certificate',
      'Shak hai': '↓  Download Analysis Report',
    };
    const PDF_COLORS = { Nakli: '#DC2626', Asli: '#16A34A', 'Shak hai': '#D97706' };
    const _lbl = $('download-pdf-label');
    if (_lbl) _lbl.textContent = PDF_LABELS[r.verdict] || PDF_LABELS['Shak hai'];
    const _c = PDF_COLORS[r.verdict] || PDF_COLORS['Shak hai'];
    _pdfBtn.style.color = _c;
    _pdfBtn.style.borderColor = _c;
  }

  showScreen('result');

  // Save-to-history banner: show for guests, hide for signed-in users
  const currentUser = _firebaseReady && auth ? auth.currentUser : null;
  _updateSaveBanner(currentUser);
}

// ─── Camera modal (desktop webcam via getUserMedia) ─────────────────────
let _cameraStream = null;
let _cameraFacing = 'user';

async function openCameraModal() {
  const modal = $('camera-modal');
  const video = $('camera-video');
  modal.classList.remove('hidden');
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _cameraFacing },
      audio: false,
    });
    video.srcObject = _cameraStream;
  } catch (err) {
    console.error('Camera access failed:', err);
    showToast('Camera access denied: ' + (err.name || err.message), 'error');
    closeCameraModal();
  }
}

function closeCameraModal() {
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  $('camera-video').srcObject = null;
  $('camera-modal').classList.add('hidden');
}

async function flipCamera() {
  _cameraFacing = _cameraFacing === 'user' ? 'environment' : 'user';
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _cameraFacing },
      audio: false,
    });
    $('camera-video').srcObject = _cameraStream;
  } catch (err) {
    console.error('Camera flip failed:', err);
  }
}

function captureFromCamera() {
  const video = $('camera-video');
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    if (!blob) return;
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    closeCameraModal();
    selectFile(file);
  }, 'image/jpeg', 0.9);
}

// ─── Share intent ────────────────────────────────────────────────────────
function shareWhatsApp() {
  if (!state.result) return;
  const t = i18n[state.language];
  const verdictDisplay = t.verdict[state.result.verdict] || state.result.verdict;
  const text = t.share_text.replace('{verdict}', verdictDisplay);
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

// ─── Reset ───────────────────────────────────────────────────────────────
function reset() {
  state.selectedFile = null;
  if (state.imagePreviewUrl) {
    URL.revokeObjectURL(state.imagePreviewUrl);
    state.imagePreviewUrl = null;
  }
  state.result = null;
  state.errorMessage = null;
  $('file-input').value = '';
  $('camera-input').value = '';
  showPickState();
  showScreen('upload');
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function resizeImageToBase64(file, maxW, maxH) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}

async function hashImage(file) {
  try {
    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);
  } catch (e) { return ''; }
}

async function saveScanToHistory(scanResult, imageFile) {
  if (!_firebaseReady || !db) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    const [thumbnail, imageHash] = await Promise.all([
      resizeImageToBase64(imageFile, 100, 100),
      hashImage(imageFile),
    ]);
    const docRef = await db.collection('users').doc(user.uid).collection('scans').add({
      timestamp:         firebase.firestore.FieldValue.serverTimestamp(),
      imageHash,
      imageThumbnail:    thumbnail,
      verdict:           scanResult.verdict,
      confidence_pct:    scanResult.confidence_pct,
      explanation_en:    scanResult.explanation_en    || '',
      explanation_local: scanResult.explanation_local || '',
      red_flags:         scanResult.red_flags         || [],
      learn_more_tip:    scanResult.learn_more_tip    || '',
      language:          state.language,
      fileName:          imageFile.name               || 'image',
    });
    if (currentScan) currentScan.firestoreId = docRef.id;
    showToast('✓ Result saved to your history', 'success');
  } catch (err) {
    console.error('Failed to save scan:', err);
  }
}

async function incrementGlobalStats(verdict) {
  if (!_firebaseReady || !db) return;
  try {
    await db.collection('stats').doc('global').set({
      total_scans:   firebase.firestore.FieldValue.increment(1),
      fake_detected: firebase.firestore.FieldValue.increment(verdict === 'Nakli' ? 1 : 0),
      real_verified: firebase.firestore.FieldValue.increment(verdict === 'Asli'  ? 1 : 0),
    }, { merge: true });
  } catch (e) { /* silent */ }
}

async function loadGlobalStats() {
  if (!_firebaseReady || !db) return;
  try {
    const doc = await db.collection('stats').doc('global').get();
    if (doc.exists) {
      const { total_scans = 0 } = doc.data();
      const el = $('global-stats');
      if (el && total_scans > 0) {
        el.textContent = `\u{1F6E1} ${total_scans.toLocaleString('en-IN')} images verified by Asli users`;
      }
    }
  } catch (e) { /* silent */ }
}

// ─── History panel ────────────────────────────────────────────────────────────

async function openHistoryPanel() {
  if (!_firebaseReady) return;
  const user = auth ? auth.currentUser : null;
  if (!user) { showToast('Sign in to view your scan history', 'info'); return; }

  _closeDropdown();
  $('history-panel').classList.add('open');
  $('panel-overlay').classList.add('show');
  if (window.lucide) lucide.createIcons();

  const list = $('history-list');
  list.innerHTML = '<p class="text-center text-asli-muted text-sm py-10">Loading…</p>';
  $('history-stats-bar').innerHTML = '';

  try {
    const snapshot = await db.collection('users').doc(user.uid)
      .collection('scans')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    renderHistoryStats(snapshot.docs);
    renderHistoryList(snapshot.docs);
  } catch (err) {
    list.innerHTML = '<p class="text-center text-red-500 text-sm py-10">Failed to load history.</p>';
    console.error('History load error:', err);
  }
}

function closeHistoryPanel() {
  const panel   = $('history-panel');
  const overlay = $('panel-overlay');
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

function _formatRelativeDate(ts) {
  if (!ts) return '';
  const date  = ts.toDate ? ts.toDate() : new Date(ts);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest  = new Date(today.getTime() - 86400000);
  const dayOf = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t     = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (dayOf.getTime() === today.getTime()) return `Today ${t}`;
  if (dayOf.getTime() === yest.getTime())  return `Yesterday ${t}`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function renderHistoryStats(docs) {
  const bar = $('history-stats-bar');
  if (!bar) return;
  const c = { Asli: 0, Nakli: 0, 'Shak hai': 0 };
  docs.forEach(d => { const v = d.data().verdict; if (v in c) c[v]++; });
  if (docs.length === 0) { bar.innerHTML = ''; return; }
  bar.innerHTML =
    `<span class="font-medium text-asli-text">Total: ${docs.length}</span>` +
    `<span style="color:#DC2626">\u{1F534} Fake: ${c['Nakli']}</span>` +
    `<span style="color:#16A34A">\u{1F7E2} Real: ${c['Asli']}</span>` +
    `<span style="color:#D97706">\u{1F7E1} Uncertain: ${c['Shak hai']}</span>`;
}

function renderHistoryList(docs) {
  const list = $('history-list');
  if (!list) return;
  list.innerHTML = '';

  if (docs.length === 0) {
    list.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <span class="text-5xl mb-4">🔍</span>
        <p class="font-semibold text-asli-text mb-1">No scans yet</p>
        <p class="text-sm text-asli-muted mb-5">Upload an image to start verifying</p>
        <button id="history-scan-now-btn"
          class="rounded-xl bg-brand text-white font-semibold px-6 py-2.5 text-sm hover:bg-brand-deep transition shadow-glow">
          Scan now
        </button>
      </div>`;
    const btn = $('history-scan-now-btn');
    if (btn) btn.addEventListener('click', () => { closeHistoryPanel(); showScreen('upload'); });
    return;
  }

  const BADGE = {
    Asli:       'background:#DCFCE7;color:#16A34A',
    Nakli:      'background:#FEE2E2;color:#DC2626',
    'Shak hai': 'background:#FEF3C7;color:#D97706',
  };

  docs.forEach(doc => {
    const d         = doc.data();
    const badgeStyle = BADGE[d.verdict] || BADGE['Shak hai'];
    const card      = document.createElement('div');
    card.className  = 'history-card bg-white rounded-2xl border border-slate-200 shadow-card p-3 flex gap-3 items-start transition';

    const thumb = document.createElement('img');
    thumb.src   = d.imageThumbnail || '';
    thumb.alt   = '';
    thumb.className = 'rounded-xl object-cover bg-slate-100 shrink-0';
    thumb.style.cssText = 'width:60px;height:60px;';

    const body = document.createElement('div');
    body.className = 'flex-1 min-w-0';
    body.innerHTML =
      `<div class="flex items-center justify-between gap-2 mb-1">` +
        `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style="${escapeHtml(badgeStyle)}">${escapeHtml(d.verdict || '—')}</span>` +
        `<span class="text-xs text-asli-muted shrink-0">${escapeHtml(_formatRelativeDate(d.timestamp))}</span>` +
      `</div>` +
      `<p class="text-sm font-medium text-asli-text">${escapeHtml(String(d.confidence_pct ?? '—'))}% confidence</p>` +
      `<p class="text-xs text-asli-muted truncate mb-2">${escapeHtml((d.fileName || 'image').slice(0, 28))}</p>` +
      `<div class="flex items-center gap-3">` +
        `<button class="history-view-btn text-xs font-semibold text-asli-green hover:underline transition">View Details</button>` +
        `<button class="history-pdf-btn text-xs font-semibold text-asli-muted hover:text-asli-text hover:underline transition">Download PDF</button>` +
      `</div>`;

    card.appendChild(thumb);
    card.appendChild(body);

    card.querySelector('.history-pdf-btn').addEventListener('click', () => downloadReportFromHistory(doc));
    card.querySelector('.history-view-btn').addEventListener('click', () => {
      state.result = {
        verdict:           d.verdict,
        confidence_pct:    d.confidence_pct,
        explanation_en:    d.explanation_en,
        explanation_local: d.explanation_local,
        red_flags:         d.red_flags || [],
        learn_more_tip:    d.learn_more_tip,
      };
      state.imagePreviewUrl = d.imageThumbnail || null;
      state.selectedFile    = null;
      closeHistoryPanel();
      renderResult();
    });

    list.appendChild(card);
  });
}

// ─── Settings panel ──────────────────────────────────────────────────────────

function openSettingsPanel() {
  closeHistoryPanel();
  _closeDropdown();
  $('settings-panel').classList.add('open');
  $('panel-overlay').classList.add('show');
  if (window.lucide) lucide.createIcons();
  renderSettingsContent();
}

function closeSettingsPanel() {
  const p = $('settings-panel');
  const o = $('panel-overlay');
  if (p) p.classList.remove('open');
  // Only hide overlay if history is also closed
  if (o && !$('history-panel').classList.contains('open')) o.classList.remove('show');
}

function renderSettingsContent() {
  const content = $('settings-content');
  if (!content) return;
  const user = _firebaseReady && auth ? auth.currentUser : null;

  content.innerHTML =
    _settingsSectionLanguage() +
    _settingsSectionNotifications() +
    _settingsSectionAccount(user) +
    _settingsSectionAbout() +
    _settingsSectionPrivacy();

  // Wire language buttons
  content.querySelectorAll('.settings-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveLanguagePref(btn.dataset.lang);
      content.querySelectorAll('.settings-lang-btn').forEach(b => {
        const active = b.dataset.lang === btn.dataset.lang;
        b.style.background = active ? '#0F172A' : '#fff';
        b.style.color      = active ? '#fff'    : '#64748B';
        b.style.borderColor = active ? '#0F172A' : '#E2E8F0';
      });
    });
  });

  // Wire account buttons
  if (user) {
    const exportBtn = content.querySelector('#settings-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportUserData);
    const deleteBtn = content.querySelector('#settings-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      showConfirmDialog(
        '⚠️ Delete Account?',
        '<p class="mb-2">This will permanently delete:</p>' +
        '<ul class="list-disc list-inside space-y-1 mb-3">' +
          '<li>All your scan history</li>' +
          '<li>Your settings</li>' +
          '<li>Your Asli account</li>' +
        '</ul>' +
        '<p class="font-medium text-asli-text">This cannot be undone.</p>',
        deleteAccount
      );
    });
  } else {
    const signInBtn = content.querySelector('#settings-signin-btn');
    if (signInBtn) signInBtn.addEventListener('click', () => { closeSettingsPanel(); signIn(); });
  }
}

function _settingsCard(title, icon, badgeHtml, body) {
  return (
    `<div class="settings-card bg-white rounded-2xl border border-slate-200 p-4 shadow-card">` +
      `<div class="flex items-center justify-between mb-3">` +
        `<p class="text-[11px] font-bold uppercase tracking-wider" style="color:#94A3B8;letter-spacing:0.08em">${icon} ${title}</p>` +
        badgeHtml +
      `</div>` +
      body +
    `</div>`
  );
}

function _settingsSectionLanguage() {
  const lang = state.language;
  const btns = [
    { code: 'hi', label: 'हिं' },
    { code: 'gu', label: 'ગુ' },
    { code: 'en', label: 'EN' },
  ].map(({ code, label }) => {
    const active = code === lang;
    return (
      `<button class="settings-lang-btn px-4 py-2 rounded-lg text-sm font-semibold border transition" ` +
      `data-lang="${code}" ` +
      `style="background:${active ? '#0F172A' : '#fff'};color:${active ? '#fff' : '#64748B'};border-color:${active ? '#0F172A' : '#E2E8F0'}">` +
      label +
      `</button>`
    );
  }).join('');
  return _settingsCard('Language', '🌎', '',
    `<p class="text-sm text-asli-muted mb-3">Default language for results</p>` +
    `<div class="flex gap-2">${btns}</div>`
  );
}

function _settingsSectionNotifications() {
  const badge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#FEF3C7;color:#D97706">Phase 2</span>`;
  const row = (label) =>
    `<label class="flex items-center justify-between py-2.5 select-none" title="Coming in Phase 2 — WhatsApp Bot">` +
      `<span class="text-sm" style="color:#94A3B8">${label}</span>` +
      `<div class="w-10 h-6 rounded-full relative shrink-0" style="background:#E2E8F0">` +
        `<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"></div>` +
      `</div>` +
    `</label>`;
  return _settingsCard('Notifications', '🔔', badge,
    `<div class="opacity-50 pointer-events-none">` +
      row('Scam alerts in my area') +
      `<div style="border-top:1px solid #F1F5F9"></div>` +
      row('Weekly media-literacy tips') +
    `</div>`
  );
}

function _settingsSectionAccount(user) {
  if (!user) {
    return _settingsCard('Account', '👤', '',
      `<p class="text-sm text-asli-muted mb-3">Sign in to manage your account and scan history.</p>` +
      `<button id="settings-signin-btn" ` +
        `class="w-full rounded-xl bg-ink text-white font-semibold py-2.5 text-sm hover:bg-slate-800 transition shadow-lift">` +
        `Sign in with Google` +
      `</button>`
    );
  }
  return _settingsCard('Account', '👤', '',
    `<div class="flex items-center gap-3 mb-4">` +
      `<img src="${escapeHtml(user.photoURL || '')}" alt="" class="w-12 h-12 rounded-full bg-slate-100 object-cover shrink-0 ring-2 ring-slate-100" />` +
      `<div class="min-w-0">` +
        `<p class="font-semibold text-asli-text truncate">${escapeHtml(user.displayName || '')}</p>` +
        `<p class="text-xs text-asli-muted truncate">${escapeHtml(user.email || '')}</p>` +
        `<p class="text-xs text-asli-muted">Signed in with Google</p>` +
      `</div>` +
    `</div>` +
    `<div style="border-top:1px solid #F1F5F9" class="mb-3"></div>` +
    `<button id="settings-export-btn" ` +
      `class="w-full rounded-xl border border-slate-200 text-asli-text font-semibold py-2.5 text-sm hover:bg-slate-50 transition mb-2">` +
      `Export my data` +
    `</button>` +
    `<button id="settings-delete-btn" ` +
      `class="w-full rounded-xl text-sm font-semibold py-2.5 hover:bg-red-50 transition" ` +
      `style="color:#DC2626;border:1px solid #FECACA">` +
      `Delete account and all data` +
    `</button>`
  );
}

function _settingsSectionAbout() {
  return _settingsCard('About Asli', 'ℹ️', '',
    `<p class="text-sm font-medium text-asli-text mb-0.5">Version 1.0.0</p>` +
    `<p class="text-sm text-asli-muted mb-1">Built for Google Solution Challenge 2026</p>` +
    `<p class="text-xs text-asli-muted mb-3">Theme: Digital Asset Protection &nbsp;·&nbsp; SDG 16 · SDG 10</p>` +
    `<div style="border-top:1px solid #F1F5F9" class="mb-3"></div>` +
    `<a href="https://github.com/suthardivy183-lang/verify-me" target="_blank" rel="noopener" ` +
      `class="flex items-center gap-2 text-sm font-semibold text-asli-green hover:underline mb-2">` +
      `View on GitHub →` +
    `</a>` +
    `<a href="mailto:suthardivy183@gmail.com" ` +
      `class="flex items-center gap-2 text-sm font-semibold text-asli-muted hover:underline">` +
      `Report a bug →` +
    `</a>`
  );
}

function _settingsSectionPrivacy() {
  const item = (text) =>
    `<li class="flex gap-2 items-start text-sm text-asli-muted">` +
      `<span class="shrink-0 mt-0.5" style="color:#16A34A">✓</span>${text}` +
    `</li>`;
  return _settingsCard('Privacy', '🔒', '',
    `<ul class="space-y-2 mb-4">` +
      item('We never store your original images on our servers.') +
      item('Only a 100×100 px thumbnail and anonymized metadata are saved to your history.') +
      item('Guest scans are never stored.') +
      item('Your images are deleted from Cloud Storage within 24 hours.') +
    `</ul>` +
    `<a href="privacy.html" class="text-sm font-semibold text-asli-green hover:underline">` +
      `View Privacy Policy →` +
    `</a>`
  );
}

// ─── Settings — language pref ─────────────────────────────────────────────────

async function saveLanguagePref(lang) {
  if (!i18n[lang]) return;
  const prevLang = state.language;
  localStorage.setItem('asli_lang', lang);
  state.language = lang;
  applyLanguage();
  // If a result is on screen, re-fetch it so explanation/red-flags/tip
  // come back in the newly chosen language (cheap if backend-cached).
  if (state.screen === 'result' && state.result && state.selectedFile && lang !== prevLang) {
    uploadAndScan(state.selectedFile, { language: lang, statusKey: 'relang_status' });
  }
  if (_firebaseReady && auth && auth.currentUser) {
    try {
      await db.collection('users').doc(auth.currentUser.uid)
        .set({ settings: { language: lang } }, { merge: true });
    } catch (e) { /* silent */ }
  }
}

async function loadUserSettings(uid) {
  if (!_firebaseReady || !db) return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const settings = doc.data().settings || {};
      if (settings.language && i18n[settings.language]) {
        localStorage.setItem('asli_lang', settings.language);
        state.language = settings.language;
        applyLanguage();
      }
    }
  } catch (e) { /* silent */ }
}

// ─── Settings — export / delete account ──────────────────────────────────────

async function exportUserData() {
  const user = _firebaseReady && auth ? auth.currentUser : null;
  if (!user) return;
  try {
    const snap = await db.collection('users').doc(user.uid)
      .collection('scans').orderBy('timestamp', 'desc').get();
    const scans = snap.docs.map(doc => {
      const d = { ...doc.data(), id: doc.id };
      d.imageThumbnail = '[removed for export]';
      if (d.timestamp && d.timestamp.toDate) d.timestamp = d.timestamp.toDate().toISOString();
      return d;
    });
    const payload = { exported_at: new Date().toISOString(), user: user.email, scans };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Asli_MyData_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast('Data exported successfully', 'success');
  } catch (err) {
    console.error('Export failed:', err);
    showToast('Export failed. Please try again.', 'error');
  }
}

async function deleteAccount() {
  const user = _firebaseReady && auth ? auth.currentUser : null;
  if (!user) return;
  try {
    const scansSnap = await db.collection('users').doc(user.uid).collection('scans').get();
    const batch = db.batch();
    scansSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('users').doc(user.uid));
    await batch.commit();
    await user.delete();
    closeSettingsPanel();
    showToast('Account deleted. Sorry to see you go.', 'info');
    reset();
  } catch (err) {
    if (err.code === 'auth/requires-recent-login') {
      showToast('Please sign out and sign in again, then retry.', 'error');
    } else {
      console.error('Delete account failed:', err);
      showToast('Delete failed. Please try again.', 'error');
    }
  }
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function showConfirmDialog(title, bodyHtml, onConfirm) {
  const dialog    = $('confirm-dialog');
  const titleEl   = $('confirm-title');
  const bodyEl    = $('confirm-body');
  const okBtn     = $('confirm-ok');
  const cancelBtn = $('confirm-cancel');
  if (!dialog) return;

  titleEl.textContent = title;
  bodyEl.innerHTML    = bodyHtml;
  dialog.classList.remove('hidden');
  okBtn.focus();

  function cleanup() {
    dialog.classList.add('hidden');
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    document.removeEventListener('keydown', handleKey);
  }
  function handleOk()     { cleanup(); onConfirm(); }
  function handleCancel() { cleanup(); }
  function handleKey(e)   { if (e.key === 'Escape') handleCancel(); }

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  document.addEventListener('keydown', handleKey);
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const palette = {
    info:    'background:#0F172A;color:#fff',
    success: 'background:#047857;color:#fff',
    error:   'background:#DC2626;color:#fff',
  };
  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = [
    'position:fixed',
    'bottom:calc(1.5rem + env(safe-area-inset-bottom))',
    'left:50%',
    'transform:translateX(-50%)',
    'padding:12px 24px',
    'border-radius:9999px',
    'font-size:14px',
    'font-weight:600',
    'font-family:Inter,system-ui,sans-serif',
    'box-shadow:0 8px 28px -6px rgba(15,23,42,0.45)',
    '-webkit-backdrop-filter:blur(8px)',
    'backdrop-filter:blur(8px)',
    'z-index:9999',
    'white-space:nowrap',
    'transition:opacity 280ms ease,transform 280ms ease',
    palette[type] || palette.info,
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);
  const timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
  toast.addEventListener('click', () => { clearTimeout(timer); toast.remove(); });
}

// ─── Auth — nav state ─────────────────────────────────────────────────────────
function showLoggedInNav(user) {
  const signinBtn = $('auth-signin-btn');
  const userBtn   = $('auth-user-btn');
  if (!signinBtn || !userBtn) return;
  signinBtn.classList.add('hidden');
  userBtn.classList.remove('hidden');
  userBtn.classList.add('flex');
  const avatar = $('auth-avatar');
  if (avatar) {
    avatar.src = user.photoURL || '';
    avatar.style.display = user.photoURL ? '' : 'none';
  }
  const username = $('auth-username');
  if (username) username.textContent = (user.displayName || user.email || '').split(' ')[0];
  if (window.lucide) lucide.createIcons();
  _updateSaveBanner(user);
}

function showLoggedOutNav() {
  const signinBtn = $('auth-signin-btn');
  const userBtn   = $('auth-user-btn');
  if (!signinBtn || !userBtn) return;
  userBtn.classList.add('hidden');
  userBtn.classList.remove('flex');
  signinBtn.classList.remove('hidden');
  _closeDropdown();
  _updateSaveBanner(null);
}

function _updateSaveBanner(user) {
  const banner = $('save-banner');
  if (!banner || state.screen !== 'result') return;
  if (user) {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  } else {
    banner.classList.remove('hidden');
    banner.classList.add('flex');
  }
}

// ─── Auth — sign-in / sign-out ────────────────────────────────────────────────
function signIn() {
  if (!_firebaseReady) return;
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(err => {
      console.error('Sign in failed:', err);
      showToast('Sign in failed: ' + (err.code || err.message), 'error');
    });
}

function signOut() {
  try { localStorage.removeItem('asli_guest'); } catch (_) {}
  if (!_firebaseReady) { showAuthGate(); return; }
  auth.signOut().catch(err => console.error('Sign out failed:', err));
}

// ─── Auth gate (professional landing / sign-in) ───────────────────────────────
function hideAuthGate() {
  const gate  = $('auth-gate');
  const shell = $('app-shell');
  if (gate)  gate.classList.add('hidden');
  if (shell) shell.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function showAuthGate() {
  // Respect a prior "continue as guest" choice so we don't nag every load
  let guest = false;
  try { guest = localStorage.getItem('asli_guest') === '1'; } catch (_) {}
  if (guest) { hideAuthGate(); return; }
  const gate  = $('auth-gate');
  const shell = $('app-shell');
  if (gate)  gate.classList.remove('hidden');
  if (shell) shell.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function continueAsGuest() {
  try { localStorage.setItem('asli_guest', '1'); } catch (_) {}
  hideAuthGate();
}

function bindAuthGate() {
  const g = $('gate-google-btn');
  if (g) g.addEventListener('click', () => {
    if (!_firebaseReady) {
      showToast('Google sign-in unavailable — continuing as guest', 'info');
      continueAsGuest();
      return;
    }
    signIn();
  });
  const skip = $('gate-skip');
  if (skip) skip.addEventListener('click', continueAsGuest);

  // If Firebase isn't available at all, the gate would trap the user —
  // surface guest mode as the working path (button is already visible).
  if (!_firebaseReady) {
    let guest = false;
    try { guest = localStorage.getItem('asli_guest') === '1'; } catch (_) {}
    if (guest) hideAuthGate();
  }
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
let _dropdownOpen = false;

function _toggleDropdown() { _dropdownOpen ? _closeDropdown() : _openDropdown(); }

function _openDropdown() {
  const dd  = $('auth-dropdown');
  const btn = $('auth-user-btn');
  if (!dd) return;
  dd.classList.remove('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  _dropdownOpen = true;
}

function _closeDropdown() {
  const dd  = $('auth-dropdown');
  const btn = $('auth-user-btn');
  if (!dd) return;
  dd.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  _dropdownOpen = false;
}

// ─── PDF Forensic Report ──────────────────────────────────────────────────────

// Locale strings for all PDF text
const PDF_STRINGS = {
  en: {
    title_report: 'Asli — Digital Authenticity Report',
    title_cert:   'Asli — Digital Verification Certificate',
    tagline:      'asli-solution-challenge.web.app  |  Built for Google Solution Challenge 2026',
    verdict: {
      Nakli:      'LIKELY AI-GENERATED (NAKLI)',
      Asli:       'VERIFIED AUTHENTIC (ASLI)',
      'Shak hai': 'UNCERTAIN — NEEDS REVIEW',
    },
    confidence:    'Confidence',
    image_label:   'Image under analysis:',
    verdict_lbl:   'Verdict',
    sec_summary:   'ANALYSIS SUMMARY',
    sec_authentic: 'WHY THIS IMAGE APPEARS AUTHENTIC',
    sec_signals:   'DETECTED SIGNALS',
    sec_method:    'DETECTION METHOD',
    sec_tip:       'HOW TO VERIFY NEXT TIME',
    sec_action:    'WHAT TO DO IF YOU RECEIVED THIS',
    sec_notice:    'IMPORTANT NOTICE',
    method_text:   'This image was analyzed by a three-model deep learning ensemble: (1) EfficientNet fine-tuned for AI image detection, (2) Vision Transformer for diffusion-era artifacts, and (3) a diffusion-specialist model covering Stable Diffusion, Midjourney, and DALL-E outputs. Results were combined using weighted ensemble scoring and explained by Google Gemini API.',
    actions: [
      'Do not send money or share personal information based on this image or video.',
      'Call the person directly on their known/saved phone number to verify.',
      'Report to National Cyber Crime Helpline: dial 1930 (free, 24/7).',
      'File a report online at: cybercrime.gov.in',
      'Warn family members who may have received the same image.',
    ],
    notice:     'This certificate indicates that our AI ensemble found no significant synthetic-media artifacts in this image at the time of analysis. This is not a guarantee of authenticity — AI detection is not 100% accurate. When in doubt, verify through multiple independent sources.',
    footer1:    'This report was generated by Asli — a free public-good tool built for Google Solution Challenge 2026.',
    footer2:    'Asli is not a legal instrument. For legal matters, consult a certified digital forensics expert.',
    analyzed_by:'Analyzed by: Asli v1.0 (Google Cloud Run + Gemini API)',
  },
  hi: {
    title_report: 'असली — डिजिटल प्रामाणिकता रिपोर्ट',
    title_cert:   'असली — डिजिटल सत्यापन प्रमाणपत्र',
    tagline:      'asli-solution-challenge.web.app  |  Google Solution Challenge 2026 के लिए',
    verdict: {
      Nakli:      'संभवतः AI-जनित (नक़ली)',
      Asli:       'प्रामाणिक सत्यापित (असली)',
      'Shak hai': 'अनिश्चित — समीक्षा आवश्यक',
    },
    confidence:    'विश्वसनीयता',
    image_label:   'विश्लेषित तस्वीर:',
    verdict_lbl:   'निर्णय',
    sec_summary:   'विश्लेषण सारांश',
    sec_authentic: 'यह तस्वीर असली क्यों लगती है',
    sec_signals:   'पहचाने गए संकेत',
    sec_method:    'जाँच की विधि',
    sec_tip:       'अगली बार कैसे सत्यापित करें',
    sec_action:    'यदि आपको यह तस्वीर मिली हो तो क्या करें',
    sec_notice:    'महत्वपूर्ण सूचना',
    method_text:   'इस तस्वीर का तीन गहरे शिक्षण मॉडलों के समूह द्वारा विश्लेषण किया गया: (१) AI छवि पहचान के लिए EfficientNet, (२) डिफ़्यूज़न कलाकृतियों के लिए Vision Transformer, और (३) Stable Diffusion, Midjourney और DALL-E छवियों के विशेषज्ञ मॉडल। परिणामों को भारित स्कोरिंग से जोड़ा गया और Google Gemini API द्वारा समझाया गया।',
    actions: [
      'इस तस्वीर के आधार पर पैसे न भेजें और व्यक्तिगत जानकारी साझा न करें।',
      'व्यक्ति को उनके ज्ञात फ़ोन नंबर पर सीधे कॉल करके सत्यापित करें।',
      'राष्ट्रीय साइबर अपराध हेल्पलाइन: 1930 डायल करें (निःशुल्क, 24/7)।',
      'ऑनलाइन रिपोर्ट करें: cybercrime.gov.in',
      'परिवार के सदस्यों को इस तस्वीर के बारे में सतर्क करें।',
    ],
    notice:     'यह प्रमाणपत्र इंगित करता है कि हमारे AI समूह को विश्लेषण के समय इस तस्वीर में कोई महत्वपूर्ण सिंथेटिक-मीडिया कलाकृतियाँ नहीं मिलीं। यह प्रामाणिकता की गारंटी नहीं है — AI पहचान 100% सटीक नहीं है। संदेह होने पर, कई स्वतंत्र स्रोतों से सत्यापित करें।',
    footer1:    'यह रिपोर्ट Asli द्वारा तैयार की गई — Google Solution Challenge 2026 के लिए निर्मित एक निःशुल्क सार्वजनिक-हित उपकरण।',
    footer2:    'Asli एक कानूनी दस्तावेज़ नहीं है। कानूनी मामलों के लिए प्रमाणित डिजिटल फ़ोरेंसिक विशेषज्ञ से परामर्श लें।',
    analyzed_by:'विश्लेषित: Asli v1.0 (Google Cloud Run + Gemini API)',
  },
  gu: {
    title_report: 'અસલી — ડિજિટલ પ્રામાણિકતા અહેવાલ',
    title_cert:   'અસલી — ડિજિટલ ચકાસણી પ્રમાણપત્ર',
    tagline:      'asli-solution-challenge.web.app  |  Google Solution Challenge 2026 માટે',
    verdict: {
      Nakli:      'સંભવ AI-નિર્મિત (નકલી)',
      Asli:       'પ્રામાણિક ચકાસાયેલ (અસલી)',
      'Shak hai': 'અનિશ્ચિત — સમીક્ષા જરૂરી',
    },
    confidence:    'વિશ્વાસ',
    image_label:   'વિશ્લેષિત છબી:',
    verdict_lbl:   'ચુકાદો',
    sec_summary:   'વિશ્લેષણ સારાંશ',
    sec_authentic: 'આ છબી અસલી શા માટે લાગે છે',
    sec_signals:   'શોધાયેલ સંકેતો',
    sec_method:    'તપાસ પદ્ધતિ',
    sec_tip:       'આગળ વખતે કેવી રીતે ચકાસવું',
    sec_action:    'આ છબી મળી હોય તો શું કરવું',
    sec_notice:    'મહત્વની સૂચના',
    method_text:   'આ છબીનું ત્રણ ઊંડા શિક્ષણ મોડેલ સમૂહ દ્વારા વિશ્લેષણ કરવામાં આવ્યું: (૧) AI છબી શોધ માટે EfficientNet, (૨) ડિફ્યૂઝન કલાકૃતિઓ માટે Vision Transformer, અને (૩) Stable Diffusion, Midjourney અને DALL-E છબીઓ માટે નિષ્ણાત મોડેલ. પરિણામો ભારિત સ્કોરિંગ દ્વારા જોડાયા અને Google Gemini API દ્વારા સમજાવ્યા.',
    actions: [
      'આ છબી આધારે પૈસા ન મોકલો અને વ્યક્તિગત માહિતી શેર ન કરો.',
      'વ્યક્તિને તેમના જ્ઞાત ફોન નંબર પર સીધો ફોન કરીને ચકાસો.',
      'રાષ્ટ્રીય સાઇબર ક્રાઇમ હેલ્પલાઇન: 1930 (મફત, 24/7).',
      'ઑનલાઇન રિપોર્ટ કરો: cybercrime.gov.in',
      'પરિવારના સદસ્યોને આ છબી વિશે સાવધાન કરો.',
    ],
    notice:     'આ પ્રમાણપત્ર દર્શાવે છે કે અમારા AI સમૂહને વિશ્લેષણ સમયે આ છબીમાં કોઈ નોંધપાત્ર સિન્થેટિક-મીડિયા કલાકૃતિઓ મળી નથી. આ પ્રામાણિકતાની ખાતરી નથી — AI શોધ 100% સચોટ નથી. શંકા હોય ત્યારે, અનેક સ્વતંત્ર સ્ત્રોતો દ્વારા ચકાસો.',
    footer1:    'આ અહેવાલ Asli દ્વારા તહેવાર કરવામાં આવ્યો — Google Solution Challenge 2026 માટે બનાવેલ એક મફત સાર્વજનિક-હિત સાધન.',
    footer2:    'Asli કાનૂની દસ્તાવેજ નથી. કાનૂની બાબતો માટે પ્રમાણિત ડિજિટલ ફોરેન્સિક નિષ્ણાતની સલાહ લો.',
    analyzed_by:'Asli v1.0 દ્રારા વિશ્લેષિત (Google Cloud Run + Gemini API)',
  },
};

function getVerdictColor(verdict) {
  if (verdict === 'Nakli') return { r: 220, g: 38,  b: 38  };
  if (verdict === 'Asli')  return { r: 22,  g: 163, b: 74  };
  return                          { r: 217, g: 119, b: 6   };
}

function getVerdictLabel(verdict, lang = 'en') {
  const PS = PDF_STRINGS[lang] || PDF_STRINGS.en;
  return PS.verdict[verdict] || verdict.toUpperCase();
}

// General-purpose canvas text renderer — used for Hindi/Gujarati scripts
async function renderCanvasBlock(doc, text, y, margin, contentW, opts = {}) {
  if (!text || !text.trim()) return y;
  const { fontSize = 28, bold = false, color = '#1c1917', transparent = false } = opts;
  const pxW    = Math.round(contentW * 3.78);
  const lhPx   = Math.round(fontSize * 1.5);
  const topPad = Math.round(fontSize * 0.2);
  const botPad = Math.round(fontSize * 0.35);
  const font   = `${bold ? 'bold ' : ''}${fontSize}px "Noto Sans Devanagari","Noto Sans Gujarati",Inter,sans-serif`;

  // --- Pass 1: measure height ---
  const cv1  = document.createElement('canvas');
  cv1.width  = pxW; cv1.height = 4;
  const cx1  = cv1.getContext('2d');
  cx1.font   = font;
  const maxW = pxW - 20;
  let line = '', curY = topPad + fontSize;
  text.split(' ').forEach(w => {
    const t = line + w + ' ';
    if (cx1.measureText(t).width > maxW && line) { line = w + ' '; curY += lhPx; }
    else line = t;
  });
  const totalPxH = curY + botPad;

  // --- Pass 2: render ---
  const cv   = document.createElement('canvas');
  cv.width   = pxW; cv.height = totalPxH;
  const ctx  = cv.getContext('2d');
  if (!transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pxW, totalPxH); }
  ctx.fillStyle = color;
  ctx.font      = font;
  line = ''; curY = topPad + fontSize;
  text.split(' ').forEach(w => {
    const t = line + w + ' ';
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line.trim(), 10, curY);
      line = w + ' '; curY += lhPx;
    } else line = t;
  });
  if (line.trim()) ctx.fillText(line.trim(), 10, curY);

  const hMM = totalPxH / 3.78;
  doc.addImage(cv.toDataURL('image/png'), 'PNG', margin, y, contentW, hMM);
  return y + hMM;
}

async function addSectionHeader(doc, title, y, margin, contentW, lang = 'en') {
  if (lang !== 'en') {
    const newY = await renderCanvasBlock(doc, title, y, margin, contentW,
      { fontSize: 26, bold: true, color: '#787878' });
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.3);
    doc.line(margin, newY, margin + contentW, newY);
    return newY + 3;
  }
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, margin + contentW, y + 1.5);
  return y + 7;
}

async function addBodyText(doc, text, y, margin, contentW, lang = 'en') {
  if (!text) return y;
  if (lang !== 'en') {
    return renderCanvasBlock(doc, text, y, margin, contentW, { fontSize: 28, color: '#282828' });
  }
  doc.setTextColor(40, 40, 40); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, contentW);
  doc.text(lines, margin, y);
  return y + lines.length * 5.5;
}

async function addBulletPoint(doc, text, y, margin, contentW, lang = 'en') {
  if (lang !== 'en') {
    return renderCanvasBlock(doc, '• ' + text, y, margin, contentW, { fontSize: 26, color: '#282828' });
  }
  doc.setTextColor(40, 40, 40); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('•', margin, y);
  const lines = doc.splitTextToSize(text, contentW - 6);
  doc.text(lines, margin + 6, y);
  return y + lines.length * 5.5 + 1;
}

async function downloadReportFromHistory(scanDoc) {
  const data = scanDoc.data();
  const prev  = currentScan;
  currentScan = {
    verdict:           data.verdict,
    confidence_pct:    data.confidence_pct,
    explanation_en:    data.explanation_en    || '',
    explanation_local: data.explanation_local || '',
    red_flags:         data.red_flags         || [],
    learn_more_tip:    data.learn_more_tip    || '',
    language:          data.language          || 'en',
    imageDataUrl:      data.imageThumbnail    || null,
    fileName:          data.fileName          || 'image',
    imageHash:         data.imageHash         || '',
    timestamp:         data.timestamp?.toDate() || new Date(),
    firestoreId:       scanDoc.id,
  };
  await downloadReport();
  currentScan = prev;
}

async function downloadReport() {
  if (!currentScan) return;
  if (!window.jspdf) {
    showToast('PDF library not loaded — try refreshing the page', 'error');
    return;
  }

  const lang   = currentScan.language || 'en';
  const PS     = PDF_STRINGS[lang] || PDF_STRINGS.en;
  const isEn   = lang === 'en';
  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W    = 210;
  const M    = 20;   // margin
  const CW   = W - M * 2;
  let   y    = 0;

  const hColor = getVerdictColor(currentScan.verdict);
  const isAsli = currentScan.verdict === 'Asli';

  const reportId = 'ASLI-' + currentScan.timestamp
    .toISOString().replace(/[-:.TZ]/g, '').substring(0, 12);
  const dateStr = currentScan.timestamp.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' IST';

  // ═══ HEADER BAND ═══
  doc.setFillColor(hColor.r, hColor.g, hColor.b);
  doc.rect(0, 0, W, 28, 'F');

  if (isEn) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(isAsli ? PS.title_cert : PS.title_report, M, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(PS.tagline, M, 20);
    y = 36;
  } else {
    // Canvas overlay (transparent PNG) on the colored band
    await renderCanvasBlock(doc, isAsli ? PS.title_cert : PS.title_report,
      2, M, CW, { fontSize: 36, bold: true, color: '#ffffff', transparent: true });
    await renderCanvasBlock(doc, PS.tagline,
      17, M, CW, { fontSize: 22, bold: false, color: '#ffffffdd', transparent: true });
    y = 36;
  }

  // ═══ REPORT METADATA (always English — technical fields) ═══
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Report ID: ${reportId}`,                                              M, y);
  doc.text(`Generated: ${dateStr}`,                                               M, y + 5);
  doc.text(`File: ${currentScan.fileName}`,                                       M, y + 10);
  doc.text(`Hash: ${currentScan.imageHash || '—'}`,                               M, y + 15);
  doc.text(`${PS.analyzed_by}`,                                                   M, y + 20);
  y += 30;

  // ═══ VERDICT BOX ═══
  doc.setDrawColor(hColor.r, hColor.g, hColor.b);
  doc.setLineWidth(0.8);
  doc.setFillColor(Math.min(255, hColor.r+200), Math.min(255, hColor.g+200), Math.min(255, hColor.b+200));
  doc.roundedRect(M, y, CW, 22, 3, 3, 'FD');

  if (isEn) {
    doc.setTextColor(hColor.r, hColor.g, hColor.b);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(getVerdictLabel(currentScan.verdict, lang), M + 6, y + 10);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`${PS.confidence}: ${currentScan.confidence_pct}%`, M + 6, y + 17);
    y += 30;
  } else {
    const vColor = `rgb(${hColor.r},${hColor.g},${hColor.b})`;
    const boxY = y;
    y += 4;
    y = await renderCanvasBlock(doc, getVerdictLabel(currentScan.verdict, lang),
      y, M + 4, CW - 8, { fontSize: 34, bold: true, color: vColor, transparent: true });
    y = await renderCanvasBlock(doc, `${PS.confidence}: ${currentScan.confidence_pct}%`,
      y, M + 4, CW - 8, { fontSize: 26, bold: false, color: vColor, transparent: true });
    y = Math.max(y, boxY + 26);
    y += 6;
  }

  // ═══ IMAGE THUMBNAIL ═══
  if (currentScan.imageDataUrl) {
    try {
      doc.addImage(currentScan.imageDataUrl, 'JPEG', M, y, 45, 45, '', 'MEDIUM');
      doc.setTextColor(60, 60, 60); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(PS.image_label, M + 50, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(currentScan.fileName, M + 50, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${PS.verdict_lbl}: ${currentScan.verdict}`,         M + 50, y + 17);
      doc.text(`${PS.confidence}: ${currentScan.confidence_pct}%`,  M + 50, y + 23);
      y += 52;
    } catch (_) { y += 5; }
  }

  // ═══ ANALYSIS SUMMARY ═══
  // For hi/gu use explanation_local; for en use explanation_en
  const summaryText = (!isEn && currentScan.explanation_local)
    ? currentScan.explanation_local
    : (currentScan.explanation_en || 'No explanation available.');
  const summaryTitle = isAsli ? PS.sec_authentic : PS.sec_summary;
  if (y > 220) { doc.addPage(); y = 20; }
  y = await addSectionHeader(doc, summaryTitle, y, M, CW, lang);
  y = await addBodyText(doc, summaryText, y, M, CW, lang);
  y += 6;

  // ═══ DETECTED SIGNALS ═══
  if (currentScan.red_flags && currentScan.red_flags.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = await addSectionHeader(doc, PS.sec_signals, y, M, CW, lang);
    for (const flag of currentScan.red_flags) {
      y = await addBulletPoint(doc, flag, y, M, CW, lang);
    }
    y += 6;
  }

  // ═══ DETECTION METHOD ═══
  if (y > 220) { doc.addPage(); y = 20; }
  y = await addSectionHeader(doc, PS.sec_method, y, M, CW, lang);
  y = await addBodyText(doc, PS.method_text, y, M, CW, lang);
    y += 6;

  // ═══ MEDIA LITERACY TIP ═══
  // tip comes from API — usually in the selected language if backend localizes it; use as-is
  if (currentScan.learn_more_tip) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = await addSectionHeader(doc, PS.sec_tip, y, M, CW, lang);
    y = await addBodyText(doc, currentScan.learn_more_tip, y, M, CW, lang);
    y += 6;
  }

  // ═══ WHAT TO DO (Nakli only) ═══
  if (currentScan.verdict === 'Nakli') {
    if (y > 210) { doc.addPage(); y = 20; }
    y = await addSectionHeader(doc, PS.sec_action, y, M, CW, lang);
    for (let i = 0; i < PS.actions.length; i++) {
      y = await addBulletPoint(doc, `${i + 1}. ${PS.actions[i]}`, y, M, CW, lang);
    }
    y += 6;
  }

  // ═══ AUTHENTICITY NOTICE (Asli only) ═══
  if (isAsli) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = await addSectionHeader(doc, PS.sec_notice, y, M, CW, lang);
    y = await addBodyText(doc, PS.notice, y, M, CW, lang);
    y += 6;
  }

  // ═══ FOOTER ═══
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 6;

  if (isEn) {
    doc.setTextColor(150, 150, 150); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(PS.footer1, M, y, { maxWidth: CW }); y += 5;
    doc.text(PS.footer2, M, y, { maxWidth: CW }); y += 5;
    doc.text(`asli-solution-challenge.web.app  |  SDG 16 + SDG 10  |  Report ID: ${reportId}`, M, y);
  } else {
    y = await renderCanvasBlock(doc, PS.footer1, y, M, CW, { fontSize: 20, color: '#969696' });
    y = await renderCanvasBlock(doc, PS.footer2, y, M, CW, { fontSize: 20, color: '#969696' });
    doc.setTextColor(150, 150, 150); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`asli-solution-challenge.web.app  |  SDG 16 + SDG 10  |  Report ID: ${reportId}`, M, y + 3);
  }

  // ═══ SAVE ═══
  const filename =
    `Asli_${lang.toUpperCase()}_${currentScan.verdict.replace(/ /g, '_')}_` +
    `${currentScan.timestamp.toISOString().split('T')[0]}_` +
    `${currentScan.imageHash || 'nohash'}.pdf`;

  doc.save(filename);
  showToast('Report downloaded', 'success');

  if (_firebaseReady && auth && auth.currentUser && currentScan.firestoreId) {
    db.collection('users').doc(auth.currentUser.uid)
      .collection('scans').doc(currentScan.firestoreId)
      .update({ pdf_downloaded: true }).catch(() => {});
  }
}

// ─── Wire up ─────────────────────────────────────────────────────────────
function init() {
  applyLanguage();
  showScreen('upload');

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (!i18n[lang]) return;
      const prevLang = state.language;
      state.language = lang;
      localStorage.setItem('asli_lang', lang);
      applyLanguage();

      // If we're already showing a result and the language actually changed,
      // re-fetch from the API so explanation_local + red_flags + tip come
      // back in the new language. Cheap if cached on the backend.
      if (state.screen === 'result' && state.result && state.selectedFile && lang !== prevLang) {
        uploadAndScan(state.selectedFile, { language: lang, statusKey: 'relang_status' });
      }
    });
  });

  // Pick a file → preview, don't auto-scan
  $('file-input').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) selectFile(f);
  });
  $('camera-input').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) selectFile(f);
  });

  // Camera button: use native input on mobile (capture attr opens camera),
  // open getUserMedia modal on desktop (where capture is ignored).
  const _isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  $('camera-btn').addEventListener('click', () => {
    if (_isMobile) {
      $('camera-input').click();
    } else {
      openCameraModal();
    }
  });
  $('camera-cancel-btn').addEventListener('click', closeCameraModal);
  $('camera-capture-btn').addEventListener('click', captureFromCamera);
  $('camera-flip-btn').addEventListener('click', flipCamera);

  // Drag-and-drop also just selects, doesn't scan
  const dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(ev => {
    dz.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragging');
    });
  });
  ['dragleave', 'dragend', 'drop'].forEach(ev => {
    dz.addEventListener(ev, e => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('dragging');
    });
  });
  dz.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) selectFile(f);
  });

  // Explicit confirm + change controls
  $('evaluate-btn').addEventListener('click', () => {
    if (state.selectedFile) uploadAndScan(state.selectedFile);
  });
  $('change-image-btn').addEventListener('click', clearSelection);

  $('scan-another-btn').addEventListener('click', reset);
  $('share-btn').addEventListener('click', shareWhatsApp);
  $('download-pdf-btn').addEventListener('click', downloadReport);
  $('retry-btn').addEventListener('click', () => {
    if (state.selectedFile) uploadAndScan(state.selectedFile);
    else reset();
  });

  // ─── Auth wiring ──────────────────────────────────────────────────────────
  if (_firebaseReady) {
    $('auth-signin-btn').addEventListener('click', signIn);
    $('auth-user-btn').addEventListener('click', _toggleDropdown);
    $('auth-signout-btn').addEventListener('click', () => { _closeDropdown(); signOut(); });
    $('save-banner-signin-btn').addEventListener('click', signIn);

    // Close dropdown on outside click
    document.addEventListener('click', e => {
      if (_dropdownOpen && !$('auth-area').contains(e.target)) _closeDropdown();
    });

    // Close dropdown / panels on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (_dropdownOpen) _closeDropdown();
        closeHistoryPanel();
        closeSettingsPanel();
      }
    });

    // My Scans → open history panel
    $('my-scans-btn').addEventListener('click', () => openHistoryPanel());

    // History panel close controls
    $('close-history').addEventListener('click', closeHistoryPanel);
    $('panel-overlay').addEventListener('click', () => { closeHistoryPanel(); closeSettingsPanel(); });

    // Settings panel (dropdown entry, only visible when signed in)
    $('settings-btn').addEventListener('click', () => openSettingsPanel());

    // Load global scan counter for social proof
    loadGlobalStats();

    // Track auth state; only show toast on actual sign-in/sign-out, not page-load restore
    let _authInitialized = false;
    auth.onAuthStateChanged(user => {
      if (_authInitialized) {
        if (user) showToast(`Signed in as ${(user.displayName || '').split(' ')[0]}`, 'success');
        else showToast('Signed out', 'info');
      }
      _authInitialized = true;
      if (user) { hideAuthGate(); showLoggedInNav(user); loadUserSettings(user.uid); }
      else { showAuthGate(); showLoggedOutNav(); }
    });
  }

  // Auth gate buttons — always wired (works with or without Firebase)
  bindAuthGate();

  // Settings panel — always accessible (guests + signed-in users)
  $('settings-gear-btn').addEventListener('click', () => openSettingsPanel());
  $('close-settings').addEventListener('click', closeSettingsPanel);

  // Escape closes settings even without Firebase
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSettingsPanel();
  });

  // Overlay tap closes settings even without Firebase
  $('panel-overlay').addEventListener('click', () => closeSettingsPanel());

  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// MODE TABS — Photo / Video / Live
// ═══════════════════════════════════════════════════════════════

let _activeMode = 'photo';

function setActiveMode(mode) {
  // If switching away from live mode and a session is active, stop it
  if (_activeMode === 'live' && mode !== 'live' && (_liveWs || _liveStream || _liveInterval)) {
    console.log('[live] Switching tabs — stopping live session');
    _stopLiveSessionOnly();
  }

  _activeMode = mode;

  // Tab button styles
  document.querySelectorAll('.mode-tab').forEach(btn => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle('bg-asli-text', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('text-asli-muted', !isActive);
  });

  // Show correct tab content inside upload screen
  ['photo', 'video', 'live'].forEach(m => {
    const el = $(`upload-${m}-tab`);
    if (el) el.classList.toggle('hidden', m !== mode);
  });

  // Always show the upload screen (the active tab content is inside it).
  // Live-detection screen only opens after clicking "Start Live Detection".
  showScreen('upload');
}

// Stop the live session without switching tabs (used internally)
function _stopLiveSessionOnly() {
  clearInterval(_liveInterval);
  _liveInterval = null;
  if (_liveWs) { try { _liveWs.close(); } catch (_) {} _liveWs = null; }
  if (_liveStream) { _liveStream.getTracks().forEach(t => t.stop()); _liveStream = null; }
  _liveHistory = [];
  const v = $('live-video');
  if (v) v.srcObject = null;
}

// Patch showScreen to handle 'live'
const _origShowScreen = showScreen;
showScreen = function(name) {
  ['upload', 'scanning', 'result', 'error', 'live'].forEach(s => {
    const el = $(`screen-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  state.screen = name;
  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ═══════════════════════════════════════════════════════════════
// VIDEO UPLOAD
// ═══════════════════════════════════════════════════════════════

let _selectedVideoFile = null;

function selectVideoFile(file) {
  if (!file) return;
  _selectedVideoFile = file;
  const url = URL.createObjectURL(file);
  const vid = $('video-preview');
  vid.src = url;
  vid.currentTime = 0.5;
  setText('video-filename', (file.name || 'video').slice(0, 40));
  $('video-pick').classList.add('hidden');
  $('video-ready').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function uploadAndScanVideo(file) {
  if (!file) return;

  // Show scanning screen with video-specific status
  showScreen('scanning');
  const statuses = [
    'Sampling frames…',
    'Analyzing frame 1 of 8…',
    'Analyzing frame 3 of 8…',
    'Analyzing frame 5 of 8…',
    'Analyzing frame 7 of 8…',
    'Computing verdict…',
  ];
  let _si = 0;
  setText('scan-status', statuses[0]);
  const _statusInterval = setInterval(() => {
    _si = Math.min(_si + 1, statuses.length - 1);
    setText('scan-status', statuses[_si]);
  }, 5000);

  // Show a blurred video thumbnail in the scanning screen
  const vid = $('video-preview');
  if (vid.src) {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    try { canvas.getContext('2d').drawImage(vid, 0, 0, 320, 240); } catch (_) {}
    $('scanning-image').src = canvas.toDataURL('image/jpeg', 0.7);
  }

  const language = state.language;

  const formData = new FormData();
  formData.append('video', file);
  formData.append('target_language', language);

  try {
    const response = await fetch(`${API_BASE}/scan-video`, {
      method: 'POST',
      body: formData,
    });
    clearInterval(_statusInterval);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status} — ${errBody.slice(0, 160)}`);
    }
    const data = await response.json();
    state.result = data;
    renderResult();
  } catch (err) {
    clearInterval(_statusInterval);
    state.errorMessage = err.message || 'Video analysis failed. Please try again.';
    setText('error-message', state.errorMessage);
    showScreen('error');
  }
}

// ═══════════════════════════════════════════════════════════════
// LIVE DETECTION (WebSocket)
// ═══════════════════════════════════════════════════════════════

let _liveWs        = null;
let _liveStream    = null;
let _liveInterval  = null;
let _liveHistory   = [];   // rolling last-3 verdicts for smoothing

const LIVE_VERDICT_COLORS = {
  'Asli':     { border: '#16A34A', bg: '#16A34A' },
  'Nakli':    { border: '#DC2626', bg: '#DC2626' },
  'Shak hai': { border: '#D97706', bg: '#D97706' },
};

function updateLiveOverlay(verdict, confidence_pct) {
  _liveHistory.push(verdict);
  if (_liveHistory.length > 3) _liveHistory.shift();

  // Majority vote over last 3 frames
  const counts = {};
  _liveHistory.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const smoothed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const colors = LIVE_VERDICT_COLORS[smoothed] || { border: '#78716C', bg: '#78716C' };
  $('live-border').style.borderColor = colors.border;
  $('live-verdict-badge').classList.remove('hidden');
  $('live-verdict-badge').style.background = colors.bg;
  setText('live-verdict-text', smoothed);
  setText('live-confidence-text', `${confidence_pct}%`);
}

async function startLiveDetection() {
  const WS_BASE = API_BASE.replace(/^http/, 'ws');
  console.log('[live] Starting detection. WS endpoint:', `${WS_BASE}/ws/live`);

  // Show the live screen FIRST so the video element is rendered and ready
  showScreen('live');
  $('live-border').style.borderColor = 'transparent';
  $('live-verdict-badge').classList.add('hidden');
  _liveHistory = [];

  // Request camera
  try {
    _liveStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    console.log('[live] Camera granted, tracks:', _liveStream.getTracks().map(t => t.kind + ':' + t.readyState));
  } catch (err) {
    console.error('[live] Camera error:', err);
    alert('Camera access denied: ' + (err.message || err.name));
    setActiveMode('live');
    return;
  }

  // Bind the stream to the video element + force play
  const videoEl = $('live-video');
  videoEl.srcObject = _liveStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  try {
    await videoEl.play();
    console.log('[live] Video playing. size:', videoEl.videoWidth, 'x', videoEl.videoHeight);
  } catch (err) {
    console.error('[live] video.play() failed:', err);
  }

  // Connect WebSocket
  try {
    _liveWs = new WebSocket(`${WS_BASE}/ws/live`);
  } catch (err) {
    console.error('[live] WebSocket constructor failed:', err);
    stopLiveDetection();
    alert('Could not connect to backend: ' + err.message);
    return;
  }

  _liveWs.onopen = () => console.log('[live] WebSocket connected');
  _liveWs.onclose = (e) => console.log('[live] WebSocket closed:', e.code, e.reason);

  _liveWs.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      console.log('[live] Backend response:', data);
      if (data.verdict) updateLiveOverlay(data.verdict, data.confidence_pct);
    } catch (err) {
      console.error('[live] Parse error:', err, e.data);
    }
  };

  _liveWs.onerror = (e) => {
    console.error('[live] WebSocket error:', e);
  };

  // Send a frame every 2 seconds
  _liveInterval = setInterval(() => {
    if (!_liveWs || _liveWs.readyState !== WebSocket.OPEN) return;
    const video = $('live-video');
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
    canvas.toBlob(blob => {
      if (blob && _liveWs && _liveWs.readyState === WebSocket.OPEN) {
        _liveWs.send(blob);
      }
    }, 'image/jpeg', 0.85);
  }, 2000);
}

function stopLiveDetection() {
  _stopLiveSessionOnly();
  // Go back to live tab start screen — set _activeMode first to skip the auto-stop logic
  _activeMode = 'live';
  setActiveMode('live');
}

// ═══════════════════════════════════════════════════════════════
// WIRE UP NEW EVENT LISTENERS (called from init)
// ═══════════════════════════════════════════════════════════════

function initModeExtensions() {
  // Tab switcher
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => setActiveMode(btn.dataset.mode));
  });

  // Set initial active tab style
  setActiveMode('photo');

  // Video file input
  $('video-file-input').addEventListener('change', e => {
    if (e.target.files[0]) selectVideoFile(e.target.files[0]);
  });

  // Video dropzone drag-and-drop
  const vdz = $('video-dropzone');
  vdz.addEventListener('dragover', e => { e.preventDefault(); vdz.classList.add('dragging'); });
  vdz.addEventListener('dragleave', () => vdz.classList.remove('dragging'));
  vdz.addEventListener('drop', e => {
    e.preventDefault();
    vdz.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) selectVideoFile(file);
  });

  // Change video button
  $('change-video-btn').addEventListener('click', () => {
    _selectedVideoFile = null;
    $('video-ready').classList.add('hidden');
    $('video-pick').classList.remove('hidden');
    $('video-file-input').value = '';
  });

  // Analyze video button
  $('evaluate-video-btn').addEventListener('click', () => {
    if (_selectedVideoFile) uploadAndScanVideo(_selectedVideoFile);
  });

  // Start live detection
  $('start-live-btn').addEventListener('click', startLiveDetection);

  // Stop live detection
  $('stop-live-btn').addEventListener('click', stopLiveDetection);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  initModeExtensions();
});
