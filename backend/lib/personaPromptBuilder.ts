import { SupabaseClient } from '@supabase/supabase-js';

interface PersonaProfile {
  communication_styles: string[];
  formality_score: number;
  expertise_topic: string | null;
  contrarian_take: string | null;
  voice_samples: string[];
  persona_completed_at: string | null;
}

interface LearningPattern {
  preferredTone: string | null;
  preferredContentType: string | null;
  avgPostLength: number | null;
  totalKept: number;
}

function analyzeVoiceSamples(samples: string[]): string {
  if (!samples || samples.length === 0) return '';

  const allText = samples.join(' ');
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const avgSentenceLength = sentences.length > 0
    ? Math.round(sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length)
    : 15;

  const words = allText.split(/\s+/);
  const longWords = words.filter(w => w.length > 8).length;
  const vocabComplexity = words.length > 0 ? Math.round((longWords / words.length) * 100) : 10;

  const questionCount = (allText.match(/\?/g) || []).length;
  const exclamationCount = (allText.match(/!/g) || []).length;
  const usesEmoji = /[\u{1F300}-\u{1FFFF}]/u.test(allText);
  const usesCaps = /[A-Z]{3,}/.test(allText);
  const usesEllipsis = allText.includes('...');
  const usesDashes = allText.includes(' - ') || allText.includes(' -- ');

  const traits: string[] = [];
  if (avgSentenceLength < 10) traits.push('uses short, punchy sentences');
  else if (avgSentenceLength > 20) traits.push('writes in longer, flowing sentences');
  else traits.push('uses medium-length sentences');

  if (vocabComplexity > 15) traits.push('uses sophisticated vocabulary');
  else if (vocabComplexity < 5) traits.push('keeps language simple and accessible');

  if (questionCount > 2) traits.push('frequently asks rhetorical questions');
  if (exclamationCount > 2) traits.push('uses exclamation marks for energy');
  if (usesEmoji) traits.push('occasionally uses emoji');
  if (usesCaps) traits.push('uses ALL CAPS for emphasis');
  if (usesEllipsis) traits.push('uses ellipses for dramatic pauses');
  if (usesDashes) traits.push('uses dashes to break up thoughts');

  return `Voice analysis from their writing samples: ${traits.join(', ')}. Average sentence length: ${avgSentenceLength} words.`;
}

function buildFormalityDescription(score: number): string {
  if (score <= 20) return 'Very casual and conversational - writes like texting a friend';
  if (score <= 40) return 'Casual but professional - relaxed tone with substance';
  if (score <= 60) return 'Balanced professionalism - approachable yet credible';
  if (score <= 80) return 'Polished and professional - authoritative without being stiff';
  return 'Highly formal - executive-level gravitas and precision';
}

export async function buildPersonaPrompt(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const [personaRes, signalsRes] = await Promise.all([
    supabase.from('persona_profiles').select('*').eq('user_id', userId).single(),
    supabase
      .from('persona_signals')
      .select('tone, content_type, post_length')
      .eq('user_id', userId)
      .eq('action', 'kept')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const persona: PersonaProfile | null = personaRes.data;
  const signals = signalsRes.data || [];

  if (!persona || !persona.persona_completed_at) {
    return '';
  }

  const parts: string[] = [];

  parts.push('PERSONA PROFILE (use this to match the author\'s authentic voice):');

  if (persona.communication_styles.length > 0) {
    parts.push(`Communication style: ${persona.communication_styles.join(', ')}.`);
  }

  parts.push(`Formality level: ${persona.formality_score}/100 - ${buildFormalityDescription(persona.formality_score)}.`);

  if (persona.expertise_topic) {
    parts.push(`Core expertise: ${persona.expertise_topic}. Weave this authority naturally into content.`);
  }

  if (persona.contrarian_take) {
    parts.push(`Distinctive perspective: "${persona.contrarian_take}". This viewpoint shapes how they see their industry - let it influence the angle when relevant, but don't force it into every post.`);
  }

  if (persona.voice_samples.length > 0) {
    const analysis = analyzeVoiceSamples(persona.voice_samples);
    if (analysis) parts.push(analysis);
    parts.push(`Reference writing samples (match this voice closely):\n${persona.voice_samples.map((s, i) => `Sample ${i + 1}: "${s.substring(0, 500)}"`).join('\n')}`);
  }

  if (signals.length >= 3) {
    const tones = signals.map(s => s.tone).filter(Boolean);
    const types = signals.map(s => s.content_type).filter(Boolean);
    const lengths = signals.map(s => s.post_length).filter(Boolean);

    const topTone = mostFrequent(tones);
    const topType = mostFrequent(types);
    const avgLen = lengths.length > 0 ? Math.round(lengths.reduce((a: number, b: number) => a + b, 0) / lengths.length) : null;

    const learnings: string[] = [];
    if (topTone) learnings.push(`they tend to prefer a ${topTone} tone`);
    if (topType) learnings.push(`they most often write ${topType.replace(/-/g, ' ')}s`);
    if (avgLen) learnings.push(`their preferred post length is around ${avgLen} characters`);

    if (learnings.length > 0) {
      parts.push(`Learned preferences from their usage patterns: ${learnings.join(', ')}.`);
    }
  }

  return parts.join('\n');
}

export async function getLearningPatterns(
  supabase: SupabaseClient,
  userId: string
): Promise<LearningPattern> {
  const { data } = await supabase
    .from('persona_signals')
    .select('tone, content_type, post_length')
    .eq('user_id', userId)
    .eq('action', 'kept')
    .order('created_at', { ascending: false })
    .limit(10);

  const signals = data || [];
  if (signals.length === 0) {
    return { preferredTone: null, preferredContentType: null, avgPostLength: null, totalKept: 0 };
  }

  const tones = signals.map((s: any) => s.tone).filter(Boolean);
  const types = signals.map((s: any) => s.content_type).filter(Boolean);
  const lengths = signals.map((s: any) => s.post_length).filter(Boolean);

  return {
    preferredTone: mostFrequent(tones),
    preferredContentType: mostFrequent(types),
    avgPostLength: lengths.length > 0 ? Math.round(lengths.reduce((a: number, b: number) => a + b, 0) / lengths.length) : null,
    totalKept: signals.length,
  };
}

function mostFrequent(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
