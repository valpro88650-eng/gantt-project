let client = null;
let currentProjectId = null;

function getSupabaseClient() {
  if (client) return client;

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    client = supabaseClient;
    return client;
  }

  const url = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : window.SUPABASE_URL;
  const key = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : window.SUPABASE_KEY;

  if (!url || !key) {
    console.error("Clés Supabase manquantes dans config.js");
    return null;
  }

  if (typeof supabase === 'undefined') {
    console.error("Bibliothèque Supabase non chargée");
    return null;
  }

  client = supabase.createClient(url, key);
  return client;
}

let currentTasks = [];
let currentTab = 'kanban';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProjects);
} else {
  loadProjects();
}

// --- GESTION DES PROJETS ---

async function loadProjects() {
  const select = document.getElementById('project-select');
  if (!select) return;

  const sb = getSupabaseClient();
  if (!sb) {
    select.innerHTML = '<option value="">Erreur : Fichier config.js non lu</option>';
    return;
  }

  try {
    const { data: projects, error } = await sb
      .from('projets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Erreur Supabase :", error);
      select.innerHTML = `<option value="">Erreur : ${error.message}</option>`;
      return;
    }

    select.innerHTML = '';

    if (!projects || projects.length === 0) {
      select.innerHTML = '<option value="">Aucun projet — Cliquez sur + Nouveau</option>';
      currentProjectId = null;
      currentTasks = [];
      renderAllViews();
      return;
    }

    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nom || p.name || 'Projet sans nom';
      select.appendChild(opt);
    });

    if (currentProjectId && projects.some(p => p.id === currentProjectId)) {
      select.value = currentProjectId;
    } else {
      select.value = projects[0].id;
      currentProjectId = projects[0].id;
    }

    loadTasks();
  } catch (err) {
    console.error("Exception lors du chargement :", err);
    select.innerHTML = `<option value="">Erreur script : ${err.message}</option>`;
  }
}

function onProjectChange() {
  const select = document.getElementById('project-select');
  currentProjectId = select.value;
  loadTasks();
}

let isEditingProject = false;

function openProjectModal(isEdit = false) {
  isEditingProject = isEdit;
  const modal = document.getElementById('modal-project');
  const input = document.getElementById('project-name');
  const title = document.getElementById('modal-project-title');
  const btnDelete = document.getElementById('btn-delete-project');

  if (!modal) return;

  if (isEdit) {
    const select = document.getElementById('project-select');
    if (!select || !select.value) {
      alert("Aucun projet sélectionné à modifier.");
      return;
    }
    const selectedOption = select.options[select.selectedIndex];
    if (input) input.value = selectedOption ? selectedOption.textContent : '';
    if (title) title.textContent = "Modifier le projet";
    if (btnDelete) btnDelete.classList.remove('hidden');
  } else {
    if (input) input.value = '';
    if (title) title.textContent = "Nouveau projet";
    if (btnDelete) btnDelete.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeProjectModal() {
  const modal = document.getElementById('modal-project');
  if (modal) modal.classList.add('hidden');
}

async function saveProject(e) {
  e.preventDefault();
  const nameInput = document.getElementById('project-name').value.trim();
  if (!nameInput) return;

  const sb = getSupabaseClient();
  if (!sb) return;

  let error, data;

  if (isEditingProject && currentProjectId) {
    ({ data, error } = await sb
      .from('projets')
      .update({ nom: nameInput })
      .eq('id', currentProjectId)
      .select());
  } else {
    ({ data, error } = await sb
      .from('projets')
      .insert([{ nom: nameInput }])
      .select());
  }

  if (error) {
    alert("Erreur enregistrement projet : " + error.message);
  } else {
    closeProjectModal();
    if (data && data.length > 0) {
      currentProjectId = data[0].id;
    }
    await loadProjects();
  }
}

async function deleteProject() {
  const select = document.getElementById('project-select');
  const projectId = select ? select.value : currentProjectId;

  if (!projectId) return;

  if (confirm("Voulez-vous vraiment supprimer ce projet et toutes ses tâches ?")) {
    const sb = getSupabaseClient();
    if (!sb) return;

    await sb.from('taches').delete().eq('projet_id', projectId);
    const { error } = await sb.from('projets').delete().eq('id', projectId);

    if (error) {
      alert("Erreur lors de la suppression du projet : " + error.message);
    } else {
      currentProjectId = null;
      closeProjectModal();
      await loadProjects();
    }
  }
}

// --- GESTION DES TÂCHES ---

async function loadTasks() {
  const projectId = document.getElementById('project-select').value;
  if (!projectId) {
    currentTasks = [];
    renderAllViews();
    return;
  }

  const sb = getSupabaseClient();
  if (!sb) return;

  const { data: tasks, error } = await sb
    .from('taches')
    .select('*')
    .eq('projet_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Erreur chargement tâches :", error);
    return;
  }

  currentTasks = tasks || [];
  renderAllViews();
}

// ROUTEUR D'AFFICHAGE
function renderAllViews() {
  renderKanbanView();
  renderListView();
  renderGanttView();
}

// NAVIGATION ENTRE VUES
function switchTab(tab) {
  currentTab = tab;
  
  const views = ['kanban', 'list', 'gantt'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`tab-${v}-btn`);
    if (!el || !btn) return;

    if (v === tab) {
      el.classList.remove('hidden');
      btn.className = "pb-3 text-sm font-semibold border-b-2 border-blue-600 text-blue-600";
    } else {
      el.classList.add('hidden');
      btn.className = "pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800";
    }
  });

  if (tab === 'gantt') {
    renderGanttView();
  }
}

