# ECLATALE CODEBASE AUDIT REPORT

**Audit Date:** 2026-08-12  
**Total Files Read:** ~85 files across frontend, backend, extension, supabase, and config  
**Audited By:** Claude Code automated audit  

---

## 1. PROJECT STRUCTURE

```
C:\Users\mohit\Documents\Eclatale\
├── frontend/                          # React 19 SPA (Create React App)
│   ├── package.json
│   ├── vercel.json
│   ├── .env                           # Live SUPABASE_URL + ANON_KEY (should be .env.local)
│   ├── public/
│   │   └── index.html                 # Google Tag Manager included here
│   └── src/
│       ├── App.tsx                    # Router, lazy-loaded routes, AriaWidget global
│       ├── index.tsx
│       ├── pages/
│       │   ├── auth.tsx               # Login/signup/forgot password + Google Identity Services
│       │   ├── AuthCallback.tsx       # OAuth callback handler
│       │   ├── ExtensionAuth.tsx      # Chrome extension auth bridge
│       │   ├── Onboarding.tsx         # 3-step onboarding: name/role → industry → goals
│       │   ├── Dashboard.tsx          # Full analytics dashboard (recharts, brand health, journey)
│       │   ├── CreatePost.tsx         # Smart Canvas host: Phase1→Phase2→Phase3
│       │   ├── CreateTalk.tsx         # Talk post creator (separate from Smart Canvas)
│       │   ├── CreateResource.tsx     # Resource upload + converse
│       │   ├── CreateVisual.tsx       # AI image generation page
│       │   ├── History.tsx            # Post history + semantic analysis view
│       │   ├── Schedule.tsx           # Calendar scheduling UI
│       │   ├── Intelligence.tsx       # Competitor intelligence (feature-gated)
│       │   ├── PersonaSetup.tsx       # Voice profile setup wizard
│       │   ├── Settings.tsx           # 7-section settings page
│       │   ├── Pricing.tsx            # Pricing page + Stripe checkout
│       │   ├── GuidedCreate.tsx       # Dead code — redirects to /create
│       │   ├── Landing.tsx            # Marketing landing page
│       │   ├── Blog.tsx               # Blog index (static data)
│       │   ├── BlogPost.tsx           # Individual blog post (static data)
│       │   ├── Unsubscribe.tsx        # Email unsubscribe handler
│       │   ├── ResetPassword.tsx      # Password reset from email link
│       │   ├── NotFound.tsx           # 404 page
│       │   ├── PrivacyPolicy.tsx
│       │   ├── TermsOfService.tsx
│       │   ├── RefundPolicy.tsx
│       │   ├── create/
│       │   │   ├── Phase1Angles.tsx   # Angle picker + Industry Intelligence Panel
│       │   │   ├── Phase2Editor.tsx   # Post editor + refinements + authenticity score
│       │   │   ├── Phase3Publish.tsx  # LinkedIn publish + scheduling
│       │   │   ├── PhaseNav.tsx       # Phase progress breadcrumb
│       │   │   ├── HookLibraryPanel.tsx
│       │   │   ├── IndustryIntelligencePanel.tsx
│       │   │   ├── hookCtaTemplates.ts   # Hardcoded hook/CTA template data
│       │   │   └── types.ts
│       │   └── tools/
│       │       ├── ToolsHub.tsx       # /tools landing page
│       │       ├── ToolPage.tsx       # Tool router by slug
│       │       ├── ToolShell.tsx      # Shared tool layout wrapper
│       │       ├── config.ts          # 9 tool definitions
│       │       ├── toolsApi.ts        # tools-generate API calls
│       │       ├── HookGenerator.tsx
│       │       ├── PostGenerator.tsx
│       │       ├── HeadlineAnalyzer.tsx
│       │       ├── ViralScoreChecker.tsx
│       │       ├── AboutGenerator.tsx
│       │       ├── CtaGenerator.tsx
│       │       ├── EngagementCalculator.tsx  # Client-side only, no API
│       │       ├── PostLengthAnalyzer.tsx    # Client-side only, no API
│       │       └── ReadabilityChecker.tsx    # Client-side only, no API
│       ├── components/
│       │   ├── AppShell.tsx
│       │   ├── Sidebar.tsx
│       │   ├── AriaWidget.tsx         # Floating AI assistant
│       │   ├── FeatureLock.tsx        # Gate wrapper component
│       │   ├── NotificationBell.tsx
│       │   ├── WeeklyBriefingCard.tsx
│       │   ├── NewsletterSignup.tsx
│       │   ├── ProfileDropdowns.tsx
│       │   ├── Avatar.tsx
│       │   └── Seo.tsx
│       ├── contexts/
│       │   ├── SidebarContext.tsx
│       │   └── ToastContext.tsx
│       ├── hooks/
│       │   ├── useFeatureGate.ts
│       │   └── useModalBackButton.ts
│       ├── lib/
│       │   ├── supabaseClient.ts
│       │   ├── apiFetch.ts            # Authenticated fetch wrapper (Bearer token)
│       │   ├── featureGates.ts        # Frontend mirror of backend feature gates
│       │   ├── analytics.ts           # GTM dataLayer wrapper
│       │   ├── googleIdentity.ts      # GIS script loader + nonce generator
│       │   ├── pushNotifications.ts
│       │   ├── imageOverlay.ts
│       │   ├── personaOptions.ts
│       │   └── richText.ts
│       ├── data/
│       │   └── blogPosts.ts           # Static blog post data (hardcoded)
│       └── utils/
│           └── clipboard.ts
│
├── backend/                           # Vercel serverless functions (TypeScript)
│   ├── package.json
│   ├── vercel.json                    # Rewrites + cron jobs
│   ├── tsconfig.json
│   ├── .env.example
│   ├── api/
│   │   ├── generate.ts                # POST /api/generate
│   │   ├── intelligence.ts            # POST/GET /api/intelligence — 30+ action multiplexer
│   │   ├── billing.ts                 # POST /api/billing — Stripe checkout/webhooks
│   │   ├── adapt-content.ts
│   │   ├── refine-content.ts
│   │   ├── repurpose.ts
│   │   ├── suggest-topics.ts
│   │   ├── generate-image.ts          # POST /api/generate-image (Together AI)
│   │   └── linkedin/
│   │       ├── publish.ts
│   │       ├── status.ts
│   │       └── auth/
│   │           └── callback.ts        # LinkedIn OAuth initiate + callback
│   └── lib/
│       ├── verifyAuth.ts              # checkAuthToken() + reconcileUserId()
│       ├── featureGates.ts            # FEATURE_GATES config + requireFeature()
│       ├── emailService.ts            # Nodemailer Gmail SMTP, 2 transporters, 7 templates
│       ├── aria.ts
│       ├── angles.ts
│       ├── hookLibrary.ts
│       ├── industryIntelligence.ts
│       ├── trendContext.ts
│       ├── authenticityScore.ts       # 4 parallel Claude calls
│       ├── semanticAnalysis.ts
│       ├── personaPromptBuilder.ts
│       ├── webResearch.ts
│       ├── notifications.ts
│       ├── digest.ts
│       ├── weeklyBriefing.ts
│       ├── growthScore.ts
│       ├── growthJourney.ts
│       ├── dashboardData.ts
│       ├── voiceMatchScore.ts
│       ├── writingStyles.ts
│       ├── contentPrompts.ts
│       ├── intelligencePrompts.ts
│       ├── intelligenceCache.ts
│       ├── linkedinTokenRefresh.ts
│       ├── freeTools.ts
│       ├── anthropicErrors.ts
│       ├── dateContext.ts
│       └── resourceParsing.ts
│
├── extension/                         # Chrome extension (MV3, plain JS)
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── content-repurpose.js
│   ├── popup/
│   ├── sidebar/
│   └── utils/
│
├── supabase/
│   ├── templates/
│   └── migrations/
│       ├── 20260701_intelligence_and_notifications.sql
│       └── 20260810_tool_usage_log_and_role_domain_cache.sql
│
└── .claude/
    └── settings.local.json
```

