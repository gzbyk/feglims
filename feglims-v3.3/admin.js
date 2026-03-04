// ═══════════════════════════════════════════
//  FEGLIMS v3.1 — admin.js
//  Admin panel with role-based permissions
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, onSnapshot,
  getDocs, Timestamp, sendEmail, auditLog,
  ROLES, ROLE_DEFAULTS, ALL_PERMS, hasPermission
} from './firebase.js';

const A = window.APP;

// ── ADMIN PANEL ──────────────────────────────
export function renderAdmin() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="tabs" style="margin-bottom:18px">
      <div class="tab active" id="adm-tab-users"   onclick="admTab('users')">👥 ${A.lang==='tr'?'Kullanıcılar':'Users'}</div>
      <div class="tab"        id="adm-tab-pending" onclick="admTab('pending')">⏳ ${A.lang==='tr'?'Bekleyenler':'Pending'} <span id="admPendBadge"></span></div>
      <div class="tab"        id="adm-tab-notifs"  onclick="admTab('notifs')">🔔 ${A.lang==='tr'?'Bildirimler':'Notifications'}</div>
      <div class="tab"        id="adm-tab-forms"   onclick="admTab('forms')">📋 ${A.lang==='tr'?'Form Şeması':'Form Schema'}</div>
    </div>
    <div id="admContent"></div>`;
  admTab('users');
}

window.admTab = (t) => {
  ['users','pending','notifs','forms'].forEach(k => {
    document.getElementById(`adm-tab-${k}`)?.classList.toggle('active', k===t);
  });
  const fns = { users: loadAdminUsers, pending: loadPendingUsers, notifs: loadNotifs, forms: loadFormSchema };
  fns[t]?.();
};

// USERS LIST
function loadAdminUsers() {
  const el = document.getElementById('admContent');
  el.innerHTML = `
    <div class="tbl-wrap" style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>${A.lang==='tr'?'Ad Soyad':'Name'}</th>
          <th>E-posta</th>
          <th>${A.lang==='tr'?'Lab':'Lab'}</th>
          <th>${A.lang==='tr'?'Rol':'Role'}</th>
          <th>${A.lang==='tr'?'Özel İzin':'Overrides'}</th>
          <th></th>
        </tr></thead>
        <tbody id="usersTableBody"></tbody>
      </table>
    </div>`;

  const unsub = onSnapshot(collection(db, 'users'), snap => {
    let users = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.role !== 'pending' && u.labId === A.userData.labId)
      .sort((a,b) => (a.name||'').localeCompare(b.name||''));

    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => {
      const roleInfo = ROLES[u.role] || ROLES.pending;
      const roleLabel = roleInfo[A.lang] || u.role;
      const roleCls = u.role==='admin'?'b-admin':u.role==='pi'?'b-pi':u.role==='senior'?'b-open':'b-researcher';
      const overrideCount = Object.keys(u.permOverrides||{}).length;
      return `<tr>
        <td class="fw-bold">${u.name}</td>
        <td class="dim-cell" style="font-size:12px">${u.email||'—'}</td>
        <td class="dim-cell">${u.labName||'—'}</td>
        <td><span class="badge ${roleCls}">${roleLabel}</span></td>
        <td class="dim-cell">${overrideCount > 0 ? `${overrideCount} ${A.lang==='tr'?'özel':'custom'}` : '—'}</td>
        <td class="row" style="gap:4px">
          <button class="btn btn-secondary btn-xs" onclick="openEditUser('${u.uid}')">✏</button>
          <button class="btn btn-secondary btn-xs" onclick="openPermissions('${u.uid}','${u.name}','${u.role}')">🔑</button>
          ${u.uid !== A.user.uid ? `<button class="btn btn-red btn-xs" onclick="removeUser('${u.uid}','${u.name}')">✕</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  });
  A.unsubs.push(unsub);
}

// EDIT USER (admin)
window.openEditUser = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const u = snap.data();
  document.getElementById('eu_uid').value = uid;
  document.getElementById('eu_name').value = u.name || '';
  document.getElementById('eu_role').value = u.role || 'researcher';
  openOverlay('editUserModal');
};

window.saveEditUser = async () => {
  const uid  = document.getElementById('eu_uid').value;
  const name = document.getElementById('eu_name').value.trim();
  const role = document.getElementById('eu_role').value;
  if (!name) { toast(t('required'), 'err'); return; }
  await updateDoc(doc(db, 'users', uid), { name, role, updatedAt: Timestamp.now() });
  await auditLog('EDIT_USER', `Edited user: ${name} → role: ${role}`, A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('editUserModal');
  toast(t('saved'), 'ok');
};

window.removeUser = async (uid, name) => {
  if (!confirm(`${name} ${A.lang==='tr'?'sistemden kaldırılsın mı?':'removed from system?'}`)) return;
  await updateDoc(doc(db, 'users', uid), { role: 'pending' });
  await auditLog('REMOVE_USER', `Deactivated: ${name}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(t('deleted'), 'info');
};

