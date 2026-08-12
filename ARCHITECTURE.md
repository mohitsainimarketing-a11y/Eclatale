# Eclatale Architecture

## System Overview

```
                     ┌─────────────────────────────┐
                     │   eclatale.com (frontend)    │
                     │   React 19 SPA, Vercel CDN   │
                     └──────────────┬──────────────┘
                                    │ HTTPS (Bearer JWT)
                     ┌──────────────▼──────────────┐
                     │  backend-xi-olive.vercel.app │
                     │  Vercel Serverless Functions  │
                     │  (TypeScript, @vercel/node)  │
                     └──┬──────┬──────┬──────┬──────┘
                        │      │      │      │
              ┌─────────▼──┐ ┌─▼──┐ ┌▼───┐ ┌▼────────┐
              │  Supabase  │ │Ant-│ │Str-│ │LinkedIn │
              │ PostgreSQL │ │hro-│ │ipe │ │  UGC    │
              │ + Auth +   │ │pic │ │    │ │  API    │
              │  Storage   │ └────┘ └────┘ └─────────┘
              └────────────┘
                            ┌────────────┐ ┌──────────┐
                            │ Together   │ │ Gmail    │
                            │ AI (FLUX)  │ │ SMTP     │
                            └────────────┘ └──────────┘
```

---

## Architectural Decisions

### Intelligence Multiplexer Pattern

Vercel Hobby has a ~12 serverless function cap. To handle 30+ logical endpoints without hitting this limit, a single function `api/intelligence.ts` handles all requests dispatched by an `?action=` query parameter. `backend/vercel.json` maps 40 friendly URL rewrites to this one function.

```
/api/create/angles         →  /api/intelligence?action=create-angles
/api/aria/chat             →  /api/intelligence?action=aria-chat
/api/notifications         →  /api/intelligence?action=notifications-list
... (38 more)
```

This means `intelligence.ts` is 1300+ lines. It is the main maintenance bottleneck.

### Two-Mode Auth Verification

`backend/lib/verifyAuth.ts` has two modes:
1. **Token mode (preferred):** Bearer JWT verified via `supabase.auth.getUser(token)` — authoritative
2. **Body fallback (legacy):** Trusts `userId` from request body when no token header is present

