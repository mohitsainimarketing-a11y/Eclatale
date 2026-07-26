declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

let initialized = false;

export function initAnalytics() {
  const id = process.env.REACT_APP_GA4_ID;
  if (!id || initialized || typeof window === 'undefined') return;
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}
