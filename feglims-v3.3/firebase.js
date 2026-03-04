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
const OWNER_EMAIL = 'memet.celik@hacettepe.edu.tr';

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

// ── ROLE-BASED PERMISSION SYSTEM ─────────────
const ROLES = {
  admin:    { tr: 'Lab Yöneticisi',      en: 'Lab Admin' },
  pi:       { tr: 'PI / Danışman',        en: 'PI / Advisor' },
  senior:   { tr: 'Kıdemli Araştırmacı',  en: 'Senior Researcher' },
  researcher:{ tr: 'Araştırmacı',         en: 'Researcher' },
  student:  { tr: 'Öğrenci',              en: 'Student' },
  pending:  { tr: 'Beklemede',            en: 'Pending' },
};

const ROLE_DEFAULTS = {
  admin:      { addStock:true, changeStatus:true, addChemical:true, assignTasks:true, openOrders:true, viewAllELN:true, fullAnalytics:true, inviteUsers:true, exportData:true, manageLabWork:true, deleteStock:true, bulkOperations:true },
  pi:         { addStock:true, changeStatus:true, addChemical:true, assignTasks:true, openOrders:true, viewAllELN:true, fullAnalytics:true, inviteUsers:false, exportData:true, manageLabWork:true, deleteStock:false, bulkOperations:true },
  senior:     { addStock:true, changeStatus:true, addChemical:true, assignTasks:true, openOrders:true, viewAllELN:false, fullAnalytics:false, inviteUsers:false, exportData:true, manageLabWork:true, deleteStock:false, bulkOperations:false },
  researcher: { addStock:true, changeStatus:true, addChemical:true, assignTasks:false, openOrders:false, viewAllELN:false, fullAnalytics:false, inviteUsers:false, exportData:false, manageLabWork:false, deleteStock:false, bulkOperations:false },
  student:    { addStock:false, changeStatus:false, addChemical:false, assignTasks:false, openOrders:false, viewAllELN:false, fullAnalytics:false, inviteUsers:false, exportData:false, manageLabWork:false, deleteStock:false, bulkOperations:false },
  pending:    { addStock:false, changeStatus:false, addChemical:false, assignTasks:false, openOrders:false, viewAllELN:false, fullAnalytics:false, inviteUsers:false, exportData:false, manageLabWork:false, deleteStock:false, bulkOperations:false },
};

const ALL_PERMS = [
  { k: 'addStock',       tr: 'Stok Ekleme',             en: 'Add Stock' },
  { k: 'changeStatus',   tr: 'Durum Değiştirme',        en: 'Change Status' },
  { k: 'addChemical',    tr: 'Kimyasal Ekleme',         en: 'Add Chemical' },
  { k: 'assignTasks',    tr: 'Görev Atama',             en: 'Assign Tasks' },
  { k: 'openOrders',     tr: 'Sipariş Listesi Açma',    en: 'Open Order Lists' },
  { k: 'viewAllELN',     tr: 'Tüm ELN Kayıtları',      en: 'View All ELN' },
  { k: 'fullAnalytics',  tr: 'Tam Analitik Erişim',     en: 'Full Analytics' },
  { k: 'inviteUsers',    tr: 'Kullanıcı Daveti',        en: 'Invite Users' },
  { k: 'exportData',     tr: 'Veri Dışa Aktarım',       en: 'Export Data' },
  { k: 'manageLabWork',  tr: 'Lab İşleri Yönetimi',     en: 'Manage Lab Work' },
  { k: 'deleteStock',    tr: 'Stok Silme',              en: 'Delete Stock' },
  { k: 'bulkOperations', tr: 'Toplu İşlemler',          en: 'Bulk Operations' },
];

// Resolve effective permission: override > role default
function hasPermission(userData, permKey) {
  if (!userData) return false;
  if (userData.role === 'admin') return true; // Admin always has all
  const overrides = userData.permOverrides || {};
  if (overrides[permKey] !== undefined) return !!overrides[permKey];
  const defaults = ROLE_DEFAULTS[userData.role] || ROLE_DEFAULTS.pending;
  return !!defaults[permKey];
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
  ROLES, ROLE_DEFAULTS, ALL_PERMS, hasPermission
};
