importScripts('utils/auth.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'repurpose-with-eclatale',
    title: 'Repurpose with Eclatale',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'repurpose-with-eclatale' || !info.selectionText) return;
  const MAX_CHARS = 2000;
  let text = info.selectionText;
  let truncated = false;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
    truncated = true;
  }
  const encoded = encodeURIComponent(text);
  const url = `https://eclatale.com/create/resource?text=${encoded}${truncated ? '&truncated=1' : ''}`;
  chrome.tabs.create({ url });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Sent to Eclatale',
    message: truncated
      ? 'Your selection was sent (truncated to 2000 characters). Opening Drop a Resource…'
      : 'Your selection was sent. Opening Drop a Resource…',
  });
});

// Receives the Supabase access token from the extension-auth page on
// eclatale.com via postMessage → this listener (registered by the page
// itself, see ExtensionAuth.tsx) relays it into chrome.storage.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!sender.url || !sender.url.startsWith('https://eclatale.com/')) {
    sendResponse({ ok: false, error: 'untrusted sender' });
    return;
  }
  if (message?.type === 'ECLATALE_AUTH' && message.token && message.user) {
    setAuth(message.token, message.user).then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
  if (message?.type === 'ECLATALE_SIGN_OUT') {
    clearAuth().then(() => sendResponse({ ok: true }));
    return true;
  }
  sendResponse({ ok: false, error: 'unknown message type' });
});
