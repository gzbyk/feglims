// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — app.js
//  Core application: auth, navigation, state
// ═══════════════════════════════════════════

import {
  auth, db, gp, OWNER_EMAIL,
  signInWithPopup, onAuthStateChanged, signOut,
  collection, doc, addDoc, getDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, where,
  onSnapshot, getDocs, Timestamp,
  sendEmail, auditLog,
  addDays, fmtDate, fmtDateTime, todayISO,
  validateCAS, validateORCID,
  capitalize, exportToExcel,
  isSystemOwner, isLabAdmin,
  ROLES, ROLE_DEFAULTS, ALL_PERMS, hasPermission
} from './firebase.js';

import { renderInventory, setStockTab } from './inventory.js';
import { renderChemicals } from './chemicals.js';
import { renderEln } from './eln.js';
import { renderOrders } from './orders.js';
import { renderCalendar } from './calendar.js';
import { renderAnalytics } from './analytics.js';
import { renderAdmin, renderSettings } from './admin.js';
import { renderLabWork } from './labwork.js';

// ── GLOBAL STATE ────────────────────────────
const A = window.APP;

// ── TRANSLATIONS ────────────────────────────
const T = {
  tr: {
    // Login
    tagline: 'Fonksiyonel ve Evrimsel Genetik Lab — Bilgi Yönetim Sistemi',
    googleBtn: 'Google ile Giriş Yap',
    online: 'Çevrimiçi', offline: 'Çevrimdışı',
    // Register
    regTitle: 'Profilinizi Tamamlayın',
    regSub: 'Yönetici onayı için bu bilgiler zorunludur.',
    regName: 'Ad Soyad', regLab: 'Laboratuvar',
    regPos: 'Ünvan / Pozisyon', regOrcid: 'ORCID (isteğe bağlı)',
    regSubmit: 'Onaya Gönder', regCancel: 'Çıkış Yap',
    // Pending
    pendTitle: 'Yönetici Onayı Bekleniyor',
    pendMsg: 'Kaydınız alındı. Yönetici hesabınızı onaylayana kadar bekleyiniz.',
    pendRefresh: 'Yenile', pendLogout: 'Çıkış Yap',
    // Nav groups
    ngMain: 'ANA MENÜ', ngAdmin: 'YÖNETİCİ',
    // Nav items
    niInventory: 'Stok Envanteri', niCalendar: 'Takvim',
    niChemicals: 'Kimyasal Envanter', niEln: 'Lab Defteri (ELN)',
    niOrders: 'Sipariş Listeleri', niAnalytics: 'Analitik',
    niLabWork: 'Laboratuvar İşleri', niStockLists: 'Stok Listelerim',
    niAdmin: 'Yönetici Paneli', niSettings: 'Sistem Ayarları',
    niLogout: 'Çıkış Yap', niActivityLog: 'Aktivite Kaydı',
    // Top titles
    topInventory: 'Stok Envanteri', topCalendar: 'Takvim',
    topChemicals: 'Kimyasal Envanter', topEln: 'Elektronik Lab Defteri',
    topOrders: 'Sipariş Listeleri', topAnalytics: 'Analitik',
    topLabWork: 'Laboratuvar İşleri', topStockLists: 'Stok Listelerim',
    topAdmin: 'Yönetici Paneli', topSettings: 'Sistem Ayarları',
    topActivityLog: 'Aktivite Kaydı',
    // Common
    save: 'Kaydet', cancel: 'İptal', delete: 'Sil', edit: 'Düzenle',
    add: 'Ekle', create: 'Oluştur', close: 'Kapat', approve: 'Onayla',
    search: 'Ara...', loading: 'Yükleniyor...', noData: 'Veri yok.',
    required: 'Bu alan zorunludur.',
    settingsMode: 'Ayar Modu', exitSettings: 'Ayar Modundan Çık',
    settingsBanner: '⚙ Ayar Modundasınız — Sistem konfigürasyonunu düzenleyebilirsiniz',
    // Status
    sActive: 'Aktif', sWeak: 'Zayıf', sLost: 'Kaybedildi',
    // Roles
    rAdmin: 'Lab Yöneticisi', rPI: 'PI / Danışman', rSenior: 'Kıdemli Araştırmacı', rResearcher: 'Araştırmacı', rStudent: 'Öğrenci', rPending: 'Beklemede',
    // Toast messages
    saved: 'Başarıyla kaydedildi.',
    saveErr: 'Kayıt hatası.',
    approved: 'Kullanıcı onaylandı.',
    statusUpdated: 'Durum güncellendi.',
    emailSent: 'Bildirim gönderildi.',
    emailErr: 'Bildirim gönderilemedi.',
    deleted: 'Silindi.',
    addStockBtn: 'Yeni Stok',
    topDashboard: 'Genel Bakış',
    topSystem: 'Sistem Yönetimi',
    topTurkeyStocks: 'Drosophila Türkiye Stocks',
    niDashboard: 'Genel Bakış',
    niSystem: 'Sistem Yönetimi',
  },
  en: {
    tagline: 'Functional & Evolutionary Genetics Lab — Information Management System',
    googleBtn: 'Continue with Google',
    online: 'Online', offline: 'Offline',
    regTitle: 'Complete Your Profile',
    regSub: 'Required before administrator approval.',
    regName: 'Full Name', regLab: 'Laboratory',
    regPos: 'Title / Position', regOrcid: 'ORCID (optional)',
    regSubmit: 'Submit for Approval', regCancel: 'Sign Out',
    pendTitle: 'Awaiting Administrator Approval',
    pendMsg: 'Your registration has been submitted. Please wait for administrator review.',
    pendRefresh: 'Refresh', pendLogout: 'Sign Out',
    ngMain: 'MAIN', ngAdmin: 'ADMIN',
    niInventory: 'Stock Inventory', niCalendar: 'Calendar',
    niChemicals: 'Chemical Inventory', niEln: 'Lab Notebook (ELN)',
    niOrders: 'Order Lists', niAnalytics: 'Analytics',
    niLabWork: 'Lab Work', niStockLists: 'My Stock Lists',
    niAdmin: 'Admin Panel', niSettings: 'System Settings',
    niLogout: 'Sign Out', niActivityLog: 'Activity Log',
    topInventory: 'Stock Inventory', topCalendar: 'Calendar',
    topChemicals: 'Chemical Inventory', topEln: 'Electronic Lab Notebook',
    topOrders: 'Order Lists', topAnalytics: 'Analytics',
    topLabWork: 'Lab Work', topStockLists: 'My Stock Lists',
    topAdmin: 'Admin Panel', topSettings: 'System Settings',
    topActivityLog: 'Activity Log',
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    add: 'Add', create: 'Create', close: 'Close', approve: 'Approve',
    search: 'Search...', loading: 'Loading...', noData: 'No data.',
    required: 'This field is required.',
    settingsMode: 'Settings Mode', exitSettings: 'Exit Settings Mode',
    settingsBanner: '⚙ Settings Mode Active — You can configure system settings',
    sActive: 'Active', sWeak: 'Weak', sLost: 'Lost',
    rAdmin: 'Lab Admin', rPI: 'PI / Advisor', rSenior: 'Senior Researcher', rResearcher: 'Researcher', rStudent: 'Student', rPending: 'Pending',
    saved: 'Saved successfully.',
    saveErr: 'Error saving.',
    approved: 'User approved.',
    statusUpdated: 'Status updated.',
    emailSent: 'Notification sent.',
    emailErr: 'Could not send notification.',
    deleted: 'Deleted.',
    addStockBtn: 'New Stock',
    topDashboard: 'Overview',
    topSystem: 'System Management',
    topTurkeyStocks: 'Drosophila Turkey Stocks',
    niDashboard: 'Overview',
    niSystem: 'System Management',
  }
};

