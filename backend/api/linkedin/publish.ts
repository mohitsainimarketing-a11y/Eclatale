import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../../lib/linkedinTokenRefresh';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { postId, userId } = req.body;

    if (!postId || !userId) {
      return res.status(400).json({ error: 'Missing postId or userId' });
    }

    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .single();

    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.status === 'published') {
      return res.status(400).json({ error: 'This post has already been published to LinkedIn' });
    }

    const { data: todayPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'published')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (todayPosts && todayPosts.length >= 5) {
      return res.status(429).json({ error: 'Daily LinkedIn posting limit reached (5/day). Try again tomorrow.' });
    }

    const { data: recentPublish } = await supabase
      .from('posts')
      .select('published_at')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1);

    let recentWarning = false;
    if (recentPublish && recentPublish.length > 0) {
      const lastPublished = new Date(recentPublish[0].published_at);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      if (lastPublished > twoHoursAgo) recentWarning = true;
    }

    const tokenResult = await getValidToken(supabase, userId);
    if ('error' in tokenResult) {
      await logPublish(userId, postId, false, tokenResult.error);
      return res.status(401).json({ error: tokenResult.error });
    }

    const { token, memberId } = tokenResult;

    const ugcPayload = {
      author: `urn:li:person:${memberId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const publishRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(ugcPayload),
    });

    if (!publishRes.ok) {
      const errBody = await publishRes.text();
      let errorMsg = 'Failed to publish to LinkedIn';
      try {
        const parsed = JSON.parse(errBody);
        errorMsg = parsed.message || parsed.error || errorMsg;
      } catch {}

      if (publishRes.status === 401 || publishRes.status === 403) {
        errorMsg = 'LinkedIn token is invalid or expired. Please reconnect your account.';
      } else if (publishRes.status === 429) {
        errorMsg = 'LinkedIn rate limit exceeded. Please wait and try again later.';
      }

      await logPublish(userId, postId, false, `${publishRes.status}: ${errorMsg}`);
      return res.status(publishRes.status).json({ error: errorMsg });
    }

    const publishData: any = await publishRes.json();
    const linkedinPostUrn = publishData.id || null;

    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      linkedin_post_urn: linkedinPostUrn,
    }).eq('id', postId);

    await logPublish(userId, postId, true, null);

    res.json({
      success: true,
      linkedinPostUrn,
      recentWarning,
    });
  } catch (error: any) {
    console.error('Publish error:', error);
    res.status(500).json({ error: error.message || 'Failed to publish' });
  }
}

async function logPublish(userId: string, postId: string, success: boolean, errorMessage: string | null) {
  await supabase.from('publish_log').insert({
    user_id: userId,
    post_id: postId,
    action: 'publish_linkedin',
    success,
    error_message: errorMessage,
  });
}