---

## 2. ALL FRONTEND ROUTES

| Route | Component | Auth Required | Notes |
|-------|-----------|---------------|-------|
| `/` | `Landing` | No | Marketing landing page |
| `/signup` | `Auth` | No | defaultIsLogin=false |
| `/login` | `Auth` | No | defaultIsLogin=true |
| `/auth/callback` | `AuthCallback` | No | Supabase OAuth callback |
| `/auth/reset-password` | `ResetPassword` | No | Password reset from email |
| `/reset-password` | `ResetPassword` | No | Duplicate route (legacy) |
| `/onboarding` | `Onboarding` | Yes | 3-step: name/role → industry → goals |
| `/dashboard` | `Dashboard` | Yes | Brand health, journey, activity charts |
| `/create` | `CreatePost` | Yes | Smart Canvas Phase 1→2→3 |
| `/create/talk` | `CreateTalk` | Yes | Standalone talk post creator |
| `/create/resource` | `CreateResource` | Yes | Resource upload and converse |
| `/guided` | `Navigate to /create` | Yes | Legacy redirect |
| `/create-visual` | `CreateVisual` | Yes | AI image generation (Together AI) |
| `/history` | `History` | Yes | Post history + semantic analysis badges |
| `/schedule` | `Schedule` | Yes | Calendar scheduling UI |
| `/persona-setup` | `PersonaSetup` | Yes | Voice profile setup wizard |
| `/settings` | `Settings` | Yes | 7 sections: profile/voice/integrations/billing/api/notifications/security |
| `/intelligence` | `Intelligence` | Yes | Competitor intelligence (individual tier required) |
| `/pricing` | `Pricing` | No | Pricing + Stripe checkout |
| `/privacy` | `PrivacyPolicy` | No | Static |
| `/terms` | `TermsOfService` | No | Static |
| `/refund-policy` | `RefundPolicy` | No | Static |
| `/blog` | `Blog` | No | Blog index (static data in blogPosts.ts) |
| `/blog/:slug` | `BlogPost` | No | Individual blog post |
| `/unsubscribe` | `Unsubscribe` | No | Email unsubscribe |
| `/extension-auth` | `ExtensionAuth` | No | Chrome extension auth bridge |
| `/tools` | `ToolsHub` | No | Free tools landing (public) |
| `/tools/:toolSlug` | `ToolPage` | No | Individual tool page (9 tools) |
| `*` | `NotFound` | No | 404 |

**Note:** `/p/:slug` is shown to users in Settings as their "Eclatale URL" but this route does NOT exist in App.tsx — it results in a 404.

---

## 3. ALL API ENDPOINTS

