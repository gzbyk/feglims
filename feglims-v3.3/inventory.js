// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — inventory.js
//  Stock sharing + module-based permissions
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  sendEmail, auditLog, addDays, fmtDate, todayISO,
  capitalize, exportToExcel, hasPermission
} from './firebase.js';

const A = window.APP;
let stockTab = 'all';
let selectedStocks = new Set();
let sortField = 'createdAt';
let sortDir = 'desc';
let searchTerm = '';

export function renderInventory() {
  const content = document.getElementById('content');
  const canEdit = hasPermission(A.userData, 'inventory.edit');
  const canDelete = hasPermission(A.userData, 'inventory.delete');
  const canBulk = hasPermission(A.userData, 'inventory.bulk');
  const canExport = hasPermission(A.userData, 'inventory.export');
  const canShare = hasPermission(A.userData, 'inventory.share');
  const canChangeStatus = hasPermission(A.userData, 'inventory.changeStatus');

  const lineageTabs = (A.sysConfig.lineages || [
    'Wild-type','Isogenic','Balancer','Genome Editing','Disease Model','Transposon','RNAi','GAL4'
  ]);

  const tabsHtml = [
    { k: 'all',    l: A.lang==='tr'?'Tüm Stoklar':'All Stocks' },
    { k: 'mine',   l: A.lang==='tr'?'Benim Stoklarım':'My Stocks' },
    { k: 'shared', l: A.lang==='tr'?'Paylaşılan Stoklar':'Shared Stocks', cls: 't-shared' },
    { k: 'weak',   l: '⚠ '+(A.lang==='tr'?'Zayıf':'Weak'), cls: 't-amber' },
    { k: 'lost',   l: '❌ '+(A.lang==='tr'?'Kaybedildi':'Lost'), cls: 't-red' },
    ...lineageTabs.map(l => ({ k: l, l }))
  ].map(tb => `
    <div class="tab ${tb.cls||''} ${tb.k===stockTab?'active':''}"
         onclick="setStockTab('${tb.k}')">${tb.l}</div>
  `).join('');

  content.innerHTML = `
    <div class="bulk-bar" id="bulkBar">
      <span class="bulk-count" id="bulkCount">0 seçili</span>
      ${canChangeStatus?`<button class="btn btn-secondary btn-sm" onclick="bulkStatusChange()">⟳ ${A.lang==='tr'?'Durum Değiştir':'Change Status'}</button>`:''}
      ${canEdit?`<button class="btn btn-secondary btn-sm" onclick="bulkChangeOwner()">👤 ${A.lang==='tr'?'Sahip Değiştir':'Change Owner'}</button>`:''}
      ${canDelete?`<button class="btn btn-secondary btn-sm" onclick="bulkDelete()">🗑 ${A.lang==='tr'?'Sil':'Delete'}</button>`:''}
      ${canExport?`<button class="btn btn-secondary btn-sm" onclick="bulkExport()">📊 Excel</button>`:''}
      ${canShare?`<button class="btn btn-secondary btn-sm" onclick="bulkToggleShare()">🔗 ${A.lang==='tr'?'Paylaş':'Share'}</button>`:''}
      <button class="btn btn-ghost btn-sm" onclick="clearSelection()">✕</button>
    </div>
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0;flex:1">${tabsHtml}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <div class="search-wrap" style="max-width:200px">
          <span class="search-icon">🔍</span>
          <input class="search-input" placeholder="${A.lang==='tr'?'Ara...':'Search...'}"
                 id="stockSearch" oninput="stockSearchChange(this.value)">
        </div>
        <select class="fc btn-sm" id="stockFilterStatus" style="width:110px" onchange="stockSearchChange(document.getElementById('stockSearch')?.value||'')">
          <option value="">${A.lang==='tr'?'Tüm Durum':'All Status'}</option>
          <option value="Active">${A.lang==='tr'?'Aktif':'Active'}</option>
          <option value="Weak">${A.lang==='tr'?'Zayıf':'Weak'}</option>
          <option value="Lost">${A.lang==='tr'?'Kayıp':'Lost'}</option>
        </select>
        <select class="fc btn-sm" id="stockFilterCenter" style="width:110px" onchange="stockSearchChange(document.getElementById('stockSearch')?.value||'')">
          <option value="">${A.lang==='tr'?'Tüm Merkez':'All Centers'}</option>
          <option>BDSC</option><option>VDRC</option><option>KYOTO</option><option>DGRC</option><option>Lab Stock</option>
        </select>
        <select class="fc btn-sm" id="stockFilterClimate" style="width:80px" onchange="stockSearchChange(document.getElementById('stockSearch')?.value||'')">
          <option value="">${A.lang==='tr'?'°C':'°C'}</option>
          <option value="18">18°C</option><option value="25">25°C</option>
        </select>
        <button class="btn btn-ghost btn-xs" onclick="clearAdvFilters()" title="Filtreleri Temizle">✕</button>
        <button class="btn btn-secondary btn-xs" onclick="saveCurrentStockSearch()" title="${A.lang==='tr'?'Aramayı Kaydet':'Save Search'}">📌</button>
        ${window.renderSavedSearchesDropdown ? window.renderSavedSearchesDropdown('inventory') : ''}
      </div>
    </div>
    <div id="stocksWrap"></div>
  `;

  loadStocks();
}

