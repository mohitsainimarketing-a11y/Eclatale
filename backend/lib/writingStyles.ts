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
    desc: 'Personal story, insight, lesson',
    example: "I almost quit three months in. Then a customer sent me one line that changed everything...",
    prompt: "Write this post as a master storyteller. Open with a specific, personal moment (even if hypothetical, make it feel real). Use short sentences. Build tension before the insight. End with a clear lesson that connects back to the opening. Never start with 'I'. Use 'You' generously. Write like you're telling a friend over coffee, not presenting at a conference.",
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
    prompt: "Write this post as a brilliant teacher who can explain anything to anyone. Break this down into the simplest possible steps or concepts. Use analogies. Use numbered lists sparingly but effectively. Every sentence should earn its place, with no filler. End with the one thing you want them to remember. Sound clear, not condescending. Sound like the person everyone wishes they had as a professor.",
  },
  {
    id: 'insider', emoji: '🕵️', label: 'The Insider',
    desc: "Shares what others in industry won't",
    example: "Nobody in this industry will tell you this publicly, but here's what's actually happening behind closed doors.",
    prompt: "Write this post as someone with genuine inside knowledge that others in the industry don't have or won't say publicly. Start with a statement that signals you know something others don't. Be specific. Name specific dynamics, patterns, or observations from real experience. Sound like you're letting the reader in on something. End with what this means practically for them. Never be vague. If you can't be specific, this style doesn't work.",
  },
  {
    id: 'motivator', emoji: '💪', label: 'Motivator',
    desc: 'Inspires with energy and conviction',
    example: "You are not behind. You are exactly where you need to be to build something real.",
    prompt: "Write this post as someone who genuinely believes the reader is capable of more than they think. Open with energy. Not fake positivity, but genuine conviction. Use short punchy sentences. Repeat for rhythm. Build momentum through the post. End with a clear action or belief statement. Sound like someone who has been through the hard thing and come out the other side, not someone who has only read about it.",
  },
  {
    id: 'analyst', emoji: '📊', label: 'The Analyst',
    desc: 'Leads with data, backs everything',
    example: "73% of teams that adopted this failed within a year. Here's what the other 27% did differently.",
    prompt: "Write this post as someone who thinks in data and frameworks. Lead with the most surprising or counterintuitive data point you have. Build a logical argument. Use specific numbers, percentages, timeframes. Never make a claim without evidence or context. End with a clear, data-backed conclusion and implication. Sound rigorous but accessible, like a McKinsey partner explaining to a smart non-specialist.",
  },
];

export const UNIVERSAL_HUMAN_WRITING_RULES = `CRITICAL HUMAN WRITING RULES. Follow every rule without exception:

── RULE ZERO: PUNCTUATION (the single biggest AI tell) ──
- NEVER use an em dash (—). Not once. Zero per post, zero per sentence, zero exceptions.
  The em dash is the number one signal readers use to spot AI writing. One em dash can
  discredit an otherwise perfect post. This rule outranks every other rule here.
- NEVER use an en dash (–) in prose. For number ranges write "1,000 to 1,300", not "1,000–1,300".
- Replace every em dash with one of these, chosen by what the sentence actually needs:
  1. A period. Two sentences is almost always stronger than one spliced sentence.
  2. A colon, when what follows defines or lists.
  3. A comma, when the aside is short.
  4. Parentheses, when the aside is genuinely optional.
  5. Nothing. Delete the aside and put it in its own sentence.
- Do not use the arrow (→), the bullet character (•), or "::" anywhere in prose. These three
  are allowed only as interface iconography (a button affordance, a breadcrumb separator,
  a list marker), never inside written content. The em dash has no such exemption.
- Avoid semicolons. Almost nobody writing a LinkedIn post reaches for a semicolon.
- Never bold a phrase and follow it with a colon as a fake list header ("**Key insight:**").
- Never use emoji as section headers or as bullet points.

── 2026 LINKEDIN ALGORITHM RULES (data-backed) ──
- NEVER open with a question. Question-first openers lose 34% median likes. Move any question to the close, where it gains 3%.
- PREFER number-first openers. "47% of..." or "$2.4M later..." gains 34% median likes over vague openers.
- Target 1,000 to 1,300 characters and 20+ sentences for maximum algorithmic lift.
- Allow maximum ONE contrast and ONE triple per post. More than this flags as AI-generated.
- ZERO reveal bridges. Never write "The result?", "Here's the thing:", "It's not X, it's Y", "The truth?", "What happened next?". These cost 4.3% to 6.7% reach.
- The hook must land in the first 210 characters, before the "see more" fold. The hook's only job is to earn that click.

── BANNED VOCABULARY (AI tells, never use these) ──
- Single-word bans: delve, leverage, synergy, empower, transformative, game-changer, cutting-edge, holistic, paradigm, utilize, unlock, foster, nuanced, streamline, elevate, robust, comprehensive, insights, landscape, notably, crucial, significant, pivotal, seamlessly, groundbreaking, revolutionary, innovative
- Banned openers: "In today's...", "In the ever-evolving...", "As a [title]...", "Here's what...", "I wanted to share...", "Let me be honest"
- Banned closers: "What do you think?", "Tag someone who needs this", "Drop a comment below", "Let me know your thoughts", "Like and share if you agree"

── BANNED STRUCTURAL PATTERNS ──
- No staccato stacks: "No X. No Y. Just Z." LinkedIn's slop filter flags this pattern.
- No one-word paragraphs used for dramatic effect
- No negative parallelism in any of its 6 forms ("Not A. Not B. Not C.")
- No pseudo-Socratic Q&A within the post body
- No announced candor: never write "I'll be honest", "Real talk:", "Genuinely:", "I have to say"
- No "-ing" clause openers at sentence start. This runs 5.3x the human rate and is a major AI tell.
- No noun chains (3+ nouns strung together as modifier: "customer success team onboarding process optimization")

── REQUIRED HUMAN MARKERS (include ALL of these) ──
- ONE odd-precision number with a referent: not "many companies" but "73 of the 91 companies we surveyed"
- ONE named entity: a real person's name, company name, city, or publication
- ONE first-person specific detail: something only the author would know ("when we cut our CAC from $340 to $180...")
- ONE contradiction stated flat, with no hedging and no disclaimer ("We do less. We earn more.")
- VARY sentence length dramatically: some very short. Others build and build before landing the point, giving the reader momentum before the release.

── AUTHENTICITY ──
- Write as one specific human with one specific perspective, not a machine averaging all possible humans
- Use contractions naturally (it's, you're, I've, they're, we've)
- Human readers identify AI by punctuation first, then vocabulary (53%) and sentence structure (36%). Attack all three.

── FINAL CHECK BEFORE YOU RETURN ANYTHING ──
Scan your output character by character for "—" and "–". If you find even one, rewrite that
sentence using a period, colon, comma, or parentheses. Do this before returning the text.`;


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
