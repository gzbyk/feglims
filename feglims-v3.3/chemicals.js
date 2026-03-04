// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — chemicals.js
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDate, todayISO, validateCAS
} from './firebase.js';

const A = window.APP;

export function renderChemicals() {
  const content = document.getElementById('content');
  const isAdmin = A.userData.role === 'admin';
  const canAdd = isAdmin || A.userData.permissions?.addChemical;

  content.innerHTML = `
    <div class="bulk-bar" id="chemBulkBar">
      <span class="bulk-count" id="chemBulkCount">0 seçili</span>
      <button class="btn btn-secondary btn-sm" onclick="chemBulkExport()">📊 Excel</button>
      <button class="btn btn-ghost btn-sm" onclick="chemClearSelection()">✕</button>
    </div>
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap;gap:10px;justify-content:space-between">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select class="fc" id="chemFilterGhs" style="width:160px" onchange="loadChemicals()">
          <option value="">Tüm GHS Sınıfları</option>
          ${(A.sysConfig.ghsClasses || ['Flammable','Corrosive','Toxic','Oxidizer','Harmful','Environmental']).map(g =>
            `<option value="${g}">${g}</option>`
          ).join('')}
        </select>
        <select class="fc" id="chemFilterExp" style="width:160px" onchange="loadChemicals()">
          <option value="">Tüm Son Kullanma</option>
          <option value="30">30 gün içinde</option>
          <option value="60">60 gün içinde</option>
          <option value="90">90 gün içinde</option>
          <option value="expired">Süresi Geçmiş</option>
        </select>
        <div class="search-wrap" style="max-width:220px">
          <span class="search-icon">🔍</span>
          <input class="search-input" placeholder="Ara..." id="chemSearch" oninput="loadChemicals()">
        </div>
      </div>
      <div class="row" style="gap:8px">
        ${canAdd ? `<button class="btn btn-primary" onclick="openAddChem()">＋ ${A.lang==='tr'?'Kimyasal Ekle':'Add Chemical'}</button>` : ''}
        <button class="btn btn-secondary" onclick="chemExportAll()">📊 Excel</button>
      </div>
    </div>
    <div class="tbl-wrap">
      <table id="chemTable">
        <thead><tr>
          <th style="width:36px"><input type="checkbox" id="chemSelAll" onchange="chemToggleAll(this.checked)"></th>
          <th>${A.lang==='tr'?'Kimyasal Adı':'Chemical Name'}</th>
          <th>CAS No</th>
          <th>GHS</th>
          <th>${A.lang==='tr'?'Miktar':'Amount'}</th>
          <th>${A.lang==='tr'?'Konum':'Location'}</th>
          <th>${A.lang==='tr'?'Son Kullanma':'Expiry'}</th>
          <th>${A.lang==='tr'?'Sorumlu':'Responsible'}</th>
          <th></th>
        </tr></thead>
        <tbody id="chemBody"></tbody>
      </table>
    </div>`;

  loadChemicals();
}

let selectedChems = new Set();

window.chemToggleAll = (checked) => {
  document.querySelectorAll('.chem-cb').forEach(cb => {
    cb.checked = checked;
    checked ? selectedChems.add(cb.dataset.id) : selectedChems.delete(cb.dataset.id);
  });
  updateChemBulkBar();
};

window.chemToggle = (id, checked) => {
  checked ? selectedChems.add(id) : selectedChems.delete(id);
  updateChemBulkBar();
};

function updateChemBulkBar() {
  const bar = document.getElementById('chemBulkBar');
  const cnt = document.getElementById('chemBulkCount');
  if (bar) bar.classList.toggle('active', selectedChems.size > 0);
  if (cnt) cnt.textContent = `${selectedChems.size} seçili`;
}

window.chemClearSelection = () => {
  selectedChems.clear();
  document.querySelectorAll('.chem-cb').forEach(cb => cb.checked = false);
  const all = document.getElementById('chemSelAll');
  if (all) all.checked = false;
  updateChemBulkBar();
};