// PERMISSIONS — Role defaults + per-user overrides
window.openPermissions = async (uid, name, role) => {
  document.getElementById('permUid').value = uid;
  document.getElementById('permUserName').textContent = name;
  const snap = await getDoc(doc(db, 'users', uid));
  const userData = snap.data() || {};
  const userRole = userData.role || role || 'researcher';
  const overrides = userData.permOverrides || {};
  const defaults = ROLE_DEFAULTS[userRole] || ROLE_DEFAULTS.researcher;

  const grid = document.getElementById('permGrid');
  grid.innerHTML = `
    <div style="margin-bottom:12px;font-size:12px;color:var(--text3)">
      ${A.lang==='tr'?'Rol':'Role'}: <strong>${(ROLES[userRole]||{})[A.lang]||userRole}</strong> — 
      ${A.lang==='tr'?'Üç durumlu: Rol Varsayılanı / Açık / Kapalı':'Three-state: Role Default / Override On / Override Off'}
    </div>
    ${ALL_PERMS.map(p => {
      const defVal = !!defaults[p.k];
      const hasOverride = overrides[p.k] !== undefined;
      const effectiveVal = hasOverride ? !!overrides[p.k] : defVal;
      // state: 'default', 'on', 'off'
      const state = hasOverride ? (overrides[p.k] ? 'on' : 'off') : 'default';
      return `
      <div class="perm-row" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <span style="font-size:13px">${A.lang==='tr'?p.tr:p.en}</span>
          <span style="font-size:10px;color:var(--text3);margin-left:6px">[${A.lang==='tr'?'varsayılan':'default'}: ${defVal?'✅':'❌'}]</span>
        </div>
        <div class="row" style="gap:4px">
          <button class="btn btn-xs ${state==='default'?'btn-primary':'btn-ghost'}" onclick="setPermState('${p.k}','default')" id="ps_${p.k}_default" title="${A.lang==='tr'?'Rol Varsayılanı':'Role Default'}">
            🔄
          </button>
          <button class="btn btn-xs ${state==='on'?'btn-primary':'btn-ghost'}" onclick="setPermState('${p.k}','on')" id="ps_${p.k}_on" title="${A.lang==='tr'?'Açık':'On'}">
            ✅
          </button>
          <button class="btn btn-xs ${state==='off'?'btn-red':'btn-ghost'}" onclick="setPermState('${p.k}','off')" id="ps_${p.k}_off" title="${A.lang==='tr'?'Kapalı':'Off'}">
            ❌
          </button>
        </div>
      </div>`;
    }).join('')}`;
  openOverlay('permissionsModal');
};

window.setPermState = (key, state) => {
  ['default','on','off'].forEach(s => {
    const btn = document.getElementById(`ps_${key}_${s}`);
    if (!btn) return;
    btn.className = `btn btn-xs ${s===state ? (s==='off'?'btn-red':'btn-primary') : 'btn-ghost'}`;
  });
};

