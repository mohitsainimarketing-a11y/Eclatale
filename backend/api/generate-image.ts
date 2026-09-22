import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { getDateContext } from '../lib/dateContext';
import { checkAuthToken, reconcileUserId } from '../lib/verifyAuth';
import { NO_DASH_RULE } from '../lib/writingStyles';

// Carousel mode plans 6 slides with Claude, then generates 6 images. Comfortably
// past Vercel's 10s Hobby-plan default; this raises the ceiling (60s is the max
// the Hobby plan allows) rather than leaving carousel generation to time out.
export const config = { maxDuration: 60 };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// FLUX.2-dev hallucinates garbled pseudo-text when the prompt reads like a
// caption/headline it should "depict" (e.g. "inspired by the theme: <topic>").
// Abstracting the topic into non-caption-shaped visual/mood concepts first
// removes anything phrase-like for the model to echo back as fake typography.
async function abstractVisualTheme(topic: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    system: getDateContext(),
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
  'carousel': { width: 1024, height: 1024 }, // must be a multiple of 16 for FLUX.2-dev
};

const STYLE_PROMPTS: Record<string, string> = {
  'minimal': 'Clean minimalist composition, abundant white space, simple geometric shapes, thin elegant lines, soft pastel color fields, uncluttered abstract layout',
  'bold': 'Bold vibrant colors, dynamic abstract shapes, high-contrast gradient washes, overlapping geometric forms, energetic visual rhythm',
  'professional': 'Corporate abstract background, clean geometric grid, layered navy and grey gradient fields, polished translucent planes, understated business aesthetic',
  'illustrated': 'Hand-drawn illustration style, organic abstract shapes, botanical or geometric motifs, warm earth tones, sketchy artistic texture, friendly decorative feel',
  'dataviz': 'Abstract data visualization background, stylized bar-chart silhouettes, circular diagram shapes, tech-forward geometric grid, abstract flow-lines and dot-matrix patterns',
};

function buildImagePrompt(visualTheme: string, style: string): string {
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['minimal'];
  return `Abstract social media background graphic evoking these visual concepts: ${visualTheme}. Style: ${stylePrompt}. ABSOLUTE REQUIREMENT: zero text, zero letters, zero numbers, zero words anywhere in the image, none whatsoever. Do NOT render any typography, headlines, captions, labels, axis labels, chart legends, signage, watermarks, logos, or UI text. Any chart or diagram shapes must be completely unlabeled. The image will have a real text layer composited on top separately. Generate ONLY pure visual elements: abstract color fields, geometric shapes, gradients, illustrative icons, organic forms, textures. High quality, professional, visually striking composition.`;
}

async function callTogether(prompt: string, size: { width: number; height: number }): Promise<string> {
  const togetherRes = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.2-dev',
      prompt,
      width: size.width,
      height: size.height,
      n: 1,
      response_format: 'b64_json',
    }),
  });
  if (!togetherRes.ok) {
    const err: any = await togetherRes.json().catch(() => ({}));
    const e: any = new Error(err.error?.message || 'Image generation failed. Make sure you have credits on Together AI.');
    e.status = togetherRes.status;
    throw e;
  }
  const data: any = await togetherRes.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned from generation');
  return `data:image/png;base64,${b64}`;
}

// ── Carousel planning (shares this file so it stays within Vercel's 12-function cap) ──

const SLIDE_COUNT = 6;
interface SlidePlan { headline: string; visualConcept: string; }

