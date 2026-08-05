const contentEl = document.getElementById('content');
const statsBarEl = document.getElementById('statsBar');

document.getElementById('closeBtn').addEventListener('click', () => {
  window.parent.postMessage({ type: 'ECLATALE_CLOSE_SIDEBAR' }, '*');
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function render(page, url) {
  const { token, user } = await getAuth();
  if (!token || !user) {
    contentEl.innerHTML = `
      <div class="signin">
        <p>Sign in to Eclatale to use Aria on LinkedIn.</p>
        <a class="btn-primary" href="https://eclatale.com/extension-auth" target="_blank" rel="noopener">Sign in →</a>
      </div>`;
    return;
  }

  if (page === 'feed') {
    contentEl.innerHTML = `<p class="lead">Looking for post ideas while you browse?</p><div id="ideas" class="loading">Finding ideas…</div><a class="action" href="https://eclatale.com" target="_blank" rel="noopener" style="margin-top:12px;display:block;">Open Eclatale →</a>`;
    try {
      const ideas = await fetchPostIdeas();
      const ideasEl = document.getElementById('ideas');
      if (!ideas.length) { ideasEl.innerHTML = '<p class="muted">No ideas available right now — check back after your voice profile has a bit more data.</p>'; return; }
      ideasEl.innerHTML = ideas.slice(0, 3).map(idea => `
        <div class="card">
          <p>${esc(idea.topic)}</p>
          <a class="action" href="https://eclatale.com/create/talk?topic=${encodeURIComponent(idea.topic)}" target="_blank" rel="noopener">Generate this →</a>
        </div>`).join('');
    } catch {
      document.getElementById('ideas').innerHTML = '<p class="muted">Couldn\'t load ideas right now.</p>';
    }
    return;
  }

  if (page === 'post') {
    contentEl.innerHTML = `
      <p class="lead">Want to repurpose what you're reading?</p>
      <p class="muted">Eclatale never reads LinkedIn post content automatically — click below and you'll be able to paste the text in yourself on the next screen.</p>
      <div class="card">
        <p>${esc(url)}</p>
        <a class="action" href="https://eclatale.com/create/resource?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Repurpose this post →</a>
      </div>
      <a class="btn-primary" href="https://eclatale.com/create/talk" target="_blank" rel="noopener">Generate something similar</a>`;
    return;
  }

  if (page === 'profile') {
    contentEl.innerHTML = `
      <p class="lead">Optimize a LinkedIn profile with AI</p>
      <p class="muted">If this is your profile: select and copy each section below, then paste it into Eclatale's Profile Optimizer for an AI-powered rewrite.</p>
      <div class="card"><p><strong>Headline</strong><br>Select your headline text on the page, copy it (Ctrl/Cmd+C), then paste it into the Optimizer.</p></div>
      <div class="card"><p><strong>About</strong><br>Select your About section text, copy it, then paste it into the Optimizer.</p></div>
      <div class="card"><p><strong>Experience</strong><br>Select an Experience description, copy it, then paste it into the Optimizer.</p></div>
      <a class="btn-primary" href="https://eclatale.com/profile-optimizer" target="_blank" rel="noopener">Open Profile Optimizer →</a>`;
    return;
  }

  if (page === 'company') {
    contentEl.innerHTML = `
      <p class="lead">Want to post about this company?</p>
      <p class="muted">Generate a post with an angle about this company — you'll fill in the specifics on the next screen.</p>
      <a class="btn-primary" href="https://eclatale.com/create/talk?topic=${encodeURIComponent('a company I follow on LinkedIn')}" target="_blank" rel="noopener">Generate this post →</a>`;
    return;
  }

  contentEl.innerHTML = `<p class="lead">Ready when you are.</p><a class="btn-primary" href="https://eclatale.com/create" target="_blank" rel="noopener">Open Eclatale →</a>`;
}

async function renderStats() {
  const { token, user } = await getAuth();
  if (!token || !user) { statsBarEl.innerHTML = ''; return; }
  try {
    const stats = await fetchStats();
    statsBarEl.innerHTML = `
      <div class="stats">
        <div><div class="num">${stats.streak}🔥</div><div class="label">Streak</div></div>
        <div><div class="num" style="text-transform:capitalize">${esc(stats.stage)}</div><div class="label">Stage</div></div>
      </div>`;
  } catch { statsBarEl.innerHTML = ''; }
}

window.addEventListener('message', (e) => {
  if (e.data?.type === 'ECLATALE_PAGE_CONTEXT') {
    render(e.data.page, e.data.url);
    renderStats();
  }
});
