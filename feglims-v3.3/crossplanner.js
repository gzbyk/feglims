// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — crossplanner.js
//  Drosophila Cross Planner: genetic cross calculations
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDateTime
} from './firebase.js';

const A = window.APP;

// Common Drosophila chromosome info
const CHROMOSOMES = {
  X: { name: 'X (1st)', tr: 'X (1. Kromozom)', en: 'X (1st Chromosome)' },
  '2': { name: '2nd', tr: '2. Kromozom', en: '2nd Chromosome' },
  '3': { name: '3rd', tr: '3. Kromozom', en: '3rd Chromosome' },
  '4': { name: '4th', tr: '4. Kromozom', en: '4th Chromosome' },
};

const COMMON_MARKERS = {
  'w': { name: 'white', chr: 'X', type: 'recessive', tr: 'Beyaz göz', en: 'White eyes' },
  'y': { name: 'yellow', chr: 'X', type: 'recessive', tr: 'Sarı vücut', en: 'Yellow body' },
  'sn': { name: 'singed', chr: 'X', type: 'recessive', tr: 'Kıvrık kıllar', en: 'Singed bristles' },
  'v': { name: 'vermillion', chr: 'X', type: 'recessive', tr: 'Kırmızı göz', en: 'Vermillion eyes' },
  'CyO': { name: 'Curly O', chr: '2', type: 'dominant', tr: '2. krom. dengeleyici', en: '2nd chr balancer' },
  'Sp': { name: 'Sternopleural', chr: '2', type: 'dominant', tr: 'Ekstra kıllar', en: 'Extra bristles' },
  'TM3': { name: 'TM3', chr: '3', type: 'dominant', tr: '3. krom. dengeleyici', en: '3rd chr balancer' },
  'TM6B': { name: 'TM6B', chr: '3', type: 'dominant', tr: '3. krom. dengeleyici (Tb)', en: '3rd chr balancer (Tb)' },
  'Sb': { name: 'Stubble', chr: '3', type: 'dominant', tr: 'Kısa kıllar', en: 'Stubble bristles' },
  'e': { name: 'ebony', chr: '3', type: 'recessive', tr: 'Koyu vücut', en: 'Dark body' },
};

let crossTab = 'planner';

export function renderCrossPlanner() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab ${crossTab==='planner'?'active':''}" onclick="crossSetTab('planner')">🧬 ${A.lang==='tr'?'Çapraz Planlayıcı':'Cross Planner'}</div>
        <div class="tab ${crossTab==='saved'?'active':''}" onclick="crossSetTab('saved')">📋 ${A.lang==='tr'?'Kaydedilen Çaprazlar':'Saved Crosses'}</div>
        <div class="tab ${crossTab==='reference'?'active':''}" onclick="crossSetTab('reference')">📚 ${A.lang==='tr'?'Referans':'Reference'}</div>
      </div>
    </div>
    <div id="crossContent"></div>`;

  if (crossTab === 'planner') renderPlannerView();
  else if (crossTab === 'saved') renderSavedCrosses();
  else renderCrossReference();
}

window.crossSetTab = (tab) => { crossTab = tab; renderCrossPlanner(); };

function renderPlannerView() {
  const wrap = document.getElementById('crossContent');
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">🪰 ${A.lang==='tr'?'Ebeveyn Stokları':'Parent Stocks'}</div>
      <div class="fg fg2" style="gap:16px">
        <div class="fgi">
          <label class="fl">♀ ${A.lang==='tr'?'Dişi (Anne)':'Female (Mother)'}</label>
          <select class="fc" id="cross_female" onchange="previewCross()">
            <option value="">${A.lang==='tr'?'Stok seçin...':'Select stock...'}</option>
          </select>
          <div style="margin-top:4px">
            <label class="fl">${A.lang==='tr'?'veya genotip girin:':'or enter genotype:'}</label>
            <input class="fc" id="cross_female_geno" placeholder="w[*]; CyO/+; TM3/+" oninput="previewCross()">
          </div>
        </div>
        <div class="fgi">
          <label class="fl">♂ ${A.lang==='tr'?'Erkek (Baba)':'Male (Father)'}</label>
          <select class="fc" id="cross_male" onchange="previewCross()">
            <option value="">${A.lang==='tr'?'Stok seçin...':'Select stock...'}</option>
          </select>
          <div style="margin-top:4px">
            <label class="fl">${A.lang==='tr'?'veya genotip girin:':'or enter genotype:'}</label>
            <input class="fc" id="cross_male_geno" placeholder="y[1] w[*]; Sp/CyO" oninput="previewCross()">
          </div>
        </div>
      </div>
      <div class="fgi" style="margin-top:12px">
        <label class="fl">${A.lang==='tr'?'Çapraz Amacı / Notlar':'Cross Purpose / Notes'}</label>
        <textarea class="fc" id="cross_notes" rows="2" placeholder="${A.lang==='tr'?'Bu çaprazlamanın amacını yazın...':'Describe the purpose of this cross...'}"></textarea>
      </div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="calculateCross()">🧬 ${A.lang==='tr'?'Hesapla':'Calculate'}</button>
        <button class="btn btn-secondary" onclick="saveCrossResult()">💾 ${A.lang==='tr'?'Kaydet':'Save'}</button>
      </div>
    </div>
    <div id="crossResults"></div>`;

  loadStocksForCross();
}

