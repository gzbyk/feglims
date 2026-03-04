// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — calendar.js
//  Advanced calendar with Google sync
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  auditLog, fmtDate, todayISO
} from './firebase.js';

const A = window.APP;

let calYear, calMonth, calEvents = [], calViewMode = 'month';
const EVENT_TYPES = {
  stock_transfer:  { icon: '🔬', color: '#00e5b0', label: { tr: 'Stok Transferi', en: 'Stock Transfer' } },
  parent_removal:  { icon: '🪰', color: '#ffb545', label: { tr: 'Ergin Atımı', en: 'Parent Removal' } },
  task:            { icon: '📋', color: '#3d9eff', label: { tr: 'Görev', en: 'Task' } },
  meeting:         { icon: '👥', color: '#a78bfa', label: { tr: 'Toplantı', en: 'Meeting' } },
  deadline:        { icon: '⏰', color: '#ff4d6a', label: { tr: 'Son Tarih', en: 'Deadline' } },
  experiment:      { icon: '🧪', color: '#f59e0b', label: { tr: 'Deney', en: 'Experiment' } },
  other:           { icon: '📌', color: '#6b90b0', label: { tr: 'Diğer', en: 'Other' } },
};

export function renderCalendar() {
  const now = new Date();
  calYear = calYear || now.getFullYear();
  calMonth = calMonth !== undefined ? calMonth : now.getMonth();

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center">
      <div class="row" style="gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="calPrev()">◀</button>
        <span id="calTitle" style="font-size:16px;font-weight:700;min-width:160px;text-align:center"></span>
        <button class="btn btn-ghost btn-sm" onclick="calNext()">▶</button>
        <button class="btn btn-ghost btn-sm" onclick="calToday()">${A.lang==='tr'?'Bugün':'Today'}</button>
      </div>
      <div class="row" style="gap:8px">
        <div class="tabs" style="margin:0">
          <div class="tab ${calViewMode==='month'?'active':''}" onclick="calSetView('month')">📅 ${A.lang==='tr'?'Ay':'Month'}</div>
          <div class="tab ${calViewMode==='week'?'active':''}" onclick="calSetView('week')">📆 ${A.lang==='tr'?'Hafta':'Week'}</div>
          <div class="tab ${calViewMode==='list'?'active':''}" onclick="calSetView('list')">📋 ${A.lang==='tr'?'Liste':'List'}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAddEvent()">
          ＋ ${A.lang==='tr'?'Etkinlik':'Event'}
        </button>
      </div>
    </div>
    <div id="calendarBody"></div>`;

  loadCalendarEvents();
}

window.calPrev = () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  refreshCalendar();
};

window.calNext = () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  refreshCalendar();
};

window.calToday = () => {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  refreshCalendar();
};

window.calSetView = (mode) => {
  calViewMode = mode;
  renderCalendar();
};

function loadCalendarEvents() {
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 2, 0);
  const startTs = Timestamp.fromDate(new Date(calYear, calMonth - 1, 1));
  const endTs = Timestamp.fromDate(lastDay);

  // Personal + lab events
  let q = query(collection(db, 'events'),
    where('labId', '==', A.userData.labId),
    orderBy('eventDate'));

  const unsub = onSnapshot(q, snap => {
    calEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Also add auto-generated stock events
    loadStockEvents();
  });
  A.unsubs.push(unsub);
}

async function loadStockEvents() {
  const now = new Date();
  const monthStart = new Date(calYear, calMonth, 1).toISOString().split('T')[0];
  const monthEnd = new Date(calYear, calMonth + 1, 0).toISOString().split('T')[0];

  const snap = await getDocs(query(collection(db, 'stocks'),
    where('labId', '==', A.userData.labId)));

  const stockEvents = [];
  snap.docs.forEach(d => {
    const s = { id: d.id, ...d.data() };
    if (s.status === 'Lost') return;

    if (s.removalDate >= monthStart && s.removalDate <= monthEnd) {
      stockEvents.push({
        id: `rem_${s.id}`, type: 'parent_removal',
        title: `${s.stockCode} — ${A.lang==='tr'?'Ergin Atımı':'Parent Removal'}`,
        eventDate: s.removalDate,
        allDay: true, auto: true,
        responsible: s.responsible,
        responsibleUid: s.responsibleUid,
      });
    }
    if (s.nextTransferDate >= monthStart && s.nextTransferDate <= monthEnd) {
      stockEvents.push({
        id: `tr_${s.id}`, type: 'stock_transfer',
        title: `${s.stockCode} — ${A.lang==='tr'?'Transfer':'Transfer'}`,
        eventDate: s.nextTransferDate,
        allDay: true, auto: true,
        responsible: s.responsible,
        responsibleUid: s.responsibleUid,
      });
    }
  });

  // Merge with manual events
  const allEvents = [...calEvents, ...stockEvents];
  refreshCalendarView(allEvents);
}

function refreshCalendarView(events) {
  const title = document.getElementById('calTitle');
  if (title) {
    const months_tr = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const months_en = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const months = A.lang === 'tr' ? months_tr : months_en;
    title.textContent = `${months[calMonth]} ${calYear}`;
  }

  const body = document.getElementById('calendarBody');
  if (!body) return;

  if (calViewMode === 'list') {
    renderListView(body, events);
  } else if (calViewMode === 'week') {
    renderWeekView(body, events);
  } else {
    renderMonthView(body, events);
  }
}

function refreshCalendar() {
  loadCalendarEvents();
}

function renderMonthView(body, events) {
  const today = todayISO();
  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Monday start
  const days_tr = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const days_en = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const days = A.lang === 'tr' ? days_tr : days_en;

  // Build event map
  const evMap = {};
  events.forEach(e => {
    const d = e.eventDate;
    if (!evMap[d]) evMap[d] = [];
    evMap[d].push(e);
  });

  let html = `<div class="cal-grid">
    ${days.map(d => `<div class="cal-head">${d}</div>`).join('')}`;

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) html += `<div class="cal-cell cal-empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = dateStr === today;
    const dayEvents = evMap[dateStr] || [];
    const maxShow = 3;

    html += `<div class="cal-cell ${isToday?'cal-today':''}" onclick="calDayClick('${dateStr}')">
      <div class="cal-day-num ${isToday?'cal-today-num':''}">${day}</div>
      ${dayEvents.slice(0, maxShow).map(e => {
        const t = EVENT_TYPES[e.type] || EVENT_TYPES.other;
        const myEvent = e.responsibleUid === A.user.uid || e.createdBy === A.user.uid;
        return `<div class="cal-event ${myEvent?'cal-event-mine':''}" 
          style="background:${t.color}22;border-left:2px solid ${t.color};color:${t.color}"
          onclick="event.stopPropagation();openEventDetail('${e.id}')"
          title="${e.title}">
          ${t.icon} ${e.title.slice(0, 20)}${e.title.length > 20 ? '…' : ''}
        </div>`;
      }).join('')}
      ${dayEvents.length > maxShow ? `<div class="cal-more" onclick="event.stopPropagation();calDayClick('${dateStr}')">+${dayEvents.length - maxShow} ${A.lang==='tr'?'daha':'more'}</div>` : ''}
    </div>`;
  }

  // Fill remaining
  const totalCells = startDow + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) html += `<div class="cal-cell cal-empty"></div>`;

  html += '</div>';
  body.innerHTML = html;
}

