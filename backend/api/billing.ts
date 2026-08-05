import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '../lib/emailService';
import { createNotification } from '../lib/notifications';
import { checkAuthToken, reconcileUserId } from '../lib/verifyAuth';

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const APP_URL = 'https://eclatale.com';
const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID!;
const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID!;
const LAUNCH50_PROMO_CODE_ID = process.env.STRIPE_LAUNCH50_PROMO_CODE_ID;

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
  return customer.id;
}

async function createCheckout(userId: string, email: string, priceId: string, applyLaunchPromo: boolean) {
  const price = priceId === 'annual' ? ANNUAL_PRICE_ID : priceId === 'monthly' ? MONTHLY_PRICE_ID : priceId;
  const customerId = await getOrCreateCustomer(userId, email);

  const useAutoPromo = applyLaunchPromo && !!LAUNCH50_PROMO_CODE_ID;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price, quantity: 1 }],
    mode: 'subscription',
    ...(useAutoPromo ? { discounts: [{ promotion_code: LAUNCH50_PROMO_CODE_ID! }] } : { allow_promotion_codes: true }),
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId, eclatale_tier: 'individual' },
    },
    success_url: `${APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pricing?cancelled=true`,
    metadata: { userId },
    billing_address_collection: 'auto',
    customer_update: { address: 'auto' },
  });

  return { checkoutUrl: session.url };
}