### Direct serverless functions

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/api/generate` | `api/generate.ts` | Bearer token | Main content generation |
| POST | `/api/intelligence` | `api/intelligence.ts` | Bearer token | 30+ action multiplexer |
| POST | `/api/billing` | `api/billing.ts` | Bearer / Stripe sig | Stripe billing (action param dispatched) |
| POST | `/api/adapt-content` | `api/adapt-content.ts` | Bearer token | Adapt post to different format |
| POST | `/api/refine-content` | `api/refine-content.ts` | Bearer token | Apply single refinement instruction |
| POST | `/api/repurpose` | `api/repurpose.ts` | Bearer token | Repurpose content (3 modes) |
| POST | `/api/suggest-topics` | `api/suggest-topics.ts` | Bearer token | 5 topic suggestions |
| POST | `/api/generate-image` | `api/generate-image.ts` | Bearer token | AI image generation (Together AI, 10/day) |
| POST | `/api/linkedin/publish` | `api/linkedin/publish.ts` | Bearer token | Publish to LinkedIn |
| GET/POST | `/api/linkedin/status` | `api/linkedin/status.ts` | Bearer token | LinkedIn connection status/disconnect |
| GET | `/api/auth/linkedin/callback` | `api/linkedin/auth/callback.ts` | None | LinkedIn OAuth initiate + callback |

### Rewrite-mapped URLs → /api/intelligence?action=

| Friendly URL | Action | Description |
|---|---|---|
| `/api/create/angles` | `create-angles` | Generate 4 post angles with web_search |
| `/api/tools/generate` | `tools-generate` | Free tools AI generation (IP rate limited) |
| `/api/create/industry-intelligence` | `industry-intelligence` | Industry competitor analysis |
| `/api/create/hooks` | `create-hooks` | Hook library (personal best + trending) |
| `/api/voice-match-score` | `voice-match-score` | Voice match score |
| `/api/persona-signal` | `persona-signal` | Record kept/refined signal |
| `/api/aria/chat` | `aria-chat` | Aria AI assistant chat |
| `/api/aria/history` | `aria-history` | Aria conversation history |
| `/api/admin/trigger-digest` | `trigger-digest` | Admin-triggered digest |
| `/api/weekly-digest-cron` | `weekly-digest-cron` | Monday digest cron |
| `/api/admin/trigger-weekly-industry-briefing` | `weekly-industry-briefing` | Admin-triggered briefing |
| `/api/weekly-industry-briefing-cron` | `weekly-industry-briefing-cron` | Monday briefing cron |
| `/api/analytics/page-view` | `page-view` | Page view tracking |
| `/api/reengagement-cron` | `reengagement-cron` | Daily re-engagement email cron |
| `/api/streak-risk-cron` | `streak-risk-cron` | Streak risk cron (rewrite exists, NOT in crons array) |
| `/api/email/send-welcome` | `send-welcome` | Send welcome email |
| `/api/email/send-digest` | `trigger-digest` | Send weekly digest |
| `/api/email/send-free-limit` | `send-free-limit` | Send free limit hit email |
| `/api/email/send-reengagement` | `send-reengagement` | Send re-engagement email |
| `/api/email/unsubscribe` | `unsubscribe` | Email unsubscribe |
| `/api/email/newsletter-subscribe` | `newsletter-subscribe` | Newsletter subscribe |
| `/api/email/preferences` | `email-preferences` | Get/update email preferences |
| `/api/schedule/publish-due` | `publish-scheduled-posts` | Publish all due scheduled posts |
| `/api/schedule/create` | `schedule-post` | Create a scheduled post |
| `/api/schedule/cancel` | `cancel-scheduled-post` | Cancel a scheduled post |
| `/api/notifications` | `notifications-list` | List user notifications |
| `/api/notifications/read-all` | `notifications-mark-all-read` | Mark all read |
| `/api/notifications/:id/read` | `notifications-mark-read` | Mark one read |
| `/api/notifications/:id` | `notifications-item` | Get single notification |
| `/api/push/subscribe` | `push-subscribe` | Subscribe to web push |

### Rewrite-mapped URLs → /api/billing?action=

| Friendly URL | Action | Description |
|---|---|---|
| `/api/billing/create-checkout` | `create-checkout` | Create Stripe checkout session |
| `/api/billing/webhook` | `webhook` | Stripe webhook handler |
| `/api/billing/customer-portal` | `customer-portal` | Open Stripe customer portal |
| `/api/billing/subscription-status` | `subscription-status` | Get subscription status |
| `/api/billing/cancel-subscription` | `cancel-subscription` | Cancel at period end |
| `/api/billing/request-refund` | `request-refund` | Submit refund request |

---

## 4. ALL DATABASE TABLES

### `profiles`
Primary user table. Queried by nearly every backend file.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | FK to auth.users |
| `first_name`, `last_name` | text | |
| `pronouns` | text | |
| `role`, `domain` | text | Job role and industry |
| `seniority_level` | text | |
| `company_name`, `linkedin_url_manual` | text | |
| `bio`, `default_tone` | text | |
| `goals` | text[] | |
| `username_slug`, `profile_public` | text/bool | Public profile (URL not wired) |
| `profile_photo_url`, `timezone` | text | |
| `subscription_tier` | text | 'free' \| 'individual' |
| `subscription_status`, `posts_this_week`, `week_reset_at` | various | |
| `trial_ends_at`, `current_period_end`, `cancel_at_period_end` | timestamp/bool | |
| `subscription_cancels_at`, `first_charge_at` | timestamp | |
| `stripe_customer_id`, `stripe_subscription_id` | text | |
| `growth_stage` | text | unknown/emerging/rising/notable/authority/icon |
| `growth_stage_unlocked_at` | timestamp | |
| `longest_streak`, `total_posts_published` | int | |
| `milestone_badges` | jsonb | Array of badge objects |
| `created_at` | timestamp | |
| `notif_weekly_digest`, `notif_post_reminders`, `notif_publish_confirm` | bool | Default true (added 20260701) |
| `notif_industry_briefing` | bool | Default true (added 20260810) |

### `posts`
Queried by: generate.ts, intelligence.ts, dashboardData.ts, growthJourney.ts, digest.ts

| Column | Type | Notes |
|--------|------|-------|
| `id`, `user_id` | UUID | |
| `content`, `topic`, `tone`, `content_type` | text | |
| `status` | text | 'draft' \| 'published' |
| `source` | text | e.g. 'repurpose' |
| `created_at`, `published_at` | timestamp | |
| `scheduled_for` | timestamp | |
| `schedule_status` | text | 'scheduled' \| 'published' \| 'failed' \| 'cancelled' |

### `persona_profiles`
Queried by: personaPromptBuilder.ts, Settings.tsx, growthJourney.ts

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `communication_styles` | text[] |
| `expertise_topic`, `contrarian_take` | text |
| `voice_samples` | text[] |
| `formality_score` | int |
| `persona_completed_at`, `updated_at` | timestamp |

### `persona_signals`
Queried by: personaPromptBuilder.ts, growthScore.ts, voiceMatchScore.ts

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `action` | text | 'kept' \| 'refined' |
| `tone` | text |
| `created_at` | timestamp |

### `linkedin_connections`
Queried by: linkedin/*.ts

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `access_token`, `refresh_token` | text |
| `token_expires_at` | timestamp |
| `member_id`, `name`, `picture`, `connected_at` | various |

### `publish_log`
Queried by: linkedin/publish.ts

| Column | Type |
|--------|------|
| `user_id`, `post_id` | UUID |
| `linkedin_urn`, `content_preview` | text |
| `published_at` | timestamp |

### `aria_conversations`
Queried by: aria.ts. Unique on user_id (upsert); keeps last 40 messages.

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `messages` | jsonb |
| `updated_at` | timestamp |

### `intelligence_cache`
Created: 20260701 migration. Queried by: intelligenceCache.ts, dashboardData.ts. RLS enabled.

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `kind` | text | Cache key (e.g. 'competitor', 'growth-score') |
| `data` | jsonb |
| `updated_at` | timestamp |

Unique on (user_id, kind).

### `post_analytics`
Created: 20260701 migration. Queried by: semanticAnalysis.ts, hookLibrary.ts, dashboardData.ts. RLS enabled.

| Column | Type |
|--------|------|
| `id`, `post_id`, `user_id` | UUID |
| `hook_type`, `tone_detected` | text |
| `hook_strength`, `readability_score` | int (0-100) |
| `topic_tags` | text[] |
| `estimated_read_time` | int |
| `created_at` | timestamp |

### `user_pattern_cache`
Created: 20260701 migration. Queried by: semanticAnalysis.ts. RLS enabled.

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `data` | jsonb |
| `generated_at` | timestamp |

### `notifications`
Queried by: notifications.ts, intelligence.ts, dashboardData.ts

| Column | Type |
|--------|------|
| `id`, `user_id` | UUID |
| `type`, `title`, `message` | text |
| `read` | bool |
| `cta_text`, `cta_url` | text |
| `created_at` | timestamp |

### `push_subscriptions`
Queried by: notifications.ts

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `endpoint` | text |
| `keys` | jsonb |
| `created_at` | timestamp |

### `email_log`
Queried by: emailService.ts

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `type` | text |
| `sent_at` | timestamp |

### `tool_usage_log`
Created: 20260810 migration. Queried by: freeTools.ts. IP-based rate limiting (10/hr/IP).

| Column | Type |
|--------|------|
| `ip` | text |
| `tool` | text |
| `created_at` | timestamp |

### `role_domain_cache`
Created: 20260810 migration. Queried by: hookLibrary.ts, industryIntelligence.ts. Cross-user cache.

| Column | Type |
|--------|------|
| `role`, `domain`, `kind` | text |
| `data` | jsonb |
| `generated_at` | timestamp |

Unique on (role, domain, kind).

### `trend_cache`
Queried by: trendContext.ts. 6h TTL.

| Column | Type |
|--------|------|
| `domain` | text |
| `data` | jsonb |
| `generated_at` | timestamp |

### `generated_assets`
Queried by: generate-image.ts

| Column | Type |
|--------|------|
| `id`, `user_id` | UUID |
| `url`, `prompt` | text |
| `created_at` | timestamp |

### `image_usage`
Queried by: generate-image.ts (10/day rate limiting)

| Column | Type |
|--------|------|
| `user_id` | UUID |
| `date` | date |
| `count` | int |

### `resources`
Queried by: intelligence.ts (resource-upload/analyze/converse actions)

| Column | Type |
|--------|------|
| `id`, `user_id` | UUID |
| `title`, `content_text`, `file_type` | text |
| `tags` | text[] |
| `created_at` | timestamp |

### `page_views`
Queried by: growthJourney.ts (checked_analytics milestone)

| Column | Type |
|--------|------|
| `id`, `user_id` | UUID |
| `feature` | text |
| `created_at` | timestamp |

### `newsletter_subscribers`
Queried by: intelligence.ts (newsletter-subscribe action)

| Column | Type |
|--------|------|
| `email` | text |
| `subscribed_at` | timestamp |

### RLS Policies (from migrations)

All confirmed tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`:
- `intelligence_cache`: user can only read/write own rows (`user_id = auth.uid()`)
- `post_analytics`: user can only read/write own rows
- `user_pattern_cache`: user can only read/write own rows
- `tool_usage_log`: insert by anyone (for rate limiting), no RLS on reads
- `role_domain_cache`: readable and writable by authenticated users (cross-user shared cache)

