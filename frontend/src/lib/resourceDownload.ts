import type { Resource } from '../data/resources';

const EMAIL_STORAGE_KEY = 'eclatale_resource_email';

export function getRememberedEmail(): string {
  try { return localStorage.getItem(EMAIL_STORAGE_KEY) || ''; } catch { return ''; }
}

export function rememberEmail(email: string) {
  try { localStorage.setItem(EMAIL_STORAGE_KEY, email); } catch { /* private browsing, ignore */ }
}

export function startDownload(resource: Resource) {
  window.open(resource.downloadUrl, '_blank');
}