export function setStockTab(k) {
  stockTab = k;
  selectedStocks.clear();
  renderInventory();
}
window.setStockTab = setStockTab;

window.stockSearchChange = (v) => {
  searchTerm = v.toLowerCase();
  loadStocks();
};

window.saveCurrentStockSearch = () => {
  const filters = {
    searchTerm: document.getElementById('stockSearch')?.value || '',
    status: document.getElementById('stockFilterStatus')?.value || '',
    center: document.getElementById('stockFilterCenter')?.value || '',
    climate: document.getElementById('stockFilterClimate')?.value || '',
    tab: stockTab,
  };
  window.openSaveSearch({ section: 'inventory', filters });
};

window.clearAdvFilters = () => {
  const el1 = document.getElementById('stockFilterStatus'); if (el1) el1.value = '';
  const el2 = document.getElementById('stockFilterCenter'); if (el2) el2.value = '';
  const el3 = document.getElementById('stockFilterClimate'); if (el3) el3.value = '';
  const el4 = document.getElementById('stockSearch'); if (el4) el4.value = '';
  searchTerm = '';
  loadStocks();
};

function loadStocks() {
  let q;
  if (stockTab === 'shared') {
    // Shared stocks: all stocks with shared=true from ANY lab
    q = query(collection(db, 'stocks'), where('shared', '==', true), orderBy('createdAt', 'desc'));
  } else {
    q = query(collection(db, 'stocks'), orderBy('createdAt', 'desc'));
  }

  const unsub = onSnapshot(q, snap => {
    let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (stockTab === 'shared') {
      // Group by lineage for shared view — no lab filter
    } else {
      // Lab filter (multi-tenant isolation)
      rows = rows.filter(r => r.labId === A.userData.labId);

      // Tab filter
      if (stockTab === 'mine')       rows = rows.filter(r => r.responsibleUid === A.user.uid);
      else if (stockTab === 'weak')  rows = rows.filter(r => r.status === 'Weak');
      else if (stockTab === 'lost')  rows = rows.filter(r => r.status === 'Lost');
      else if (!['all'].includes(stockTab)) rows = rows.filter(r => r.lineage === stockTab);
    }

    // Search + advanced filters
    if (searchTerm) rows = rows.filter(r =>
      (r.stockCode||'').toLowerCase().includes(searchTerm) ||
      (r.genotype||'').toLowerCase().includes(searchTerm) ||
      (r.responsible||'').toLowerCase().includes(searchTerm) ||
      (r.species||'').toLowerCase().includes(searchTerm) ||
      (r.labStockName||'').toLowerCase().includes(searchTerm) ||
      (r.labName||'').toLowerCase().includes(searchTerm)
    );
    const fStatus = document.getElementById('stockFilterStatus')?.value || '';
    const fCenter = document.getElementById('stockFilterCenter')?.value || '';
    const fClimate = document.getElementById('stockFilterClimate')?.value || '';
    if (fStatus) rows = rows.filter(r => r.status === fStatus);
    if (fCenter) rows = rows.filter(r => r.center === fCenter);
    if (fClimate) rows = rows.filter(r => String(r.climate) === fClimate);

    // Sort
    rows.sort((a, b) => {
      let av = a[sortField] || '', bv = b[sortField] || '';
      if (av?.toDate) av = av.toDate();
      if (bv?.toDate) bv = bv.toDate();
      return sortDir === 'asc'
        ? (av > bv ? 1 : -1)
        : (av < bv ? 1 : -1);
    });

    if (stockTab === 'shared') {
      renderSharedStockTable(rows);
    } else {
      renderStockTable(rows);
    }
  });
  A.unsubs.push(unsub);
}

