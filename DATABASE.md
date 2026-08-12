# Eclatale Database Reference

**Database:** Supabase (PostgreSQL)  
**Auth:** Supabase Auth (handles `auth.users` table)  
**Storage:** Supabase Storage (profile photos, uploaded resource files)

---

## Table Index

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | Core user data, subscription, streak, settings | Yes (auth.uid()) |
| `posts` | All posts (draft + published + scheduled) | Yes |
| `persona_profiles` | Voice profile: styles, samples, formality | Yes |
| `persona_signals` | Feedback signals (kept/refined per post) | Yes |
| `linkedin_connections` | LinkedIn OAuth tokens per user | Yes |
| `publish_log` | LinkedIn publish history | Yes |
| `aria_conversations` | Aria AI assistant message history | Yes |
| `intelligence_cache` | Per-user AI intelligence results | Yes |
| `post_analytics` | Semantic analysis results per post | Yes |
| `user_pattern_cache` | Aggregated writing pattern analysis | Yes |
| `notifications` | In-app notification inbox | Yes |
| `push_subscriptions` | Web push endpoint registrations | Yes |
| `email_log` | Sent email deduplication log | Yes |
| `tool_usage_log` | Free tools IP rate limiting | No (insert by anyone) |
| `role_domain_cache` | Cross-user role+domain intelligence cache | Authenticated users |
| `trend_cache` | Industry trend context cache | Authenticated users |
| `generated_assets` | AI-generated images | Yes |
| `image_usage` | Per-user daily image generation count | Yes |
| `resources` | Uploaded documents (PDF/DOCX/CSV) | Yes |
| `page_views` | Feature page view tracking | Yes |
| `newsletter_subscribers` | Newsletter subscription list | Public insert |

---

## Table Schemas

### `profiles`

Primary user record. Created automatically when a user signs up via a Supabase Auth trigger.

