// ═══════════════════════════════════════════
//  FEGLIMS v3.1 — eln.js
//  Quill.js rich editor, templates, version history
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDateTime, arrayUnion
} from './firebase.js';

const A = window.APP;
let elnQuill = null;

export function renderEln() {
  const content = document.getElementById('content');
  const isAdmin = A.userData.role === 'admin';
  const isPI = A.userData.role === 'pi';
  const canViewAll = isAdmin || isPI || A.userData.permissions?.viewAllELN;

  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab active" id="eln-tab-mine" onclick="elnTab('mine')">
          📓 ${A.lang==='tr'?'Defterim':'My Notebook'}
        </div>
        ${canViewAll ? `<div class="tab" id="eln-tab-all" onclick="elnTab('all')">
          📚 ${A.lang==='tr'?'Tüm Kayıtlar':'All Records'}
        </div>` : ''}
      </div>
      <div class="row" style="gap:8px">
        <div class="search-wrap" style="max-width:220px">
          <span class="search-icon">🔍</span>
          <input class="search-input" placeholder="Ara..." id="elnSearch" oninput="loadEln()">
        </div>
        <button class="btn btn-primary" onclick="openAddEln()">
          ＋ ${A.lang==='tr'?'Yeni Kayıt':'New Entry'}
        </button>
        <button class="btn btn-secondary" onclick="elnExport()">📊 Excel</button>
      </div>
    </div>
    <div id="elnWrap"></div>`;

  loadEln('mine');
}

let elnCurrentTab = 'mine';

window.elnTab = (t) => {
  elnCurrentTab = t;
  ['mine','all'].forEach(k => {
    document.getElementById(`eln-tab-${k}`)?.classList.toggle('active', k === t);
  });
  loadEln(t);
};

window.loadEln = (tab) => {
  tab = tab || elnCurrentTab;
  const search = document.getElementById('elnSearch')?.value?.toLowerCase() || '';
  const canViewAll = A.userData.role === 'admin' || A.userData.role === 'pi' || A.userData.permissions?.viewAllELN;

  let q;
  if (tab === 'mine' || !canViewAll) {
    q = query(collection(db, 'eln'), where('authorUid', '==', A.user.uid), orderBy('createdAt', 'desc'));
  } else {
    q = query(collection(db, 'eln'), where('labId', '==', A.userData.labId), orderBy('createdAt', 'desc'));
  }

  const unsub = onSnapshot(q, snap => {
    let entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (search) {
      entries = entries.filter(e =>
        (e.title || '').toLowerCase().includes(search) ||
        (e.content || '').toLowerCase().includes(search) ||
        (e.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }

    const el = document.getElementById('elnWrap');
    if (!el) return;
    if (entries.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📓</div><div class="empty-text">${window.t('noData')}</div></div>`;
      return;
    }

    el.innerHTML = entries.map(e => {
      const tags = (e.tags || []).map(t => `<span class="badge" style="background:var(--surface3);font-size:10px">${t}</span>`).join(' ');
      const preview = (e.content || '').replace(/<[^>]+>/g, '').slice(0, 180);
      const isOwner = e.authorUid === A.user.uid;
      const isAdmin = A.userData.role === 'admin';
      const vCount = (e.versions || []).length;

      return `<div class="card eln-card" style="margin-bottom:12px" onclick="openElnDetail('${e.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div class="fw-bold" style="font-size:15px">${e.title || (A.lang==='tr'?'Başlıksız':'Untitled')}</div>
            <div class="dim-cell" style="font-size:11px;margin-top:3px">
              ${e.authorName || '—'} · ${fmtDateTime(e.createdAt, A.lang)}
              ${e.linkedStock ? ` · 🔬 ${e.linkedStock}` : ''}
              ${vCount > 0 ? ` · 📝 ${vCount} ${A.lang==='tr'?'revizyon':'rev.'}` : ''}
            </div>
          </div>
          <div class="row" style="gap:4px" onclick="event.stopPropagation()">
            ${isOwner || isAdmin ? `<button class="btn btn-secondary btn-xs" onclick="openEditEln('${e.id}')">✏</button>` : ''}
            ${isAdmin ? `<button class="btn btn-red btn-xs" onclick="deleteEln('${e.id}')">🗑</button>` : ''}
          </div>
        </div>
        <div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:10px">${preview}${preview.length >= 180 ? '...' : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${tags}</div>
      </div>`;
    }).join('');
  });
  A.unsubs.push(unsub);
};

function initQuillEditor(content) {
  const editorEl = document.getElementById('elnQuillEditor');
  if (!editorEl) return;
  editorEl.innerHTML = '';
  if (elnQuill) { try { elnQuill = null; } catch {} }
  
  elnQuill = new Quill('#elnQuillEditor', {
    theme: 'snow',
    placeholder: A.lang === 'tr' ? 'Deney notları, gözlemler, prosedürler...' : 'Experiment notes, observations, procedures...',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean']
      ]
    }
  });
  if (content) {
    if (content.startsWith('<')) {
      elnQuill.root.innerHTML = content;
    } else {
      elnQuill.setText(content);
    }
  }
}

