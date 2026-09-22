export interface PreviewItem { term: string; meaning: string; example?: string; }
export interface Resource {
  slug: string;
  badge: string;
  emoji: string;
  title: string;
  description: string;
  pages: string;
  itemCount: number;
  itemNoun: string;
  format: string;
  downloadUrl: string;
  preview: PreviewItem[];
}

export const RESOURCES: Resource[] = [
  {
    slug: 'top-50-corporate-jargons',
    badge: 'Career & Communication',
    emoji: '💼',
    title: 'Top 50 Corporate Jargons with Use Cases',
    description: 'Every term explained in plain English with a real LinkedIn post example, so you sound credible, not clueless.',
    pages: '27 pages',
    itemCount: 50,
    itemNoun: 'terms',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/top-50-corporate-jargons-guide.pdf',
    preview: [
      { term: 'Leverage', meaning: 'Use existing strengths or assets to gain a larger advantage.' },
      { term: 'Circle back', meaning: 'Return to a topic at a later point.' },
      { term: 'Move the needle', meaning: 'Make a measurable, meaningful improvement.' },
    ],
  },
  {
    slug: 'linkedin-headline-formulas',
    badge: 'Profile & Positioning',
    emoji: '✍️',
    title: '20 LinkedIn Headline Formulas That Work',
    description: 'Fill-in-the-blank headline templates, each with real examples and the reason it converts.',
    pages: '11 pages',
    itemCount: 20,
    itemNoun: 'formulas',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/linkedin-headline-formulas-guide.pdf',
    preview: [
      { term: 'The Role + Result', meaning: '[Job title] helping [target audience] [achieve specific outcome].' },
      { term: 'The Numbers Stack', meaning: 'Three hard numbers that prove the claim before anyone asks.' },
      { term: 'The Niche Authority', meaning: 'Claim a category narrow enough that you can credibly own it.' },
    ],
  },
  {
    slug: 'data-storytelling-charts',
    badge: 'Data & Analytics',
    emoji: '📊',
    title: '15 Data Storytelling Charts and When to Use Each',
    description: 'Stop defaulting to bar and pie charts. The right chart for the data you are actually showing, with real use cases.',
    pages: '10 pages',
    itemCount: 15,
    itemNoun: 'chart types',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/data-driven-charts-guide.pdf',
    preview: [
      { term: 'Bar Chart', meaning: 'Horizontal or vertical bars comparing a single metric across categories. The easiest chart for a reader to decode correctly.' },
      { term: 'Line Chart', meaning: 'Points connected across a continuous axis, usually time, tracking how one or more metrics move.' },
      { term: 'Scatter Plot', meaning: 'Individual points placed by two numeric values, revealing correlation, clusters, or outliers between them.' },
    ],
  },
  {
    slug: 'stakeholder-boardroom-idioms',
    badge: 'Meetings & Stakeholders',
    emoji: '🏛️',
    title: '40 Stakeholder and Boardroom Idioms Decoded',
    description: 'What executives actually mean when they say it diplomatically. Decode the gap between the words and the message.',
    pages: '16 pages',
    itemCount: 40,
    itemNoun: 'idioms',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/stakeholder-boardroom-idioms-guide.pdf',
    preview: [
      { term: "I hear what you're saying", meaning: 'Sounds like agreement but is almost always the opening line of a rebuttal.' },
      { term: "Let's derisk this before we commit", meaning: 'A request to reduce uncertainty before greenlighting, often signaling real doubt about the odds.' },
      { term: "Let's revisit this next quarter", meaning: "A polite, calendar-based way of shelving a topic that isn't a current priority." },
    ],
  },
  {
    slug: 'meeting-phrases',
    badge: 'Meetings & Stakeholders',
    emoji: '🗣️',
    title: '30 Meeting Phrases That Move Decisions Forward',
    description: 'Exact lines to redirect, push back, and close meetings with a real decision instead of another meeting.',
    pages: '16 pages',
    itemCount: 30,
    itemNoun: 'phrases',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/meeting-phrases-guide.pdf',
    preview: [
      { term: 'The Parking Lot', meaning: '"Let\'s park that and come back to it if we have time." Defers a tangent without dismissing who raised it.' },
      { term: 'The Curious Challenge', meaning: '"Help me understand the thinking behind that." Challenges a decision by asking for its reasoning.' },
      { term: 'The Decision Statement', meaning: '"So the decision is X, and we\'re not revisiting it this quarter." Locks in an outcome out loud.' },
    ],
  },
  {
    slug: 'performance-review-phrases',
    badge: 'Career Growth',
    emoji: '📈',
    title: '20 Performance Review Phrases That Get You Promoted',
    description: 'Turn your work into undeniable impact on paper: framing, direct asks, and how to handle pushback.',
    pages: '10 pages',
    itemCount: 20,
    itemNoun: 'phrases',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/performance-review-phrases-guide.pdf',
    preview: [
      { term: 'The Before/After Frame', meaning: 'State the situation before your work and the situation after it, so the change is undeniable.' },
      { term: 'The Direct Ask', meaning: 'State plainly that you are ready for the next level and want to discuss it, without hedging.' },
      { term: 'The Specific Follow-Up', meaning: 'When told "not this cycle," ask exactly what changed the decision and what would change it next time.' },
    ],
  },
  {
    slug: 'salary-negotiation-scripts',
    badge: 'Career Growth',
    emoji: '💰',
    title: '15 Salary and Offer Negotiation Scripts',
    description: 'Exact scripts for the moments that come up: the first offer, the competing offer, the number you name first.',
    pages: '11 pages',
    itemCount: 15,
    itemNoun: 'scripts',
    format: 'PDF',
    downloadUrl: 'https://suacpplgbqhupktlmhrt.supabase.co/storage/v1/object/public/resources/salary-negotiation-scripts-guide.pdf',
    preview: [
      { term: 'The Delayed Number', meaning: 'A recruiter asks for your salary expectations before any offer has been made.' },
      { term: 'The Competing Offer Reveal', meaning: 'You have another offer and want to use it without sounding like an ultimatum.' },
      { term: 'The Signing Bonus Ask', meaning: "There's a gap between the base offered and your target, and the base can't move further." },
    ],
  },
];

export function getResource(slug: string): Resource | undefined {
  return RESOURCES.find(r => r.slug === slug);
}