---

## 5. ALL CLAUDE/ANTHROPIC API CALLS

| File | Model | Max Tokens | Web Search | Purpose | Cache |
|------|-------|------------|------------|---------|-------|
| `api/generate.ts` | claude-sonnet-4-6 | 2048 | No | Full post generation with persona+trend+angle+framework | — |
| `lib/angles.ts` | claude-sonnet-4-6 | 2500 | Yes (max 5 uses) | 4 post angles grounded in live trends | 2h/user |
| `lib/hookLibrary.ts` getTrendingHooks | claude-sonnet-4-6 | 700 | Yes (max 3 uses) | 3 trending hook lines for role+domain | 6h/role+domain |
| `lib/trendContext.ts` | claude-sonnet-4-6 | ~500 | Yes | Trend context fragment for generation prompts | 6h/domain |
| `lib/industryIntelligence.ts` (real path) | claude-sonnet-4-6 | varies | Yes (max 3 uses) | Industry insights with real hook data | 24h/role+domain |
| `lib/industryIntelligence.ts` (estimated path) | claude-sonnet-4-6 | varies | Yes (max 3 uses) | Full AI-estimated industry intelligence | 24h/role+domain |
| `api/intelligence.ts` competitor action | claude-sonnet-4-6 | 1500 | No | Competitor intelligence (5 insights + trending) | 24h/user |
| `api/intelligence.ts` growthScore action | claude-sonnet-4-6 | 500 | No | Brand health reasoning text | — |
| `api/intelligence.ts` bestTimeToPost action | claude-haiku-4-5 | 600 | No | Best time to post recommendation | Cached |
| `api/intelligence.ts` create-talk-start | claude-sonnet-4-6 | 200 | No | Talk post initial setup | — |
| `api/intelligence.ts` create-talk-generate | claude-sonnet-4-6 | 1400 | No | Full talk post generation | — |
| `api/intelligence.ts` library-tags-suggest | claude-sonnet-4-6 | 150 | No | Suggest tags for resource | — |
| `api/intelligence.ts` resource-analyze | claude-sonnet-4-6 | 600 | No | Analyze uploaded resource | — |
| `api/intelligence.ts` resource-converse | claude-sonnet-4-6 | 400 | No | Converse with resource | — |
| `lib/semanticAnalysis.ts` analyzePost | claude-sonnet-4-6 | 1024 | No | Semantic analysis → post_analytics | — |
| `lib/semanticAnalysis.ts` analyzeUserPatterns | claude-sonnet-4-6 | 1200 | No | Pattern analysis across all posts | user_pattern_cache |
| `lib/semanticAnalysis.ts` compareIntendedVsActualTone | claude-haiku-4-5 | 400 | No | Tone comparison | — |
| `lib/authenticityScore.ts` runFactualAccuracyCheck | claude-sonnet-4-6 | 1200 | Yes | Factual accuracy (40% of score) | — |
| `lib/authenticityScore.ts` runTopicFreshnessCheck | claude-haiku-4-5 | 500 | No | Topic freshness (30% of score) | — |
| `lib/authenticityScore.ts` runVoiceAuthenticityCheck | claude-haiku-4-5 | 500 | No | Voice match (30% of score) | — |
| `lib/authenticityScore.ts` runSupportingReferences | claude-sonnet-4-6 | 1200 | Yes | Supporting references (not in score) | — |
| `lib/aria.ts` | claude-sonnet-4-6 | 500 | No | Aria AI assistant | History in DB |
| `api/adapt-content.ts` | claude-sonnet-4-6 | 2048 | No | Adapt post to different format | — |
| `api/refine-content.ts` | claude-sonnet-4-6 | 2048 | No | Apply refinement instruction | — |
| `api/repurpose.ts` pattern mode step 1 | claude-haiku-4-5 | varies | No | Extract pattern from example posts | — |
| `api/repurpose.ts` main generation | claude-sonnet-4-6 | varies | No | Generate repurposed content | — |
| `api/suggest-topics.ts` | claude-haiku-4-5 | 900 | No | 5 topic suggestions | 6h/user (no query) |
| `lib/weeklyBriefing.ts` generateOpportunity | claude-haiku-4-5 | 300 | No | 1 writing style recommendation for briefing | — |
| `lib/webResearch.ts` searchSourcesForTopic | claude-sonnet-4-6 | varies | Yes (max 5 uses) | Web research for fact-checking | — |
| `lib/dashboardData.ts` generateRecommendations | claude-sonnet-4-6 | 700 | No | AI recommendations from real analytics | — |
| `api/generate-image.ts` theme abstraction | claude-haiku-4-5 | varies | No | Abstract visual theme before Together AI | — |
| `lib/freeTools.ts` generateHooks | claude-sonnet-4-6 | 500 | No | 5 hook lines (free tool) | — |
| `lib/freeTools.ts` generateDemoPost | claude-sonnet-4-6 | 1400 | No | Demo post (free tool) | — |
| `lib/freeTools.ts` analyzeHeadline | claude-sonnet-4-6 | 900 | No | Headline analysis (free tool) | — |
| `lib/freeTools.ts` scoreViralPotential | claude-sonnet-4-6 | 700 | No | Viral potential score (free tool) | — |
| `lib/freeTools.ts` generateAboutSection | claude-sonnet-4-6 | 700 | No | LinkedIn About section (free tool) | — |
| `lib/freeTools.ts` generateCTAs | claude-sonnet-4-6 | 500 | No | 5 CTAs (free tool) | — |
| `lib/digest.ts` buildDigestData | claude-sonnet-4-6 | 900 | No | Weekly digest subject/intro/tips | — |

