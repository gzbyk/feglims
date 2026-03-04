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
    topImport: 'Veri İçe Aktar',
    topAllUsers: 'Tüm Kullanıcılar',
    topGlobalLog: 'Global Aktivite Kaydı',
    niDashboard: 'Genel Bakış',
    niSystem: 'Lab Yönetimi',
    niImport: 'Veri İçe Aktar',
    niAllUsers: 'Tüm Kullanıcılar',
    niGlobalLog: 'Global Aktivite',
    // Import
    importSuccess: 'İçe aktarma başarılı!',
    importErr: 'İçe aktarma hatası.',
    importRows: 'satır içe aktarıldı.',
    // Versioning
    versionSaved: 'Önceki değerler kaydedildi.',
    // Backup
    topBackup: 'Yedekleme & Geri Yükleme',
    niBackup: 'Yedekleme',
    backupSuccess: 'Yedek başarıyla oluşturuldu.',
    restoreSuccess: 'Geri yükleme başarılı.',
    // Saved searches
    searchSaved: 'Arama kaydedildi.',
    searchDeleted: 'Kayıtlı arama silindi.',
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
    topImport: 'Data Import',
    topAllUsers: 'All Users',
    topGlobalLog: 'Global Activity Log',
    niDashboard: 'Overview',
    niSystem: 'Lab Management',
    niImport: 'Data Import',
    niAllUsers: 'All Users',
    niGlobalLog: 'Global Activity',
    importSuccess: 'Import successful!',
    importErr: 'Import error.',
    importRows: 'rows imported.',
    versionSaved: 'Previous values saved.',
    topBackup: 'Backup & Restore',
    niBackup: 'Backup',
    backupSuccess: 'Backup created successfully.',
    restoreSuccess: 'Restore completed successfully.',
    searchSaved: 'Search saved.',
    searchDeleted: 'Saved search deleted.',
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
    'ni-import-lbl': 'niImport',
    'ni-system-lbl': 'niSystem',
    'ni-allusers-lbl': 'niAllUsers',
    'ni-globallog-lbl': 'niGlobalLog',
    'ni-backup-lbl': 'niBackup',
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

// ── MOBILE SIDEBAR ──────────────────────────
window.toggleMobileSidebar = () => {
  const sidebar = document.getElementById('mainSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('mobile-open');
  if (overlay) overlay.classList.toggle('active');
};

// Close sidebar on nav click (mobile)
const origNav = window.nav;

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

  // Admin-only elements (Lab Admin panel)
  const showAdmin = isAdmin || ownerFlag;
  document.getElementById('adminNavGroup').style.display = showAdmin ? 'block' : 'none';
  document.getElementById('ni-admin').style.display = showAdmin ? 'flex' : 'none';
  document.getElementById('ni-settings').style.display = showAdmin ? 'flex' : 'none';
  document.getElementById('ni-activitylog').style.display = showAdmin ? 'flex' : 'none';
  document.getElementById('ni-import').style.display = showAdmin ? 'flex' : 'none';
  document.getElementById('ni-backup').style.display = showAdmin ? 'flex' : 'none';
  document.getElementById('settingsModeBtn').style.display = showAdmin ? 'flex' : 'none';

  // System owner-only elements (separate section)
  const sysNav = document.getElementById('systemNavGroup');
  const sysItem = document.getElementById('ni-system');
  const allUsersItem = document.getElementById('ni-allusers');
  const globalLogItem = document.getElementById('ni-globallog');
  if (sysNav) sysNav.style.display = ownerFlag ? 'block' : 'none';
  if (sysItem) sysItem.style.display = ownerFlag ? 'flex' : 'none';
  if (allUsersItem) allUsersItem.style.display = ownerFlag ? 'flex' : 'none';
  if (globalLogItem) globalLogItem.style.display = ownerFlag ? 'flex' : 'none';

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

  // Try to init Google Calendar API
  if (window.gapi) {
    try {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: 'AIzaSyBYAvyFWL0o9vtw7bwWQqmDsathUJmS_0Q',
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
          });
          A.gapiReady = true;
        } catch { A.gapiReady = false; }
      });
    } catch { A.gapiReady = false; }
  }

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

  // Close mobile sidebar
  document.getElementById('mainSidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');

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
    import: 'topImport', allusers: 'topAllUsers', globallog: 'topGlobalLog',
    backup: 'topBackup',
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
    import:      renderImportPanel,
    allusers:    renderAllUsersPanel,
    globallog:   renderGlobalActivityLog,
    backup:      renderBackupPanel,
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

