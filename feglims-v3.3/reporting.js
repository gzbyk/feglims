// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — reporting.js
//  Reporting Module: stats, charts, PDF export
// ═══════════════════════════════════════════
import {
  db, collection, query, where, getDocs, Timestamp,
  fmtDate, todayISO, exportToExcel, hasPermission
} from './firebase.js';

const A = window.APP;

let reportPeriod = 'month', reportYear = new Date().getFullYear(), reportMonth = new Date().getMonth();

export function renderReporting() {
  const content = document.getElementById('content');
  const months_tr = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const months_en = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const months = A.lang === 'tr' ? months_tr : months_en;

  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        <div class="tab ${reportPeriod==='month'?'active':''}" onclick="setReportPeriod('month')">📅 ${A.lang==='tr'?'Aylık':'Monthly'}</div>
        <div class="tab ${reportPeriod==='year'?'active':''}" onclick="setReportPeriod('year')">📆 ${A.lang==='tr'?'Yıllık':'Yearly'}</div>
      </div>
      <div class="row" style="gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="reportPrev()">◀</button>
        <span id="reportTitle" style="font-weight:600;min-width:140px;text-align:center">${reportPeriod==='month' ? months[reportMonth]+' '+reportYear : reportYear}</span>
        <button class="btn btn-ghost btn-sm" onclick="reportNext()">▶</button>
        <button class="btn btn-secondary btn-sm" onclick="exportReportPDF()">📄 PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="exportReportExcel()">📊 Excel</button>
      </div>
    </div>
    <div id="reportContent"></div>`;

  generateReport();
}

window.setReportPeriod = (p) => { reportPeriod = p; renderReporting(); };
window.reportPrev = () => {
  if (reportPeriod === 'month') { reportMonth--; if (reportMonth < 0) { reportMonth = 11; reportYear--; } }
  else { reportYear--; }
  renderReporting();
};
window.reportNext = () => {
  if (reportPeriod === 'month') { reportMonth++; if (reportMonth > 11) { reportMonth = 0; reportYear++; } }
  else { reportYear++; }
  renderReporting();
};

async function generateReport() {
  const wrap = document.getElementById('reportContent');
  if (!wrap) return;
  wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text3)">⏳ ${A.lang==='tr'?'Rapor oluşturuluyor...':'Generating report...'}</div>`;

  const labId = A.userData.labId;
  let dateFrom, dateTo;
  if (reportPeriod === 'month') {
    dateFrom = `${reportYear}-${String(reportMonth+1).padStart(2,'0')}-01`;
    const lastDay = new Date(reportYear, reportMonth+1, 0).getDate();
    dateTo = `${reportYear}-${String(reportMonth+1).padStart(2,'0')}-${lastDay}`;
  } else {
    dateFrom = `${reportYear}-01-01`;
    dateTo = `${reportYear}-12-31`;
  }

  // Fetch all data
  const [stockSnap, chemSnap, elnSnap, taskSnap, orderSnap, logSnap] = await Promise.all([
    getDocs(query(collection(db, 'stocks'), where('labId', '==', labId))),
    getDocs(query(collection(db, 'chemicals'), where('labId', '==', labId))),
    getDocs(query(collection(db, 'eln'), where('labId', '==', labId))),
    getDocs(query(collection(db, 'tasks'), where('labId', '==', labId))),
    getDocs(query(collection(db, 'orders'), where('labId', '==', labId))),
    getDocs(query(collection(db, 'auditLog'), where('labId', '==', labId))),
  ]);

  const stocks = stockSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const chems = chemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const elns = elnSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const tasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const logs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filter by period
  const inPeriod = (dateStr) => dateStr && dateStr >= dateFrom && dateStr <= dateTo;
  const tsInPeriod = (ts) => {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const iso = d.toISOString().split('T')[0];
    return iso >= dateFrom && iso <= dateTo;
  };

  const newStocks = stocks.filter(s => inPeriod(s.stockDate));
  const lostStocks = stocks.filter(s => s.status === 'Lost' && s.statusHistory?.some(h => h.status === 'Lost' && inPeriod(h.changedAt?.split?.('T')?.[0])));
  const activeStocks = stocks.filter(s => s.status === 'Active');
  const weakStocks = stocks.filter(s => s.status === 'Weak');
  const newChems = chems.filter(c => tsInPeriod(c.createdAt));
  const newElns = elns.filter(e => tsInPeriod(e.createdAt));
  const periodLogs = logs.filter(l => tsInPeriod(l.timestamp));

  // User activity
  const userActivity = {};
  periodLogs.forEach(l => {
    const name = l.userName || 'Unknown';
    if (!userActivity[name]) userActivity[name] = 0;
    userActivity[name]++;
  });
  const topUsers = Object.entries(userActivity).sort((a,b) => b[1] - a[1]).slice(0, 10);

  // Species breakdown
  const speciesCount = {};
  stocks.forEach(s => { speciesCount[s.species] = (speciesCount[s.species] || 0) + 1; });

  // Status breakdown
  const statusCount = { Active: activeStocks.length, Weak: weakStocks.length, Lost: stocks.filter(s => s.status === 'Lost').length };

  // Monthly trend (for yearly view)
  const monthlyNew = new Array(12).fill(0);
  const monthlyLost = new Array(12).fill(0);
  if (reportPeriod === 'year') {
    stocks.forEach(s => {
      if (s.stockDate?.startsWith(String(reportYear))) {
        const m = parseInt(s.stockDate.split('-')[1]) - 1;
        monthlyNew[m]++;
      }
    });
    stocks.forEach(s => {
      if (s.status === 'Lost') {
        s.statusHistory?.forEach(h => {
          if (h.status === 'Lost' && h.changedAt?.startsWith?.(String(reportYear))) {
            const m = parseInt(h.changedAt.split('-')[1]) || 0;
            if (m > 0) monthlyLost[m-1]++;
          }
        });
      }
    });
  }

  const lossRate = newStocks.length > 0 ? ((lostStocks.length / newStocks.length) * 100).toFixed(1) : '0.0';

  // Render report
  wrap.innerHTML = `
    <div id="reportPrintArea">
    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      ${[
        ['🔬', A.lang==='tr'?'Toplam Stok':'Total Stocks', stocks.length, 'var(--accent)'],
        ['➕', A.lang==='tr'?'Yeni Stok':'New Stocks', newStocks.length, '#00e5b0'],
        ['❌', A.lang==='tr'?'Kaybedilen':'Lost', lostStocks.length, '#ff4d6a'],
        ['📉', A.lang==='tr'?'Kayıp Oranı':'Loss Rate', lossRate+'%', '#ffb545'],
        ['🧪', A.lang==='tr'?'Kimyasallar':'Chemicals', chems.length, '#a78bfa'],
        ['📓', A.lang==='tr'?'ELN Girişi':'ELN Entries', newElns.length, '#3d9eff'],
        ['📋', A.lang==='tr'?'Görevler':'Tasks', tasks.length, '#f59e0b'],
        ['📊', A.lang==='tr'?'Aktiviteler':'Activities', periodLogs.length, '#6b90b0'],
      ].map(([icon, label, val, color]) => `
        <div class="card" style="text-align:center;padding:16px">
          <div style="font-size:24px">${icon}</div>
          <div style="font-size:22px;font-weight:700;color:${color};margin:4px 0">${val}</div>
          <div style="font-size:11px;color:var(--text3)">${label}</div>
        </div>`).join('')}
    </div>

    <!-- Charts Section -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Species Distribution -->
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">🧬 ${A.lang==='tr'?'Tür Dağılımı':'Species Distribution'}</div>
        ${Object.entries(speciesCount).map(([sp, cnt]) => {
          const pct = ((cnt / stocks.length) * 100).toFixed(0);
          return `<div style="margin-bottom:8px">
            <div class="row" style="justify-content:space-between;font-size:12px"><span>${sp}</span><span>${cnt} (${pct}%)</span></div>
            <div style="height:6px;background:var(--bg2);border-radius:3px;margin-top:4px"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></div></div>
          </div>`;
        }).join('')}
      </div>

      <!-- Status Distribution -->
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:12px">📊 ${A.lang==='tr'?'Durum Dağılımı':'Status Distribution'}</div>
        ${Object.entries(statusCount).map(([st, cnt]) => {
          const colors = { Active: '#00e5b0', Weak: '#ffb545', Lost: '#ff4d6a' };
          const pct = stocks.length > 0 ? ((cnt / stocks.length) * 100).toFixed(0) : 0;
          return `<div style="margin-bottom:8px">
            <div class="row" style="justify-content:space-between;font-size:12px"><span style="color:${colors[st]}">${st}</span><span>${cnt} (${pct}%)</span></div>
            <div style="height:6px;background:var(--bg2);border-radius:3px;margin-top:4px"><div style="height:100%;width:${pct}%;background:${colors[st]};border-radius:3px"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    ${reportPeriod === 'year' ? `
    <!-- Monthly Trend -->
    <div class="card" style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">📈 ${A.lang==='tr'?'Aylık Stok Hareketi':'Monthly Stock Movement'}</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:120px;padding:0 4px">
        ${monthlyNew.map((n, i) => {
          const maxVal = Math.max(...monthlyNew, ...monthlyLost, 1);
          const hNew = (n / maxVal) * 100;
          const hLost = (monthlyLost[i] / maxVal) * 100;
          const m = (A.lang==='tr' ? ['O','Ş','M','N','M','H','T','A','E','E','K','A'] : ['J','F','M','A','M','J','J','A','S','O','N','D'])[i];
          return `<div style="flex:1;text-align:center">
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;height:100px;justify-content:flex-end">
              <div style="width:60%;background:#00e5b0;height:${hNew}%;border-radius:2px 2px 0 0;min-height:${n?2:0}px" title="${A.lang==='tr'?'Yeni':'New'}: ${n}"></div>
              <div style="width:60%;background:#ff4d6a;height:${hLost}%;border-radius:2px 2px 0 0;min-height:${monthlyLost[i]?2:0}px" title="${A.lang==='tr'?'Kayıp':'Lost'}: ${monthlyLost[i]}"></div>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">${m}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="row" style="gap:16px;justify-content:center;margin-top:8px;font-size:11px">
        <span><span style="display:inline-block;width:10px;height:10px;background:#00e5b0;border-radius:2px;margin-right:4px"></span>${A.lang==='tr'?'Yeni':'New'}</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#ff4d6a;border-radius:2px;margin-right:4px"></span>${A.lang==='tr'?'Kayıp':'Lost'}</span>
      </div>
    </div>` : ''}

    <!-- Top Users -->
    <div class="card" style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">👥 ${A.lang==='tr'?'En Aktif Kullanıcılar':'Most Active Users'}</div>
      ${topUsers.length === 0 ? `<div style="color:var(--text3);font-size:12px">${A.lang==='tr'?'Bu dönemde aktivite yok':'No activity in this period'}</div>` :
        topUsers.map(([name, count], i) => {
          const maxCount = topUsers[0][1];
          const pct = ((count / maxCount) * 100).toFixed(0);
          return `<div style="margin-bottom:6px">
            <div class="row" style="justify-content:space-between;font-size:12px"><span>${i+1}. ${name}</span><span>${count}</span></div>
            <div style="height:4px;background:var(--bg2);border-radius:2px;margin-top:3px"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px"></div></div>
          </div>`;
        }).join('')}
    </div>
    </div>`;

  // Store for export
  wrap._reportData = { stocks, newStocks, lostStocks, chems, newChems, elns: newElns, tasks, orders, periodLogs, topUsers, dateFrom, dateTo, lossRate };
}

window.exportReportExcel = () => {
  const wrap = document.getElementById('reportContent');
  const d = wrap?._reportData;
  if (!d) return;
  const data = [
    { Metric: 'Total Stocks', Value: d.stocks.length },
    { Metric: 'New Stocks', Value: d.newStocks.length },
    { Metric: 'Lost Stocks', Value: d.lostStocks.length },
    { Metric: 'Loss Rate', Value: d.lossRate + '%' },
    { Metric: 'Chemicals', Value: d.chems.length },
    { Metric: 'ELN Entries', Value: d.elns.length },
    { Metric: 'Tasks', Value: d.tasks.length },
    { Metric: 'Activities', Value: d.periodLogs.length },
    { Metric: 'Period', Value: `${d.dateFrom} to ${d.dateTo}` },
    ...d.topUsers.map(([name, count]) => ({ Metric: `User: ${name}`, Value: count })),
  ];
  exportToExcel(data, 'FEGLIMS_Report');
};

window.exportReportPDF = () => {
  const printArea = document.getElementById('reportPrintArea');
  if (!printArea) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>FEGLIMS Report</title>
    <style>body{font-family:sans-serif;padding:20px;color:#333}
    .card{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:12px}
    .row{display:flex;align-items:center}.fl{font-weight:600;font-size:12px;color:#666}
    </style></head><body>
    <h1>FEGLIMS Lab Report</h1>
    <p>Lab: ${A.userData.labName || ''} | Generated: ${new Date().toLocaleDateString()}</p>
    ${printArea.innerHTML}
    </body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
};
