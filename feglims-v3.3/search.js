// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — search.js
//  Advanced Search & Filter: regex, multi-criteria, saved queries
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, getDocs, Timestamp,
  fmtDate, todayISO, exportToExcel
} from './firebase.js';

const A = window.APP;

const SEARCH_TARGETS = {
  stocks:    { icon: '🔬', tr: 'Stoklar',     en: 'Stocks',     fields: ['stockCode','genotype','species','lineage','center','responsible','notes','status'] },
  chemicals: { icon: '🧪', tr: 'Kimyasallar', en: 'Chemicals',  fields: ['name','formula','cas','location','supplier','notes'] },
  eln:       { icon: '📓', tr: 'ELN',         en: 'ELN',        fields: ['title','content','tags','authorName'] },
  protocols: { icon: '📚', tr: 'Protokoller', en: 'Protocols',  fields: ['title','summary','content','category'] },
};

export function renderAdvancedSearch() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:15px;font-weight:600;margin-bottom:12px">🔍 ${A.lang==='tr'?'Gelişmiş Arama':'Advanced Search'}</div>
      <div class="fg fg2" style="gap:12px">
        <div class="fgi span2">
          <label class="fl">${A.lang==='tr'?'Arama Terimi (regex destekli)':'Search Term (regex supported)'}</label>
          <input class="fc" id="adv_query" placeholder="${A.lang==='tr'?'Örn: w\\[\\*\\].*GFP veya basit metin':'E.g. w\\[\\*\\].*GFP or plain text'}" onkeydown="if(event.key==='Enter')runAdvSearch()">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Hedef':'Target'}</label>
          <select class="fc" id="adv_target" onchange="updateAdvFields()">
            <option value="all">${A.lang==='tr'?'Tümü':'All'}</option>
            ${Object.entries(SEARCH_TARGETS).map(([k,v]) => `<option value="${k}">${v.icon} ${v[A.lang]}</option>`).join('')}
          </select>
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Alan':'Field'}</label>
          <select class="fc" id="adv_field">
            <option value="all">${A.lang==='tr'?'Tüm Alanlar':'All Fields'}</option>
          </select>
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Tarih Başlangıç':'Date From'}</label>
          <input class="fc" type="date" id="adv_dateFrom">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Tarih Bitiş':'Date To'}</label>
          <input class="fc" type="date" id="adv_dateTo">
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Durum':'Status'}</label>
          <select class="fc" id="adv_status">
            <option value="">${A.lang==='tr'?'Tümü':'All'}</option>
            <option value="Active">Aktif</option>
            <option value="Weak">Zayıf</option>
            <option value="Lost">Kaybedildi</option>
          </select>
        </div>
        <div class="fgi">
          <label class="fl">${A.lang==='tr'?'Regex Modu':'Regex Mode'}</label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="adv_regex" checked> ${A.lang==='tr'?'Regex Etkin':'Regex Enabled'}
          </label>
        </div>
      </div>
      <div class="row" style="gap:8px;margin-top:16px">
        <button class="btn btn-primary" onclick="runAdvSearch()">🔍 ${A.lang==='tr'?'Ara':'Search'}</button>
        <button class="btn btn-secondary" onclick="saveSearchQuery()">📌 ${A.lang==='tr'?'Aramayı Kaydet':'Save Search'}</button>
        <button class="btn btn-secondary" onclick="exportSearchResults()">📊 Excel</button>
        <div id="savedSearchesWrap" style="margin-left:auto"></div>
      </div>
    </div>
    <div id="advSearchResults"></div>`;
  updateAdvFields();
  loadSavedSearches();
}

window.updateAdvFields = () => {
  const target = document.getElementById('adv_target').value;
  const fieldSel = document.getElementById('adv_field');
  fieldSel.innerHTML = `<option value="all">${A.lang==='tr'?'Tüm Alanlar':'All Fields'}</option>`;
  if (target !== 'all' && SEARCH_TARGETS[target]) {
    SEARCH_TARGETS[target].fields.forEach(f => {
      fieldSel.innerHTML += `<option value="${f}">${f}</option>`;
    });
  }
};

let lastSearchResults = [];

window.runAdvSearch = async () => {
  const queryStr = document.getElementById('adv_query').value.trim();
  const target = document.getElementById('adv_target').value;
  const field = document.getElementById('adv_field').value;
  const dateFrom = document.getElementById('adv_dateFrom').value;
  const dateTo = document.getElementById('adv_dateTo').value;
  const status = document.getElementById('adv_status').value;
  const useRegex = document.getElementById('adv_regex').checked;

  if (!queryStr && !dateFrom && !dateTo && !status) {
    toast(A.lang==='tr'?'Arama kriteri girin':'Enter search criteria', 'warn');
    return;
  }

  let regex = null;
  if (queryStr && useRegex) {
    try { regex = new RegExp(queryStr, 'i'); }
    catch { toast(A.lang==='tr'?'Geçersiz regex':'Invalid regex', 'err'); return; }
  }

  const results = [];
  const targets = target === 'all' ? Object.keys(SEARCH_TARGETS) : [target];

  for (const t of targets) {
    const snap = await getDocs(query(collection(db, t), where('labId', '==', A.userData.labId)));
    snap.docs.forEach(d => {
      const data = { id: d.id, ...d.data(), _type: t };
      // Date filter
      const dateField = data.stockDate || data.createdAt?.toDate?.()?.toISOString?.()?.split('T')?.[0] || '';
      if (dateFrom && dateField < dateFrom) return;
      if (dateTo && dateField > dateTo) return;
      // Status filter
      if (status && data.status && data.status !== status) return;
      // Text search
      if (queryStr) {
        const fields = field === 'all' ? SEARCH_TARGETS[t].fields : [field];
        const match = fields.some(f => {
          const val = String(data[f] || '');
          return regex ? regex.test(val) : val.toLowerCase().includes(queryStr.toLowerCase());
        });
        if (!match) return;
      }
      results.push(data);
    });
  }

  lastSearchResults = results;
  renderSearchResults(results);
};

function renderSearchResults(results) {
  const wrap = document.getElementById('advSearchResults');
  if (!wrap) return;
  if (results.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">${A.lang==='tr'?'Sonuç bulunamadı.':'No results found.'}</div></div>`;
    return;
  }

  wrap.innerHTML = `<div style="font-size:13px;color:var(--text3);margin-bottom:12px">${results.length} ${A.lang==='tr'?'sonuç bulundu':'results found'}</div>` +
    results.map(r => {
      const t = SEARCH_TARGETS[r._type] || {};
      const title = r.stockCode || r.name || r.title || r.id;
      const subtitle = r.genotype || r.formula || r.summary || '';
      return `<div class="log-entry" style="cursor:pointer" onclick="advSearchClick('${r._type}','${r.id}')">
        <div class="log-icon" style="font-size:18px">${t.icon || '📄'}</div>
        <div class="log-body">
          <div class="log-action">${title}</div>
          <div class="log-detail">${subtitle.slice(0, 80)}${subtitle.length > 80 ? '…' : ''}</div>
        </div>
        <div class="log-time" style="font-size:11px">${t[A.lang] || r._type}</div>
      </div>`;
    }).join('');
}

