// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — firebase.js
//  Firebase initialization & core utilities
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore, enableIndexedDbPersistence,
  collection, doc, addDoc, getDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, where,
  onSnapshot, getDocs, Timestamp, serverTimestamp,
  arrayUnion, arrayRemove, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ── CONFIG ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBYAvyFWL0o9vtw7bwWQqmDsathUJmS_0Q",
  authDomain: "feglims.firebaseapp.com",
  projectId: "feglims",
  storageBucket: "feglims.firebasestorage.app",
  messagingSenderId: "901030001216",
  appId: "1:901030001216:web:e245fd939cb61b981cbda5"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const gp   = new GoogleAuthProvider();

// Offline persistence
enableIndexedDbPersistence(db).catch(() => {});

// ── SYSTEM OWNER ────────────────────────────
const OWNER_EMAIL = 'memetgozuboyuk@gmail.com';

// ── EMAIL ────────────────────────────────────
async function sendEmail({ to_email, to_name, subject, message, lab_name, reply_to }) {
  try {
    const res = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email, to_name, subject, message,
        lab_name: lab_name || 'FEGLIMS',
        app_url: window.location.origin,
        reply_to
      })
    });
    return res.ok;
  } catch { return false; }
}

// ── AUDIT LOG ────────────────────────────────
async function auditLog(action, detail, uid, userName, labId) {
  try {
    await addDoc(collection(db, 'auditLog'), {
      action, detail,
      userId: uid,
      userName,
      labId: labId || '',
      timestamp: Timestamp.now()
    });
  } catch {}
}

// ── DATE UTILS ───────────────────────────────
function addDays(ds, n) {
  if (!ds) return '';
  const d = new Date(ds);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDate(ds, lang = 'tr') {
  if (!ds) return '—';
  try {
    return new Date(ds + 'T00:00:00').toLocaleDateString(
      lang === 'tr' ? 'tr-TR' : 'en-GB',
      { day: '2-digit', month: 'short', year: 'numeric' }
    );
  } catch { return ds; }
}

function fmtDateTime(ts, lang = 'tr') {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB');
  } catch { return '—'; }
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ── VALIDATION ───────────────────────────────
function validateCAS(cas) {
  if (!cas) return true;
  return /^\d{2,7}-\d{2}-\d$/.test(cas.trim());
}

function validateORCID(orcid) {
  if (!orcid) return true;
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid.trim());
}

// ── SHARED UTILITIES (moved here to prevent race conditions) ──
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function exportToExcel(data, filename) {
  if (!data || data.length === 0) return;
  const ws_data = [Object.keys(data[0]), ...data.map(r => Object.values(r))];
  if (window.XLSX) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}_${todayISO()}.xlsx`);
  } else {
    let csv = ws_data.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}_${todayISO()}.xlsx`;
    a.click();
  }
}

// ── MULTI-TENANT HELPERS ─────────────────────
function isSystemOwner(email) { return email === OWNER_EMAIL; }
function isLabAdmin(userData) { return userData?.role === 'admin'; }

