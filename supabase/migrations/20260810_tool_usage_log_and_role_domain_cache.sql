-- IP-based rate limiting for the anonymous /tools endpoints (10 req/IP/hour).
-- Only ever touched by the backend service-role client, so RLS is enabled
-- with no policies (service role bypasses RLS; no client ever queries this).
create table if not exists public.tool_usage_log (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  tool text not null,
  created_at timestamptz not null default now()
);
create index if not exists tool_usage_log_ip_created_idx on public.tool_usage_log (ip, created_at);
alter table public.tool_usage_log enable row level security;

-- Cross-user cache for role+domain-scoped aggregate insights (industry
-- intelligence panel, hook library industry templates/trending hooks).
-- Distinct from intelligence_cache (which is per-user) so many users sharing
-- a role+domain share one cached Claude call.
create table if not exists public.role_domain_cache (
  role text not null,
  domain text not null,
  kind text not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (role, domain, kind)
);
alter table public.role_domain_cache enable row level security;

-- Weekly industry briefing opt-out, matching the existing notif_* boolean
-- column convention on profiles (see notif_weekly_digest).
alter table public.profiles add column if not exists notif_industry_briefing boolean not null default true;
