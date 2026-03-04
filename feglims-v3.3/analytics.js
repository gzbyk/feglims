// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — analytics.js
// ═══════════════════════════════════════════
import { db, collection, query, orderBy, getDocs, todayISO } from './firebase.js';

const A = window.APP;

export async function renderAnalytics() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab active" id="an-tab-stock"   onclick="anTab('stock')">🔬 ${A.lang==='tr'?'Stok':'Stock'}</div>
        <div class="tab"        id="an-tab-chem"    onclick="anTab('chem')">🧪 ${A.lang==='tr'?'Kimyasal':'Chemical'}</div>
        <div class="tab"        id="an-tab-ops"     onclick="anTab('ops')">📊 ${A.lang==='tr'?'Operasyonel':'Operational'}</div>
        <div class="tab"        id="an-tab-personal" onclick="anTab('personal')">👤 ${A.lang==='tr'?'Kişisel':'Personal'}</div>
        <div class="tab"        id="an-tab-tasks"    onclick="anTab('tasks')">📋 ${A.lang==='tr'?'Görevler':'Tasks'}</div>
      </div>
      <div class="row" style="gap:8px">
        <input type="date" class="fc btn-sm" id="an_from" style="width:140px">
        <input type="date" class="fc btn-sm" id="an_to" style="width:140px">
        <button class="btn btn-secondary btn-sm" onclick="refreshAnalytics()">🔄</button>
        <button class="btn btn-secondary btn-sm" onclick="downloadAnalyticsPNG()">📷 PNG</button>
        <button class="btn btn-secondary btn-sm" onclick="exportAnalytics()">📊 Excel</button>
      </div>
    </div>
    <div id="analyticsContent"></div>`;

  // Default dates
  const to = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 3);
  document.getElementById('an_from').value = from.toISOString().split('T')[0];
  document.getElementById('an_to').value = to.toISOString().split('T')[0];

  anTab('stock');
}

window.anTab = (tab) => {
  ['stock','chem','ops','personal','tasks'].forEach(k => {
    document.getElementById(`an-tab-${k}`)?.classList.toggle('active', k===tab);
  });
  const fns = { stock: loadStockAnalytics, chem: loadChemAnalytics, ops: loadOpsAnalytics, personal: loadPersonalAnalytics, tasks: loadTasksAnalytics };
  fns[tab]?.();
};

window.refreshAnalytics = () => {
  const activeTab = ['stock','chem','ops','personal','tasks'].find(k =>
    document.getElementById(`an-tab-${k}`)?.classList.contains('active'));
  if (activeTab) anTab(activeTab);
};

// Fetch all stocks for current lab
async function fetchStocks() {
  const snap = await getDocs(query(collection(db, 'stocks'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.labId === A.userData.labId);
}

async function fetchChemicals() {
  const snap = await getDocs(collection(db, 'chemicals'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.labId === A.userData.labId);
}

window.downloadAnalyticsPNG = () => {
  const canvas = document.querySelector('#analyticsContent canvas');
  if (!canvas) { toast(A.lang==='tr'?'Görüntülenecek grafik yok':'No chart to capture', 'warn'); return; }
  const link = document.createElement('a');
  link.download = `FEGLIMS_Chart_${new Date().toISOString().split('T')[0]}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// ── STOCK ANALYTICS ──────────────────────────