// --- VUE KANBAN ---

function renderKanbanView() {
  const colTodo = document.getElementById('col-todo');
  const colDoing = document.getElementById('col-doing');
  const colDone = document.getElementById('col-done');

  if (!colTodo || !colDoing || !colDone) return;

  colTodo.innerHTML = '';
  colDoing.innerHTML = '';
  colDone.innerHTML = '';

  let countTodo = 0, countDoing = 0, countDone = 0;

  currentTasks.forEach(task => {
    const parentTask = currentTasks.find(t => t.id === task.parent_id);
    const parentLabel = parentTask 
      ? `<div class="text-[10px] font-semibold text-blue-600 mb-1 bg-blue-50 px-1.5 py-0.5 rounded inline-block">↳ ${parentTask.nom}</div>` 
      : '';

    const card = document.createElement('div');
    card.className = "bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer";
    card.onclick = () => openTaskModal(task.id);
    
    card.innerHTML = `
      ${parentLabel}
      <div class="font-semibold text-sm text-slate-800 mb-1">${task.nom}</div>
      <div class="text-xs text-slate-500 flex justify-between items-center mb-2">
        <span>👤 ${task.responsable || 'Non assigné'}</span>
        <span>📅 ${formatDate(task.date_fin)}</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${task.avancement || 0}%"></div>
      </div>
    `;

    if (task.statut === 'En cours') {
      colDoing.appendChild(card);
      countDoing++;
    } else if (task.statut === 'Terminé') {
      colDone.appendChild(card);
      countDone++;
    } else {
      colTodo.appendChild(card);
      countTodo++;
    }
  });

  document.getElementById('count-todo').textContent = countTodo;
  document.getElementById('count-doing').textContent = countDoing;
  document.getElementById('count-done').textContent = countDone;
}

// --- VUE LISTE ---