**Web search tool:** `{ type: 'web_search_20250305', name: 'web_search' }` — Anthropic built-in  
**Abort timeouts:** 20-second abort controllers on authenticityScore.ts and trendContext.ts web_search calls  
**Models in use:** claude-sonnet-4-6 (primary), claude-haiku-4-5 (for fast/cheap calls: tone compare, topic freshness, voice check, repurpose pattern extract, topic suggestions, best time, briefing opportunity, image theme)

---

## 6. ALL EXTERNAL SERVICES

| Service | Purpose | SDK/Library | Auth Method |
|---------|---------|-------------|-------------|
| **Anthropic** | AI content generation (primary) | `@anthropic-ai/sdk ^0.52.0` | `ANTHROPIC_API_KEY` |
| **Supabase** | PostgreSQL + Auth + Storage | `@supabase/supabase-js` | `SUPABASE_SERVICE_ROLE_KEY` (backend); anon key (frontend) |
| **Stripe** | Subscription billing | `stripe ^22.3.2` | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| **LinkedIn API** | OAuth + UGC post publishing | Native fetch | OAuth authorization code; tokens in `linkedin_connections` |
| **Together AI** | FLUX.1-schnell image generation | Native fetch | `TOGETHER_API_KEY` |
| **Google Identity Services** | Sign in with Google | `accounts.google.com/gsi/client` script | `REACT_APP_GOOGLE_CLIENT_ID` |
| **Gmail SMTP** | Transactional + marketing email | `nodemailer` | `GMAIL_USER`/`GMAIL_APP_PASSWORD` (noreply@); `GMAIL_HELLO_USER`/`GMAIL_HELLO_APP_PASSWORD` (hello@) |
| **Web Push (VAPID)** | Browser push notifications | `web-push` | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` |
| **Google Tag Manager** | Analytics / event tracking | Script in `public/index.html` | GTM container ID hardcoded in HTML |
| **Vercel** | Hosting, serverless functions, crons | `@vercel/node ^5.1.0` | Vercel project tokens |

---

## 7. ALL ENVIRONMENT VARIABLES

### Backend (.env / Vercel environment)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | All lib/* files | Anthropic API auth |
| `SUPABASE_URL` | All backend files | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All backend files | Service role key (bypasses RLS) |
| `STRIPE_SECRET_KEY` | `api/billing.ts` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | `api/billing.ts` | Stripe webhook signature verification |
| `STRIPE_LAUNCH50_PROMO_CODE_ID` | `api/billing.ts` | Launch promo code ID |
| `LINKEDIN_CLIENT_ID` | `api/linkedin/auth/callback.ts` | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | `api/linkedin/auth/callback.ts` | LinkedIn OAuth client secret |
| `LINKEDIN_REDIRECT_URI` | `api/linkedin/auth/callback.ts` | LinkedIn OAuth redirect URI |
| `TOGETHER_API_KEY` | `api/generate-image.ts` | Together AI (image gen) |
| `GMAIL_USER` | `lib/emailService.ts` | noreply@ Gmail SMTP username |
| `GMAIL_APP_PASSWORD` | `lib/emailService.ts` | noreply@ Gmail app password |
| `GMAIL_HELLO_USER` | `lib/emailService.ts` | hello@ Gmail SMTP username |
| `GMAIL_HELLO_APP_PASSWORD` | `lib/emailService.ts` | hello@ Gmail app password |
| `VAPID_PUBLIC_KEY` | `lib/notifications.ts` | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | `lib/notifications.ts` | Web push VAPID private key |
| `VAPID_SUBJECT` | `lib/notifications.ts` | VAPID mailto: subject |
| `CRON_SECRET` | `api/intelligence.ts` | Vercel cron auth |
| `ADMIN_SECRET` | `api/intelligence.ts` | Admin action auth |
| `FRONTEND_URL` | `api/billing.ts`, email links | Frontend base URL |
| `PORT` | `.env.example` | Local dev server port |

### Frontend (REACT_APP_ prefix)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `REACT_APP_SUPABASE_URL` | Multiple pages | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Multiple pages | Supabase anon key (public, safe for browser) |
| `REACT_APP_API_URL` | All API calls via apiFetch.ts | Backend base URL (defaults to localhost:3001) |
| `REACT_APP_GOOGLE_CLIENT_ID` | `pages/auth.tsx` | Google Identity Services client ID |
| `REACT_APP_VAPID_PUBLIC_KEY` | `lib/pushNotifications.ts` | Web push VAPID public key |

---

## 8. ALL CRON JOBS

| Schedule | Path | Action | Description |
|----------|------|--------|-------------|
| `0 7 * * 1` (Mondays 7am UTC) | `/api/weekly-industry-briefing-cron` | `weekly-industry-briefing-cron` | Weekly Industry Briefing email |
| `0 13 * * 1` (Mondays 1pm UTC) | `/api/weekly-digest-cron` | `weekly-digest-cron` | Weekly email digest |
| `0 9 * * *` (Daily 9am UTC) | `/api/reengagement-cron` | `reengagement-cron` | Daily re-engagement email for inactive users |
| `0 12 * * *` (Daily 12pm UTC) | `/api/schedule/publish-due` | `publish-scheduled-posts` | Publishes all scheduled posts due by now |

**Missing from crons array:** `/api/streak-risk-cron` has a rewrite defined but is NOT in the `crons` array — it never fires automatically.

**Timezone note:** Monday crons fire once globally at UTC times. The handlers loop all users and skip those whose local timezone does not show Monday yet. Accuracy within ±7 days.

---

## 9. FEATURES INVENTORY

### Confirmed Built ✅

| Feature | Key Files |
|---------|-----------|
| AI post generation (Smart Canvas Phase 1-2-3) | `api/generate.ts`, `pages/CreatePost.tsx`, `pages/create/Phase*.tsx` |
| Web-search-grounded angle selection | `lib/angles.ts`, `pages/create/Phase1Angles.tsx` |
| Post editor with Hook Library + Industry Intelligence panels | `pages/create/Phase2Editor.tsx`, `HookLibraryPanel.tsx`, `IndustryIntelligencePanel.tsx` |
| LinkedIn publish from Phase 3 | `pages/create/Phase3Publish.tsx`, `api/linkedin/publish.ts` |
| Content frameworks (AIDA, PAS, BAB, PPP) | `api/generate.ts`, `lib/contentPrompts.ts` |
| 6 writing styles (storyteller, contrarian, teacher, insider, motivator, analyst) | `lib/writingStyles.ts` |
| Smart Canvas length presets (micro/short/standard/longform) | `lib/contentPrompts.ts` |
| Persona voice learning (voice samples, formality, styles) | `lib/personaPromptBuilder.ts`, `pages/PersonaSetup.tsx` |
| Voice Match Score (deterministic, 0-100) | `lib/voiceMatchScore.ts` |
| Authenticity Score (3 parallel Claude calls + references) | `lib/authenticityScore.ts` |
| Semantic analysis → post_analytics | `lib/semanticAnalysis.ts` |
| Writing patterns analysis | `lib/semanticAnalysis.ts` |
| Hook Library (personal best + templates + trending via web_search) | `lib/hookLibrary.ts` |
| Industry Intelligence panel | `lib/industryIntelligence.ts` |
| Competitor Intelligence page | `pages/Intelligence.tsx`, `lib/intelligencePrompts.ts` |
| Talk post creator | `pages/CreateTalk.tsx` |
| Resource upload + converse (PDF/DOCX/CSV) | `pages/CreateResource.tsx`, `lib/resourceParsing.ts` |
| AI image generation (Together AI FLUX.1-schnell, 10/day) | `api/generate-image.ts`, `pages/CreateVisual.tsx` |
| Content adaptation (LinkedIn/Twitter/Instagram) | `api/adapt-content.ts` |
| Content refinement | `api/refine-content.ts` |
| Repurpose (voice/pattern/reaction modes) | `api/repurpose.ts` |
| Topic suggestions (5 topics, cached 6h) | `api/suggest-topics.ts` |
| LinkedIn OAuth connect + token refresh | `api/linkedin/auth/callback.ts`, `lib/linkedinTokenRefresh.ts` |
| LinkedIn publishing (UGC API, 5/day limit, 2hr spacing warning) | `api/linkedin/publish.ts` |
| Post scheduling (calendar UI, daily publish cron) | `pages/Schedule.tsx` |
| Dashboard (brand health, journey stage, activity charts) | `pages/Dashboard.tsx`, `lib/dashboardData.ts` |
| Growth Journey stages (6 stages: unknown → icon) | `lib/growthJourney.ts` |
| Micro-milestones (10 milestones, badge system) | `lib/growthJourney.ts` |
| Momentum tracking (Building/Strong/Slowing/Stalled) | `lib/growthJourney.ts` |
| Content history with semantic analysis badges | `pages/History.tsx` |
| Aria AI assistant (floating widget, navigate/prefill actions) | `lib/aria.ts`, `components/AriaWidget.tsx` |
| Free public tools (9 tools at /tools, IP rate limited 10/hr) | `lib/freeTools.ts`, `pages/tools/` |
| Weekly email digest (Monday cron) | `lib/digest.ts`, `lib/emailService.ts` |
| Weekly Industry Briefing email (Monday cron) | `lib/weeklyBriefing.ts` |
| Weekly Briefing in-app card on dashboard | `components/WeeklyBriefingCard.tsx` |
| Re-engagement email cron (daily) | `api/intelligence.ts` |
| Free limit hit email (after 3rd post) | `lib/emailService.ts`, `api/generate.ts` |
| Welcome email on signup | `lib/emailService.ts` |
| Email unsubscribe (token-based) | `lib/emailService.ts`, `pages/Unsubscribe.tsx` |
| Email notification preferences (4 toggles) | `pages/Settings.tsx` |
| Browser push notifications (VAPID) | `lib/notifications.ts`, `lib/pushNotifications.ts` |
| In-app notification bell + drawer | `components/NotificationBell.tsx` |
| Post/Growth/Streak milestone notifications | `lib/notifications.ts` |
| 2-tier subscription (free / individual) | `lib/featureGates.ts` |
| Stripe billing: checkout, portal, cancel, refund | `api/billing.ts` |
| 7-day free trial + LAUNCH50 promo code | `api/billing.ts` |
| Refund policy (auto ≤7d, review 8-30d, declined >30d) | `api/billing.ts` |
| Feature gates (frontend + backend both enforce) | `lib/featureGates.ts` (both sides) |
| Sign in with Google (GIS) | `pages/auth.tsx`, `lib/googleIdentity.ts` |
| Email/password auth + password reset | `pages/auth.tsx` |
| Onboarding (3-step) | `pages/Onboarding.tsx` |
| Profile settings (photo upload, slug, public profile) | `pages/Settings.tsx` |
| Chrome extension (MV3) | `extension/` |
| Blog (static content) | `pages/Blog.tsx`, `data/blogPosts.ts` |
| Newsletter signup | `components/NewsletterSignup.tsx` |
| Google Tag Manager + dataLayer event tracking | `lib/analytics.ts`, `public/index.html` |
| Trend context injection into generation (web_search, 20s timeout) | `lib/trendContext.ts` |
| Intelligent caching (intelligence_cache, trend_cache, role_domain_cache) | `lib/intelligenceCache.ts` |
| Brand Health Score (deterministic: consistency 40% + quality 35% + voice 25%) | `lib/dashboardData.ts` |
| Historical Brand Health Score (up to 12 weeks) | `lib/dashboardData.ts` |
| Profile completeness score (7 factors, deterministic) | `lib/growthScore.ts` |

### Not Yet Built ❌

| Feature | Notes |
|---------|-------|
| Twitter/X integration | Settings UI shows "Coming Soon" |
| Instagram integration | Settings UI shows "Coming Soon" |
| User API key access | Settings shows disabled, "Available on Pro plan" (no Pro plan exists) |
| Session management (Security section) | Placeholder "coming soon" |
| Self-service account deletion | Modal redirects to support email — no API endpoint |
| Public profile pages (`/p/:slug`) | Slug saved to DB and shown in Settings, but no route exists |

### Partially Built ⚠️

| Feature | What's Missing |
|---------|---------------|
| Public profile (`/p/:username_slug`) | Slug stored, toggle exists, UI shows URL — but no App.tsx route, no page component |
| Streak risk cron | `streak-risk-cron` action code exists + rewrite defined, but NOT in crons array → never fires |
| Chrome extension sidebar | Files present but GuidedCreate page is dead code; sidebar links to /create |

---

## 10. KNOWN ISSUES

| Severity | File | Issue | Impact |
|----------|------|-------|--------|
| HIGH | `frontend/src/App.tsx`, `Settings.tsx` | `/p/:slug` route missing — users see their public profile URL but it 404s | User-facing broken feature |
| HIGH | `frontend/src/pages/auth.tsx:20` | `REACT_APP_GOOGLE_CLIENT_ID` not set — GIS button never renders, falls back to Supabase-hosted Google consent | Worse UX for Google sign-in |
| HIGH | `backend/lib/verifyAuth.ts` | `reconcileUserId()` trusts body `userId` when no Bearer token sent — allows user impersonation | Security vulnerability |
| MEDIUM | `backend/vercel.json` | `streak-risk-cron` in rewrites but NOT in crons array — never fires automatically | Silent dead feature |
| MEDIUM | `extension/manifest.json` | Backend URL hardcoded in `host_permissions` — breaking change if backend Vercel project changes | Extension maintenance risk |
| MEDIUM | `frontend/src/pages/Settings.tsx:1133-1139` | Account deletion requires emailing support — no automated deletion. GDPR risk for EU users | Compliance risk |
| MEDIUM | — | No error monitoring (no Sentry, no Datadog) — `console.error` used throughout | Zero production visibility |
| MEDIUM | `frontend/src/pages/Settings.tsx:1047` | API Access section says "Available on the Pro plan" — no Pro plan exists in billing/gates | Confusing to users |
| LOW | `frontend/src/.env` | Live Supabase URL + anon key in `.env` (may be committed to git) — should be `.env.local` | Security hygiene |
| LOW | `frontend/src/pages/GuidedCreate.tsx` | File exists but route immediately redirects to /create — dead code | Code clutter |
| LOW | `frontend/src/data/blogPosts.ts` | Blog is fully static — new posts require a code deploy | Operational friction |
| LOW | Both Monday cron handlers | Timezone approximation — far-east users receive emails up to 7 days off | Minor accuracy issue |

---

## 11. DEPENDENCIES

### Frontend (`frontend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.1.0 | UI framework |
| `react-dom` | ^19.1.0 | DOM rendering |
| `react-router-dom` | ^7.6.1 | SPA routing |
| `react-scripts` | 5.0.1 | Create React App build tooling |
| `typescript` | ^4.9.5 | TypeScript (outdated — backend uses ^5.7.0) |
| `@supabase/supabase-js` | ^2.50.0 | Supabase client |
| `@stripe/stripe-js` | ^7.3.0 | Stripe JS (frontend) |
| `axios` | ^1.9.0 | HTTP client (some pages; apiFetch.ts uses native fetch) |
| `recharts` | ^2.15.3 | Charts (dashboard) |
| `lucide-react` | ^0.511.0 | Icon library |
| `tailwindcss` | ^3.4.17 | CSS utility framework |
| `autoprefixer` | ^10.4.21 | CSS prefixing |
| `postcss` | ^8.5.3 | CSS processing |
| `react-helmet-async` | latest | SEO head management |