window.loadChemicals = () => {
  const ghs = document.getElementById('chemFilterGhs')?.value || '';
  const exp = document.getElementById('chemFilterExp')?.value || '';
  const search = document.getElementById('chemSearch')?.value?.toLowerCase() || '';

  const q = query(collection(db, 'chemicals'), orderBy('createdAt', 'desc'));
  const unsub = window.APP.unsubs[window.APP.unsubs.length - 1];
  if (unsub) unsub();

  const u = onSnapshot(q, snap => {
    let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (A.userData.role !== 'admin') rows = rows.filter(r => r.labId === A.userData.labId);

    if (ghs) rows = rows.filter(r => (r.ghsClasses || []).includes(ghs));
    if (search) rows = rows.filter(r =>
      (r.name || '').toLowerCase().includes(search) ||
      (r.casNo || '').toLowerCase().includes(search)
    );

    const today = new Date();
    if (exp === 'expired') {
      rows = rows.filter(r => r.expiryDate && new Date(r.expiryDate) < today);
    } else if (exp) {
      const days = parseInt(exp);
      rows = rows.filter(r => {
        if (!r.expiryDate) return false;
        const diff = (new Date(r.expiryDate) - today) / 86400000;
        return diff >= 0 && diff <= days;
      });
    }

    const tbody = document.getElementById('chemBody');
    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3)">${window.t('noData')}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(c => {
      const expDate = c.expiryDate ? new Date(c.expiryDate) : null;
      const daysDiff = expDate ? (expDate - today) / 86400000 : null;
      const expClass = !expDate ? '' : daysDiff < 0 ? 'style="color:var(--red)"' : daysDiff < 30 ? 'style="color:var(--amber)"' : '';
      const ghsBadges = (c.ghsClasses || []).map(g => `<span class="badge" style="font-size:10px;background:var(--surface3)">${g}</span>`).join(' ');
      const isAdmin = A.userData.role === 'admin';
      const canEdit = isAdmin || A.userData.permissions?.addChemical;

      return `<tr class="tbl-row" onclick="chemRowClick(event,'${c.id}')">
        <td><input type="checkbox" class="chem-cb" data-id="${c.id}" onchange="chemToggle('${c.id}',this.checked)" onclick="event.stopPropagation()"></td>
        <td class="fw-bold">${c.name}</td>
        <td class="font-mono dim-cell" style="font-size:11px">${c.casNo || '—'}</td>
        <td>${ghsBadges || '—'}</td>
        <td class="dim-cell">${c.amount || '—'} ${c.unit || ''}</td>
        <td class="dim-cell">${c.location || '—'}</td>
        <td ${expClass}>${c.expiryDate ? fmtDate(c.expiryDate, A.lang) : '—'}</td>
        <td class="dim-cell">${c.responsible || '—'}</td>
        <td class="row" style="gap:4px" onclick="event.stopPropagation()">
          ${canEdit ? `<button class="btn btn-secondary btn-xs" onclick="openEditChem('${c.id}')">✏</button>` : ''}
          ${isAdmin ? `<button class="btn btn-red btn-xs" onclick="deleteChem('${c.id}')">🗑</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  });
  A.unsubs.push(u);
};

window.openAddChem = () => {
  document.getElementById('cf_name').value = '';
  document.getElementById('cf_cas').value = '';
  document.getElementById('cf_amount').value = '';
  document.getElementById('cf_unit').value = 'mL';
  document.getElementById('cf_location').value = '';
  document.getElementById('cf_expiry').value = '';
  document.getElementById('cf_notes').value = '';
  document.getElementById('cf_chemId').value = '';
  document.querySelectorAll('.ghs-cb').forEach(cb => cb.checked = false);
  document.getElementById('chemModalTitle').textContent = A.lang === 'tr' ? 'Kimyasal Ekle' : 'Add Chemical';
  openOverlay('chemModal');
};

