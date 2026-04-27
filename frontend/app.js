'use strict';

/* ─── Asli — vanilla JS app ─── */

const API_BASE = (window.ASLI_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// ─── Firebase config ──────────────────────────────────────────────────────────
// Replace ALL placeholder values with your project's config:
//   console.firebase.google.com → Project Settings → Your apps → SDK setup and config
//
// TO TEST:
// 1. Replace placeholder values below with your real Firebase config
// 2. Enable Google provider: Firebase Console → Authentication → Sign-in method → Google → Enable
// 3. Add authorized domains: Authentication → Settings → Authorized domains
//    (add "localhost" for local dev + your Firebase Hosting URL for prod)
// 4. Open frontend, click "Sign in" — Google popup should appear
// 5. Verify navbar switches to avatar + first name state
// 6. Refresh page — user should still be logged in (Firebase persists session)
// 7. Click name → dropdown → "Sign out" — verify reverts to sign-in button
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

let _firebaseReady = false;
let auth = null;
let db   = null;

try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db   = firebase.firestore();
  _firebaseReady = true;
} catch (e) {
  // Firebase unavailable — guest-only mode, scan flow unaffected
  console.warn('Firebase init skipped (placeholder config or SDK error):', e.message);
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
    share_text: 'मैंने Asli से एक तस्वीर जाँची — verdict: {verdict}. आप भी जाँचें: https://asli.web.app',
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
    share_text: 'મેં Asli થી તસવીર તપાસી — verdict: {verdict}. તમે પણ તપાસો: https://asli.web.app',
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
    share_text: 'I checked an image with Asli — verdict: {verdict}. Check yours: https://asli.web.app',
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
  const stored = localStorage.getItem('asli_lang');
  if (stored && i18n[stored]) return stored;
  const nav = (navigator.language || 'hi').toLowerCase();
  if (nav.startsWith('gu')) return 'gu';
  if (nav.startsWith('en')) return 'en';
  return 'hi';
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
          class="rounded-xl bg-asli-green text-white font-semibold px-6 py-2.5 text-sm hover:bg-green-700 transition">
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
    card.className  = 'bg-white rounded-xl border border-stone-200 p-3 flex gap-3 items-start';

    const thumb = document.createElement('img');
    thumb.src   = d.imageThumbnail || '';
    thumb.alt   = '';
    thumb.className = 'rounded-lg object-cover bg-stone-100 shrink-0';
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
        b.style.background = active ? '#1c1917' : '#fff';
        b.style.color      = active ? '#fff'    : '#78716c';
        b.style.borderColor = active ? '#1c1917' : '#e5e7eb';
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
    `<div class="bg-white rounded-2xl border border-[#e5e7eb] p-4">` +
      `<div class="flex items-center justify-between mb-3">` +
        `<p class="text-xs font-medium uppercase tracking-wider" style="color:#9ca3af;letter-spacing:0.06em">${icon} ${title}</p>` +
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
      `style="background:${active ? '#1c1917' : '#fff'};color:${active ? '#fff' : '#78716c'};border-color:${active ? '#1c1917' : '#e5e7eb'}">` +
      label +
      `</button>`
    );
  }).join('');
  return _settingsCard('Language', '\u{1F310}', '',
    `<p class="text-sm text-asli-muted mb-3">Default language for results</p>` +
    `<div class="flex gap-2">${btns}</div>`
  );
}

function _settingsSectionNotifications() {
  const badge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#FEF3C7;color:#D97706">Phase 2</span>`;
  const row = (label) =>
    `<label class="flex items-center justify-between py-2.5 select-none" title="Coming in Phase 2 — WhatsApp Bot">` +
      `<span class="text-sm" style="color:#9ca3af">${label}</span>` +
      `<div class="w-10 h-6 rounded-full relative shrink-0" style="background:#e5e7eb">` +
        `<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"></div>` +
      `</div>` +
    `</label>`;
  return _settingsCard('Notifications', '\u{1F514}', badge,
    `<div class="opacity-50 pointer-events-none">` +
      row('Scam alerts in my area') +
      `<div style="border-top:0.5px solid #f3f4f6"></div>` +
      row('Weekly media-literacy tips') +
    `</div>`
  );
}