window.t = (k) => T[A.lang]?.[k] ?? k;

// ── THEME ────────────────────────────────────
function applyTheme(theme) {
  A.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('feglims_theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

window.toggleTheme = () => applyTheme(A.theme === 'dark' ? 'light' : 'dark');

// ── LANG ─────────────────────────────────────
window.setLang = (l) => {
  A.lang = l;
  localStorage.setItem('feglims_lang', l);
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active',
      (l === 'tr' && b.dataset.lang === 'tr') ||
      (l === 'en' && b.dataset.lang === 'en')
    );
  });
  applyStaticTranslations();
  if (A.userData) renderSection();
};

function applyStaticTranslations() {
  const map = {
    'loginTagline': 'tagline',
    'googleBtnTxt': 'googleBtn',
    'regTitleEl': 'regTitle',
    'regSubEl': 'regSub',
    'pendTitleEl': 'pendTitle',
    'pendMsgEl': 'pendMsg',
    'ni-inventory-lbl': 'niInventory',
    'ni-calendar-lbl': 'niCalendar',
    'ni-chemicals-lbl': 'niChemicals',
    'ni-eln-lbl': 'niEln',
    'ni-orders-lbl': 'niOrders',
    'ni-analytics-lbl': 'niAnalytics',
    'ni-labwork-lbl': 'niLabWork',
    'ni-stocklists-lbl': 'niStockLists',
    'ni-admin-lbl': 'niAdmin',
    'ni-settings-lbl': 'niSettings',
    'ni-actlog-lbl': 'niActivityLog',
    'ni-logout-lbl': 'niLogout',
    'settingsModeLabel': 'settingsMode',
    'settingsBannerText': 'settingsBanner',
    'addStockBtnTxt': 'addStockBtn',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  });
}

// ── CONNECTIVITY ────────────────────────────
function updateConnStatus() {
  const dot = document.getElementById('connDot');
  const txt = document.getElementById('connTxt');
  const on = navigator.onLine;
  if (dot) dot.className = 'conn-dot' + (on ? '' : ' off');
  if (txt) txt.textContent = t(on ? 'online' : 'offline');
}
window.addEventListener('online', updateConnStatus);
window.addEventListener('offline', updateConnStatus);

// ── SESSION TIMER ───────────────────────────
function startSession() {
  clearInterval(A.sesInt);
  A.sessionSecs = 30 * 60;
  A.sesInt = setInterval(() => {
    A.sessionSecs--;
    const m = String(Math.floor(A.sessionSecs / 60)).padStart(2, '0');
    const s = String(A.sessionSecs % 60).padStart(2, '0');
    const el = document.getElementById('sessionChip');
    if (el) {
      el.textContent = `${m}:${s}`;
      el.classList.toggle('warn', A.sessionSecs < 300);
    }
    if (A.sessionSecs <= 0) doSignOut();
  }, 1000);

  const reset = () => { A.sessionSecs = 30 * 60; };
  ['mousemove', 'keydown', 'click', 'touchstart'].forEach(e =>
    document.addEventListener(e, reset, { passive: true })
  );
}

// ── SETTINGS MODE ───────────────────────────
window.toggleSettingsMode = () => {
  A.settingsMode = !A.settingsMode;
  document.body.classList.toggle('settings-mode', A.settingsMode);
  const btn = document.getElementById('settingsModeBtn');
  const banner = document.getElementById('settingsBanner');
  if (btn) btn.classList.toggle('active', A.settingsMode);
  if (banner) banner.classList.toggle('active', A.settingsMode);
  const label = document.getElementById('settingsModeLabel');
  if (label) label.textContent = A.settingsMode ? t('exitSettings') : t('settingsMode');
};

// ── AUTH ─────────────────────────────────────
document.getElementById('googleSignInBtn').onclick = () =>
  signInWithPopup(auth, gp).catch(e => toast(e.message, 'err'));

window.doSignOut = () => {
  clearInterval(A.sesInt);
  A.unsubs.forEach(u => u && u());
  A.unsubs = [];
  signOut(auth);
};

onAuthStateChanged(auth, async user => {
  if (!user) { showView('loginView'); return; }
  A.user = user;

  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    document.getElementById('reg_name').value = user.displayName || '';
    // Load labs into dropdown
    await loadLabsDropdown();
    showView('regView');
    return;
  }

  A.userData = snap.data();

  if (A.userData.role === 'pending') {
    showView('pendingView');
    return;
  }

  await bootDashboard();
});

window.submitRegistration = async () => {
  const name  = document.getElementById('reg_name').value.trim();
  const labSel = document.getElementById('reg_lab');
  const labId = labSel.value;
  const labName = labSel.options[labSel.selectedIndex]?.text || '';
  const pos   = document.getElementById('reg_pos').value;
  const orcid = document.getElementById('reg_orcid').value.trim();

  if (!name || !labId) { toast(t('required'), 'err'); return; }
  if (orcid && !validateORCID(orcid)) {
    toast('Geçersiz ORCID formatı. Örnek: 0000-0000-0000-0000', 'err'); return;
  }

  await setDoc(doc(db, 'users', A.user.uid), {
    name, labId, labName, requestedRole: pos, orcid,
    email: A.user.email,
    role: 'pending',
    isOwner: isSystemOwner(A.user.email),
    permissions: {},
    permOverrides: {},
    lang: A.lang,
    createdAt: Timestamp.now()
  });

  showView('pendingView');
};

// Load labs from Firestore for registration dropdown
async function loadLabsDropdown() {
  const sel = document.getElementById('reg_lab');
  if (!sel) return;
  const snap = await getDocs(collection(db, 'labs'));
  sel.innerHTML = `<option value="">-- ${A.lang === 'tr' ? 'Seçiniz' : 'Select'} --</option>`;
  snap.docs.forEach(d => {
    const lab = d.data();
    sel.innerHTML += `<option value="${d.id}">${lab.name}</option>`;
  });
}