**Flags:**
- `react-scripts 5.0.1` is not actively maintained (CRA is deprecated). Consider migrating to Vite.
- Frontend TypeScript ^4.9.5 is two major versions behind backend's ^5.7.0.
- `axios` is used in some pages but `apiFetch.ts` uses native fetch — inconsistent.

### Backend (`backend/package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.52.0 | Anthropic Claude API |
| `@supabase/supabase-js` | ^2.50.1 | Supabase client (service role) |
| `stripe` | ^22.3.2 | Stripe billing |
| `nodemailer` | ^6.x | Gmail SMTP email |
| `web-push` | ^3.x | VAPID push notifications |
| `mammoth` | latest | DOCX text extraction |
| `unpdf` | latest | PDF text extraction (serverless-safe) |
| `express` | latest | Local dev server only |
| `cors` | latest | CORS middleware (local dev only) |
| `@vercel/node` | ^5.1.0 | Vercel Node.js runtime types |
| `typescript` | ^5.7.0 | TypeScript |

---

## 12. DEPLOYMENT CONFIGURATION

### Frontend Vercel project

```json
{
  "buildCommand": "CI=false react-scripts build",
  "outputDirectory": "build",
  "rewrites": [
    { "source": "/((?!static/|api/).+)", "destination": "/index.html" }
  ]
}
```

