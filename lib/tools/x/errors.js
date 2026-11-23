/** X search error vocabulary and the upstream-changed hint.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 */

/** Shown whenever an X endpoint or response shape moves out from under the port. */
export const UPSTREAM_CHANGED_HINT = 'X 上游已变，等待移植更新';

/** Error raised inside the X port; carries a machine code for tests and logs. */
export class XSearchError extends Error {
  constructor(message, code = 'X_ERROR', options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'XSearchError';
    this.code = code;
  }
}

/** Build the explicit "endpoint changed, wait for a port update" error. */
export function upstreamChanged(detail, cause) {
  const suffix = detail === undefined || detail === '' ? '' : `：${detail}`;
  return new XSearchError(`${UPSTREAM_CHANGED_HINT}${suffix}`, 'X_UPSTREAM_CHANGED', { cause });
}