function _settingsSectionAccount(user) {
  if (!user) {
    return _settingsCard('Account', '\u{1F464}', '',
      `<p class="text-sm text-asli-muted mb-3">Sign in to manage your account and scan history.</p>` +
      `<button id="settings-signin-btn" ` +
        `class="w-full rounded-xl bg-asli-text text-white font-semibold py-2.5 text-sm hover:bg-stone-800 transition">` +
        `Sign in with Google` +
      `</button>`
    );
  }
  return _settingsCard('Account', '\u{1F464}', '',
    `<div class="flex items-center gap-3 mb-4">` +
      `<img src="${escapeHtml(user.photoURL || '')}" alt="" class="w-12 h-12 rounded-full bg-stone-100 object-cover shrink-0" />` +
      `<div class="min-w-0">` +
        `<p class="font-semibold text-asli-text truncate">${escapeHtml(user.displayName || '')}</p>` +
        `<p class="text-xs text-asli-muted truncate">${escapeHtml(user.email || '')}</p>` +
        `<p class="text-xs text-asli-muted">Signed in with Google</p>` +
      `</div>` +
    `</div>` +
    `<div style="border-top:0.5px solid #f3f4f6" class="mb-3"></div>` +
    `<button id="settings-export-btn" ` +
      `class="w-full rounded-xl border border-stone-200 text-asli-text font-semibold py-2.5 text-sm hover:bg-stone-50 transition mb-2">` +
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
  return _settingsCard('About Asli', '\u{2139}\u{FE0F}', '',
    `<p class="text-sm font-medium text-asli-text mb-0.5">Version 1.0.0</p>` +
    `<p class="text-sm text-asli-muted mb-1">Built for Google Solution Challenge 2026</p>` +
    `<p class="text-xs text-asli-muted mb-3">Theme: Digital Asset Protection &nbsp;·&nbsp; SDG 16 · SDG 10</p>` +
    `<div style="border-top:0.5px solid #f3f4f6" class="mb-3"></div>` +
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
  return _settingsCard('Privacy', '\u{1F512}', '',
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
  localStorage.setItem('asli_lang', lang);
  state.language = lang;
  applyLanguage();
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
    info:    'background:#1c1917;color:#fff',
    success: 'background:#16A34A;color:#fff',
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
    'padding:10px 22px',
    'border-radius:9999px',
    'font-size:14px',
    'font-weight:500',
    'font-family:Inter,system-ui,sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
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
      showToast('Sign in failed. Please try again.', 'error');
    });
}

function signOut() {
  if (!_firebaseReady) return;
  auth.signOut().catch(err => console.error('Sign out failed:', err));
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

function getVerdictColor(verdict) {
  if (verdict === 'Nakli') return { r: 220, g: 38,  b: 38  };
  if (verdict === 'Asli')  return { r: 22,  g: 163, b: 74  };
  return                          { r: 217, g: 119, b: 6   };
}

function getVerdictLabel(verdict) {
  if (verdict === 'Nakli')    return 'LIKELY AI-GENERATED (NAKLI)';
  if (verdict === 'Asli')     return 'VERIFIED AUTHENTIC (ASLI)';
  if (verdict === 'Shak hai') return 'UNCERTAIN — NEEDS REVIEW';
  return verdict.toUpperCase();
}

function addSectionHeader(doc, title, y, margin, contentW) {
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, margin + contentW, y + 1.5);
  return y + 7;
}

function addBodyText(doc, text, y, margin, contentW) {
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text || '', contentW);
  doc.text(lines, margin, y);
  return y + (lines.length * 5.5);
}

function addBulletPoint(doc, text, y, margin, contentW) {
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('•', margin, y);
  const lines = doc.splitTextToSize(text, contentW - 6);
  doc.text(lines, margin + 6, y);
  return y + (lines.length * 5.5) + 1;
}

