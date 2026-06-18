import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, tone, contentType, userId } = req.body;

    if (!topic || !tone || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];

    const goalsText = goals.length > 0
      ? `Their growth goals are: ${goals.join(', ')}.`
      : '';

    const contentTypeInstructions: Record<string, string> = {
      'linkedin-post': 'Write a LinkedIn post (1300 characters max). Use short paragraphs, line breaks for readability, and include a hook in the first line. Do NOT use hashtags in the body — add 3-5 relevant hashtags at the very end separated by a blank line.',
      'linkedin-article': 'Write a LinkedIn article (800-1200 words). Include a compelling headline, introduction, 3-4 main sections with subheadings, and a strong conclusion with a call to action.',
      'twitter-thread': 'Write a Twitter/X thread (5-8 tweets, each under 280 characters). Number each tweet (1/, 2/, etc). First tweet should be a hook. Last tweet should be a call to action or summary.',
      'instagram-caption': 'Write an Instagram caption (under 2200 characters). Start with a hook, use conversational tone, break into short paragraphs, end with a call to action, and add 20-30 relevant hashtags at the end.',
    };

    const toneInstructions: Record<string, string> = {
      professional: 'Use a polished, authoritative tone. Sound knowledgeable and confident without being stiff. Use industry terminology where appropriate.',
      casual: 'Use a conversational, relatable tone. Write like you\'re talking to a friend over coffee. Use contractions, simple language, and occasional humor.',
      inspirational: 'Use an uplifting, motivational tone. Share insights that inspire action. Use powerful language, storytelling elements, and emotional resonance.',
      'data-driven': 'Use a fact-based, analytical tone. Lead with statistics, research, or data points. Back up claims with evidence. Use precise language.',
    };

    const systemPrompt = `You are a world-class personal brand content strategist and ghostwriter. You write content that sounds authentically human — never robotic or generic.

The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

Your writing style guidelines:
- ${toneInstructions[tone] || toneInstructions.professional}
- Write in first person as this professional
- Sound like a real person sharing genuine insights, not a corporate PR team
- Include specific, concrete examples or anecdotes when possible
- Make every sentence earn its place — no filler

CRITICAL OUTPUT RULES:
- Return ONLY the post content itself. No preamble like "Here's a post for you". No introduction. No meta-commentary. No dividers like "---". Start directly with the hook line.
- NEVER use markdown formatting: no ** for bold, no * for italic, no # for headers, no ` for code. LinkedIn and social platforms render these as literal characters, not formatting.
- For emphasis, use CAPITALIZATION, line breaks, and emoji instead of markdown symbols.
- Do not wrap the output in quotes or add any framing text around it.

Content format:
${contentTypeInstructions[contentType] || contentTypeInstructions['linkedin-post']}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Write a ${contentType.replace('-', ' ')} about: ${topic}`,
        },
      ],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    res.json({ content, usage: message.usage });
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

app.post('/api/suggest-topics', async (req, res) => {
  try {
    const { query, userId } = req.body;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Suggest 5 trending content topics for a ${role} in the ${industry} industry${query ? ` related to "${query}"` : ''}. Return ONLY a JSON array of strings, no explanation. Each topic should be specific and actionable (not generic).`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const topics = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ topics });
  } catch (error: any) {
    console.error('Topic suggestion error:', error);
    res.status(500).json({ error: error.message || 'Failed to suggest topics' });
  }
});

app.post('/api/guided-questions', async (req, res) => {
  try {
    const { rawIdea, contentType, userId } = req.body;

    if (!rawIdea || !contentType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `A ${role} in the ${industry} industry wants to create a ${contentType.replace(/-/g, ' ')} based on this rough idea:

"${rawIdea}"

Generate exactly 4 smart, specific follow-up questions that will help you write a compelling, authentic piece of content. Each question should draw out concrete details, personal experiences, specific numbers, or unique perspectives that will make the content stand out.

Return ONLY a JSON array of objects with "id" (q1-q4), "question" (the question text), and "placeholder" (a short example answer hint). No explanation.`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ questions });
  } catch (error: any) {
    console.error('Guided questions error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate questions' });
  }
});

app.post('/api/guided-generate', async (req, res) => {
  try {
    const { rawIdea, contentType, tone, questions, answers, userId } = req.body;

    if (!rawIdea || !contentType || !tone || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, domain, goals')
      .eq('id', userId)
      .single();

    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];

    const goalsText = goals.length > 0
      ? `Their growth goals are: ${goals.join(', ')}.`
      : '';

    const contentTypeInstructionsLocal: Record<string, string> = {
      'linkedin-post': 'Write a LinkedIn post (1300 characters max). Use short paragraphs, line breaks for readability, and include a hook in the first line. Do NOT use hashtags in the body — add 3-5 relevant hashtags at the very end separated by a blank line.',
      'linkedin-article': 'Write a LinkedIn article (800-1200 words). Include a compelling headline, introduction, 3-4 main sections with subheadings, and a strong conclusion with a call to action.',
      'twitter-thread': 'Write a Twitter/X thread (5-8 tweets, each under 280 characters). Number each tweet (1/, 2/, etc). First tweet should be a hook. Last tweet should be a call to action or summary.',
      'instagram-caption': 'Write an Instagram caption (under 2200 characters). Start with a hook, use conversational tone, break into short paragraphs, end with a call to action, and add 20-30 relevant hashtags at the end.',
    };

    const toneInstructionsLocal: Record<string, string> = {
      professional: 'Use a polished, authoritative tone. Sound knowledgeable and confident without being stiff.',
      casual: 'Use a conversational, relatable tone. Write like talking to a friend over coffee.',
      inspirational: 'Use an uplifting, motivational tone. Share insights that inspire action.',
      'data-driven': 'Use a fact-based, analytical tone. Lead with statistics and data points.',
    };

    const qaPairs = (questions || [])
      .map((q: any) => {
        const answer = answers?.[q.id] || '';
        return answer ? `Q: ${q.question}\nA: ${answer}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const systemPrompt = `You are a world-class personal brand content strategist and ghostwriter. You write content that sounds authentically human — never robotic or generic.

The person you're writing for:
- Role: ${role}
- Industry: ${industry}
${goalsText}

Writing style:
- ${toneInstructionsLocal[tone] || toneInstructionsLocal.professional}
- Write in first person as this professional
- Sound like a real person sharing genuine insights, not a corporate PR team
- Weave in the specific details they provided naturally — don't just list them
- Make every sentence earn its place — no filler

CRITICAL OUTPUT RULES:
- Return ONLY the post content itself. No preamble like "Here's a post for you". No introduction. No meta-commentary. No dividers like "---". Start directly with the hook line.
- NEVER use markdown formatting: no ** for bold, no * for italic, no # for headers, no ` for code. LinkedIn and social platforms render these as literal characters, not formatting.
- For emphasis, use CAPITALIZATION, line breaks, and emoji instead of markdown symbols.
- Do not wrap the output in quotes or add any framing text around it.

Content format:
${contentTypeInstructionsLocal[contentType] || contentTypeInstructionsLocal['linkedin-post']}`;

    const userMessage = `Create a ${contentType.replace(/-/g, ' ')} based on this idea and the additional context I provided:

My idea: "${rawIdea}"

${qaPairs ? `Additional context from my answers:\n\n${qaPairs}` : ''}

Write the content now. Make it compelling, specific, and authentic to my voice.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    console.error('Guided generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Eclatale backend running on port ${PORT}`);
});
