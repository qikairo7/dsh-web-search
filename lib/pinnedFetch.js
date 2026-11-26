/** Fetch-compatible HTTP(S) transport that pins the validated DNS result to the socket. */

import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

/**
 * Build the `lookup` callback that answers only the addresses the validator
 * approved. Node calls it with `options.all === true` when it needs the whole
 * list for happy eyeballs, so both callback shapes are implemented.
 *
 * @param {Array<{ address: string, family: number }>} addresses
 * @returns {(hostname: string, options: object, callback: Function) => void}
 */
function pinnedLookup(addresses) {
  return (hostname, options, callback) => {
    if (options?.all === true) {
      callback(null, addresses);
      return;
    }
    const [first] = addresses;
    callback(null, first.address, first.family);
  };
}

/** Convert an IncomingMessage header bag into a fetch `Headers` instance. */
function toHeaders(raw) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else {
      headers.set(name, String(value));
    }
  }
  return headers;
}

/**
 * Fetch-compatible GET that connects to `addresses` instead of resolving the
 * hostname again. Building a `keepAlive: false` agent per call also keeps Node's
 * environment-proxy agent out of the path, which is what lets the pin hold.
 *
 * @param {string} url - absolute HTTP(S) URL.
 * @param {{
 *   addresses?: Array<{ address: string, family: number }>,
 *   headers?: Record<string, string>,
 *   signal?: AbortSignal,
 *   request?: Function,
 * }} [options] - `request` is the injectable `http.request` / `https.request`.
 * @returns {Promise<{
 *   status: number, ok: boolean, headers: Headers, body: ReadableStream,
 *   url: string, bodyUsed: boolean,
 * }>}
 */
export function fetchPinned(url, options = {}) {
  const { addresses, headers = {}, signal, request } = options;
  const target = new URL(url);
  const secure = target.protocol === 'https:';
  const agent = secure ? new https.Agent({ keepAlive: false }) : new http.Agent({ keepAlive: false });
  const send = request ?? (secure ? https.request : http.request);
  const requestOptions = {
    hostname: target.hostname,
    port: target.port === '' ? (secure ? 443 : 80) : Number(target.port),
    path: `${target.pathname}${target.search}`,
    method: 'GET',
    headers,
    agent,
    ...(addresses === undefined || addresses.length === 0 ? {} : { lookup: pinnedLookup(addresses) }),
  };

  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => handle.destroy(signal.reason);
    const handle = send(requestOptions, (incoming) => {
      signal?.removeEventListener('abort', onAbort);
      const status = incoming.statusCode ?? 0;
      resolve({
        status,
        ok: status >= 200 && status < 300,
        headers: toHeaders(incoming.headers),
        body: Readable.toWeb(incoming),
        url: target.href,
        bodyUsed: false,
      });
    });
    signal?.addEventListener('abort', onAbort, { once: true });
    handle.on('error', (error) => {
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    });
    handle.end();
  });
}