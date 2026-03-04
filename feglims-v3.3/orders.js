// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — orders.js
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDate, fmtDateTime, todayISO
} from './firebase.js';

const A = window.APP;

export function renderOrders() {
  const content = document.getElementById('content');
  const isAdmin = A.userData.role === 'admin';
  const canOpen = isAdmin || A.userData.permissions?.openOrders;

  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab active" id="ord-tab-open" onclick="ordTab('open')">
          📋 ${A.lang==='tr'?'Açık Listeler':'Open Lists'}
        </div>
        <div class="tab" id="ord-tab-closed" onclick="ordTab('closed')">
          ✅ ${A.lang==='tr'?'Kapalı Listeler':'Closed Lists'}
        </div>
      </div>
      ${canOpen ? `<button class="btn btn-primary" onclick="openCreateOrder()">
        ＋ ${A.lang==='tr'?'Yeni Sipariş Listesi':'New Order List'}
      </button>` : ''}
    </div>
    <div id="ordersWrap"></div>`;

  loadOrders('open');
}

let ordCurrentTab = 'open';

window.ordTab = (t) => {
  ordCurrentTab = t;
  ['open','closed'].forEach(k => {
    document.getElementById(`ord-tab-${k}`)?.classList.toggle('active', k === t);
  });
  loadOrders(t);
};

function loadOrders(tab) {
  const status = tab === 'open' ? 'open' : 'closed';
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(q, snap => {
    let lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (A.userData.role !== 'admin') lists = lists.filter(l => l.labId === A.userData.labId);
    lists = lists.filter(l => l.status === status);

    const el = document.getElementById('ordersWrap');
    if (!el) return;
    if (lists.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${window.t('noData')}</div></div>`;
      return;
    }

    const isAdmin = A.userData.role === 'admin';
    const canOpen = isAdmin || A.userData.permissions?.openOrders;

    el.innerHTML = lists.map(list => {
      const itemCount = (list.items || []).length;
      const typeLabel = list.type === 'fly' ? '🪰 Fly Stock' : list.type === 'chemical' ? '🧪 Chemical' : '🔧 Equipment';
      return `<div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:700">${list.title}
              <span class="badge ${list.status==='open'?'b-active':'b-lost'}" style="margin-left:8px">
                ${list.status==='open'?(A.lang==='tr'?'Açık':'Open'):(A.lang==='tr'?'Kapalı':'Closed')}
              </span>
              <span class="badge" style="margin-left:4px;background:var(--surface3)">${typeLabel}</span>
            </div>
            <div class="dim-cell" style="font-size:11px;margin-top:3px">
              ${list.createdByName || '—'} · ${fmtDateTime(list.createdAt, A.lang)} · ${itemCount} ${A.lang==='tr'?'öğe':'items'}
            </div>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn btn-primary btn-sm" onclick="openAddOrderItem('${list.id}','${list.type}')">
              ＋ ${A.lang==='tr'?'Öğe Ekle':'Add Item'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="exportOrderList('${list.id}')">📊 Excel</button>
            ${canOpen && list.status==='open' ? `<button class="btn btn-secondary btn-sm" onclick="closeOrderList('${list.id}')">✅ ${A.lang==='tr'?'Kapat':'Close'}</button>` : ''}
            ${isAdmin ? `<button class="btn btn-red btn-sm" onclick="deleteOrderList('${list.id}')">🗑</button>` : ''}
          </div>
        </div>
        <div id="ord-items-${list.id}">
          ${renderOrderItems(list.items || [], list.id, list.status === 'open')}
        </div>
      </div>`;
    }).join('');
  });
  A.unsubs.push(unsub);
}