// ── DASHBOARD BOOT ───────────────────────────
async function bootDashboard() {
  showView('dashboardView');

  // Avatar
  const initials = (A.userData.name || 'U').split(' ')
    .map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('uAvatar').textContent = initials;
  document.getElementById('uName').textContent = A.userData.name || A.user.displayName;
  document.getElementById('sbLab').textContent = A.userData.labName || '';
  document.getElementById('uRole').textContent = t('r' + capitalize(A.userData.role));

  // Determine access levels
  const isAdmin = A.userData.role === 'admin';
  const ownerFlag = isSystemOwner(A.user.email);

  // Store owner flag on APP
  A.isOwner = ownerFlag;

  // Make hasPermission available globally
  window.hasPermission = hasPermission;
  window.ROLES = ROLES;
  window.ROLE_DEFAULTS = ROLE_DEFAULTS;
  window.ALL_PERMS = ALL_PERMS;

  // Admin-only elements
  document.getElementById('adminNavGroup').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('ni-admin').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('ni-settings').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('ni-activitylog').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('settingsModeBtn').style.display = isAdmin ? 'flex' : 'none';

  // System owner-only elements
  const sysNav = document.getElementById('systemNavGroup');
  const sysItem = document.getElementById('ni-system');
  if (sysNav) sysNav.style.display = ownerFlag ? 'block' : 'none';
  if (sysItem) sysItem.style.display = ownerFlag ? 'flex' : 'none';

  // Add stock button - role-based
  const canAdd = hasPermission(A.userData, 'addStock');
  document.getElementById('addStockBtn').classList.toggle('hidden', !canAdd);

  // Theme & lang
  applyTheme(A.theme);
  applyStaticTranslations();
  updateConnStatus();
  startSession();

  // Load system config
  await loadSysConfig();
  await loadCycleRules();

  // Pending badge watcher
  if (isAdmin) watchPendingBadge();

  // Notification bell watcher
  watchNotificationBell();

  // Start with dashboard overview
  nav('dashboard');
}

async function loadSysConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'system'));
    if (snap.exists()) A.sysConfig = snap.data();
  } catch {}
}

async function loadCycleRules() {
  const snap = await getDocs(collection(db, 'cycleRules'));
  A.cycleRules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function watchPendingBadge() {
  const unsub = onSnapshot(collection(db, 'users'), snap => {
    const n = snap.docs.filter(d => d.data().role === 'pending').length;
    const badge = document.getElementById('pendingBadge');
    if (!badge) return;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  });
  A.unsubs.push(unsub);
}

// ── NAVIGATION ───────────────────────────────
window.nav = (section) => {
  A.section = section;

  // Unsubscribe old listeners
  A.unsubs.forEach(u => u && u());
  A.unsubs = [];

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const ni = document.getElementById('ni-' + section);
  if (ni) ni.classList.add('active');

  // Update top title
  const titleMap = {
    dashboard: 'topDashboard',
    inventory: 'topInventory', calendar: 'topCalendar',
    chemicals: 'topChemicals', eln: 'topEln',
    orders: 'topOrders', analytics: 'topAnalytics',
    labwork: 'topLabWork', stocklists: 'topStockLists',
    turkeyStocks: 'topTurkeyStocks',
    admin: 'topAdmin', settings: 'topSettings',
    activitylog: 'topActivityLog', system: 'topSystem',
  };
  document.getElementById('topbarTitle').textContent = t(titleMap[section] || section);

  // Show/hide add stock button
  const showAdd = ['inventory'].includes(section) &&
    (A.userData?.role === 'admin' ||
     A.userData?.role === 'researcher' ||
     A.userData?.permissions?.addStock);
  document.getElementById('addStockBtn').classList.toggle('hidden', !showAdd);

  renderSection();
};

function renderSection() {
  const renders = {
    dashboard:   renderDashboard,
    inventory:   renderInventory,
    calendar:    renderCalendar,
    chemicals:   renderChemicals,
    eln:         renderEln,
    orders:      renderOrders,
    analytics:   renderAnalytics,
    labwork:     renderLabWork,
    stocklists:  renderStockLists,
    turkeyStocks: renderTurkeyStocks,
    admin:       renderAdmin,
    settings:    renderSettings,
    activitylog: renderActivityLog,
    system:      renderSystemPanel,
  };
  const fn = renders[A.section];
  if (fn) fn();
}

// ── ACTIVITY LOG ─────────────────────────────
function renderActivityLog() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select class="fc" id="logActionFilter" style="width:180px" onchange="filterActivityLog()">
          <option value="">Tüm İşlemler / All Actions</option>
          <option value="ADD_STOCK">Stok Ekleme</option>
          <option value="STATUS_CHANGE">Durum Değişikliği</option>
          <option value="APPROVE">Kullanıcı Onayı</option>
          <option value="ADD_CHEM">Kimyasal Ekleme</option>
          <option value="ADD_TASK">Görev Ekleme</option>
          <option value="ELN_ADD">ELN Girişi</option>
          <option value="CONFIG">Konfigürasyon</option>
        </select>
        <input type="date" class="fc" id="logDateFilter" style="width:160px" onchange="filterActivityLog()">
      </div>
      <button class="btn btn-secondary btn-sm" onclick="exportActivityLog()">
        📊 Excel'e Aktar
      </button>
    </div>
    <div class="tbl-wrap">
      <div id="actLogWrap"></div>
    </div>`;

  loadActivityLog();
}

function loadActivityLog(actionFilter = '', dateFilter = '') {
  let q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'));
  const unsub = onSnapshot(q, snap => {
    let logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (A.userData.role !== 'admin') logs = logs.filter(l => l.labId === A.userData.labId);

    const af = document.getElementById('logActionFilter')?.value;
    const df = document.getElementById('logDateFilter')?.value;
    if (af) logs = logs.filter(l => l.action === af);
    if (df) logs = logs.filter(l => {
      const d = l.timestamp?.toDate?.()?.toISOString?.()?.split('T')[0];
      return d === df;
    });

    const el = document.getElementById('actLogWrap');
    if (!el) return;

    if (logs.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('noData')}</div></div>`;
      return;
    }

    const iconMap = {
      'ADD_STOCK': { i: '🔬', c: 'var(--accent)' },
      'STATUS_CHANGE': { i: '⟳', c: 'var(--amber)' },
      'APPROVE': { i: '✅', c: 'var(--accent)' },
      'ADD_CHEM': { i: '🧪', c: 'var(--blue)' },
      'ADD_TASK': { i: '📋', c: 'var(--blue)' },
      'ELN_ADD': { i: '📓', c: 'var(--purple)' },
      'CONFIG': { i: '⚙', c: 'var(--amber)' },
      'DELETE': { i: '🗑', c: 'var(--red)' },
    };

    el.innerHTML = logs.map(l => {
      const ico = iconMap[l.action] || { i: '•', c: 'var(--text3)' };
      return `<div class="log-entry">
        <div class="log-icon" style="background:${ico.c}20;color:${ico.c}">${ico.i}</div>
        <div class="log-body">
          <div class="log-action">${l.action}</div>
          <div class="log-detail">${l.detail} — <span style="color:var(--accent)">${l.userName}</span></div>
        </div>
        <div class="log-time">${fmtDateTime(l.timestamp, A.lang)}</div>
      </div>`;
    }).join('');
  });
  A.unsubs.push(unsub);
}