// ── IMPORT PANEL ─────────────────────────────
function renderImportPanel() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="alert alert-blue" style="margin-bottom:20px">
      <div class="alert-icon">📥</div>
      <div class="alert-body">
        <div class="alert-title">${A.lang==='tr'?'Veri İçe Aktarma':'Data Import'}</div>
        <div class="alert-msg">${A.lang==='tr'
          ?'Excel (.xlsx/.xls) veya CSV dosyasından toplu veri yükleyebilirsiniz. Sütun eşleştirme ile verileri doğru alanlara aktarın.'
          :'Import bulk data from Excel (.xlsx/.xls) or CSV files. Map columns to the correct fields.'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
      <div class="card" style="cursor:pointer;text-align:center;padding:32px" onclick="openExcelImport('stock')">
        <div style="font-size:40px;margin-bottom:12px">🔬</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${A.lang==='tr'?'Stok İçe Aktar':'Import Stocks'}</div>
        <div class="dim-cell" style="font-size:12px">${A.lang==='tr'?'Drosophila stok verilerini Excel\'den yükleyin':'Load Drosophila stock data from Excel'}</div>
      </div>
      <div class="card" style="cursor:pointer;text-align:center;padding:32px" onclick="openExcelImport('chemical')">
        <div style="font-size:40px;margin-bottom:12px">🧪</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${A.lang==='tr'?'Kimyasal İçe Aktar':'Import Chemicals'}</div>
        <div class="dim-cell" style="font-size:12px">${A.lang==='tr'?'Kimyasal envanter verilerini Excel\'den yükleyin':'Load chemical inventory from Excel'}</div>
      </div>
      <div class="card" style="cursor:pointer;text-align:center;padding:32px" onclick="openExcelImport('eln')">
        <div style="font-size:40px;margin-bottom:12px">📓</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${A.lang==='tr'?'ELN İçe Aktar':'Import ELN'}</div>
        <div class="dim-cell" style="font-size:12px">${A.lang==='tr'?'Lab defteri kayıtlarını Excel\'den yükleyin':'Load lab notebook entries from Excel'}</div>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-title">🔄 ${A.lang==='tr'?'Toplu Güncelleme':'Bulk Update'}</div>
      <div class="dim-cell" style="font-size:12px;margin:8px 0">${A.lang==='tr'
        ?'Mevcut stokları Excel\'den güncelleyin. Stok Kodu ile eşleşen kayıtlar güncellenir, yeni olanlar eklenir.'
        :'Update existing stocks from Excel. Records matching by Stock Code are updated, new ones are created.'}</div>
      <button class="btn btn-primary btn-sm" onclick="openBulkStockUpdate()">🔄 ${A.lang==='tr'?'Toplu Stok Güncelleme':'Bulk Stock Update'}</button>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-title">📋 ${A.lang==='tr'?'Şablon İndir':'Download Template'}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-secondary btn-sm" onclick="downloadImportTemplate('stock')">🔬 Stok Şablonu</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadImportTemplate('chemical')">🧪 Kimyasal Şablonu</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadImportTemplate('eln')">📓 ELN Şablonu</button>
      </div>
    </div>`;
}

// Excel Import Logic
const IMPORT_FIELDS = {
  stock: [
    { key: 'stockCode', label: 'Stok Kodu / Stock Code', required: true },
    { key: 'species', label: 'Tür / Species', required: false },
    { key: 'genotype', label: 'Genotip / Genotype', required: false },
    { key: 'lineage', label: 'Soy / Lineage', required: false },
    { key: 'center', label: 'Merkez / Center', required: false },
    { key: 'climate', label: 'Sıcaklık / Temp (°C)', required: false },
    { key: 'status', label: 'Durum / Status', required: false },
    { key: 'stockDate', label: 'Stok Günü / Stock Date', required: false },
    { key: 'removalDate', label: 'Ergin Atımı / Removal Date', required: false },
    { key: 'responsible', label: 'Sorumlu / Responsible', required: false },
    { key: 'notes', label: 'Notlar / Notes', required: false },
  ],
  chemical: [
    { key: 'name', label: 'Kimyasal Adı / Name', required: true },
    { key: 'casNo', label: 'CAS No', required: false },
    { key: 'ghsClasses', label: 'GHS Sınıfları / Classes', required: false },
    { key: 'amount', label: 'Miktar / Amount', required: false },
    { key: 'unit', label: 'Birim / Unit', required: false },
    { key: 'location', label: 'Konum / Location', required: false },
    { key: 'expiryDate', label: 'Son Kullanma / Expiry', required: false },
    { key: 'responsible', label: 'Sorumlu / Responsible', required: false },
    { key: 'notes', label: 'Notlar / Notes', required: false },
  ],
  eln: [
    { key: 'title', label: 'Başlık / Title', required: true },
    { key: 'content', label: 'İçerik / Content', required: false },
    { key: 'tags', label: 'Etiketler / Tags', required: false },
    { key: 'linkedStock', label: 'Bağlı Stok / Linked Stock', required: false },
  ],
};

let importState = { step: 1, data: [], headers: [], mapping: {}, target: 'stock' };

window.openExcelImport = (target) => {
  importState = { step: 1, data: [], headers: [], mapping: {}, target };
  document.getElementById('imp_target').value = target;
  const titles = { stock: '🔬 Stok İçe Aktar', chemical: '🧪 Kimyasal İçe Aktar', eln: '📓 ELN İçe Aktar' };
  document.getElementById('importModalTitle').textContent = titles[target] || 'Import';
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep3').style.display = 'none';
  document.getElementById('importNextBtn').style.display = 'none';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importDoBtn').style.display = 'none';
  document.getElementById('importFileInfo').style.display = 'none';
  document.getElementById('importFileInput').value = '';
  openOverlay('excelImportModal');
};

window.handleImportFile = (file) => {
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    toast(A.lang==='tr'?'Desteklenmeyen dosya formatı':'Unsupported file format', 'err');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (json.length < 2) { toast(A.lang==='tr'?'Dosyada veri yok':'No data in file', 'err'); return; }
      importState.headers = json[0].map(h => String(h || '').trim());
      importState.data = json.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
      document.getElementById('importFileName').textContent = file.name;
      document.getElementById('importRowCount').textContent = `${importState.data.length} ${A.lang==='tr'?'satır bulundu':'rows found'}`;
      document.getElementById('importFileInfo').style.display = '';
      document.getElementById('importNextBtn').style.display = '';
      // Auto-map columns
      autoMapColumns();
    } catch (err) {
      toast('Dosya okunamadı: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
};

function autoMapColumns() {
  const fields = IMPORT_FIELDS[importState.target] || [];
  const headers = importState.headers.map(h => h.toLowerCase());
  importState.mapping = {};
  fields.forEach(f => {
    const idx = headers.findIndex(h =>
      h.includes(f.key.toLowerCase()) ||
      h.includes(f.label.split('/')[0].trim().toLowerCase()) ||
      h.includes(f.label.split('/')[1]?.trim().toLowerCase() || '___')
    );
    if (idx >= 0) importState.mapping[f.key] = idx;
  });
}

window.importNext = () => {
  if (importState.step === 1) {
    importState.step = 2;
    showImportStep2();
  } else if (importState.step === 2) {
    // Validate required mappings
    const fields = IMPORT_FIELDS[importState.target] || [];
    const missing = fields.filter(f => f.required && importState.mapping[f.key] === undefined);
    if (missing.length > 0) {
      toast(`${A.lang==='tr'?'Zorunlu alanları eşleştirin':'Map required fields'}: ${missing.map(f=>f.label).join(', ')}`, 'err');
      return;
    }
    importState.step = 3;
    showImportStep3();
  }
};

window.importBack = () => {
  if (importState.step === 3) { importState.step = 2; showImportStep2(); }
  else if (importState.step === 2) { importState.step = 1; showImportStep1(); }
};

function showImportStep1() {
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep3').style.display = 'none';
  document.getElementById('importNextBtn').style.display = importState.data.length > 0 ? '' : 'none';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importDoBtn').style.display = 'none';
}

function showImportStep2() {
  document.getElementById('importStep1').style.display = 'none';
  document.getElementById('importStep2').style.display = '';
  document.getElementById('importStep3').style.display = 'none';
  document.getElementById('importNextBtn').style.display = '';
  document.getElementById('importBackBtn').style.display = '';
  document.getElementById('importDoBtn').style.display = 'none';

  const fields = IMPORT_FIELDS[importState.target] || [];
  const grid = document.getElementById('importMappingGrid');
  grid.innerHTML = `<table><thead><tr>
    <th>${A.lang==='tr'?'Sistem Alanı':'System Field'}</th>
    <th>${A.lang==='tr'?'Excel Sütunu':'Excel Column'}</th>
    <th>${A.lang==='tr'?'Örnek Veri':'Sample Data'}</th>
  </tr></thead><tbody>
  ${fields.map(f => {
    const options = importState.headers.map((h, i) => `<option value="${i}" ${importState.mapping[f.key]===i?'selected':''}>${h}</option>`).join('');
    const sampleIdx = importState.mapping[f.key];
    const sample = sampleIdx !== undefined ? (importState.data[0]?.[sampleIdx] ?? '—') : '—';
    return `<tr>
      <td class="${f.required?'fw-bold':''}">${f.required?'* ':''}${f.label}</td>
      <td><select class="fc btn-sm" style="width:200px" onchange="updateImportMapping('${f.key}',this.value)">
        <option value="">— ${A.lang==='tr'?'Eşleştirme Yok':'Not Mapped'} —</option>
        ${options}
      </select></td>
      <td class="dim-cell" style="font-size:12px" id="impSample_${f.key}">${sample}</td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

window.updateImportMapping = (key, val) => {
  if (val === '') delete importState.mapping[key];
  else importState.mapping[key] = parseInt(val);
  const sampleEl = document.getElementById(`impSample_${key}`);
  if (sampleEl) {
    const idx = importState.mapping[key];
    sampleEl.textContent = idx !== undefined ? (importState.data[0]?.[idx] ?? '—') : '—';
  }
};

function showImportStep3() {
  document.getElementById('importStep1').style.display = 'none';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep3').style.display = '';
  document.getElementById('importNextBtn').style.display = 'none';
  document.getElementById('importBackBtn').style.display = '';
  document.getElementById('importDoBtn').style.display = '';

  const fields = IMPORT_FIELDS[importState.target].filter(f => importState.mapping[f.key] !== undefined);
  const preview = importState.data.slice(0, 5);

  document.getElementById('importPreviewInfo').innerHTML = `
    <div class="alert-icon">ℹ</div><div class="alert-body">
    <div class="alert-msg">${importState.data.length} ${A.lang==='tr'?'satır içe aktarılacak. İlk 5 satır önizleme:':'rows will be imported. First 5 rows preview:'}</div>
    </div>`;

  document.getElementById('importPreviewTable').innerHTML = `<table><thead><tr>
    ${fields.map(f => `<th style="font-size:11px">${f.label.split('/')[0].trim()}</th>`).join('')}
  </tr></thead><tbody>
    ${preview.map(row => `<tr>${fields.map(f => `<td class="dim-cell" style="font-size:11px">${formatImportCell(row[importState.mapping[f.key]])}</td>`).join('')}</tr>`).join('')}
  </tbody></table>`;
}

function formatImportCell(val) {
  if (val === undefined || val === null) return '—';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).slice(0, 60);
}

window.executeImport = async () => {
  const target = importState.target;
  const fields = IMPORT_FIELDS[target];
  const collName = target === 'stock' ? 'stocks' : target === 'chemical' ? 'chemicals' : 'eln';
  const btn = document.getElementById('importDoBtn');
  btn.disabled = true;
  btn.textContent = A.lang === 'tr' ? '⏳ İçe aktarılıyor...' : '⏳ Importing...';

  let success = 0, errors = 0;
  for (const row of importState.data) {
    try {
      const data = { labId: A.userData.labId, labName: A.userData.labName, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
      fields.forEach(f => {
        const idx = importState.mapping[f.key];
        if (idx === undefined) return;
        let val = row[idx];
        if (val instanceof Date) val = val.toISOString().split('T')[0];
        if (val !== undefined && val !== null && val !== '') {
          if (f.key === 'climate') val = parseInt(val) || 25;
          if (f.key === 'ghsClasses' && typeof val === 'string') val = val.split(',').map(s=>s.trim()).filter(Boolean);
          if (f.key === 'tags' && typeof val === 'string') val = val.split(',').map(s=>s.trim()).filter(Boolean);
          data[f.key] = val;
        }
      });
      // Defaults
      if (target === 'stock') {
        data.status = data.status || 'Active';
        data.responsible = data.responsible || A.userData.name;
        data.responsibleUid = A.user.uid;
        data.responsibleEmail = A.user.email;
      }
      if (target === 'chemical') {
        data.responsible = data.responsible || A.userData.name;
        data.responsibleUid = A.user.uid;
      }
      if (target === 'eln') {
        data.authorUid = A.user.uid;
        data.authorName = A.userData.name;
        data.content = data.content || '';
        data.versions = [];
      }
      await addDoc(collection(db, collName), data);
      success++;
    } catch (e) { errors++; }
  }
  await auditLog('IMPORT', `Imported ${success} ${target}(s) from Excel (${errors} errors)`, A.user.uid, A.userData.name, A.userData.labId);
  btn.disabled = false;
  btn.textContent = '📥 İçe Aktar';
  closeOverlay('excelImportModal');
  toast(`${success} ${t('importRows')} ${errors > 0 ? `(${errors} hata)` : ''}`, errors > 0 ? 'warn' : 'ok');
  if (A.section === 'import') renderImportPanel();
};

window.downloadImportTemplate = (target) => {
  const fields = IMPORT_FIELDS[target] || [];
  const headers = fields.map(f => f.label);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `FEGLIMS_${target}_template.xlsx`);
};

// ── ALL USERS PANEL (Owner only) ─────────────
function renderAllUsersPanel() {
  if (!A.isOwner) { nav('dashboard'); return; }
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px">
        <select class="fc" id="auLabFilter" style="width:200px" onchange="loadAllUsersPanel()">
          <option value="">${A.lang==='tr'?'Tüm Laboratuvarlar':'All Labs'}</option>
        </select>
        <select class="fc" id="auRoleFilter" style="width:160px" onchange="loadAllUsersPanel()">
          <option value="">${A.lang==='tr'?'Tüm Roller':'All Roles'}</option>
          <option value="admin">Admin</option><option value="pi">PI</option>
          <option value="senior">Senior</option><option value="researcher">Researcher</option>
          <option value="student">Student</option><option value="pending">Pending</option>
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="exportAllUsers()">📊 Excel</button>
    </div>
    <div id="allUsersWrap"></div>`;
  loadAllUsersLabFilter();
  loadAllUsersPanel();
}

async function loadAllUsersLabFilter() {
  const snap = await getDocs(collection(db, 'labs'));
  const sel = document.getElementById('auLabFilter');
  if (!sel) return;
  snap.docs.forEach(d => {
    const lab = d.data();
    sel.innerHTML += `<option value="${d.id}">${lab.name}</option>`;
  });
}

window.loadAllUsersPanel = async () => {
  const labF = document.getElementById('auLabFilter')?.value || '';
  const roleF = document.getElementById('auRoleFilter')?.value || '';
  const snap = await getDocs(collection(db, 'users'));
  let users = snap.docs.map(d => ({uid: d.id, ...d.data()}));
  if (labF) users = users.filter(u => u.labId === labF);
  if (roleF) users = users.filter(u => u.role === roleF);

  const el = document.getElementById('allUsersWrap');
  if (!el) return;
  el.innerHTML = `
    <div class="dim-cell" style="font-size:12px;margin-bottom:8px">${users.length} ${A.lang==='tr'?'kullanıcı':'users'}</div>
    <div class="tbl-wrap"><table><thead><tr>
      <th>${A.lang==='tr'?'Ad':'Name'}</th><th>E-posta</th>
      <th>${A.lang==='tr'?'Lab':'Lab'}</th><th>${A.lang==='tr'?'Rol':'Role'}</th>
      <th>ORCID</th><th>${A.lang==='tr'?'Kayıt Tarihi':'Registered'}</th>
    </tr></thead><tbody>
    ${users.map(u => `<tr>
      <td class="fw-bold">${u.name||'—'}</td>
      <td class="dim-cell" style="font-size:12px">${u.email||'—'}</td>
      <td class="dim-cell">${u.labName||'—'}</td>
      <td><span class="badge b-${u.role||'pending'}">${ROLES[u.role]||u.role}</span></td>
      <td class="mono-cell" style="font-size:11px">${u.orcid||'—'}</td>
      <td class="dim-cell" style="font-size:12px">${fmtDateTime(u.createdAt, A.lang)}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
};

window.exportAllUsers = async () => {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => d.data());
  exportToExcel(users.map(u => ({
    'Ad/Name': u.name, 'E-posta': u.email, 'Lab': u.labName,
    'Rol/Role': u.role, 'ORCID': u.orcid || '',
  })), 'FEGLIMS_AllUsers');
};

// ── GLOBAL ACTIVITY LOG (Owner only) ─────────
function renderGlobalActivityLog() {
  if (!A.isOwner) { nav('dashboard'); return; }
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select class="fc" id="glLabFilter" style="width:200px" onchange="loadGlobalLog()">
          <option value="">${A.lang==='tr'?'Tüm Lablar':'All Labs'}</option>
        </select>
        <select class="fc" id="glActionFilter" style="width:180px" onchange="loadGlobalLog()">
          <option value="">${A.lang==='tr'?'Tüm İşlemler':'All Actions'}</option>
          <option value="ADD_STOCK">Add Stock</option>
          <option value="STATUS_CHANGE">Status Change</option>
          <option value="APPROVE">Approve</option>
          <option value="IMPORT">Import</option>
          <option value="DELETE">Delete</option>
        </select>
        <input type="date" class="fc" id="glDateFilter" style="width:160px" onchange="loadGlobalLog()">
      </div>
      <button class="btn btn-secondary btn-sm" onclick="exportGlobalLog()">📊 Excel</button>
    </div>
    <div id="globalLogWrap"></div>`;
  loadGlobalLabFilter();
  loadGlobalLog();
}

async function loadGlobalLabFilter() {
  const snap = await getDocs(collection(db, 'labs'));
  const sel = document.getElementById('glLabFilter');
  if (!sel) return;
  snap.docs.forEach(d => {
    sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`;
  });
}

