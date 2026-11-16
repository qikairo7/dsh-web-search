/** Last-known provider quota readings shared by providers and the settings API. */

const readings = new Map();

/**
 * Record the `usage` object returned by a provider response. Keenable reports
 * `credits_remaining` on every search/fetch; this cache lets the settings page
 * show the value without making an extra request.
 *
 * @param {string} providerId
 * @param {unknown} usage
 */
export function recordProviderUsage(providerId, usage) {
  if (usage === null || typeof usage !== 'object') return;
  const remaining = Number(usage.credits_remaining ?? usage.creditsRemaining ?? usage.remaining);
  if (!Number.isFinite(remaining)) return;
  readings.set(providerId, {
    remaining,
    at: Date.now(),
    ...(typeof usage.sku === 'string' && usage.sku.length > 0 ? { sku: usage.sku } : {}),
    ...(typeof usage.paid === 'boolean' ? { paid: usage.paid } : {}),
  });
}

/** Return the most recent reading for one provider, if any. */
export function readProviderUsage(providerId) {
  return readings.get(providerId);
}
