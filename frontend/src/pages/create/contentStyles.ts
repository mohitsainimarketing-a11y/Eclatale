export interface ContentStyle {
  id: string;
  label: string;
  group: string;
  description: string;
  example: string;
  promptFragment: string;
}

export const CONTENT_STYLE_GROUPS: { group: string; styles: ContentStyle[] }[] = [
  {
    group: 'Emotion',
    styles: [
      { id: 'surprised', label: 'Surprised', group: 'Emotion', description: 'Lead with genuine surprise at an unexpected finding', example: 'I ran the numbers three times. The result still surprised me.', promptFragment: 'Rewrite with genuine surprise. Lead with the unexpected finding. Use first-person discovery.' },
      { id: 'excited', label: 'Excited', group: 'Emotion', description: 'High energy, enthusiastic momentum', example: 'Something huge just happened in our space and I cannot stop thinking about it.', promptFragment: 'Rewrite with real excitement and forward momentum. Make the reader feel the energy without hype.' },
      { id: 'curious', label: 'Curious', group: 'Emotion', description: 'Ask questions, explore ideas openly', example: 'What if the whole model is wrong? Stay with me here.', promptFragment: 'Rewrite with genuine curiosity. Explore the "what if" angle. Pull the reader into wondering with you.' },
      { id: 'empathetic', label: 'Empathetic', group: 'Emotion', description: 'Acknowledge the reader\'s struggle first', example: 'If you have been grinding for months and wondering if it is worth it, this is for you.', promptFragment: 'Rewrite with empathy. Acknowledge the reader\'s experience first. Make them feel seen before delivering the insight.' },
      { id: 'vulnerable', label: 'Vulnerable', group: 'Emotion', description: 'Share what was hard, before the lesson', example: 'I almost did not share this. But here is what I got wrong.', promptFragment: 'Rewrite with authentic vulnerability. Share the struggle or mistake honestly. Keep the lesson grounded.' },
      { id: 'inspired', label: 'Inspired', group: 'Emotion', description: 'Step back and see the bigger picture', example: 'There is a version of this where everything works. Here is what I think it looks like.', promptFragment: 'Rewrite with a sense of possibility. Lift the perspective. Keep it concrete enough to believe.' },
      { id: 'humble', label: 'Humble', group: 'Emotion', description: 'Credit others, acknowledge limits', example: 'I do not have all the answers here. But this is what I have learned so far.', promptFragment: 'Rewrite with humility. Credit others. Acknowledge what you still do not know.' },
      { id: 'proud', label: 'Proud', group: 'Emotion', description: 'Celebrate a real milestone without bragging', example: 'We just hit a number we were not sure we would ever reach.', promptFragment: 'Rewrite with quiet pride. Celebrate the milestone without boasting. Ground it in what it took to get here.' },
      { id: 'grateful', label: 'Grateful', group: 'Emotion', description: 'Thank people, acknowledge support', example: 'None of this happens without a few people who showed up at the right time.', promptFragment: 'Rewrite with genuine gratitude. Be specific about who or what you are grateful for and why.' },
      { id: 'nostalgic', label: 'Nostalgic', group: 'Emotion', description: 'Connect past to present with warmth', example: 'Three years ago I would not have predicted any of this.', promptFragment: 'Rewrite with nostalgic contrast. Draw a clear line from where things were to where they are now.' },
      { id: 'urgent', label: 'Urgent', group: 'Emotion', description: 'Create a sense of now, do not wait', example: 'This window is closing. And most people are not paying attention yet.', promptFragment: 'Rewrite with urgency. Make clear why this matters now and not later. Keep it factual, not alarmist.' },
      { id: 'hopeful', label: 'Hopeful', group: 'Emotion', description: 'Point toward a better outcome', example: 'It is messier than it looks. But I genuinely think we get to a better place.', promptFragment: 'Rewrite with grounded hope. Acknowledge the difficulty and point clearly toward the better path.' },
      { id: 'calm', label: 'Calm', group: 'Emotion', description: 'Steady perspective amid noise', example: 'Everyone is panicking about this. Here is why I am not.', promptFragment: 'Rewrite with calm, steady confidence. Offer perspective. Do not dismiss the concern, just give it context.' },
    ],
  },
  {
    group: 'Voice',
    styles: [
      { id: 'conversational', label: 'Conversational', group: 'Voice', description: 'Like explaining to a friend over coffee', example: 'OK so here is the thing I keep coming back to.', promptFragment: 'Rewrite in a warm, conversational tone. Short sentences. Natural contractions. Like you are talking, not presenting.' },
      { id: 'storytelling', label: 'Storytelling', group: 'Voice', description: 'Open with a scene, build to the lesson', example: 'It was 11pm on a Tuesday when the Slack message came in.', promptFragment: 'Rewrite as a story. Open with a specific scene. Build tension. Land on the insight.' },
      { id: 'authoritative', label: 'Authoritative', group: 'Voice', description: 'Expert stating facts with confidence', example: 'The data is clear. Most strategies fail for one reason.', promptFragment: 'Rewrite with authority. State conclusions directly. Back them with evidence. Sound like someone who has seen this many times.' },
      { id: 'witty', label: 'Witty', group: 'Voice', description: 'Dry humor, clever observations', example: 'Turns out "move fast and break things" also works on your sleep schedule.', promptFragment: 'Rewrite with dry wit. Find the irony or the absurd angle. Keep it clever, not jokey.' },
      { id: 'playful', label: 'Playful', group: 'Voice', description: 'Light, fun, a little irreverent', example: 'Nobody asked for this hot take but here we are.', promptFragment: 'Rewrite with a playful, slightly irreverent voice. Keep it professional but clearly having fun.' },
      { id: 'provocative', label: 'Provocative', group: 'Voice', description: 'Challenge assumptions, stir the pot', example: 'The advice you have been following is keeping you stuck.', promptFragment: 'Rewrite to provoke. Challenge a held assumption. Back it with specifics so it lands as insight, not noise.' },
      { id: 'contrarian', label: 'Contrarian', group: 'Voice', description: 'Push back on popular advice with data', example: 'Everyone says X. The numbers say the opposite.', promptFragment: 'Rewrite as a contrarian with receipts. Identify the popular belief. Dismantle it with evidence.' },
      { id: 'direct', label: 'Direct', group: 'Voice', description: 'No preamble, get to the point fast', example: 'Here is what works. Here is what does not.', promptFragment: 'Rewrite with maximum directness. Cut all preamble. State the point in the first sentence.' },
      { id: 'warm', label: 'Warm', group: 'Voice', description: 'Supportive, caring, human', example: 'To anyone navigating this right now: it gets clearer.', promptFragment: 'Rewrite with warmth and genuine care for the reader. Talk to one person, not an audience.' },
      { id: 'inspirational', label: 'Inspirational', group: 'Voice', description: 'Fire people up about what is possible', example: 'You are closer than you think.', promptFragment: 'Rewrite to inspire. Speak to the reader\'s potential. Ground it in something real so it does not feel hollow.' },
      { id: 'motivational', label: 'Motivational', group: 'Voice', description: 'Build momentum, push to action', example: 'Stop waiting for the right moment. Build the moment.', promptFragment: 'Rewrite to motivate action. Short punchy sentences. Build to a clear call forward.' },
    ],
  },
  {
    group: 'Professional',
    styles: [
      { id: 'executive', label: 'Executive', group: 'Professional', description: 'Strategic, high-level, for the C-suite', example: 'The competitive dynamics are shifting faster than most organizations can respond.', promptFragment: 'Rewrite at an executive level. Strategic framing, systemic implications, minimal tactical detail.' },
      { id: 'thought-leader', label: 'Thought leader', group: 'Professional', description: 'Original perspective, industry authority', example: 'The framework most people use for this is wrong. Here is a better one.', promptFragment: 'Rewrite with original insight that positions the author as a genuine thought leader. Propose a framework or mental model.' },
      { id: 'technical', label: 'Technical', group: 'Professional', description: 'Precise, detailed, for practitioners', example: 'The root issue is a latency spike in the p99 range under load.', promptFragment: 'Rewrite with technical precision. Use accurate terminology. Write for practitioners who will verify your claims.' },
      { id: 'consultative', label: 'Consultative', group: 'Professional', description: 'Diagnose first, then prescribe', example: 'Before you change your pricing, look at these three indicators.', promptFragment: 'Rewrite in a consultative frame. Diagnose the problem clearly before offering the solution.' },
      { id: 'analytical', label: 'Analytical', group: 'Professional', description: 'Data-first, logical, methodical', example: '47 companies. 18 months of data. Three clear patterns emerged.', promptFragment: 'Rewrite with an analytical voice. Lead with data. Build a logical argument. Keep the prose tight.' },
      { id: 'diplomatic', label: 'Diplomatic', group: 'Professional', description: 'Balanced, acknowledges multiple views', example: 'Both sides have valid points here. The answer probably sits between them.', promptFragment: 'Rewrite diplomatically. Acknowledge multiple perspectives. State a balanced view without being wishy-washy.' },
    ],
  },
  {
    group: 'Structure',
    styles: [
      { id: 'short-punchy', label: 'Short punchy lines', group: 'Structure', description: 'One idea per line, punchy rhythm', example: 'The tool is not the problem.\nThe habit is the problem.\nFix the habit.', promptFragment: 'Restructure using very short sentences, one idea each. Use line breaks for rhythm. Keep every line essential.' },
      { id: 'listicle', label: 'Listicle', group: 'Structure', description: 'Numbered list with a hook and CTA', example: '5 things I wish I knew before building a product:', promptFragment: 'Restructure as a numbered or bulleted list. Strong hook first. Each point clear and distinct. Closing CTA.' },
      { id: 'question-led', label: 'Question-led', group: 'Structure', description: 'Open with a question, build the answer', example: 'What does it actually take to keep a team motivated when the numbers are down?', promptFragment: 'Restructure to open with a genuine question (not rhetorical). Build toward answering it. Do not open with a question that answers itself.' },
      { id: 'data-led', label: 'Data-led', group: 'Structure', description: 'Open with a number, back every claim', example: '73% of sales teams miss quota in Q4. Here is the pattern I keep seeing.', promptFragment: 'Restructure to open with a specific number or data point. Back every claim with evidence from the original post.' },
      { id: 'step-by-step', label: 'Step by step', group: 'Structure', description: 'Clear numbered framework', example: 'Here is exactly how I do it:', promptFragment: 'Restructure as a clear step-by-step guide. Number each step. Keep steps parallel in length.' },
      { id: 'story-lesson', label: 'Story with a lesson', group: 'Structure', description: 'Narrative arc, insight at the end', example: 'Last year I made a decision I was sure was right. I was wrong.', promptFragment: 'Restructure as a story with a lesson. Set the scene. Build the conflict. Land the insight at the end.' },
      { id: 'before-after', label: 'Before and after', group: 'Structure', description: 'Show the contrast, before and after', example: 'Before: 3 months, no results. After: 2 weeks, first 10 customers.', promptFragment: 'Restructure as a before-and-after. Show the old state clearly, then the new state. Keep the contrast sharp.' },
    ],
  },
  {
    group: 'Level',
    styles: [
      { id: 'simplify', label: 'Simplify', group: 'Level', description: 'Remove jargon, make it accessible', example: 'Let me explain this without the buzzwords.', promptFragment: 'Simplify the language. Remove all jargon and buzzwords. Explain it as if the reader is smart but unfamiliar with the field.' },
      { id: 'explain-new', label: 'Explain like I\'m new', group: 'Level', description: 'Start from first principles', example: 'If you are just getting into this, here is the honest beginner\'s version.', promptFragment: 'Rewrite from first principles. Assume zero background knowledge. Build up clearly without condescension.' },
      { id: 'expert', label: 'Expert level', group: 'Level', description: 'Add depth, use precise terminology', example: 'The nuance most people miss is in the compounding dynamic at the margin.', promptFragment: 'Rewrite for experts. Add depth and precision. Use accurate terminology. Engage the reader\'s existing knowledge.' },
    ],
  },
  {
    group: 'Length',
    styles: [
      { id: 'tighten', label: 'Tighten', group: 'Length', description: 'Cut 30%, keep every word earning its place', example: 'Same idea, half the words.', promptFragment: 'Tighten the post by about 30%. Remove filler words, redundant phrases, and weak sentences. Every word must earn its place.' },
      { id: 'expand-example', label: 'Expand with example', group: 'Length', description: 'Add one concrete story or case', example: 'Let me show you what this looks like in practice.', promptFragment: 'Expand the post by adding one concrete example, case study, or specific scenario. Make the idea tangible.' },
      { id: 'add-hook', label: 'Add a hook', group: 'Length', description: 'Write a stronger opening line', example: 'Rewrite the opening to stop the scroll.', promptFragment: 'Add or rewrite the opening hook. Make it the most compelling sentence in the post. Keep the rest intact.' },
      { id: 'add-cta', label: 'Add a CTA', group: 'Length', description: 'Close with a clear next step', example: 'End with one thing the reader can do right now.', promptFragment: 'Add a clear, non-generic call to action at the end. One specific action. Make it feel natural, not tacked on.' },
    ],
  },
];

export function getAllStyles(): ContentStyle[] {
  return CONTENT_STYLE_GROUPS.flatMap(g => g.styles);
}

export function searchStyles(query: string): ContentStyle[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return getAllStyles().filter(s =>
    s.label.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.group.toLowerCase().includes(q)
  );
}