The fallback exists for a staged migration (some older API callers didn't send tokens). The intention is to remove it once all callers are updated. Until then it is a security gap — see CODEBASE_AUDIT.md.

### Three Caching Layers

Expensive AI calls are cached in Supabase to reduce cost and latency:

| Cache Table | Key | TTL | What's Cached |
|---|---|---|---|
| `intelligence_cache` | (user_id, kind) | Varies by kind (24h for competitor) | Per-user intelligence results |
| `trend_cache` | domain | 6h | Trend context per industry |
| `role_domain_cache` | (role, domain, kind) | 6h–24h | Cross-user shared results (hooks, intelligence) |

### Deterministic vs AI Scoring

Brand Health Score and Voice Match Score are computed from real data without Claude calls, making them stable over time. Only the narrative explanation text uses Claude. This is an intentional design choice for diffability and cost.

### Parallel Claude Calls

Authenticity Score runs 4 Claude calls simultaneously via `Promise.all`:
- Factual accuracy check (claude-sonnet-4-6, web_search) — 40% weight
- Topic freshness check (claude-haiku-4-5) — 30% weight  
- Voice authenticity check (claude-haiku-4-5) — 30% weight
- Supporting references (claude-sonnet-4-6, web_search) — not in score, supplemental

Each web_search call has a 20-second abort timeout to prevent blocking.

### Feature Gate Mirroring

Feature gates are defined in **both** `backend/lib/featureGates.ts` (enforced server-side via `requireFeature()`) and mirrored in `frontend/src/lib/featureGates.ts` (for UI gating via the `FeatureLock` component and `useFeatureGate` hook). The **backend gate is authoritative** — the frontend gate is only UX.

---

## Auth Flow

```
1. User visits /login or /signup
2. auth.tsx: email/password → supabase.auth.signInWithPassword()
         OR: Google → GIS credential → supabase.auth.signInWithIdToken()
3. Supabase returns session with JWT
4. AuthCallback.tsx handles OAuth redirects (/auth/callback)
5. Session stored in localStorage by Supabase client
6. App.tsx: useEffect reads session → sets user state
7. apiFetch.ts: attaches JWT as Authorization: Bearer <token> on all API calls
8. Backend verifyAuth.ts: calls supabase.auth.getUser(token) to verify
9. On first login, database trigger creates profiles row
10. Frontend detects empty profile → redirects to /onboarding
```

### LinkedIn OAuth Sub-flow

```
Settings → "Connect LinkedIn"
  → GET /api/auth/linkedin/callback?action=initiate
  → Redirect to linkedin.com/oauth/v2/authorization
  → User approves
  → LinkedIn redirects to /api/auth/linkedin/callback?code=...
  → Backend exchanges code for tokens
  → Tokens stored in linkedin_connections table
  → Access token refreshed automatically (5-minute buffer) via linkedinTokenRefresh.ts
```

---

## Content Creation Flow

```
Phase 1: Angle Selection
  User enters topic
  → POST /api/create/angles (→ intelligence?action=create-angles)
  → angles.ts: claude-sonnet-4-6 + web_search (max 5 uses)
  → Returns 4 angles with hook, angle description, source, approach
  
  Optional: Hook Library panel
  → POST /api/create/hooks (→ intelligence?action=create-hooks)
  → hookLibrary.ts: personal best hooks from post_analytics
                   + curated templates from hookCtaTemplates.ts
                   + trending hooks via claude-sonnet-4-6 + web_search (cached 6h)
  
  Optional: Industry Intelligence panel
  → POST /api/create/industry-intelligence
  → industryIntelligence.ts: real hook data + claude-sonnet-4-6 + web_search (cached 24h)

Phase 2: Post Generation
  User selects angle + options (style, framework, length, tone)
  → POST /api/generate
  → generate.ts assembles prompt from:
      - persona profile (voice samples, formality, communication styles)
      - writing style instructions (writingStyles.ts)
      - content framework (AIDA/PAS/BAB/PPP)
      - content length instructions
      - trend context (trendContext.ts, cached 6h)
      - date context (dateContext.ts)
      - selected angle
  → claude-sonnet-4-6 generates post
  → Post saved to posts table with status='draft'
  → semanticAnalysis.ts runs async → post_analytics row created
  
  Refinements (each a separate API call):
  → POST /api/refine-content    (apply one instruction)
  → POST /api/adapt-content     (reformat: article/thread/caption)
  → POST /api/repurpose         (3 modes: voice/pattern/reaction)
  
  Authenticity Score (optional):
  → POST /api/intelligence?action=authenticity-score
  → 4 parallel Claude calls (2 with web_search, 20s timeout each)
  → Returns score 0-100 + breakdown + supporting references

Phase 3: Publish or Schedule
  LinkedIn publish:
  → POST /api/linkedin/publish
  → linkedinTokenRefresh.ts: ensures valid token
  → LinkedIn UGC API: POST /v2/ugcPosts
  → publish_log row created; posts.status = 'published'
  
  Schedule:
  → POST /api/schedule/create (→ intelligence?action=schedule-post)
  → posts row with scheduled_for timestamp + schedule_status='scheduled'
  → Daily cron (12pm UTC): /api/schedule/publish-due runs all due posts
```

---

## Billing Flow

```
Free tier:
  api/generate.ts checks profiles.posts_this_week
  If >= 3 and tier='free': returns 403 with upgrade prompt
  After exactly 3rd post: send-free-limit email sent once

Upgrade:
  Pricing page → POST /api/billing/create-checkout
  → billing.ts: stripe.checkout.sessions.create() with 7-day trial
  → Optional: LAUNCH50 promo code applied
  → User completes payment on Stripe-hosted page
  
Webhook (POST /api/billing/webhook):
  checkout.session.completed
    → profiles: subscription_tier='individual', subscription_status='active'
    → dates: trial_ends_at, current_period_end, first_charge_at
  customer.subscription.updated
    → Sync tier, status, cancel_at_period_end
  customer.subscription.deleted
    → tier='free', status='canceled'

Cancel:
  → POST /api/billing/cancel-subscription
  → stripe.subscriptions.update({ cancel_at_period_end: true })
  → profiles.cancel_at_period_end = true

Refund:
  → POST /api/billing/request-refund
  → ≤7 days since first_charge: auto-refund via stripe.refunds.create()
  → 8-30 days: email to hello@ for manual review
  → >30 days: declined automatically
```

---

## Dashboard Data Flow

```
GET /api/intelligence?action=dashboard-overview
  → dashboardData.ts:
    
    Brand Health Score (deterministic, no Claude):
      consistency_score (40%): posts/week over last 8 weeks
      quality_score (35%): avg hook_strength + readability from post_analytics
      voice_score (25%): avg voice_match_score from persona_signals
    
    Historical Brand Health Score:
      Same formula computed weekly for up to 12 past weeks
    
    Posting Activity:
      Post counts grouped by day for last 30 days
    
    Content Performance:
      Top hooks, top tones, avg readability — from post_analytics
    
    AI Recommendations (Claude call):
      generateRecommendations() → claude-sonnet-4-6 + real analytics data
      Cached in intelligence_cache with kind='recommendations'
    
    Growth Journey:
      calculateStage(): posts published + score thresholds → 6 stages
      getProgress(): percentage toward next stage
      checkMilestones(): evaluate 10 milestones → create notifications
      getMomentum(): Building/Strong/Slowing/Stalled from trend
```

---

## Email System

Two Gmail SMTP transporters in `lib/emailService.ts`:
- `noreply@eclatale.com` — transactional (welcome, digest, notifications, limits)
- `hello@eclatale.com` — marketing/support

Email types sent:
1. Welcome (on signup)
2. Free limit hit (after 3rd post on free tier)
3. Weekly digest (Monday cron — personalized content tips + post recap)
4. Weekly Industry Briefing (Monday cron — industry trends + writing opportunity)
5. Re-engagement (daily cron — targets users inactive >14 days)
6. Password reset (Supabase handles delivery)
7. Unsubscribe confirmation

All emails include a unique token-based unsubscribe link. `email_log` table prevents duplicate sends. Users can manage preferences in Settings (4 toggles: digest, reminders, publish confirm, industry briefing).

---

## All API Endpoints

See Section 3 of CODEBASE_AUDIT.md for the complete table with all 11 direct functions and 40+ rewrite-mapped URLs.

Key groups:
- **Content generation:** `/api/generate`, `/api/adapt-content`, `/api/refine-content`, `/api/repurpose`, `/api/suggest-topics`
- **Intelligence:** `/api/intelligence` (30+ actions behind one function)
- **LinkedIn:** `/api/linkedin/publish`, `/api/linkedin/status`, `/api/auth/linkedin/callback`
- **Billing:** `/api/billing` (6 sub-actions via rewrites)
- **Images:** `/api/generate-image`
- **Crons:** 4 scheduled endpoints (see Cron Jobs section)

---

## Web Search Usage

Anthropic's built-in `web_search_20250305` tool is used in:
- Angle generation (max 5 uses per call)
- Trending hooks (max 3 uses per call)
- Trend context (open-ended)
- Industry intelligence (max 3 uses)
- Factual accuracy check (open-ended, 20s timeout)
- Supporting references (open-ended, 20s timeout)
- Web research utility `webResearch.ts` (max 5 uses)

The pattern for web_search calls: model is called in a loop until `stop_reason !== 'tool_use'`, handling multi-turn tool calls automatically.

---

## Chrome Extension Architecture

MV3 extension with:
- `background.js` — service worker (handles auth token storage)
- `content.js` — injects sidebar into LinkedIn pages
- `content-repurpose.js` — context menu handler on all URLs
- `popup/` — standalone popup UI
- `sidebar/` — LinkedIn sidebar UI

The extension connects to both `eclatale.com` (auth flow via `/extension-auth`) and the backend API directly. The backend URL is hardcoded in `manifest.json` as a host permission.

---

## Scaling Constraints

| Constraint | Details |
|---|---|
| Vercel Hobby function cap | ~12 functions — multiplexer pattern is the workaround |
| LinkedIn publishing | 5 posts/day via UGC API; 2hr spacing warning shown in UI |
| Image generation | 10 images/day per user (checked against image_usage table) |
| Free tools | 10 requests/hour per IP (checked against tool_usage_log table) |
| Intelligence.ts size | 1300+ lines, 30+ actions — primary maintenance bottleneck |
| Gmail SMTP | No dedicated email service — throughput limited by Gmail |
| Cron timezone accuracy | Once-global crons have ±7 day accuracy for per-user timezone alignment |