// Templates
const ELN_TEMPLATES = {
  experiment: `<h2>Deney Protokolü</h2>
<p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
<p><strong>Amaç:</strong> </p>
<h3>Materyaller</h3>
<ul><li></li></ul>
<h3>Yöntem</h3>
<ol><li></li></ol>
<h3>Sonuçlar</h3>
<p></p>
<h3>Tartışma</h3>
<p></p>`,
  observation: `<h2>Gözlem Notu</h2>
<p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
<p><strong>Stok:</strong> </p>
<p><strong>Gözlem:</strong> </p>
<p><strong>Fenotip:</strong> </p>
<p><strong>Notlar:</strong> </p>`,
  crossing: `<h2>Çaprazlama Kaydı</h2>
<p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
<p><strong>♀ Dişi Genotip:</strong> </p>
<p><strong>♂ Erkek Genotip:</strong> </p>
<p><strong>Beklenen F1:</strong> </p>
<h3>Sonuçlar</h3>
<p></p>`,
  crispr: `<h2>CRISPR/Cas9 Deneyi</h2>
<p><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>
<p><strong>Hedef Gen:</strong> </p>
<p><strong>gRNA Dizisi:</strong> </p>
<p><strong>PAM Bölgesi:</strong> </p>
<h3>Enjeksiyon Parametreleri</h3>
<ul><li>Konsantrasyon: </li><li>Enjekte edilen embriyo sayısı: </li></ul>
<h3>Sonuçlar</h3>
<p></p>`
};

window.applyElnTemplate = () => {
  const sel = document.getElementById('elnTemplateSelect');
  const tpl = sel?.value;
  if (!tpl || !ELN_TEMPLATES[tpl]) return;
  if (elnQuill) {
    if (elnQuill.getText().trim().length > 1) {
      if (!confirm(A.lang === 'tr' ? 'Mevcut içerik silinecek. Devam?' : 'Content will be replaced. Continue?')) {
        sel.value = ''; return;
      }
    }
    elnQuill.root.innerHTML = ELN_TEMPLATES[tpl];
  }
  sel.value = '';
};

async function loadStockDatalist() {
  const snap = await getDocs(collection(db, 'stocks'));
  let stocks = snap.docs.map(d => d.data());
  if (A.userData.role !== 'admin') stocks = stocks.filter(s => s.labId === A.userData.labId);
  const dl = document.getElementById('elnStockList');
  if (dl) {
    dl.innerHTML = stocks.map(s =>
      `<option value="${s.stockCode}">${s.lineage || ''} - ${s.genotype ? s.genotype.substring(0,30) : ''}</option>`
    ).join('');
  }
}

window.openAddEln = () => {
  document.getElementById('ef_elnId').value = '';
  document.getElementById('ef_title').value = '';
  document.getElementById('ef_tags').value = '';
  document.getElementById('ef_linkedStock').value = '';
  document.getElementById('ef_linkedTask').value = '';
  document.getElementById('elnModalTitle').textContent = A.lang === 'tr' ? 'Yeni Kayıt' : 'New Entry';
  loadStockDatalist();
  openOverlay('elnModal');
  setTimeout(() => initQuillEditor(''), 100);
};

window.openEditEln = async (id) => {
  const snap = await getDoc(doc(db, 'eln', id));
  if (!snap.exists()) return;
  const e = snap.data();
  document.getElementById('ef_elnId').value = id;
  document.getElementById('ef_title').value = e.title || '';
  document.getElementById('ef_tags').value = (e.tags || []).join(', ');
  document.getElementById('ef_linkedStock').value = e.linkedStock || '';
  document.getElementById('ef_linkedTask').value = e.linkedTask || '';
  document.getElementById('elnModalTitle').textContent = A.lang === 'tr' ? 'Kaydı Düzenle' : 'Edit Entry';
  loadStockDatalist();
  openOverlay('elnModal');
  setTimeout(() => initQuillEditor(e.content || ''), 100);
};