async function createPortalSession(userId: string) {
  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
  if (!profile?.stripe_customer_id) throw new Error('No Stripe customer on file for this user');

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${APP_URL}/settings`,
  });
  return { portalUrl: session.url };
}

async function subscriptionStatus(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_status, trial_ends_at, current_period_end, cancel_at_period_end, subscription_cancels_at')
    .eq('id', userId)
    .maybeSingle();

  return {
    tier: profile?.subscription_tier || 'free',
    status: profile?.subscription_status || 'free',
    trialEndsAt: profile?.trial_ends_at || null,
    currentPeriodEnd: profile?.current_period_end || null,
    cancelAtPeriodEnd: !!profile?.cancel_at_period_end,
    cancelAt: profile?.subscription_cancels_at || null,
  };
}

async function cancelSubscription(userId: string, reason: string, feedback: string) {
  const { data: profile } = await supabase.from('profiles').select('stripe_subscription_id, current_period_end').eq('id', userId).maybeSingle();
  if (!profile?.stripe_subscription_id) throw new Error('No active subscription found');

  const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const accessUntil = new Date((subscription as any).current_period_end * 1000).toISOString();

  await supabase.from('profiles').update({
    cancel_at_period_end: true,
    subscription_cancels_at: accessUntil,
    cancellation_reason: `${reason}${feedback ? `: ${feedback}` : ''}`,
  }).eq('id', userId);

  return { cancelledAt: new Date().toISOString(), accessUntil };
}

function refundEligibility(firstChargeAt: string | null): 'auto' | 'review' | 'declined' {
  if (!firstChargeAt) return 'declined';
  const days = (Date.now() - new Date(firstChargeAt).getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 7) return 'auto';
  if (days <= 30) return 'review';
  return 'declined';
}

async function requestRefund(userId: string, reason: string, details: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, first_charge_at')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.stripe_customer_id) throw new Error('No billing account found for this user');

  const eligibility = refundEligibility(profile.first_charge_at);

  if (eligibility === 'declined') {
    return { status: 'declined', message: 'Refunds are only available within 30 days of your first charge.' };
  }

  if (eligibility === 'review') {
    await supabase.from('refunds').insert({
      user_id: userId, reason, details, status: 'pending', auto_approved: false,
    });
    return { status: 'pending_review', message: "We'll review your request and follow up within 48 hours." };
  }

  // eligibility === 'auto'
  const invoices = await stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 1, status: 'paid' });
  const paymentIntentId = (invoices.data[0] as any)?.payment_intent;
  if (!paymentIntentId) {
    await supabase.from('refunds').insert({ user_id: userId, reason, details, status: 'pending', auto_approved: false });
    return { status: 'pending_review', message: 'Could not locate your latest charge automatically; our team will process this manually.' };
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: 'requested_by_customer',
    metadata: { userId, reason },
  });

  if (profile.stripe_subscription_id) {
    try { await stripe.subscriptions.cancel(profile.stripe_subscription_id); } catch { /* best effort */ }
  }

  await supabase.from('refunds').insert({
    user_id: userId, stripe_refund_id: refund.id, amount: refund.amount, reason, details,
    status: 'completed', auto_approved: true, processed_at: new Date().toISOString(),
  });
  await supabase.from('profiles').update({ subscription_tier: 'free', subscription_status: 'cancelled' }).eq('id', userId);

  return { status: 'approved', message: 'Your refund has been processed and should appear in 5-10 business days.' };
}

// ---- Webhook handlers ----

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const subscriptionId = session.subscription as string;
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('profiles').update({
    subscription_tier: 'individual',
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscriptionId,
    subscription_status: 'trialing',
    subscription_started_at: new Date().toISOString(),
    trial_ends_at: trialEndsAt,
  }).eq('id', userId);

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (email) {
    const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', userId).maybeSingle();
    await sendWelcomeEmail(userId, email, profile?.first_name || 'there');
  }
  await createNotification(
    supabase, userId, 'upgrade_success', 'Welcome to Individual!',
    "🎉 Welcome to Individual! All features unlocked. Let's build your brand.",
    { text: 'Start Creating', url: 'https://eclatale.com/create' }
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_subscription_id', subscription.id).maybeSingle();
  if (!profile) return;

  const patch: Record<string, any> = {
    subscription_status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
  };
  if (subscription.cancel_at_period_end) {
    patch.subscription_cancels_at = new Date((subscription as any).current_period_end * 1000).toISOString();
  }
  await supabase.from('profiles').update(patch).eq('id', profile.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_subscription_id', subscription.id).maybeSingle();
  if (!profile) return;
  await supabase.from('profiles').update({
    subscription_tier: 'free',
    subscription_status: 'cancelled',
  }).eq('id', profile.id);
  await createNotification(
    supabase, profile.id, 'subscription_cancelled', 'Subscription cancelled',
    "Your Individual plan has ended. Come back anytime — your data is still here.",
    { text: 'Reactivate for 50% off', url: 'https://eclatale.com/pricing' }
  );
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const { data: profile } = await supabase.from('profiles').select('id, first_charge_at').eq('stripe_customer_id', customerId).maybeSingle();
  if (!profile) return;
  const patch: Record<string, any> = { subscription_status: 'active' };
  if (!profile.first_charge_at) patch.first_charge_at = new Date().toISOString();
  await supabase.from('profiles').update(patch).eq('id', profile.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  if (!profile) return;
  await supabase.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id);
  await createNotification(
    supabase, profile.id, 'payment_failed', 'Payment failed',
    "We couldn't process your payment. Update your payment method to keep your Individual features.",
    { text: 'Update payment method', url: 'https://eclatale.com/settings' }
  );
}

async function handleChargeDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = dispute.charge as string;
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer as string | null;
  let userId: string | null = null;
  if (customerId) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = profile?.id || null;
  }
  await supabase.from('disputes').insert({
    user_id: userId, stripe_dispute_id: dispute.id, amount: dispute.amount, reason: dispute.reason, status: dispute.status,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = charge.customer as string | null;
  if (!customerId) return;
  const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  if (!profile) return;
  await supabase.from('refunds').upsert(
    { user_id: profile.id, stripe_refund_id: charge.refunds?.data[0]?.id || charge.id, amount: charge.amount_refunded, status: 'completed', processed_at: new Date().toISOString() },
    { onConflict: 'stripe_refund_id' }
  );
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  const signature = req.headers['stripe-signature'];
  const rawBody = await readRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
    }
  } catch (err: any) {
    console.error(`Webhook handler error for ${event.type}:`, err);
  }

  return res.status(200).json({ received: true });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', 'http://localhost');
  const action = url.searchParams.get('action') || '';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (action === 'webhook') {
    return handleWebhook(req, res);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  let body: any = {};
  if (req.method === 'POST') {
    const raw = await readRawBody(req);
    try { body = raw.length ? JSON.parse(raw.toString('utf-8')) : {}; } catch { body = {}; }
  }
  const query = Object.fromEntries(url.searchParams.entries());
  const rawUserId = String(body.userId || query.userId || '');
  let userId = rawUserId;
  if (rawUserId) {
    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(rawUserId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;
  }

  try {
    switch (action) {
      case 'create-checkout': {
        const { email, priceId, billingCycle, applyLaunchPromo } = body;
        if (!userId || !email || (!priceId && !billingCycle)) return res.status(400).json({ error: 'Missing userId, email, or priceId/billingCycle' });
        const result = await createCheckout(userId, email, priceId || billingCycle, applyLaunchPromo !== false);
        return res.json(result);
      }
      case 'customer-portal': {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const result = await createPortalSession(userId);
        return res.json(result);
      }
      case 'subscription-status': {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const result = await subscriptionStatus(userId);
        return res.json(result);
      }
      case 'cancel-subscription': {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const result = await cancelSubscription(userId, body.reason || '', body.feedback || '');
        return res.json(result);
      }
      case 'request-refund': {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const result = await requestRefund(userId, body.reason || '', body.details || '');
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Billing error:', error);
    return res.status(500).json({ error: error.message || 'Billing request failed' });
  }
}
