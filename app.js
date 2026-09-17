// Variable globale pour le client Supabase
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

// ÉTAT GLOBAL DE L'APPLICATION
let currentTasks = [];
let currentTab = 'kanban';

// INITIALISATION SÉCURISÉE
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

    // Garde le projet sélectionné ou prend le premier de la liste
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

// MODALE PROJET (Création ou Édition)
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
    if (title) title.textContent = "Modifier / Supprimer le projet";
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
    // Modification du nom du projet
    ({ data, error } = await sb
      .from('projets')
      .update({ nom: nameInput })
      .eq('id', currentProjectId)
      .select());
  } else {
    // Création d'un nouveau projet
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

  if (!projectId) {
    alert("Aucun projet sélectionné à supprimer.");
    return;
  }

  if (confirm("Attention : cette action est irréversible. Voulez-vous vraiment supprimer ce projet et toutes ses tâches ?")) {
    const sb = getSupabaseClient();
    if (!sb) return;

    // 1. Supprime les tâches associées
    await sb.from('taches').delete().eq('projet_id', projectId);

    // 2. Supprime le projet
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

// --- VUE GANTT ---

let ganttInstance = null;

function renderGanttView() {
  const svg = document.getElementById('gantt-svg');
  if (!svg) return;
  svg.innerHTML = '';

  if (currentTasks.length === 0) return;

  const formattedTasks = currentTasks.map(t => ({
    id: t.id,
    name: t.nom,
    start: t.date_debut || new Date().toISOString().split('T')[0],
    end: t.date_fin || new Date().toISOString().split('T')[0],
    progress: t.avancement || 0,
    dependencies: t.parent_id ? t.parent_id : ""
  }));

  try {
    ganttInstance = new Gantt("#gantt-svg", formattedTasks, {
      language: 'fr',
      view_mode: 'Day',
      on_click: (task) => openTaskModal(task.id)
    });
  } catch (err) {
    console.error("Erreur de rendu Gantt :", err);
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

// --- UTILITAIRES ---

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
