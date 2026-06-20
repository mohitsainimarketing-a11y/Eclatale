import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { buildPersonaPrompt } from '../lib/personaPromptBuilder';
import { SYSTEM_PROMPT_BASE, CONTENT_TYPE_INSTRUCTIONS, TONE_INSTRUCTIONS, OUTPUT_RULES, TOPIC_SUGGESTION_PROMPT } from '../lib/contentPrompts';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, tone, contentType, userId } = req.body;
    if (!topic || !tone || !contentType || !userId) return res.status(400).json({ error: 'Missing required fields' });

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];
    const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';
    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${personaFragment ? personaFragment + '\n' : ''}The person you're writing for:\n- Role: ${role}\n- Industry: ${industry}\n${goalsText}\n\n${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}\n\n${OUTPUT_RULES}\n\n${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 2048,
      messages: [{ role: 'user', content: `Write a ${contentType.replace(/-/g, ' ')} about: ${topic}` }],
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
    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const topicPrompt = TOPIC_SUGGESTION_PROMPT.replace("${'{role}'}", role).replace("${'{industry}'}", industry);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 512,
      system: topicPrompt,
      messages: [{ role: 'user', content: `Suggest 5 timely, high-signal content topics for a ${role} in the ${industry} industry${query ? ` related to "${query}"` : ''}.\n\n${personaFragment ? `About this person:\n${personaFragment}\n\n` : ''}Think about what's happening RIGHT NOW in ${industry}. Return ONLY a JSON array of 5 strings.` }],
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
    if (!rawIdea || !contentType || !userId) return res.status(400).json({ error: 'Missing required fields' });

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      messages: [{ role: 'user', content: `A ${role} in the ${industry} industry wants to create a ${contentType.replace(/-/g, ' ')} based on this rough idea:\n\n"${rawIdea}"\n\nGenerate exactly 4 smart, specific follow-up questions that will extract the GOLD from their experience — concrete details, specific numbers, personal stories, counterintuitive insights, and unique perspectives that will make the content impossible to ignore.\n\nReturn ONLY a JSON array of objects with "id" (q1-q4), "question" (the question text), and "placeholder" (a short example answer hint). No explanation.` }],
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
    if (!rawIdea || !contentType || !tone || !userId) return res.status(400).json({ error: 'Missing required fields' });

    const { data: profile } = await supabase.from('profiles').select('role, domain, goals').eq('id', userId).single();
    const role = profile?.role || 'professional';
    const industry = profile?.domain || 'business';
    const goals = profile?.goals || [];
    const goalsText = goals.length > 0 ? `Their growth goals are: ${goals.join(', ')}.` : '';
    const personaFragment = await buildPersonaPrompt(supabase, userId);

    const qaPairs = (questions || [])
      .map((q: any) => { const a = answers?.[q.id] || ''; return a ? `Q: ${q.question}\nA: ${a}` : ''; })
      .filter(Boolean).join('\n\n');

    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\n${personaFragment ? personaFragment + '\n' : ''}The person you're writing for:\n- Role: ${role}\n- Industry: ${industry}\n${goalsText}\n\n${TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional}\n\nAdditional: Weave their specific details NATURALLY. The reader should never sense this was generated from a questionnaire.\n\n${OUTPUT_RULES}\n\n${CONTENT_TYPE_INSTRUCTIONS[contentType] || CONTENT_TYPE_INSTRUCTIONS['linkedin-post']}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 2048,
      messages: [{ role: 'user', content: `Create a ${contentType.replace(/-/g, ' ')} based on this idea and context:\n\nMy idea: "${rawIdea}"\n\n${qaPairs ? `Context from my answers:\n\n${qaPairs}` : ''}\n\nTransform this into compelling content.` }],
      system: systemPrompt,
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ content, usage: message.usage });
  } catch (error: any) {
    console.error('Guided generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

app.post('/api/persona-signal', async (req, res) => {
  try {
    const { userId, postId, action, tone, contentType, topicSnippet, postLength } = req.body;
    if (!userId || !action) return res.status(400).json({ error: 'Missing required fields' });
    await supabase.from('persona_signals').insert({
      user_id: userId, post_id: postId || null, action, tone: tone || null,
      content_type: contentType || null, topic_snippet: topicSnippet || null, post_length: postLength || null,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Signal logging error:', error);
    res.status(500).json({ error: error.message || 'Failed to log signal' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Eclatale backend running on port ${PORT}`);
});
