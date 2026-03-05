// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — protocols.js
//  Protocol Library: templates, ELN linking
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDateTime, isSystemOwner, hasPermission
} from './firebase.js';

const A = window.APP;

let protoTab = 'library', protoQuill = null;

const PROTO_CATEGORIES = {
  dna:     { icon: '🧬', tr: 'DNA İzolasyon', en: 'DNA Isolation' },
  pcr:     { icon: '🔬', tr: 'PCR',           en: 'PCR' },
  crossing:{ icon: '🪰', tr: 'Çaprazlama',    en: 'Crossing' },
  cloning: { icon: '🔗', tr: 'Klonlama',      en: 'Cloning' },
  staining:{ icon: '🎨', tr: 'Boyama',        en: 'Staining' },
  imaging: { icon: '📷', tr: 'Görüntüleme',   en: 'Imaging' },
  general: { icon: '📋', tr: 'Genel',         en: 'General' },
};

export function renderProtocols() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab ${protoTab==='library'?'active':''}" onclick="protoSetTab('library')">📚 ${A.lang==='tr'?'Kütüphane':'Library'}</div>
        <div class="tab ${protoTab==='mine'?'active':''}" onclick="protoSetTab('mine')">📝 ${A.lang==='tr'?'Benim Protokollerim':'My Protocols'}</div>
      </div>
      <div class="row" style="gap:8px">
        <div class="search-wrap" style="max-width:220px">
          <span class="search-icon">🔍</span>
          <input class="search-input" placeholder="${A.lang==='tr'?'Protokol ara...':'Search protocols...'}" id="protoSearch" oninput="loadProtocols()">
        </div>
        <select class="fc" id="protoCatFilter" style="width:150px" onchange="loadProtocols()">
          <option value="">${A.lang==='tr'?'Tüm Kategoriler':'All Categories'}</option>
          ${Object.entries(PROTO_CATEGORIES).map(([k,v]) => `<option value="${k}">${v.icon} ${v[A.lang]}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="openAddProtocol()">＋ ${A.lang==='tr'?'Yeni Protokol':'New Protocol'}</button>
      </div>
    </div>
    <div id="protoWrap"></div>`;
  loadProtocols();
}

window.protoSetTab = (tab) => {
  protoTab = tab;
  renderProtocols();
};

function loadProtocols() {
  const search = document.getElementById('protoSearch')?.value?.toLowerCase() || '';
  const catFilter = document.getElementById('protoCatFilter')?.value || '';

  let q;
  if (protoTab === 'mine') {
    q = query(collection(db, 'protocols'), where('createdBy', '==', A.user.uid), orderBy('updatedAt', 'desc'));
  } else {
    q = query(collection(db, 'protocols'), where('labId', '==', A.userData.labId), orderBy('updatedAt', 'desc'));
  }

  const unsub = onSnapshot(q, snap => {
    let protocols = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (search) protocols = protocols.filter(p =>
      (p.title||'').toLowerCase().includes(search) || (p.category||'').toLowerCase().includes(search));
    if (catFilter) protocols = protocols.filter(p => p.category === catFilter);
    renderProtocolList(protocols);
  });
  A.unsubs.push(unsub);
}

function renderProtocolList(protocols) {
  const wrap = document.getElementById('protoWrap');
  if (!wrap) return;
  if (protocols.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">${A.lang==='tr'?'Henüz protokol yok.':'No protocols yet.'}</div></div>`;
    return;
  }
  wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
    ${protocols.map(p => {
      const cat = PROTO_CATEGORIES[p.category] || PROTO_CATEGORIES.general;
      const elnCount = p.linkedEln?.length || 0;
      return `<div class="card" style="cursor:pointer" onclick="openProtocolDetail('${p.id}')">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;color:var(--text3)">${cat.icon} ${cat[A.lang]}</div>
            <div style="font-size:15px;font-weight:600;margin-top:4px">${p.title}</div>
          </div>
          <div style="font-size:11px;color:var(--text3)">${p.version ? 'v'+p.version : 'v1'}</div>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${p.summary || ''}</div>
        <div class="row" style="margin-top:12px;gap:8px;font-size:11px;color:var(--text3)">
          <span>👤 ${p.createdByName || '—'}</span>
          ${elnCount ? `<span>📓 ${elnCount} ELN</span>` : ''}
          <span>${fmtDateTime(p.updatedAt, A.lang)}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

window.openAddProtocol = () => {
  document.getElementById('proto_id').value = '';
  document.getElementById('proto_title').value = '';
  document.getElementById('proto_category').value = 'general';
  document.getElementById('proto_summary').value = '';
  // Init Quill
  const editorEl = document.getElementById('protoEditorWrap');
  editorEl.innerHTML = '<div id="protoQuillEditor" style="min-height:200px"></div>';
  protoQuill = new Quill('#protoQuillEditor', {
    theme: 'snow',
    modules: { toolbar: [['bold','italic','underline'],['link','image'],[{list:'ordered'},{list:'bullet'}],['clean']] }
  });
  openOverlay('protocolModal');
};

window.saveProtocol = async () => {
  const title = document.getElementById('proto_title').value.trim();
  const category = document.getElementById('proto_category').value;
  const summary = document.getElementById('proto_summary').value.trim();
  if (!title) { toast(window.t('required'), 'err'); return; }
  const content = protoQuill ? protoQuill.root.innerHTML : '';
  const id = document.getElementById('proto_id').value;

  const data = {
    title, category, summary, content,
    updatedAt: Timestamp.now(),
    labId: A.userData.labId,
  };

  try {
    if (id) {
      const existing = await getDoc(doc(db, 'protocols', id));
      const oldVersion = existing.exists() ? (existing.data().version || 1) : 1;
      data.version = oldVersion + 1;
      data.versionHistory = [...(existing.data().versionHistory || []), {
        version: oldVersion, content: existing.data().content, updatedAt: existing.data().updatedAt, updatedBy: existing.data().updatedByName || ''
      }];
      data.updatedByName = A.userData.name;
      await updateDoc(doc(db, 'protocols', id), data);
    } else {
      data.createdAt = Timestamp.now();
      data.createdBy = A.user.uid;
      data.createdByName = A.userData.name;
      data.updatedByName = A.userData.name;
      data.version = 1;
      data.versionHistory = [];
      data.linkedEln = [];
      await addDoc(collection(db, 'protocols'), data);
      await auditLog('ADD_PROTOCOL', `Added protocol: ${title}`, A.user.uid, A.userData.name, A.userData.labId);
    }
    closeOverlay('protocolModal');
    toast(window.t('saved'), 'ok');
  } catch (e) { toast(window.t('saveErr') + ' ' + e.message, 'err'); }
};

window.openProtocolDetail = async (id) => {
  const snap = await getDoc(doc(db, 'protocols', id));
  if (!snap.exists()) return;
  const p = snap.data();
  const cat = PROTO_CATEGORIES[p.category] || PROTO_CATEGORIES.general;
  const canEdit = p.createdBy === A.user.uid || isSystemOwner(A.userData.email) || A.userData.role === 'admin';
  const elnCount = p.linkedEln?.length || 0;

  document.getElementById('protoDetailBody').innerHTML = `
    <div class="row" style="gap:12px;align-items:center;margin-bottom:16px">
      <div style="font-size:28px">${cat.icon}</div>
      <div>
        <div style="font-size:16px;font-weight:700">${p.title}</div>
        <div style="font-size:12px;color:var(--text3)">${cat[A.lang]} · v${p.version || 1} · ${p.createdByName || '—'}</div>
      </div>
    </div>
    ${p.summary ? `<div style="font-size:13px;color:var(--text2);margin-bottom:16px;padding:10px;background:var(--bg2);border-radius:8px">${p.summary}</div>` : ''}
    <div style="font-size:13px;line-height:1.6" class="ql-editor">${p.content || ''}</div>
    ${elnCount ? `<div style="margin-top:16px"><div class="fl">${A.lang==='tr'?'Bağlı ELN Kayıtları':'Linked ELN Entries'} (${elnCount})</div>
      ${p.linkedEln.map(e => `<div class="log-entry" style="margin-top:4px"><div class="log-body"><div class="log-action">${e.title || e.id}</div></div></div>`).join('')}
    </div>` : ''}
    ${canEdit ? `<div class="row" style="gap:8px;margin-top:20px">
      <button class="btn btn-secondary btn-sm" onclick="editProtocol('${id}')">✏ ${A.lang==='tr'?'Düzenle':'Edit'}</button>
      <button class="btn btn-secondary btn-sm" onclick="linkProtocolToEln('${id}')">📓 ${A.lang==='tr'?'ELN\'e Bağla':'Link to ELN'}</button>
      <button class="btn btn-red btn-sm" onclick="deleteProtocol('${id}')">🗑 ${A.lang==='tr'?'Sil':'Delete'}</button>
    </div>` : `<div style="margin-top:16px"><button class="btn btn-secondary btn-sm" onclick="linkProtocolToEln('${id}')">📓 ${A.lang==='tr'?'ELN\'e Bağla':'Link to ELN'}</button></div>`}`;
  openOverlay('protoDetailModal');
};

window.editProtocol = async (id) => {
  closeOverlay('protoDetailModal');
  const snap = await getDoc(doc(db, 'protocols', id));
  if (!snap.exists()) return;
  const p = snap.data();
  document.getElementById('proto_id').value = id;
  document.getElementById('proto_title').value = p.title;
  document.getElementById('proto_category').value = p.category;
  document.getElementById('proto_summary').value = p.summary || '';
  const editorEl = document.getElementById('protoEditorWrap');
  editorEl.innerHTML = '<div id="protoQuillEditor" style="min-height:200px"></div>';
  protoQuill = new Quill('#protoQuillEditor', {
    theme: 'snow',
    modules: { toolbar: [['bold','italic','underline'],['link','image'],[{list:'ordered'},{list:'bullet'}],['clean']] }
  });
  protoQuill.root.innerHTML = p.content || '';
  openOverlay('protocolModal');
};

window.deleteProtocol = async (id) => {
  if (!confirm(A.lang==='tr'?'Protokol silinsin mi?':'Delete this protocol?')) return;
  await deleteDoc(doc(db, 'protocols', id));
  await auditLog('DELETE_PROTOCOL', `Deleted protocol ${id}`, A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('protoDetailModal');
  toast(window.t('deleted'), 'info');
};

window.linkProtocolToEln = async (protoId) => {
  // Load ELN entries for selection
  const snap = await getDocs(query(collection(db, 'eln'), where('authorUid', '==', A.user.uid), orderBy('updatedAt', 'desc')));
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (entries.length === 0) { toast(A.lang==='tr'?'ELN kaydınız yok':'No ELN entries found', 'warn'); return; }

  const sel = prompt(A.lang==='tr'
    ? `Bağlanacak ELN kaydını seçin:\n${entries.map((e,i) => `${i+1}. ${e.title}`).join('\n')}\n\nNumara girin:`
    : `Select ELN entry to link:\n${entries.map((e,i) => `${i+1}. ${e.title}`).join('\n')}\n\nEnter number:`);
  const idx = parseInt(sel) - 1;
  if (isNaN(idx) || idx < 0 || idx >= entries.length) return;

  const elnEntry = entries[idx];
  const protoSnap = await getDoc(doc(db, 'protocols', protoId));
  if (!protoSnap.exists()) return;
  const linked = protoSnap.data().linkedEln || [];
  if (linked.some(l => l.id === elnEntry.id)) { toast(A.lang==='tr'?'Zaten bağlı':'Already linked', 'warn'); return; }

  linked.push({ id: elnEntry.id, title: elnEntry.title });
  await updateDoc(doc(db, 'protocols', protoId), { linkedEln: linked });

  // Also add protocol reference to ELN entry
  const elnLinked = elnEntry.linkedProtocols || [];
  elnLinked.push({ id: protoId, title: protoSnap.data().title });
  await updateDoc(doc(db, 'eln', elnEntry.id), { linkedProtocols: elnLinked });

  toast(A.lang==='tr'?'ELN kaydına bağlandı':'Linked to ELN entry', 'ok');
  closeOverlay('protoDetailModal');
};

export { PROTO_CATEGORIES };