// ── MODULE-BASED PERMISSION SYSTEM ──────────
// Permission modules — grouped by feature area
const PERM_MODULES = [
  {
    module: 'inventory', tr: 'Stok Envanteri', en: 'Stock Inventory',
    perms: [
      { k: 'inventory.view',       tr: 'Stokları Görüntüleme',    en: 'View Stocks' },
      { k: 'inventory.add',        tr: 'Stok Ekleme',             en: 'Add Stock' },
      { k: 'inventory.edit',       tr: 'Stok Düzenleme',          en: 'Edit Stock' },
      { k: 'inventory.delete',     tr: 'Stok Silme',              en: 'Delete Stock' },
      { k: 'inventory.changeStatus', tr: 'Durum Değiştirme',      en: 'Change Status' },
      { k: 'inventory.bulk',       tr: 'Toplu İşlemler',          en: 'Bulk Operations' },
      { k: 'inventory.export',     tr: 'Dışa Aktar',              en: 'Export' },
      { k: 'inventory.share',      tr: 'Stok Paylaşma',           en: 'Share Stock' },
      { k: 'inventory.import',     tr: 'İçe Aktar',               en: 'Import' },
    ]
  },
  {
    module: 'chemicals', tr: 'Kimyasal Envanter', en: 'Chemical Inventory',
    perms: [
      { k: 'chemicals.view',       tr: 'Kimyasalları Görüntüleme', en: 'View Chemicals' },
      { k: 'chemicals.add',        tr: 'Kimyasal Ekleme',          en: 'Add Chemical' },
      { k: 'chemicals.edit',       tr: 'Kimyasal Düzenleme',       en: 'Edit Chemical' },
      { k: 'chemicals.delete',     tr: 'Kimyasal Silme',           en: 'Delete Chemical' },
      { k: 'chemicals.export',     tr: 'Dışa Aktar',               en: 'Export' },
    ]
  },
  {
    module: 'eln', tr: 'Lab Defteri (ELN)', en: 'Lab Notebook (ELN)',
    perms: [
      { k: 'eln.view',         tr: 'Kendi ELN Kayıtları',      en: 'View Own ELN' },
      { k: 'eln.viewAll',      tr: 'Tüm ELN Kayıtları',        en: 'View All ELN' },
      { k: 'eln.add',          tr: 'ELN Girişi Ekleme',         en: 'Add ELN Entry' },
      { k: 'eln.edit',         tr: 'ELN Girişi Düzenleme',      en: 'Edit ELN Entry' },
      { k: 'eln.delete',       tr: 'ELN Girişi Silme',          en: 'Delete ELN Entry' },
      { k: 'eln.export',       tr: 'Dışa Aktar',                en: 'Export' },
    ]
  },
  {
    module: 'orders', tr: 'Sipariş Listeleri', en: 'Order Lists',
    perms: [
      { k: 'orders.view',      tr: 'Siparişleri Görüntüleme',   en: 'View Orders' },
      { k: 'orders.add',       tr: 'Sipariş Ekleme',            en: 'Add Order' },
      { k: 'orders.edit',      tr: 'Sipariş Düzenleme',         en: 'Edit Order' },
      { k: 'orders.delete',    tr: 'Sipariş Silme',             en: 'Delete Order' },
    ]
  },
  {
    module: 'labwork', tr: 'Laboratuvar İşleri', en: 'Lab Work',
    perms: [
      { k: 'labwork.view',     tr: 'Görevleri Görüntüleme',     en: 'View Tasks' },
      { k: 'labwork.assign',   tr: 'Görev Atama',               en: 'Assign Tasks' },
      { k: 'labwork.manage',   tr: 'Görev Yönetimi',            en: 'Manage Tasks' },
      { k: 'labwork.delete',   tr: 'Görev Silme',               en: 'Delete Tasks' },
    ]
  },
  {
    module: 'calendar', tr: 'Takvim', en: 'Calendar',
    perms: [
      { k: 'calendar.view',    tr: 'Takvim Görüntüleme',        en: 'View Calendar' },
      { k: 'calendar.add',     tr: 'Etkinlik Ekleme',           en: 'Add Event' },
      { k: 'calendar.edit',    tr: 'Etkinlik Düzenleme',        en: 'Edit Event' },
      { k: 'calendar.delete',  tr: 'Etkinlik Silme',            en: 'Delete Event' },
      { k: 'calendar.sync',    tr: 'Google Calendar Senkron',   en: 'Google Calendar Sync' },
    ]
  },
  {
    module: 'analytics', tr: 'Analitik', en: 'Analytics',
    perms: [
      { k: 'analytics.view',       tr: 'Temel Analitik',        en: 'Basic Analytics' },
      { k: 'analytics.full',       tr: 'Tam Analitik Erişim',   en: 'Full Analytics' },
      { k: 'analytics.export',     tr: 'Rapor Dışa Aktar',      en: 'Export Reports' },
    ]
  },
  {
    module: 'admin', tr: 'Yönetim', en: 'Administration',
    perms: [
      { k: 'admin.viewUsers',     tr: 'Kullanıcıları Görüntüleme', en: 'View Users' },
      { k: 'admin.manageUsers',   tr: 'Kullanıcı Yönetimi',       en: 'Manage Users' },
      { k: 'admin.inviteUsers',   tr: 'Kullanıcı Daveti',         en: 'Invite Users' },
      { k: 'admin.approveUsers',  tr: 'Kullanıcı Onaylama',       en: 'Approve Users' },
      { k: 'admin.settings',      tr: 'Sistem Ayarları',          en: 'System Settings' },
      { k: 'admin.backup',        tr: 'Yedekleme / Geri Yükleme', en: 'Backup / Restore' },
      { k: 'admin.activityLog',   tr: 'Aktivite Kaydı',          en: 'Activity Log' },
      { k: 'admin.formSchema',    tr: 'Form Şeması Düzenleme',   en: 'Edit Form Schemas' },
    ]
  },
];