async function loadStocksForCross() {
  const snap = await getDocs(query(collection(db, 'stocks'), where('labId', '==', A.userData.labId)));
  const stocks = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.status !== 'Lost');

  ['cross_female', 'cross_male'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="">${A.lang==='tr'?'Stok seçin...':'Select stock...'}</option>` +
      stocks.map(s => `<option value="${s.id}" data-genotype="${s.genotype || ''}">${s.stockCode} — ${(s.genotype || '').slice(0, 40)}</option>`).join('');
    if (currentVal) sel.value = currentVal;
  });
}

window.previewCross = () => {
  // Show quick preview of selected genotypes
};

window.calculateCross = () => {
  const femaleGeno = getSelectedGenotype('female');
  const maleGeno = getSelectedGenotype('male');

  if (!femaleGeno || !maleGeno) {
    toast(A.lang==='tr'?'Her iki ebeveyni de seçin veya genotip girin':'Select both parents or enter genotypes', 'warn');
    return;
  }

  const result = predictCrossOutcome(femaleGeno, maleGeno);
  renderCrossResults(result, femaleGeno, maleGeno);
};

function getSelectedGenotype(parent) {
  const selId = `cross_${parent}`;
  const genoId = `cross_${parent}_geno`;
  const manualGeno = document.getElementById(genoId)?.value?.trim();
  if (manualGeno) return manualGeno;

  const sel = document.getElementById(selId);
  if (!sel || !sel.value) return null;
  const opt = sel.options[sel.selectedIndex];
  return opt?.dataset?.genotype || null;
}

function predictCrossOutcome(femaleGeno, maleGeno) {
  // Parse chromosomes from genotype notation: "alleles; alleles; alleles"
  // Standard Drosophila: X; 2; 3; (4 rarely noted)
  const parseChromosomes = (geno) => {
    const parts = geno.split(';').map(p => p.trim()).filter(Boolean);
    return {
      X: parts[0] || '+',
      chr2: parts[1] || '+',
      chr3: parts[2] || '+',
      chr4: parts[3] || '+',
    };
  };

  const female = parseChromosomes(femaleGeno);
  const male = parseChromosomes(maleGeno);

  // Simple prediction: each chromosome segregates independently
  // For each chromosome, list possible F1 combinations
  const outcomes = [];

  // X chromosome: daughters get X from father, sons get X from mother
  // Autosomes: each parent contributes one copy
  const autoCombo = (f, m) => {
    // Split allele notation (e.g., "CyO/+" -> ["CyO", "+"])
    const fAlleles = f.includes('/') ? f.split('/') : [f, f];
    const mAlleles = m.includes('/') ? m.split('/') : [m, m];
    const combos = [];
    for (const fa of fAlleles) {
      for (const ma of mAlleles) {
        combos.push(`${fa}/${ma}`);
      }
    }
    return combos;
  };

  // X-linked: females XX, males XY
  const fXAlleles = female.X.includes('/') ? female.X.split('/') : [female.X, female.X];
  const mXAlleles = male.X.includes('/') ? [male.X] : [male.X]; // Males hemizygous

  // F1 Daughters: one X from father, one from mother
  const daughterX = fXAlleles.map(fa => `${fa}/${male.X}`);
  // F1 Sons: X from mother only
  const sonX = fXAlleles.map(fa => fa);

  const chr2Combos = autoCombo(female.chr2, male.chr2);
  const chr3Combos = autoCombo(female.chr3, male.chr3);

  // Generate all possible F1 genotypes
  const daughters = [];
  const sons = [];

  for (const x of daughterX) {
    for (const c2 of chr2Combos) {
      for (const c3 of chr3Combos) {
        daughters.push(`${x}; ${c2}; ${c3}`);
      }
    }
  }

  for (const x of sonX) {
    for (const c2 of chr2Combos) {
      for (const c3 of chr3Combos) {
        sons.push(`${x}; ${c2}; ${c3}`);
      }
    }
  }

  // Count unique genotypes and frequencies
  const countUnique = (arr) => {
    const map = {};
    arr.forEach(g => { map[g] = (map[g] || 0) + 1; });
    return Object.entries(map).map(([genotype, count]) => ({
      genotype, frequency: count / arr.length, count
    }));
  };

  return {
    daughters: countUnique(daughters),
    sons: countUnique(sons),
    totalDaughters: daughters.length,
    totalSons: sons.length,
  };
}

function renderCrossResults(result, femaleGeno, maleGeno) {
  const wrap = document.getElementById('crossResults');
  if (!wrap) return;

  const renderGenotypes = (items, total) => items.map(g => {
    const pct = (g.frequency * 100).toFixed(1);
    return `<div style="padding:8px 12px;background:var(--bg2);border-radius:6px;margin-bottom:6px">
      <div class="row" style="justify-content:space-between">
        <code style="font-size:12px;color:var(--accent)">${g.genotype}</code>
        <span style="font-size:11px;font-weight:600;color:var(--text2)">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--bg1);border-radius:2px;margin-top:6px">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px"></div>
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">🧬 ${A.lang==='tr'?'Çapraz Sonuçları':'Cross Results'}</div>
      <div style="text-align:center;margin-bottom:16px;font-size:13px;color:var(--text2)">
        ♀ <code style="color:var(--accent)">${femaleGeno}</code>
        <span style="margin:0 12px;font-size:16px">✕</span>
        ♂ <code style="color:var(--accent)">${maleGeno}</code>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">♀ ${A.lang==='tr'?'F1 Dişiler':'F1 Daughters'} (${result.daughters.length} ${A.lang==='tr'?'sınıf':'classes'})</div>
        ${renderGenotypes(result.daughters, result.totalDaughters)}
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">♂ ${A.lang==='tr'?'F1 Erkekler':'F1 Sons'} (${result.sons.length} ${A.lang==='tr'?'sınıf':'classes'})</div>
        ${renderGenotypes(result.sons, result.totalSons)}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div style="font-size:12px;color:var(--text3)">
        ⚠️ ${A.lang==='tr'
          ?'Not: Bu hesaplama basit Mendel genetiğine dayanır. Crossing over, maternal etki, letal kombinasyonlar ve epistasis gibi faktörler dikkate alınmamıştır.'
          :'Note: This calculation is based on simple Mendelian genetics. Factors such as crossing over, maternal effects, lethal combinations, and epistasis are not considered.'}
      </div>
    </div>`;

  // Store for saving
  wrap._lastResult = { femaleGeno, maleGeno, result };
}

window.saveCrossResult = async () => {
  const wrap = document.getElementById('crossResults');
  const data = wrap?._lastResult;
  if (!data) { toast(A.lang==='tr'?'Önce çaprazlama hesaplayın':'Calculate a cross first', 'warn'); return; }

  const notes = document.getElementById('cross_notes')?.value?.trim() || '';
  await addDoc(collection(db, 'crosses'), {
    femaleGeno: data.femaleGeno,
    maleGeno: data.maleGeno,
    daughters: data.result.daughters,
    sons: data.result.sons,
    notes,
    createdBy: A.user.uid,
    createdByName: A.userData.name,
    labId: A.userData.labId,
    createdAt: Timestamp.now(),
  });
  await auditLog('ADD_CROSS', `Planned cross: ${data.femaleGeno} × ${data.maleGeno}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(A.lang==='tr'?'Çapraz kaydedildi':'Cross saved', 'ok');
};

