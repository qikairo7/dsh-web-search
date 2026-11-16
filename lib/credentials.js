/** Resolve API keys through the dsh credentials seam, then the launch environment. */

import { credentialRef } from '@deepseek-ai/dsh-credentials';

/**
 * Build a per-operation key resolver.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {(reference: string) => Promise<string | undefined>}
 */
export function createKeyResolver(ctx) {
  const resolveOne = async (reference) => {
    const name = typeof reference === 'string' ? reference.trim() : '';
    if (name.length === 0) return undefined;

    const credentials =
      ctx.credentials ?? (typeof ctx.get === 'function' ? ctx.get('credentials') : undefined);
    if (credentials !== null && credentials !== undefined && typeof credentials.resolve === 'function') {
      try {
        const resolved = await credentials.resolve(credentialRef(name));
        const value = typeof resolved?.value === 'string' ? resolved.value.trim() : '';
        if (value.length > 0) return value;
      } catch {
        // Fall back to the launch environment below.
      }
    }

    const environmentValue = process.env[name];
    return typeof environmentValue === 'string' && environmentValue.trim().length > 0
      ? environmentValue.trim()
      : undefined;
  };

  /**
   * Resolve the primary reference plus numbered references such as
   * `TAVILY_API_KEY_2`, `TAVILY_API_KEY_3`, in order. The suffix is the
   * storage convention used by the settings page; a gap stops the list so a
   * higher-numbered environment variable cannot unexpectedly join the ring.
   */
  const resolve = async (reference) => resolveOne(reference);
  resolve.all = async (reference) => {
    const base = typeof reference === 'string' ? reference.trim() : '';
    if (base.length === 0) return [];
    const keys = [];
    for (let index = 1; index <= 10; index += 1) {
      const value = await resolveOne(index === 1 ? base : `${base}_${index}`);
      if (value === undefined) {
        if (index === 1) continue;
        break;
      }
      keys.push(value);
    }
    return keys;
  };
  return resolve;
}
