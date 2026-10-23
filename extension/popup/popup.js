const contentEl = document.getElementById('content');
const pageBadge = document.getElementById('pageBadge');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

// Tab switching
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('panel-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function getPageContext(url, title) {
  if (!url) return { type: 'other', label: 'Ready' };
  if (/linkedin\.com\/in\//.test(url)) {
    const slug = url.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1] || '';
    return { type: 'profile', label: slug || 'LinkedIn profile', url };
  }
  if (/linkedin\.com\/feed\/update\//.test(url)) return { type: 'post', label: 'LinkedIn post', url };
  if (/linkedin\.com\/feed/.test(url)) return { type: 'feed', label: 'LinkedIn feed', url };
  if (/linkedin\.com\/analytics/.test(url)) return { type: 'analytics', label: 'LinkedIn analytics', url };
  if (/linkedin\.com/.test(url)) return { type: 'linkedin', label: 'LinkedIn', url };
  return { type: 'other', label: (title || 'Ready').slice(0, 40) };
}

async function render() {
  const { token, user } = await getAuth();
  const tab = await getActiveTab();
  const ctx = getPageContext(tab?.url, tab?.title);

  pageBadge.textContent = ctx.label;

  if (!token || !user) {
    contentEl.innerHTML = `
      <div class="tab-panel active" id="panel-actions">
        <div class="signin">
          <p>Sign in to Eclatale to save leads, copy posts, and track your brand.</p>
          <button class="btn-primary" id="signInBtn">Sign in</button>
        </div>
      </div>
      <div class="tab-panel" id="panel-leads"></div>
      <div class="tab-panel" id="panel-stats"></div>`;
    document.getElementById('signInBtn').addEventListener('click', openSignIn);
    return;
  }

  // Actions panel content depends on page context
  let actionsHtml = '';

  if (ctx.type === 'profile') {
    actionsHtml = `
      <button class="btn-primary" id="saveLeadBtn">👤 Save Lead</button>
      <a class="btn-secondary" href="https://eclatale.com/intelligence#profile" target="_blank">Optimize this profile</a>
      <div class="action-grid">
        <a class="action-card" href="https://eclatale.com/create" target="_blank"><span class="icon">✨</span>Create post</a>
        <a class="action-card" href="https://eclatale.com/tools/linkedin-dm-writer" target="_blank"><span class="icon">✉️</span>Write DM</a>
        <a class="action-card" href="https://eclatale.com/tools/comment-generator" target="_blank"><span class="icon">💬</span>Comment</a>
        <a class="action-card" href="https://eclatale.com/leads" target="_blank"><span class="icon">👥</span>My leads</a>
      </div>`;
  } else if (ctx.type === 'post') {
    actionsHtml = `
      <button class="btn-teal" id="copyPostBtn">📋 Copy Post Text</button>
      <button class="btn-secondary" id="repurposeBtn">🔄 Repurpose in Eclatale</button>
      <div class="action-grid">
        <a class="action-card" href="https://eclatale.com/tools/comment-generator" target="_blank"><span class="icon">💬</span>Generate comment</a>
        <a class="action-card" href="https://eclatale.com/create" target="_blank"><span class="icon">✨</span>Create post</a>
      </div>`;
  } else if (ctx.type === 'feed') {
    actionsHtml = `
      <a class="btn-primary" href="https://eclatale.com/create" target="_blank">✨ Create a post</a>
      <div class="action-grid">
        <a class="action-card" href="https://eclatale.com/tools/hook-generator" target="_blank"><span class="icon">🪝</span>Hook gen</a>
        <a class="action-card" href="https://eclatale.com/tools/comment-generator" target="_blank"><span class="icon">💬</span>Comment</a>
        <a class="action-card" href="https://eclatale.com/tools/hashtag-generator" target="_blank"><span class="icon">#</span>Hashtags</a>
        <a class="action-card" href="https://eclatale.com/leads" target="_blank"><span class="icon">👥</span>My leads</a>
      </div>`;
  } else {
    actionsHtml = `
      <a class="btn-primary" href="https://eclatale.com/create" target="_blank">✨ Create a post</a>
      <button class="btn-secondary" id="repurposePageBtn">🔄 Repurpose this page</button>
      <div class="action-grid">
        <a class="action-card" href="https://eclatale.com/tools" target="_blank"><span class="icon">🛠</span>Free tools</a>
        <a class="action-card" href="https://eclatale.com/dashboard" target="_blank"><span class="icon">📊</span>Dashboard</a>
        <a class="action-card" href="https://eclatale.com/leads" target="_blank"><span class="icon">👥</span>Leads</a>
        <a class="action-card" href="https://eclatale.com/discover" target="_blank"><span class="icon">🔍</span>Discover</a>
      </div>`;
  }

  contentEl.innerHTML = `
    <div class="tab-panel active" id="panel-actions">
      ${actionsHtml}
      <div class="footer-row">
        <span class="sync-label" id="lastSyncLabel">Loading sync…</span>
        <button id="syncNowBtn">Sync now</button>
      </div>
      <button class="signout-btn" id="signOutBtn">Sign out</button>
    </div>
    <div class="tab-panel" id="panel-leads">
      <div class="loading" id="leadsLoading">Loading leads…</div>
    </div>
    <div class="tab-panel" id="panel-stats">
      <div class="stats" id="statsBar"><div class="loading">Loading…</div></div>
    </div>`;

  // Sign out
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await clearAuth();
    render();
  });

  // Save lead (profile page)
  if (ctx.type === 'profile') {
    document.getElementById('saveLeadBtn').addEventListener('click', async () => {
      const btn = document.getElementById('saveLeadBtn');
      btn.textContent = 'Saving…';
      btn.disabled = true;
      try {
        // Ask content script to scrape the profile
        const liTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/in/*' });
        const target = liTabs.find(t => t.active) || liTabs[0];
        if (!target?.id) { showToast('Open the LinkedIn profile tab first'); btn.textContent = '👤 Save Lead'; btn.disabled = false; return; }
        const scraped = await chrome.tabs.sendMessage(target.id, { type: 'ECLATALE_SCRAPE_LEAD' });
        if (!scraped?.ok) { showToast('Could not read profile data'); btn.textContent = '👤 Save Lead'; btn.disabled = false; return; }
        await apiCall('save-lead', { lead: scraped.lead });
        showToast('Lead saved!');
        btn.textContent = '✓ Saved';
      } catch {
        showToast('Save failed. Try again.');
        btn.textContent = '👤 Save Lead';
        btn.disabled = false;
      }
    });
  }

  // Copy post text
  if (ctx.type === 'post') {
    document.getElementById('copyPostBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('copyPostBtn');
      const liTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/feed/update/*' });
      const target = liTabs.find(t => t.active) || liTabs[0];
      if (target?.id) {
        try {
          const result = await chrome.tabs.sendMessage(target.id, { type: 'ECLATALE_COPY_POST' });
          if (result?.text) {
            await navigator.clipboard.writeText(result.text);
            showToast('Post copied!');
            btn.textContent = '✓ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy Post Text'; }, 1800);
          } else { showToast('No post text found'); }
        } catch { showToast('Could not copy'); }
      }
    });

    document.getElementById('repurposeBtn')?.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://eclatale.com/create?url=${encodeURIComponent(tab?.url || '')}` });
    });
  }

  // Repurpose current page
  document.getElementById('repurposePageBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `https://eclatale.com/create/resource?url=${encodeURIComponent(tab?.url || '')}` });
  });

  // Sync now button
  document.getElementById('syncNowBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('syncNowBtn');
    btn.textContent = 'Syncing…';
    btn.disabled = true;
    const liTabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    const target = liTabs.find(t => t.active) || liTabs[0];
    if (target?.id) {
      try { await chrome.tabs.sendMessage(target.id, { type: 'ECLATALE_SYNC_NOW' }); showToast('Synced!'); } catch {}
    } else {
      chrome.tabs.create({ url: 'https://www.linkedin.com/analytics/creator/' });
    }
    btn.textContent = 'Sync now'; btn.disabled = false;
  });

  // Last sync label
  const { last_insights_sync } = await chrome.storage.local.get(['last_insights_sync']);
  const lbl = document.getElementById('lastSyncLabel');
  if (lbl) lbl.textContent = last_insights_sync ? `Synced ${timeAgo(last_insights_sync)}` : 'Not synced yet';

  // Stats panel
  try {
    const stats = await fetchStats();
    document.getElementById('statsBar').innerHTML = `
      <div><div class="num">${stats.streak}🔥</div><div class="label">Streak</div></div>
      <div><div class="num" style="text-transform:capitalize">${esc(stats.stage)}</div><div class="label">Stage</div></div>`;
  } catch {
    document.getElementById('statsBar').innerHTML = `<div style="font-size:11px;color:#9CA3AF;text-align:center;width:100%">Could not load stats</div>`;
  }

  // Leads panel
  try {
    const data = await apiCall('list-leads', {});
    const leads = (data.leads || []).slice(0, 5);
    const leadsContainer = document.getElementById('panel-leads');
    if (leads.length === 0) {
      leadsContainer.innerHTML = `<p style="text-align:center;color:#9CA3AF;font-size:11px;padding:20px 0">No leads saved yet. Visit a LinkedIn profile and click Save Lead.</p>`;
    } else {
      leadsContainer.innerHTML = leads.map(l => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(124,92,252,0.06)">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7C5CFC,#F72585);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;flex-shrink:0">${esc((l.name||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase())}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name||'Unknown')}</div>
            <div style="font-size:10px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.company||l.headline||'')}</div>
          </div>
          ${l.linkedin_url ? `<a href="${esc(l.linkedin_url)}" target="_blank" style="font-size:10px;color:#7C5CFC;text-decoration:none;flex-shrink:0">↗</a>` : ''}
        </div>`).join('') +
        `<a href="https://eclatale.com/leads" target="_blank" style="display:block;text-align:center;font-size:11px;color:#7C5CFC;font-weight:600;margin-top:8px;text-decoration:none">View all leads →</a>`;
    }
  } catch {
    document.getElementById('panel-leads').innerHTML = `<p style="text-align:center;color:#9CA3AF;font-size:11px;padding:16px 0">Could not load leads</p>`;
  }
}

render();
