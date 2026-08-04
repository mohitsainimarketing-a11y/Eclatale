export interface WritingStyle {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  example: string;
  prompt: string;
}

export const WRITING_STYLES: WritingStyle[] = [
  {
    id: 'storyteller', emoji: '📖', label: 'Storyteller',
    desc: 'Personal story → insight → lesson',
    example: "I almost quit three months in. Then a customer sent me one line that changed everything...",
    prompt: "Write this post as a master storyteller. Open with a specific, personal moment (even if hypothetical — make it feel real). Use short sentences. Build tension before the insight. End with a clear lesson that connects back to the opening. Never start with 'I'. Use 'You' generously. Write like you're telling a friend over coffee, not presenting at a conference.",
  },
  {
    id: 'contrarian', emoji: '🔥', label: 'Contrarian',
    desc: 'Challenges the status quo with data',
    example: "Everyone tells you to 'follow your passion.' The data says that's terrible advice.",
    prompt: "Write this post as someone who genuinely disagrees with conventional wisdom and has the data to prove it. Open with a bold, slightly provocative statement that will make people stop scrolling. Reference real patterns or data points. Acknowledge the opposing view before dismantling it. End with a rallying point, not a lecture. Sound confident, not arrogant. Sound like someone who has seen something others haven't.",
  },
  {
    id: 'teacher', emoji: '🎓', label: 'The Teacher',
    desc: 'Breaks complex ideas into simple steps',
    example: "Here's the framework I wish someone had given me on day one. Three parts. Ten minutes to learn.",
    prompt: "Write this post as a brilliant teacher who can explain anything to anyone. Break this down into the simplest possible steps or concepts. Use analogies. Use numbered lists sparingly but effectively. Every sentence should earn its place — no filler. End with the one thing you want them to remember. Sound clear, not condescending. Sound like the person everyone wishes they had as a professor.",
  },
  {
    id: 'insider', emoji: '🕵️', label: 'The Insider',
    desc: "Shares what others in industry won't",
    example: "Nobody in this industry will tell you this publicly, but here's what's actually happening behind closed doors.",
    prompt: "Write this post as someone with genuine inside knowledge that others in the industry don't have or won't say publicly. Start with a statement that signals you know something others don't. Be specific — name specific dynamics, patterns, or observations from real experience. Sound like you're letting the reader in on something. End with what this means practically for them. Never be vague. If you can't be specific, this style doesn't work.",
  },
  {
    id: 'motivator', emoji: '💪', label: 'Motivator',
    desc: 'Inspires with energy and conviction',
    example: "You are not behind. You are exactly where you need to be to build something real.",
    prompt: "Write this post as someone who genuinely believes the reader is capable of more than they think. Open with energy — not fake positivity, but genuine conviction. Use short punchy sentences. Repeat for rhythm. Build momentum through the post. End with a clear action or belief statement. Sound like someone who has been through the hard thing and come out the other side, not someone who has only read about it.",
  },
  {
    id: 'analyst', emoji: '📊', label: 'The Analyst',
    desc: 'Leads with data, backs everything',
    example: "73% of teams that adopted this failed within a year. Here's what the other 27% did differently.",
    prompt: "Write this post as someone who thinks in data and frameworks. Lead with the most surprising or counterintuitive data point you have. Build a logical argument. Use specific numbers, percentages, timeframes. Never make a claim without evidence or context. End with a clear, data-backed conclusion and implication. Sound rigorous but accessible — like a McKinsey partner explaining to a smart non-specialist.",
  },
];

export const UNIVERSAL_HUMAN_WRITING_RULES = `CRITICAL HUMAN WRITING RULES — follow these without exception:
- Never use the word 'delve', 'leverage', 'synergy', 'empower', 'transformative', 'game-changer', 'cutting-edge', 'holistic', 'paradigm', or 'utilize' — these are AI tells
- Never start with 'In today's...' or 'In the ever-evolving...' or 'As a...'
- Never use 3-word sentences followed by 3-word sentences followed by 3-word sentences — this is a known AI rhythm pattern
- Use contractions naturally (it's, you're, I've, they're)
- Vary sentence length dramatically — some very short. Others can run longer and build on themselves before landing a point.
- Include one specific detail that feels almost too specific — a number, a name, a moment — this is what makes writing feel real
- The post should feel like it was written by a specific human who has a specific perspective, not a machine trying to sound like all humans at once`;

export function getWritingStyle(id: string): WritingStyle | undefined {
  return WRITING_STYLES.find(s => s.id === id);
}

export const TALK_LENGTH_OPTIONS = [
  { id: 'micro', emoji: '⚡', label: 'Micro', words: '50-150 words', desc: 'One idea. Maximum impact.' },
  { id: 'short', emoji: '📝', label: 'Short', words: '150-300 words', desc: 'Punchy. Scannable. Done.' },
  { id: 'standard', emoji: '📄', label: 'Standard', words: '300-500 words', desc: 'The LinkedIn sweet spot.' },
  { id: 'longform', emoji: '📚', label: 'Long-form', words: '500-800 words', desc: 'Deep dive. Full authority.' },
] as const;

export function lengthInstruction(id: string): string {
  const opt = TALK_LENGTH_OPTIONS.find(o => o.id === id) || TALK_LENGTH_OPTIONS[2];
  return `Target length: ${opt.words} (LinkedIn word count, not characters). Stay within this range.`;
}