window.openEditChem = async (id) => {
  const snap = await getDoc(doc(db, 'chemicals', id));
  if (!snap.exists()) return;
  const c = snap.data();
  document.getElementById('cf_chemId').value = id;
  document.getElementById('cf_name').value = c.name || '';
  document.getElementById('cf_cas').value = c.casNo || '';
  document.getElementById('cf_amount').value = c.amount || '';
  document.getElementById('cf_unit').value = c.unit || 'mL';
  document.getElementById('cf_location').value = c.location || '';
  document.getElementById('cf_expiry').value = c.expiryDate || '';
  document.getElementById('cf_notes').value = c.notes || '';
  document.querySelectorAll('.ghs-cb').forEach(cb => {
    cb.checked = (c.ghsClasses || []).includes(cb.value);
  });
  document.getElementById('chemModalTitle').textContent = A.lang === 'tr' ? 'Kimyasal Düzenle' : 'Edit Chemical';
  openOverlay('chemModal');
};

window.saveChem = async () => {
  const name = document.getElementById('cf_name').value.trim();
  const cas = document.getElementById('cf_cas').value.trim();
  if (!name) { toast(window.t('required'), 'err'); return; }
  if (cas && !validateCAS(cas)) { toast('Geçersiz CAS formatı (örn: 64-17-5)', 'err'); return; }

  const ghsClasses = [...document.querySelectorAll('.ghs-cb:checked')].map(cb => cb.value);
  const id = document.getElementById('cf_chemId').value;

  const data = {
    name, casNo: cas,
    ghsClasses,
    amount: document.getElementById('cf_amount').value.trim(),
    unit: document.getElementById('cf_unit').value,
    location: document.getElementById('cf_location').value.trim(),
    expiryDate: document.getElementById('cf_expiry').value || null,
    notes: document.getElementById('cf_notes').value.trim(),
    responsible: A.userData.name,
    responsibleUid: A.user.uid,
    labId: A.userData.labId,
    updatedAt: Timestamp.now(),
  };

  try {
    if (id) {
      // Version tracking — save previous values before updating
      const prevSnap = await getDoc(doc(db, 'chemicals', id));
      const prevData = prevSnap.exists() ? prevSnap.data() : {};
      const changes = {};
      const trackFields = ['name','casNo','amount','unit','location','expiryDate','notes','responsible'];
      trackFields.forEach(f => {
        if (String(prevData[f] || '') !== String(data[f] || '')) {
          changes[f] = { old: prevData[f] || '', new: data[f] || '' };
        }
      });
      // GHS classes diff
      const oldGHS = (prevData.ghsClasses || []).sort().join(',');
      const newGHS = (data.ghsClasses || []).sort().join(',');
      if (oldGHS !== newGHS) {
        changes['ghsClasses'] = { old: oldGHS, new: newGHS };
      }

      if (Object.keys(changes).length > 0) {
        const existingVersions = prevData.versionHistory || [];
        data.versionHistory = [...existingVersions, {
          changes,
          changedBy: A.userData.name,
          changedByUid: A.user.uid,
          timestamp: Timestamp.now(),
        }];
      }

      await updateDoc(doc(db, 'chemicals', id), data);
      await auditLog('EDIT_CHEM', `Edited chemical: ${name}${Object.keys(changes).length > 0 ? ` (changed: ${Object.keys(changes).join(', ')})` : ''}`, A.user.uid, A.userData.name, A.userData.labId);
    } else {
      data.createdAt = Timestamp.now();
      data.versionHistory = [];
      await addDoc(collection(db, 'chemicals'), data);
      await auditLog('ADD_CHEM', `Added chemical: ${name}`, A.user.uid, A.userData.name, A.userData.labId);
    }
    closeOverlay('chemModal');
    toast(window.t('saved'), 'ok');
  } catch (e) { toast(window.t('saveErr') + ' ' + e.message, 'err'); }
};