- **Domain:** eclatale.com
- **Auto-deploy:** Connected to GitHub (as of 2026-06-27)

### Backend Vercel project

- **Build:** `npm run build` → TypeScript to `dist/`
- **Runtime:** `@vercel/node` serverless functions
- **Function cap:** Vercel Hobby ~12 functions max — the intelligence.ts multiplexer pattern exists to stay under this limit
- **Body size:** intelligence.ts raises to 15MB for resource-upload
- **Real URL:** `https://backend-xi-olive-8eewk5s8qv.vercel.app` (hardcoded in extension manifest)

**Crons (backend/vercel.json):**

```json
{
  "crons": [
    { "path": "/api/weekly-industry-briefing-cron", "schedule": "0 7 * * 1" },
    { "path": "/api/weekly-digest-cron",             "schedule": "0 13 * * 1" },
    { "path": "/api/reengagement-cron",              "schedule": "0 9 * * *" },
    { "path": "/api/schedule/publish-due",           "schedule": "0 12 * * *" }
  ]
}
```

**Backend rewrite rules:** 40 total rewrite entries mapping friendly URL paths to the `intelligence` or `billing` multiplexer functions.

---

## 13. MISSING DOCUMENTATION (files with no comments/JSDoc)

Most files have zero or minimal comments. Key files worth documenting:

| File | Reason Docs Are Needed |
|------|------------------------|
| `backend/lib/verifyAuth.ts` | Two-mode auth (token vs body fallback) is a critical security design choice that isn't explained |
| `backend/lib/featureGates.ts` | Feature gate structure and how to add new gates not documented |
| `backend/api/intelligence.ts` | 30+ actions in 1300+ lines — action routing logic is hard to navigate without docs |
| `backend/lib/authenticityScore.ts` | Scoring weights (40%/30%/30%) not documented inline |
| `backend/lib/dashboardData.ts` | Brand Health Score formula (40%/35%/25%) not documented inline |
| `backend/lib/growthJourney.ts` | Stage thresholds and milestone criteria not documented |
| `frontend/src/lib/apiFetch.ts` | Auth token attachment behavior not explained |