function renderStockTable(rows) {
  const el = document.getElementById('stocksWrap');
  if (!el) return;
  const canEdit = hasPermission(A.userData, 'inventory.edit');
  const canChangeStatus = hasPermission(A.userData, 'inventory.changeStatus');

  if (rows.length === 0) {
    el.innerHTML = `<div class="tbl-wrap"><div class="empty-state">
      <div class="empty-icon">🧫</div>
      <div class="empty-text">${A.lang==='tr'?'Bu kategoride stok yok.':'No stocks in this category.'}</div>
    </div></div>`;
    return;
  }

  const cols = [
    { k: 'stockCode',      l: A.lang==='tr'?'Kod':'Code' },
    { k: 'species',        l: A.lang==='tr'?'Tür':'Species' },
    { k: 'lineage',        l: A.lang==='tr'?'Soy':'Lineage' },
    { k: 'genotype',       l: A.lang==='tr'?'Genotip':'Genotype' },
    { k: 'center',         l: A.lang==='tr'?'Merkez':'Center' },
    { k: 'climate',        l: '°C' },
    { k: 'stockDate',      l: A.lang==='tr'?'Stok Günü':'Stock Date' },
    { k: 'removalDate',    l: A.lang==='tr'?'Ergin Atımı':'Parent Removal' },
    { k: 'status',         l: A.lang==='tr'?'Durum':'Status' },
    { k: 'responsible',    l: A.lang==='tr'?'Sorumlu':'Responsible' },
    { k: 'shared',         l: '🔗' },
  ];

  const thead = `<tr>
    <th class="cb-cell"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"></th>
    ${cols.map(c => `
      <th class="${sortField===c.k?'sorted':''}" onclick="stockSort('${c.k}')">
        ${c.l} ${sortField===c.k?(sortDir==='asc'?'↑':'↓'):''}
      </th>`).join('')}
    <th></th>
  </tr>`;

  const today = todayISO();
  const tbody = rows.map(s => {
    const bc = s.status==='Active'?'b-active':s.status==='Weak'?'b-weak':'b-lost';
    const bl = s.status==='Active'?(A.lang==='tr'?'Aktif':'Active')
             : s.status==='Weak'?(A.lang==='tr'?'Zayıf':'Weak')
             :(A.lang==='tr'?'Kaybedildi':'Lost');
    const removalAlert = s.removalDate && s.removalDate <= today;
    const checked = selectedStocks.has(s.id) ? 'checked' : '';
    const sharedIcon = s.shared ? '🔗' : '';
    return `<tr data-stock-id="${s.id}" onclick="stockRowClick(event,'${s.id}')" style="cursor:pointer">
      <td class="cb-cell" onclick="event.stopPropagation()">
        <input type="checkbox" ${checked} onchange="toggleStockSelect('${s.id}',this.checked)">
      </td>
      <td class="accent-cell">${s.stockCode}</td>
      <td class="dim-cell" style="font-size:12px">${s.species||'D. melanogaster'}</td>
      <td class="dim-cell">${s.lineage||'—'}</td>
      <td class="truncate dim-cell" style="max-width:150px;font-size:12px" title="${s.genotype}">${s.genotype||'—'}</td>
      <td class="dim-cell">${s.center||'—'}</td>
      <td class="mono-cell" style="text-align:center">${s.climate||'—'}°C</td>
      <td class="mono-cell">${fmtDate(s.stockDate, A.lang)}</td>
      <td class="${removalAlert?'amber-cell':'mono-cell'}">${fmtDate(s.removalDate, A.lang)}</td>
      <td><span class="badge ${bc}">${bl}</span></td>
      <td class="dim-cell" style="font-size:12px">${s.responsible||'—'}</td>
      <td class="dim-cell" style="text-align:center">${sharedIcon}</td>
      <td class="row" style="gap:4px">
        ${canChangeStatus ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();openStatusModal('${s.id}','${s.status}')">⟳</button>` : ''}
        ${canEdit ? `<button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();openEditStock('${s.id}')">✏</button>` : ''}
        <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();addToListFromInventory('${s.id}')">＋📋</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="tbl-wrap" style="overflow-x:auto">
      <table>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

// Shared stocks view — grouped by lineage
function renderSharedStockTable(rows) {
  const el = document.getElementById('stocksWrap');
  if (!el) return;

  if (rows.length === 0) {
    el.innerHTML = `<div class="tbl-wrap"><div class="empty-state">
      <div class="empty-icon">🔗</div>
      <div class="empty-text">${A.lang==='tr'?'Paylaşılan stok yok.':'No shared stocks.'}</div>
    </div></div>`;
    return;
  }

  // Group by lineage
  const groups = {};
  rows.forEach(s => {
    const lineage = s.lineage || (A.lang==='tr'?'Diğer':'Other');
    if (!groups[lineage]) groups[lineage] = [];
    groups[lineage].push(s);
  });

  let html = `<div style="font-size:12px;color:var(--text3);margin-bottom:12px">${rows.length} ${A.lang==='tr'?'paylaşılan stok':'shared stocks'}</div>`;

  Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).forEach(([lineage, stocks]) => {
    html += `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="display:flex;align-items:center;gap:8px">
          <span class="badge b-open">${lineage}</span>
          <span class="dim-cell" style="font-size:11px">${stocks.length} ${A.lang==='tr'?'stok':'stocks'}</span>
        </div>
        <div class="tbl-wrap" style="overflow-x:auto">
          <table>
            <thead><tr>
              <th>${A.lang==='tr'?'Kod':'Code'}</th>
              <th>${A.lang==='tr'?'Tür':'Species'}</th>
              <th>${A.lang==='tr'?'Genotip':'Genotype'}</th>
              <th>${A.lang==='tr'?'Merkez':'Center'}</th>
              <th>°C</th>
              <th>${A.lang==='tr'?'Durum':'Status'}</th>
              <th>${A.lang==='tr'?'Lab':'Lab'}</th>
              <th>${A.lang==='tr'?'Sorumlu':'Responsible'}</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${stocks.map(s => {
                const bc = s.status==='Active'?'b-active':s.status==='Weak'?'b-weak':'b-lost';
                const isOwnLab = s.labId === A.userData.labId;
                return `<tr onclick="openStockDetail('${s.id}')" style="cursor:pointer">
                  <td class="accent-cell">${s.stockCode}</td>
                  <td class="dim-cell" style="font-size:12px">${s.species||'D. melanogaster'}</td>
                  <td class="truncate dim-cell" style="max-width:200px;font-size:12px" title="${s.genotype||''}">${s.genotype||'—'}</td>
                  <td class="dim-cell">${s.center||'—'}</td>
                  <td class="mono-cell">${s.climate||'—'}°C</td>
                  <td><span class="badge ${bc}">${s.status}</span></td>
                  <td class="dim-cell" style="font-size:12px">${s.labName||'—'}</td>
                  <td class="dim-cell" style="font-size:12px">${s.responsible||'—'}</td>
                  <td>
                    ${!isOwnLab ? `
                      <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation();requestTurkeyStock('${s.stockCode}','${s.responsibleEmail||''}','${s.responsible||''}','${s.labName||''}')">
                        📨 ${A.lang==='tr'?'Talep Et':'Request'}
                      </button>` : `<span class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Kendi labınız':'Your lab'}</span>`}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  });

  el.innerHTML = html;
}

window.stockSort = (field) => {
  if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortField = field; sortDir = 'asc'; }
  loadStocks();
};

