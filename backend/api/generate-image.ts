import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ASPECT_RATIOS: Record<string, string> = {
  'square': '1024x1024',
  'vertical': '1024x1792',
  'landscape': '1792x1024',
  'infographic': '1024x1792',
  'carousel': '1024x1024',
};

const STYLE_PROMPTS: Record<string, string> = {
  'minimal': 'Clean, minimalist design with lots of white space, simple geometric shapes, modern sans-serif typography feel, muted color palette',
  'bold': 'Bold, vibrant colors, dynamic composition, high contrast, eye-catching gradient backgrounds, energetic modern design',
  'professional': 'Corporate professional style, clean layout, business-appropriate, subtle gradients, navy/white/grey color scheme, polished and trustworthy',
  'illustrated': 'Hand-drawn illustration style, organic lines, warm colors, friendly approachable feel, sketch-like artistic quality',
  'dataviz': 'Data visualization aesthetic, clean charts and graphs style, information-dense but readable, tech-forward, geometric patterns representing data',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { topic, format, style, userId, postId } = req.body;

    if (!topic || !format || !style || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: todayUsage } = await supabase
      .from('image_usage')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (todayUsage && todayUsage.length >= 10) {
      return res.status(429).json({ error: 'Daily image generation limit reached (10/day). Try again tomorrow.' });
    }

    const size = ASPECT_RATIOS[format] || '1024x1024';
    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['minimal'];

    const imagePrompt = `Create a social media graphic for a post about: "${topic}".

Style: ${stylePrompt}.

This is a ${format} format image for social media. Make it visually striking and professional. NO text or words in the image. Focus on abstract shapes, patterns, icons, and visual metaphors that represent the topic. The image should work as a background or companion visual for a text post.`;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Image generation not configured. Add OPENAI_API_KEY to enable this feature.' });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size,
        quality: 'standard',
      }),
    });

    if (!openaiRes.ok) {
      const err: any = await openaiRes.json();
      return res.status(openaiRes.status).json({
        error: err.error?.message || 'Image generation failed',
      });
    }

    const openaiData: any = await openaiRes.json();
    const imageUrl = openaiData.data?.[0]?.url;

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image returned from generation' });
    }

    const { data: asset } = await supabase.from('generated_assets').insert({
      user_id: userId,
      post_id: postId || null,
      image_url: imageUrl,
      prompt: imagePrompt,
      format,
      style,
      aspect_ratio: size,
    }).select('id').single();

    await supabase.from('image_usage').insert({ user_id: userId });

    res.json({
      imageUrl,
      assetId: asset?.id,
      prompt: imagePrompt,
    });
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
}
