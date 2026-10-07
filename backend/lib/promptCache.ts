/**
 * Shared prompt-caching helpers.
 *
 * The Anthropic API caches any block marked with cache_control for 5 minutes.
 * A cache hit costs 0.1x the normal input token price (10x cheaper).
 * Minimum cacheable size is 1024 tokens; blocks below that are silently skipped.
 *
 * Strategy: put large, fully-static content (SYSTEM_PROMPT_BASE + OUTPUT_RULES +
 * UNIVERSAL_HUMAN_WRITING_RULES) in the FIRST system block and mark it cached.
 * Put all dynamic/user-specific content in a second block with no cache_control.
 * Every user's generate/refine/repurpose/adapt call shares the same first block,
 * so after the very first call in any 5-minute window the cache is warm for everyone.
 */

import { SYSTEM_PROMPT_BASE, OUTPUT_RULES } from './contentPrompts';
import { UNIVERSAL_HUMAN_WRITING_RULES } from './writingStyles';

type TextBlock = { type: 'text'; text: string };
type CachedTextBlock = TextBlock & { cache_control: { type: 'ephemeral' } };

/**
 * The universal static block shared by all content-generation endpoints.
 * Cached for 5 minutes across all users — single warm-up call primes it for everyone.
 * ~1600+ tokens, well above the 1024-token caching minimum.
 */
export const STATIC_CONTENT_BLOCK: CachedTextBlock = {
  type: 'text',
  text: `${SYSTEM_PROMPT_BASE}\n\n${OUTPUT_RULES}\n\n${UNIVERSAL_HUMAN_WRITING_RULES}`,
  cache_control: { type: 'ephemeral' },
};

/** Wraps dynamic (per-request) text as a plain system block (no caching). */
export function dynamicBlock(text: string): TextBlock {
  return { type: 'text', text };
}

/**
 * Builds the two-block system array used by every content endpoint.
 * Usage: system: cachedSystem(dynamicContent)
 */
export function cachedSystem(dynamicContent: string): [CachedTextBlock, TextBlock] {
  return [STATIC_CONTENT_BLOCK, dynamicBlock(dynamicContent)];
}