// BULK OPERATIONS
window.toggleStockSelect = (id, checked) => {
  if (checked) selectedStocks.add(id);
  else selectedStocks.delete(id);
  updateBulkBar();
};

window.toggleSelectAll = (cb) => {
  document.querySelectorAll('tbody tr').forEach(tr => {
    const c = tr.querySelector('input[type="checkbox"]');
    const id = tr.dataset.stockId;
    if (c && id) {
      c.checked = cb.checked;
      if (cb.checked) selectedStocks.add(id);
      else selectedStocks.delete(id);
    }
  });
  updateBulkBar();
};

window.clearSelection = () => {
  selectedStocks.clear();
  document.querySelectorAll('tbody input[type="checkbox"]').forEach(c => c.checked = false);
  const sa = document.getElementById('selectAll');
  if (sa) sa.checked = false;
  updateBulkBar();
};

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  const cnt = document.getElementById('bulkCount');
  if (!bar) return;
  bar.classList.toggle('active', selectedStocks.size > 0);
  if (cnt) cnt.textContent = `${selectedStocks.size} ${A.lang==='tr'?'seçili':'selected'}`;
}

window.bulkStatusChange = () => {
  if (selectedStocks.size === 0) return;
  document.getElementById('bulkStatusIds').value = JSON.stringify([...selectedStocks]);
  openOverlay('bulkStatusModal');
};

window.saveBulkStatus = async () => {
  const ids = JSON.parse(document.getElementById('bulkStatusIds').value || '[]');
  const ns = document.getElementById('bulkNewStatus').value;
  const reason = document.getElementById('bulkStatusReason').value.trim();
  if (!reason) { toast(A.lang==='tr'?'Sebep zorunludur.':'Reason required.', 'err'); return; }

  for (const id of ids) {
    const ref = doc(db, 'stocks', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const existing = snap.data().statusHistory || [];
    await updateDoc(ref, {
      status: ns, updatedAt: Timestamp.now(),
      statusHistory: [...existing, {
        status: ns, changedBy: A.userData.name,
        changedAt: new Date().toISOString(), reason
      }]
    });

    // Notify admin if weak/lost
    if ((ns === 'Weak' || ns === 'Lost') && A.userData.role !== 'admin') {
      await addDoc(collection(db, 'notifications'), {
        type: 'STATUS_ALERT', stockId: id,
        stockCode: snap.data().stockCode, newStatus: ns,
        changedBy: A.userData.name, reason, labId: A.userData.labId,
        read: false, createdAt: Timestamp.now()
      });
    }
  }

  await auditLog('STATUS_CHANGE', `Bulk: ${ids.length} stocks → ${ns} — ${reason}`,
    A.user.uid, A.userData.name, A.userData.labId);

  clearSelection();
  closeOverlay('bulkStatusModal');
  toast(A.lang==='tr'?'Durum güncellendi.':'Status updated.', 'ok');
};

window.bulkChangeOwner = async () => {
  if (selectedStocks.size === 0) return;
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => d.data()).filter(u =>
    u.role !== 'pending' && u.labId === A.userData.labId
  );
  document.getElementById('bulkOwnerIds').value = JSON.stringify([...selectedStocks]);
  const sel = document.getElementById('bulkOwnerSelect');
  sel.innerHTML = users.map(u =>
    `<option value="${u.name}|${u.uid}|${u.email||''}">${u.name} (${t('r'+capitalize(u.role))})</option>`
  ).join('');
  openOverlay('bulkOwnerModal');
};

