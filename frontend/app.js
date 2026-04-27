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

    // Close dropdown on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _dropdownOpen) _closeDropdown();
    });

    // Track auth state; only show toast on actual sign-in/sign-out, not page-load restore
    let _authInitialized = false;
    auth.onAuthStateChanged(user => {
      if (_authInitialized) {
        if (user) showToast(`Signed in as ${(user.displayName || '').split(' ')[0]}`, 'success');
        else showToast('Signed out', 'info');
      }
      _authInitialized = true;
      if (user) showLoggedInNav(user);
      else showLoggedOutNav();
    });
  }

  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);