function renderListView() {
  const tbody = document.getElementById('list-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (currentTasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Aucune tâche enregistrée</td></tr>`;
    return;
  }

  currentTasks.forEach(task => {
    const parentTask = currentTasks.find(t => t.id === task.parent_id);
    const parentInfo = parentTask ? `<span class="text-xs text-slate-400 block">Sous-tâche de : ${parentTask.nom}</span>` : '';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="p-4 font-medium text-slate-900">
        ${task.nom}
        ${parentInfo}
      </td>
      <td class="p-4 text-slate-600">${task.responsable || '-'}</td>
      <td class="p-4 text-slate-600 text-xs">${formatDate(task.date_debut)} → ${formatDate(task.date_fin)}</td>
      <td class="p-4">
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(task.statut)}">
          ${task.statut}
        </span>
      </td>
      <td class="p-4">
        <div class="flex items-center gap-2">
          <div class="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div class="bg-blue-600 h-2 rounded-full" style="width: ${task.avancement || 0}%"></div>
          </div>
          <span class="text-xs text-slate-500 font-semibold">${task.avancement || 0}%</span>
        </div>
      </td>
      <td class="p-4 text-right">
        <button onclick="openTaskModal('${task.id}')" class="text-blue-600 hover:text-blue-800 text-xs font-semibold">Modifier</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- VUE GANTT PERSONNALISÉE ---

function parseDateSafe(str) {
  if (!str) return null;
  const clean = str.toString().split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

function renderGanttView() {
  const treeContainer = document.getElementById('gantt-task-tree');
  const headerContainer = document.getElementById('gantt-timeline-header');
  const bodyContainer = document.getElementById('gantt-timeline-body');

  if (!treeContainer || !headerContainer || !bodyContainer) return;

  treeContainer.innerHTML = '';
  headerContainer.innerHTML = '';
  bodyContainer.innerHTML = '';

  if (!currentTasks || currentTasks.length === 0) {
    treeContainer.innerHTML = `<div class="p-4 text-xs text-slate-400 italic">Aucune tâche</div>`;
    bodyContainer.innerHTML = `<div class="p-8 text-center text-slate-500 text-sm">Ce projet ne contient aucune tâche.</div>`;
    return;
  }

  // 1. Hiérarchie des tâches
  const orderedTasks = [];
  const visited = new Set();

  function addChildren(parentId, level) {
    if (level > 10) return;
    const children = currentTasks.filter(t => String(t.parent_id) === String(parentId));
    children.forEach(c => {
      if (!visited.has(c.id)) {
        visited.add(c.id);
        orderedTasks.push({ ...c, level });
        addChildren(c.id, level + 1);
      }
    });
  }

  const rootTasks = currentTasks.filter(t => !t.parent_id || !currentTasks.some(p => String(p.id) === String(t.parent_id)));
  rootTasks.forEach(r => {
    if (!visited.has(r.id)) {
      visited.add(r.id);
      orderedTasks.push({ ...r, level: 0 });
      addChildren(r.id, 1);
    }
  });

  currentTasks.forEach(t => {
    if (!visited.has(t.id)) {
      visited.add(t.id);
      orderedTasks.push({ ...t, level: 0 });
    }
  });

  // 2. Calcul des dates
  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  orderedTasks.forEach(t => {
    const dStart = parseDateSafe(t.date_debut);
    const dEnd = parseDateSafe(t.date_fin);

    if (dStart && dStart.getTime() < minTimestamp) minTimestamp = dStart.getTime();
    if (dEnd && dEnd.getTime() > maxTimestamp) maxTimestamp = dEnd.getTime();
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const startDate = minTimestamp !== Infinity ? new Date(minTimestamp) : new Date(now);
  const endDate = maxTimestamp !== -Infinity ? new Date(maxTimestamp) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  startDate.setDate(startDate.getDate() - 3);
  endDate.setDate(endDate.getDate() + 5);

  const days = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const DAY_WIDTH = 48;

  // 3. En-tête des jours
  headerContainer.style.width = `${days.length * DAY_WIDTH}px`;
  days.forEach(d => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const dayDiv = document.createElement('div');
    dayDiv.style.width = `${DAY_WIDTH}px`;
    dayDiv.className = `shrink-0 border-r border-slate-200 flex flex-col justify-center items-center py-1 text-[11px] select-none ${isWeekend ? 'bg-slate-200/60 text-slate-400 font-semibold' : 'text-slate-600 font-medium'}`;
    
    const dayName = d.toLocaleDateString('fr-FR', { weekday: 'narrow' });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

    dayDiv.innerHTML = `
      <span class="text-[9px] uppercase">${dayName}</span>
      <span class="font-bold text-slate-800">${dayNum}</span>
      <span class="text-[9px] text-slate-400">${monthName}</span>
    `;
    headerContainer.appendChild(dayDiv);
  });

  // 4. Lignes de tâches
  bodyContainer.style.width = `${days.length * DAY_WIDTH}px`;

  orderedTasks.forEach(task => {
    const treeRow = document.createElement('div');
    treeRow.className = "h-12 flex items-center px-3 text-xs font-medium text-slate-800 hover:bg-slate-100/80 cursor-pointer border-b border-slate-100 transition select-none";
    treeRow.onclick = () => openTaskModal(task.id);

    const indent = task.level * 16;
    const prefix = task.level > 0 ? `<span class="text-blue-500 font-bold mr-1.5">↳</span>` : `<span class="mr-1.5">📌</span>`;

    treeRow.style.paddingLeft = `${12 + indent}px`;
    treeRow.innerHTML = `
      ${prefix}
      <span class="truncate font-medium" title="${task.nom}">${task.nom}</span>
    `;
    treeContainer.appendChild(treeRow);

    const timeRow = document.createElement('div');
    timeRow.className = "h-12 relative flex items-center border-b border-slate-100 hover:bg-slate-50 transition";
    timeRow.style.width = `${days.length * DAY_WIDTH}px`;

    days.forEach((d, i) => {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      if (isWeekend) {
        const bgGrid = document.createElement('div');
        bgGrid.style.left = `${i * DAY_WIDTH}px`;
        bgGrid.style.width = `${DAY_WIDTH}px`;
        bgGrid.className = "absolute top-0 bottom-0 bg-slate-100/50 border-r border-slate-200/40 pointer-events-none";
        timeRow.appendChild(bgGrid);
      }
    });

    const taskStart = parseDateSafe(task.date_debut);
    const taskEnd = parseDateSafe(task.date_fin);

    if (taskStart && taskEnd) {
      const offsetDays = Math.max(0, Math.round((taskStart - startDate) / (1000 * 60 * 60 * 24)));
      const durationDays = Math.max(1, Math.round((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1);

      const leftPos = offsetDays * DAY_WIDTH;
      const barWidth = durationDays * DAY_WIDTH;

      const bar = document.createElement('div');
      bar.className = `absolute h-7 rounded-md px-2 text-[11px] font-semibold text-white flex items-center justify-between shadow-sm cursor-pointer transition hover:brightness-110 ${getBarColorClass(task.statut)}`;
      bar.style.left = `${leftPos}px`;
      bar.style.width = `${barWidth}px`;
      bar.onclick = () => openTaskModal(task.id);

      bar.innerHTML = `
        <span class="truncate text-[10px]">${formatDate(task.date_debut)} → ${formatDate(task.date_fin)}</span>
        <span class="text-[9px] bg-black/20 px-1 rounded ml-1 font-mono">${task.avancement || 0}%</span>
      `;

      timeRow.appendChild(bar);
    }

    bodyContainer.appendChild(timeRow);
  });
}

function getBarColorClass(statut) {
  switch (statut) {
    case 'En cours':
      return 'bg-blue-600';
    case 'Terminé':
      return 'bg-green-600';
    default:
      return 'bg-slate-600';
  }
}

// --- MODALE TÂCHE ---

function openTaskModal(taskId = null) {
  const projectId = document.getElementById('project-select').value;
  if (!projectId) {
    alert("Veuillez d'abord créer un projet.");
    return;
  }

  const modal = document.getElementById('modal-task');
  const btnDelete = document.getElementById('btn-delete');
  const title = document.getElementById('modal-title');
  const parentSelect = document.getElementById('task-parent');

  const availableParents = currentTasks.filter(t => t.id !== taskId);
  parentSelect.innerHTML = '<option value="">Aucune (Tâche principale)</option>' + 
    availableParents.map(t => `<option value="${t.id}">${t.nom}</option>`).join('');

  if (taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('task-id').value = task.id;
    document.getElementById('task-name').value = task.nom;
    document.getElementById('task-assignee').value = task.responsable || '';
    document.getElementById('task-start').value = task.date_debut || '';
    document.getElementById('task-end').value = task.date_fin || '';
    document.getElementById('task-status').value = task.statut || 'À faire';
    document.getElementById('task-progress').value = task.avancement || 0;
    parentSelect.value = task.parent_id || '';

    title.textContent = "Modifier la tâche";
    btnDelete.classList.remove('hidden');
  } else {
    document.getElementById('task-form').reset();
    document.getElementById('task-id').value = '';
    parentSelect.value = '';
    
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('task-start').value = today;
    document.getElementById('task-end').value = nextWeek;

    title.textContent = "Nouvelle tâche";
    btnDelete.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-task').classList.add('hidden');
}

async function saveTask(e) {
  e.preventDefault();
  const taskId = document.getElementById('task-id').value;
  const projectId = document.getElementById('project-select').value;
  const parentId = document.getElementById('task-parent').value || null;

  const payload = {
    projet_id: projectId,
    parent_id: parentId,
    nom: document.getElementById('task-name').value.trim(),
    responsable: document.getElementById('task-assignee').value.trim(),
    date_debut: document.getElementById('task-start').value,
    date_fin: document.getElementById('task-end').value,
    statut: document.getElementById('task-status').value,
    avancement: parseInt(document.getElementById('task-progress').value) || 0
  };

  const sb = getSupabaseClient();
  if (!sb) return;

  let error;
  if (taskId) {
    ({ error } = await sb.from('taches').update(payload).eq('id', taskId));
  } else {
    ({ error } = await sb.from('taches').insert([payload]));
  }

  if (error) {
    alert("Erreur lors de l'enregistrement : " + error.message);
  } else {
    closeModal();
    loadTasks();
  }
}

async function deleteTask() {
  const taskId = document.getElementById('task-id').value;
  if (!taskId) return;

  if (confirm("Es-tu sûre de vouloir supprimer cette tâche ?")) {
    const sb = getSupabaseClient();
    if (!sb) return;

    const { error } = await sb.from('taches').delete().eq('id', taskId);
    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
    } else {
      closeModal();
      loadTasks();
    }
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getStatusBadgeClass(statut) {
  switch (statut) {
    case 'En cours':
      return 'bg-blue-100 text-blue-800';
    case 'Terminé':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
