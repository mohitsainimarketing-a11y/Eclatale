declare global {
  interface Window {
    dataLayer: any[];
  }
}

export function initAnalytics() {
  // Google Tag Manager is loaded directly in public/index.html.
  // This just guarantees dataLayer exists before any trackEvent call.
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });
}
