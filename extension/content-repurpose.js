// Runs on all pages. Shows a small floating "Repurpose with Eclatale"
// button near the user's text selection — a visible, discoverable
// alternative to the right-click context menu item (background.js owns
// that one). Only ever acts on text the user has explicitly selected;
// never reads page content automatically.

(function () {
  let btn = null;

  function removeBtn() {
    if (btn) { btn.remove(); btn = null; }
  }

  function showBtn(selection, rect) {
    removeBtn();
    btn = document.createElement('button');
    btn.textContent = '✨ Repurpose with Eclatale';
    Object.assign(btn.style, {
      position: 'fixed',
      left: `${Math.min(window.innerWidth - 200, Math.max(8, rect.left))}px`,
      top: `${Math.max(8, rect.top - 36)}px`,
      zIndex: '2147483647',
      background: 'linear-gradient(135deg, #7C5CFC 0%, #F72585 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 8px 24px rgba(124,92,252,0.35)',
      cursor: 'pointer',
    });
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // don't clear the selection on click
    btn.addEventListener('click', () => {
      const MAX_CHARS = 2000;
      let text = selection;
      let truncated = false;
      if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); truncated = true; }
      const encoded = encodeURIComponent(text);
      window.open(`https://eclatale.com/create/resource?text=${encoded}${truncated ? '&truncated=1' : ''}`, '_blank');
      removeBtn();
    });
    document.body.appendChild(btn);
  }

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      if (!text || text.length < 20) { removeBtn(); return; }
      if (window.location.hostname.endsWith('eclatale.com')) return; // don't show it on our own app
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showBtn(text, rect);
    }, 0);
  });

  document.addEventListener('mousedown', (e) => {
    if (btn && e.target !== btn) removeBtn();
  });
})();
