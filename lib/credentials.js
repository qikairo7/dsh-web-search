/** Resolve API keys through the dsh credentials seam, then the launch environment. */

import { credentialRef } from '@deepseek-ai/dsh-credentials';

/**
 * Build a per-operation key resolver.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns {(reference: string) => Promise<string | undefined>}
 */
export function createKeyResolver(ctx) {
  return async (reference) => {
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
}