async function planCarouselSlides(topic: string): Promise<{ caption: string; slides: SlidePlan[] }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: getDateContext(),
    messages: [{
      role: 'user',
      content: `Turn this into a ${SLIDE_COUNT}-slide LinkedIn carousel.

Topic: "${topic}"

Structure: slide 1 is the hook (a specific, concrete claim or number that earns the swipe), slides 2 to ${SLIDE_COUNT - 1} each make one clear point building toward the idea, slide ${SLIDE_COUNT} closes with a takeaway or call to action. Each slide needs a short headline (under 90 characters, the only text that appears on that slide, no slide numbers or "Slide X" labels) and a visualConcept: 5 to 7 abstract visual or mood descriptors for that slide's background graphic (colors, shapes, motion, emotional tone). visualConcept must NEVER be a sentence, caption, or headline, only comma-separated concept fragments, no punctuation besides commas, nothing that reads like text meant to be displayed.

Also write a short caption (2 to 4 sentences) to accompany the carousel as the LinkedIn post text above the images. It should earn the swipe into slide 1, not repeat the slide headlines.

The caption and every headline are real published content, so they follow the same writing rules as any LinkedIn post: never write a reveal bridge ("It's not X, it's Y", "The problem isn't X. It's Y", "Here's the thing:"), never use banned vocabulary (delve, leverage, synergy, empower, transformative, game-changer, cutting-edge, holistic, paradigm, utilize, unlock, foster, nuanced, streamline, elevate, robust, comprehensive, insights, landscape, notably, crucial, significant, pivotal, seamlessly, groundbreaking, revolutionary, innovative), never use a staccato stack ("No X. No Y. Just Z.") or negative parallelism ("Not A. Not B. Not C."). ${NO_DASH_RULE}

Return ONLY JSON: {"caption": "...", "slides": [{"headline": "...", "visualConcept": "..."}, ...exactly ${SLIDE_COUNT} entries]}`,
    }],
  });
  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw);
  const slides: SlidePlan[] = Array.isArray(parsed.slides) ? parsed.slides.slice(0, SLIDE_COUNT) : [];
  if (slides.length !== SLIDE_COUNT) throw new Error('Could not plan carousel slides. Try a more specific topic.');
  return { caption: String(parsed.caption || '').trim(), slides };
}

async function handleCarousel(req: VercelRequest, res: VercelResponse, userId: string) {
  const { topic, style } = req.body;
  if (!topic || !style) return res.status(400).json({ error: 'Missing topic or style' });
  if (!process.env.TOGETHER_API_KEY) {
    return res.status(500).json({ error: 'Image generation not configured. Add TOGETHER_API_KEY to enable.' });
  }

  const { data: todayUsage } = await supabase
    .from('image_usage')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const usedToday = todayUsage?.length || 0;
  const DAILY_LIMIT = 10;
  if (usedToday + SLIDE_COUNT > DAILY_LIMIT) {
    return res.status(429).json({
      error: `A carousel uses ${SLIDE_COUNT} of your ${DAILY_LIMIT} daily image generations. You have ${DAILY_LIMIT - usedToday} left today.`,
      usageToday: usedToday, usageLimit: DAILY_LIMIT,
    });
  }

  const { caption, slides } = await planCarouselSlides(String(topic));
  const size = SIZES['carousel'];
  // Sequential, not Promise.all: firing 6 requests at Together AI in the same
  // instant trips their burst rate limiter even though each call individually
  // succeeds. The 60s duration budget above comfortably covers this serially.
  const images: string[] = [];
  for (const s of slides) {
    images.push(await callTogether(buildImagePrompt(s.visualConcept, style), size));
  }

  await supabase.from('image_usage').insert(
    Array.from({ length: SLIDE_COUNT }, () => ({ user_id: userId }))
  );

  res.json({
    caption,
    slides: slides.map((s, i) => ({ headline: s.headline, imageUrl: images[i] })),
    usageToday: usedToday + SLIDE_COUNT,
    usageLimit: DAILY_LIMIT,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Missing request body' });
    const { topic, format, style, postId, mode } = req.body;
    let userId = req.body.userId;

    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const authCheck = await checkAuthToken(supabase, req);
    const reconciled = reconcileUserId(userId, authCheck);
    if (reconciled.error) return res.status(reconciled.error.status).json({ error: reconciled.error.message });
    userId = reconciled.userId;

    if (mode === 'carousel') return handleCarousel(req, res, userId);

    if (!topic || !format || !style) {
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

    const usedToday = todayUsage?.length || 0;
    const DAILY_LIMIT = 10;
    if (usedToday >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'Daily image generation limit reached (10/day). Try again tomorrow.', usageToday: usedToday, usageLimit: DAILY_LIMIT });
    }

    const size = SIZES[format] || SIZES['square'];

    let visualTheme: string;
    try {
      visualTheme = await abstractVisualTheme(topic);
    } catch {
      visualTheme = topic.replace(/[^\w\s]/g, ' ').substring(0, 60).trim();
    }
    const imagePrompt = buildImagePrompt(visualTheme, style);
    const imageUrl = await callTogether(imagePrompt, size);

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
      usageToday: usedToday + 1,
      usageLimit: DAILY_LIMIT,
    });
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to generate image' });
  }
}
