import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type EmailType = 'confirmation' | 'password_reset' | 'welcome' | 'digest' | 'free_limit' | 'reengagement';

const TEMPLATE_FILE: Record<EmailType, string> = {
  confirmation: 'confirmation.html',
  password_reset: 'password-reset.html',
  welcome: 'welcome.html',
  digest: 'weekly-digest.html',
  free_limit: 'free-limit.html',
  reengagement: 'reengagement.html',
};

const SUBJECTS: Record<EmailType, string> = {
  confirmation: "Confirm your Eclatale account ✉️",
  password_reset: "Reset your Eclatale password 🔑",
  welcome: "Welcome to Eclatale! Here's how to get started 🚀",
  digest: 'Your Eclatale brand update this week 📊',
  free_limit: "You've used all your free posts this week ⚡",
  reengagement: 'Your personal brand is waiting 👋',
};

// Preference gating uses the existing notif_* boolean columns on profiles
// (already wired to toggles in Settings.tsx) rather than a separate jsonb
// column, so unsubscribing here matches what the in-app settings show.
// welcome/free_limit have no dedicated toggle yet and always send.
const PREFERENCE_COLUMN: Partial<Record<EmailType, 'notif_weekly_digest' | 'notif_post_reminders'>> = {
  digest: 'notif_weekly_digest',
  reengagement: 'notif_post_reminders',
};

const FROM_NOREPLY = process.env.GMAIL_FROM_NOREPLY || 'noreply@eclatale.com';
const FROM_HELLO = process.env.GMAIL_FROM_HELLO || 'hello@eclatale.com';

const TRANSACTIONAL_TYPES = new Set<EmailType>(['confirmation', 'password_reset']);

let transactionalTransport: nodemailer.Transporter | null = null;
let marketingTransport: nodemailer.Transporter | null = null;

function getTransport(emailType: EmailType): { transport: nodemailer.Transporter; from: string } {
  const host = process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.GMAIL_SMTP_PORT || 587);

  if (TRANSACTIONAL_TYPES.has(emailType)) {
    if (!transactionalTransport) {
      transactionalTransport = nodemailer.createTransport({
        host, port, secure: false,
        auth: { user: FROM_NOREPLY, pass: process.env.GMAIL_NOREPLY_PASSWORD },
      });
    }
    return { transport: transactionalTransport, from: FROM_NOREPLY };
  }

  if (!marketingTransport) {
    marketingTransport = nodemailer.createTransport({
      host, port, secure: false,
      auth: { user: FROM_HELLO, pass: process.env.GMAIL_HELLO_PASSWORD },
    });
  }
  return { transport: marketingTransport, from: FROM_HELLO };
}

const templateCache = new Map<string, string>();

function loadFile(relPath: string): string {
  const cached = templateCache.get(relPath);
  if (cached) return cached;
  const full = path.join(__dirname, '../templates/emails', relPath);
  const content = fs.readFileSync(full, 'utf-8');
  templateCache.set(relPath, content);
  return content;
}

function fillTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? vars[key] : ''));
}

function renderEmail(emailType: EmailType, bodyVars: Record<string, string>, shellVars: Record<string, string>): string {
  const bodyTemplate = loadFile(TEMPLATE_FILE[emailType]);
  const body = fillTemplate(bodyTemplate, bodyVars);
  const shellTemplate = loadFile('_shell.html');
  return fillTemplate(shellTemplate, { ...shellVars, BODY: body });
}

async function getUnsubscribeToken(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('unsubscribe_token').eq('id', userId).maybeSingle();
  return data?.unsubscribe_token || '';
}

async function shouldSend(userId: string, emailType: EmailType): Promise<boolean> {
  const column = PREFERENCE_COLUMN[emailType];
  if (!column) return true; // transactional / no dedicated toggle yet
  const { data } = await supabase.from('profiles').select(column).eq('id', userId).maybeSingle();
  const value = (data as any)?.[column];
  return value !== false; // default opted-in when null/absent
}

