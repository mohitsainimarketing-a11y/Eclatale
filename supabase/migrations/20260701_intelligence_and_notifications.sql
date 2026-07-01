-- Pending migration (Supabase MCP was unavailable during the build session).
-- Apply via: supabase db execute, the SQL editor, or MCP apply_migration.
-- All features degrade gracefully until this is applied:
--   * intelligence_cache: absence => features run uncached (fresh each call)
--   * notif_* columns: absence => digest treats every user as opted-in

-- 24h cache for AI intelligence payloads (competitor intel, best-time, patterns)
create table if not exists intelligence_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table intelligence_cache enable row level security;
drop policy if exists "own intelligence cache select" on intelligence_cache;
create policy "own intelligence cache select" on intelligence_cache
  for select using (auth.uid() = user_id);
drop policy if exists "own intelligence cache modify" on intelligence_cache;
create policy "own intelligence cache modify" on intelligence_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notification preferences (weekly digest opt-in defaults to true)
alter table profiles add column if not exists notif_weekly_digest boolean not null default true;
alter table profiles add column if not exists notif_post_reminders boolean not null default true;
alter table profiles add column if not exists notif_publish_confirm boolean not null default true;
