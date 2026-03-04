// ═══════════════════════════════════════════
//  FEGLIMS v3.0 — labwork.js
// ═══════════════════════════════════════════
import {
  db, collection, doc, addDoc, getDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, getDocs, Timestamp,
  sendEmail, auditLog, fmtDate, fmtDateTime, todayISO,
  hasPermission, arrayUnion, ROLES
} from './firebase.js';

import { createElnFromTask } from './eln.js';

const A = window.APP;

const PRIORITIES = {
  low:    { label: { tr: 'Düşük', en: 'Low' },    color: 'var(--text3)' },
  medium: { label: { tr: 'Orta', en: 'Medium' },  color: 'var(--blue)' },
  high:   { label: { tr: 'Yüksek', en: 'High' },  color: 'var(--amber)' },
  urgent: { label: { tr: 'Acil', en: 'Urgent' },  color: 'var(--red)' },
};
const STATUSES = {
  pending:     { label: { tr: 'Bekliyor', en: 'Pending' },          cls: 'b-pending' },
  inprogress:  { label: { tr: 'Devam Ediyor', en: 'In Progress' },  cls: 'b-open' },
  completed:   { label: { tr: 'Tamamlandı', en: 'Completed' },      cls: 'b-active' },
  cancelled:   { label: { tr: 'İptal', en: 'Cancelled' },           cls: 'b-lost' },
};

export function renderLabWork() {
  const content = document.getElementById('content');
  const isAdmin = A.userData.role === 'admin';
  const canAssign = hasPermission(A.userData, 'assignTasks');

  content.innerHTML = `
    <div class="row" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div class="tabs" style="margin:0">
        ${A.userData.role !== 'pi' ? `<div class="tab active" id="lw-tab-mine" onclick="lwTab('mine')">
          👤 ${A.lang==='tr'?'Benim Görevlerim':'My Tasks'}
        </div>` : ''}
        ${canAssign ? `<div class="tab ${A.userData.role==='pi'?'active':''}" id="lw-tab-all" onclick="lwTab('all')">
          📋 ${A.lang==='tr'?'Tüm Görevler':'All Tasks'}
        </div>` : ''}
      </div>
      <div class="row" style="gap:8px">
        <select class="fc" id="lwFilterStatus" style="width:160px" onchange="loadLabWork()">
          <option value="">${A.lang==='tr'?'Tüm Durumlar':'All Statuses'}</option>
          ${Object.entries(STATUSES).map(([k, v]) =>
            `<option value="${k}">${v.label[A.lang]}</option>`
          ).join('')}
        </select>
        <select class="fc" id="lwFilterPriority" style="width:140px" onchange="loadLabWork()">
          <option value="">${A.lang==='tr'?'Tüm Öncelikler':'All Priorities'}</option>
          ${Object.entries(PRIORITIES).map(([k, v]) =>
            `<option value="${k}">${v.label[A.lang]}</option>`
          ).join('')}
        </select>
        ${canAssign ? `<button class="btn btn-primary" onclick="openAddTask()">
          ＋ ${A.lang==='tr'?'Görev Ata':'Assign Task'}
        </button>` : ''}
      </div>
    </div>
    <div id="labWorkWrap"></div>`;

  loadLabWork(A.userData.role !== 'pi' ? 'mine' : 'all');
}

let lwCurrentTab = 'mine';

window.lwTab = (t) => {
  lwCurrentTab = t;
  ['mine', 'all'].forEach(k => {
    document.getElementById(`lw-tab-${k}`)?.classList.toggle('active', k === t);
  });
  loadLabWork(t);
};