function renderOrderItems(items, listId, canEdit) {
  if (items.length === 0) {
    return `<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px">
      ${A.lang==='tr'?'Liste boş.':'List is empty.'}
    </div>`;
  }
  return `<div class="tbl-wrap"><table>
    <thead><tr>
      <th>${A.lang==='tr'?'Öğe':'Item'}</th>
      <th>${A.lang==='tr'?'Kaynak / Merkez':'Source / Center'}</th>
      <th>${A.lang==='tr'?'Miktar':'Qty'}</th>
      <th>${A.lang==='tr'?'Notlar':'Notes'}</th>
      <th>${A.lang==='tr'?'Ekleyen':'Added by'}</th>
      <th>${A.lang==='tr'?'Durum':'Status'}</th>
      ${canEdit ? '<th></th>' : ''}
    </tr></thead>
    <tbody>
      ${items.map((item, idx) => `<tr>
        <td class="fw-bold">${item.name}</td>
        <td class="dim-cell">${item.source || '—'}</td>
        <td class="dim-cell">${item.qty || '—'}</td>
        <td class="dim-cell" style="font-size:12px">${item.notes || '—'}</td>
        <td class="dim-cell">${item.addedBy || '—'}</td>
        <td><span class="badge ${item.status==='ordered'?'b-active':item.status==='received'?'b-open':'b-pending'}">
          ${item.status==='ordered'?(A.lang==='tr'?'Sipariş Verildi':'Ordered')
          :item.status==='received'?(A.lang==='tr'?'Teslim Alındı':'Received')
          :(A.lang==='tr'?'Bekliyor':'Pending')}
        </span></td>
        ${canEdit ? `<td class="row" style="gap:4px">
          <button class="btn btn-secondary btn-xs" onclick="cycleItemStatus('${listId}',${idx},'${item.status||'pending'}')">⟳</button>
          <button class="btn btn-red btn-xs" onclick="removeOrderItem('${listId}',${idx})">✕</button>
        </td>` : ''}
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

window.openCreateOrder = () => {
  document.getElementById('ofc_title').value = '';
  document.getElementById('ofc_type').value = 'fly';
  document.getElementById('ofc_notes').value = '';
  openOverlay('createOrderModal');
};

window.createOrder = async () => {
  const title = document.getElementById('ofc_title').value.trim();
  if (!title) { toast(window.t('required'), 'err'); return; }
  const type = document.getElementById('ofc_type').value;
  await addDoc(collection(db, 'orders'), {
    title, type,
    notes: document.getElementById('ofc_notes').value.trim(),
    status: 'open',
    items: [],
    labId: A.userData.labId,
    createdBy: A.user.uid,
    createdByName: A.userData.name,
    createdAt: Timestamp.now(),
  });
  await auditLog('CREATE_ORDER', `Created order list: ${title}`, A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('createOrderModal');
  toast(window.t('saved'), 'ok');
};

window.openAddOrderItem = (listId, type) => {
  document.getElementById('ofi_listId').value = listId;
  document.getElementById('ofi_name').value = '';
  document.getElementById('ofi_source').value = '';
  document.getElementById('ofi_qty').value = '';
  document.getElementById('ofi_notes').value = '';
  const label = type === 'fly' ? 'Stok Kodu / Stock Code' : type === 'chemical' ? 'Kimyasal Adı / Chemical Name' : 'Ürün Adı / Product Name';
  document.getElementById('ofi_name_label').textContent = label;
  openOverlay('addOrderItemModal');
};

window.addOrderItem = async () => {
  const listId = document.getElementById('ofi_listId').value;
  const name = document.getElementById('ofi_name').value.trim();
  if (!name) { toast(window.t('required'), 'err'); return; }

  const ref = doc(db, 'orders', listId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = snap.data().items || [];
  items.push({
    name,
    source: document.getElementById('ofi_source').value.trim(),
    qty: document.getElementById('ofi_qty').value.trim(),
    notes: document.getElementById('ofi_notes').value.trim(),
    addedBy: A.userData.name,
    addedAt: new Date().toISOString(),
    status: 'pending',
  });
  await updateDoc(ref, { items });
  closeOverlay('addOrderItemModal');
  toast(window.t('saved'), 'ok');
};

window.cycleItemStatus = async (listId, idx, current) => {
  const cycle = { pending: 'ordered', ordered: 'received', received: 'pending' };
  const next = cycle[current] || 'pending';
  const ref = doc(db, 'orders', listId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = snap.data().items || [];
  items[idx] = { ...items[idx], status: next };
  await updateDoc(ref, { items });
};

window.removeOrderItem = async (listId, idx) => {
  const ref = doc(db, 'orders', listId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const items = snap.data().items || [];
  items.splice(idx, 1);
  await updateDoc(ref, { items });
};

window.closeOrderList = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Liste kapatılsın mı?' : 'Close this order list?')) return;
  await updateDoc(doc(db, 'orders', id), { status: 'closed', closedAt: Timestamp.now() });
  await auditLog('CLOSE_ORDER', `Closed order list ${id}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(window.t('saved'), 'ok');
};

window.deleteOrderList = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Liste silinsin mi?' : 'Delete this list?')) return;
  await deleteDoc(doc(db, 'orders', id));
  await auditLog('DELETE', `Deleted order list ${id}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(window.t('deleted'), 'info');
};

window.exportOrderList = async (id) => {
  const snap = await getDoc(doc(db, 'orders', id));
  if (!snap.exists()) return;
  const list = snap.data();
  const rows = (list.items || []).map(item => ({
    'Liste / List': list.title,
    'Öğe / Item': item.name,
    'Kaynak / Source': item.source || '',
    'Miktar / Qty': item.qty || '',
    'Notlar / Notes': item.notes || '',
    'Ekleyen / Added by': item.addedBy || '',
    'Durum / Status': item.status || '',
  }));
  exportToExcel(rows, `FEGLIMS_Order_${list.title}`);
};
