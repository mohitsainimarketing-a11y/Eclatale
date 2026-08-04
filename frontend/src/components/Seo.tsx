import { useEffect } from 'react';

interface SeoProps {
  title: string;
  description: string;
  path: string; // e.g. "/pricing" — used to build the canonical + OG URL
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: object | object[];
  noindex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Sets per-page title/description/canonical/OG/Twitter tags and optional
// JSON-LD structured data. Runs client-side (this is a CRA SPA, no SSR), so
// it's read reliably by JS-executing crawlers (Googlebot, Bingbot) and by
// the browser tab/history — but NOT by crawlers that only fetch raw HTML
// (some AI/social-preview bots). That gap is a known limitation, not
// something this component can fix without a prerendering/SSR step.
export default function Seo({ title, description, path, image, type = 'website', jsonLd, noindex }: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes('Eclatale') ? title : `${title} | Eclatale`;
    const url = `https://eclatale.com${path}`;
    const ogImage = image || 'https://eclatale.com/og-image.jpg';

    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', url);

    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', ogImage);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);

    const scriptId = 'seo-jsonld';
    document.getElementById(scriptId)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => { document.getElementById(scriptId)?.remove(); };
  }, [title, description, path, image, type, jsonLd, noindex]);

  return null;
}
