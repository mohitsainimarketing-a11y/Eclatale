import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

interface SeriesPost {
  day: number;
  title: string;
  hook: string;
  angle: string;
  format: string;
}

const FORMAT_COLORS: Record<string, string> = {
  Story: '#7C5CFC',
  List: '#F72585',
  Lesson: '#0EA5E9',
  Contrarian: '#F59E0B',
  Data: '#10B981',
  'How-to': '#6366F1',
  'Case Study': '#EC4899',
};

const LENGTHS = [
  { id: 3, label: '3 posts' },
  { id: 5, label: '5 posts' },
  { id: 7, label: '7 posts' },
];

export default function ContentSeriesGenerator() {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [seriesLength, setSeriesLength] = useState(5);
  const [posts, setPosts] = useState<SeriesPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setPosts([]);
    try {
      const data = await callTool('content-series-generator', {
        topic: topic.trim(),
        audience: audience.trim(),
        seriesLength,
      });
      setPosts(data.posts || []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const allHooks = posts.map((p, i) => `Post ${i + 1}: ${p.hook}`).join('\n\n');

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Series topic</label>
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="e.g. Building a personal brand as an introvert"
        className="input mt-2 mb-4"
      />

      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Target audience (optional)</label>
      <input
        value={audience}
        onChange={e => setAudience(e.target.value)}
        placeholder="e.g. early-career marketers, SaaS founders, HR professionals"
        className="input mt-2 mb-4"
      />

      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Series length</label>
      <div className="mt-2 mb-5 flex gap-2">
        {LENGTHS.map(l => (
          <button
            key={l.id}
            onClick={() => setSeriesLength(l.id)}
            className="px-5 py-2 rounded-full border text-sm font-bold transition-all"
            style={seriesLength === l.id
              ? { background: 'linear-gradient(135deg, #7C5CFC, #F72585)', color: 'white', border: 'none', boxShadow: '0 2px 12px rgba(124,92,252,0.3)' }
              : { borderColor: 'rgba(124,92,252,0.2)', color: '#6B7280' }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <button onClick={handleGenerate} disabled={loading || !topic.trim()} className="btn-primary w-full sm:w-auto">
        {loading ? 'Planning series...' : `Plan ${seriesLength}-post series`}
      </button>

      <ErrorNote message={error} />

      {loading && (
        <LoadingMessages messages={['Mapping the topic...', 'Finding the angles...', 'Sequencing for maximum reach...']} />
      )}

      {posts.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-brand-muted uppercase tracking-wide">{posts.length}-post series plan</p>
            <CopyButton text={allHooks} />
          </div>
          <div className="space-y-3">
            {posts.map((post, i) => {
              const color = FORMAT_COLORS[post.format] || '#7C5CFC';
              return (
                <div key={i} className="rounded-xl border border-[rgba(124,92,252,0.1)] overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: color + '10' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white flex-shrink-0"
                      style={{ background: color }}>
                      {post.day}
                    </span>
                    <span className="text-sm font-bold text-brand-dark flex-1 min-w-0 truncate">{post.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: color + '20', color }}>
                      {post.format}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-brand-muted mt-0.5 flex-shrink-0 w-10">Hook</span>
                      <p className="text-sm text-brand-dark leading-snug flex-1">{post.hook}</p>
                      <CopyButton text={post.hook} />
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-brand-muted mt-0.5 flex-shrink-0 w-10">Angle</span>
                      <p className="text-xs text-brand-muted leading-snug flex-1">{post.angle}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