window.savePermissions = async () => {
  const uid = document.getElementById('permUid').value;
  const overrides = {};
  ALL_PERMS.forEach(p => {
    const onBtn = document.getElementById(`ps_${p.k}_on`);
    const offBtn = document.getElementById(`ps_${p.k}_off`);
    const isOn = onBtn?.classList.contains('btn-primary');
    const isOff = offBtn?.classList.contains('btn-red');
    if (isOn) overrides[p.k] = true;
    else if (isOff) overrides[p.k] = false;
    // else: default — no override
  });
  await updateDoc(doc(db, 'users', uid), { permOverrides: overrides });
  await auditLog('PERM_CHANGE', `Updated permissions for user ${uid} (${Object.keys(overrides).length} overrides)`,
    A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('permissionsModal');
  toast(t('saved'), 'ok');
};

// PENDING USERS
function loadPendingUsers() {
  const el = document.getElementById('admContent');
  const unsub = onSnapshot(collection(db, 'users'), snap => {
    const pending = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.role === 'pending');

    const badge = document.getElementById('admPendBadge');
    if (badge) badge.innerHTML = pending.length ? `<span class="nav-badge" style="margin-left:6px">${pending.length}</span>` : '';

    if (pending.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div>
        <div class="empty-text">${A.lang==='tr'?'Bekleyen kullanıcı yok.':'No pending users.'}</div></div>`;
      return;
    }
    el.innerHTML = pending.map(u => `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-weight:700;font-size:15px">${u.name}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:3px">
              ${u.email} · ${u.lab} · ${u.position||'—'}
              ${u.orcid?` · ORCID: ${u.orcid}`:''}
            </div>
          </div>
          <div class="row" style="gap:8px">
            <select class="fc" id="role_${u.uid}" style="width:160px">
              <option value="student">${A.lang==='tr'?'Öğrenci':'Student'}</option>
              <option value="researcher">${A.lang==='tr'?'Araştırmacı':'Researcher'}</option>
              <option value="senior">${A.lang==='tr'?'Kıdemli Araştırmacı':'Senior Researcher'}</option>
              <option value="pi">PI</option>
              <option value="admin">${A.lang==='tr'?'Lab Yöneticisi':'Lab Admin'}</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="approveUser('${u.uid}','${u.name}','${u.email}')">
              ✅ ${A.lang==='tr'?'Onayla':'Approve'}
            </button>
            <button class="btn btn-red btn-sm" onclick="rejectUser('${u.uid}','${u.name}')">
              ✕ ${A.lang==='tr'?'Reddet':'Reject'}
            </button>
          </div>
        </div>
      </div>`).join('');
  });
  A.unsubs.push(unsub);
}

window.approveUser = async (uid, name, email) => {
  const role = document.getElementById(`role_${uid}`)?.value || 'researcher';
  await updateDoc(doc(db, 'users', uid), { role, approvedAt: Timestamp.now(), approvedBy: A.userData.name });

  const ok = await sendEmail({
    to_email: email, to_name: name,
    subject: A.lang==='tr'?'Hesabınız Onaylandı':'Your Account Has Been Approved',
    message: A.lang==='tr'
      ? `Merhaba ${name},\n\nHesabınız yönetici tarafından onaylandı. Artık FEGLIMS'e giriş yapabilirsiniz.\n\nRolünüz: ${role}`
      : `Hello ${name},\n\nYour account has been approved by the administrator. You can now log in to FEGLIMS.\n\nRole: ${role}`,
    lab_name: A.userData.labName,
  });

  await auditLog('APPROVE', `Approved ${name} as ${role}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(t('approved') + (ok?` · ${t('emailSent')}`:''), 'ok');
};

window.rejectUser = async (uid, name) => {
  if (!confirm(`${name} ${A.lang==='tr'?'reddedilsin mi?':'rejected?'}`)) return;
  await updateDoc(doc(db, 'users', uid), { role: 'rejected' });
  await auditLog('REJECT_USER', `Rejected: ${name}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(t('deleted'), 'info');
};

// NOTIFICATIONS
function loadNotifs() {
  const el = document.getElementById('admContent');
  const unsub = onSnapshot(
    query(collection(db, 'notifications'), orderBy('createdAt', 'desc')),
    snap => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (notifs.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div>
          <div class="empty-text">${A.lang==='tr'?'Bildirim yok.':'No notifications.'}</div></div>`;
        return;
      }
      el.innerHTML = `<div class="tbl-wrap">` +
        notifs.map(n => `
          <div class="log-entry" style="${n.read?'':'background:var(--amber-bg)'}">
            <div class="log-icon" style="background:${n.newStatus==='Lost'?'var(--red-bg)':'var(--amber-bg)'}">
              ${n.newStatus==='Lost'?'❌':'⚠️'}
            </div>
            <div class="log-body">
              <div class="log-action">${n.stockCode} → <span class="badge ${n.newStatus==='Lost'?'b-lost':'b-weak'}">${n.newStatus}</span></div>
              <div class="log-detail">${n.changedBy} — ${n.reason}</div>
            </div>
            <div class="log-time">${fmtDateTime(n.createdAt, A.lang)}</div>
            ${!n.read?`<button class="btn btn-ghost btn-xs" onclick="markNotifRead('${n.id}')">✓</button>`:''}
          </div>`).join('') +
        `</div>`;
    });
  A.unsubs.push(unsub);
}

window.markNotifRead = async (id) => {
  await updateDoc(doc(db, 'notifications', id), { read: true });
};

// FORM SCHEMA EDITOR
const FORM_TYPES = ['text','number','date','select','checkbox'];
const FORMS_LIST = ['stock','chemical','labwork','order'];

function loadFormSchema() {
  const el = document.getElementById('admContent');
  el.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between">
      <div class="row" style="gap:8px">
        ${FORMS_LIST.map(f => `
          <button class="btn btn-secondary btn-sm" id="fsbtn_${f}"
                  onclick="selectFormToEdit('${f}')">${f}</button>`).join('')}
      </div>
      <button class="btn btn-primary btn-sm" onclick="addFormField()">
        ＋ ${A.lang==='tr'?'Alan Ekle':'Add Field'}
      </button>
    </div>
    <div id="formSchemaContent"></div>`;
  selectFormToEdit('stock');
}

window.selectFormToEdit = async (formName) => {
  FORMS_LIST.forEach(f => {
    const b = document.getElementById(`fsbtn_${f}`);
    if (b) b.classList.toggle('btn-primary', f===formName);
    if (b) b.classList.toggle('btn-secondary', f!==formName);
  });
  document.getElementById('currentFormName').value = formName;
  await loadSchemaFields(formName);
};

async function loadSchemaFields(formName) {
  const el = document.getElementById('formSchemaContent');
  const snap = await getDoc(doc(db, 'formSchemas', formName));
  const fields = snap.exists() ? snap.data().fields || [] : [];

  el.innerHTML = fields.length === 0
    ? `<div class="empty-state"><div class="empty-text">${A.lang==='tr'?'Özel alan yok. ＋ ile ekleyin.':'No custom fields. Add with ＋.'}</div></div>`
    : `<div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>${A.lang==='tr'?'Başlık':'Label'}</th>
            <th>${A.lang==='tr'?'Tip':'Type'}</th>
            <th>${A.lang==='tr'?'Zorunlu':'Required'}</th>
            <th>${A.lang==='tr'?'Seçenekler':'Options'}</th>
            <th></th>
          </tr></thead>
          <tbody>${fields.map((f,i) => `
            <tr>
              <td class="fw-bold">${f.label}</td>
              <td><span class="badge b-pi">${f.type}</span></td>
              <td>${f.required?'✅':'—'}</td>
              <td class="dim-cell" style="font-size:11px">${(f.options||[]).join(', ')||'—'}</td>
              <td class="row" style="gap:4px">
                <button class="btn btn-secondary btn-xs" onclick="editFormField(${i})">✏</button>
                <button class="btn btn-red btn-xs" onclick="deleteFormField(${i})">🗑</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}

window.addFormField = () => {
  document.getElementById('ffLabel').value = '';
  document.getElementById('ffType').value = 'text';
  document.getElementById('ffRequired').checked = false;
  document.getElementById('ffOptions').value = '';
  document.getElementById('ffFieldIndex').value = '-1';
  toggleOptionsRow();
  openOverlay('formFieldModal');
};

window.editFormField = async (idx) => {
  const formName = document.getElementById('currentFormName')?.value;
  const snap = await getDoc(doc(db, 'formSchemas', formName));
  const fields = snap.exists() ? snap.data().fields || [] : [];
  const f = fields[idx];
  if (!f) return;
  document.getElementById('ffLabel').value = f.label;
  document.getElementById('ffType').value = f.type;
  document.getElementById('ffRequired').checked = !!f.required;
  document.getElementById('ffOptions').value = (f.options||[]).join(', ');
  document.getElementById('ffFieldIndex').value = idx;
  toggleOptionsRow();
  openOverlay('formFieldModal');
};

window.toggleOptionsRow = () => {
  const t = document.getElementById('ffType')?.value;
  const wrap = document.getElementById('ffOptionsRow');
  if (wrap) wrap.style.display = t === 'select' ? 'block' : 'none';
};

window.saveFormField = async () => {
  const formName = document.getElementById('currentFormName')?.value;
  const label    = document.getElementById('ffLabel').value.trim();
  const type     = document.getElementById('ffType').value;
  const required = document.getElementById('ffRequired').checked;
  const opts     = document.getElementById('ffOptions').value.split(',').map(s=>s.trim()).filter(Boolean);
  const idx      = parseInt(document.getElementById('ffFieldIndex').value);

  if (!label) { toast(t('required'), 'err'); return; }

  const ref  = doc(db, 'formSchemas', formName);
  const snap = await getDoc(ref);
  const fields = snap.exists() ? snap.data().fields || [] : [];

  const field = { label, type, required, ...(type==='select'?{options:opts}:{}) };
  if (idx >= 0) fields[idx] = field;
  else fields.push(field);

  await setDoc(ref, { fields, updatedAt: Timestamp.now() }, { merge: true });
  await auditLog('CONFIG', `Form schema updated: ${formName}/${label}`,
    A.user.uid, A.userData.name, A.userData.labId);

  closeOverlay('formFieldModal');
  await loadSchemaFields(formName);
  toast(t('saved'), 'ok');
};

window.deleteFormField = async (idx) => {
  const formName = document.getElementById('currentFormName')?.value;
  const ref  = doc(db, 'formSchemas', formName);
  const snap = await getDoc(ref);
  const fields = snap.exists() ? snap.data().fields || [] : [];
  fields.splice(idx, 1);
  await setDoc(ref, { fields }, { merge: true });
  await loadSchemaFields(formName);
  toast(t('deleted'), 'info');
};

// ── SETTINGS ─────────────────────────────────
export function renderSettings() {
  if (A.userData.role !== 'admin') return;
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="tabs" style="margin-bottom:18px">
      <div class="tab active" id="set-tab-general"   onclick="setTab('general')">⚙ ${A.lang==='tr'?'Genel':'General'}</div>
      <div class="tab"        id="set-tab-dropdowns" onclick="setTab('dropdowns')">📋 ${A.lang==='tr'?'Dropdown Listeleri':'Dropdown Lists'}</div>
      <div class="tab"        id="set-tab-cycle"     onclick="setTab('cycle')">🔄 ${A.lang==='tr'?'Döngü Kuralları':'Cycle Rules'}</div>
    </div>
    <div id="settingsContent"></div>`;
  setTab('general');
}

window.setTab = (t) => {
  ['general','dropdowns','cycle'].forEach(k => {
    document.getElementById(`set-tab-${k}`)?.classList.toggle('active', k===t);
  });
  const fns = { general: loadGeneralSettings, dropdowns: loadDropdownSettings, cycle: loadCycleSettings };
  fns[t]?.();
};

function loadGeneralSettings() {
  const sc = A.sysConfig;
  document.getElementById('settingsContent').innerHTML = `
    <div class="card">
      <div class="card-title">${A.lang==='tr'?'Laboratuvar Bilgileri':'Laboratory Information'}</div>
      <div class="fg fg1" style="gap:14px">
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Laboratuvar Adı':'Lab Name'}</label>
          <input class="fc" id="cfg_labName" value="${sc.labName||'Functional and Evolutionary Genetics Laboratory'}">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Laboratuvar Açıklaması':'Lab Description'}</label>
          <input class="fc" id="cfg_labDesc" value="${sc.labDesc||''}">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Kurum':'Institution'}</label>
          <input class="fc" id="cfg_institution" value="${sc.institution||'Hacettepe University'}">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Uygulama URL':'App URL'}</label>
          <input class="fc" id="cfg_appUrl" value="${sc.appUrl||window.location.origin}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveGeneralSettings()">
            💾 ${A.lang==='tr'?'Kaydet':'Save'}
          </button>
        </div>
      </div>
    </div>`;
}

window.saveGeneralSettings = async () => {
  const cfg = {
    labName:     document.getElementById('cfg_labName').value.trim(),
    labDesc:     document.getElementById('cfg_labDesc').value.trim(),
    institution: document.getElementById('cfg_institution').value.trim(),
    appUrl:      document.getElementById('cfg_appUrl').value.trim(),
    updatedAt:   Timestamp.now(),
  };
  await setDoc(doc(db, 'config', 'system'), cfg, { merge: true });
  A.sysConfig = { ...A.sysConfig, ...cfg };
  await auditLog('CONFIG', 'General settings updated', A.user.uid, A.userData.name, A.userData.labId);
  toast(t('saved'), 'ok');
};

// DROPDOWN MANAGER
const DROPDOWN_KEYS = [
  { k: 'species',    tr: 'Türler / Species' },
  { k: 'lineages',   tr: 'Soy Kategorileri / Lineages' },
  { k: 'centers',    tr: 'Stok Merkezleri / Stock Centers' },
  { k: 'climates',   tr: 'İklim Odası Sıcaklıkları / Climate Temps' },
  { k: 'positions',  tr: 'Unvanlar / Positions' },
  { k: 'ghsClasses', tr: 'GHS Sınıfları / GHS Classes' },
  { k: 'hazardTypes',tr: 'Tehlike Tipleri / Hazard Types' },
  { k: 'orderTypes', tr: 'Sipariş Tipleri / Order Types' },
];

let editingDropdown = null;

function loadDropdownSettings() {
  const el = document.getElementById('settingsContent');
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;align-items:start">
      <div class="card">
        <div class="card-title">${A.lang==='tr'?'Liste Seç':'Select List'}</div>
        ${DROPDOWN_KEYS.map(d => `
          <div class="nav-item" id="dd-btn-${d.k}" onclick="editDropdown('${d.k}')"
               style="border-radius:var(--r);margin-bottom:4px">
            <span>${d.tr}</span>
          </div>`).join('')}
      </div>
      <div class="card" id="ddEditPanel">
        <div class="empty-state"><div class="empty-text">${A.lang==='tr'?'Sol taraftan bir liste seçin.':'Select a list from the left.'}</div></div>
      </div>
    </div>`;
}

window.editDropdown = async (key) => {
  editingDropdown = key;
  DROPDOWN_KEYS.forEach(d => {
    document.getElementById(`dd-btn-${d.k}`)?.classList.toggle('active', d.k===key);
  });
  const snap = await getDoc(doc(db, 'config', 'system'));
  const items = snap.exists() ? (snap.data()[key] || getDefaultDropdown(key)) : getDefaultDropdown(key);
  A.sysConfig[key] = items;

  document.getElementById('ddEditPanel').innerHTML = `
    <div class="card-title">
      ${DROPDOWN_KEYS.find(d=>d.k===key)?.tr || key}
      <button class="btn btn-primary btn-sm" onclick="addDropdownItem()">＋ ${A.lang==='tr'?'Ekle':'Add'}</button>
    </div>
    <div id="ddItemsList"></div>`;
  renderDropdownItems(items);
};

function renderDropdownItems(items) {
  document.getElementById('ddItemsList').innerHTML = items.map((item, i) => `
    <div class="row" style="gap:8px;margin-bottom:6px">
      <input class="fc" style="flex:1" value="${item}" id="ddi_${i}"
             onchange="updateDropdownItem(${i}, this.value)">
      <button class="btn btn-red btn-icon" onclick="deleteDropdownItem(${i})">🗑</button>
    </div>`).join('');
}

window.addDropdownItem = async () => {
  const snap = await getDoc(doc(db, 'config', 'system'));
  const items = snap.exists() ? (snap.data()[editingDropdown] || getDefaultDropdown(editingDropdown)) : getDefaultDropdown(editingDropdown);
  items.push(A.lang==='tr'?'Yeni Öğe':'New Item');
  await setDoc(doc(db, 'config', 'system'), { [editingDropdown]: items }, { merge: true });
  A.sysConfig[editingDropdown] = items;
  renderDropdownItems(items);
};

window.updateDropdownItem = async (idx, val) => {
  const snap = await getDoc(doc(db, 'config', 'system'));
  const items = snap.exists() ? (snap.data()[editingDropdown] || []) : [];
  items[idx] = val;
  await setDoc(doc(db, 'config', 'system'), { [editingDropdown]: items, updatedAt: Timestamp.now() }, { merge: true });
  A.sysConfig[editingDropdown] = items;
  await auditLog('CONFIG', `Dropdown ${editingDropdown}[${idx}] = ${val}`,
    A.user.uid, A.userData.name, A.userData.labId);
  toast(t('saved'), 'ok');
};

window.deleteDropdownItem = async (idx) => {
  const snap = await getDoc(doc(db, 'config', 'system'));
  const items = snap.exists() ? (snap.data()[editingDropdown] || []) : [];
  items.splice(idx, 1);
  await setDoc(doc(db, 'config', 'system'), { [editingDropdown]: items }, { merge: true });
  A.sysConfig[editingDropdown] = items;
  renderDropdownItems(items);
  toast(t('deleted'), 'info');
};

function getDefaultDropdown(key) {
  const defaults = {
    species:    ['D. melanogaster','D. simulans','D. virilis','D. pseudoobscura'],
    lineages:   ['Wild-type','Isogenic','Balancer','Genome Editing','Disease Model','Transposon','RNAi','GAL4'],
    centers:    ['BDSC','VDRC','KYOTO','DGRC','Lab Stock','Custom'],
    climates:   ['18','25'],
    positions:  ['PhD Student','MSc Student','PostDoc','Research Assistant','Technician','PI','Professor'],
    ghsClasses: ['GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09'],
    hazardTypes:['Flammable','Toxic','Corrosive','Oxidizing','Explosive','Environmental'],
    orderTypes: ['Fly Stock','Chemical','Equipment','Consumable','Other'],
  };
  return defaults[key] || [];
}

// CYCLE RULES
function loadCycleSettings() {
  const el = document.getElementById('settingsContent');
  const unsub = onSnapshot(collection(db, 'cycleRules'), snap => {
    A.cycleRules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rows = A.cycleRules.map(r => `
      <tr>
        <td class="mono-cell">${r.temp}°C</td>
        <td class="mono-cell">${r.clearing} ${A.lang==='tr'?'gün':'days'}</td>
        <td class="mono-cell">${r.transfer} ${A.lang==='tr'?'gün':'days'}</td>
        <td class="dim-cell">${r.notes||'—'}</td>
        <td><button class="btn btn-secondary btn-xs" onclick="editCycleRule('${r.id}')">✏</button></td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:14px">
        <div style="font-size:13px;color:var(--text2)">
          ${A.lang==='tr'?'Sıcaklığa göre biyolojik döngü parametreleri':'Biological cycle parameters by temperature'}
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAddCycleRule()">
          ＋ ${A.lang==='tr'?'Kural Ekle':'Add Rule'}
        </button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr>
            <th>${A.lang==='tr'?'Sıcaklık':'Temp'}</th>
            <th>${A.lang==='tr'?'Ergin Atımı (gün)':'Parent Removal (days)'}</th>
            <th>${A.lang==='tr'?'Transfer Günü':'Transfer Day'}</th>
            <th>${A.lang==='tr'?'Notlar':'Notes'}</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  });
  A.unsubs.push(unsub);
}

window.openAddCycleRule = () => {
  document.getElementById('cr_id').value = '';
  document.getElementById('cr_temp').value = '';
  document.getElementById('cr_clearing').value = '3';
  document.getElementById('cr_transfer').value = '17';
  document.getElementById('cr_notes').value = '';
  openOverlay('cycleRuleModal');
};

window.editCycleRule = async (id) => {
  const snap = await getDoc(doc(db, 'cycleRules', id));
  if (!snap.exists()) return;
  const r = snap.data();
  document.getElementById('cr_id').value = id;
  document.getElementById('cr_temp').value = r.temp;
  document.getElementById('cr_clearing').value = r.clearing;
  document.getElementById('cr_transfer').value = r.transfer;
  document.getElementById('cr_notes').value = r.notes || '';
  openOverlay('cycleRuleModal');
};

window.saveCycleRule = async () => {
  const id       = document.getElementById('cr_id').value;
  const temp     = document.getElementById('cr_temp').value.trim();
  const clearing = document.getElementById('cr_clearing').value;
  const transfer = document.getElementById('cr_transfer').value;
  const notes    = document.getElementById('cr_notes').value.trim();
  if (!temp) { toast(t('required'), 'err'); return; }
  const data = { temp, clearing: Number(clearing), transfer: Number(transfer), notes };
  if (id) await updateDoc(doc(db, 'cycleRules', id), data);
  else await addDoc(collection(db, 'cycleRules'), data);
  await auditLog('CONFIG', `Cycle rule: ${temp}°C clearing=${clearing}d transfer=${transfer}d`,
    A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('cycleRuleModal');
  toast(t('saved'), 'ok');
};

// HIDDEN FIELDS
window.currentFormName = { value: 'stock' };
// Expose for inline HTML
document.addEventListener('DOMContentLoaded', () => {
  const el = document.createElement('input');
  el.type = 'hidden'; el.id = 'currentFormName'; el.value = 'stock';
  document.body.appendChild(el);
});