window.loadGlobalLog = async () => {
  const labF = document.getElementById('glLabFilter')?.value || '';
  const actionF = document.getElementById('glActionFilter')?.value || '';
  const dateF = document.getElementById('glDateFilter')?.value || '';

  const snap = await getDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')));
  let logs = snap.docs.map(d => d.data());
  if (labF) logs = logs.filter(l => l.labId === labF);
  if (actionF) logs = logs.filter(l => l.action === actionF);
  if (dateF) logs = logs.filter(l => l.timestamp?.toDate?.()?.toISOString?.()?.split('T')[0] === dateF);
  logs = logs.slice(0, 100);

  const el = document.getElementById('globalLogWrap');
  if (!el) return;
  const iconMap = { 'ADD_STOCK':{ i:'🔬',c:'var(--accent)' }, 'STATUS_CHANGE':{ i:'⟳',c:'var(--amber)' }, 'APPROVE':{ i:'✅',c:'var(--accent)' }, 'ADD_CHEM':{ i:'🧪',c:'var(--blue)' }, 'IMPORT':{ i:'📥',c:'var(--blue)' }, 'DELETE':{ i:'🗑',c:'var(--red)' } };
  el.innerHTML = logs.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('noData')}</div></div>`
    : logs.map(l => {
      const ico = iconMap[l.action] || { i:'•', c:'var(--text3)' };
      return `<div class="log-entry">
        <div class="log-icon" style="background:${ico.c}20;color:${ico.c}">${ico.i}</div>
        <div class="log-body">
          <div class="log-action">${l.action} <span class="badge" style="font-size:10px;background:var(--surface3)">${l.labId||'—'}</span></div>
          <div class="log-detail">${l.detail} — <span style="color:var(--accent)">${l.userName}</span></div>
        </div>
        <div class="log-time">${fmtDateTime(l.timestamp, A.lang)}</div>
      </div>`;
    }).join('');
};

window.exportGlobalLog = async () => {
  const snap = await getDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')));
  exportToExcel(snap.docs.map(d => d.data()).map(l => ({
    'İşlem': l.action, 'Detay': l.detail, 'Kullanıcı': l.userName,
    'Lab': l.labId, 'Tarih': fmtDateTime(l.timestamp, A.lang),
  })), 'FEGLIMS_GlobalActivityLog');
};

// ── GOOGLE CALENDAR SYNC / ICS EXPORT ────────
window.openGoogleCalSync = () => {
  const now = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 1);
  const to = new Date(); to.setMonth(to.getMonth() + 3);
  document.getElementById('gcal_from').value = from.toISOString().split('T')[0];
  document.getElementById('gcal_to').value = to.toISOString().split('T')[0];
  document.getElementById('gcalStatus').innerHTML = '';
  openOverlay('gcalSyncModal');
};

window.exportToGoogleCalendar = async () => {
  const fromDate = document.getElementById('gcal_from').value;
  const toDate = document.getElementById('gcal_to').value;
  const inclRemoval = document.getElementById('gcal_removal').checked;
  const inclTransfer = document.getElementById('gcal_transfer').checked;
  const inclManual = document.getElementById('gcal_manual').checked;
  const inclTasks = document.getElementById('gcal_tasks').checked;

  let events = [];

  // Manual events
  if (inclManual) {
    const snap = await getDocs(query(collection(db, 'events'), where('labId','==', A.userData.labId)));
    snap.docs.forEach(d => {
      const e = d.data();
      if (e.eventDate >= fromDate && e.eventDate <= toDate) {
        events.push({ title: e.title, date: e.eventDate, time: e.time || '', desc: e.description || '', type: e.type || 'other' });
      }
    });
  }

  // Stock events
  if (inclRemoval || inclTransfer) {
    const snap = await getDocs(query(collection(db, 'stocks'), where('labId','==', A.userData.labId)));
    snap.docs.forEach(d => {
      const s = d.data();
      if (s.status === 'Lost') return;
      if (inclRemoval && s.removalDate >= fromDate && s.removalDate <= toDate) {
        events.push({ title: `Ergin Atımı: ${s.stockCode}`, date: s.removalDate, time: '', desc: `${s.genotype || ''} - ${s.responsible || ''}`, type: 'parent_removal' });
      }
      if (inclTransfer && s.nextTransferDate >= fromDate && s.nextTransferDate <= toDate) {
        events.push({ title: `Transfer: ${s.stockCode}`, date: s.nextTransferDate, time: '', desc: `${s.genotype || ''} - ${s.responsible || ''}`, type: 'stock_transfer' });
      }
    });
  }

  // Tasks
  if (inclTasks) {
    const snap = await getDocs(query(collection(db, 'tasks'), where('labId','==', A.userData.labId)));
    snap.docs.forEach(d => {
      const t = d.data();
      if (t.dueDate && t.dueDate >= fromDate && t.dueDate <= toDate && t.status !== 'completed' && t.status !== 'cancelled') {
        events.push({ title: `Görev: ${t.title}`, date: t.dueDate, time: '', desc: t.description || '', type: 'task' });
      }
    });
  }

  if (events.length === 0) { toast(A.lang==='tr'?'Aktarılacak etkinlik yok':'No events to export', 'warn'); return; }

  // Generate ICS
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FEGLIMS//Calendar//TR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
  events.forEach(e => {
    const dtStart = e.date.replace(/-/g, '');
    const uid = `${dtStart}-${Math.random().toString(36).slice(2,8)}@feglims`;
    ics += `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${dtStart}\r\nSUMMARY:${escapeICS(e.title)}\r\nDESCRIPTION:${escapeICS(e.desc)}\r\nUID:${uid}\r\nEND:VEVENT\r\n`;
  });
  ics += 'END:VCALENDAR\r\n';

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `FEGLIMS_Calendar_${fromDate}_${toDate}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);

  document.getElementById('gcalStatus').innerHTML = `<div class="alert alert-green"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-msg">${events.length} ${A.lang==='tr'?'etkinlik .ICS dosyasına aktarıldı. Google Calendar\'da "Import" ile yükleyin.':'events exported to .ICS file. Import it in Google Calendar.'}</div></div></div>`;
  toast(`${events.length} ${A.lang==='tr'?'etkinlik aktarıldı':'events exported'}`, 'ok');
};