// Flatten all permissions into a single array for backward compat
const ALL_PERMS = PERM_MODULES.flatMap(m => m.perms);

// Default built-in roles
const DEFAULT_ROLES = {
  admin:    { tr: 'Lab Yöneticisi',      en: 'Lab Admin',          isDefault: true, order: 0 },
  pi:       { tr: 'PI / Danışman',        en: 'PI / Advisor',       isDefault: true, order: 1 },
  senior:   { tr: 'Kıdemli Araştırmacı',  en: 'Senior Researcher',  isDefault: true, order: 2 },
  researcher:{ tr: 'Araştırmacı',         en: 'Researcher',         isDefault: true, order: 3 },
  student:  { tr: 'Öğrenci',              en: 'Student',            isDefault: true, order: 4 },
  pending:  { tr: 'Beklemede',            en: 'Pending',            isDefault: true, order: 99 },
};

// Default permissions per built-in role
const ROLE_DEFAULTS = {
  admin: {
    'inventory.view':true, 'inventory.add':true, 'inventory.edit':true, 'inventory.delete':true, 'inventory.changeStatus':true, 'inventory.bulk':true, 'inventory.export':true, 'inventory.share':true, 'inventory.import':true,
    'chemicals.view':true, 'chemicals.add':true, 'chemicals.edit':true, 'chemicals.delete':true, 'chemicals.export':true,
    'eln.view':true, 'eln.viewAll':true, 'eln.add':true, 'eln.edit':true, 'eln.delete':true, 'eln.export':true,
    'orders.view':true, 'orders.add':true, 'orders.edit':true, 'orders.delete':true,
    'labwork.view':true, 'labwork.assign':true, 'labwork.manage':true, 'labwork.delete':true,
    'calendar.view':true, 'calendar.add':true, 'calendar.edit':true, 'calendar.delete':true, 'calendar.sync':true,
    'analytics.view':true, 'analytics.full':true, 'analytics.export':true,
    'admin.viewUsers':true, 'admin.manageUsers':true, 'admin.inviteUsers':true, 'admin.approveUsers':true, 'admin.settings':true, 'admin.backup':true, 'admin.activityLog':true, 'admin.formSchema':true,
  },
  pi: {
    'inventory.view':true, 'inventory.add':true, 'inventory.edit':true, 'inventory.delete':false, 'inventory.changeStatus':true, 'inventory.bulk':true, 'inventory.export':true, 'inventory.share':true, 'inventory.import':false,
    'chemicals.view':true, 'chemicals.add':true, 'chemicals.edit':true, 'chemicals.delete':false, 'chemicals.export':true,
    'eln.view':true, 'eln.viewAll':true, 'eln.add':true, 'eln.edit':true, 'eln.delete':false, 'eln.export':true,
    'orders.view':true, 'orders.add':true, 'orders.edit':true, 'orders.delete':false,
    'labwork.view':true, 'labwork.assign':true, 'labwork.manage':true, 'labwork.delete':false,
    'calendar.view':true, 'calendar.add':true, 'calendar.edit':true, 'calendar.delete':false, 'calendar.sync':true,
    'analytics.view':true, 'analytics.full':true, 'analytics.export':true,
    'admin.viewUsers':true, 'admin.manageUsers':false, 'admin.inviteUsers':false, 'admin.approveUsers':false, 'admin.settings':false, 'admin.backup':false, 'admin.activityLog':true, 'admin.formSchema':false,
  },
  senior: {
    'inventory.view':true, 'inventory.add':true, 'inventory.edit':true, 'inventory.delete':false, 'inventory.changeStatus':true, 'inventory.bulk':false, 'inventory.export':true, 'inventory.share':true, 'inventory.import':false,
    'chemicals.view':true, 'chemicals.add':true, 'chemicals.edit':true, 'chemicals.delete':false, 'chemicals.export':true,
    'eln.view':true, 'eln.viewAll':false, 'eln.add':true, 'eln.edit':true, 'eln.delete':false, 'eln.export':true,
    'orders.view':true, 'orders.add':true, 'orders.edit':true, 'orders.delete':false,
    'labwork.view':true, 'labwork.assign':true, 'labwork.manage':true, 'labwork.delete':false,
    'calendar.view':true, 'calendar.add':true, 'calendar.edit':true, 'calendar.delete':false, 'calendar.sync':false,
    'analytics.view':true, 'analytics.full':false, 'analytics.export':false,
    'admin.viewUsers':false, 'admin.manageUsers':false, 'admin.inviteUsers':false, 'admin.approveUsers':false, 'admin.settings':false, 'admin.backup':false, 'admin.activityLog':false, 'admin.formSchema':false,
  },
  researcher: {
    'inventory.view':true, 'inventory.add':true, 'inventory.edit':false, 'inventory.delete':false, 'inventory.changeStatus':true, 'inventory.bulk':false, 'inventory.export':false, 'inventory.share':true, 'inventory.import':false,
    'chemicals.view':true, 'chemicals.add':true, 'chemicals.edit':false, 'chemicals.delete':false, 'chemicals.export':false,
    'eln.view':true, 'eln.viewAll':false, 'eln.add':true, 'eln.edit':true, 'eln.delete':false, 'eln.export':false,
    'orders.view':true, 'orders.add':false, 'orders.edit':false, 'orders.delete':false,
    'labwork.view':true, 'labwork.assign':false, 'labwork.manage':false, 'labwork.delete':false,
    'calendar.view':true, 'calendar.add':true, 'calendar.edit':false, 'calendar.delete':false, 'calendar.sync':false,
    'analytics.view':true, 'analytics.full':false, 'analytics.export':false,
    'admin.viewUsers':false, 'admin.manageUsers':false, 'admin.inviteUsers':false, 'admin.approveUsers':false, 'admin.settings':false, 'admin.backup':false, 'admin.activityLog':false, 'admin.formSchema':false,
  },
  student: {
    'inventory.view':true, 'inventory.add':false, 'inventory.edit':false, 'inventory.delete':false, 'inventory.changeStatus':false, 'inventory.bulk':false, 'inventory.export':false, 'inventory.share':false, 'inventory.import':false,
    'chemicals.view':true, 'chemicals.add':false, 'chemicals.edit':false, 'chemicals.delete':false, 'chemicals.export':false,
    'eln.view':true, 'eln.viewAll':false, 'eln.add':true, 'eln.edit':false, 'eln.delete':false, 'eln.export':false,
    'orders.view':true, 'orders.add':false, 'orders.edit':false, 'orders.delete':false,
    'labwork.view':true, 'labwork.assign':false, 'labwork.manage':false, 'labwork.delete':false,
    'calendar.view':true, 'calendar.add':false, 'calendar.edit':false, 'calendar.delete':false, 'calendar.sync':false,
    'analytics.view':false, 'analytics.full':false, 'analytics.export':false,
    'admin.viewUsers':false, 'admin.manageUsers':false, 'admin.inviteUsers':false, 'admin.approveUsers':false, 'admin.settings':false, 'admin.backup':false, 'admin.activityLog':false, 'admin.formSchema':false,
  },
  pending: {
    'inventory.view':false, 'inventory.add':false, 'inventory.edit':false, 'inventory.delete':false, 'inventory.changeStatus':false, 'inventory.bulk':false, 'inventory.export':false, 'inventory.share':false, 'inventory.import':false,
    'chemicals.view':false, 'chemicals.add':false, 'chemicals.edit':false, 'chemicals.delete':false, 'chemicals.export':false,
    'eln.view':false, 'eln.viewAll':false, 'eln.add':false, 'eln.edit':false, 'eln.delete':false, 'eln.export':false,
    'orders.view':false, 'orders.add':false, 'orders.edit':false, 'orders.delete':false,
    'labwork.view':false, 'labwork.assign':false, 'labwork.manage':false, 'labwork.delete':false,
    'calendar.view':false, 'calendar.add':false, 'calendar.edit':false, 'calendar.delete':false, 'calendar.sync':false,
    'analytics.view':false, 'analytics.full':false, 'analytics.export':false,
    'admin.viewUsers':false, 'admin.manageUsers':false, 'admin.inviteUsers':false, 'admin.approveUsers':false, 'admin.settings':false, 'admin.backup':false, 'admin.activityLog':false, 'admin.formSchema':false,
  },
};

