import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDateContext } from './dateContext';

export interface DigestData {
  userId: string;
  email: string;
  firstName: string;
  role: string;
  industry: string;
  postsLastWeek: number;
  streak: number;
  growthScore: number;
  subject: string;
  greetingName: string;
  topicSuggestions: string[];
  tipOfWeek: string;
  intro: string;
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const days = new Set(dates.map(d => new Date(d).toISOString().split('T')[0]));
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (days.has(d.toISOString().split('T')[0])) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function parseJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

/** Gather real per-user data and have Claude generate the personalized copy. */
export async function buildDigestData(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  userId: string
): Promise<DigestData | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, domain, goals, first_name, timezone')
    .eq('id', userId)
    .single();

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email || '';
  if (!email) return null;

  const role = profile?.role || 'professional';
  const industry = profile?.domain || 'business';
  const goals: string[] = profile?.goals || [];
  const firstName = profile?.first_name || (email.split('@')[0] || 'there');

  const { data: posts } = await supabase
    .from('posts')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const allDates = (posts || []).map((p: any) => p.created_at);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const postsLastWeek = allDates.filter(d => new Date(d).getTime() >= weekAgo).length;
  const streak = computeStreak(allDates);

  const { data: persona } = await supabase
    .from('persona_profiles')
    .select('persona_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  const hasProfile = !!(profile?.role && profile?.domain && goals.length);
  const hasPersona = !!persona?.persona_completed_at;
  const totalPosts = allDates.length;
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const postsThisWeek = allDates.filter(d => new Date(d) >= weekStart).length;
  const growthScore = Math.min(100, Math.round(
    (hasProfile ? 15 : 0) + (hasPersona ? 15 : 0) + Math.min(20, totalPosts * 4) +
    Math.min(25, streak * 5) + Math.min(25, postsThisWeek * 8)
  ));

  const goalsText = goals.length ? `Their growth goals: ${goals.join(', ')}.` : '';
  const prompt = `You are writing a warm, sharp weekly digest email for a LinkedIn personal-brand tool called Eclatale.

The reader:
- Name: ${firstName}
- Role: ${role}
- Industry: ${industry}
${goalsText}

Their week: created ${postsLastWeek} posts, current posting streak ${streak} days, Growth Score ${growthScore}/100.

Generate a JSON object with EXACTLY these fields:
{
  "subject": "a personalized, curiosity-driven subject line under 60 chars, using their first name",
  "intro": "one warm, specific opening sentence acknowledging their week (reference their real numbers naturally)",
  "topicSuggestions": ["3 specific, timely LinkedIn post ideas tailored to a ${role} in ${industry}, each immediately writable, no generic slop"],
  "tipOfWeek": "one specific, actionable tip relevant to a ${role} in ${industry} to grow their brand this week"
}

No em dashes, en dashes, or arrows. Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    system: getDateContext(),
    messages: [{ role: 'user', content: prompt }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const parsed = parseJsonObject(text);

  return {
    userId,
    email,
    firstName,
    role,
    industry,
    postsLastWeek,
    streak,
    growthScore,
    subject: parsed.subject || `${firstName}, your brand grew last week`,
    greetingName: firstName,
    topicSuggestions: Array.isArray(parsed.topicSuggestions) ? parsed.topicSuggestions.slice(0, 3) : [],
    tipOfWeek: parsed.tipOfWeek || '',
    intro: parsed.intro || '',
  };
}

/** Inline-CSS, mobile-responsive HTML that renders in Gmail, Outlook, Apple Mail. */
export function renderDigestHTML(d: DigestData): string {
  const appUrl = 'https://eclatale.com';
  const topics = d.topicSuggestions.map((t, i) => `
    <tr>
      <td style="padding:0 0 10px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #efeafc;border-radius:12px;">
          <tr>
            <td style="padding:14px 16px;">
              <p style="margin:0 0 8px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1433;font-weight:600;">${escapeHtml(t)}</p>
              <a href="${appUrl}/create?topic=${encodeURIComponent(t)}" style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#7C5CFC;text-decoration:none;font-weight:700;">Write about this &rarr;</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(d.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1fb;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:0 24px 16px 24px;">
          <div style="background:linear-gradient(135deg,#7C5CFC 0%,#F72585 55%,#FF6B35 100%);border-radius:16px;padding:28px 24px;">
            <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:0.5px;">ECLATALE WEEKLY</p>
            <h1 style="margin:6px 0 0 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;color:#ffffff;font-weight:800;">${escapeHtml(d.intro)}</h1>
          </div>
        </td></tr>

        <!-- Stats -->
        <tr><td style="padding:0 24px 8px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${statCell(String(d.postsLastWeek), 'posts last week')}
              ${statCell(d.streak + 'd', 'current streak')}
              ${statCell(d.growthScore + '/100', 'growth score')}
            </tr>
          </table>
        </td></tr>

        <!-- Topics -->
        <tr><td style="padding:16px 24px 0 24px;">
          <p style="margin:0 0 12px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#8a7fa8;font-weight:700;letter-spacing:1px;text-transform:uppercase;">3 ideas for this week</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${topics}</table>
        </td></tr>

        <!-- Tip -->
        <tr><td style="padding:8px 24px 0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebff;border-radius:12px;">
            <tr><td style="padding:16px;">
              <p style="margin:0 0 6px 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#7C5CFC;font-weight:700;letter-spacing:0.5px;">TIP OF THE WEEK</p>
              <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1433;">${escapeHtml(d.tipOfWeek)}</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:20px 24px;" align="center">
          <a href="${appUrl}/create" style="display:inline-block;background:#7C5CFC;color:#ffffff;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;">Write your next post</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:8px 24px 0 24px;" align="center">
          <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#a99fc0;">You are receiving this because weekly digests are on for your Eclatale account.<br><a href="${appUrl}/settings" style="color:#8a7fa8;text-decoration:underline;">Manage email preferences</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function statCell(value: string, label: string): string {
  return `<td width="33%" style="padding:0 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #efeafc;border-radius:12px;">
      <tr><td align="center" style="padding:16px 8px;">
        <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;color:#7C5CFC;">${escapeHtml(value)}</p>
        <p style="margin:4px 0 0 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:#8a7fa8;">${escapeHtml(label)}</p>
      </td></tr>
    </table>
  </td>`;
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Send via SendGrid REST API (no SDK dependency). Returns whether it was actually sent. */
export async function sendDigestEmail(d: DigestData): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { sent: false, reason: 'SENDGRID_API_KEY not configured' };

  const fromEmail = process.env.DIGEST_FROM_EMAIL || 'hello@eclatale.com';
  const html = renderDigestHTML(d);

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: d.email }] }],
      from: { email: fromEmail, name: 'Eclatale' },
      subject: d.subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { sent: false, reason: `SendGrid error ${res.status}: ${err.substring(0, 200)}` };
  }
  return { sent: true };
}