window.syncGoogleCalendar = () => {
  // Opens Google Calendar import page
  window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
  toast(A.lang==='tr'?'Önce .ICS dosyasını indirin, sonra Google Calendar\'da içe aktarın':'First download the .ICS file, then import it in Google Calendar', 'info');
};

function escapeICS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// ── ELN TEMPLATE MANAGER ─────────────────────
window.openElnTemplateManager = () => {
  loadCustomTemplates();
  openOverlay('elnTemplateManagerModal');
};

async function loadCustomTemplates() {
  const snap = await getDocs(query(collection(db, 'elnTemplates'), where('labId', '==', A.userData.labId)));
  A.customTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderTemplateManagerList();
  updateElnTemplateDropdown();
}

function renderTemplateManagerList() {
  const el = document.getElementById('tplManagerList');
  if (!el) return;
  const builtIn = [
    { name: '🧪 Deney Protokolü', key: 'experiment', builtin: true },
    { name: '🔬 Gözlem Notu', key: 'observation', builtin: true },
    { name: '🪰 Çaprazlama', key: 'crossing', builtin: true },
    { name: '✂ CRISPR Deneyi', key: 'crispr', builtin: true },
  ];
  const all = [...builtIn, ...A.customTemplates.map(t => ({ name: t.name, key: t.id, builtin: false }))];

  el.innerHTML = all.length === 0 ? `<div class="dim-cell">${t('noData')}</div>` : `
    <div class="tbl-wrap"><table><thead><tr>
      <th>${A.lang==='tr'?'Şablon Adı':'Template Name'}</th>
      <th>${A.lang==='tr'?'Tür':'Type'}</th>
      <th></th>
    </tr></thead><tbody>
    ${all.map(t => `<tr>
      <td class="fw-bold">${t.name}</td>
      <td>${t.builtin ? '<span class="badge" style="background:var(--surface3)">Yerleşik / Built-in</span>' : '<span class="badge b-admin">Özel / Custom</span>'}</td>
      <td>${!t.builtin ? `<button class="btn btn-red btn-xs" onclick="deleteCustomTemplate('${t.key}')">🗑</button>` : ''}</td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

function updateElnTemplateDropdown() {
  const sel = document.getElementById('elnTemplateSelect');
  if (!sel) return;
  // Keep built-in options, add custom ones
  const customOpts = sel.querySelectorAll('.custom-tpl-opt');
  customOpts.forEach(o => o.remove());
  A.customTemplates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = `custom_${t.id}`;
    opt.textContent = `📝 ${t.name}`;
    opt.className = 'custom-tpl-opt';
    sel.appendChild(opt);
  });
  // Add "manage templates" option
  let mgOpt = sel.querySelector('.manage-tpl-opt');
  if (!mgOpt) {
    mgOpt = document.createElement('option');
    mgOpt.value = '__manage__';
    mgOpt.textContent = A.lang === 'tr' ? '⚙ Şablonları Yönet...' : '⚙ Manage Templates...';
    mgOpt.className = 'manage-tpl-opt';
    sel.appendChild(mgOpt);
  }
}

