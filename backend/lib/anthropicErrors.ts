/** Detects Anthropic's "credit balance is too low" billing error across SDK error shapes. */
export function isCreditsExhaustedError(error: any): boolean {
  const status = error?.status ?? error?.statusCode;
  const message = String(error?.message || error?.error?.message || '');
  return status === 400 && /credit balance is too low/i.test(message);
}

export interface CreditsExhaustedBody {
  error: 'api_credits_exhausted';
  message: string;
  retryAfter: null;
}

export function creditsExhaustedBody(): CreditsExhaustedBody {
  return {
    error: 'api_credits_exhausted',
    message: 'AI features temporarily unavailable',
    retryAfter: null,
  };
}