// ROLES map — starts with defaults, gets merged with custom roles from Firestore
let ROLES = { ...DEFAULT_ROLES };

// Load custom roles from Firestore and merge
async function loadCustomRoles() {
  try {
    const snap = await getDoc(doc(db, 'config', 'roles'));
    if (snap.exists()) {
      const data = snap.data();
      // Merge custom roles into ROLES
      if (data.customRoles) {
        Object.entries(data.customRoles).forEach(([key, role]) => {
          ROLES[key] = { ...role, isDefault: false };
        });
      }
      // Merge owner-modified permissions for default roles
      if (data.rolePermissions) {
        Object.entries(data.rolePermissions).forEach(([roleKey, perms]) => {
          if (ROLE_DEFAULTS[roleKey] !== undefined) {
            ROLE_DEFAULTS[roleKey] = { ...ROLE_DEFAULTS[roleKey], ...perms };
          } else {
            // Custom role permissions
            ROLE_DEFAULTS[roleKey] = { ...ROLE_DEFAULTS.pending, ...perms };
          }
        });
      }
    }
  } catch {}
}

// Backward compatibility mapping: old perm keys → new perm keys
const LEGACY_PERM_MAP = {
  addStock: 'inventory.add',
  changeStatus: 'inventory.changeStatus',
  addChemical: 'chemicals.add',
  assignTasks: 'labwork.assign',
  openOrders: 'orders.view',
  viewAllELN: 'eln.viewAll',
  fullAnalytics: 'analytics.full',
  inviteUsers: 'admin.inviteUsers',
  exportData: 'inventory.export',
  manageLabWork: 'labwork.manage',
  deleteStock: 'inventory.delete',
  bulkOperations: 'inventory.bulk',
};