window.saveCustomTemplate = async () => {
  const name = document.getElementById('tpl_name').value.trim();
  const content = document.getElementById('tpl_content').value.trim();
  if (!name || !content) { toast(t('required'), 'err'); return; }
  await addDoc(collection(db, 'elnTemplates'), {
    name, content, labId: A.userData.labId,
    createdBy: A.user.uid, createdByName: A.userData.name,
    createdAt: Timestamp.now()
  });
  document.getElementById('tpl_name').value = '';
  document.getElementById('tpl_content').value = '';
  toast(t('saved'), 'ok');
  loadCustomTemplates();
};

window.deleteCustomTemplate = async (id) => {
  if (!confirm(A.lang==='tr'?'Şablon silinsin mi?':'Delete template?')) return;
  await deleteDoc(doc(db, 'elnTemplates', id));
  toast(t('deleted'), 'info');
  loadCustomTemplates();
};

// ── DATA VERSIONING ──────────────────────────
window.showVersionHistory = async (collName, docId) => {
  const snap = await getDoc(doc(db, collName, docId));
  if (!snap.exists()) return;
  const data = snap.data();
  const versions = data.versionHistory || [];

  const el = document.getElementById('versionHistoryBody');
  if (versions.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div>
      <div class="empty-text">${A.lang==='tr'?'Henüz versiyon geçmişi yok.':'No version history yet.'}</div></div>`;
  } else {
    el.innerHTML = `
      <div class="dim-cell" style="font-size:12px;margin-bottom:12px">${versions.length} ${A.lang==='tr'?'önceki versiyon':'previous versions'}</div>
      ${versions.slice().reverse().map((v, i) => `
        <div class="card" style="margin-bottom:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:8px">
            <span class="fw-bold" style="font-size:13px">#${versions.length - i} — ${fmtDateTime(v.timestamp, A.lang)}</span>
            <span class="dim-cell" style="font-size:12px">${v.changedBy || '—'}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            ${Object.entries(v.changes || {}).map(([key, change]) => `
              <div style="padding:6px;background:var(--surface2);border-radius:var(--r)">
                <div class="fl" style="font-size:10px">${key}</div>
                <div style="color:var(--red);text-decoration:line-through;margin-top:2px">${change.old || '—'}</div>
                <div style="color:var(--accent);margin-top:2px">${change.new || '—'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}`;
  }
  openOverlay('versionHistoryModal');
};

// ── SETTINGS MODE FIX ────────────────────────
// Override toggleSettingsMode with a functional version
const originalToggle = window.toggleSettingsMode;
window.toggleSettingsMode = () => {
  originalToggle();
  // When settings mode is active, show editable config panels inline
  if (A.settingsMode && A.section !== 'settings') {
    // Add settings banner action
    const banner = document.getElementById('settingsBanner');
    if (banner) {
      banner.innerHTML = `
        <span id="settingsBannerText">${t('settingsBanner')}</span>
        <button class="btn btn-secondary btn-xs" onclick="nav('settings')" style="margin-left:10px">${A.lang==='tr'?'Ayarlara Git':'Go to Settings'}</button>
      `;
    }
  }
};

// ── BACKUP / RESTORE ─────────────────────────
function renderBackupPanel() {
  if (!isLabAdmin(A.userData) && !A.isOwner) { nav('dashboard'); return; }
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="alert alert-blue" style="margin-bottom:20px">
      <div class="alert-icon">💾</div>
      <div class="alert-body">
        <div class="alert-title">${A.lang==='tr'?'Veri Yedekleme & Geri Yükleme':'Data Backup & Restore'}</div>
        <div class="alert-msg">${A.lang==='tr'
          ?'Laboratuvar verilerinizi JSON formatında yedekleyin veya önceki yedeğinizi geri yükleyin. Yedek dosyası stoklar, kimyasallar, ELN kayıtları, etkinlikler, görevler ve siparişleri içerir.'
          :'Backup your lab data in JSON format or restore from a previous backup. Backup includes stocks, chemicals, ELN entries, events, tasks and orders.'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="card" style="text-align:center;padding:32px;cursor:pointer" onclick="exportLabBackup()">
        <div style="font-size:48px;margin-bottom:12px">📤</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${A.lang==='tr'?'Yedek Al':'Export Backup'}</div>
        <div class="dim-cell" style="font-size:12px">${A.lang==='tr'?'Tüm lab verilerini JSON olarak indirin':'Download all lab data as JSON'}</div>
      </div>
      <div class="card" style="text-align:center;padding:32px;cursor:pointer" onclick="document.getElementById('restoreFileInput2').click()">
        <div style="font-size:48px;margin-bottom:12px">📥</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${A.lang==='tr'?'Geri Yükle':'Restore'}</div>
        <div class="dim-cell" style="font-size:12px">${A.lang==='tr'?'JSON yedek dosyasından geri yükleyin':'Restore from JSON backup file'}</div>
      </div>
    </div>
    <input type="file" id="restoreFileInput2" accept=".json" style="display:none" onchange="handleRestoreFile(this.files[0])">
    <div id="backupPanelStatus"></div>
    <div id="restorePanelPreview" style="display:none"></div>`;
}

window.exportLabBackup = async () => {
  toast(A.lang==='tr'?'Yedek hazırlanıyor...':'Preparing backup...', 'info');
  const labId = A.userData.labId;
  const backup = {
    meta: {
      version: '3.3',
      labId,
      labName: A.userData.labName,
      exportedBy: A.userData.name,
      exportedAt: new Date().toISOString(),
      format: 'FEGLIMS_BACKUP'
    },
    data: {}
  };

  const collections = ['stocks', 'chemicals', 'eln', 'events', 'tasks', 'orders', 'stockLists', 'cycleRules'];
  for (const coll of collections) {
    try {
      const snap = await getDocs(query(collection(db, coll)));
      let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      if (['stocks','chemicals','eln','events','tasks','orders','stockLists'].includes(coll)) {
        docs = docs.filter(d => d.labId === labId);
      }
      backup.data[coll] = docs.map(d => {
        const s = {};
        Object.entries(d).forEach(([k, v]) => {
          if (v && typeof v === 'object' && typeof v.toDate === 'function') {
            s[k] = { _ts: true, value: v.toDate().toISOString() };
          } else {
            s[k] = v;
          }
        });
        return s;
      });
    } catch { backup.data[coll] = []; }
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `FEGLIMS_Backup_${labId}_${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast(t('backupSuccess'), 'ok');
  await auditLog('BACKUP', `Lab backup exported`, A.user.uid, A.userData.name, A.userData.labId);
};

let pendingRestore = null;

window.handleRestoreFile = (file) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.meta?.format !== 'FEGLIMS_BACKUP') {
        toast(A.lang==='tr'?'Geçersiz yedek dosyası':'Invalid backup file', 'err');
        return;
      }
      pendingRestore = data;
      const counts = {};
      Object.entries(data.data).forEach(([k, v]) => { counts[k] = v.length; });
      const statusEl = document.getElementById('backupPanelStatus') || document.getElementById('backupStatus');
      const previewEl = document.getElementById('restorePanelPreview') || document.getElementById('restorePreview');
      if (statusEl) statusEl.innerHTML = `
        <div class="alert alert-amber">
          <div class="alert-icon">⚠</div>
          <div class="alert-body">
            <div class="alert-title">${A.lang==='tr'?'Yedek Dosyası Bilgileri':'Backup File Info'}</div>
            <div class="alert-msg">
              Lab: ${data.meta.labName} | ${A.lang==='tr'?'Tarih':'Date'}: ${data.meta.exportedAt?.split('T')[0]}<br>
              ${Object.entries(counts).map(([k,v]) => `${k}: ${v}`).join(' | ')}
            </div>
          </div>
        </div>`;
      if (previewEl) {
        previewEl.style.display = '';
        previewEl.innerHTML = `
          <div class="row" style="gap:8px;margin-top:12px">
            <button class="btn btn-primary" onclick="executeRestore()">📥 ${A.lang==='tr'?'Geri Yükle':'Restore'}</button>
            <button class="btn btn-secondary" onclick="cancelRestore()">İptal</button>
          </div>
          <div class="dim-cell" style="font-size:11px;margin-top:8px">${A.lang==='tr'?'Mevcut veriler korunur, yedekteki veriler eklenir.':'Existing data is preserved, backup data is added.'}</div>`;
      }
    } catch (err) {
      toast('Dosya okunamadı: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
};

window.executeRestore = async () => {
  if (!pendingRestore) return;
  if (!confirm(A.lang==='tr'?'Yedek geri yüklenecek. Devam?':'Restore backup? Continue?')) return;
  toast(A.lang==='tr'?'Geri yükleniyor...':'Restoring...', 'info');
  let total = 0;
  for (const [collName, docs] of Object.entries(pendingRestore.data)) {
    for (const d of docs) {
      try {
        const restored = {};
        Object.entries(d).forEach(([k, v]) => {
          if (k === '_id') return;
          if (v && typeof v === 'object' && v._ts) {
            restored[k] = Timestamp.fromDate(new Date(v.value));
          } else {
            restored[k] = v;
          }
        });
        restored.labId = A.userData.labId;
        restored.labName = A.userData.labName;
        restored._restoredAt = Timestamp.now();
        await addDoc(collection(db, collName), restored);
        total++;
      } catch {}
    }
  }
  pendingRestore = null;
  await auditLog('RESTORE', `Restored ${total} records from backup`, A.user.uid, A.userData.name, A.userData.labId);
  toast(`${t('restoreSuccess')} (${total} ${A.lang==='tr'?'kayıt':'records'})`, 'ok');
  if (A.section === 'backup') renderBackupPanel();
};

window.cancelRestore = () => {
  pendingRestore = null;
  const previewEl = document.getElementById('restorePanelPreview') || document.getElementById('restorePreview');
  const statusEl = document.getElementById('backupPanelStatus') || document.getElementById('backupStatus');
  if (previewEl) { previewEl.style.display = 'none'; previewEl.innerHTML = ''; }
  if (statusEl) statusEl.innerHTML = '';
};

// ── SAVED SEARCHES ───────────────────────────
window.openSaveSearch = (context) => {
  A._saveSearchContext = context;
  document.getElementById('ss_name').value = '';
  openOverlay('saveSearchModal');
};

window.confirmSaveSearch = async () => {
  const name = document.getElementById('ss_name').value.trim();
  if (!name) { toast(t('required'), 'err'); return; }
  const ctx = A._saveSearchContext || {};
  const savedSearches = A.userData.savedSearches || [];
  savedSearches.push({
    id: Date.now().toString(36),
    name,
    context: ctx.section || A.section,
    filters: ctx.filters || {},
    createdAt: new Date().toISOString()
  });
  await updateDoc(doc(db, 'users', A.user.uid), { savedSearches });
  A.userData.savedSearches = savedSearches;
  closeOverlay('saveSearchModal');
  toast(t('searchSaved'), 'ok');
};

window.loadSavedSearch = (id) => {
  const search = (A.userData.savedSearches || []).find(s => s.id === id);
  if (!search) return;
  nav(search.context);
  setTimeout(() => {
    const f = search.filters;
    if (f.searchTerm) {
      const el = document.getElementById('stockSearch') || document.getElementById('elnSearch');
      if (el) { el.value = f.searchTerm; el.dispatchEvent(new Event('input')); }
    }
    if (f.status) {
      const el = document.getElementById('stockFilterStatus');
      if (el) { el.value = f.status; }
    }
    if (f.center) {
      const el = document.getElementById('stockFilterCenter');
      if (el) { el.value = f.center; }
    }
    if (f.climate) {
      const el = document.getElementById('stockFilterClimate');
      if (el) { el.value = f.climate; }
    }
    if (f.tab) {
      if (window.setStockTab) window.setStockTab(f.tab);
    }
    if (window.stockSearchChange) window.stockSearchChange(f.searchTerm || '');
  }, 300);
};

window.deleteSavedSearch = async (id) => {
  if (!confirm(A.lang==='tr'?'Arama silinsin mi?':'Delete saved search?')) return;
  const savedSearches = (A.userData.savedSearches || []).filter(s => s.id !== id);
  await updateDoc(doc(db, 'users', A.user.uid), { savedSearches });
  A.userData.savedSearches = savedSearches;
  toast(t('searchDeleted'), 'info');
  renderSection();
};

function renderSavedSearchesDropdown(section) {
  const searches = (A.userData.savedSearches || []).filter(s => s.context === section);
  if (searches.length === 0) return '';
  return `<div class="row" style="gap:6px">
    <select class="fc btn-sm" style="width:180px;font-size:11px" onchange="if(this.value)loadSavedSearch(this.value);this.value=''">
      <option value="">📌 ${A.lang==='tr'?'Kayıtlı Aramalar':'Saved Searches'}</option>
      ${searches.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    </select>
  </div>`;
}
window.renderSavedSearchesDropdown = renderSavedSearchesDropdown;

// ── GOOGLE CALENDAR API (OAuth2) ─────────────
window.syncToGoogleCalendarAPI = async () => {
  // Google Calendar API requires OAuth2 client configuration on Google Cloud Console.
  // Since this app uses Firebase Auth with Google, we can attempt to use the gapi library.
  if (!window.gapi || !A.gapiReady) {
    toast(A.lang==='tr'
      ?'Google Calendar API yapılandırılmamış. Lütfen ICS dosyası indirip Google Calendar\'a import edin.'
      :'Google Calendar API not configured. Please download the ICS file and import it into Google Calendar.', 'warn');
    exportToGoogleCalendar();
    return;
  }

  try {
    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }

    const fromDate = document.getElementById('gcal_from').value;
    const toDate = document.getElementById('gcal_to').value;
    let events = [];

    const stockSnap = await getDocs(query(collection(db, 'stocks'), where('labId','==', A.userData.labId)));
    stockSnap.docs.forEach(d => {
      const s = d.data();
      if (s.status === 'Lost') return;
      if (s.removalDate >= fromDate && s.removalDate <= toDate) {
        events.push({ summary: `Ergin Atımı: ${s.stockCode}`, date: s.removalDate, description: `${s.genotype || ''} - ${s.responsible || ''}` });
      }
    });

    const evtSnap = await getDocs(query(collection(db, 'events'), where('labId','==', A.userData.labId)));
    evtSnap.docs.forEach(d => {
      const e = d.data();
      if (e.eventDate >= fromDate && e.eventDate <= toDate) {
        events.push({ summary: e.title, date: e.eventDate, description: e.description || '' });
      }
    });

    let synced = 0;
    for (const evt of events) {
      try {
        await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary: evt.summary,
            description: evt.description,
            start: { date: evt.date },
            end: { date: evt.date },
          }
        });
        synced++;
      } catch {}
    }

    document.getElementById('gcalStatus').innerHTML = `<div class="alert alert-green"><div class="alert-icon">✅</div><div class="alert-body"><div class="alert-msg">${synced} ${A.lang==='tr'?'etkinlik Google Calendar\'a eklendi':'events added to Google Calendar'}</div></div></div>`;
    toast(`${synced} ${A.lang==='tr'?'etkinlik senkronize edildi':'events synced'}`, 'ok');
  } catch (e) {
    toast(A.lang==='tr'?'Google Calendar API hatası: ':'Google Calendar API error: ' + e.message, 'err');
  }
};

// ── BULK STOCK UPDATE FROM EXCEL ─────────────
window.openBulkStockUpdate = () => {
  importState = { step: 1, data: [], headers: [], mapping: {}, target: 'stock', mode: 'update' };
  document.getElementById('imp_target').value = 'stock';
  document.getElementById('importModalTitle').textContent = A.lang==='tr' ? '🔄 Toplu Stok Güncelleme' : '🔄 Bulk Stock Update';
  document.getElementById('importStep1').style.display = '';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importStep3').style.display = 'none';
  document.getElementById('importNextBtn').style.display = 'none';
  document.getElementById('importBackBtn').style.display = 'none';
  document.getElementById('importDoBtn').style.display = 'none';
  document.getElementById('importFileInfo').style.display = 'none';
  document.getElementById('importFileInput').value = '';
  openOverlay('excelImportModal');
};

const _origExecuteImport = window.executeImport;
window.executeImport = async () => {
  if (importState.mode !== 'update') {
    return _origExecuteImport();
  }

  const fields = IMPORT_FIELDS[importState.target];
  const btn = document.getElementById('importDoBtn');
  btn.disabled = true;
  btn.textContent = A.lang === 'tr' ? '⏳ Güncelleniyor...' : '⏳ Updating...';

  const snap = await getDocs(query(collection(db, 'stocks'), where('labId', '==', A.userData.labId)));
  const stockMap = {};
  snap.docs.forEach(d => {
    const data = d.data();
    stockMap[(data.stockCode || '').toLowerCase()] = d.id;
  });

  let updated = 0, created = 0, errors = 0;
  for (const row of importState.data) {
    try {
      const data = { updatedAt: Timestamp.now() };
      let matchKey = '';
      fields.forEach(f => {
        const idx = importState.mapping[f.key];
        if (idx === undefined) return;
        let val = row[idx];
        if (val instanceof Date) val = val.toISOString().split('T')[0];
        if (val !== undefined && val !== null && val !== '') {
          if (f.key === 'climate') val = parseInt(val) || 25;
          data[f.key] = val;
        }
        if (f.key === 'stockCode' && val) matchKey = String(val).toLowerCase();
      });

      const existingId = stockMap[matchKey];
      if (existingId) {
        const prevSnap = await getDoc(doc(db, 'stocks', existingId));
        const prevData = prevSnap.exists() ? prevSnap.data() : {};
        const changes = {};
        Object.entries(data).forEach(([k, v]) => {
          if (k === 'updatedAt') return;
          if (String(prevData[k] || '') !== String(v || '')) {
            changes[k] = { old: prevData[k] || '', new: v || '' };
          }
        });
        if (Object.keys(changes).length > 0) {
          const existingVersions = prevData.versionHistory || [];
          data.versionHistory = [...existingVersions, {
            changes,
            changedBy: A.userData.name,
            changedByUid: A.user.uid,
            timestamp: Timestamp.now(),
          }];
        }
        await updateDoc(doc(db, 'stocks', existingId), data);
        updated++;
      } else {
        data.labId = A.userData.labId;
        data.labName = A.userData.labName;
        data.createdAt = Timestamp.now();
        data.status = data.status || 'Active';
        data.responsible = data.responsible || A.userData.name;
        data.responsibleUid = A.user.uid;
        data.responsibleEmail = A.user.email;
        data.statusHistory = [{ status: data.status || 'Active', changedBy: A.userData.name, changedAt: new Date().toISOString(), reason: 'Bulk import' }];
        await addDoc(collection(db, 'stocks'), data);
        created++;
      }
    } catch (e) { errors++; }
  }

  await auditLog('BULK_UPDATE', `Bulk stock update: ${updated} updated, ${created} created, ${errors} errors`, A.user.uid, A.userData.name, A.userData.labId);
  btn.disabled = false;
  btn.textContent = '📥 İçe Aktar';
  closeOverlay('excelImportModal');
  toast(`${A.lang==='tr'?'Güncelleme':'Update'}: ${updated} ${A.lang==='tr'?'güncellendi':'updated'}, ${created} ${A.lang==='tr'?'yeni eklendi':'created'} ${errors > 0 ? `(${errors} ${A.lang==='tr'?'hata':'errors'})` : ''}`, errors > 0 ? 'warn' : 'ok');
  if (A.section === 'import') renderImportPanel();
};

// ── ELN FILE ATTACHMENTS ─────────────────────
let elnPendingFiles = [];

window.handleElnFiles = (files) => {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      toast(A.lang==='tr'?`${file.name} çok büyük (max 10MB)`:`${file.name} too large (max 10MB)`, 'err');
      continue;
    }
    elnPendingFiles.push(file);
  }
  renderElnAttachmentsList();
};

function renderElnAttachmentsList() {
  const el = document.getElementById('elnAttachmentsList');
  if (!el) return;
  const existing = A._elnExistingAttachments || [];
  const all = [...existing.map((a, i) => ({ name: a.name, size: a.size, existing: true, idx: i, url: a.url || a.data })),
               ...elnPendingFiles.map((f, i) => ({ name: f.name, size: f.size, existing: false, idx: i }))];
  if (all.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = all.map(f => {
    const sizeKB = Math.round(f.size / 1024);
    return `<div class="row" style="justify-content:space-between;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:4px">
      <div class="row" style="gap:6px">
        <span style="font-size:14px">${getFileIcon(f.name)}</span>
        <span style="font-size:12px">${f.name}</span>
        <span class="dim-cell" style="font-size:11px">(${sizeKB}KB)</span>
      </div>
      <div class="row" style="gap:4px">
        ${f.url ? `<a href="${f.url}" target="_blank" class="btn btn-ghost btn-xs" download="${f.name}">⬇</a>` : ''}
        <button class="btn btn-red btn-xs" onclick="removeElnAttachment(${f.existing},${f.idx})">✕</button>
      </div>
    </div>`;
  }).join('');
}

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const icons = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', csv:'📊', png:'🖼', jpg:'🖼', jpeg:'🖼', gif:'🖼', txt:'📃', zip:'📦', rar:'📦' };
  return icons[ext] || '📎';
}

window.removeElnAttachment = (isExisting, idx) => {
  if (isExisting) {
    A._elnExistingAttachments = (A._elnExistingAttachments || []).filter((_, i) => i !== idx);
  } else {
    elnPendingFiles = elnPendingFiles.filter((_, i) => i !== idx);
  }
  renderElnAttachmentsList();
};

async function uploadElnFiles() {
  if (elnPendingFiles.length === 0) return [];
  const uploaded = [];
  for (const file of elnPendingFiles) {
    try {
      const base64 = await fileToBase64(file);
      uploaded.push({
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64,
        uploadedAt: new Date().toISOString(),
        uploadedBy: A.userData.name,
      });
    } catch (e) {
      toast(`${file.name} ${A.lang==='tr'?'yüklenemedi':'upload failed'}`, 'err');
    }
  }
  return uploaded;
}
window.uploadElnFiles = uploadElnFiles;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── INIT ──────────────────────────────────────
applyTheme(A.theme);
document.getElementById('themeToggle').onclick = toggleTheme;
updateConnStatus();
applyStaticTranslations();

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
