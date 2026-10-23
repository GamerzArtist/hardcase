const $ = id => document.getElementById(id);
let tasks = [];
let user = null;

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error ?? 'The action could not be completed.'); error.status = response.status; throw error; }
  return body;
}
function notice(message, error = false) { $('action-status').textContent = message; $('action-status').classList.toggle('error', error); }
function renderTasks() {
  const matching = tasks.filter(task => task.title.toLowerCase().includes($('search').value.toLowerCase()));
  $('tasks').replaceChildren();
  $('task-count').textContent = String(tasks.length);
  $('empty').classList.toggle('hidden', matching.length > 0);
  for (const task of matching) {
    const row = document.createElement('article'); row.className = 'task'; row.id = `task-${task.id}`;
    const icon = document.createElement('span'); icon.className = `state-icon ${task.state === 'Done' ? 'done' : ''}`; icon.textContent = task.state === 'Done' ? '✓' : '○'; icon.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h3'); title.id = `title-${task.id}`; title.textContent = task.title;
    const state = document.createElement('span'); state.className = `task-state ${task.state === 'Done' ? 'done' : ''}`; state.id = `state-${task.id}`; state.textContent = task.state;
    const button = document.createElement('button'); button.id = `complete-${task.id}`; button.className = 'quiet'; button.textContent = task.state === 'Done' ? 'Completed' : 'Move to done'; button.disabled = task.state === 'Done'; button.setAttribute('aria-label', `${button.textContent}: ${task.title}`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ state: 'Done', version: task.version }) }); await refresh(); notice('Task moved to Done.'); }
      catch (error) { notice(error.message, true); button.disabled = false; }
    });
    row.append(icon, title, state, button); $('tasks').append(row);
  }
}
async function refresh() {
  const data = await api('/api/tasks'); tasks = data.tasks; renderTasks();
  $('activity').replaceChildren();
  for (const item of data.activity) {
    const li = document.createElement('li'); const title = tasks.find(task => task.id === item.task_id)?.title ?? `Task ${item.task_id}`;
    const text = document.createElement('p'); text.textContent = `${item.actor_name} ${item.action} “${title}”`;
    const time = document.createElement('time'); time.dateTime = item.at; time.textContent = new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    li.append(text, time); $('activity').append(li);
  }
  if (!data.activity.length) { const li = document.createElement('li'); li.textContent = 'A fresh board. Your team’s changes will appear here.'; $('activity').append(li); }
}
async function showSession(nextUser) {
  user = nextUser;
  if (user) await refresh();
  $('login-panel').classList.toggle('hidden', Boolean(user)); $('board-panel').classList.toggle('hidden', !user);
  $('person').textContent = user?.name ?? ''; $('role').textContent = user?.role ?? '';
  $('create-form').classList.toggle('hidden', user?.role !== 'editor');
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('sign-in').disabled = true; $('login-error').textContent = '';
  try { const result = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: $('username').value, password: $('password').value }) }); $('password').value = ''; await showSession(result.user); }
  catch (error) { $('login-error').textContent = error.message; }
  finally { $('sign-in').disabled = false; }
});
$('sign-out').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); await showSession(null); notice('Your board is up to date.'); }
  catch (error) { notice(error.message, true); }
});
$('create-form').addEventListener('submit', async event => {
  event.preventDefault(); $('add-task').disabled = true;
  try { await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title: $('new-task').value }) }); $('new-task').value = ''; await refresh(); notice('Task added to the board.'); }
  catch (error) { notice(error.message, true); }
  finally { $('add-task').disabled = false; }
});
$('search').addEventListener('input', renderTasks);
api('/api/session').then(async result => { $('mode').textContent = `${result.mode} mode`; await showSession(result.user); }).catch(error => { $('fatal-error').textContent = `Could not load the board: ${error.message} Reload to try again.`; });
