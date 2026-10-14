// Client-side post quality scoring. Instant, no API call needed.
// Credibility (accuracy) comes from the backend authenticity-score response.

export interface PostQualitySubScores {
  hook: number;        // 0-100, how grabbing the opening line is
  readability: number; // 0-100, sentence variety and avg length
  format: number;      // 0-100, paragraph breaks, total length
}

export function computePostQuality(content: string): PostQualitySubScores {
  if (!content.trim()) return { hook: 0, readability: 0, format: 0 };

  // ── Hook score ────────────────────────────────────────────────────────────
  const firstLine = content.split('\n')[0].trim();
  let hook = 50;
  const fl = firstLine.toLowerCase();
  const wordCount = firstLine.split(/\s+/).filter(Boolean).length;

  if (firstLine.length >= 60 && firstLine.length <= 120) hook += 15;
  else if (firstLine.length >= 40 && firstLine.length < 60) hook += 8;
  else if (firstLine.length > 160) hook -= 5;

  if (firstLine.includes('?')) hook += 12;
  if (/\d/.test(firstLine)) hook += 10;
  if (wordCount <= 10) hook += 10;
  else if (wordCount >= 25) hook -= 10;

  const cliches = ['i am', "i'm", 'in today', 'as we all', 'excited to share', 'happy to share', 'thrilled to', 'pleased to share', 'grateful for'];
  if (cliches.some(c => fl.startsWith(c))) hook -= 20;

  const powerWords = ['why', 'how', 'what', 'stop', 'never', 'always', 'most', 'best', 'secret', 'truth', 'you', 'proven', 'mistake', 'wrong'];
  if (powerWords.some(w => fl.split(/\b/).includes(w))) hook += 8;

  hook = Math.max(0, Math.min(100, Math.round(hook)));

  // ── Readability score ─────────────────────────────────────────────────────
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 3);
  let readability = 65;
  if (sentences.length > 0) {
    const avgWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0) / sentences.length;
    if (avgWords >= 12 && avgWords <= 18) readability += 20;
    else if (avgWords >= 8 && avgWords < 12) readability += 10;
    else if (avgWords > 25) readability -= 20;
    else if (avgWords < 5) readability -= 10;
    const lens = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
    if (lens.some(l => l <= 6) && lens.some(l => l >= 15)) readability += 15;
  }
  readability = Math.max(0, Math.min(100, Math.round(readability)));

  // ── Format score ──────────────────────────────────────────────────────────
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  let format = 55;
  if (paragraphs.length >= 2) format += 15;
  if (paragraphs.length >= 3) format += 5;
  if (paragraphs.length >= 4) format += 5;
  const longestPara = Math.max(...paragraphs.map(p => p.length));
  if (longestPara < 200) format += 10;
  else if (longestPara > 400) format -= 10;
  if (content.length >= 500 && content.length <= 3000) format += 10;
  else if (content.length < 200) format -= 10;
  else if (content.length > 3000) format -= 15;
  format = Math.max(0, Math.min(100, Math.round(format)));

  return { hook, readability, format };
}

export function computeOverallQuality(sub: PostQualitySubScores, credibility?: number | null): number {
  if (credibility != null) {
    return Math.round(sub.hook * 0.30 + sub.readability * 0.25 + sub.format * 0.20 + credibility * 0.25);
  }
  return Math.round(sub.hook * 0.35 + sub.readability * 0.35 + sub.format * 0.30);
}

export function qualityLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs work';
}

export function qualityColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 65) return '#F59E0B';
  return '#EF4444';
}