// Resolve effective permission: override > role default > false
function hasPermission(userData, permKey) {
  if (!userData) return false;
  // Owner always has all permissions
  if (isSystemOwner(userData.email)) return true;
  // Map legacy permission keys
  const resolvedKey = LEGACY_PERM_MAP[permKey] || permKey;
  // Check per-user overrides first
  const overrides = userData.permOverrides || {};
  if (overrides[resolvedKey] !== undefined) return !!overrides[resolvedKey];
  // Legacy override check
  if (overrides[permKey] !== undefined && permKey !== resolvedKey) return !!overrides[permKey];
  // Role defaults
  const defaults = ROLE_DEFAULTS[userData.role] || ROLE_DEFAULTS.pending;
  if (defaults[resolvedKey] !== undefined) return !!defaults[resolvedKey];
  // Legacy default check
  if (defaults[permKey] !== undefined && permKey !== resolvedKey) return !!defaults[permKey];
  return false;
}

export {
  app, auth, db, gp, OWNER_EMAIL,
  signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut,
  collection, doc, addDoc, getDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, where,
  onSnapshot, getDocs, Timestamp, serverTimestamp,
  arrayUnion, arrayRemove, limit, startAfter,
  sendEmail, auditLog,
  addDays, fmtDate, fmtDateTime, todayISO,
  validateCAS, validateORCID,
  capitalize, exportToExcel,
  isSystemOwner, isLabAdmin,
  ROLES, DEFAULT_ROLES, ROLE_DEFAULTS, ALL_PERMS, PERM_MODULES,
  hasPermission, loadCustomRoles, LEGACY_PERM_MAP
};