function renderListView(body, events) {
  const monthEvents = events.filter(e => {
    const d = e.eventDate || '';
    const prefix = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
    return d.startsWith(prefix);
  }).sort((a, b) => a.eventDate > b.eventDate ? 1 : -1);

  if (monthEvents.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">${A.lang==='tr'?'Bu ay etkinlik yok.':'No events this month.'}</div></div>`;
    return;
  }

  body.innerHTML = monthEvents.map(e => {
    const t = EVENT_TYPES[e.type] || EVENT_TYPES.other;
    const typeLabel = t.label[A.lang] || t.label.tr;
    return `<div class="log-entry" style="cursor:pointer" onclick="openEventDetail('${e.id}')">
      <div class="log-icon" style="background:${t.color}22;color:${t.color};font-size:18px">${t.icon}</div>
      <div class="log-body">
        <div class="log-action">${e.title}</div>
        <div class="log-detail">${typeLabel} · ${e.responsible || '—'} ${e.description ? '· ' + e.description.slice(0,60) : ''}</div>
      </div>
      <div class="log-time">${fmtDate(e.eventDate, A.lang)}</div>
    </div>`;
  }).join('');
}

function renderWeekView(body, events) {
  // Get current week's Mon-Sun
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(calYear, calMonth, 1);
  // Simplified - show first week of the month
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(calYear, calMonth, 1 + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }
  const days_tr = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
  const days_en = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const days = A.lang === 'tr' ? days_tr : days_en;
  const todayStr = todayISO();

  body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
    ${weekDates.map((date, i) => {
      const dayEvs = events.filter(e => e.eventDate === date);
      const isToday = date === todayStr;
      return `<div class="card" style="min-height:120px;${isToday?'border-color:var(--accent)':''}">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:${isToday?'var(--accent)':'var(--text2)'}">${days[i].slice(0,3)} ${parseInt(date.split('-')[2])}</div>
        ${dayEvs.map(e => {
          const t = EVENT_TYPES[e.type] || EVENT_TYPES.other;
          return `<div style="font-size:11px;padding:3px 6px;border-radius:4px;margin-bottom:4px;background:${t.color}22;color:${t.color};cursor:pointer" onclick="openEventDetail('${e.id}')">${t.icon} ${e.title.slice(0,16)}</div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

window.calDayClick = (dateStr) => {
  // Pre-fill date and open add event modal
  document.getElementById('evf_date').value = dateStr;
  document.getElementById('evf_title').value = '';
  document.getElementById('evf_type').value = 'other';
  document.getElementById('evf_desc').value = '';
  document.getElementById('evf_time').value = '';
  document.getElementById('evf_evId').value = '';
  openOverlay('eventModal');
};

window.openAddEvent = () => {
  document.getElementById('evf_date').value = todayISO();
  document.getElementById('evf_title').value = '';
  document.getElementById('evf_type').value = 'other';
  document.getElementById('evf_desc').value = '';
  document.getElementById('evf_time').value = '';
  document.getElementById('evf_evId').value = '';
  // Populate responsible dropdown
  loadEventResponsible();
  openOverlay('eventModal');
};

async function loadEventResponsible() {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.role !== 'pending');
  const sel = document.getElementById('evf_resp');
  if (!sel) return;
  sel.innerHTML = `<option value="${A.user.uid}|${A.userData.name}">${A.userData.name} (${A.lang==='tr'?'Ben':'Me'})</option>` +
    users.filter(u => u.uid !== A.user.uid).map(u =>
      `<option value="${u.uid}|${u.name}">${u.name}</option>`
    ).join('');
}

window.saveEvent = async () => {
  const title = document.getElementById('evf_title').value.trim();
  const eventDate = document.getElementById('evf_date').value;
  if (!title || !eventDate) { toast(window.t('required'), 'err'); return; }

  const respVal = document.getElementById('evf_resp')?.value || `${A.user.uid}|${A.userData.name}`;
  const [respUid, respName] = respVal.split('|');
  const id = document.getElementById('evf_evId').value;

  const data = {
    title,
    eventDate,
    type: document.getElementById('evf_type').value,
    description: document.getElementById('evf_desc').value.trim(),
    time: document.getElementById('evf_time').value,
    responsible: respName,
    responsibleUid: respUid,
    createdBy: A.user.uid,
    createdByName: A.userData.name,
    labId: A.userData.labId,
    updatedAt: Timestamp.now(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'events', id), data);
    } else {
      data.createdAt = Timestamp.now();
      await addDoc(collection(db, 'events'), data);
      await auditLog('ADD_EVENT', `Added event: ${title} on ${eventDate}`, A.user.uid, A.userData.name, A.userData.labId);
    }
    closeOverlay('eventModal');
    toast(window.t('saved'), 'ok');
    loadCalendarEvents();
  } catch (e) { toast(window.t('saveErr'), 'err'); }
};

window.openEventDetail = async (id) => {
  // Auto events (stock-based)
  if (id.startsWith('rem_') || id.startsWith('tr_')) {
    const stockId = id.replace(/^(rem_|tr_)/, '');
    const snap = await getDoc(doc(db, 'stocks', stockId));
    if (!snap.exists()) return;
    const s = snap.data();
    const isRem = id.startsWith('rem_');
    document.getElementById('eventDetailBody').innerHTML = `
      <div class="row" style="gap:12px;align-items:center;margin-bottom:16px">
        <div style="font-size:32px">${isRem?'🪰':'🔬'}</div>
        <div>
          <div style="font-size:16px;font-weight:700">${isRem?(A.lang==='tr'?'Ergin Atımı':'Parent Removal'):(A.lang==='tr'?'Stok Transferi':'Stock Transfer')}</div>
          <div class="accent-cell">${s.stockCode}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${[
          [A.lang==='tr'?'Tarih':'Date', isRem?s.removalDate:s.nextTransferDate],
          [A.lang==='tr'?'Sorumlu':'Responsible', s.responsible],
          [A.lang==='tr'?'Sıcaklık':'Temperature', `${s.climate}°C`],
          [A.lang==='tr'?'Durum':'Status', s.status],
        ].map(([l,v]) => `<div><div class="fl">${l}</div><div class="dim-cell" style="margin-top:4px">${v||'—'}</div></div>`).join('')}
      </div>`;
    openOverlay('eventDetailModal');
    return;
  }

  const snap = await getDoc(doc(db, 'events', id));
  if (!snap.exists()) return;
  const e = snap.data();
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.other;
  const isOwner = e.createdBy === A.user.uid || A.userData.role === 'admin';

  document.getElementById('eventDetailBody').innerHTML = `
    <div class="row" style="gap:12px;align-items:center;margin-bottom:16px">
      <div style="font-size:32px">${t.icon}</div>
      <div>
        <div style="font-size:16px;font-weight:700">${e.title}</div>
        <div style="font-size:12px;color:${t.color}">${t.label[A.lang]}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[
        [A.lang==='tr'?'Tarih':'Date', fmtDate(e.eventDate, A.lang)],
        [A.lang==='tr'?'Saat':'Time', e.time || '—'],
        [A.lang==='tr'?'Sorumlu':'Responsible', e.responsible || '—'],
        [A.lang==='tr'?'Oluşturan':'Created by', e.createdByName || '—'],
      ].map(([l,v]) => `<div><div class="fl">${l}</div><div class="dim-cell" style="margin-top:4px">${v}</div></div>`).join('')}
      ${e.description ? `<div style="grid-column:1/-1"><div class="fl">${A.lang==='tr'?'Açıklama':'Description'}</div><div style="margin-top:4px;font-size:13px;color:var(--text2)">${e.description}</div></div>` : ''}
    </div>
    ${isOwner ? `<div class="row" style="gap:8px;margin-top:20px">
      <button class="btn btn-secondary btn-sm" onclick="editEventFromDetail('${id}')">✏ ${A.lang==='tr'?'Düzenle':'Edit'}</button>
      <button class="btn btn-red btn-sm" onclick="deleteEvent('${id}')">🗑 ${A.lang==='tr'?'Sil':'Delete'}</button>
    </div>` : ''}`;
  openOverlay('eventDetailModal');
};

window.editEventFromDetail = async (id) => {
  closeOverlay('eventDetailModal');
  const snap = await getDoc(doc(db, 'events', id));
  if (!snap.exists()) return;
  const e = snap.data();
  document.getElementById('evf_evId').value = id;
  document.getElementById('evf_title').value = e.title;
  document.getElementById('evf_date').value = e.eventDate;
  document.getElementById('evf_type').value = e.type;
  document.getElementById('evf_desc').value = e.description || '';
  document.getElementById('evf_time').value = e.time || '';
  await loadEventResponsible();
  document.getElementById('evf_resp').value = `${e.responsibleUid}|${e.responsible}`;
  openOverlay('eventModal');
};

window.deleteEvent = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Etkinlik silinsin mi?' : 'Delete this event?')) return;
  await deleteDoc(doc(db, 'events', id));
  await auditLog('DELETE_EVENT', `Deleted event ${id}`, A.user.uid, A.userData.name, A.userData.labId);
  closeOverlay('eventDetailModal');
  toast(window.t('deleted'), 'info');
  loadCalendarEvents();
};

// Export EVENT_TYPES for use in labwork.js
export { EVENT_TYPES };
