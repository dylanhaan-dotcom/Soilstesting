/* =====================================================
   Lab Admin — JavaScript
   ===================================================== */

// ---- State ----
let currentTab = 'projects';
let allProjects = [];
let allSamples  = [];
let allClients  = [];

// ---- Toast ----
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show${type ? ' toast--' + type : ''}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ---- Escape HTML ----
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status) {
  const map = { received:'status--received','in-progress':'status--in-progress',complete:'status--complete',hold:'status--hold' };
  const label = status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="status ${map[status]||''}">${label}</span>`;
}

// =====================================================
// AUTH
// =====================================================

function showAdminApp() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appView').style.display  = '';
  document.getElementById('adminLoading').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.add('visible');
}

function setLoginStatus(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.background = '#eff6ff';
  el.style.borderColor = '#93c5fd';
  el.style.color = '#1e40af';
  el.classList.add('visible');
}

function clearLoginStatus() {
  const el = document.getElementById('loginError');
  el.style.background = '';
  el.style.borderColor = '';
  el.style.color = '';
  el.classList.remove('visible');
}

document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  clearLoginStatus();
  btn.textContent = 'Signing in…'; btn.disabled = true;

  // Step 1: authenticate
  setLoginStatus('Step 1/3: Authenticating…');
  const { error: authError } = await db.auth.signInWithPassword({
    email:    document.getElementById('loginEmail').value.trim(),
    password: document.getElementById('loginPassword').value,
  });
  if (authError) {
    showLoginError('Auth failed: ' + authError.message);
    btn.textContent = 'Sign In'; btn.disabled = false;
    return;
  }

  // Step 2: verify admin role
  setLoginStatus('Step 2/3: Getting user…');
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) {
    showLoginError('Could not get user after login: ' + (userError?.message || 'unknown'));
    btn.textContent = 'Sign In'; btn.disabled = false;
    return;
  }

  setLoginStatus('Step 3/3: Checking role…');
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role').eq('id', user.id).single();

  if (profileError || !profile || profile.role !== 'admin') {
    await db.auth.signOut();
    showLoginError(profileError
      ? 'Role check failed: ' + profileError.message + ' (Code: ' + profileError.code + ')'
      : 'Access denied. Role found: "' + (profile?.role ?? 'none') + '" — must be "admin".');
    btn.textContent = 'Sign In'; btn.disabled = false;
    return;
  }

  // Step 3: show app
  clearLoginStatus();
  await loadAll();
  setTab('projects');
  showAdminApp();
});

document.getElementById('signOutBtn')?.addEventListener('click', async () => {
  await db.auth.signOut();
  document.getElementById('appView').style.display = 'none';
  document.getElementById('authView').style.display = '';
});

// =====================================================
// AUTH STATE — handles page-reload session restoration only
// =====================================================
db.auth.onAuthStateChange(async (event, session) => {
  if (event !== 'INITIAL_SESSION') return;
  if (!session?.user) return; // no saved session — stay on login

  // Restore session: re-verify admin role
  const { data: profile } = await db.from('profiles')
    .select('role').eq('id', session.user.id).single();

  if (!profile || profile.role !== 'admin') {
    await db.auth.signOut();
    return;
  }

  await loadAll();
  setTab('projects');
  showAdminApp();
});

// =====================================================
// DATA LOADING
// =====================================================
async function loadAll() {
  // Clients (profiles with role=client)
  const { data: clients } = await db.from('profiles').select('*').eq('role','client').order('full_name');
  allClients = clients || [];

  // Projects
  const { data: projects } = await db.from('projects').select('*, profiles(full_name, company)').order('created_at', { ascending: false });
  allProjects = projects || [];

  // Samples
  const { data: samples } = await db.from('samples').select('*, projects(project_name)').order('received_at', { ascending: false });
  allSamples = samples || [];

  renderProjects();
  renderSamples();
  populateSelects();
}

// =====================================================
// TABS
// =====================================================
window.setTab = function(tab) {
  currentTab = tab;
  ['projects','samples','results','quotes'].forEach(t => {
    document.getElementById(`tab${capitalize(t)}_content`).style.display = t === tab ? '' : 'none';
    document.getElementById(`tab${capitalize(t)}`).style.background = t === tab ? 'rgba(255,255,255,.2)' : '';
  });
  if (tab === 'results') loadResults();
  if (tab === 'quotes')  loadQuotes();
};

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// =====================================================
// PROJECTS
// =====================================================
function renderProjects() {
  const tbody = document.getElementById('projectsBody');
  if (!allProjects.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--clr-text-muted);padding:2rem">No projects yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allProjects.map(p => `
    <tr>
      <td><strong>${escHtml(p.project_name)}</strong></td>
      <td>${escHtml(p.project_number || '—')}</td>
      <td>${escHtml(p.profiles?.full_name || '—')}${p.profiles?.company ? '<br><span style="font-size:.8rem;color:var(--clr-text-muted)">'+escHtml(p.profiles.company)+'</span>' : ''}</td>
      <td>${escHtml(p.location || '—')}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        <button class="btn btn--ghost btn--sm" onclick='editProject(${JSON.stringify(p)})'>Edit</button>
      </td>
    </tr>`).join('');
}

window.editProject = function(p) {
  document.getElementById('projectPanelTitle').textContent = 'Edit Project';
  document.getElementById('projectId').value   = p.id;
  document.getElementById('projName').value     = p.project_name || '';
  document.getElementById('projNumber').value   = p.project_number || '';
  document.getElementById('projClient').value   = p.client_id || '';
  document.getElementById('projLocation').value = p.location || '';
  document.getElementById('projEngineer').value = p.engineer || '';
  document.getElementById('projNotes').value    = p.notes || '';
  openPanel('project');
};

document.getElementById('projectForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('projectId').value;
  const payload = {
    project_name:   document.getElementById('projName').value.trim(),
    project_number: document.getElementById('projNumber').value.trim() || null,
    client_id:      document.getElementById('projClient').value || null,
    location:       document.getElementById('projLocation').value.trim() || null,
    engineer:       document.getElementById('projEngineer').value.trim() || null,
    notes:          document.getElementById('projNotes').value.trim() || null,
    updated_at:     new Date().toISOString(),
  };
  let error;
  if (id) {
    ({ error } = await db.from('projects').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('projects').insert(payload));
  }
  if (error) { toast(error.message, 'error'); return; }
  toast('Project saved!', 'success');
  closePanel('project');
  await loadAll();
};

// =====================================================
// SAMPLES
// =====================================================
function renderSamples() {
  const tbody = document.getElementById('samplesBody');
  if (!allSamples.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--clr-text-muted);padding:2rem">No samples yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allSamples.map(s => `
    <tr>
      <td><strong>${escHtml(s.sample_label)}</strong></td>
      <td>${escHtml(s.projects?.project_name || '—')}</td>
      <td>${capitalize(s.material_type)}</td>
      <td>${escHtml(s.location_detail || '—')}</td>
      <td>${formatDate(s.received_at)}</td>
      <td>${statusBadge(s.status)}</td>
      <td>
        <button class="btn btn--ghost btn--sm" onclick='editSample(${JSON.stringify(s)})'>Edit</button>
      </td>
    </tr>`).join('');
}

window.editSample = function(s) {
  document.getElementById('samplePanelTitle').textContent = 'Edit Sample';
  document.getElementById('sampleId').value          = s.id;
  document.getElementById('sampleProject').value     = s.project_id || '';
  document.getElementById('sampleLabel').value       = s.sample_label || '';
  document.getElementById('sampleMaterial').value    = s.material_type || '';
  document.getElementById('sampleDesc').value        = s.description || '';
  document.getElementById('sampleLocation').value    = s.location_detail || '';
  document.getElementById('sampleCollDate').value    = s.collection_date || '';
  document.getElementById('sampleSubmittedBy').value = s.submitted_by || '';
  document.getElementById('sampleStatus').value      = s.status || 'received';
  openPanel('sample');
};

document.getElementById('sampleForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('sampleId').value;
  const payload = {
    project_id:      document.getElementById('sampleProject').value,
    sample_label:    document.getElementById('sampleLabel').value.trim(),
    material_type:   document.getElementById('sampleMaterial').value,
    description:     document.getElementById('sampleDesc').value.trim() || null,
    location_detail: document.getElementById('sampleLocation').value.trim() || null,
    collection_date: document.getElementById('sampleCollDate').value || null,
    submitted_by:    document.getElementById('sampleSubmittedBy').value.trim() || null,
    status:          document.getElementById('sampleStatus').value,
    updated_at:      new Date().toISOString(),
  };
  let error;
  if (id) {
    ({ error } = await db.from('samples').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('samples').insert(payload));
  }
  if (error) { toast(error.message, 'error'); return; }

  // If sample is now complete, also update parent project? (optional enhancement)
  toast('Sample saved!', 'success');
  closePanel('sample');
  await loadAll();
});

// =====================================================
// RESULTS
// =====================================================
async function loadResults() {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  const { data: results, error } = await db
    .from('test_results')
    .select('*, samples(sample_label)')
    .order('created_at', { ascending: false });

  if (error) { toast(error.message,'error'); return; }

  if (!results?.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--clr-text-muted);padding:2rem">No results yet.</td></tr>';
    return;
  }

  tbody.innerHTML = results.map(r => `
    <tr>
      <td><strong>${escHtml(r.samples?.sample_label || '—')}</strong></td>
      <td>${escHtml(r.test_name)}</td>
      <td><span class="tag">${escHtml(r.standard || '—')}</span></td>
      <td>${escHtml(r.result_value || '—')}${r.unit ? ' ' + escHtml(r.unit) : ''}</td>
      <td>${r.pass_fail && r.pass_fail !== 'n/a'
        ? `<span class="status ${r.pass_fail==='pass'?'status--complete':'status--hold'}">${r.pass_fail.toUpperCase()}</span>`
        : '—'}</td>
      <td>${formatDate(r.tested_date)}</td>
      <td>${r.report_path
        ? `<button class="btn btn--ghost btn--sm" onclick="viewReport('${escHtml(r.report_path)}')">View</button>`
        : '—'}</td>
      <td>
        <button class="btn btn--ghost btn--sm" onclick='editResult(${JSON.stringify(r)})'>Edit</button>
      </td>
    </tr>`).join('');
}

window.editResult = function(r) {
  document.getElementById('resultPanelTitle').textContent = 'Edit Result';
  document.getElementById('resultId').value         = r.id;
  document.getElementById('resultSample').value     = r.sample_id || '';
  document.getElementById('resultTestName').value   = r.test_name || '';
  document.getElementById('resultStandard').value   = r.standard || '';
  document.getElementById('resultValue').value      = r.result_value || '';
  document.getElementById('resultUnit').value       = r.unit || '';
  document.getElementById('resultSpec').value       = r.spec_value || '';
  document.getElementById('resultPassFail').value   = r.pass_fail || 'n/a';
  document.getElementById('resultTestedDate').value = r.tested_date || '';
  document.getElementById('resultTech').value       = r.technician || '';
  document.getElementById('resultNotes').value      = r.notes || '';
  openPanel('result');
};

document.getElementById('resultForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = document.getElementById('resultSubmitBtn');
  submitBtn.textContent = 'Saving…'; submitBtn.disabled = true;

  const id = document.getElementById('resultId').value;
  let report_path = null;

  // Handle PDF upload
  const fileInput = document.getElementById('resultReport');
  if (fileInput.files.length > 0) {
    const file     = fileInput.files[0];
    const sampleId = document.getElementById('resultSample').value;
    const testName = document.getElementById('resultTestName').value.replace(/\s+/g,'_');
    const filePath = `${sampleId}/${testName}_${Date.now()}.pdf`;

    const { error: uploadErr } = await db.storage
      .from(REPORTS_BUCKET)
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      toast('Upload failed: ' + uploadErr.message, 'error');
      submitBtn.textContent = 'Save Result'; submitBtn.disabled = false;
      return;
    }
    report_path = filePath;
  }

  const payload = {
    sample_id:    document.getElementById('resultSample').value,
    test_name:    document.getElementById('resultTestName').value.trim(),
    standard:     document.getElementById('resultStandard').value.trim() || null,
    result_value: document.getElementById('resultValue').value.trim() || null,
    unit:         document.getElementById('resultUnit').value.trim() || null,
    spec_value:   document.getElementById('resultSpec').value.trim() || null,
    pass_fail:    document.getElementById('resultPassFail').value,
    tested_date:  document.getElementById('resultTestedDate').value || null,
    technician:   document.getElementById('resultTech').value.trim() || null,
    notes:        document.getElementById('resultNotes').value.trim() || null,
    updated_at:   new Date().toISOString(),
  };
  if (report_path) payload.report_path = report_path;

  let error;
  if (id) {
    ({ error } = await db.from('test_results').update(payload).eq('id', id));
  } else {
    ({ error } = await db.from('test_results').insert(payload));
  }

  submitBtn.textContent = 'Save Result'; submitBtn.disabled = false;

  if (error) { toast(error.message, 'error'); return; }
  toast('Result saved!', 'success');
  closePanel('result');
  loadResults();
  fileInput.value = '';
});

window.viewReport = async function(path) {
  const { data, error } = await db.storage.from(REPORTS_BUCKET).createSignedUrl(path, 300);
  if (error) { toast('Could not load report.', 'error'); return; }
  window.open(data.signedUrl, '_blank');
};

// =====================================================
// QUOTE REQUESTS
// =====================================================
async function loadQuotes() {
  const tbody = document.getElementById('quotesBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  const { data: quotes, error } = await db
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { toast(error.message,'error'); return; }

  if (!quotes?.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--clr-text-muted);padding:2rem">No quote requests yet.</td></tr>';
    return;
  }

  const statusColors = { new:'status--received', contacted:'status--in-progress', converted:'status--complete', closed:'status--hold' };

  tbody.innerHTML = quotes.map(q => `
    <tr>
      <td><strong>${escHtml(q.name)}</strong></td>
      <td>${escHtml(q.company||'—')}</td>
      <td><a href="mailto:${escHtml(q.email)}">${escHtml(q.email)}</a></td>
      <td>${escHtml(q.project_name||'—')}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(q.tests_needed||'—')}</td>
      <td>${formatDate(q.created_at)}</td>
      <td><span class="status ${statusColors[q.status]||''}">${capitalize(q.status)}</span></td>
      <td>
        <select class="btn btn--ghost btn--sm" style="padding:.25rem .5rem;font-size:.8rem"
          onchange="updateQuoteStatus('${q.id}', this.value)">
          <option value="new"       ${q.status==='new'?'selected':''}>New</option>
          <option value="contacted" ${q.status==='contacted'?'selected':''}>Contacted</option>
          <option value="converted" ${q.status==='converted'?'selected':''}>Converted</option>
          <option value="closed"    ${q.status==='closed'?'selected':''}>Closed</option>
        </select>
      </td>
    </tr>`).join('');
}

window.updateQuoteStatus = async function(id, status) {
  const { error } = await db.from('quote_requests').update({ status }).eq('id', id);
  if (error) toast(error.message, 'error');
  else toast('Status updated.', 'success');
};

// =====================================================
// PANEL HELPERS
// =====================================================
window.openPanel = function(type) {
  // Reset form
  const form = document.getElementById(`${type}Form`);
  if (type !== 'project') {
    form?.reset();
  }
  if (type === 'project') {
    document.getElementById('projectId').value = '';
    document.getElementById('projectPanelTitle').textContent = 'New Project';
  }
  if (type === 'sample') {
    document.getElementById('sampleId').value = '';
    document.getElementById('samplePanelTitle').textContent = 'Log Sample';
  }
  if (type === 'result') {
    document.getElementById('resultId').value = '';
    document.getElementById('resultPanelTitle').textContent = 'Add Test Result';
  }
  document.getElementById(`${type}Panel`).classList.add('open');
};

window.closePanel = function(type) {
  document.getElementById(`${type}Panel`).classList.remove('open');
};

// Close on overlay click
['project','sample','result'].forEach(type => {
  document.getElementById(`${type}Panel`)?.addEventListener('click', e => {
    if (e.target === document.getElementById(`${type}Panel`)) closePanel(type);
  });
});

// =====================================================
// POPULATE SELECT DROPDOWNS
// =====================================================
function populateSelects() {
  // Client select in project form
  const clientSel = document.getElementById('projClient');
  clientSel.innerHTML = '<option value="">— Select client —</option>' +
    allClients.map(c => `<option value="${c.id}">${escHtml(c.full_name || c.id)}${c.company ? ' (' + escHtml(c.company) + ')' : ''}</option>`).join('');

  // Project select in sample form
  const projectSel = document.getElementById('sampleProject');
  projectSel.innerHTML = '<option value="">— Select project —</option>' +
    allProjects.map(p => `<option value="${p.id}">${escHtml(p.project_name)}${p.project_number ? ' #' + escHtml(p.project_number) : ''}</option>`).join('');

  // Sample select in result form
  const sampleSel = document.getElementById('resultSample');
  sampleSel.innerHTML = '<option value="">— Select sample —</option>' +
    allSamples.map(s => `<option value="${s.id}">[${escHtml(s.projects?.project_name||'')}] ${escHtml(s.sample_label)}</option>`).join('');
}
