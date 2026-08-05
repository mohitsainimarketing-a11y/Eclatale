// Runs only on linkedin.com. Injects a floating Aria button + slide-in
// sidebar. This script NEVER reads LinkedIn page content, DOM, or
// cookies — it only looks at window.location to classify which kind of
// page the user is on (feed / a post / a profile / a company page), so
// the sidebar can show relevant copy. All real data (stats, ideas) comes
// from Eclatale's own API, authenticated with the Eclatale token stored
// by the extension — never from LinkedIn itself.

(function () {
  if (window.top !== window.self) return; // don't inject into LinkedIn's iframes

  function classifyPage(pathname) {
    if (pathname === '/feed/' || pathname === '/feed') return 'feed';
    if (pathname.includes('/posts/') || pathname.includes('/feed/update/')) return 'post';
    if (pathname.startsWith('/in/')) return 'profile';
    if (pathname.startsWith('/company/')) return 'company';
    return 'other';
  }

  const btn = document.createElement('button');
  btn.id = 'eclatale-aria-button';
  btn.setAttribute('aria-label', 'Open Aria, your Eclatale brand assistant');
  btn.textContent = 'A';
  document.documentElement.appendChild(btn);

  let panelOpen = false;
  let iframe = null;

  function openPanel() {
    if (panelOpen) return;
    panelOpen = true;
    iframe = document.createElement('iframe');
    iframe.id = 'eclatale-aria-frame';
    iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
    document.documentElement.appendChild(iframe);
    requestAnimationFrame(() => iframe.classList.add('open'));

    iframe.addEventListener('load', () => {
      iframe.contentWindow.postMessage({
        type: 'ECLATALE_PAGE_CONTEXT',
        page: classifyPage(window.location.pathname),
        url: window.location.href,
      }, '*');
    });
  }

  function closePanel() {
    if (!panelOpen || !iframe) return;
    panelOpen = false;
    iframe.classList.remove('open');
    setTimeout(() => { iframe?.remove(); iframe = null; }, 250);
  }

  btn.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'ECLATALE_CLOSE_SIDEBAR') closePanel();
  });

  // SPA navigation: LinkedIn is a single-page app, so re-classify and tell
  // an already-open sidebar about the new page without a full reload.
  let lastPath = window.location.pathname;
  new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      if (panelOpen && iframe) {
        iframe.contentWindow.postMessage({
          type: 'ECLATALE_PAGE_CONTEXT',
          page: classifyPage(lastPath),
          url: window.location.href,
        }, '*');
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
