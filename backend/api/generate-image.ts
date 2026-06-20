import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SIZES: Record<string, { width: number; height: number }> = {
  'square': { width: 1024, height: 1024 },
  'vertical': { width: 768, height: 1344 },
  'landscape': { width: 1344, height: 768 },
  'infographic': { width: 768, height: 1344 },
  'carousel': { width: 1024, height: 1024 },
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

    if (!process.env.TOGETHER_API_KEY) {
      return res.status(500).json({ error: 'Image generation not configured. Add TOGETHER_API_KEY to enable.' });
    }

    const { data: todayUsage } = await supabase
      .from('image_usage')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (todayUsage && todayUsage.length >= 10) {
      return res.status(429).json({ error: 'Daily image generation limit reached (10/day). Try again tomorrow.' });
    }

    const size = SIZES[format] || SIZES['square'];
    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['minimal'];

    const imagePrompt = `Social media graphic about: "${topic}". Style: ${stylePrompt}. Professional, visually striking. NO text or words in the image. Focus on abstract shapes, patterns, icons, and visual metaphors. High quality, modern design.`;

    const togetherRes = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: imagePrompt,
        width: size.width,
        height: size.height,
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!togetherRes.ok) {
      const err: any = await togetherRes.json();
      console.error('Together AI error:', err);
      return res.status(togetherRes.status).json({
        error: err.error?.message || 'Image generation failed. Make sure you have credits on Together AI.',
      });
    }

    const togetherData: any = await togetherRes.json();
    const b64 = togetherData.data?.[0]?.b64_json;

    if (!b64) {
      return res.status(500).json({ error: 'No image returned from generation' });
    }

    const imageUrl = `data:image/png;base64,${b64}`;

    const { data: asset } = await supabase.from('generated_assets').insert({
      user_id: userId,
      post_id: postId || null,
      image_url: imageUrl.substring(0, 200) + '...[base64]',
      prompt: imagePrompt,
      format,
      style,
      aspect_ratio: `${size.width}x${size.height}`,
    }).select('id').single();

    await supabase.from('image_usage').insert({ user_id: userId });

    res.json({
      imageUrl,
      assetId: asset?.id,
    });
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
}
