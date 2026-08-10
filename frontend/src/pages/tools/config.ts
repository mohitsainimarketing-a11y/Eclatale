export interface ToolConfig {
  slug: string;
  name: string;
  emoji: string;
  shortDesc: string;
  description: string;
  seoDescription: string;
}

export const TOOLS: ToolConfig[] = [
  {
    slug: 'hook-generator',
    name: 'Hook Generator',
    emoji: '🪝',
    shortDesc: 'Get 5 scroll-stopping opening lines for any topic.',
    description: "Your first line decides whether anyone reads the rest. This tool generates 5 different LinkedIn hooks in a style you pick — Contrarian, Question, Bold Stat, Story opener, List preview, or Surprising fact — so you always have an opener that earns the click on \"see more.\"",
    seoDescription: 'Generate 5 scroll-stopping LinkedIn hook lines for any topic, free. Pick a style, get instant results, no signup required.',
  },
  {
    slug: 'post-generator',
    name: 'Post Generator',
    emoji: '✍️',
    shortDesc: 'Write a full LinkedIn post in any of 6 proven styles.',
    description: 'Pick a topic, a writing style, and a length — get a complete, ready-to-post LinkedIn post in seconds. This free demo uses the same style-specific prompt engineering as the full Eclatale app, minus your personal voice.',
    seoDescription: 'Generate a full LinkedIn post free in 6 styles (Contrarian, Storyteller, Analyst, Teacher, Insider, Motivator). No signup required.',
  },
  {
    slug: 'headline-analyzer',
    name: 'Headline Analyzer',
    emoji: '🎯',
    shortDesc: 'Score your LinkedIn headline and get 3 rewrites.',
    description: "Most LinkedIn headlines waste the most valuable real estate on your profile. Paste yours in and get a 0-100 score across clarity, keywords, specificity, and value proposition, plus 3 rewritten alternatives you can use today.",
    seoDescription: 'Free LinkedIn headline analyzer — get a 0-100 score and 3 rewritten alternatives instantly. No signup required.',
  },
  {
    slug: 'viral-score',
    name: 'Viral Score Checker',
    emoji: '🚀',
    shortDesc: 'Check how likely your post is to perform before you publish.',
    description: 'Paste a LinkedIn post and get a 0-100 viral score based on hook strength, readability, engagement triggers, and length optimization — plus 3 specific fixes before you hit publish.',
    seoDescription: "Free LinkedIn viral score checker — score your post's hook, readability, and reach potential before you publish.",
  },
  {
    slug: 'engagement-calculator',
    name: 'Engagement Rate Calculator',
    emoji: '📊',
    shortDesc: 'Calculate your engagement rate and compare to the 2026 average.',
    description: 'Enter your impressions, reactions, and comments/reposts to get your real engagement rate, benchmarked against the LinkedIn 2026 average of 3.85% — plus tips tailored to where you land.',
    seoDescription: 'Free LinkedIn engagement rate calculator — instantly benchmark your rate against the 2026 average. No signup required.',
  },
  {
    slug: 'readability-checker',
    name: 'Readability Checker',
    emoji: '📖',
    shortDesc: 'Check sentence length, paragraph breaks, and scannability.',
    description: 'LinkedIn is read on a phone, one thumb-scroll at a time. This tool analyzes your sentence length, paragraph breaks, and white space, then flags exactly what to shorten or break up.',
    seoDescription: 'Free LinkedIn readability checker — analyze sentence length, paragraph breaks, and scannability instantly.',
  },
  {
    slug: 'about-generator',
    name: 'LinkedIn About Generator',
    emoji: '📝',
    shortDesc: 'Write a compelling About section in seconds.',
    description: "Your About section is the second-most-read part of your profile after your headline, and most people waste it on a résumé summary. Fill in your role, specialty, and one achievement — get a full, first-person About section that opens with a hook, not \"I am a...\"",
    seoDescription: 'Free LinkedIn About section generator — write a compelling, first-person About in seconds. No signup required.',
  },
  {
    slug: 'cta-generator',
    name: 'CTA Generator',
    emoji: '💬',
    shortDesc: 'Get 5 calls-to-action that match your goal.',
    description: "The last line of your post does the heaviest lifting for engagement. Tell us your topic and your goal — comments, follows, DMs, connections, or website visits — and get 5 CTAs that feel natural, not pushy.",
    seoDescription: 'Free LinkedIn CTA generator — get 5 natural calls-to-action matched to your goal. No signup required.',
  },
  {
    slug: 'post-length-analyzer',
    name: 'Post Length Analyzer',
    emoji: '📏',
    shortDesc: 'Find out if your post is in the algorithm sweet spot.',
    description: "LinkedIn's algorithm rewards posts in a specific length range. Paste your post to see exactly which zone it falls in, where the \"see more\" cutoff hits, and how far you are from the 900-1,300 character sweet spot.",
    seoDescription: "Free LinkedIn post length analyzer — check if your post is in the algorithm's sweet spot instantly.",
  },
];

export function getTool(slug: string): ToolConfig | undefined {
  return TOOLS.find(t => t.slug === slug);
}

export function relatedTools(slug: string, count = 3): ToolConfig[] {
  const others = TOOLS.filter(t => t.slug !== slug);
  // Deterministic (not random) so SSR/CSR and repeat visits stay consistent.
  const startIdx = TOOLS.findIndex(t => t.slug === slug);
  const out: ToolConfig[] = [];
  for (let i = 1; i <= count; i++) out.push(others[(startIdx + i) % others.length]);
  return out;
}