async function logEmail(userId: string, emailType: EmailType, sentTo: string, status: 'sent' | 'failed' | 'skipped', metadata: Record<string, unknown> = {}) {
  await supabase.from('email_log').insert({ user_id: userId, email_type: emailType, sent_to: sentTo, status, metadata });
}

async function send(
  userId: string,
  emailType: EmailType,
  to: string,
  subject: string,
  bodyVars: Record<string, string>
): Promise<{ sent: boolean; reason?: string }> {
  if (!(await shouldSend(userId, emailType))) {
    await logEmail(userId, emailType, to, 'skipped', { reason: 'preference_off' });
    return { sent: false, reason: 'preference_off' };
  }

  const token = await getUnsubscribeToken(userId);
  const unsubscribeUrl = `https://eclatale.com/unsubscribe?token=${token}&type=${PREFERENCE_COLUMN[emailType] || emailType}`;
  const html = renderEmail(emailType, bodyVars, { subject, unsubscribeUrl });

  const { transport, from } = getTransport(emailType);
  try {
    await transport.sendMail({ from: `"Eclatale" <${from}>`, to, subject, html });
    await logEmail(userId, emailType, to, 'sent');
    return { sent: true };
  } catch (error: any) {
    await logEmail(userId, emailType, to, 'failed', { error: String(error?.message || error) });
    return { sent: false, reason: String(error?.message || error) };
  }
}

export async function sendConfirmationEmail(userId: string, email: string, firstName: string, confirmationUrl: string) {
  return send(userId, 'confirmation', email, SUBJECTS.confirmation, { firstName, ctaUrl: confirmationUrl });
}

export async function sendPasswordResetEmail(userId: string, email: string, firstName: string, resetUrl: string) {
  return send(userId, 'password_reset', email, SUBJECTS.password_reset, { firstName, ctaUrl: resetUrl });
}

export async function sendWelcomeEmail(userId: string, email: string, firstName: string) {
  return send(userId, 'welcome', email, `Welcome to Eclatale, ${firstName}! Here's how to get started 🚀`, {
    firstName,
    ctaUrl: 'https://eclatale.com/dashboard',
  });
}

export interface DigestStats {
  postsCount: number;
  streak: number;
  growthScore: number;
}

export async function sendWeeklyDigest(
  userId: string,
  email: string,
  firstName: string,
  stats: DigestStats,
  topicSuggestions: string[],
  tip: string
) {
  const topicsHtml = topicSuggestions.map(t => `
    <tr><td style="padding:0 0 10px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #efeafc;border-radius:12px;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 8px 0;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1A1A2E;font-weight:600;">${escapeHtml(t)}</p>
          <a href="https://eclatale.com/create?topic=${encodeURIComponent(t)}" style="font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-size:12px;color:#7C5CFC;text-decoration:none;font-weight:700;">Write about this &rarr;</a>
        </td></tr>
      </table>
    </td></tr>`).join('');

  return send(userId, 'digest', email, `${firstName}, your Eclatale brand update this week 📊`, {
    postsCount: String(stats.postsCount),
    streak: String(stats.streak),
    growthScore: String(stats.growthScore),
    topicsHtml,
    tipOfWeek: tip,
    ctaUrl: 'https://eclatale.com/create',
  });
}

export async function sendFreeLimit(userId: string, email: string, firstName: string) {
  return send(userId, 'free_limit', email, `${firstName}, you've used all your free posts this week ⚡`, {
    firstName,
    ctaUrl: 'https://eclatale.com/#pricing',
  });
}

export async function sendReengagement(
  userId: string,
  email: string,
  firstName: string,
  stats: { lastPostDate: string; streak: number; growthScore: number }
) {
  return send(userId, 'reengagement', email, `${firstName}, your personal brand is waiting 👋`, {
    firstName,
    lastPostDate: stats.lastPostDate,
    streak: String(stats.streak),
    growthScore: String(stats.growthScore),
    ctaUrl: 'https://eclatale.com/create',
  });
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
