export const MODELS = {
  sonnet: (process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-5-5') as string,
  haiku: (process.env.ANTHROPIC_HAIKU_MODEL || 'claude-haiku-5-5') as string,
};
