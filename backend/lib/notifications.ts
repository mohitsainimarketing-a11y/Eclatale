import type { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails('mailto:info@eclatale.com', pub, priv);
    vapidConfigured = true;
  }
}

export async function createNotification(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  message: string,
  cta?: { text: string; url: string }
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    cta_text: cta?.text || null,
    cta_url: cta?.url || null,
  });
  await sendPushToUser(supabase, userId, title, message, cta?.url);
}

export async function sendPushToUser(supabase: SupabaseClient, userId: string, title: string, message: string, url?: string) {
  ensureVapid();
  if (!vapidConfigured) return;

  const { data: subs } = await supabase.from('push_subscriptions').select('id, subscription').eq('user_id', userId);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, message, url: url || 'https://eclatale.com/dashboard' });
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription as any, payload);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id);
      }
    }
  }
}

const POST_MILESTONES: Record<number, string> = {
  1: "🎉 First post published! Your brand journey has begun.",
  5: "✨ 5 posts! Your voice is starting to emerge.",
  10: "🔥 10 posts! Eclatale knows your voice well now.",
  25: "💪 25 posts! You're a consistent LinkedIn creator.",
  50: "🏆 50 posts! You're in the top tier of LinkedIn creators.",
};

export async function checkPostMilestone(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'published');
  const n = count || 0;
  const message = POST_MILESTONES[n];
  if (message) {
    await createNotification(supabase, userId, 'post_milestone', `${n} Post${n === 1 ? '' : 's'} Published`, message);
  }
}

const GROWTH_MILESTONES: Record<number, string> = {
  25: "📈 Growth Score: 25! You're getting started.",
  50: "📈 Growth Score: 50! You've hit the halfway mark.",
  75: "🚀 Growth Score: 75! You're in elite territory.",
  90: "🏆 Growth Score: 90! Top 5% of all Eclatale users.",
};

export async function checkGrowthMilestone(supabase: SupabaseClient, userId: string, score: number) {
  const hit = Object.keys(GROWTH_MILESTONES).map(Number).sort((a, b) => b - a).find(m => score >= m);
  if (!hit) return;
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', `growth_milestone_${hit}`)
    .limit(1);
  if (existing && existing.length > 0) return;
  await createNotification(supabase, userId, `growth_milestone_${hit}`, `Growth Score: ${hit}`, GROWTH_MILESTONES[hit]);
}

const STREAK_MILESTONES: Record<number, string> = {
  3: "🔥 3-day streak! You're building momentum.",
  7: "🔥 One week streak! Your consistency is paying off.",
  14: "🔥 2-week streak! You're in the top 10% of creators.",
  30: "🏆 30-day streak! You're a LinkedIn powerhouse.",
};

export async function checkStreakMilestone(supabase: SupabaseClient, userId: string, streakDays: number) {
  const message = STREAK_MILESTONES[streakDays];
  if (!message) return;
  const type = `streak_${streakDays}`;
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .limit(1);
  if (existing && existing.length > 0) return;
  await createNotification(supabase, userId, type, `${streakDays}-Day Streak`, message);
}
