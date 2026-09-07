-- Add insight columns to linkedin_connections
ALTER TABLE linkedin_connections
  ADD COLUMN IF NOT EXISTS follower_count       integer,
  ADD COLUMN IF NOT EXISTS connection_count     integer,
  ADD COLUMN IF NOT EXISTS profile_views        integer,
  ADD COLUMN IF NOT EXISTS search_appearances   integer,
  ADD COLUMN IF NOT EXISTS post_impressions     integer,
  ADD COLUMN IF NOT EXISTS unique_visitors      integer,
  ADD COLUMN IF NOT EXISTS engagement_rate      numeric(5,2),
  ADD COLUMN IF NOT EXISTS total_reactions      integer,
  ADD COLUMN IF NOT EXISTS total_comments       integer,
  ADD COLUMN IF NOT EXISTS linkedin_headline    text,
  ADD COLUMN IF NOT EXISTS linkedin_location    text;

-- Time-series history for trend charts
CREATE TABLE IF NOT EXISTS linkedin_insights_history (
  id                serial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scraped_at        timestamptz NOT NULL DEFAULT now(),
  page_type         text,
  follower_count    integer,
  connection_count  integer,
  profile_views     integer,
  search_appearances integer,
  post_impressions  integer,
  engagement_rate   numeric(5,2)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_insights_history_user_scraped
  ON linkedin_insights_history(user_id, scraped_at DESC);

ALTER TABLE linkedin_insights_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own insights history"
  ON linkedin_insights_history FOR ALL
  USING (auth.uid() = user_id);

-- Per-post metrics table
CREATE TABLE IF NOT EXISTS linkedin_post_metrics (
  id          serial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_urn    text,
  post_url    text,
  post_text   text,
  post_type   text DEFAULT 'text',
  posted_at   text,
  likes       integer,
  comments    integer,
  reposts     integer,
  impressions integer,
  scraped_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_urn)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_post_metrics_user
  ON linkedin_post_metrics(user_id, scraped_at DESC);

ALTER TABLE linkedin_post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own post metrics"
  ON linkedin_post_metrics FOR ALL
  USING (auth.uid() = user_id);