async function loadStockAnalytics() {
  const el = document.getElementById('analyticsContent');
  el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">${A.lang==='tr'?'Yükleniyor...':'Loading...'}</div>`;

  const stocks = await fetchStocks();
  const active = stocks.filter(s => s.status === 'Active').length;
  const weak   = stocks.filter(s => s.status === 'Weak').length;
  const lost   = stocks.filter(s => s.status === 'Lost').length;
  const total  = stocks.length;

  // By lineage
  const byLineage = {};
  stocks.forEach(s => { byLineage[s.lineage||'Other'] = (byLineage[s.lineage||'Other']||0)+1; });

  // By climate
  const byClimate = {};
  stocks.forEach(s => { byClimate[(s.climate||'?')+'°C'] = (byClimate[(s.climate||'?')+'°C']||0)+1; });

  // Monthly additions (last 6 months)
  const monthly = {};
  const now = new Date();
  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[k] = 0;
  }
  stocks.forEach(s => {
    const d = s.createdAt?.toDate?.()?.toISOString?.()?.slice(0,7);
    if (d && monthly[d] !== undefined) monthly[d]++;
  });

  // High risk (Weak > 14 days)
  const highRisk = stocks.filter(s => {
    if (s.status !== 'Weak') return false;
    const d = s.updatedAt?.toDate?.();
    if (!d) return false;
    return (Date.now() - d.getTime()) > 14*86400000;
  });

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card s-accent"><div class="stat-label">${A.lang==='tr'?'Toplam Stok':'Total Stocks'}</div><div class="stat-val c-accent">${total}</div></div>
      <div class="stat-card s-accent"><div class="stat-label">${A.lang==='tr'?'Aktif':'Active'}</div><div class="stat-val c-accent">${active}</div></div>
      <div class="stat-card s-amber"><div class="stat-label">${A.lang==='tr'?'Zayıf':'Weak'}</div><div class="stat-val c-amber">${weak}</div></div>
      <div class="stat-card s-red"><div class="stat-label">${A.lang==='tr'?'Kaybedildi':'Lost'}</div><div class="stat-val c-red">${lost}</div></div>
      <div class="stat-card s-purple"><div class="stat-label">${A.lang==='tr'?'Yüksek Risk (>14 gün Zayıf)':'High Risk (>14d Weak)'}</div><div class="stat-val c-purple">${highRisk.length}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'Durum Dağılımı':'Status Distribution'}</div><div class="chart-wrap"><canvas id="chartStatusDist"></canvas></div></div>
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'Soy Dağılımı':'Lineage Distribution'}</div><div class="chart-wrap"><canvas id="chartLineage"></canvas></div></div>
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'İklim Odası':'Climate Room'}</div><div class="chart-wrap"><canvas id="chartClimate"></canvas></div></div>
    </div>
    <div class="chart-card" style="margin-bottom:16px">
      <div class="chart-title">${A.lang==='tr'?'Aylık Stok Ekleme Trendi':'Monthly Stock Addition Trend'}</div>
      <div class="chart-wrap"><canvas id="chartMonthly"></canvas></div>
    </div>
    ${highRisk.length > 0 ? `
    <div class="card">
      <div class="card-title">⚠ ${A.lang==='tr'?'Yüksek Risk Stokları':'High Risk Stocks'}</div>
      ${highRisk.map(s => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <span class="accent-cell">${s.stockCode}</span>
          <span class="dim-cell" style="font-size:12px">${s.responsible||'—'}</span>
          <span class="badge b-weak">${A.lang==='tr'?'Zayıf':'Weak'}</span>
        </div>`).join('')}
    </div>` : ''}`;

  // Load Chart.js
  await ensureChartJs();

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5b0';
  const amber  = '#ffc142';
  const red    = '#ff4d6a';
  const blue   = '#4da6ff';
  const purple = '#b197fc';

  // Status pie
  new Chart(document.getElementById('chartStatusDist'), {
    type: 'doughnut',
    data: {
      labels: [A.lang==='tr'?'Aktif':'Active', A.lang==='tr'?'Zayıf':'Weak', A.lang==='tr'?'Kayıp':'Lost'],
      datasets: [{ data: [active, weak, lost], backgroundColor: [accent, amber, red], borderWidth: 0 }]
    },
    options: { plugins: { legend: { labels: { color: '#888' } } }, cutout: '60%' }
  });

  // Lineage bar
  new Chart(document.getElementById('chartLineage'), {
    type: 'bar',
    data: {
      labels: Object.keys(byLineage),
      datasets: [{ data: Object.values(byLineage), backgroundColor: blue, borderRadius: 4 }]
    },
    options: { plugins: { legend: { display: false } }, scales: {
      x: { ticks: { color: '#888', font: { size: 10 } }, grid: { color: 'rgba(128,128,128,.1)' } },
      y: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,.1)' }, beginAtZero: true }
    }}
  });

  // Climate pie
  new Chart(document.getElementById('chartClimate'), {
    type: 'pie',
    data: {
      labels: Object.keys(byClimate),
      datasets: [{ data: Object.values(byClimate), backgroundColor: [accent, purple], borderWidth: 0 }]
    },
    options: { plugins: { legend: { labels: { color: '#888' } } } }
  });

  // Monthly line
  new Chart(document.getElementById('chartMonthly'), {
    type: 'line',
    data: {
      labels: Object.keys(monthly),
      datasets: [{ data: Object.values(monthly), borderColor: accent, backgroundColor: accent+'22',
        fill: true, tension: 0.4, pointBackgroundColor: accent }]
    },
    options: { plugins: { legend: { display: false } }, scales: {
      x: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,.1)' } },
      y: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,.1)' }, beginAtZero: true }
    }}
  });
}

