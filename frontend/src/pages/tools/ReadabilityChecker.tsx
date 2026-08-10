import React, { useState, useMemo } from 'react';

function analyze(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readingTimeSec = Math.max(5, Math.round((wordCount / 200) * 60));

  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const avgSentenceLen = sentenceLengths.length ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length : 0;
  const longSentences = sentenceLengths.filter(l => l > 20).length;

  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const longParagraphs = paragraphs.filter(p => p.split('\n').length > 3 || p.split(/\s+/).length > 40).length;

  const lineBreaks = (text.match(/\n/g) || []).length;
  const expectedBreaks = Math.max(1, Math.floor(wordCount / 25));
  const whitespaceOk = lineBreaks >= expectedBreaks * 0.6;

  let score = 100;
  score -= Math.min(40, longSentences * 8);
  score -= Math.min(30, longParagraphs * 10);
  if (!whitespaceOk) score -= 15;
  if (avgSentenceLen > 12) score -= Math.min(15, Math.round((avgSentenceLen - 12) * 1.5));
  score = Math.max(0, Math.min(100, Math.round(score)));

  const issues: string[] = [];
  if (longSentences > 0) issues.push(`${longSentences} sentence${longSentences > 1 ? 's' : ''} over 20 words — shorten these`);
  if (longParagraphs > 0) issues.push(`${longParagraphs} paragraph${longParagraphs > 1 ? 's' : ''} over 3 lines — break these up`);
  if (!whitespaceOk && wordCount > 30) issues.push('Missing line breaks between sections');
  if (issues.length === 0 && wordCount > 0) issues.push('No major issues found — this reads cleanly.');

  return { wordCount, readingTimeSec, avgSentenceLen, longSentences, paragraphs: paragraphs.length, longParagraphs, lineBreaks, whitespaceOk, score, issues };
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export default function ReadabilityChecker() {
  const [post, setPost] = useState('');
  const result = useMemo(() => (post.trim() ? analyze(post) : null), [post]);

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Paste your LinkedIn post</label>
      <textarea value={post} onChange={e => setPost(e.target.value)} placeholder="Paste your full post here..." rows={8} className="input mt-2 mb-6 resize-none" />

      {result && (
        <div>
          <div className="flex items-center gap-6 mb-6 flex-wrap">
            <div className="text-5xl font-extrabold" style={{ color: scoreColor(result.score) }}>{result.score}</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-brand-dark">
              <p><span className="font-semibold">{Math.ceil(result.readingTimeSec / 60) < 1 ? `${result.readingTimeSec}s` : `${Math.ceil(result.readingTimeSec / 60)} min`}</span> reading time</p>
              <p><span className="font-semibold">{result.avgSentenceLen.toFixed(1)}</span> avg words/sentence (ideal &lt;12)</p>
              <p><span className="font-semibold">{result.paragraphs}</span> paragraphs</p>
              <p><span className="font-semibold">{result.lineBreaks}</span> line breaks</p>
            </div>
          </div>
          <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-2">Specific issues</p>
          {result.issues.map((issue, i) => (
            <p key={i} className="text-sm text-brand-dark mb-1.5">• {issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
