import React, { useState } from 'react';
import { LoadingMessages, CopyButton, ErrorNote } from './ToolShell';
import { callTool } from './toolsApi';

const STYLES = ['Insightful', 'Question', 'Agreement + Add', 'Contrarian', 'Story'];

const STYLE_DESCRIPTIONS: Record<string, string> = {
  Insightful: 'Add depth or data that extends the conversation',
  Question: 'Ask one sharp, specific question',
  'Agreement + Add': 'Agree, then build on it with your own take',
  Contrarian: 'Respectfully challenge one assumption',
  Story: 'Share a quick personal experience that relates',
};

export default function CommentGenerator() {
  const [post, setPost] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!post.trim()) return;
    setLoading(true);
    setError('');
    setComments([]);
    try {
      const data = await callTool('comment-generator', { post: post.trim(), style, count: 5 });
      setComments(data.comments || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">
        Paste the LinkedIn post you want to comment on
      </label>
      <textarea
        value={post}
        onChange={e => setPost(e.target.value)}
        placeholder="Paste the LinkedIn post here..."
        rows={6}
        className="input mt-2 mb-4 resize-none"
      />

      <label className="text-xs font-bold text-brand-muted uppercase tracking-wide">Comment style</label>
      <div className="mt-2 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STYLES.map(s => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              style === s
                ? 'border-brand-purple bg-[rgba(124,92,252,0.06)] text-brand-purple'
                : 'border-[rgba(124,92,252,0.12)] text-brand-muted hover:border-brand-purple/30 hover:text-brand-dark'
            }`}
          >
            <span className="font-bold block">{s}</span>
            <span className="text-xs font-normal">{STYLE_DESCRIPTIONS[s]}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !post.trim()}
        className="btn-primary w-full sm:w-auto"
      >
        {loading ? 'Writing comments...' : 'Generate 5 comments'}
      </button>

      <ErrorNote message={error} />

      {loading && (
        <LoadingMessages
          messages={[
            'Reading the post...',
            'Crafting your angle...',
            'Making them sound human...',
            'Picking the best lines...',
          ]}
        />
      )}

      {comments.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold text-brand-muted uppercase tracking-wide mb-3">
            {comments.length} comments ready to post
          </p>
          {comments.map((c, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[rgba(124,92,252,0.04)] border border-[rgba(124,92,252,0.1)] flex items-start justify-between gap-3"
            >
              <p className="text-sm text-brand-dark leading-relaxed">{c}</p>
              <CopyButton text={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
