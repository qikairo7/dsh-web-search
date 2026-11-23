/** Same-origin font files for the settings page design tokens (no outbound calls). */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FONT_PATH = '/dsh-web-search/fonts';
const MAX_FONT_BYTES = 512 * 1024;
const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fonts');

const FONT_FILES = new Set([
  'inter-300-latin.woff2',
  'inter-400-latin.woff2',
  'inter-500-latin.woff2',
  'geist-mono-400-latin.woff2',
]);

function sendFont(res, status, contentType, body) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': contentType,
    'content-length': String(body.length),
  });
  res.end(body);
}

/** Check one IPv4/IPv6 peer address against the loopback ranges. */
function isLoopbackAddress(address) {
  if (address.startsWith('::ffff:')) address = address.slice(7);
  if (address === '::1' || address === '127.0.0.1') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (ipv4 !== null) return ipv4[1] === '127';
  // IPv6 link-local peers carry a %scope suffix; the loopback peer is ::1 bare.
  const scope = address.indexOf('%');
  return scope > 0 && address.slice(0, scope) === '::1';
}

/**
 * Decide whether a font-file request is trusted. The settings page normally
 * runs same-origin against the DSH Web Server, but the desktop shell forwards
 * API calls through the main process and strips origin headers; delegate to the
 * Host Connection service when mounted, falling back to a local same-origin
 * check that fails closed otherwise (same discipline as the health route).
 *
 * Local font files could still exfiltrate page URLs through timing or cache
 * side channels, so unlike JSON routes the connection peer must also be
 * loopback: a same-origin browser page always comes from loopback because the
 * DSH Web Server itself only listens on loopback.
 * @param {import('node:http').IncomingMessage} req - request whose headers carry Host, Origin, Sec-Fetch-Site.
 * @param {object | undefined} webCtx - injected web context used to read the Connection service.
 * @param {import('node:net').Socket} socket - connection peer used for the loopback check.
 * @returns true only when the request may read a font file.
 */
function isTrustedFontRequest(req, webCtx, socket) {
  const remote = socket?.remoteAddress ?? '';
  if (!isLoopbackAddress(remote)) return false;
  const connection = typeof webCtx?.get === 'function' ? webCtx.get('connection') : undefined;
  if (typeof connection?.requestRejection === 'function') {
    try {
      return connection.requestRejection(req) === undefined;
    } catch {
      return false;
    }
  }
  const host = req.headers.host;
  if (typeof host !== 'string' || host.length === 0) return false;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = req.headers['sec-fetch-site'];
  return site === 'same-origin' || site === 'none';
}

/**
 * Register the same-origin font-file route. The route is only mounted in
 * profiles that provide a Web Server; desktop and headless profiles keep
 * loading without it, and the settings page keeps working on its system
 * fallback stack.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function registerFontRoutes(ctx) {
  if (typeof ctx?.inject !== 'function') return;
  ctx.inject(['webServer'], (webCtx) => {
    const dispose = webCtx.webServer.register({
      kind: 'prefix',
      path: FONT_PATH,
      async handler(req, res) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendFont(res, 405, 'text/plain; charset=utf-8', Buffer.from('method must be GET'));
          return;
        }
        if (!isTrustedFontRequest(req, webCtx, req.socket)) {
          sendFont(res, 403, 'text/plain; charset=utf-8', Buffer.from('same-origin request required'));
          return;
        }
        const base = req.url.slice(FONT_PATH.length).split('?')[0].replace(/^\/+/, '');
        if (!FONT_FILES.has(base)) {
          sendFont(res, 404, 'text/plain; charset=utf-8', Buffer.from('font not found'));
          return;
        }
        try {
          const body = await readFile(join(FONTS_DIR, base));
          if (body.length > MAX_FONT_BYTES) {
            sendFont(res, 500, 'text/plain; charset=utf-8', Buffer.from('font too large'));
            return;
          }
          sendFont(res, 200, 'font/woff2', body);
        } catch {
          sendFont(res, 404, 'text/plain; charset=utf-8', Buffer.from('font not found'));
        }
      },
    });
    return dispose;
  });
}
