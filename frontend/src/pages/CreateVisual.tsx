import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Sparkles, Check, Loader2, Download, RefreshCw, Link2, Image, Type, Send, ExternalLink, Layers,
} from 'lucide-react';
import { OVERLAY_STYLES, deriveHeadline, compositeOverlay } from '../lib/imageOverlay';
import FeatureLock from '../components/FeatureLock';
import AppShell from '../components/AppShell';
import { apiFetch } from '../lib/apiFetch';

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
  return <FeatureLock feature="visualCreator" description="AI-generated visuals to pair with your posts are part of the Individual plan."><CreateVisualInner /></FeatureLock>;
}

interface CarouselSlide { headline: string; imageUrl: string; composited: string; }

function CreateVisualInner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('');
  const [style, setStyle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attached, setAttached] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [compositedUrl, setCompositedUrl] = useState('');
  const compositeSeq = useRef(0);

  // Carousel-specific state. A carousel is a distinct result shape (N slides
  // + a caption, published as a LinkedIn multi-image post) so it gets its
  // own state rather than overloading the single-image fields above.
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [carouselCaption, setCarouselCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ urn: string } | null>(null);
  const isCarousel = format === 'carousel';

  const hasOverlay = OVERLAY_STYLES.has(style);
  const displayUrl = hasOverlay && compositedUrl ? compositedUrl : imageUrl;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get('topic');
    if (topicParam) setTopic(topicParam);
    const formatParam = params.get('format');
    if (formatParam && FORMATS.some(f => f.id === formatParam)) setFormat(formatParam);

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login';
      else setUserId(data.user.id);
    });
  }, []);

  const handleGenerate = async () => {
    if (!topic || !format || !style || !userId) return;
    if (isCarousel) return handleGenerateCarousel();
    setGenerating(true); setError(''); setImageUrl('');
    try {
      const res = await apiFetch(`${API_URL}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ topic, format, style, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImageUrl(data.imageUrl);
      setAssetId(data.assetId);
      if (OVERLAY_STYLES.has(style)) setOverlayText(deriveHeadline(topic));
    } catch (err: any) {
      setError(err.message || 'Failed to generate image.');
    }
    setGenerating(false);
  };

  const handleGenerateCarousel = async () => {
    setGenerating(true); setError(''); setCarouselSlides([]); setCarouselCaption(''); setPublishResult(null);
    try {
      const res = await apiFetch(`${API_URL}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ mode: 'carousel', topic, style, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCarouselCaption(data.caption || '');
      const composited = await Promise.all(
        data.slides.map((s: { headline: string; imageUrl: string }) => compositeOverlay(s.imageUrl, s.headline, { position: 'bottom' }))
      );
      setCarouselSlides(data.slides.map((s: { headline: string; imageUrl: string }, i: number) => ({ ...s, composited: composited[i] })));
    } catch (err: any) {
      setError(err.message || 'Failed to generate carousel.');
    }
    setGenerating(false);
  };

  const updateSlideHeadline = useCallback((index: number, headline: string) => {
    setCarouselSlides(prev => prev.map((s, i) => i === index ? { ...s, headline } : s));
    const imageUrl = carouselSlides[index]?.imageUrl;
    if (!imageUrl) return;
    compositeOverlay(imageUrl, headline, { position: 'bottom' }).then(composited => {
      setCarouselSlides(cur => cur.map((s, i) => i === index ? { ...s, composited } : s));
    });
  }, [carouselSlides]);

  const handleDownloadCarousel = () => {
    carouselSlides.forEach((slide, i) => {
      const a = document.createElement('a');
      a.href = slide.composited;
      a.download = `eclatale-carousel-slide-${i + 1}.png`;
      a.click();
    });
  };

  const handlePublishCarousel = async () => {
    if (!userId || carouselSlides.length < 2) return;
    setPublishing(true); setError('');
    try {
      const res = await apiFetch(`${API_URL}/api/linkedin/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          userId,
          caption: carouselCaption,
          images: carouselSlides.map(s => s.composited),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPublishResult({ urn: data.linkedinPostUrn });
    } catch (err: any) {
      setError(err.message || 'Failed to publish carousel.');
    }
    setPublishing(false);
  };

  // Re-composite whenever the base image, headline, or style changes (overlay styles only).
  useEffect(() => {
    if (!imageUrl || !hasOverlay) { setCompositedUrl(''); return; }
    const seq = ++compositeSeq.current;
    compositeOverlay(imageUrl, overlayText, { position: style === 'dataviz' ? 'top' : 'bottom' })
      .then(url => { if (seq === compositeSeq.current) setCompositedUrl(url); })
      .catch(() => { if (seq === compositeSeq.current) setCompositedUrl(''); });
  }, [imageUrl, overlayText, style, hasOverlay]);

  const handleDownload = () => {
    if (!displayUrl) return;
    const a = document.createElement('a');
    a.href = displayUrl;
    a.download = `eclatale-${format}-${Date.now()}.png`;
    a.click();
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
    <AppShell mobileTitle="Visual Creator">
    <div className="min-h-screen gradient-bg-page">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(124,92,252,0.06)] px-5 md:px-8 h-14 md:h-[72px] flex items-center justify-end">
        <div className="badge bg-[rgba(124,92,252,0.08)] text-brand-purple">
          <Image size={12} /> Visual Creator
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6 md:py-10">
        {!imageUrl && carouselSlides.length === 0 ? (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <h1 className="h2 text-brand-dark mb-2">Create a <span className="gradient-text">Visual</span></h1>
              <p className="body-text text-sm">
                {isCarousel ? 'A 6-slide carousel, ready to publish straight to LinkedIn.' : 'AI-generated graphics for your social media posts.'}
              </p>
            </div>

            {/* Topic */}
            <div className="card p-6 md:p-6 mb-4">
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
            <div className="card p-6 md:p-6 mb-4">
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
            <div className="card p-6 md:p-6 mb-6">
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
              {generating
                ? <><Loader2 size={18} className="animate-spin" /> {isCarousel ? 'Generating carousel...' : 'Generating visual...'}</>
                : isCarousel ? <><Layers size={18} /> Generate Carousel</> : <><Sparkles size={18} /> Generate Visual</>}
            </button>

            {error && <div className="card !bg-red-50 !border-red-100 p-6 text-sm text-red-600 font-medium text-center mt-4 animate-shake">{error}</div>}
          </div>
        ) : isCarousel ? (
          <div className="animate-slideUp space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white"><Layers size={16} /></div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">Carousel ready</h3>
                  <p className="text-xs text-brand-muted">{carouselSlides.length} slides / {STYLES.find(s => s.id === style)?.label}</p>
                </div>
              </div>
            </div>

            {/* Slide strip */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {carouselSlides.map((slide, i) => (
                <div key={i} className="card p-3 shrink-0 w-[180px]">
                  <img src={slide.composited || slide.imageUrl} alt={`Slide ${i + 1}`} className="rounded-lg w-full aspect-square object-cover mb-2" />
                  <p className="text-[10px] font-semibold text-brand-muted mb-1">Slide {i + 1}</p>
                  <input
                    type="text"
                    value={slide.headline}
                    onChange={e => updateSlideHeadline(i, e.target.value)}
                    maxLength={90}
                    className="input !text-[11px] !py-1.5 !px-2 !min-h-0 w-full"
                  />
                </div>
              ))}
            </div>

            {/* Caption */}
            <div className="card p-6">
              <label className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Type size={12} /> Post caption
              </label>
              <textarea
                value={carouselCaption}
                onChange={e => setCarouselCaption(e.target.value)}
                rows={3}
                className="input !text-sm !min-h-0 w-full resize-none"
              />
              <p className="text-[11px] text-brand-muted mt-1.5">The text shown above the carousel in the LinkedIn feed.</p>
            </div>

            {publishResult ? (
              <div className="card !bg-[rgba(16,185,129,0.06)] !border-[rgba(16,185,129,0.2)] p-6 text-center">
                <Check size={22} className="text-brand-teal mx-auto mb-2" />
                <p className="text-sm font-bold text-brand-dark mb-1">Carousel published to LinkedIn</p>
                {publishResult.urn && (
                  <a
                    href={`https://www.linkedin.com/feed/update/${encodeURIComponent(publishResult.urn)}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs font-semibold text-brand-purple inline-flex items-center gap-1 hover:underline"
                  >
                    View on LinkedIn <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 justify-center">
                <button onClick={handlePublishCarousel} disabled={publishing} className="btn-primary text-sm !py-3 disabled:opacity-60">
                  {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : <><Send size={16} /> Publish to LinkedIn</>}
                </button>
                <button onClick={handleDownloadCarousel} className="btn-secondary text-sm !py-3">
                  <Download size={16} /> Download slides
                </button>
                <button onClick={handleGenerateCarousel} className="btn-secondary text-sm !py-3">
                  <RefreshCw size={16} /> Regenerate
                </button>
              </div>
            )}

            <div className="text-center">
              <button onClick={() => { setCarouselSlides([]); setCarouselCaption(''); setPublishResult(null); setTopic(''); setFormat(''); setStyle(''); setError(''); }}
                className="text-sm text-brand-muted hover:text-brand-purple font-medium transition-colors">Start over</button>
            </div>
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
            <div className="card p-6 md:p-6 flex items-center justify-center">
              <img
                src={displayUrl || imageUrl}
                alt="Generated visual"
                className="rounded-xl max-w-full"
                style={{
                  maxHeight: format === 'landscape' ? 400 : 600,
                  aspectRatio: format === 'square' ? '1/1' : format === 'landscape' ? '16/9' : '9/16',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Text overlay editor (Bold / Data Viz) */}
            {hasOverlay && (
              <div className="card p-6">
                <label className="text-[11px] font-semibold text-brand-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Type size={12} /> Headline overlay
                </label>
                <input
                  type="text"
                  value={overlayText}
                  onChange={e => setOverlayText(e.target.value)}
                  placeholder="Add a headline or key stat…"
                  maxLength={90}
                  className="input !text-sm"
                />
                <p className="text-[11px] text-brand-muted mt-1.5">
                  Rendered as crisp Eclatale typography over the graphic (never baked into the AI image). Edit it, and the preview and download update instantly. Clear it for a text-free visual.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button onClick={handleDownload} className="btn-primary text-sm !py-3">
                <Download size={16} /> Download
              </button>
              <button onClick={() => { setImageUrl(''); setCompositedUrl(''); setAssetId(null); setAttached(false); handleGenerate(); }}
                className="btn-secondary text-sm !py-3">
                <RefreshCw size={16} /> Regenerate
              </button>
              <button onClick={handleAttachToPost} disabled={attached}
                className={`btn-secondary text-sm !py-3 ${attached ? '!border-brand-teal !text-brand-teal' : ''}`}>
                {attached ? <><Check size={16} /> Attached</> : <><Link2 size={16} /> Attach to latest post</>}
              </button>
            </div>

            <div className="text-center">
              <button onClick={() => { setImageUrl(''); setCompositedUrl(''); setOverlayText(''); setAssetId(null); setAttached(false); setTopic(''); setFormat(''); setStyle(''); setError(''); }}
                className="text-sm text-brand-muted hover:text-brand-purple font-medium transition-colors">Start over</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </AppShell>
  );
}