---

## 14. ARCHITECTURE SUMMARY

### How the system works end-to-end

**Topology:** React 19 SPA (eclatale.com) → Vercel serverless backend (backend-xi-olive.vercel.app) → Supabase PostgreSQL + Auth + Storage

**Auth flow:**
1. User signs up or logs in via email/password or Google (GIS). Supabase Auth issues a JWT.
2. Frontend stores the Supabase session in localStorage. `apiFetch.ts` attaches the JWT as `Authorization: Bearer <token>` on every backend call.
3. Backend `verifyAuth.ts` calls `supabase.auth.getUser(token)` to verify the token and get the user ID.
4. **Security note:** `reconcileUserId()` currently falls back to trusting the body's `userId` if no token is provided — this is a staged migration artifact and creates a security gap.
5. On first login, Supabase creates a row in `profiles` via a database trigger.
6. Frontend detects new users (no profile data) and redirects to `/onboarding`.

**Content creation flow (Smart Canvas):**
1. User enters a topic on `/create` (Phase 1). Backend calls `createAngles()` which runs Anthropic claude-sonnet-4-6 with web_search to generate 4 post angles grounded in live trends.
2. User selects an angle. Optional: opens Hook Library panel (personal best hooks + trending via Claude) or Industry Intelligence panel (AI analysis of industry patterns).
3. Phase 2: User clicks Generate. Backend `api/generate.ts` assembles a prompt from: persona profile, writing style, content framework, date context, trend context, and selected angle. Claude generates the post.
4. User can refine (refine-content.ts), adapt to other formats (adapt-content.ts), or request an Authenticity Score (4 parallel Claude calls: factual accuracy + freshness + voice match + references).
5. Phase 3: User publishes to LinkedIn via the UGC API (tokens stored in `linkedin_connections`), or schedules for a future time (stored in `posts` table with `schedule_status = 'scheduled'`). After publish, `semanticAnalysis.ts` runs to populate `post_analytics`.

**How billing works:**
1. Free tier: 3 posts/week limit enforced in `api/generate.ts`. After 3rd post, free-limit email is sent once.
2. User goes to `/pricing`, clicks upgrade. Frontend calls `/api/billing/create-checkout` → `api/billing.ts` creates a Stripe Checkout session with a 7-day trial.
3. On Stripe webhook (`checkout.session.completed`): backend updates `profiles.subscription_tier = 'individual'` and records billing dates.
4. Cancellation: sets `cancel_at_period_end = true` in Stripe and in profiles.
5. Refunds: auto-approved ≤7 days, manual review 8-30 days, declined >30 days.

**How AI calls are structured:**
- Most API calls assemble a system prompt + user prompt and call `anthropic.messages.create()`.
- Web search is added as a tool: `tools: [{ type: 'web_search_20250305', name: 'web_search' }]`.
- The response loops until `stop_reason !== 'tool_use'` (handles multi-turn tool calls).
- Expensive calls are cached in Supabase (intelligence_cache, trend_cache, role_domain_cache).
- The Authenticity Score runs 4 calls in parallel with `Promise.all` and 20-second abort timeouts.
- Haiku is used for fast/cheap calls (tone compare, topic freshness, voice check, image theme abstraction, best time to post, topic suggestions).

**What data lives where:**
- **Supabase PostgreSQL:** All user data (profiles, posts, personas, analytics, conversations, notifications, scheduling, LinkedIn tokens, billing state, resource files, caches)
- **Supabase Storage:** User profile photos, uploaded resource files (PDF/DOCX/CSV)
- **Supabase Auth:** User credentials (email/password and Google OAuth)
- **Stripe:** Payment methods, subscription state (mirrored to profiles table)
- **Vercel:** No persistent state — all serverless functions are stateless

---

## 15. RECOMMENDATIONS

### CRITICAL (Fix Immediately)

1. **Add `/p/:slug` route** (`frontend/src/App.tsx`) — Users have been shown their public profile URL in Settings but it leads to 404. Add `<Route path="/p/:slug" element={<PublicProfile />} />` and build the page component.

2. **Close the auth token security gap** (`backend/lib/verifyAuth.ts`) — `reconcileUserId()` currently trusts `body.userId` when no Bearer token is provided. Move to enforcing 401 when the token is missing. Every API call in `apiFetch.ts` already sends the token — the fallback only helps old/external callers.

3. **Configure `REACT_APP_GOOGLE_CLIENT_ID`** — Set this env var in the frontend Vercel project. Without it, the Google sign-in button never renders and falls back to the Supabase-hosted redirect flow, defeating the recent Google Identity Services implementation.

4. **Add streak-risk-cron to crons array** (`backend/vercel.json`) — Add the missing cron entry if the streak-risk feature is intended to run automatically.

### IMPORTANT (Fix Soon)

5. **Implement self-service account deletion** — Build a backend endpoint that deletes all user data across all tables and calls `supabase.auth.admin.deleteUser()`. Current modal redirecting to email is a GDPR compliance risk for EU users.

6. **Add error monitoring** — Integrate Sentry (`@sentry/react` frontend, `@sentry/node` backend). The current `console.error` approach provides zero production visibility.

7. **Move `.env` to `.env.local`** (`frontend/.env`) — Verify the file is in `.gitignore`. The live Supabase URL and anon key should not be committed to git.

8. **Remove "Pro plan" references** (`frontend/src/pages/Settings.tsx:1047`) — There is no Pro plan. Either rename to "Individual" or hide the API key section until a Pro tier exists.

9. **Split `intelligence.ts`** (`backend/api/intelligence.ts`) — At 1300+ lines handling 30+ actions, it's a maintenance risk. Extract action handlers into domain modules (analytics.ts, email.ts, scheduling.ts) imported by a thin router — without creating new top-level function files that would hit the Vercel cap.

### NICE TO HAVE (Fix When Time Allows)

10. **Migrate from Create React App to Vite** — `react-scripts 5.0.1` is unmaintained. Vite provides faster builds and is the community-standard replacement.

11. **Upgrade frontend TypeScript** from `^4.9.5` to `^5.7.0` (matches backend).

12. **Remove or implement `GuidedCreate.tsx`** — File exists but App.tsx immediately redirects `/guided` to `/create`. Either build the intended experience or delete the file.

13. **Externalize blog content** — A headless CMS (even Supabase itself) would allow publishing posts without code deploys.

14. **Move backend URL out of extension manifest** — Use a build-time config constant rather than the hardcoded Vercel project URL to avoid breaking the extension if the backend project changes.

15. **Consolidate HTTP client** — Some pages use `axios`, `apiFetch.ts` uses native `fetch`. Pick one and be consistent.

---

*Total files read in this audit: ~85 files*
