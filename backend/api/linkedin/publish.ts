import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../../lib/linkedinTokenRefresh';
import { checkPostMilestone } from '../../lib/notifications';
import { checkAuthToken, reconcileUserId } from '../../lib/verifyAuth';

// Carousel publish uploads each slide to LinkedIn sequentially (up to 9),
// which can comfortably exceed Vercel's 10s Hobby-plan default.
export const config = { maxDuration: 60 };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_CAROUSEL_SLIDES = 9; // LinkedIn's practical cap on images in one multi-image UGC post

// ── Carousel publish (shares this file so it stays within Vercel's 12-function cap) ──

async function registerAndUploadImage(dataUrl: string, token: string, memberId: string): Promise<string> {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) throw new Error('Invalid image data');
  const buffer = Buffer.from(match[1], 'base64');

  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${memberId}`,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  if (!registerRes.ok) {
    const errBody = await registerRes.text();
    throw new Error(`LinkedIn rejected the image upload registration: ${errBody.slice(0, 200)}`);
  }
  const registerData: any = await registerRes.json();
  const uploadUrl = registerData.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = registerData.value?.asset;
  if (!uploadUrl || !asset) throw new Error('LinkedIn did not return an upload URL for the image');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: buffer,
  });
  if (!uploadRes.ok) throw new Error(`LinkedIn image upload failed (${uploadRes.status})`);

  return asset;
}

async function handleCarouselPublish(req: VercelRequest, res: VercelResponse, userId: string) {
  const { images, caption } = req.body;
  if (!Array.isArray(images) || images.length < 2 || !caption) {
    return res.status(400).json({ error: 'Missing images or caption. A carousel needs at least 2 slides.' });
  }
  if (images.length > MAX_CAROUSEL_SLIDES) {
    return res.status(400).json({ error: `LinkedIn allows at most ${MAX_CAROUSEL_SLIDES} images in one post.` });
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

  const tokenResult = await getValidToken(supabase, userId);
  if ('error' in tokenResult) {
    await logPublish(userId, null, false, tokenResult.error, 'publish_linkedin_carousel');
    return res.status(401).json({ error: tokenResult.error });
  }
  const { token, memberId } = tokenResult;

  let assetUrns: string[];
  try {
    // Sequential, not parallel: LinkedIn's asset-registration endpoint is
    // sensitive to bursts of concurrent calls from the same member.
    assetUrns = [];
    for (const img of images) {
      assetUrns.push(await registerAndUploadImage(img, token, memberId));
    }
  } catch (uploadErr: any) {
    await logPublish(userId, null, false, uploadErr.message, 'publish_linkedin_carousel');
    return res.status(502).json({ error: uploadErr.message || 'Failed to upload carousel images to LinkedIn' });
  }

  const ugcPayload = {
    author: `urn:li:person:${memberId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: caption },
        shareMediaCategory: 'IMAGE',
        media: assetUrns.map(urn => ({ status: 'READY', media: urn })),
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
    let errorMsg = 'Failed to publish carousel to LinkedIn';
    try {
      const parsed = JSON.parse(errBody);
      errorMsg = parsed.message || parsed.error || errorMsg;
    } catch {}
    if (publishRes.status === 401 || publishRes.status === 403) {
      errorMsg = 'LinkedIn token is invalid or expired. Please reconnect your account.';
    } else if (publishRes.status === 429) {
      errorMsg = 'LinkedIn rate limit exceeded. Please wait and try again later.';
    }
    await logPublish(userId, null, false, `${publishRes.status}: ${errorMsg}`, 'publish_linkedin_carousel');
    return res.status(publishRes.status).json({ error: errorMsg });
  }

  const publishData: any = await publishRes.json();
  const linkedinPostUrn = publishData.id || null;

  const { data: post } = await supabase.from('posts').insert({
    user_id: userId,
    content: caption,
    content_type: 'carousel',
    source: 'visual-creator',
    status: 'published',
    published_at: new Date().toISOString(),
    linkedin_post_urn: linkedinPostUrn,
  }).select('id').single();

  await logPublish(userId, post?.id || null, true, null, 'publish_linkedin_carousel');
  await checkPostMilestone(supabase, userId);

  res.json({ success: true, linkedinPostUrn, postId: post?.id });
}

// ── Text post publish ──────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Missing request body' });
    let userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(userId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;

    if (Array.isArray(req.body.images)) return handleCarouselPublish(req, res, userId);

    const { postId } = req.body;
    if (!postId) return res.status(400).json({ error: 'Missing postId' });

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
    await checkPostMilestone(supabase, userId);

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

async function logPublish(userId: string, postId: string | null, success: boolean, errorMessage: string | null, action: string = 'publish_linkedin') {
  await supabase.from('publish_log').insert({
    user_id: userId,
    post_id: postId,
    action,
    success,
    error_message: errorMessage,
  });
}
