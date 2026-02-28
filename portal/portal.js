/* =====================================================
   Client Portal — JavaScript
   ===================================================== */

// ---- View switching helpers ----
const views = {
  auth:     document.getElementById('authView'),
  reset:    document.getElementById('resetView'),
  register: document.getElementById('registerView'),
  app:      document.getElementById('appView'),
};

function showView(name) {
  Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
  if (views[name]) views[name].style.display = '';
}

// ---- Toast ----
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show${type ? ' toast--' + type : ''}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ---- Error display ----
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}
function clearError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

// ---- Status badge ----
function statusBadge(status) {
  const map = {
    received:    'status--received',
    'in-progress': 'status--in-progress',
    complete:    'status--complete',
    hold:        'status--hold',
  };
  const label = status === 'in-progress' ? 'In Progress'
    : status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="status ${map[status] || ''}">${label}</span>`;
}

// ---- Material type label ----
function materialLabel(type) {
  const m = { soil: 'Soil', concrete: 'Concrete', asphalt: 'Asphalt', aggregate: 'Aggregate' };
  return m[type] || type;
}

// =====================================================
// AUTH FLOW
// =====================================================
document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearError('loginError');
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showError('loginError', error.message);
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
  // on success, auth state listener will call loadPortal()
});

document.getElementById('forgotLink')?.addEventListener('click', e => {
  e.preventDefault();
  showView('reset');
});
document.getElementById('showRegister')?.addEventListener('click', e => {
  e.preventDefault();
  showView('register');
});
document.getElementById('backToLogin')?.addEventListener('click', e => {
  e.preventDefault();
  showView('auth');
});
document.getElementById('backToLogin2')?.addEventListener('click', e => {
  e.preventDefault();
  showView('auth');
});

document.getElementById('resetForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearError('resetError');
  const email = document.getElementById('resetEmail').value.trim();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/portal/`,
  });
  if (error) {
    showError('resetError', error.message);
  } else {
    const el = document.getElementById('resetSuccess');
    el.textContent = 'Reset link sent! Check your email.';
    el.classList.add('visible');
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearError('registerError');
  const name     = document.getElementById('regName').value.trim();
  const company  = document.getElementById('regCompany').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (password.length < 8) {
    showError('registerError', 'Password must be at least 8 characters.');
    return;
  }

  const { error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, company, role: 'client' } },
  });

  if (error) {
    showError('registerError', error.message);
  } else {
    showView('auth');
    toast('Account created! You can sign in once the lab activates your account.', 'success');
  }
});

document.getElementById('signOutBtn')?.addEventListener('click', async () => {
  await db.auth.signOut();
  showView('auth');
});

