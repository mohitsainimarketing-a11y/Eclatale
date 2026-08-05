// Shared auth helpers — used by popup.js, sidebar.js, and background.js.
// The extension never touches LinkedIn's session; it only stores the
// Eclatale Supabase access token, in extension-local storage (not synced,
// not accessible to any web page).

const ECLATALE_ORIGIN = 'https://eclatale.com';

async function getAuth() {
  const { eclatale_token, eclatale_user } = await chrome.storage.local.get(['eclatale_token', 'eclatale_user']);
  return { token: eclatale_token || null, user: eclatale_user || null };
}

async function setAuth(token, user) {
  await chrome.storage.local.set({ eclatale_token: token, eclatale_user: user });
}

async function clearAuth() {
  await chrome.storage.local.remove(['eclatale_token', 'eclatale_user']);
}

function openSignIn() {
  // Passing our own extension ID lets the web page message us back via
  // chrome.runtime.sendMessage without hardcoding an ID anywhere — works
  // the same whether this is an unpacked dev build (random ID each load)
  // or the published Chrome Web Store version (fixed ID).
  chrome.tabs.create({ url: `${ECLATALE_ORIGIN}/extension-auth?extId=${chrome.runtime.id}` });
}
