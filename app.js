let currentTasks = [];

async function init() {
  const { data: projets } = await supabaseClient.from('projets').select('*');
  const select = document.getElementById('project-select');
  
  if (projets && projets.length > 0) {
    select.innerHTML = projets.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
    loadTasks();
  } else {
    select.innerHTML = `<option value="">Aucun projet disponible</option>`;
  }
}

async function loadTasks() {
  const projectId = document.getElementById('project-select').value;
  if (!projectId) return;

  const { data: taches } = await supabaseClient.from('taches').select('*').eq('projet_id', projectId);
  currentTasks = taches || [];
  
  renderList();
  renderKanban();
  renderGantt();
}

function renderList() {
  const body = document.getElementById('task-list-body');
  if (currentTasks.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Aucune tâche enregistrée.</td></tr>`;
    return;
  }
  body.innerHTML = currentTasks.map(t => `
    <tr class="border-b hover:bg-gray-50">
      <td class="p-3 font-medium">${t.nom}</td>
      <td class="p-3">${t.responsable || '-'}</td>
      <td class="p-3 text-sm">${t.date_debut}</td>
      <td class="p-3 text-sm">${t.date_fin}</td>
      <td class="p-3"><span class="px-2 py-1 text-xs rounded bg-gray-200">${t.statut}</span></td>
      <td class="p-3 font-semibold">${t.avancement}%</td>
    </tr>
  `).join('');
}

function renderKanban() {
  document.getElementById('kanban-todo').innerHTML = renderCards(currentTasks.filter(t => t.statut === 'À faire'));
  document.getElementById('kanban-doing').innerHTML = renderCards(currentTasks.filter(t => t.statut === 'En cours'));
  document.getElementById('kanban-done').innerHTML = renderCards(currentTasks.filter(t => t.statut === 'Terminé'));
}

function renderCards(tasks) {
  if (tasks.length === 0) return `<div class="text-xs text-gray-400 p-2">Aucune tâche</div>`;
  return tasks.map(t => `
    <div class="bg-white p-3 rounded shadow text-sm border-l-4 border-blue-500">
      <div class="font-bold">${t.nom}</div>
      <div class="text-xs text-gray-500 mt-1">👤 ${t.responsable || 'Non assigné'}</div>
      <div class="text-xs text-gray-400 mt-1">📅 ${t.date_debut} → ${t.date_fin}</div>
    </div>
  `).join('');
}

function renderGantt() {
  const target = document.getElementById('gantt-target');
  target.innerHTML = '';
  if (currentTasks.length === 0) return;

  const tasksFormatted = currentTasks.map(t => ({
    id: t.id,
    name: t.nom,
    start: t.date_debut,
    end: t.date_fin,
    progress: t.avancement
  }));

  new Gantt("#gantt-target", tasksFormatted, {
    language: 'fr',
    header_height: 50,
    column_width: 30,
    step: 24,
    view_modes: ['Day', 'Week', 'Month'],
    bar_height: 20,
    padding: 18
  });
}

function switchTab(tab) {
  ['list', 'kanban', 'gantt'].forEach(t => {
    document.getElementById(`view-${t}`).classList.add('hidden');
    document.getElementById(`tab-${t}`).className = "py-2 px-4 font-semibold text-gray-500 hover:text-blue-600";
  });
  document.getElementById(`view-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).className = "py-2 px-4 font-semibold text-blue-600 border-b-2 border-blue-600";
  if (tab === 'gantt') renderGantt();
}

function openModal() { document.getElementById('modal-task').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal-task').classList.add('hidden'); }

async function saveTask(e) {
  e.preventDefault();
  const projectId = document.getElementById('project-select').value;
  
  const newTask = {
    projet_id: projectId,
    nom: document.getElementById('task-name').value,
    responsable: document.getElementById('task-assignee').value,
    date_debut: document.getElementById('task-start').value,
    date_fin: document.getElementById('task-end').value,
    statut: document.getElementById('task-status').value,
    avancement: parseInt(document.getElementById('task-progress').value) || 0
  };

  const { error } = await supabaseClient.from('taches').insert([newTask]);
  
  if (!error) {
    closeModal();
    document.getElementById('task-form').reset();
    loadTasks();
  } else {
    alert("Erreur Supabase : " + error.message);
  }
}

// Lancement au chargement de la page
init();