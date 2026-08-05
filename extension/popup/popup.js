const contentEl = document.getElementById('content');

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function initials(name) {
  return (name || 'Y').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function copyText(text, btn) {
  await navigator.clipboard.writeText(text);
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = original; }, 1500);
}

async function render() {
  const { token, user } = await getAuth();
  const tab = await getActiveTab();
  const onLinkedInProfile = !!tab?.url && /^https:\/\/www\.linkedin\.com\/in\//.test(tab.url);

  if (!token || !user) {
    contentEl.innerHTML = `
      <div class="signin">
        <p>Sign in to Eclatale to use your brand assistant.</p>
      </div>
      <button class="btn-primary" id="signInBtn">Sign in →</button>`;
    document.getElementById('signInBtn').addEventListener('click', openSignIn);
    return;
  }

  const pageLabel = onLinkedInProfile ? 'On your LinkedIn profile' : (tab?.title ? esc(tab.title).slice(0, 40) : 'Ready to help');

  contentEl.innerHTML = `
    <div class="user-row">
      <img class="avatar" src="${user.avatarUrl ? esc(user.avatarUrl) : ''}" onerror="this.style.display='none'" alt="">
      <div>
        <div class="name">${esc(user.firstName || user.name || 'there')}</div>
        <div class="context">${pageLabel}</div>
      </div>
    </div>

    <a class="btn-primary" id="generateBtn" href="https://eclatale.com/create" target="_blank" rel="noopener">✨ Generate a post</a>

    ${onLinkedInProfile ? `
    <div class="section" id="profileSection">
      <p class="hint">Copy each section of your LinkedIn profile and paste it into Eclatale's Profile Optimizer to get AI-powered improvements.</p>
      <div class="copy-row"><span>Headline</span><button data-copy="headline">Select &amp; copy →</button></div>
      <div class="copy-row"><span>About</span><button data-copy="about">Select &amp; copy →</button></div>
      <div class="copy-row"><span>Experience</span><button data-copy="experience">Select &amp; copy →</button></div>
      <a class="btn-secondary" href="https://eclatale.com/profile-optimizer" target="_blank" rel="noopener" style="margin-top:6px;">Open Profile Optimizer →</a>
    </div>` : ''}

    <div class="section" id="repurposeSection">
      <p class="hint">Repurpose content from: <strong>${tab?.title ? esc(tab.title).slice(0, 60) : 'this page'}</strong></p>
      <a class="btn-secondary" id="repurposeBtn" href="#" target="_blank" rel="noopener">🔄 Send to Eclatale →</a>
    </div>

    <div class="stats" id="statsBar"><div class="loading">Loading stats…</div></div>
    <button id="signOutBtn" style="width:100%;text-align:center;background:none;border:none;color:#9CA3AF;font-size:11px;margin-top:10px;cursor:pointer;">Sign out of extension</button>
  `;

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await clearAuth();
    render();
  });

  document.getElementById('repurposeBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const url = `https://eclatale.com/create/resource?url=${encodeURIComponent(tab?.url || '')}`;
    chrome.tabs.create({ url });
  });

  document.querySelectorAll('#profileSection button[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.textContent = 'Now select the text on the page and press Ctrl/Cmd+C';
      setTimeout(() => { btn.textContent = 'Select & copy →'; }, 3000);
    });
  });

  const statsBar = document.getElementById('statsBar');
  try {
    const stats = await fetchStats();
    statsBar.innerHTML = `
      <div><div class="num">${stats.streak}🔥</div><div class="label">Streak</div></div>
      <div><div class="num" style="text-transform:capitalize">${esc(stats.stage)}</div><div class="label">Growth stage</div></div>
    `;
  } catch {
    statsBar.innerHTML = `<div class="label" style="text-align:center;width:100%;">Couldn't load stats.</div>`;
  }
}

render();