window.advSearchClick = (type, id) => {
  // Navigate to the relevant section and show detail
  if (type === 'stocks') { nav('inventory'); }
  else if (type === 'chemicals') { nav('chemicals'); }
  else if (type === 'eln') { nav('eln'); }
  else if (type === 'protocols') { nav('protocols'); }
};

window.saveSearchQuery = async () => {
  const name = prompt(A.lang==='tr'?'Arama adı:':'Search name:');
  if (!name) return;
  const params = {
    query: document.getElementById('adv_query').value,
    target: document.getElementById('adv_target').value,
    field: document.getElementById('adv_field').value,
    dateFrom: document.getElementById('adv_dateFrom').value,
    dateTo: document.getElementById('adv_dateTo').value,
    status: document.getElementById('adv_status').value,
    regex: document.getElementById('adv_regex').checked,
  };
  await addDoc(collection(db, 'savedSearches'), {
    name, params,
    createdBy: A.user.uid,
    labId: A.userData.labId,
    createdAt: Timestamp.now(),
  });
  toast(A.lang==='tr'?'Arama kaydedildi':'Search saved', 'ok');
  loadSavedSearches();
};

async function loadSavedSearches() {
  const snap = await getDocs(query(collection(db, 'savedSearches'), where('createdBy', '==', A.user.uid)));
  const searches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const wrap = document.getElementById('savedSearchesWrap');
  if (!wrap || searches.length === 0) return;
  wrap.innerHTML = `<select class="fc btn-sm" style="width:180px;font-size:11px" onchange="if(this.value)loadSavedSearchById(this.value);this.value=''">
    <option value="">📌 ${A.lang==='tr'?'Kayıtlı Aramalar':'Saved Searches'}</option>
    ${searches.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
  </select>`;
}

window.loadSavedSearchById = async (id) => {
  const snap = await getDoc(doc(db, 'savedSearches', id));
  if (!snap.exists()) return;
  const p = snap.data().params;
  document.getElementById('adv_query').value = p.query || '';
  document.getElementById('adv_target').value = p.target || 'all';
  updateAdvFields();
  document.getElementById('adv_field').value = p.field || 'all';
  document.getElementById('adv_dateFrom').value = p.dateFrom || '';
  document.getElementById('adv_dateTo').value = p.dateTo || '';
  document.getElementById('adv_status').value = p.status || '';
  document.getElementById('adv_regex').checked = p.regex !== false;
  runAdvSearch();
};

window.exportSearchResults = () => {
  if (lastSearchResults.length === 0) { toast(A.lang==='tr'?'Dışa aktarılacak sonuç yok':'No results to export', 'warn'); return; }
  const data = lastSearchResults.map(r => ({
    Type: r._type, Code: r.stockCode || r.name || r.title || '',
    Genotype: r.genotype || '', Status: r.status || '', Date: r.stockDate || '',
    Responsible: r.responsible || r.authorName || '', Notes: r.notes || r.summary || ''
  }));
  exportToExcel(data, 'FEGLIMS_Search');
};