async function addLocalLanguageSection(doc, text, y, margin, contentW) {
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(contentW * 3.78);
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  const fontSize = 28;
  const maxWidth = canvas.width - 20;

  ctx.font = `${fontSize}px "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif`;
  const words = text.split(' ');

  // First pass: measure the total height needed
  let line = '', lineY = 40;
  words.forEach(word => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) { line = word + ' '; lineY += 36; }
    else line = test;
  });
  const totalH = lineY + 20;

  // Set final height and re-render (height change clears the canvas)
  canvas.height = totalH;
  ctx.fillStyle = '#f9fafb';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1c1917';
  ctx.font = `${fontSize}px "Noto Sans Devanagari", "Noto Sans Gujarati", sans-serif`;

  line = ''; lineY = 40;
  words.forEach(word => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), 10, lineY);
      line = word + ' ';
      lineY += 36;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line.trim(), 10, lineY);

  const imgData     = canvas.toDataURL('image/png');
  const imgHeightMM = totalH / 3.78;
  doc.addImage(imgData, 'PNG', margin, y, contentW, imgHeightMM);
  return y + imgHeightMM + 4;
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

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W        = 210;
  const MARGIN   = 20;
  const CW       = W - MARGIN * 2; // content width
  let   y        = 0;

  const hColor = getVerdictColor(currentScan.verdict);
  const isAsli = currentScan.verdict === 'Asli';

  // ═══ HEADER BAND ═══
  doc.setFillColor(hColor.r, hColor.g, hColor.b);
  doc.rect(0, 0, W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isAsli ? 'Asli — Digital Verification Certificate'
           : 'Asli — Digital Authenticity Report',
    MARGIN, 12
  );
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('asli.web.app  |  Built for Google Solution Challenge 2026', MARGIN, 20);

  y = 36;

  // ═══ REPORT METADATA ═══
  const reportId = 'ASLI-' + currentScan.timestamp
    .toISOString().replace(/[-:.TZ]/g, '').substring(0, 12);
  const dateStr = currentScan.timestamp.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) + ' IST';

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report ID: ${reportId}`,    MARGIN, y);
  doc.text(`Generated: ${dateStr}`,     MARGIN, y + 5);
  doc.text(`File: ${currentScan.fileName}`, MARGIN, y + 10);
  doc.text(`Hash: ${currentScan.imageHash || '—'}`, MARGIN, y + 15);
  doc.text('Analyzed by: Asli v1.0 (Google Cloud Run + Gemini API)', MARGIN, y + 20);

  y += 30;

  // ═══ VERDICT BOX ═══
  doc.setDrawColor(hColor.r, hColor.g, hColor.b);
  doc.setLineWidth(0.8);
  doc.setFillColor(
    Math.min(255, hColor.r + 200),
    Math.min(255, hColor.g + 200),
    Math.min(255, hColor.b + 200)
  );
  doc.roundedRect(MARGIN, y, CW, 22, 3, 3, 'FD');

  doc.setTextColor(hColor.r, hColor.g, hColor.b);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(getVerdictLabel(currentScan.verdict), MARGIN + 6, y + 10);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Confidence: ${currentScan.confidence_pct}%`, MARGIN + 6, y + 17);

  y += 30;

  // ═══ IMAGE THUMBNAIL ═══
  if (currentScan.imageDataUrl) {
    try {
      doc.addImage(currentScan.imageDataUrl, 'JPEG', MARGIN, y, 45, 45, '', 'MEDIUM');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Image under analysis:', MARGIN + 50, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(currentScan.fileName, MARGIN + 50, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Verdict: ${currentScan.verdict}`,         MARGIN + 50, y + 17);
      doc.text(`Confidence: ${currentScan.confidence_pct}%`, MARGIN + 50, y + 23);
      y += 52;
    } catch (_) {
      y += 5;
    }
  }

  // ═══ ANALYSIS SUMMARY ═══
  y = addSectionHeader(doc,
    isAsli ? 'WHY THIS IMAGE APPEARS AUTHENTIC' : 'ANALYSIS SUMMARY',
    y, MARGIN, CW);
  y = addBodyText(doc, currentScan.explanation_en || 'No explanation available.', y, MARGIN, CW);
  y += 6;

  // ═══ LOCAL LANGUAGE SECTION (canvas-rendered Devanagari / Gujarati) ═══
  if (currentScan.language !== 'en' && currentScan.explanation_local) {
    const localLabel = currentScan.language === 'hi' ? 'HINDI SUMMARY' : 'GUJARATI SUMMARY';
    y = addSectionHeader(doc, localLabel, y, MARGIN, CW);
    y = await addLocalLanguageSection(doc, currentScan.explanation_local, y, MARGIN, CW);
  }

  // ═══ DETECTED SIGNALS ═══
  if (currentScan.red_flags && currentScan.red_flags.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = addSectionHeader(doc, 'DETECTED SIGNALS', y, MARGIN, CW);
    currentScan.red_flags.forEach(flag => {
      y = addBulletPoint(doc, flag, y, MARGIN, CW);
    });
    y += 6;
  }

  // ═══ DETECTION METHOD ═══
  if (y > 220) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'DETECTION METHOD', y, MARGIN, CW);
  y = addBodyText(doc,
    'This image was analyzed by a three-model deep learning ensemble: ' +
    '(1) EfficientNet fine-tuned for AI image detection, ' +
    '(2) Vision Transformer for diffusion-era artifacts, and ' +
    '(3) a diffusion-specialist model covering Stable Diffusion, ' +
    'Midjourney, and DALL-E outputs. ' +
    'Results were combined using weighted ensemble scoring and ' +
    'explained by Google Gemini API.',
    y, MARGIN, CW);
  y += 6;

  // ═══ MEDIA LITERACY TIP ═══
  if (y > 230) { doc.addPage(); y = 20; }
  y = addSectionHeader(doc, 'HOW TO VERIFY NEXT TIME', y, MARGIN, CW);
  y = addBodyText(doc, currentScan.learn_more_tip || '', y, MARGIN, CW);
  y += 6;

  // ═══ WHAT TO DO (Nakli only) ═══
  if (currentScan.verdict === 'Nakli') {
    if (y > 210) { doc.addPage(); y = 20; }
    y = addSectionHeader(doc, 'WHAT TO DO IF YOU RECEIVED THIS', y, MARGIN, CW);
    const actions = [
      'Do not send money or share personal information based on this image or video.',
      'Call the person directly on their known/saved phone number to verify.',
      'Report to National Cyber Crime Helpline: dial 1930 (free, 24/7).',
      'File a report online at: cybercrime.gov.in',
      'Warn family members who may have received the same image.',
    ];
    actions.forEach((action, i) => {
      y = addBulletPoint(doc, `${i + 1}. ${action}`, y, MARGIN, CW);
    });
    y += 6;
  }

  // ═══ AUTHENTICITY NOTICE (Asli only) ═══
  if (isAsli) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = addSectionHeader(doc, 'IMPORTANT NOTICE', y, MARGIN, CW);
    y = addBodyText(doc,
      'This certificate indicates that our AI ensemble found no significant ' +
      'synthetic-media artifacts in this image at the time of analysis. This is not a ' +
      'guarantee of authenticity — AI detection is not 100% accurate. When in doubt, ' +
      'verify through multiple independent sources.',
      y, MARGIN, CW);
    y += 6;
  }

  // ═══ FOOTER ═══
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 6;

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'This report was generated by Asli — a free public-good tool built for Google Solution Challenge 2026.',
    MARGIN, y, { maxWidth: CW }
  );
  y += 5;
  doc.text(
    'Asli is not a legal instrument. For legal matters, consult a certified digital forensics expert.',
    MARGIN, y, { maxWidth: CW }
  );
  y += 5;
  doc.text(`asli.web.app  |  SDG 16 + SDG 10  |  Report ID: ${reportId}`, MARGIN, y);

  // ═══ SAVE ═══
  const filename =
    `Asli_Report_${currentScan.verdict.replace(/ /g, '_')}_` +
    `${currentScan.timestamp.toISOString().split('T')[0]}_` +
    `${currentScan.imageHash || 'nohash'}.pdf`;

  doc.save(filename);
  showToast('Report downloaded', 'success');

  // Flag pdf_downloaded in Firestore (best-effort)
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
      if (user) { showLoggedInNav(user); loadUserSettings(user.uid); }
      else showLoggedOutNav();
    });
  }

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

document.addEventListener('DOMContentLoaded', init);