// ── CHEMICAL ANALYTICS ───────────────────────
async function loadChemAnalytics() {
  const el = document.getElementById('analyticsContent');
  el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">${A.lang==='tr'?'Yükleniyor...':'Loading...'}</div>`;
  const chems = await fetchChemicals();

  const today = new Date();
  const d30   = new Date(today); d30.setDate(d30.getDate()+30);
  const d60   = new Date(today); d60.setDate(d60.getDate()+60);
  const d90   = new Date(today); d90.setDate(d90.getDate()+90);

  const expiring30 = chems.filter(c => c.expiryDate && new Date(c.expiryDate) <= d30);
  const expiring60 = chems.filter(c => c.expiryDate && new Date(c.expiryDate) <= d60 && new Date(c.expiryDate) > d30);
  const expired    = chems.filter(c => c.expiryDate && new Date(c.expiryDate) < today);

  const byGHS = {};
  chems.forEach(c => { byGHS[c.ghsClass||'Unknown'] = (byGHS[c.ghsClass||'Unknown']||0)+1; });

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card s-blue"><div class="stat-label">${A.lang==='tr'?'Toplam Kimyasal':'Total Chemicals'}</div><div class="stat-val c-blue">${chems.length}</div></div>
      <div class="stat-card s-red"><div class="stat-label">${A.lang==='tr'?'Süresi Dolmuş':'Expired'}</div><div class="stat-val c-red">${expired.length}</div></div>
      <div class="stat-card s-amber"><div class="stat-label">${A.lang==='tr'?'30 Günde Dolacak':'Expires <30d'}</div><div class="stat-val c-amber">${expiring30.length}</div></div>
      <div class="stat-card s-purple"><div class="stat-label">${A.lang==='tr'?'60 Günde Dolacak':'Expires <60d'}</div><div class="stat-val c-purple">${expiring60.length}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'GHS Sınıf Dağılımı':'GHS Class Distribution'}</div><div class="chart-wrap"><canvas id="chartGHS"></canvas></div></div>
      <div class="card">
        <div class="card-title">⚠ ${A.lang==='tr'?'Yakında Dolacak Kimyasallar':'Expiring Soon'}</div>
        ${[...expiring30,...expiring60].length === 0
          ? `<div class="empty-state"><div class="empty-text">${A.lang==='tr'?'Yakında dolacak kimyasal yok.':'No chemicals expiring soon.'}</div></div>`
          : [...expiring30,...expiring60].map(c => `
            <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
              <span class="fw-bold">${c.name}</span>
              <span class="${new Date(c.expiryDate)<=d30?'text-red':'text-amber'}">${c.expiryDate}</span>
            </div>`).join('')}
      </div>
    </div>`;

  await ensureChartJs();
  const colors = ['#ff4d6a','#ffc142','#4da6ff','#00e5b0','#b197fc','#ff8a65','#26c6da','#ab47bc'];
  new Chart(document.getElementById('chartGHS'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(byGHS),
      datasets: [{ data: Object.values(byGHS), backgroundColor: colors, borderWidth: 0 }]
    },
    options: { plugins: { legend: { labels: { color: '#888' } } }, cutout: '50%' }
  });
}

// ── OPERATIONAL ANALYTICS ───────────────────
async function loadOpsAnalytics() {
  const el = document.getElementById('analyticsContent');
  const stocks = await fetchStocks();

  // Responsible performance
  const byResp = {};
  stocks.forEach(s => {
    const r = s.responsible || 'Unknown';
    if (!byResp[r]) byResp[r] = { total: 0, active: 0, weak: 0, lost: 0 };
    byResp[r].total++;
    if (s.status === 'Active') byResp[r].active++;
    if (s.status === 'Weak')   byResp[r].weak++;
    if (s.status === 'Lost')   byResp[r].lost++;
  });

  // Overdue clearings
  const today = todayISO();
  const overdueClearing = stocks.filter(s =>
    s.status === 'Active' && s.removalDate && s.removalDate < today
  );

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card s-blue">
        <div class="stat-label">${A.lang==='tr'?'Gecikmiş Ergin Atımı':'Overdue Parent Removal'}</div>
        <div class="stat-val c-blue">${overdueClearing.length}</div>
      </div>
      <div class="stat-card s-accent">
        <div class="stat-label">${A.lang==='tr'?'Sorumlu Araştırmacı':'Responsible Researchers'}</div>
        <div class="stat-val c-accent">${Object.keys(byResp).length}</div>
      </div>
    </div>
    <div class="tbl-wrap" style="margin-bottom:16px">
      <table>
        <thead><tr>
          <th>${A.lang==='tr'?'Araştırmacı':'Researcher'}</th>
          <th>${A.lang==='tr'?'Toplam':'Total'}</th>
          <th>${A.lang==='tr'?'Aktif':'Active'}</th>
          <th>${A.lang==='tr'?'Zayıf':'Weak'}</th>
          <th>${A.lang==='tr'?'Kayıp':'Lost'}</th>
          <th>${A.lang==='tr'?'Başarı Oranı':'Success Rate'}</th>
        </tr></thead>
        <tbody>${Object.entries(byResp).map(([r, d]) => {
          const rate = d.total > 0 ? Math.round(d.active/d.total*100) : 0;
          const color = rate > 80 ? 'var(--accent)' : rate > 60 ? 'var(--amber)' : 'var(--red)';
          return `<tr>
            <td class="fw-bold">${r}</td>
            <td class="mono-cell">${d.total}</td>
            <td class="mono-cell c-accent">${d.active}</td>
            <td class="mono-cell c-amber">${d.weak}</td>
            <td class="mono-cell c-red">${d.lost}</td>
            <td><span style="color:${color};font-weight:700;font-family:var(--mono)">${rate}%</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>
    ${overdueClearing.length > 0 ? `
      <div class="card">
        <div class="card-title">⏰ ${A.lang==='tr'?'Gecikmiş Ergin Atımları':'Overdue Parent Removals'}</div>
        ${overdueClearing.map(s => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span class="accent-cell">${s.stockCode}</span>
            <span class="dim-cell">${s.responsible}</span>
            <span class="text-red fw-bold">${s.removalDate}</span>
          </div>`).join('')}
      </div>` : ''}`;
}