window.filterActivityLog = () => loadActivityLog();

window.exportActivityLog = async () => {
  toast('Excel hazırlanıyor...', 'info');
  const snap = await getDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')));
  let logs = snap.docs.map(d => d.data());
  if (A.userData.role !== 'admin') logs = logs.filter(l => l.labId === A.userData.labId);
  exportToExcel(logs.map(l => ({
    'İşlem/Action': l.action,
    'Detay/Detail': l.detail,
    'Kullanıcı/User': l.userName,
    'Laboratuvar/Lab': l.lab,
    'Tarih/Date': fmtDateTime(l.timestamp, A.lang),
  })), 'FEGLIMS_ActivityLog');
};

// ── STOCK LISTS ──────────────────────────────
function renderStockLists() {
  const content = document.getElementById('content');
  const isAdmin = A.userData.role === 'admin';
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between">
      <div class="tabs" style="margin:0">
        <div class="tab active" id="sl-tab-mine" onclick="slTab('mine')">
          ${A.lang === 'tr' ? 'Listelerim' : 'My Lists'}
        </div>
        ${isAdmin ? `<div class="tab" id="sl-tab-all" onclick="slTab('all')">
          ${A.lang === 'tr' ? 'Tüm Listeler' : 'All Lists'}
        </div>` : ''}
      </div>
      <button class="btn btn-primary" onclick="openCreateStockList()">
        ＋ ${A.lang === 'tr' ? 'Yeni Liste' : 'New List'}
      </button>
    </div>
    <div id="stockListsWrap"></div>`;
  loadStockLists('mine');
}

window.slTab = (f) => {
  ['mine', 'all'].forEach(k => {
    const el = document.getElementById(`sl-tab-${k}`);
    if (el) el.classList.toggle('active', k === f);
  });
  loadStockLists(f);
};

function loadStockLists(filter) {
  let q = query(collection(db, 'stockLists'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(q, snap => {
    let lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filter === 'mine') {
      lists = lists.filter(l =>
        l.createdBy === A.user.uid ||
        (l.sharedWith && (l.sharedWith === 'all' || l.sharedWith.includes(A.user.uid)))
      );
    }
    const el = document.getElementById('stockListsWrap');
    if (!el) return;
    if (lists.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>
        <div class="empty-text">${A.lang === 'tr' ? 'Henüz liste yok.' : 'No lists yet.'}</div></div>`;
      return;
    }
    el.innerHTML = lists.map(list => {
      const isOwner = list.createdBy === A.user.uid;
      const vis = list.visibility === 'shared'
        ? `<span class="badge b-open">${A.lang === 'tr' ? 'Paylaşımlı' : 'Shared'}</span>`
        : `<span class="badge b-pending">${A.lang === 'tr' ? 'Özel' : 'Private'}</span>`;
      return `<div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:700">${list.title} ${vis}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">
              ${fmtDate(list.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0], A.lang)}
              ${list.notes ? ' · ' + list.notes : ''}
            </div>
          </div>
          <div class="row" style="gap:6px">
            ${isOwner ? `
              <button class="btn btn-secondary btn-sm" onclick="shareStockList('${list.id}')">
                🔗 ${A.lang === 'tr' ? 'Paylaş' : 'Share'}
              </button>
              <button class="btn btn-red btn-sm" onclick="deleteStockList('${list.id}')">🗑</button>
            ` : ''}
          </div>
        </div>
        <div id="sl-items-${list.id}">
          ${(list.items || []).map(item => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:6px">
              <span class="accent-cell">${item.stockCode}</span>
              <span class="dim-cell" style="font-size:12px;flex:1">${item.genotype || ''}</span>
              <span class="badge ${item.status === 'Active' ? 'b-active' : item.status === 'Weak' ? 'b-weak' : 'b-lost'}">${t('s' + item.status)}</span>
              ${isOwner ? `
                <button class="btn btn-secondary btn-xs" onclick="requestStock('${list.id}','${item.stockId}','${item.stockCode}','${item.responsibleUid}','${item.responsibleEmail}','${item.responsibleName}')">
                  📨 ${A.lang === 'tr' ? 'Talep Et' : 'Request'}
                </button>
                <button class="btn btn-red btn-xs" onclick="removeFromStockList('${list.id}','${item.stockId}')">✕</button>
              ` : ''}
            </div>`).join('')}
          ${(list.items || []).length === 0 ? `
            <div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">
              ${A.lang === 'tr' ? 'Liste boş. Envanter\'den stok ekleyin.' : 'List is empty. Add stocks from inventory.'}
            </div>` : ''}
        </div>
      </div>`;
    }).join('');
  });
  A.unsubs.push(unsub);
}

window.openCreateStockList = () => {
  openOverlay('createStockListModal');
};

window.createStockList = async () => {
  const title = document.getElementById('slt_title').value.trim();
  const notes = document.getElementById('slt_notes').value.trim();
  if (!title) { toast(t('required'), 'err'); return; }
  await addDoc(collection(db, 'stockLists'), {
    title, notes,
    createdBy: A.user.uid,
    createdByName: A.userData.name,
    visibility: 'private',
    sharedWith: [],
    items: [],
    labId: A.userData.labId,
    createdAt: Timestamp.now()
  });
  closeOverlay('createStockListModal');
  toast(t('saved'), 'ok');
};

window.addToStockList = async (listId, stock) => {
  const ref = doc(db, 'stockLists', listId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = snap.data().items || [];
  if (items.find(i => i.stockId === stock.id)) {
    toast(A.lang === 'tr' ? 'Bu stok zaten listede.' : 'Stock already in list.', 'warn');
    return;
  }
  items.push({
    stockId: stock.id,
    stockCode: stock.stockCode,
    genotype: stock.genotype,
    status: stock.status,
    responsibleUid: stock.responsibleUid,
    responsibleEmail: stock.responsibleEmail || '',
    responsibleName: stock.responsible,
  });
  await updateDoc(ref, { items });
  toast(t('saved'), 'ok');
};

window.removeFromStockList = async (listId, stockId) => {
  const ref = doc(db, 'stockLists', listId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = (snap.data().items || []).filter(i => i.stockId !== stockId);
  await updateDoc(ref, { items });
};

window.shareStockList = async (listId) => {
  document.getElementById('shareListId').value = listId;
  const snap = await getDoc(doc(db, 'stockLists', listId));
  const d = snap.data();
  document.getElementById('shareVisibility').value = d.visibility || 'private';
  openOverlay('shareStockListModal');
};

window.saveShareSettings = async () => {
  const listId = document.getElementById('shareListId').value;
  const vis = document.getElementById('shareVisibility').value;
  await updateDoc(doc(db, 'stockLists', listId), { visibility: vis, sharedWith: vis === 'all' ? 'all' : [] });
  closeOverlay('shareStockListModal');
  toast(t('saved'), 'ok');
};

window.requestStock = async (listId, stockId, stockCode, responsibleUid, responsibleEmail, responsibleName) => {
  if (!responsibleEmail) { toast(A.lang === 'tr' ? 'Sorumlu e-posta adresi bulunamadı.' : 'Responsible email not found.', 'err'); return; }
  const ok = await sendEmail({
    to_email: responsibleEmail,
    to_name: responsibleName,
    subject: A.lang === 'tr' ? `Stok Talebi: ${stockCode}` : `Stock Request: ${stockCode}`,
    message: A.lang === 'tr'
      ? `Merhaba ${responsibleName},\n\n${A.userData.name} adlı kullanıcı sizden ${stockCode} stok kodlu stoku talep ediyor.\n\nLütfen FEGLIMS üzerinden ilgili kişiyle iletişime geçin.`
      : `Hello ${responsibleName},\n\n${A.userData.name} is requesting stock ${stockCode} from you.\n\nPlease contact them via FEGLIMS.`,
    lab_name: A.userData.labName,
  });
  toast(ok ? t('emailSent') : t('emailErr'), ok ? 'ok' : 'err');
  await auditLog('STOCK_REQUEST', `Requested ${stockCode} from ${responsibleName}`, A.user.uid, A.userData.name, A.userData.labId);
};

window.deleteStockList = async (listId) => {
  if (!confirm(A.lang === 'tr' ? 'Liste silinsin mi?' : 'Delete this list?')) return;
  await deleteDoc(doc(db, 'stockLists', listId));
  toast(t('deleted'), 'info');
};

// exportToExcel is now imported from firebase.js

// ── MODAL HELPERS ────────────────────────────
window.openOverlay = (id) => {
  document.getElementById(id)?.classList.add('open');
};
window.closeOverlay = (id) => {
  document.getElementById(id)?.classList.remove('open');
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) {
    e.target.classList.remove('open');
  }
});

// ── TOAST ─────────────────────────────────────
window.toast = (msg, type = 'info') => {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { ok: '✅', err: '❌', info: 'ℹ️', warn: '⚠️' };
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};

// ── VIEW HELPER ──────────────────────────────
window.showView = (id) => {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
};

// ── UTILS ─────────────────────────────────────
// capitalize and exportToExcel are now in firebase.js
window.capitalize = capitalize;
window.exportToExcel = exportToExcel;
window.fmtDate = fmtDate;
window.fmtDateTime = fmtDateTime;
window.addDays = addDays;
window.todayISO = todayISO;
window.auditLog = auditLog;
window.sendEmail = sendEmail;

// ── DASHBOARD ────────────────────────────────
function renderDashboard() {
  const content = document.getElementById('content');
  const labId = A.userData.labId;
  const canAssign = hasPermission(A.userData, 'assignTasks');

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px">
      <div class="card" id="dash-stocks"><div class="card-title">🔬 ${A.lang==='tr'?'Stoklar':'Stocks'}</div><div class="empty-text">${t('loading')}</div></div>
      <div class="card" id="dash-mytasks"><div class="card-title">📋 ${A.lang==='tr'?'Görevlerim':'My Tasks'}</div><div class="empty-text">${t('loading')}</div></div>
      <div class="card" id="dash-reminders"><div class="card-title">⏰ ${A.lang==='tr'?'Hatırlatmalar':'Reminders'}</div><div class="empty-text">${t('loading')}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px">
      ${canAssign ? `<div class="card" id="dash-assignedtasks"><div class="card-title">📤 ${A.lang==='tr'?'Atadığım Görevler':'Tasks I Assigned'}</div><div class="empty-text">${t('loading')}</div></div>` : ''}
      <div class="card" id="dash-notifs"><div class="card-title">🔔 ${A.lang==='tr'?'Son Bildirimler':'Recent Notifications'}</div><div class="empty-text">${t('loading')}</div></div>
      <div class="card" id="dash-activity"><div class="card-title">📝 ${A.lang==='tr'?'Son Aktiviteler':'Recent Activity'}</div><div class="empty-text">${t('loading')}</div></div>
    </div>`;

  // Stock summary
  const sq = query(collection(db, 'stocks'), where('labId', '==', labId));
  getDocs(sq).then(snap => {
    const stocks = snap.docs.map(d => d.data());
    const active = stocks.filter(s => s.status === 'Active').length;
    const weak = stocks.filter(s => s.status === 'Weak').length;
    const lost = stocks.filter(s => s.status === 'Lost').length;
    document.getElementById('dash-stocks').innerHTML = `
      <div class="card-title">🔬 ${A.lang==='tr'?'Stoklar':'Stocks'}</div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent)">${active}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Aktif':'Active'}</div></div>
        <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--amber)">${weak}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Zayıf':'Weak'}</div></div>
        <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--red)">${lost}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Kayıp':'Lost'}</div></div>
        <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--text2)">${stocks.length}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Toplam':'Total'}</div></div>
      </div>`;
  });

  // My tasks (assigned TO me)
  getDocs(query(collection(db, 'tasks'), where('assignedToUid', '==', A.user.uid), orderBy('createdAt', 'desc'))).then(snap => {
    const tasks = snap.docs.map(d => d.data()).filter(t => t.status !== 'completed' && t.status !== 'cancelled').slice(0, 6);
    const el = document.getElementById('dash-mytasks');
    el.innerHTML = `<div class="card-title">📋 ${A.lang==='tr'?'Görevlerim':'My Tasks'}</div>`;
    if (tasks.length === 0) { el.innerHTML += `<div class="dim-cell" style="font-size:13px;padding:8px 0">${A.lang==='tr'?'Atanmış görev yok':'No assigned tasks'}</div>`; return; }
    el.innerHTML += tasks.map(t => `
      <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${t.priority==='urgent'?'b-lost':t.priority==='high'?'b-weak':'b-active'}" style="font-size:10px">${t.priority}</span>
          <span class="fw-bold">${t.title}</span>
        </div>
        <div class="dim-cell" style="font-size:11px;margin-top:2px">
          ${A.lang==='tr'?'Atayan':'By'}: ${t.assignedBy||'—'}
          ${t.dueDate ? ` · ${fmtDate(t.dueDate, A.lang)}` : ''}
        </div>
      </div>`).join('');
  }).catch(() => {});

  // Tasks I assigned (assigned BY me)
  if (canAssign) {
    getDocs(query(collection(db, 'tasks'), where('assignedByUid', '==', A.user.uid), orderBy('createdAt', 'desc'))).then(snap => {
      const tasks = snap.docs.map(d => d.data()).slice(0, 6);
      const el = document.getElementById('dash-assignedtasks');
      if (!el) return;
      const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
      const done = tasks.filter(t => t.status === 'completed').length;
      el.innerHTML = `<div class="card-title">📤 ${A.lang==='tr'?'Atadığım Görevler':'Tasks I Assigned'} <span class="dim-cell" style="font-size:11px">(${done}/${tasks.length} ${A.lang==='tr'?'tamamlandı':'done'})</span></div>`;
      if (tasks.length === 0) { el.innerHTML += `<div class="dim-cell" style="font-size:13px;padding:8px 0">${t('noData')}</div>`; return; }
      el.innerHTML += tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').slice(0, 5).map(t => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge ${t.status==='inprogress'?'b-open':'b-pending'}" style="font-size:10px">${t.status}</span>
            <span class="fw-bold">${t.title}</span>
          </div>
          <div class="dim-cell" style="font-size:11px;margin-top:2px">
            → ${t.assignedToName||'—'}
            ${t.dueDate ? ` · ${fmtDate(t.dueDate, A.lang)}` : ''}
          </div>
        </div>`).join('');
    }).catch(() => {});
  }

  // Reminders
  const today = todayISO();
  getDocs(sq).then(snap => {
    const reminders = snap.docs.map(d => ({id: d.id, ...d.data()}))
      .filter(s => s.status === 'Active' && s.removalDate && s.removalDate <= today);
    const el = document.getElementById('dash-reminders');
    el.innerHTML = `<div class="card-title">⏰ ${A.lang==='tr'?'Ergin Atımı Hatırlatmaları':'Removal Reminders'}</div>`;
    if (reminders.length === 0) { el.innerHTML += `<div class="dim-cell" style="font-size:13px;padding:8px 0">${A.lang==='tr'?'Bugün hatırlatma yok':'No reminders today'}</div>`; return; }
    el.innerHTML += reminders.slice(0, 8).map(s => `
      <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between">
        <span class="accent-cell">${s.stockCode}</span>
        <span class="amber-cell">${fmtDate(s.removalDate, A.lang)}</span>
        <span class="dim-cell">${s.responsible || '—'}</span>
      </div>`).join('');
  });

  // Recent notifications
  const nq = query(collection(db, 'notifications'), where('labId', '==', labId), orderBy('createdAt', 'desc'));
  getDocs(nq).then(snap => {
    const notifs = snap.docs.map(d => d.data()).slice(0, 5);
    const el = document.getElementById('dash-notifs');
    el.innerHTML = `<div class="card-title">🔔 ${A.lang==='tr'?'Son Bildirimler':'Recent Notifications'}</div>`;
    if (notifs.length === 0) { el.innerHTML += `<div class="dim-cell" style="font-size:13px;padding:8px 0">${t('noData')}</div>`; return; }
    el.innerHTML += notifs.map(n => `
      <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        ${n.newStatus==='Lost'?'❌':'⚠️'} <span class="accent-cell">${n.stockCode}</span> → <span class="badge ${n.newStatus==='Lost'?'b-lost':'b-weak'}">${n.newStatus}</span>
        <span class="dim-cell" style="margin-left:6px">${n.changedBy}</span>
      </div>`).join('');
  }).catch(() => {});

  // Recent activity
  const aq = query(collection(db, 'auditLog'), where('labId', '==', labId), orderBy('timestamp', 'desc'));
  getDocs(aq).then(snap => {
    const logs = snap.docs.map(d => d.data()).slice(0, 5);
    const el = document.getElementById('dash-activity');
    el.innerHTML = `<div class="card-title">📝 ${A.lang==='tr'?'Son Aktiviteler':'Recent Activity'}</div>`;
    if (logs.length === 0) { el.innerHTML += `<div class="dim-cell" style="font-size:13px;padding:8px 0">${t('noData')}</div>`; return; }
    el.innerHTML += logs.map(l => `
      <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="color:var(--accent)">${l.userName}</span> · ${l.action} · <span class="dim-cell">${fmtDateTime(l.timestamp, A.lang)}</span>
      </div>`).join('');
  }).catch(() => {});
}

// ── NOTIFICATION BELL ────────────────────────
function watchNotificationBell() {
  const labId = A.userData.labId;
  if (!labId) return;
  const nq = query(collection(db, 'notifications'), where('labId', '==', labId), where('read', '==', false));
  const unsub = onSnapshot(nq, snap => {
    const count = snap.size;
    const badge = document.getElementById('notifBellBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  });
  A.unsubs.push(unsub);
}

window.toggleNotifDropdown = async () => {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (!dd.classList.contains('open')) return;

  const labId = A.userData.labId;
  const snap = await getDocs(query(collection(db, 'notifications'), where('labId', '==', labId), orderBy('createdAt', 'desc')));
  const notifs = snap.docs.map(d => ({id: d.id, ...d.data()})).slice(0, 10);

  dd.innerHTML = notifs.length === 0
    ? `<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">${A.lang==='tr'?'Bildirim yok':'No notifications'}</div>`
    : notifs.map(n => `
      <div class="notif-item ${n.read?'':'notif-unread'}" onclick="markNotifReadFromBell('${n.id}')">
        <div style="font-size:12px">
          ${n.newStatus==='Lost'?'❌':'⚠️'} <strong>${n.stockCode}</strong> → ${n.newStatus}
        </div>
        <div style="font-size:11px;color:var(--text3)">${n.changedBy} · ${fmtDateTime(n.createdAt, A.lang)}</div>
      </div>`).join('');
};

window.markNotifReadFromBell = async (id) => {
  await updateDoc(doc(db, 'notifications', id), { read: true });
};

// ── SYSTEM PANEL (Owner only) ────────────────
function renderSystemPanel() {
  if (!A.isOwner) { nav('dashboard'); return; }
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="tabs" style="margin-bottom:18px">
      <div class="tab active" id="sys-tab-labs" onclick="sysTab('labs')">🏢 ${A.lang==='tr'?'Laboratuvarlar':'Laboratories'}</div>
      <div class="tab" id="sys-tab-admins" onclick="sysTab('admins')">👑 ${A.lang==='tr'?'Lab Adminleri':'Lab Admins'}</div>
      <div class="tab" id="sys-tab-allactivity" onclick="sysTab('allactivity')">📋 ${A.lang==='tr'?'Tüm Aktiviteler':'All Activity'}</div>
    </div>
    <div id="sysContent"></div>`;
  sysTab('labs');
}

window.sysTab = (t) => {
  ['labs','admins','allactivity'].forEach(k => document.getElementById(`sys-tab-${k}`)?.classList.toggle('active', k===t));
  if (t === 'labs') loadSystemLabs();
  else if (t === 'admins') loadSystemAdmins();
  else if (t === 'allactivity') loadAllActivity();
};

async function loadSystemLabs() {
  const el = document.getElementById('sysContent');
  const snap = await getDocs(collection(db, 'labs'));
  const labs = snap.docs.map(d => ({id: d.id, ...d.data()}));
  el.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div style="font-size:13px;color:var(--text2)">${A.lang==='tr'?'Sisteme kayıtlı laboratuvarlar':'Registered laboratories'}</div>
      <button class="btn btn-primary btn-sm" onclick="openAddLabModal()">＋ ${A.lang==='tr'?'Lab Ekle':'Add Lab'}</button>
    </div>
    <div class="tbl-wrap"><table><thead><tr>
      <th>${A.lang==='tr'?'Lab ID':'Lab ID'}</th><th>${A.lang==='tr'?'Ad':'Name'}</th>
      <th>${A.lang==='tr'?'Kurum':'Institution'}</th><th>${A.lang==='tr'?'Admin':'Admin'}</th><th></th>
    </tr></thead><tbody>
    ${labs.map(l => `<tr>
      <td class="mono-cell">${l.id}</td>
      <td class="fw-bold">${l.name}</td>
      <td class="dim-cell">${l.institution || '—'}</td>
      <td class="dim-cell">${l.adminName || '—'}</td>
      <td><button class="btn btn-red btn-xs" onclick="deleteLab('${l.id}','${l.name}')">🗑</button></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

window.openAddLabModal = () => openOverlay('addLabModal');

window.saveNewLab = async () => {
  const id = document.getElementById('newLabId').value.trim();
  const name = document.getElementById('newLabName').value.trim();
  const inst = document.getElementById('newLabInst').value.trim();
  if (!id || !name) { toast(t('required'), 'err'); return; }
  await setDoc(doc(db, 'labs', id), { name, institution: inst, createdAt: Timestamp.now(), adminName: '', adminEmail: '' });
  await auditLog('ADD_LAB', `Added lab: ${name} (${id})`, A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('addLabModal');
  toast(t('saved'), 'ok');
  loadSystemLabs();
};

window.deleteLab = async (id, name) => {
  if (!confirm(`${name} ${A.lang==='tr'?'silinsin mi?':'delete?'}`)) return;
  await deleteDoc(doc(db, 'labs', id));
  await auditLog('DELETE_LAB', `Deleted lab: ${name}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(t('deleted'), 'info');
  loadSystemLabs();
};

async function loadSystemAdmins() {
  const el = document.getElementById('sysContent');
  const snap = await getDocs(collection(db, 'users'));
  const admins = snap.docs.map(d => ({uid: d.id, ...d.data()})).filter(u => u.role === 'admin');
  el.innerHTML = `<div class="tbl-wrap"><table><thead><tr>
    <th>${A.lang==='tr'?'Ad':'Name'}</th><th>E-posta</th><th>${A.lang==='tr'?'Lab':'Lab'}</th><th></th>
  </tr></thead><tbody>
  ${admins.map(a => `<tr>
    <td class="fw-bold">${a.name}</td>
    <td class="dim-cell">${a.email}</td>
    <td class="dim-cell">${a.labName || '—'}</td>
    <td>${a.email !== OWNER_EMAIL ? `<button class="btn btn-secondary btn-xs" onclick="demoteAdmin('${a.uid}','${a.name}')">↓ ${A.lang==='tr'?'İndir':'Demote'}</button>` : `<span class="badge b-admin">Owner</span>`}</td>
  </tr>`).join('')}
  </tbody></table></div>`;
}

window.demoteAdmin = async (uid, name) => {
  if (!confirm(`${name} → Araştırmacı?`)) return;
  await updateDoc(doc(db, 'users', uid), { role: 'researcher' });
  toast(t('saved'), 'ok');
  loadSystemAdmins();
};

async function loadAllActivity() {
  const el = document.getElementById('sysContent');
  const snap = await getDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')));
  const logs = snap.docs.map(d => d.data()).slice(0, 50);
  el.innerHTML = logs.map(l => `
    <div class="log-entry">
      <div class="log-body">
        <div class="log-action">${l.action} <span class="dim-cell">[${l.labId || '—'}]</span></div>
        <div class="log-detail">${l.detail} — <span style="color:var(--accent)">${l.userName}</span></div>
      </div>
      <div class="log-time">${fmtDateTime(l.timestamp, A.lang)}</div>
    </div>`).join('');
}

// ── REMINDER CHECK (Ergin Atımı / Transfer) ──
async function checkAndSendReminders() {
  if (A.userData.role !== 'admin') return;
  const today = todayISO();
  const labId = A.userData.labId;
  const snap = await getDocs(query(collection(db, 'stocks'), where('labId', '==', labId), where('status', '==', 'Active')));
  const dueStocks = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(s => s.removalDate === today);

  for (const s of dueStocks) {
    // Check if reminder already sent today
    const remKey = `reminder_${s.id}_${today}`;
    if (sessionStorage.getItem(remKey)) continue;
    sessionStorage.setItem(remKey, '1');

    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      type: 'REMOVAL_REMINDER', stockId: s.id,
      stockCode: s.stockCode, labId,
      message: A.lang === 'tr'
        ? `${s.stockCode} için ergin atımı zamanı geldi!`
        : `Time for parent removal of ${s.stockCode}!`,
      read: false, createdAt: Timestamp.now()
    });

    // Send email to responsible researcher
    if (s.responsibleEmail) {
      sendEmail({
        to_email: s.responsibleEmail,
        to_name: s.responsible || '',
        subject: A.lang === 'tr' ? `⏰ Ergin Atımı: ${s.stockCode}` : `⏰ Parent Removal: ${s.stockCode}`,
        message: A.lang === 'tr'
          ? `Merhaba ${s.responsible},\n\n${s.stockCode} stok kodlu stok için ergin atımı zamanı geldi.\n\nSıcaklık: ${s.climate}°C\nStok Günü: ${s.stockDate}`
          : `Hello ${s.responsible},\n\nParent removal is due for stock ${s.stockCode}.\n\nTemp: ${s.climate}°C\nStock Date: ${s.stockDate}`,
        lab_name: A.userData.labName,
      });
    }
  }
}
// Run reminder check on boot
setTimeout(() => checkAndSendReminders(), 3000);

// ── DROSOPHILA TÜRKİYE STOCKS ───────────────
function renderTurkeyStocks() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="search-wrap" style="max-width:280px;flex:1">
        <span class="search-icon">🔍</span>
        <input class="search-input" placeholder="${A.lang==='tr'?'Kod, genotip, tür, soy ara...':'Search code, genotype, species, lineage...'}" id="tsSearch" oninput="filterTurkeyStocks()">
      </div>
      <select class="fc btn-sm" id="tsLabFilter" style="width:180px" onchange="filterTurkeyStocks()">
        <option value="">${A.lang==='tr'?'Tüm Laboratuvarlar':'All Labs'}</option>
      </select>
      <select class="fc btn-sm" id="tsLineageFilter" style="width:160px" onchange="filterTurkeyStocks()">
        <option value="">${A.lang==='tr'?'Tüm Soylar':'All Lineages'}</option>
        <option>Wild-type</option><option>Isogenic</option><option>Balancer</option>
        <option>Genome Editing</option><option>Disease Model</option>
        <option>Transposon</option><option>RNAi</option><option>GAL4</option>
      </select>
      <select class="fc btn-sm" id="tsSpeciesFilter" style="width:160px" onchange="filterTurkeyStocks()">
        <option value="">${A.lang==='tr'?'Tüm Türler':'All Species'}</option>
        <option>D. melanogaster</option><option>D. simulans</option>
        <option>D. virilis</option><option>D. pseudoobscura</option>
      </select>
    </div>
    <div id="tsWrap"><div style="text-align:center;padding:40px;color:var(--text3)">${t('loading')}</div></div>`;

  loadTurkeyStocks();
}

async function loadTurkeyStocks() {
  // Fetch ALL active stocks from ALL labs
  const snap = await getDocs(query(collection(db, 'stocks'), orderBy('createdAt', 'desc')));
  window._tsAllStocks = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(s => s.status === 'Active');

  // Load labs for filter dropdown
  const labSnap = await getDocs(collection(db, 'labs'));
  const labSel = document.getElementById('tsLabFilter');
  if (labSel) {
    labSnap.docs.forEach(d => {
      const lab = d.data();
      labSel.innerHTML += `<option value="${d.id}">${lab.name}</option>`;
    });
  }
  filterTurkeyStocks();
}

window.filterTurkeyStocks = () => {
  const search = (document.getElementById('tsSearch')?.value || '').toLowerCase();
  const labF = document.getElementById('tsLabFilter')?.value || '';
  const lineageF = document.getElementById('tsLineageFilter')?.value || '';
  const speciesF = document.getElementById('tsSpeciesFilter')?.value || '';

  let rows = window._tsAllStocks || [];
  if (labF) rows = rows.filter(r => r.labId === labF);
  if (lineageF) rows = rows.filter(r => r.lineage === lineageF);
  if (speciesF) rows = rows.filter(r => r.species === speciesF);
  if (search) rows = rows.filter(r =>
    (r.stockCode||'').toLowerCase().includes(search) ||
    (r.genotype||'').toLowerCase().includes(search) ||
    (r.species||'').toLowerCase().includes(search) ||
    (r.lineage||'').toLowerCase().includes(search) ||
    (r.labName||'').toLowerCase().includes(search)
  );

  const el = document.getElementById('tsWrap');
  if (!el) return;
  if (rows.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🪰</div><div class="empty-text">${t('noData')}</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="dim-cell" style="font-size:12px;margin-bottom:8px">${rows.length} ${A.lang==='tr'?'stok bulundu':'stocks found'}</div>
    <div class="tbl-wrap" style="overflow-x:auto"><table>
    <thead><tr>
      <th>${A.lang==='tr'?'Kod':'Code'}</th><th>${A.lang==='tr'?'Tür':'Species'}</th>
      <th>${A.lang==='tr'?'Soy':'Lineage'}</th><th>${A.lang==='tr'?'Genotip':'Genotype'}</th>
      <th>${A.lang==='tr'?'Merkez':'Center'}</th><th>°C</th>
      <th>${A.lang==='tr'?'Lab':'Lab'}</th><th>${A.lang==='tr'?'Sorumlu':'Responsible'}</th><th></th>
    </tr></thead>
    <tbody>${rows.map(s => `
      <tr>
        <td class="accent-cell">${s.stockCode}</td>
        <td class="dim-cell" style="font-size:12px">${s.species||'—'}</td>
        <td class="dim-cell">${s.lineage||'—'}</td>
        <td class="truncate dim-cell" style="max-width:200px;font-size:12px" title="${s.genotype||''}">${s.genotype||'—'}</td>
        <td class="dim-cell">${s.center||'—'}</td>
        <td class="mono-cell">${s.climate||'—'}°C</td>
        <td class="dim-cell" style="font-size:12px">${s.labName||'—'}</td>
        <td class="dim-cell" style="font-size:12px">${s.responsible||'—'}</td>
        <td>
          ${s.labId !== A.userData.labId ? `
            <button class="btn btn-secondary btn-xs" onclick="requestTurkeyStock('${s.stockCode}','${s.responsibleEmail||''}','${s.responsible||''}','${s.labName||''}')">
              📨 ${A.lang==='tr'?'Talep Et':'Request'}
            </button>` : `<span class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Kendi labınız':'Your lab'}</span>`}
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;
};

window.requestTurkeyStock = async (stockCode, email, name, labName) => {
  if (!email) { toast(A.lang==='tr'?'E-posta adresi bulunamadı':'Email not found', 'err'); return; }
  const ok = await sendEmail({
    to_email: email, to_name: name,
    subject: A.lang==='tr' ? `🪰 Stok Talebi: ${stockCode}` : `🪰 Stock Request: ${stockCode}`,
    message: A.lang==='tr'
      ? `Merhaba ${name},\n\n${A.userData.name} (${A.userData.labName}) sizden ${stockCode} stok kodlu stoku talep ediyor.\n\nLütfen FEGLIMS üzerinden yanıt verin.`
      : `Hello ${name},\n\n${A.userData.name} (${A.userData.labName}) is requesting stock ${stockCode} from you.\n\nPlease respond via FEGLIMS.`,
    lab_name: A.userData.labName,
  });
  toast(ok ? t('emailSent') : t('emailErr'), ok ? 'ok' : 'err');
  await auditLog('TURKEY_STOCK_REQUEST', `Requested ${stockCode} from ${labName}/${name}`, A.user.uid, A.userData.name, A.userData.labId);
};

// ── INIT ──────────────────────────────────────
applyTheme(A.theme);
document.getElementById('themeToggle').onclick = toggleTheme;
updateConnStatus();
applyStaticTranslations();

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