window.deleteChem = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Kimyasal silinsin mi?' : 'Delete this chemical?')) return;
  const snap = await getDoc(doc(db, 'chemicals', id));
  await auditLog('DELETE', `Deleted chemical: ${snap.data()?.name}`, A.user.uid, A.userData.name, A.userData.labId);
  await deleteDoc(doc(db, 'chemicals', id));
  toast(window.t('deleted'), 'info');
};

window.chemRowClick = async (event, id) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;
  const snap = await getDoc(doc(db, 'chemicals', id));
  if (!snap.exists()) return;
  const c = snap.data();
  const ghsBadges = (c.ghsClasses || []).map(g => `<span class="badge" style="background:var(--surface3)">${g}</span>`).join(' ');
  document.getElementById('chemDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      ${[
        ['Kimyasal Adı / Name', c.name, 'fw-bold'],
        ['CAS No', c.casNo || '—', 'font-mono'],
        ['Miktar / Amount', `${c.amount || '—'} ${c.unit || ''}`],
        ['Konum / Location', c.location || '—'],
        ['Son Kullanma / Expiry', c.expiryDate ? fmtDate(c.expiryDate, A.lang) : '—'],
        ['Sorumlu / Responsible', c.responsible || '—'],
      ].map(([l, v, cls]) => `<div>
        <div class="fl">${l}</div>
        <div class="${cls || 'dim-cell'}" style="margin-top:4px;font-size:13px">${v}</div>
      </div>`).join('')}
      <div>
        <div class="fl">GHS</div>
        <div style="margin-top:6px">${ghsBadges || '—'}</div>
      </div>
      ${c.notes ? `<div style="grid-column:1/-1"><div class="fl">Notlar / Notes</div><div style="margin-top:4px;font-size:13px;color:var(--text2)">${c.notes}</div></div>` : ''}
    </div>
    <div style="margin-top:12px">
      <button class="btn btn-secondary btn-sm" onclick="showVersionHistory('chemicals','${id}')">📝 ${A.lang==='tr'?'Değişiklik Geçmişi':'Change History'}</button>
      ${(c.versionHistory||[]).length > 0 ? `<span class="dim-cell" style="font-size:11px;margin-left:8px">${(c.versionHistory||[]).length} ${A.lang==='tr'?'değişiklik':'changes'}</span>` : ''}
    </div>`;
  openOverlay('chemDetailModal');
};

window.chemExportAll = async () => {
  const snap = await getDocs(query(collection(db, 'chemicals'), orderBy('createdAt', 'desc')));
  let rows = snap.docs.map(d => d.data());
  if (A.userData.role !== 'admin') rows = rows.filter(r => r.labId === A.userData.labId);
  exportToExcel(rows.map(c => ({
    'Kimyasal Adı / Name': c.name,
    'CAS No': c.casNo || '',
    'GHS Sınıfları / GHS Classes': (c.ghsClasses || []).join(', '),
    'Miktar / Amount': c.amount || '',
    'Birim / Unit': c.unit || '',
    'Konum / Location': c.location || '',
    'Son Kullanma / Expiry': c.expiryDate || '',
    'Sorumlu / Responsible': c.responsible || '',
    'Notlar / Notes': c.notes || '',
  })), 'FEGLIMS_Chemicals');
};

window.chemBulkExport = async () => {
  const ids = [...selectedChems];
  const rows = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'chemicals', id));
    if (snap.exists()) {
      const c = snap.data();
      rows.push({
        'Kimyasal Adı / Name': c.name,
        'CAS No': c.casNo || '',
        'GHS': (c.ghsClasses || []).join(', '),
        'Miktar / Amount': `${c.amount || ''} ${c.unit || ''}`,
        'Konum / Location': c.location || '',
        'Son Kullanma / Expiry': c.expiryDate || '',
      });
    }
  }
  exportToExcel(rows, 'FEGLIMS_Chemicals_Selected');
};
