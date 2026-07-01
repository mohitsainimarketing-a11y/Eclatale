// Shared client-side text-overlay compositing.
//
// The AI image model is instructed to render ZERO text (see backend
// generate-image prompt). For styles that conceptually carry a headline or
// key stat, we composite the post's actual headline as real rendered text
// (Plus Jakarta Sans, brand colors) onto a canvas over the clean background.
// This guarantees perfectly legible text instead of garbled AI pixel-art.

// Styles that get a headline overlay by default.
export const OVERLAY_STYLES = new Set(['bold', 'dataviz']);

/** Derive a short, punchy headline candidate from a topic or post first line. */
export function deriveHeadline(source: string): string {
  const firstLine = (source.split('\n').find(l => l.trim()) || source).trim();
  const clean = firstLine.replace(/^["'#\-\s]+/, '').replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? clean.substring(0, 67).trim() + '…' : clean;
}

/**
 * Composite a clean background image + a real rendered headline into a PNG data URL.
 * `position` controls vertical anchoring: 'bottom' (default) or 'top'.
 */
export async function compositeOverlay(
  baseUrl: string,
  headline: string,
  opts: { position?: 'top' | 'bottom' } = {}
): Promise<string> {
  const position = opts.position || 'bottom';
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image load failed'));
    img.src = baseUrl;
  });

  try { await (document as any).fonts?.load('800 64px "Plus Jakarta Sans"'); } catch {}

  const W = img.naturalWidth || 1024;
  const H = img.naturalHeight || 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, W, H);

  const text = (headline || '').trim();
  if (!text) return canvas.toDataURL('image/png');

  const pad = Math.round(W * 0.07);
  const maxWidth = W - pad * 2;
  let fontSize = Math.round(W * 0.075);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const wrap = (size: number): string[] => {
    ctx.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`;
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  let lines = wrap(fontSize);
  while (lines.length > 4 && fontSize > 24) { fontSize -= 4; lines = wrap(fontSize); }
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

  const lineHeight = Math.round(fontSize * 1.18);
  const blockH = lines.length * lineHeight;
  const startY = position === 'top' ? pad : H - pad - blockH;

  const scrimTop = Math.max(0, startY - pad * 0.5);
  const scrimH = Math.min(H, blockH + pad);
  const grad = ctx.createLinearGradient(0, scrimTop, 0, scrimTop + scrimH);
  if (position === 'top') {
    grad.addColorStop(0, 'rgba(15,10,40,0.72)');
    grad.addColorStop(1, 'rgba(15,10,40,0)');
  } else {
    grad.addColorStop(0, 'rgba(15,10,40,0)');
    grad.addColorStop(1, 'rgba(15,10,40,0.78)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, W, scrimH);

  ctx.fillStyle = '#7C5CFC';
  ctx.fillRect(pad, startY - Math.round(fontSize * 0.35), Math.round(W * 0.12), Math.max(4, Math.round(fontSize * 0.09)));

  ctx.fillStyle = '#FFFFFF';
  lines.forEach((ln, i) => ctx.fillText(ln, pad, startY + i * lineHeight));

  return canvas.toDataURL('image/png');
}
