// Thin wrapper around the existing Eclatale backend. The extension calls
// the same /api/intelligence multiplexer the web app uses — no separate
// extension-only API surface, so there's nothing new to keep in sync.

const ECLATALE_API = 'https://backend-xi-olive-8eewk5s8qv.vercel.app';

async function apiCall(action, body = {}) {
  const { token, user } = await getAuth();
  if (!token || !user) throw new Error('Not signed in');
  const res = await fetch(`${ECLATALE_API}/api/intelligence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, userId: user.id, ...body }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function fetchStats() {
  const [journey] = await Promise.all([apiCall('growth-journey')]);
  return {
    streak: journey?.metrics?.currentStreak ?? 0,
    stage: journey?.stage ?? 'unknown',
  };
}

async function fetchPostIdeas() {
  const { token, user } = await getAuth();
  if (!token || !user) throw new Error('Not signed in');
  const res = await fetch(`${ECLATALE_API}/api/suggest-topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: '', userId: user.id }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.topics) ? data.topics : [];
}