window.saveBulkOwner = async () => {
  const ids = JSON.parse(document.getElementById('bulkOwnerIds').value || '[]');
  const [name, uid, email] = document.getElementById('bulkOwnerSelect').value.split('|');
  for (const id of ids) {
    await updateDoc(doc(db, 'stocks', id), {
      responsible: name, responsibleUid: uid,
      responsibleEmail: email || '', updatedAt: Timestamp.now()
    });
  }
  await auditLog('OWNER_CHANGE', `Bulk: ${ids.length} stocks → ${name}`,
    A.user.uid, A.userData.name, A.userData.labId);
  clearSelection();
  closeOverlay('bulkOwnerModal');
  toast(A.lang==='tr'?'Sahip güncellendi.':'Owner updated.', 'ok');
};

window.bulkDelete = async () => {
  if (!confirm(`${selectedStocks.size} ${A.lang==='tr'?'stok silinsin mi?':'stocks will be deleted. Confirm?'}`)) return;
  for (const id of selectedStocks) {
    const snap = await getDoc(doc(db, 'stocks', id));
    await auditLog('DELETE', `Deleted stock ${snap.data()?.stockCode}`,
      A.user.uid, A.userData.name, A.userData.labId);
    await deleteDoc(doc(db, 'stocks', id));
  }
  clearSelection();
  toast(t('deleted'), 'ok');
};

window.bulkExport = async () => {
  const ids = [...selectedStocks];
  const rows = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'stocks', id));
    if (snap.exists()) {
      const d = snap.data();
      rows.push({
        'Stok Kodu / Stock Code': d.stockCode,
        'Tür / Species': d.species,
        'Soy / Lineage': d.lineage,
        'Genotip / Genotype': d.genotype,
        'Merkez / Center': d.center,
        'Sıcaklık / Temp (°C)': d.climate,
        'Stok Günü / Stock Date': d.stockDate,
        'Ergin Atımı / Removal': d.removalDate,
        'Durum / Status': d.status,
        'Sorumlu / Responsible': d.responsible,
        'Paylaşımlı / Shared': d.shared ? 'Yes' : 'No',
      });
    }
  }
  exportToExcel(rows, 'FEGLIMS_Stocks_Selected');
};

// BULK SHARE/UNSHARE TOGGLE
window.bulkToggleShare = async () => {
  if (selectedStocks.size === 0) return;
  // Check current state — toggle: if any are NOT shared, share all; if all shared, unshare all
  const ids = [...selectedStocks];
  let anyNotShared = false;
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'stocks', id));
    if (snap.exists() && !snap.data().shared) { anyNotShared = true; break; }
  }
  const newShared = anyNotShared;
  const action = newShared
    ? (A.lang==='tr'?'paylaşıma açılsın mı?':'share these stocks?')
    : (A.lang==='tr'?'paylaşımdan kaldırılsın mı?':'unshare these stocks?');
  if (!confirm(`${ids.length} ${A.lang==='tr'?'stok':'stocks'} ${action}`)) return;

  for (const id of ids) {
    await updateDoc(doc(db, 'stocks', id), { shared: newShared, updatedAt: Timestamp.now() });
  }
  await auditLog('SHARE_TOGGLE', `Bulk: ${ids.length} stocks → shared=${newShared}`,
    A.user.uid, A.userData.name, A.userData.labId);
  clearSelection();
  toast(newShared
    ? (A.lang==='tr'?'Stoklar paylaşıma açıldı.':'Stocks shared.')
    : (A.lang==='tr'?'Stoklar paylaşımdan kaldırıldı.':'Stocks unshared.'), 'ok');
};

// STOCK FORM
window.openNewStock = () => {
  document.getElementById('sf_sdate').value = todayISO();
  document.getElementById('sf_resp').value = A.userData.name;
  document.getElementById('sf_resp_uid').value = A.user.uid;
  document.getElementById('sf_flybaseHint').textContent = '';
  document.getElementById('customCenterWrap').style.display = 'none';
  // Default shared=true
  const sharedCb = document.getElementById('sf_shared');
  if (sharedCb) sharedCb.checked = true;
  loadResponsibleDropdown();
  calcStockDates();
  openOverlay('stockModal');
};
window.openModal = window.openNewStock;

async function loadResponsibleDropdown() {
  const canEdit = hasPermission(A.userData, 'inventory.edit');
  const wrap = document.getElementById('resp_dropdown_wrap');
  if (!wrap) return;
  if (!canEdit) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role !== 'pending' && u.labId === A.userData.labId);
  const sel = document.getElementById('sf_resp_select');
  if (!sel) return;
  sel.innerHTML = users.map(u =>
    `<option value="${u.name}|${u.uid}|${u.email||''}">${u.name}</option>`
  ).join('');
  sel.onchange = () => {
    const [name, uid] = sel.value.split('|');
    document.getElementById('sf_resp').value = name;
    document.getElementById('sf_resp_uid').value = uid;
  };
}