```sql
profiles (
  id                      UUID PRIMARY KEY,  -- FK to auth.users.id
  first_name              TEXT,
  last_name               TEXT,
  pronouns                TEXT,
  role                    TEXT,              -- Job title/role
  domain                  TEXT,              -- Industry/domain
  seniority_level         TEXT,
  company_name            TEXT,
  linkedin_url_manual     TEXT,
  bio                     TEXT,
  default_tone            TEXT,
  goals                   TEXT[],
  username_slug           TEXT UNIQUE,       -- For public profile URL (route not yet built)
  profile_public          BOOLEAN DEFAULT FALSE,
  profile_photo_url       TEXT,
  timezone                TEXT,
  
  -- Subscription
  subscription_tier       TEXT DEFAULT 'free',  -- 'free' | 'individual'
  subscription_status     TEXT,
  posts_this_week         INT DEFAULT 0,
  week_reset_at           TIMESTAMP,
  trial_ends_at           TIMESTAMP,
  current_period_end      TIMESTAMP,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  subscription_cancels_at TIMESTAMP,
  first_charge_at         TIMESTAMP,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  
  -- Growth
  growth_stage            TEXT DEFAULT 'unknown',
  growth_stage_unlocked_at TIMESTAMP,
  longest_streak          INT DEFAULT 0,
  total_posts_published   INT DEFAULT 0,
  milestone_badges        JSONB DEFAULT '[]',
  
  -- Notification preferences (added migration 20260701)
  notif_weekly_digest     BOOLEAN DEFAULT TRUE,
  notif_post_reminders    BOOLEAN DEFAULT TRUE,
  notif_publish_confirm   BOOLEAN DEFAULT TRUE,
  
  -- Notification preferences (added migration 20260810)
  notif_industry_briefing BOOLEAN DEFAULT TRUE,
  
  created_at              TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** generate.ts, intelligence.ts, billing.ts, emailService.ts, dashboardData.ts, growthJourney.ts, growthScore.ts, voiceMatchScore.ts, persona* files, digest.ts, weeklyBriefing.ts, Settings.tsx

**Growth stages:** `unknown` → `emerging` → `rising` → `notable` → `authority` → `icon`

---

### `posts`

All user posts across all statuses. Also holds scheduled post state.

```sql
posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,       -- FK to profiles.id
  content         TEXT,
  topic           TEXT,
  tone            TEXT,
  content_type    TEXT,
  status          TEXT DEFAULT 'draft', -- 'draft' | 'published'
  source          TEXT,                  -- e.g. 'repurpose', null for normal
  created_at      TIMESTAMP DEFAULT NOW(),
  published_at    TIMESTAMP,
  
  -- Scheduling
  scheduled_for   TIMESTAMP,
  schedule_status TEXT                   -- 'scheduled' | 'published' | 'failed' | 'cancelled'
)
```

**Queried by:** generate.ts, intelligence.ts, dashboardData.ts, growthJourney.ts, digest.ts, Schedule.tsx, History.tsx

---

### `persona_profiles`

User's voice profile. Populated via `/persona-setup` wizard and Settings > Voice section.

```sql
persona_profiles (
  user_id                UUID PRIMARY KEY,  -- FK to profiles.id
  communication_styles   TEXT[],            -- e.g. ['storytelling', 'data-driven']
  expertise_topic        TEXT,
  contrarian_take        TEXT,
  voice_samples          TEXT[],            -- Up to 3 example posts
  formality_score        INT,               -- 1-10 scale
  persona_completed_at   TIMESTAMP,
  updated_at             TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** personaPromptBuilder.ts, Settings.tsx, growthJourney.ts

---

### `persona_signals`

Records user feedback on AI-generated content. Used to learn voice preferences.

```sql
persona_signals (
  id         UUID PRIMARY KEY,
  user_id    UUID,              -- FK to profiles.id
  action     TEXT,              -- 'kept' | 'refined'
  tone       TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** personaPromptBuilder.ts, growthScore.ts, voiceMatchScore.ts

---

### `linkedin_connections`

LinkedIn OAuth tokens. Access tokens are refreshed automatically with a 5-minute buffer.

```sql
linkedin_connections (
  user_id          UUID PRIMARY KEY,  -- FK to profiles.id
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMP,
  member_id        TEXT,              -- LinkedIn member ID (urn:li:member:...)
  name             TEXT,
  picture          TEXT,              -- LinkedIn profile photo URL
  connected_at     TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** linkedin/publish.ts, linkedin/status.ts, linkedinTokenRefresh.ts, Settings.tsx

---

### `publish_log`

Audit log of all LinkedIn publishes.

```sql
publish_log (
  id              UUID PRIMARY KEY,
  user_id         UUID,
  post_id         UUID,              -- FK to posts.id
  linkedin_urn    TEXT,              -- LinkedIn post URN
  content_preview TEXT,
  published_at    TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** linkedin/publish.ts

---

### `aria_conversations`

Stores the message history for each user's Aria AI assistant. One row per user (upsert). Keeps last 40 messages.

```sql
aria_conversations (
  user_id    UUID PRIMARY KEY,  -- FK to profiles.id
  messages   JSONB,             -- Array of {role, content} objects
  updated_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** lib/aria.ts

---

### `intelligence_cache`

Per-user cache for expensive intelligence results. Unique on (user_id, kind).

```sql
intelligence_cache (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  kind       TEXT NOT NULL,     -- Cache key: 'competitor', 'growth-score', 'recommendations', etc.
  data       JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, kind)
)
```

**TTL enforcement:** Code checks `updated_at` in each handler (e.g. competitor: 24h, recommendations: varies).  
**RLS:** Users can only read/write their own rows.  
**Created:** Migration 20260701

**Queried by:** intelligenceCache.ts, dashboardData.ts, intelligence.ts

---

### `post_analytics`

Semantic analysis results for each post. Populated async after generation or publish.

```sql
post_analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL,   -- FK to posts.id
  user_id             UUID NOT NULL,
  hook_type           TEXT,            -- e.g. 'question', 'statistic', 'story'
  hook_strength       INT,             -- 0-100
  tone_detected       TEXT,
  readability_score   INT,             -- 0-100
  topic_tags          TEXT[],
  estimated_read_time INT,             -- seconds
  created_at          TIMESTAMP DEFAULT NOW()
)
```

**RLS:** Users can only read/write their own rows.  
**Created:** Migration 20260701

**Queried by:** semanticAnalysis.ts, hookLibrary.ts, dashboardData.ts, voiceMatchScore.ts, History.tsx

---

### `user_pattern_cache`

Cached output of `analyzeUserPatterns()` — aggregated writing pattern analysis across all posts.

```sql
user_pattern_cache (
  user_id      UUID PRIMARY KEY,
  data         JSONB,            -- patterns, strengths, opportunities arrays
  generated_at TIMESTAMP DEFAULT NOW()
)
```

**RLS:** Users can only read/write their own rows.  
**Created:** Migration 20260701  
**Queried by:** semanticAnalysis.ts

---

### `notifications`

In-app notification inbox. Displayed in the NotificationBell component.

```sql
notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  type       TEXT,              -- e.g. 'milestone', 'growth', 'streak', 'publish'
  title      TEXT,
  message    TEXT,
  read       BOOLEAN DEFAULT FALSE,
  cta_text   TEXT,
  cta_url    TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** notifications.ts, intelligence.ts, dashboardData.ts, NotificationBell.tsx

---

### `push_subscriptions`

Web push endpoint registrations (VAPID).

```sql
push_subscriptions (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL,
  endpoint   TEXT NOT NULL,
  keys       JSONB NOT NULL,    -- { auth, p256dh }
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** notifications.ts (web-push send), intelligence.ts (push-subscribe action)

---

### `email_log`

Prevents duplicate emails. Before sending, code checks `email_log` for recent sends of the same type.

```sql
email_log (
  id      UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type    TEXT NOT NULL,       -- e.g. 'welcome', 'weekly_digest', 'free_limit'
  sent_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** emailService.ts (deduplication guard)

---

### `tool_usage_log`

Tracks free tool usage per IP for rate limiting (10 requests/hour/IP). No RLS — insert by anyone.

```sql
tool_usage_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         TEXT NOT NULL,
  tool       TEXT NOT NULL,    -- Tool slug (e.g. 'hook-generator')
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Rate limit check:** `SELECT COUNT(*) WHERE ip=? AND tool=? AND created_at > NOW() - INTERVAL '1 hour'`  
**Created:** Migration 20260810  
**Queried by:** freeTools.ts

---

### `role_domain_cache`

Cross-user cache keyed by (role, domain, kind). Shared across all users with the same role+domain combination. Unique on (role, domain, kind).

```sql
role_domain_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT NOT NULL,
  domain       TEXT NOT NULL,
  kind         TEXT NOT NULL,    -- 'hooks', 'industry-intelligence', etc.
  data         JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, domain, kind)
)
```

**RLS:** Readable and writable by authenticated users (cross-user shared cache — intentional).  
**Created:** Migration 20260810  
**Queried by:** hookLibrary.ts (trending hooks), industryIntelligence.ts

---

### `trend_cache`

Industry-level trend context cache. One row per domain. TTL: 6 hours.

```sql
trend_cache (
  domain       TEXT PRIMARY KEY,  -- Industry/domain name
  data         JSONB NOT NULL,    -- Trend context text
  generated_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** trendContext.ts

---

### `generated_assets`

AI-generated images (Together AI FLUX.1-schnell). URL stored after upload to Supabase Storage.

```sql
generated_assets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  url        TEXT NOT NULL,      -- Supabase Storage URL
  prompt     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** generate-image.ts, CreateVisual.tsx

---

### `image_usage`

Per-user daily image generation tracking. Limit: 10 images/day.

```sql
image_usage (
  user_id UUID NOT NULL,
  date    DATE NOT NULL,
  count   INT DEFAULT 0,
  PRIMARY KEY(user_id, date)
)
```

**Queried by:** generate-image.ts

---

### `resources`

Uploaded document library. Supports PDF, DOCX, and CSV. Text extracted server-side via `resourceParsing.ts`.

```sql
resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  title        TEXT,
  content_text TEXT,             -- Extracted plain text
  file_type    TEXT,             -- 'pdf' | 'docx' | 'csv'
  tags         TEXT[],
  created_at   TIMESTAMP DEFAULT NOW()
)
```

**Body size limit:** intelligence.ts sets 15MB for resource-upload action.  
**Queried by:** intelligence.ts (resource-upload/analyze/converse actions), CreateResource.tsx

---

### `page_views`

Feature-level page view tracking. Used to evaluate the `checked_analytics` milestone in growthJourney.ts.

```sql
page_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  feature    TEXT,              -- Feature/page name
  created_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** growthJourney.ts, intelligence.ts (page-view action)

---

### `newsletter_subscribers`

Simple newsletter subscription list. No double opt-in.

```sql
newsletter_subscribers (
  email         TEXT PRIMARY KEY,
  subscribed_at TIMESTAMP DEFAULT NOW()
)
```

**Queried by:** intelligence.ts (newsletter-subscribe action), NewsletterSignup.tsx

---

## Migrations

| File | Added |
|------|-------|
| `supabase/migrations/20260701_intelligence_and_notifications.sql` | intelligence_cache, post_analytics, user_pattern_cache; adds notif_* columns to profiles |
| `supabase/migrations/20260810_tool_usage_log_and_role_domain_cache.sql` | tool_usage_log, role_domain_cache; adds notif_industry_briefing to profiles |

---

## Row Level Security Summary

All tables with user data have RLS enabled. The standard pattern:

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Users can only access their own rows
CREATE POLICY "user_own_rows" ON table_name
  USING (user_id = auth.uid());
```

**Exceptions:**
- `tool_usage_log`: No RLS — insert by anyone for rate limiting. Reads filtered in application code.
- `role_domain_cache`: RLS allows any authenticated user to read/write — intentional cross-user sharing.
- `newsletter_subscribers`: Public insert allowed for unauthenticated visitors.
- `trend_cache`: Managed by backend service role; no per-user isolation needed.

---

## Supabase Storage

Two storage buckets:
- **`avatars`** — User profile photos (uploaded in Settings > Profile)
- **`resources`** — Uploaded document files (PDF/DOCX/CSV from /create/resource)

Both are accessed via the Supabase Storage API. URLs are stored in `profiles.profile_photo_url` and `resources.content_text` respectively. The backend resource parser reads content via the storage URL before storing extracted text.

---

## Key Relationships

```
auth.users (Supabase Auth)
    │
    └──1:1── profiles
               │
               ├──1:N── posts
               │          └──1:1── post_analytics
               │
               ├──1:1── persona_profiles
               ├──1:N── persona_signals
               ├──1:1── linkedin_connections
               ├──1:N── publish_log
               ├──1:1── aria_conversations
               ├──1:N── intelligence_cache  (keyed by kind)
               ├──1:1── user_pattern_cache
               ├──1:N── notifications
               ├──1:N── push_subscriptions
               ├──1:N── email_log
               ├──1:N── generated_assets
               ├──1:N── image_usage  (per day)
               ├──1:N── resources
               └──1:N── page_views

Shared (cross-user, no user_id FK):
  trend_cache       (keyed by domain)
  role_domain_cache (keyed by role+domain+kind)
  tool_usage_log    (keyed by IP+tool)
  newsletter_subscribers (keyed by email)
```
