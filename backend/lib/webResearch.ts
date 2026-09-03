import Anthropic from '@anthropic-ai/sdk';

export interface Source {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  publishedDate: string | null;
  trustScore: number;
}

const ACADEMIC_DOMAINS = /\.(edu|gov)$|nber\.org|nature\.com|sciencedirect\.com|pubmed|arxiv\.org/i;
const MAJOR_PUBLICATIONS = /hbr\.org|nytimes\.com|wsj\.com|economist\.com|forbes\.com|bloomberg\.com|reuters\.com|techcrunch\.com|wired\.com|theatlantic\.com|ft\.com|mckinsey\.com|bain\.com|bcg\.com|axios\.com|theverge\.com/i;
const INDUSTRY_BLOGS = /medium\.com|substack\.com|dev\.to|hashnode\.com/i;

export function domainAuthorityScore(domain: string): number {
  if (ACADEMIC_DOMAINS.test(domain)) return 100;
  if (MAJOR_PUBLICATIONS.test(domain)) return 90;
  if (INDUSTRY_BLOGS.test(domain)) return 75;
  return 60;
}

function recencyScore(publishedDate: string | null): number {
  if (!publishedDate) return 50;
  const days = (Date.now() - new Date(publishedDate).getTime()) / (24 * 60 * 60 * 1000);
  if (Number.isNaN(days)) return 50;
  if (days <= 7) return 100;
  if (days <= 30) return 85;
  if (days <= 90) return 65;
  if (days <= 365) return 45;
  return 25;
}

export function computeTrustScore(domain: string, publishedDate: string | null): number {
  const authority = domainAuthorityScore(domain);
  const recency = recencyScore(publishedDate);
  // Authority weighted higher than recency — a stale HBR piece still beats a fresh unknown blog.
  return Math.round(authority * 0.65 + recency * 0.35);
}

export function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Uses Claude's server-side web_search tool (billed per search, not part of
// the SDK's typed Tool union yet, hence the `as any` casts) to find current
// sources for a topic, then scores each by domain authority + recency.
export async function searchSourcesForTopic(anthropic: Anthropic, topic: string): Promise<Source[]> {
  const message = await (anthropic.messages.create as any)({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    messages: [{
      role: 'user',
      content: `Search for the 5 most relevant, recent (last 30 days preferred) articles about: ${topic}. After searching, respond with ONLY a JSON array (no prose, no markdown fences) of up to 5 objects: [{"title":"...","url":"...","excerpt":"one sentence summary","publishedDate":"YYYY-MM-DD or null"}]`,
    }],
  });

  const textBlock = (message.content || []).find((b: any) => b.type === 'text');
  const raw: string = textBlock?.text || '[]';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  let parsed: any[] = [];
  try { parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw); } catch { parsed = []; }

  return parsed.slice(0, 5).map((s: any) => {
    const domain = extractDomain(s.url || '');
    return {
      title: String(s.title || 'Untitled'),
      url: String(s.url || ''),
      domain,
      excerpt: String(s.excerpt || ''),
      publishedDate: s.publishedDate || null,
      trustScore: computeTrustScore(domain, s.publishedDate || null),
    };
  }).sort((a, b) => b.trustScore - a.trustScore);
}
