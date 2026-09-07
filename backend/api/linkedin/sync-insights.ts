import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { checkAuthToken, reconcileUserId } from '../../lib/verifyAuth';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const authCheck = await checkAuthToken(supabase, req);
  const reconciled = reconcileUserId(userId, authCheck);
  if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
  userId = reconciled.userId;

  const {
    pageType,
    scrapedAt,
    followerCount,
    connectionCount,
    profileViews,
    searchAppearances,
    postImpressions,
    uniqueVisitors,
    engagementRate,
    totalReactions,
    totalComments,
    name,
    headline,
    location,
    posts,
    urn,
    url,
    likes,
    comments,
    reposts,
    impressions,
  } = req.body || {};

  try {
    if (pageType === 'profile' || pageType === 'analytics') {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (followerCount != null)     update.follower_count = followerCount;
      if (connectionCount != null)   update.connection_count = connectionCount;
      if (profileViews != null)      update.profile_views = profileViews;
      if (searchAppearances != null) update.search_appearances = searchAppearances;
      if (postImpressions != null)   update.post_impressions = postImpressions;
      if (uniqueVisitors != null)    update.unique_visitors = uniqueVisitors;
      if (engagementRate != null)    update.engagement_rate = engagementRate;
      if (totalReactions != null)    update.total_reactions = totalReactions;
      if (totalComments != null)     update.total_comments = totalComments;
      if (name != null)              update.linkedin_name = name;
      if (headline != null)          update.linkedin_headline = headline;
      if (location != null)          update.linkedin_location = location;

      await supabase
        .from('linkedin_connections')
        .update(update)
        .eq('user_id', userId);

      // Append to time-series history for trend charts
      await supabase.from('linkedin_insights_history').insert({
        user_id: userId,
        scraped_at: scrapedAt || new Date().toISOString(),
        page_type: pageType,
        follower_count: followerCount ?? null,
        connection_count: connectionCount ?? null,
        profile_views: profileViews ?? null,
        search_appearances: searchAppearances ?? null,
        post_impressions: postImpressions ?? null,
        engagement_rate: engagementRate ?? null,
      });
    }

    if (pageType === 'activity' && Array.isArray(posts) && posts.length > 0) {
      const rows = posts
        .filter((p: any) => p.urn || p.text)
        .map((p: any) => ({
          user_id: userId,
          post_urn: p.urn || null,
          post_text: p.text || null,
          post_type: p.type || 'text',
          posted_at: p.postedAt || null,
          likes: p.likes ?? null,
          comments: p.comments ?? null,
          reposts: p.reposts ?? null,
          impressions: p.impressions ?? null,
          scraped_at: scrapedAt || new Date().toISOString(),
        }));

      if (rows.length > 0) {
        await supabase
          .from('linkedin_post_metrics')
          .upsert(rows, { onConflict: 'user_id,post_urn', ignoreDuplicates: false });
      }
    }

    if (pageType === 'post' && urn) {
      await supabase.from('linkedin_post_metrics').upsert({
        user_id: userId,
        post_urn: urn,
        post_url: url || null,
        likes: likes ?? null,
        comments: comments ?? null,
        reposts: reposts ?? null,
        impressions: impressions ?? null,
        scraped_at: scrapedAt || new Date().toISOString(),
      }, { onConflict: 'user_id,post_urn' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('sync-insights error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