// ── PERSONAL ANALYTICS ───────────────────────
async function loadPersonalAnalytics() {
  const el = document.getElementById('analyticsContent');
  const stocks = await fetchStocks();
  const myStocks = stocks.filter(s => s.responsibleUid === A.user.uid);

  const active = myStocks.filter(s => s.status === 'Active').length;
  const weak   = myStocks.filter(s => s.status === 'Weak').length;
  const lost   = myStocks.filter(s => s.status === 'Lost').length;

  const today = todayISO();
  const upcoming = myStocks.filter(s => s.removalDate >= today)
    .sort((a,b) => a.removalDate?.localeCompare?.(b.removalDate) || 0)
    .slice(0, 10);

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:22px">
      <div class="stat-card s-accent"><div class="stat-label">${A.lang==='tr'?'Benim Stoklarım':'My Stocks'}</div><div class="stat-val c-accent">${myStocks.length}</div></div>
      <div class="stat-card s-accent"><div class="stat-label">${A.lang==='tr'?'Aktif':'Active'}</div><div class="stat-val c-accent">${active}</div></div>
      <div class="stat-card s-amber"><div class="stat-label">${A.lang==='tr'?'Zayıf':'Weak'}</div><div class="stat-val c-amber">${weak}</div></div>
      <div class="stat-card s-red"><div class="stat-label">${A.lang==='tr'?'Kaybedildi':'Lost'}</div><div class="stat-val c-red">${lost}</div></div>
    </div>
    <div class="card">
      <div class="card-title">📅 ${A.lang==='tr'?'Yaklaşan Ergin Atımları':'Upcoming Parent Removals'}</div>
      ${upcoming.length === 0
        ? `<div class="empty-state"><div class="empty-text">${t('noData')}</div></div>`
        : upcoming.map(s => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span class="accent-cell">${s.stockCode}</span>
            <span class="dim-cell" style="font-size:12px;flex:1;margin:0 12px">${s.genotype?.slice(0,40)||'—'}</span>
            <span class="${s.removalDate<=today?'text-red':'text-amber'} fw-bold font-mono">${s.removalDate}</span>
          </div>`).join('')}
    </div>`;
}

window.exportAnalytics = async () => {
  const stocks = await fetchStocks();
  exportToExcel(stocks.map(s => ({
    'Stok Kodu': s.stockCode, 'Tür': s.species, 'Soy': s.lineage,
    'Genotip': s.genotype, 'Merkez': s.center, '°C': s.climate,
    'Stok Günü': s.stockDate, 'Ergin Atımı': s.removalDate,
    'Durum': s.status, 'Sorumlu': s.responsible, 'Lab': s.labName,
  })), 'FEGLIMS_Analytics');
};

// ── TASKS ANALYTICS ─────────────────────────
async function loadTasksAnalytics() {
  const el = document.getElementById('analyticsContent');
  el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">${A.lang==='tr'?'Yükleniyor...':'Loading...'}</div>`;
  
  const snap = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc')));
  const allTasks = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(t => t.labId === A.userData.labId);
  
  const myTasks = allTasks.filter(t => t.assignedToUid === A.user.uid);
  const assignedByMe = allTasks.filter(t => t.assignedByUid === A.user.uid);
  
  const myCompleted = myTasks.filter(t => t.status === 'completed').length;
  const myPending = myTasks.filter(t => t.status === 'pending' || t.status === 'inprogress').length;
  const myOverdue = myTasks.filter(t => t.dueDate && t.dueDate < todayISO() && t.status !== 'completed' && t.status !== 'cancelled').length;
  
  const aCompleted = assignedByMe.filter(t => t.status === 'completed').length;
  const aPending = assignedByMe.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  
  // By assignee performance
  const byAssignee = {};
  allTasks.forEach(t => {
    const n = t.assignedToName || 'Unknown';
    if (!byAssignee[n]) byAssignee[n] = { total: 0, completed: 0, overdue: 0 };
    byAssignee[n].total++;
    if (t.status === 'completed') byAssignee[n].completed++;
    if (t.dueDate && t.dueDate < todayISO() && t.status !== 'completed' && t.status !== 'cancelled') byAssignee[n].overdue++;
  });

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
      <div class="card">
        <div class="card-title">📋 ${A.lang==='tr'?'Bana Atanan Görevler':'Tasks Assigned To Me'}</div>
        <div style="display:flex;gap:16px;margin-top:10px">
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent)">${myCompleted}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Tamamlanan':'Done'}</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--amber)">${myPending}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Devam Eden':'Pending'}</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--red)">${myOverdue}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Gecikmiş':'Overdue'}</div></div>
        </div>
        ${myTasks.length > 0 ? `<div style="margin-top:12px;font-size:12px;color:var(--text3)">${A.lang==='tr'?'Tamamlanma oranı':'Completion rate'}: <strong style="color:var(--accent)">${Math.round(myCompleted/myTasks.length*100)}%</strong></div>` : ''}
      </div>
      <div class="card">
        <div class="card-title">📤 ${A.lang==='tr'?'Atadığım Görevler':'Tasks I Assigned'}</div>
        <div style="display:flex;gap:16px;margin-top:10px">
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--accent)">${aCompleted}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Tamamlanan':'Done'}</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--amber)">${aPending}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Bekleyen':'Pending'}</div></div>
          <div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--text2)">${assignedByMe.length}</div><div class="dim-cell" style="font-size:11px">${A.lang==='tr'?'Toplam':'Total'}</div></div>
        </div>
        ${assignedByMe.length > 0 ? `<div style="margin-top:12px;font-size:12px;color:var(--text3)">${A.lang==='tr'?'Tamamlanma oranı':'Completion rate'}: <strong style="color:var(--accent)">${Math.round(aCompleted/assignedByMe.length*100)}%</strong></div>` : ''}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">👥 ${A.lang==='tr'?'Kişi Bazlı Görev Performansı':'Per-person Task Performance'}</div>
      <div class="tbl-wrap" style="margin-top:10px">
        <table>
          <thead><tr>
            <th>${A.lang==='tr'?'Kişi':'Person'}</th>
            <th>${A.lang==='tr'?'Toplam':'Total'}</th>
            <th>${A.lang==='tr'?'Tamamlanan':'Completed'}</th>
            <th>${A.lang==='tr'?'Gecikmiş':'Overdue'}</th>
            <th>${A.lang==='tr'?'Oran':'Rate'}</th>
          </tr></thead>
          <tbody>${Object.entries(byAssignee).map(([n, d]) => {
            const rate = d.total > 0 ? Math.round(d.completed/d.total*100) : 0;
            const color = rate > 80 ? 'var(--accent)' : rate > 50 ? 'var(--amber)' : 'var(--red)';
            return `<tr>
              <td class="fw-bold">${n}</td>
              <td class="mono-cell">${d.total}</td>
              <td class="mono-cell c-accent">${d.completed}</td>
              <td class="mono-cell c-red">${d.overdue}</td>
              <td><span style="color:${color};font-weight:700;font-family:var(--mono)">${rate}%</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'Görev Durum Dağılımı':'Task Status Distribution'}</div><div class="chart-wrap"><canvas id="chartTaskStatus"></canvas></div></div>
      <div class="chart-card"><div class="chart-title">${A.lang==='tr'?'Öncelik Dağılımı':'Priority Distribution'}</div><div class="chart-wrap"><canvas id="chartTaskPriority"></canvas></div></div>
    </div>`;

  await ensureChartJs();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5b0';
  
  // Task status chart
  const statusCounts = { pending: 0, inprogress: 0, completed: 0, cancelled: 0 };
  allTasks.forEach(t => { if (statusCounts[t.status] !== undefined) statusCounts[t.status]++; });
  new Chart(document.getElementById('chartTaskStatus'), {
    type: 'doughnut',
    data: {
      labels: [A.lang==='tr'?'Bekliyor':'Pending', A.lang==='tr'?'Devam':'In Progress', A.lang==='tr'?'Tamamlandı':'Done', A.lang==='tr'?'İptal':'Cancelled'],
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#ffc142','#4da6ff',accent,'#ff4d6a'], borderWidth: 0 }]
    },
    options: { plugins: { legend: { labels: { color: '#888' } } }, cutout: '60%' }
  });
  
  // Priority chart
  const prioCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
  allTasks.forEach(t => { if (prioCounts[t.priority] !== undefined) prioCounts[t.priority]++; });
  new Chart(document.getElementById('chartTaskPriority'), {
    type: 'bar',
    data: {
      labels: [A.lang==='tr'?'Düşük':'Low', A.lang==='tr'?'Orta':'Medium', A.lang==='tr'?'Yüksek':'High', A.lang==='tr'?'Acil':'Urgent'],
      datasets: [{ data: Object.values(prioCounts), backgroundColor: ['#888','#4da6ff','#ffc142','#ff4d6a'], borderRadius: 4 }]
    },
    options: { plugins: { legend: { display: false } }, scales: {
      x: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,.1)' } },
      y: { ticks: { color: '#888' }, grid: { color: 'rgba(128,128,128,.1)' }, beginAtZero: true }
    }}
  });
}

async function ensureChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
