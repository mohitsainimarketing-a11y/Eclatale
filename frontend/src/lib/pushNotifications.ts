import { apiFetch } from './apiFetch';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// Returns Uint8Array<ArrayBuffer> rather than plain Uint8Array: since TS 5.7
// the type is generic over ArrayBufferLike, and applicationServerKey requires
// a BufferSource, which SharedArrayBuffer-backed views do not satisfy.
// Allocating the ArrayBuffer explicitly pins the backing type — Uint8Array.from
// would infer the looser ArrayBufferLike and fail to typecheck.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const ready = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const subscription = await (ready.pushManager.getSubscription() || Promise.resolve(null)).then(existing =>
      existing || registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    );

    await apiFetch(`${API_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function maybePromptPush(userId: string) {
  if (!pushSupported()) return;
  if (Notification.permission !== 'default') return;
  if (localStorage.getItem('eclatale_push_prompted')) return;
  localStorage.setItem('eclatale_push_prompted', 'true');
  await subscribeToPush(userId);
}