async function renderSavedCrosses() {
  const wrap = document.getElementById('crossContent');
  const snap = await getDocs(query(collection(db, 'crosses'), where('labId', '==', A.userData.labId), orderBy('createdAt', 'desc')));
  const crosses = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (crosses.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🧬</div><div class="empty-text">${A.lang==='tr'?'Kaydedilmiş çapraz yok.':'No saved crosses.'}</div></div>`;
    return;
  }

  wrap.innerHTML = crosses.map(c => `
    <div class="card" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:13px">
            ♀ <code style="color:var(--accent)">${c.femaleGeno}</code>
            <span style="margin:0 8px">✕</span>
            ♂ <code style="color:var(--accent)">${c.maleGeno}</code>
          </div>
          ${c.notes ? `<div style="font-size:12px;color:var(--text3);margin-top:4px">${c.notes}</div>` : ''}
          <div style="font-size:11px;color:var(--text3);margin-top:6px">
            👤 ${c.createdByName} · ${fmtDateTime(c.createdAt, A.lang)}
            · ${c.daughters?.length || 0} ♀ ${A.lang==='tr'?'sınıf':'classes'}, ${c.sons?.length || 0} ♂ ${A.lang==='tr'?'sınıf':'classes'}
          </div>
        </div>
        <button class="btn btn-red btn-sm" onclick="deleteCross('${c.id}')">🗑</button>
      </div>
    </div>`).join('');
}

window.deleteCross = async (id) => {
  if (!confirm(A.lang==='tr'?'Çapraz silinsin mi?':'Delete this cross?')) return;
  await deleteDoc(doc(db, 'crosses', id));
  toast(window.t('deleted'), 'info');
  renderSavedCrosses();
};

function renderCrossReference() {
  const wrap = document.getElementById('crossContent');
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">📚 ${A.lang==='tr'?'Yaygın Drosophila Markerları':'Common Drosophila Markers'}</div>
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:12px">
          <thead><tr>
            <th>${A.lang==='tr'?'Sembol':'Symbol'}</th>
            <th>${A.lang==='tr'?'Ad':'Name'}</th>
            <th>${A.lang==='tr'?'Kromozom':'Chromosome'}</th>
            <th>${A.lang==='tr'?'Tip':'Type'}</th>
            <th>${A.lang==='tr'?'Açıklama':'Description'}</th>
          </tr></thead>
          <tbody>
            ${Object.entries(COMMON_MARKERS).map(([sym, m]) => `<tr>
              <td><code style="color:var(--accent)">${sym}</code></td>
              <td>${m.name}</td>
              <td>${m.chr}</td>
              <td><span class="badge" style="background:${m.type==='dominant'?'#00e5b022':'#ffb54522'};color:${m.type==='dominant'?'#00e5b0':'#ffb545'}">${m.type}</span></td>
              <td>${m[A.lang]}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div style="font-size:14px;font-weight:600;margin-bottom:12px">🧬 ${A.lang==='tr'?'Genotip Yazım Kuralları':'Genotype Notation'}</div>
      <div style="font-size:13px;line-height:1.8;color:var(--text2)">
        <div><code style="color:var(--accent)">;</code> — ${A.lang==='tr'?'Kromozom ayırıcı (X; 2; 3)':'Chromosome separator (X; 2; 3)'}</div>
        <div><code style="color:var(--accent)">/</code> — ${A.lang==='tr'?'Homolog ayırıcı (CyO/+)':'Homolog separator (CyO/+)'}</div>
        <div><code style="color:var(--accent)">[allele]</code> — ${A.lang==='tr'?'Alel gösterimi (w[*], sn[3])':'Allele notation (w[*], sn[3])'}</div>
        <div><code style="color:var(--accent)">+</code> — ${A.lang==='tr'?'Yabanıl tip alel':'Wild-type allele'}</div>
        <div><code style="color:var(--accent)">P{...}</code> — ${A.lang==='tr'?'P-element konstrukt':'P-element construct'}</div>
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:8px">
        <div class="fl" style="margin-bottom:8px">${A.lang==='tr'?'Örnek Genotip':'Example Genotype'}</div>
        <code style="font-size:13px;color:var(--accent)">w[*]; CyO/+; TM3, Sb[1]/+</code>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">
          ${A.lang==='tr'
            ?'X: white mutant | 2: CyO dengeleyici heterozigot | 3: TM3 dengeleyici + Stubble heterozigot'
            :'X: white mutant | 2: CyO balancer heterozygous | 3: TM3 balancer + Stubble heterozygous'}
        </div>
      </div>
    </div>`;
}