window.loadLabWork = (tab) => {
  tab = tab || lwCurrentTab;
  const statusFilter = document.getElementById('lwFilterStatus')?.value || '';
  const prioFilter = document.getElementById('lwFilterPriority')?.value || '';

  let q;
  const canAssign = hasPermission(A.userData, 'assignTasks');

  if (tab === 'mine' && !canAssign) {
    q = query(collection(db, 'tasks'),
      where('assignedToUid', '==', A.user.uid),
      orderBy('createdAt', 'desc'));
  } else if (tab === 'all' || canAssign) {
    q = query(collection(db, 'tasks'),
      where('labId', '==', A.userData.labId),
      orderBy('createdAt', 'desc'));
  } else {
    q = query(collection(db, 'tasks'),
      where('assignedToUid', '==', A.user.uid),
      orderBy('createdAt', 'desc'));
  }

  const unsub = onSnapshot(q, snap => {
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (statusFilter) tasks = tasks.filter(t => t.status === statusFilter);
    if (prioFilter) tasks = tasks.filter(t => t.priority === prioFilter);

    const el = document.getElementById('labWorkWrap');
    if (!el) return;
    if (tasks.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${window.t('noData')}</div></div>`;
      return;
    }

    const isAdmin = A.userData.role === 'admin';
    const canAssign = hasPermission(A.userData, 'assignTasks');

    el.innerHTML = tasks.map(task => {
      const prio = PRIORITIES[task.priority] || PRIORITIES.medium;
      const stat = STATUSES[task.status] || STATUSES.pending;
      const isOverdue = task.dueDate && task.dueDate < todayISO() && task.status !== 'completed' && task.status !== 'cancelled';
      const isAssigned = task.assignedToUid === A.user.uid;

      return `<div class="card" style="margin-bottom:10px;${isOverdue?'border-color:var(--red)':''}" onclick="openTaskDetail('${task.id}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <span style="font-weight:700;font-size:14px">${task.title}</span>
              <span class="badge ${stat.cls}">${stat.label[A.lang]}</span>
              <span class="badge" style="background:${prio.color}22;color:${prio.color}">
                ${prio.label[A.lang]}
              </span>
              ${isOverdue ? `<span class="badge b-lost">⚠ ${A.lang==='tr'?'Gecikmiş':'Overdue'}</span>` : ''}
            </div>
            <div class="dim-cell" style="font-size:12px">
              ${A.lang==='tr'?'Sorumlu':'Assigned'}: <strong>${task.assignedToName || '—'}</strong>
              ${task.dueDate ? ` · ${A.lang==='tr'?'Tarih':'Due'}: ${fmtDate(task.dueDate, A.lang)}` : ''}
              ${task.linkedStock ? ` · 🔬 ${task.linkedStock}` : ''}
            </div>
            ${task.description ? `<div style="font-size:13px;color:var(--text2);margin-top:6px;line-height:1.5">${task.description.slice(0, 120)}${task.description.length > 120 ? '…' : ''}</div>` : ''}
          </div>
          <div class="row" style="gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
            ${isAssigned && task.status !== 'completed' ? `
              <button class="btn btn-primary btn-xs" onclick="completeTask('${task.id}','${task.title}')">
                ✅ ${A.lang==='tr'?'Tamamla':'Complete'}
              </button>` : ''}
            ${canAssign ? `<button class="btn btn-secondary btn-xs" onclick="openEditTask('${task.id}')">✏</button>` : ''}
            ${isAdmin ? `<button class="btn btn-red btn-xs" onclick="deleteTask('${task.id}')">🗑</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  });
  A.unsubs.push(unsub);
};

window.openAddTask = async () => {
  document.getElementById('tf_taskId').value = '';
  document.getElementById('tf_title').value = '';
  document.getElementById('tf_desc').value = '';
  document.getElementById('tf_due').value = '';
  document.getElementById('tf_priority').value = 'medium';
  document.getElementById('tf_linkedStock').value = '';
  await loadTaskAssigneeDropdown();
  document.getElementById('taskModalTitle').textContent = A.lang === 'tr' ? 'Görev Ata' : 'Assign Task';
  openOverlay('taskModal');
};

window.openEditTask = async (id) => {
  const snap = await getDoc(doc(db, 'tasks', id));
  if (!snap.exists()) return;
  const task = snap.data();
  document.getElementById('tf_taskId').value = id;
  document.getElementById('tf_title').value = task.title;
  document.getElementById('tf_desc').value = task.description || '';
  document.getElementById('tf_due').value = task.dueDate || '';
  document.getElementById('tf_priority').value = task.priority || 'medium';
  document.getElementById('tf_linkedStock').value = task.linkedStock || '';
  await loadTaskAssigneeDropdown(task.assignedToUid);
  document.getElementById('taskModalTitle').textContent = A.lang === 'tr' ? 'Görevi Düzenle' : 'Edit Task';
  openOverlay('taskModal');
};

async function loadTaskAssigneeDropdown(selectedUid) {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role !== 'pending' && u.labId === A.userData.labId);
  const sel = document.getElementById('tf_assignee');
  if (!sel) return;
  sel.innerHTML = users.map(u =>
    `<option value="${u.uid}|${u.name}|${u.email||''}" ${u.uid === selectedUid ? 'selected' : ''}>${u.name} (${window.t('r'+window.capitalize(u.role))})</option>`
  ).join('');
}

window.saveTask = async () => {
  const title = document.getElementById('tf_title').value.trim();
  if (!title) { toast(window.t('required'), 'err'); return; }

  const assigneeVal = document.getElementById('tf_assignee').value;
  const [uid, name, email] = assigneeVal.split('|');
  const id = document.getElementById('tf_taskId').value;

  const data = {
    title,
    description: document.getElementById('tf_desc').value.trim(),
    dueDate: document.getElementById('tf_due').value || null,
    priority: document.getElementById('tf_priority').value,
    linkedStock: document.getElementById('tf_linkedStock').value.trim(),
    assignedToUid: uid,
    assignedToName: name,
    assignedToEmail: email,
    assignedBy: A.userData.name,
    assignedByUid: A.user.uid,
    labId: A.userData.labId,
    updatedAt: Timestamp.now(),
  };

  try {
    if (id) {
      data.history = arrayUnion({ action: 'edited', by: A.userData.name, byUid: A.user.uid, at: new Date().toISOString() });
      await updateDoc(doc(db, 'tasks', id), data);
      await auditLog('EDIT_TASK', `Edited task: ${title} → ${name}`, A.user.uid, A.userData.name, A.userData.labId);
    } else {
      data.status = 'pending';
      data.createdAt = Timestamp.now();
      data.history = [{ action: 'created', by: A.userData.name, byUid: A.user.uid, at: new Date().toISOString() }];
      const docRef = await addDoc(collection(db, 'tasks'), data);

      // Send email notification
      if (email) {
        await sendEmail({
          to_email: email,
          to_name: name,
          subject: A.lang === 'tr' ? `Yeni Görev: ${title}` : `New Task: ${title}`,
          message: A.lang === 'tr'
            ? `${A.userData.name} size yeni bir görev atadı:\n\n📋 ${title}\n\n${data.description ? 'Açıklama: ' + data.description + '\n' : ''}${data.dueDate ? 'Son Tarih: ' + fmtDate(data.dueDate, 'tr') + '\n' : ''}Öncelik: ${PRIORITIES[data.priority]?.label.tr || ''}\n\nFEGLIMS üzerinden görevi görüntüleyebilirsiniz.`
            : `${A.userData.name} assigned you a new task:\n\n📋 ${title}\n\n${data.description ? 'Description: ' + data.description + '\n' : ''}${data.dueDate ? 'Due: ' + fmtDate(data.dueDate, 'en') + '\n' : ''}Priority: ${PRIORITIES[data.priority]?.label.en || ''}\n\nView the task in FEGLIMS.`,
          lab_name: A.userData.labName,
        });
      }

      // Create calendar event
      await addDoc(collection(db, 'events'), {
        title: `📋 ${title}`,
        eventDate: data.dueDate || todayISO(),
        type: 'task',
        description: data.description,
        responsible: name,
        responsibleUid: uid,
        createdBy: A.user.uid,
        createdByName: A.userData.name,
        labId: A.userData.labId,
        linkedTaskId: docRef.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await auditLog('ADD_TASK', `Assigned task: ${title} → ${name}`, A.user.uid, A.userData.name, A.userData.labId);
    }
    closeOverlay('taskModal');
    toast(window.t('saved'), 'ok');
  } catch (e) { toast(window.t('saveErr') + ' ' + e.message, 'err'); }
};

window.completeTask = async (id, title) => {
  if (!confirm(A.lang === 'tr' ? 'Görev tamamlandı olarak işaretlensin mi?' : 'Mark task as completed?')) return;
  
  // Add history entry
  const historyEntry = {
    action: 'completed',
    by: A.userData.name,
    byUid: A.user.uid,
    at: new Date().toISOString()
  };
  
  await updateDoc(doc(db, 'tasks', id), {
    status: 'completed',
    completedAt: Timestamp.now(),
    completedBy: A.userData.name,
    completedByUid: A.user.uid,
    updatedAt: Timestamp.now(),
    history: arrayUnion(historyEntry)
  });

  // Notify the assigner
  const snap = await getDoc(doc(db, 'tasks', id));
  if (snap.exists()) {
    const task = snap.data();
    
    // In-app notification to assigner
    await addDoc(collection(db, 'notifications'), {
      type: 'TASK_COMPLETED',
      title: A.lang==='tr' ? `Görev tamamlandı: ${title}` : `Task completed: ${title}`,
      message: `${A.userData.name} ${A.lang==='tr'?'görevi tamamladı':'completed the task'}`,
      targetUid: task.assignedByUid,
      labId: A.userData.labId,
      read: false,
      createdAt: Timestamp.now()
    });

    // Email to assigner
    if (task.assignedByUid !== A.user.uid) {
      // Find assigner email
      const assignerSnap = await getDoc(doc(db, 'users', task.assignedByUid));
      const assignerEmail = assignerSnap.data()?.email;
      if (assignerEmail) {
        await sendEmail({
          to_email: assignerEmail, to_name: task.assignedBy,
          subject: A.lang==='tr' ? `✅ Görev Tamamlandı: ${title}` : `✅ Task Completed: ${title}`,
          message: A.lang==='tr'
            ? `${A.userData.name} şu görevi tamamladı:\n\n📋 ${title}\n\nFEGLIMS üzerinden detayları görüntüleyebilirsiniz.`
            : `${A.userData.name} completed the following task:\n\n📋 ${title}\n\nView details in FEGLIMS.`,
          lab_name: A.userData.labName,
        });
      }
    }
    
    // Auto create ELN entry
    await createElnFromTask({ id, title, ...task });
  }

  await auditLog('COMPLETE_TASK', `Completed task: ${title}`, A.user.uid, A.userData.name, A.userData.labId);
  toast(A.lang === 'tr' ? 'Görev tamamlandı. ELN kaydı oluşturuldu.' : 'Task completed. ELN entry created.', 'ok');
};

window.openTaskDetail = async (id) => {
  const snap = await getDoc(doc(db, 'tasks', id));
  if (!snap.exists()) return;
  const task = snap.data();
  const prio = PRIORITIES[task.priority] || PRIORITIES.medium;
  const stat = STATUSES[task.status] || STATUSES.pending;
  const isOverdue = task.dueDate && task.dueDate < todayISO() && task.status !== 'completed';

  document.getElementById('taskDetailBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <span class="badge ${stat.cls}">${stat.label[A.lang]}</span>
      <span class="badge" style="background:${prio.color}22;color:${prio.color}">${prio.label[A.lang]}</span>
      ${isOverdue ? `<span class="badge b-lost">⚠ ${A.lang==='tr'?'Gecikmiş':'Overdue'}</span>` : ''}
    </div>
    <div style="font-size:16px;font-weight:700;margin-bottom:16px">${task.title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[
        [A.lang==='tr'?'Sorumlu':'Assigned to', task.assignedToName],
        [A.lang==='tr'?'Atayan':'Assigned by', task.assignedBy],
        [A.lang==='tr'?'Son Tarih':'Due Date', task.dueDate ? fmtDate(task.dueDate, A.lang) : '—'],
        [A.lang==='tr'?'Bağlı Stok':'Linked Stock', task.linkedStock || '—'],
        ...(task.status === 'completed' ? [
          [A.lang==='tr'?'Tamamlayan':'Completed by', task.completedBy || '—'],
        ] : []),
      ].map(([l, v]) => `<div><div class="fl">${l}</div><div class="dim-cell" style="margin-top:4px">${v || '—'}</div></div>`).join('')}
      ${task.description ? `<div style="grid-column:1/-1"><div class="fl">${A.lang==='tr'?'Açıklama':'Description'}</div>
        <div style="margin-top:4px;font-size:13px;color:var(--text2);white-space:pre-wrap">${task.description}</div></div>` : ''}
    </div>
    ${(task.history && task.history.length > 0) ? `
      <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px">
        <div class="card-title" style="margin-bottom:8px">📜 ${A.lang==='tr'?'Görev Geçmişi':'Task History'}</div>
        ${task.history.map(h => {
          const actionMap = { created: '🆕', completed: '✅', edited: '✏', status_change: '⟳' };
          const labelMap = { created: A.lang==='tr'?'Oluşturuldu':'Created', completed: A.lang==='tr'?'Tamamlandı':'Completed', edited: A.lang==='tr'?'Düzenlendi':'Edited', status_change: A.lang==='tr'?'Durum Değişti':'Status Changed' };
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <span>${actionMap[h.action]||'•'}</span>
            <span class="fw-bold">${labelMap[h.action]||h.action}</span>
            <span class="dim-cell">— ${h.by}</span>
            <span class="dim-cell" style="margin-left:auto">${h.at?.split('T')[0]||'—'}</span>
          </div>`;
        }).join('')}
      </div>` : ''}`;
  openOverlay('taskDetailModal');
};

window.deleteTask = async (id) => {
  if (!confirm(A.lang === 'tr' ? 'Görev silinsin mi?' : 'Delete this task?')) return;
  const snap = await getDoc(doc(db, 'tasks', id));
  await auditLog('DELETE', `Deleted task: ${snap.data()?.title}`, A.user.uid, A.userData.name, A.userData.labId);
  await deleteDoc(doc(db, 'tasks', id));
  toast(window.t('deleted'), 'info');
};