// =====================================================
// PORTAL DATA LOADING
// =====================================================
async function loadPortal(user) {
  showView('app');
  document.getElementById('topbarUser').textContent = user.email;

  const loading = document.getElementById('portalLoading');
  const content = document.getElementById('portalContent');
  loading.style.display = '';
  content.style.display = 'none';

  // Fetch projects for this client
  const { data: projects, error: projErr } = await db
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (projErr) {
    loading.innerHTML = `<p style="color:var(--clr-text-muted)">Error loading data: ${projErr.message}</p>`;
    return;
  }

  if (!projects || projects.length === 0) {
    loading.style.display = 'none';
    content.style.display = '';
    document.getElementById('projectsContainer').innerHTML = `
      <div class="empty-state">
        <p>No projects found. Contact the lab to get your project set up.</p>
      </div>`;
    document.getElementById('portalStats').innerHTML = emptyStats();
    return;
  }

  // Fetch all samples for those projects
  const projectIds = projects.map(p => p.id);
  const { data: samples, error: sampleErr } = await db
    .from('samples')
    .select('*')
    .in('project_id', projectIds)
    .order('received_at', { ascending: false });

  if (sampleErr) {
    loading.innerHTML = `<p style="color:var(--clr-text-muted)">Error loading samples: ${sampleErr.message}</p>`;
    return;
  }

  loading.style.display = 'none';
  content.style.display = '';

  // Stats
  const total    = samples?.length || 0;
  const complete = samples?.filter(s => s.status === 'complete').length || 0;
  const inProg   = samples?.filter(s => s.status === 'in-progress').length || 0;
  const received = samples?.filter(s => s.status === 'received').length || 0;

  document.getElementById('portalStats').innerHTML = `
    <div class="dash-stat">
      <div class="dash-stat__label">Total Samples</div>
      <div class="dash-stat__value">${total}</div>
    </div>
    <div class="dash-stat">
      <div class="dash-stat__label">Results Ready</div>
      <div class="dash-stat__value" style="color:var(--clr-success)">${complete}</div>
    </div>
    <div class="dash-stat">
      <div class="dash-stat__label">In Progress</div>
      <div class="dash-stat__value" style="color:#854d0e">${inProg}</div>
    </div>
    <div class="dash-stat">
      <div class="dash-stat__label">Awaiting Testing</div>
      <div class="dash-stat__value" style="color:#0369a1">${received}</div>
    </div>`;

  // Group samples by project
  const samplesByProject = {};
  (samples || []).forEach(s => {
    if (!samplesByProject[s.project_id]) samplesByProject[s.project_id] = [];
    samplesByProject[s.project_id].push(s);
  });

  // Render projects
  const container = document.getElementById('projectsContainer');
  container.innerHTML = projects.map(project => {
    const pSamples = samplesByProject[project.id] || [];
    return `
      <div style="margin-bottom:2rem">
        <div style="margin-bottom:.75rem">
          <h3 style="font-size:1.1rem;font-weight:700">${escHtml(project.project_name)}</h3>
          <span style="font-size:.82rem;color:var(--clr-text-muted)">
            ${project.project_number ? '#' + escHtml(project.project_number) + ' &nbsp;·&nbsp; ' : ''}
            ${project.location ? escHtml(project.location) + ' &nbsp;·&nbsp; ' : ''}
            ${pSamples.length} sample${pSamples.length !== 1 ? 's' : ''}
          </span>
        </div>
        ${pSamples.length === 0
          ? '<p style="color:var(--clr-text-muted);font-size:.9rem">No samples logged for this project yet.</p>'
          : `<div class="data-table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sample ID</th>
                    <th>Material</th>
                    <th>Location / Depth</th>
                    <th>Collected</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${pSamples.map(s => `
                    <tr>
                      <td><strong>${escHtml(s.sample_label)}</strong></td>
                      <td>${materialLabel(s.material_type)}</td>
                      <td>${escHtml(s.location_detail || '—')}</td>
                      <td>${s.collection_date ? formatDate(s.collection_date) : '—'}</td>
                      <td>${statusBadge(s.status)}</td>
                      <td>
                        <button class="btn btn--ghost btn--sm" onclick="openSamplePanel('${s.id}','${escHtml(s.sample_label)}')">
                          View Results
                        </button>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>`;
  }).join('');
}

function emptyStats() {
  return ['Total Samples', 'Results Ready', 'In Progress', 'Awaiting Testing']
    .map(l => `<div class="dash-stat"><div class="dash-stat__label">${l}</div><div class="dash-stat__value">—</div></div>`)
    .join('');
}

// =====================================================
// SAMPLE DETAIL PANEL
// =====================================================
async function openSamplePanel(sampleId, label) {
  document.getElementById('panelSampleLabel').textContent = label;
  document.getElementById('panelBody').innerHTML = '<div class="spinner"></div>';
  document.getElementById('samplePanel').classList.add('open');

  const { data: results, error } = await db
    .from('test_results')
    .select('*')
    .eq('sample_id', sampleId)
    .order('created_at');

  if (error) {
    document.getElementById('panelBody').innerHTML =
      `<p style="color:var(--clr-text-muted)">Could not load results: ${error.message}</p>`;
    return;
  }

  if (!results || results.length === 0) {
    document.getElementById('panelBody').innerHTML =
      `<div class="empty-state"><p>No test results recorded yet.<br>Check back soon or contact the lab.</p></div>`;
    return;
  }

  document.getElementById('panelBody').innerHTML = results.map(r => `
    <div style="background:var(--clr-bg-alt);border:1px solid var(--clr-border);border-radius:var(--radius-lg);padding:1.1rem 1.3rem;margin-bottom:.9rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem;gap:.5rem;flex-wrap:wrap">
        <strong style="font-size:.95rem">${escHtml(r.test_name)}</strong>
        ${r.pass_fail && r.pass_fail !== 'n/a'
          ? `<span class="status ${r.pass_fail === 'pass' ? 'status--complete' : 'status--hold'}">${r.pass_fail.toUpperCase()}</span>`
          : ''}
      </div>
      ${r.standard ? `<span class="tag">${escHtml(r.standard)}</span>` : ''}
      <div style="margin-top:.75rem;font-size:.88rem;color:var(--clr-text-muted);display:grid;grid-template-columns:1fr 1fr;gap:.3rem .75rem">
        ${r.result_value ? `<span>Result: <strong style="color:var(--clr-text)">${escHtml(r.result_value)}${r.unit ? ' ' + escHtml(r.unit) : ''}</strong></span>` : ''}
        ${r.spec_value   ? `<span>Spec: <strong style="color:var(--clr-text)">${escHtml(r.spec_value)}</strong></span>` : ''}
        ${r.tested_date  ? `<span>Tested: ${formatDate(r.tested_date)}</span>` : ''}
        ${r.technician   ? `<span>Tech: ${escHtml(r.technician)}</span>` : ''}
      </div>
      ${r.notes ? `<p style="font-size:.83rem;color:var(--clr-text-muted);margin-top:.5rem">${escHtml(r.notes)}</p>` : ''}
      ${r.report_path
        ? `<button class="btn btn--ghost btn--sm" style="margin-top:.75rem" onclick="downloadReport('${escHtml(r.report_path)}','${escHtml(r.test_name)}')">
             Download Report (PDF)
           </button>`
        : ''}
    </div>`).join('');
}

// Download signed report URL from Supabase Storage
async function downloadReport(path, name) {
  const { data, error } = await db.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(path, 60 * 5); // 5-minute signed URL
  if (error) { toast('Could not generate download link.', 'error'); return; }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.download = name + '.pdf';
  a.click();
}

// Panel close
document.getElementById('panelClose')?.addEventListener('click', () => {
  document.getElementById('samplePanel').classList.remove('open');
});
document.getElementById('samplePanel')?.addEventListener('click', e => {
  if (e.target === document.getElementById('samplePanel')) {
    document.getElementById('samplePanel').classList.remove('open');
  }
});

// Expose for inline onclick
window.openSamplePanel = openSamplePanel;
window.downloadReport  = downloadReport;

// =====================================================
// AUTH STATE LISTENER
// =====================================================
db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    loadPortal(session.user);
  } else {
    showView('auth');
  }
});

// ---- Utility ----
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
