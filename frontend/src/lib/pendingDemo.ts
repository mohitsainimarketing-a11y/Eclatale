// Handoff for the signup-gated homepage demo.
//
// The demo never calls Claude for an anonymous visitor: it captures the topic
// and style they picked, sends them through signup, and the post is written
// once they land in /create as a real, rate-limited user. This module owns the
// storage key so the landing page, the auth callbacks and /create cannot drift.
//
// Every accessor is wrapped: localStorage throws outright in Safari private
// mode, and a demo handoff is never important enough to break a signup over.

const PENDING_DEMO_KEY = 'eclatale_demo_pending';

// A topic picked days ago is not what the user came back for — silently
// generating it would be surprising, so a stale handoff is discarded.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingDemo = { topic: string; style: string };

export function writePendingDemo(topic: string, style: string): void {
  try {
    localStorage.setItem(PENDING_DEMO_KEY, JSON.stringify({ topic, style, createdAt: Date.now() }));
  } catch {}
}

/** True if a handoff is waiting. Does not consume it. */
export function hasPendingDemo(): boolean {
  try {
    return !!localStorage.getItem(PENDING_DEMO_KEY);
  } catch {
    return false;
  }
}

/**
 * Reads and clears the handoff. Always clears, even when the payload turns out
 * to be stale or malformed, so a bad value cannot wedge every later visit to
 * /create in demo mode.
 */
export function consumePendingDemo(): PendingDemo | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PENDING_DEMO_KEY); } catch { return null; }
  if (!raw) return null;
  try { localStorage.removeItem(PENDING_DEMO_KEY); } catch {}
  try {
    const parsed = JSON.parse(raw);
    const topic = String(parsed?.topic || '').trim();
    if (!topic) return null;
    if (Date.now() - Number(parsed?.createdAt || 0) > MAX_AGE_MS) return null;
    return { topic, style: String(parsed?.style || '') };
  } catch {
    return null;
  }
}
