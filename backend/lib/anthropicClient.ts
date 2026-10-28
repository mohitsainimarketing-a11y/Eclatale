import Anthropic from '@anthropic-ai/sdk';

/**
 * Shared Anthropic client factory.
 *
 * Claude 5.x models run a hidden reasoning pass before the first word unless it is
 * turned off. For writing, rewriting and JSON tasks that pass added 3 to 5 seconds of
 * dead time per call and no quality we need. Every call made through this client has
 * thinking disabled by default. A caller can still pass its own `thinking` to override.
 */
export function createAnthropic(): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = client.messages as any;
  const create = messages.create.bind(messages);
  const stream = messages.stream.bind(messages);
  messages.create = (body: any, options?: any) => create({ thinking: { type: 'disabled' }, ...body }, options);
  messages.stream = (body: any, options?: any) => stream({ thinking: { type: 'disabled' }, ...body }, options);
  return client;
}
