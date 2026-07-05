import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// FLUX.1-schnell hallucinates garbled pseudo-text when the prompt reads like a
// caption/headline it should "depict" (e.g. "inspired by the theme: <topic>").
// Abstracting the topic into non-caption-shaped visual/mood concepts first
// removes anything phrase-like for the model to echo back as fake typography.
async function abstractVisualTheme(topic: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Convert this post topic into 5-7 abstract visual/mood descriptors for a background graphic (colors, shapes, motion, emotional tone). Do NOT write a sentence, caption, or headline. Comma-separated concept fragments only, no punctuation besides commas, nothing that reads like text meant to be displayed. Topic: "${topic}"`,
    }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return text.replace(/[."\n]/g, ' ').trim().substring(0, 200) || topic.replace(/[^\w\s]/g, ' ').substring(0, 60).trim();
}

const SIZES: Record<string, { width: number; height: number }> = {
  'square': { width: 1024, height: 1024 },
  'vertical': { width: 768, height: 1344 },
  'landscape': { width: 1344, height: 768 },
  'infographic': { width: 768, height: 1344 },
  'carousel': { width: 1024, height: 1024 },
};

const STYLE_PROMPTS: Record<string, string> = {
  'minimal': 'Clean minimalist composition, abundant white space, simple geometric shapes, thin elegant lines, soft pastel color fields, uncluttered abstract layout',
  'bold': 'Bold vibrant colors, dynamic abstract shapes, high-contrast gradient washes, overlapping geometric forms, energetic visual rhythm',
  'professional': 'Corporate abstract background, clean geometric grid, layered navy and grey gradient fields, polished translucent planes, understated business aesthetic',
  'illustrated': 'Hand-drawn illustration style, organic abstract shapes, botanical or geometric motifs, warm earth tones, sketchy artistic texture, friendly decorative feel',
  'dataviz': 'Abstract data visualization background, stylized bar-chart silhouettes, circular diagram shapes, tech-forward geometric grid, abstract flow-lines and dot-matrix patterns',
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

    let visualTheme: string;
    try {
      visualTheme = await abstractVisualTheme(topic);
    } catch {
      visualTheme = topic.replace(/[^\w\s]/g, ' ').substring(0, 60).trim();
    }
    const imagePrompt = `Abstract social media background graphic evoking these visual concepts: ${visualTheme}. Style: ${stylePrompt}. ABSOLUTE REQUIREMENT: zero text, zero letters, zero numbers, zero words anywhere in the image, none whatsoever. Do NOT render any typography, headlines, captions, labels, axis labels, chart legends, signage, watermarks, logos, or UI text. Any chart or diagram shapes must be completely unlabeled. The image will have a real text layer composited on top separately. Generate ONLY pure visual elements: abstract color fields, geometric shapes, gradients, illustrative icons, organic forms, textures. High quality, professional, visually striking composition.`;

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
