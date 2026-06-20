import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, Sparkles, Check, Loader2, Download, RefreshCw, Link2, Image,
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

const FORMATS = [
  { id: 'square', label: 'Square', ratio: '1:1', desc: 'General posts', w: 80, h: 80 },
  { id: 'vertical', label: 'Vertical', ratio: '9:16', desc: 'Stories, mobile', w: 56, h: 100 },
  { id: 'landscape', label: 'Landscape', ratio: '16:9', desc: 'Banners, previews', w: 100, h: 56 },
  { id: 'infographic', label: 'Infographic', ratio: '1:1.75', desc: 'Data, stats layout', w: 56, h: 100 },
  { id: 'carousel', label: 'Carousel', ratio: '1:1', desc: 'Swipeable slides', w: 80, h: 80 },
];

const STYLES = [
  { id: 'minimal', label: 'Minimal', emoji: '🤍', desc: 'Clean, white space' },
  { id: 'bold', label: 'Bold', emoji: '🔥', desc: 'Vibrant, eye-catching' },
  { id: 'professional', label: 'Professional', emoji: '💼', desc: 'Corporate, polished' },
  { id: 'illustrated', label: 'Illustrated', emoji: '🎨', desc: 'Hand-drawn feel' },
  { id: 'dataviz', label: 'Data Viz', emoji: '📊', desc: 'Charts, patterns' },
];

export default function CreateVisual() {
  const [userId, setUserId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attached, setAttached] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) setTopic(topicParam);

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
      else setUserId(data.user.id);
    });
  }, []);

  const handleGenerate = async () => {
    if (!topic || !format || !style || !userId) return;
    setGenerating(true); setError(''); setImageUrl('');
    try {
      const res = await fetch(`${API_URL}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, format, style, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImageUrl(data.imageUrl);
      setAssetId(data.assetId);
    } catch (err: any) {
      setError(err.message || 'Failed to generate image.');
    }
    setGenerating(false);
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eclatale-${format}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleAttachToPost = async () => {
    if (!assetId || !userId) return;
    const { data: latestPost } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestPost) {
      await supabase.from('generated_assets').update({ post_id: latestPost.id }).eq('id', assetId);
      setAttached(true);
    }
  };

  const canGenerate = topic && format && style && !generating;

  return (
    <div className="min-h-screen gradient-bg-page">
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="p-2 -ml-2 text-brand-muted hover:text-brand-purple transition-colors"><ArrowLeft size={18} /></a>
          <a href="/dashboard" className="text-lg font-extrabold gradient-text hidden sm:block">Eclatale</a>
        </div>
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple">
          <Image size={12} /> Visual Creator
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {!imageUrl ? (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h1 className="h2 text-brand-dark mb-2">Create a <span className="gradient-text">Visual</span></h1>
              <p className="body-text text-sm">AI-generated graphics for your social media posts.</p>
            </div>

            {/* Topic */}
            <div className="card p-5 md:p-6 mb-4">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">What's this visual about?</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. The future of remote work, 5 stages of startup growth"
                className="input !text-base"
              />
            </div>

            {/* Format */}
            <div className="card p-5 md:p-6 mb-4">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Format</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
                {FORMATS.map(f => {
                  const selected = format === f.id;
                  return (
                    <button key={f.id} onClick={() => setFormat(f.id)}
                      className={`p-3 rounded-2xl border-[1.5px] transition-all text-center min-h-[44px] ${
                        selected ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] shadow-brand' : 'border-[rgba(124,92,252,0.08)] hover:border-brand-purple/30'
                      }`}>
                      <div className="mx-auto mb-2 flex items-center justify-center" style={{ width: 40, height: 40 }}>
                        <div className={`rounded-md ${selected ? 'gradient-primary' : 'bg-[rgba(124,92,252,0.1)]'}`}
                          style={{ width: f.w * 0.35, height: f.h * 0.35 }} />
                      </div>
                      <div className="text-[11px] font-bold text-brand-dark">{f.label}</div>
                      <div className="text-[9px] text-brand-muted">{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style */}
            <div className="card p-5 md:p-6 mb-6">
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3 block">Style</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
                {STYLES.map(s => {
                  const selected = style === s.id;
                  return (
                    <button key={s.id} onClick={() => setStyle(s.id)}
                      className={`p-3 rounded-2xl border-[1.5px] transition-all text-center min-h-[44px] ${
                        selected ? 'border-brand-purple bg-[rgba(124,92,252,0.04)] shadow-brand' : 'border-[rgba(124,92,252,0.08)] hover:border-brand-purple/30'
                      }`}>
                      <div className="text-xl mb-1">{s.emoji}</div>
                      <div className="text-[11px] font-bold text-brand-dark">{s.label}</div>
                      <div className="text-[9px] text-brand-muted">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate} disabled={!canGenerate} className="btn-primary w-full md:w-auto md:mx-auto md:flex text-base">
              {generating ? <><Loader2 size={18} className="animate-spin" /> Generating visual...</> : <><Sparkles size={18} /> Generate Visual</>}
            </button>

            {error && <div className="card !bg-red-50 !border-red-100 p-4 text-sm text-red-600 font-medium text-center mt-4 animate-shake">{error}</div>}
          </div>
        ) : (
          <div className="animate-slideUp space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white"><Image size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Visual ready</h3>
                  <p className="text-xs text-brand-muted">{FORMATS.find(f => f.id === format)?.label} / {STYLES.find(s => s.id === style)?.label}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple text-[11px]">{format}</span>
                <span className="badge bg-[rgba(247,37,133,0.08)] text-brand-pink text-[11px]">{style}</span>
              </div>
            </div>

            {/* Image Preview */}
            <div className="card p-3 md:p-4 flex items-center justify-center">
              <img
                src={imageUrl}
                alt="Generated visual"
                className="rounded-xl max-w-full"
                style={{
                  maxHeight: format === 'landscape' ? 400 : 600,
                  aspectRatio: format === 'square' || format === 'carousel' ? '1/1' : format === 'landscape' ? '16/9' : '9/16',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button onClick={handleDownload} className="btn-primary text-sm !py-3">
                <Download size={16} /> Download
              </button>
              <button onClick={() => { setImageUrl(''); setAssetId(null); setAttached(false); handleGenerate(); }}
                className="btn-secondary text-sm !py-3">
                <RefreshCw size={16} /> Regenerate
              </button>
              <button onClick={handleAttachToPost} disabled={attached}
                className={`btn-secondary text-sm !py-3 ${attached ? '!border-brand-teal !text-brand-teal' : ''}`}>
                {attached ? <><Check size={16} /> Attached</> : <><Link2 size={16} /> Attach to latest post</>}
              </button>
            </div>

            <div className="text-center">
              <button onClick={() => { setImageUrl(''); setAssetId(null); setAttached(false); setTopic(''); setFormat(''); setStyle(''); setError(''); }}
                className="text-sm text-brand-muted hover:text-brand-purple font-medium transition-colors">Start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