window.calcStockDates = () => {
  const d = document.getElementById('sf_sdate')?.value;
  const cl = document.getElementById('sf_climate')?.value || '25';
  if (!d) return;
  const rule = A.cycleRules.find(r => String(r.temp) === String(cl));
  const clearing = rule ? Number(rule.clearing) : 3;
  const transfer = rule ? Number(rule.transfer) : 17;
  const remEl = document.getElementById('sf_removal');
  const trEl  = document.getElementById('sf_transfer');
  if (remEl) remEl.value = fmtDate(addDays(d, clearing), A.lang);
  if (trEl)  trEl.value  = fmtDate(addDays(d, transfer), A.lang);
};

window.toggleCustomCenter = () => {
  const v = document.getElementById('sf_center').value;
  document.getElementById('customCenterWrap').style.display = v === 'Custom' ? 'block' : 'none';
};

window.toggleLabNameField = () => {
  const checked = document.getElementById('sf_labNameDiff')?.checked;
  document.getElementById('labNameDiffWrap').style.display = checked ? 'block' : 'none';
};

let flyDebounce = null;
window.tryFlyBase = () => {
  clearTimeout(flyDebounce);
  const code = document.getElementById('sf_code').value.trim();
  const center = document.getElementById('sf_center').value;
  const hint = document.getElementById('sf_flybaseHint');
  if (!code || isNaN(code) || center !== 'BDSC') { if (hint) hint.textContent = ''; return; }
  if (hint) hint.textContent = '🔍 FlyBase sorgulanıyor...';
  flyDebounce = setTimeout(async () => {
    try {
      const r = await fetch(`https://api.flybase.org/api/v1.0/gene/flystock/${code}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error();
      const j = await r.json();
      const gt = j?.resultset?.result?.[0]?.featureprop_data?.genotype || '';
      if (gt) {
        document.getElementById('sf_genotype').value = gt;
        if (hint) hint.textContent = '✅ FlyBase\'den genotip alındı';
      } else {
        if (hint) hint.textContent = 'ℹ️ FlyBase\'de bulunamadı — manuel girin';
      }
    } catch {
      if (hint) hint.textContent = 'ℹ️ FlyBase ulaşılamıyor — manuel girin';
    }
  }, 800);
};

window.saveStock = async () => {
  const code     = document.getElementById('sf_code').value.trim();
  const genotype = document.getElementById('sf_genotype').value.trim();
  const sdate    = document.getElementById('sf_sdate').value;
  if (!code || !genotype || !sdate) { toast(A.lang==='tr'?'Zorunlu alanları doldurun.':'Fill required fields.', 'err'); return; }

  const climate = document.getElementById('sf_climate').value;
  const rule    = A.cycleRules.find(r => String(r.temp) === String(climate));
  const clearing = rule ? Number(rule.clearing) : 3;
  const transfer = rule ? Number(rule.transfer) : 17;
  const center  = document.getElementById('sf_center').value;
  const centerVal = center === 'Custom'
    ? (document.getElementById('sf_customCenter').value.trim() || 'Custom')
    : center;

  const respName = document.getElementById('sf_resp').value.trim();
  const respUid  = document.getElementById('sf_resp_uid').value || A.user.uid;

  // Shared checkbox — default true
  const sharedCb = document.getElementById('sf_shared');
  const shared = sharedCb ? sharedCb.checked : true;

  const s = {
    stockCode: code, species: document.getElementById('sf_species').value,
    lineage: document.getElementById('sf_lineage').value,
    center: centerVal, climate,
    genotype, stockDate: sdate,
    removalDate: addDays(sdate, clearing),
    nextTransferDate: addDays(sdate, transfer),
    tubes: document.getElementById('sf_tubes').value || '1',
    status: document.getElementById('sf_status').value,
    responsible: respName, responsibleUid: respUid,
    responsibleEmail: '',
    notes: document.getElementById('sf_notes').value.trim(),
    cabinet: document.getElementById('sf_cabinet')?.value?.trim() || '',
    labStockName: document.getElementById('sf_labNameDiff')?.checked ? (document.getElementById('sf_labStockName')?.value?.trim() || '') : '',
    shared,
    labId: A.userData.labId,
    labName: A.userData.labName || '',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    statusHistory: [{
      status: document.getElementById('sf_status').value,
      changedBy: A.userData.name,
      changedAt: new Date().toISOString(),
      reason: 'Initial entry'
    }]
  };

  // Get responsible email
  if (respUid) {
    const usnap = await getDoc(doc(db, 'users', respUid));
    if (usnap.exists()) s.responsibleEmail = usnap.data().email || '';
  }

  try {
    await addDoc(collection(db, 'stocks'), s);
    await auditLog('ADD_STOCK', `Added ${s.stockCode} (${s.species})${shared?' [shared]':''}`,
      A.user.uid, A.userData.name, A.userData.labId);
    closeOverlay('stockModal');
    toast(t('saved'), 'ok');
  } catch (e) { toast(t('saveErr') + ' ' + e.message, 'err'); }
};

// STATUS CHANGE
window.openStatusModal = (id, currentStatus) => {
  document.getElementById('statusStockId').value = id;
  document.getElementById('newStatus').value = currentStatus;
  document.getElementById('statusReason').value = '';
  openOverlay('statusModal');
};

window.saveStatusChange = async () => {
  const id     = document.getElementById('statusStockId').value;
  const ns     = document.getElementById('newStatus').value;
  const reason = document.getElementById('statusReason').value.trim();
  if (!reason) { toast(A.lang==='tr'?'Sebep zorunludur.':'Reason required.', 'err'); return; }

  const ref  = doc(db, 'stocks', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const existing = snap.data().statusHistory || [];
  await updateDoc(ref, {
    status: ns, updatedAt: Timestamp.now(),
    statusHistory: [...existing, {
      status: ns, changedBy: A.userData.name,
      changedAt: new Date().toISOString(), reason
    }]
  });

  // Notification
  if ((ns === 'Weak' || ns === 'Lost') && A.userData.role !== 'admin') {
    await addDoc(collection(db, 'notifications'), {
      type: 'STATUS_ALERT', stockId: id,
      stockCode: snap.data().stockCode, newStatus: ns,
      changedBy: A.userData.name, reason, labId: A.userData.labId,
      read: false, createdAt: Timestamp.now()
    });
  }

  await auditLog('STATUS_CHANGE',
    `${snap.data().stockCode}: ${snap.data().status} → ${ns} — ${reason}`,
    A.user.uid, A.userData.name, A.userData.labId);

  closeOverlay('statusModal');
  toast(t('statusUpdated'), 'ok');
};

// EDIT STOCK
window.openEditStock = async (id) => {
  const snap = await getDoc(doc(db, 'stocks', id));
  if (!snap.exists()) return;
  const s = snap.data();
  document.getElementById('edit_stockId').value = id;
  document.getElementById('esf_code').value = s.stockCode;
  document.getElementById('esf_species').value = s.species;
  document.getElementById('esf_lineage').value = s.lineage;
  document.getElementById('esf_genotype').value = s.genotype;
  document.getElementById('esf_climate').value = s.climate;
  document.getElementById('esf_status').value = s.status;
  document.getElementById('esf_notes').value = s.notes || '';
  const sharedCb = document.getElementById('esf_shared');
  if (sharedCb) sharedCb.checked = s.shared !== false;
  await loadEditResponsible(id, s.responsibleUid);
  openOverlay('editStockModal');
};

async function loadEditResponsible(stockId, currentUid) {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.role !== 'pending');
  const sel = document.getElementById('esf_resp');
  sel.innerHTML = users.map(u =>
    `<option value="${u.uid}" ${u.uid === currentUid ? 'selected' : ''}>${u.name}</option>`
  ).join('');
}

window.saveEditStock = async () => {
  const id = document.getElementById('edit_stockId').value;
  const respUid = document.getElementById('esf_resp').value;
  const usnap = await getDoc(doc(db, 'users', respUid));
  const respName = usnap.exists() ? usnap.data().name : '';

  const prevSnap = await getDoc(doc(db, 'stocks', id));
  const prevData = prevSnap.exists() ? prevSnap.data() : {};

  const sharedCb = document.getElementById('esf_shared');
  const shared = sharedCb ? sharedCb.checked : prevData.shared !== false;

  const newData = {
    stockCode:  document.getElementById('esf_code').value.trim(),
    species:    document.getElementById('esf_species').value,
    lineage:    document.getElementById('esf_lineage').value,
    genotype:   document.getElementById('esf_genotype').value.trim(),
    climate:    document.getElementById('esf_climate').value,
    status:     document.getElementById('esf_status').value,
    notes:      document.getElementById('esf_notes').value.trim(),
    responsible: respName,
    responsibleUid: respUid,
    shared,
    updatedAt:  Timestamp.now(),
  };

  const changes = {};
  const trackFields = ['stockCode','species','lineage','genotype','climate','status','notes','responsible','shared'];
  trackFields.forEach(f => {
    if (String(prevData[f] || '') !== String(newData[f] || '')) {
      changes[f] = { old: prevData[f] || '', new: newData[f] || '' };
    }
  });

  if (Object.keys(changes).length > 0) {
    const existingVersions = prevData.versionHistory || [];
    newData.versionHistory = [...existingVersions, {
      changes,
      changedBy: A.userData.name,
      changedByUid: A.user.uid,
      timestamp: Timestamp.now(),
    }];
  }

  await updateDoc(doc(db, 'stocks', id), newData);

  await auditLog('EDIT_STOCK', `Edited stock ${newData.stockCode}${Object.keys(changes).length > 0 ? ` (changed: ${Object.keys(changes).join(', ')})` : ''}`,
    A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('editStockModal');
  toast(t('saved'), 'ok');
};

// STOCK DETAIL
window.stockRowClick = (event, id) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') return;
  openStockDetail(id);
};

window.openStockDetail = async (id) => {
  const snap = await getDoc(doc(db, 'stocks', id));
  if (!snap.exists()) return;
  const s = snap.data();
  const bc = s.status==='Active'?'b-active':s.status==='Weak'?'b-weak':'b-lost';
  const bl = s.status==='Active'?(A.lang==='tr'?'Aktif':'Active')
           : s.status==='Weak'?(A.lang==='tr'?'Zayıf':'Weak')
           :(A.lang==='tr'?'Kaybedildi':'Lost');

  const history = (s.statusHistory || []).reverse().map(h => `
    <div class="log-entry">
      <div class="log-icon" style="background:var(--surface2)">⟳</div>
      <div class="log-body">
        <div class="log-action"><span class="badge ${h.status==='Active'?'b-active':h.status==='Weak'?'b-weak':'b-lost'}">${h.status}</span></div>
        <div class="log-detail">${h.reason} — ${h.changedBy}</div>
      </div>
      <div class="log-time">${h.changedAt?.split('T')[0] || '—'}</div>
    </div>`).join('');

  document.getElementById('stockDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      ${[
        ['stockCode','Stok Kodu / Code', 'accent-cell'],
        ['species','Tür / Species'],
        ['lineage','Soy / Lineage'],
        ['center','Merkez / Center'],
        ['climate','Sıcaklık / Temp'],
        ['responsible','Sorumlu / Responsible'],
        ['stockDate','Stok Günü / Stock Date'],
        ['removalDate','Ergin Atımı / Removal'],
      ].map(([k,l,cls]) => `
        <div>
          <div class="fl">${l}</div>
          <div class="${cls||'dim-cell'}" style="margin-top:4px;font-size:13px">
            ${k==='climate'?`${s[k]||'—'}°C`:fmtDate(s[k], A.lang)||s[k]||'—'}
          </div>
        </div>`).join('')}
      <div class="span2">
        <div class="fl">Genotip / Genotype</div>
        <div class="font-mono" style="margin-top:4px;font-size:12px;word-break:break-all">${s.genotype||'—'}</div>
      </div>
      <div class="span2" style="display:flex;gap:16px;align-items:center">
        <div>
          <div class="fl">Durum / Status</div>
          <span class="badge ${bc}" style="margin-top:4px">${bl}</span>
        </div>
        <div>
          <div class="fl">${A.lang==='tr'?'Paylaşım':'Sharing'}</div>
          <span class="badge ${s.shared?'b-active':'b-pending'}" style="margin-top:4px">${s.shared?(A.lang==='tr'?'Paylaşımlı':'Shared'):(A.lang==='tr'?'Özel':'Private')}</span>
        </div>
      </div>
      ${s.notes?`<div class="span2"><div class="fl">Notlar / Notes</div><div style="margin-top:4px;font-size:13px;color:var(--text2)">${s.notes}</div></div>`:''}
    </div>
    <div class="row" style="gap:8px;margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" onclick="showVersionHistory('stocks','${id}')">📝 ${A.lang==='tr'?'Değişiklik Geçmişi':'Change History'}</button>
      ${(s.versionHistory||[]).length > 0 ? `<span class="dim-cell" style="font-size:11px">${(s.versionHistory||[]).length} ${A.lang==='tr'?'değişiklik':'changes'}</span>` : ''}
    </div>
    <div class="card-title">${A.lang==='tr'?'Durum Geçmişi':'Status History'}</div>
    <div class="tbl-wrap">${history || `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`}</div>`;

  openOverlay('stockDetailModal');
};

// ADD TO LIST
window.addToListFromInventory = async (stockId) => {
  const snap = await getDoc(doc(db, 'stocks', stockId));
  if (!snap.exists()) return;
  const listsSnap = await getDocs(query(collection(db, 'stockLists'),
    where('createdBy', '==', A.user.uid)));
  const lists = listsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (lists.length === 0) {
    toast(A.lang==='tr'?'Önce bir stok listesi oluşturun.':'Create a stock list first.', 'warn');
    return;
  }
  const sel = document.getElementById('addToListSelect');
  sel.innerHTML = lists.map(l => `<option value="${l.id}">${l.title}</option>`).join('');
  document.getElementById('addToListStockId').value = stockId;
  openOverlay('addToListModal');
};

window.confirmAddToList = async () => {
  const stockId = document.getElementById('addToListStockId').value;
  const listId  = document.getElementById('addToListSelect').value;
  const snap    = await getDoc(doc(db, 'stocks', stockId));
  if (!snap.exists()) return;
  await addToStockList(listId, { id: stockId, ...snap.data() });
  closeOverlay('addToListModal');
};
