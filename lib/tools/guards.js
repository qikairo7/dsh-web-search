/** Shared readiness checks for provider-specific tools. */

import { webError } from '../errors.js';

/**
 * Reject a tool call when its provider is disabled or has no usable credential.
 * Registration happens once; settings are live, so the check runs per call.
 *
 * @param {{ available?: () => boolean, ready?: () => Promise<boolean> }} provider
 */
export async function assertToolProvider(provider) {
  if (provider === undefined || provider === null) {
    throw webError('Provider is unavailable', 'WEB_PROVIDER_UNAVAILABLE');
  }
  if (typeof provider.available === 'function' && !provider.available()) {
    throw webError('Provider is disabled', 'WEB_PROVIDER_UNAVAILABLE');
  }
  if (typeof provider.ready === 'function' && !(await provider.ready())) {
    throw webError('Provider credential is not configured', 'WEB_PROVIDER_UNAVAILABLE');
  }
}