window.saveEln = async () => {
  const title = document.getElementById('ef_title').value.trim();
  const content = elnQuill ? elnQuill.root.innerHTML : document.getElementById('ef_content').value.trim();
  if (!title || !content || content === '<p><br></p>') { toast(window.t('required'), 'err'); return; }

  const tags = document.getElementById('ef_tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const id = document.getElementById('ef_elnId').value;

  const data = {
    title, content, tags,
    linkedStock: document.getElementById('ef_linkedStock').value.trim(),
    linkedTask: document.getElementById('ef_linkedTask').value.trim(),
    authorUid: A.user.uid,
    authorName: A.userData.name,
    labId: A.userData.labId,
    updatedAt: Timestamp.now(),
  };

  try {
    if (id) {
      // Save previous version
      const oldSnap = await getDoc(doc(db, 'eln', id));
      if (oldSnap.exists()) {
        const old = oldSnap.data();
        const version = {
          title: old.title, content: old.content,
          savedBy: A.userData.name,
          savedAt: new Date().toISOString()
        };
        data.versions = arrayUnion(version);
      }
      await updateDoc(doc(db, 'eln', id), data);
      await auditLog('ELN_EDIT', `Edited ELN: ${title}`, A.user.uid, A.userData.name, A.userData.labId);
    } else {
      data.createdAt = Timestamp.now();
      data.versions = [];
      await addDoc(collection(db, 'eln'), data);
      await auditLog('ELN_ADD', `New ELN entry: ${title}`, A.user.uid, A.userData.name, A.userData.labId);
    }
    closeOverlay('elnModal');
    toast(window.t('saved'), 'ok');
  } catch (e) { toast(window.t('saveErr') + ' ' + e.message, 'err'); }
};

window.openElnDetail = async (id) => {
  const snap = await getDoc(doc(db, 'eln', id));
  if (!snap.exists()) return;
  const e = snap.data();
  const tags = (e.tags || []).map(t => `<span class="badge" style="background:var(--surface3)">${t}</span>`).join(' ');
  const versions = e.versions || [];

  document.getElementById('elnDetailBody').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:18px;font-weight:700;margin-bottom:6px">${e.title}</div>
      <div class="dim-cell" style="font-size:12px">
        ${e.authorName} · ${fmtDateTime(e.createdAt, A.lang)}
        ${e.linkedStock ? ` · 🔬 ${e.linkedStock}` : ''}
        ${e.linkedTask ? ` · 📋 ${e.linkedTask}` : ''}
      </div>
    </div>
    <div style="font-size:14px;line-height:1.8;color:var(--text2);padding:16px;background:var(--surface2);border-radius:var(--r);margin-bottom:16px">${e.content}</div>
    ${tags ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${tags}</div>` : ''}
    ${versions.length > 0 ? `
      <div class="card-title" style="margin-bottom:8px">📝 ${A.lang==='tr'?'Versiyon Geçmişi':'Version History'} (${versions.length})</div>
      <div style="max-height:200px;overflow-y:auto">
        ${versions.map((v, i) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
            <strong>v${i+1}</strong> — ${v.savedBy} · ${v.savedAt?.split('T')[0] || '—'}
            <button class="btn btn-ghost btn-xs" onclick="viewElnVersion('${id}',${i})" style="margin-left:8px">👁</button>
          </div>`).join('')}
      </div>` : ''}`;
  openOverlay('elnDetailModal');
};

window.viewElnVersion = async (id, idx) => {
  const snap = await getDoc(doc(db, 'eln', id));
  if (!snap.exists()) return;
  const v = (snap.data().versions || [])[idx];
  if (!v) return;
  alert(`${A.lang==='tr'?'Eski başlık':'Old title'}: ${v.title}\n\n${v.content?.replace(/<[^>]+>/g, '')?.slice(0, 500)}`);
};

window.deleteEln = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Kayıt silinsin mi?' : 'Delete this entry?')) return;
  const snap = await getDoc(doc(db, 'eln', id));
  await auditLog('ELN_DELETE', `Deleted ELN: ${snap.data()?.title}`, A.user.uid, A.userData.name, A.userData.labId);
  await deleteDoc(doc(db, 'eln', id));
  toast(window.t('deleted'), 'info');
};

window.elnExport = async () => {
  const q = query(collection(db, 'eln'), where('authorUid', '==', A.user.uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d => d.data()).map(e => ({
    'Başlık / Title': e.title,
    'İçerik / Content': (e.content || '').replace(/<[^>]+>/g, ''),
    'Etiketler / Tags': (e.tags || []).join(', '),
    'Bağlı Stok': e.linkedStock || '',
    'Yazar': e.authorName,
    'Tarih': e.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
  }));
  exportToExcel(rows, 'FEGLIMS_ELN');
};

export async function createElnFromTask(task) {
  await addDoc(collection(db, 'eln'), {
    title: `[Görev Tamamlandı] ${task.title}`,
    content: `<p><strong>Görev:</strong> ${task.title}</p><p><strong>Açıklama:</strong> ${task.description || '—'}</p><p><strong>Tamamlanma:</strong> ${new Date().toLocaleDateString('tr-TR')}</p>`,
    tags: ['görev-tamamlandı', 'otomatik'],
    linkedTask: task.title,
    authorUid: A.user.uid,
    authorName: A.userData.name,
    labId: A.userData.labId,
    versions: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
