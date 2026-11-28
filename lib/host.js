/** Hostname normalization, domain matching, and private-address blocking shared by providers. */

import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

import { webError } from './errors.js';

/** Escape hatch: set to a truthy value to allow loopback/private hosts for local debugging. */
const ALLOW_PRIVATE_ENV = 'DSH_WEB_HTTP_ALLOW_PRIVATE';

/** Lowercase a hostname and strip one leading `www.` label. */
export function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./u, '');
}

/** True when the URL's host equals the domain or is one of its subdomains. */
export function hostMatchesDomain(url, domain) {
  try {
    const host = normalizeHostname(new URL(url).hostname);
    // A non-string domain throws inside normalizeHostname and lands in the
    // catch below, so invalid domains return false like invalid URLs do.
    const target = normalizeHostname(domain);
    return host === target || host.endsWith(`.${target}`);
  } catch {
    return false;
  }
}

/** Default resolver: every address a hostname resolves to. */
export function resolveAllAddresses(hostname) {
  return dnsLookup(hostname, { all: true });
}

/** True when the escape hatch env var is set to a truthy value. */
export function privateNetworkAllowed(env = process.env) {
  const value = env[ALLOW_PRIVATE_ENV];
  return typeof value === 'string' && /^(?:1|true|yes|on)$/iu.test(value.trim());
}

/** IPv4 ranges that are loopback, private, link-local, metadata, or otherwise reserved for hosts. */
const BLOCKED_IPV4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/** Parse a dotted IPv4 literal into a 32-bit integer, or undefined. */
function ipv4ToInt(address) {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return undefined;
    value = value * 256 + octet;
  }
  return value;
}

/** True when an IPv4 literal falls inside a blocked range. */
function isBlockedIPv4(address) {
  const value = ipv4ToInt(address);
  if (value === undefined) return false;
  return BLOCKED_IPV4_RANGES.some(([network, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) === (ipv4ToInt(network) & mask);
  });
}

/** First 16-bit group of an IPv6 literal, honoring a leading `::` compression. */
function firstHextet(address) {
  const head = address.split('::')[0];
  const first = head.split(':')[0];
  return first === '' ? 0 : Number.parseInt(first, 16);
}

/** True when an IPv6 literal is loopback, unspecified, unique-local, link-local, or multicast. */
function isBlockedIPv6(address) {
  const value = address.toLowerCase().split('%')[0];
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/u.exec(value);
  if (embedded !== null) return isBlockedIPv4(embedded[1]);
  const group = firstHextet(value);
  if (group === 0) return true; // ::, ::1, and the deprecated ::/8 forms
  if ((group & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((group & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((group & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** True when an IP literal is loopback, private, link-local, metadata, or otherwise reserved. */
export function isPrivateAddress(address) {
  if (typeof address !== 'string') return false;
  const value = address.trim().replace(/^\[|\]$/gu, '');
  const kind = isIP(value);
  if (kind === 4) return isBlockedIPv4(value);
  if (kind === 6) return isBlockedIPv6(value);
  return false;
}

/** Build the seam error for a URL whose host is blocked. */
function privateUrlError(address) {
  return webError(
    `HTTP fetch blocked: host resolves to a private or reserved address (${address})`,
    'WEB_PRIVATE_URL',
  );
}

/** Build the seam error for a host whose validation-time resolution failed or came back empty. */
function unresolvedUrlError(host, cause) {
  return webError(
    `HTTP fetch blocked: host could not be resolved at validation time (${host})`,
    'WEB_PRIVATE_URL',
    { cause },
  );
}

/**
 * Throw WEB_PRIVATE_URL when a URL's host is, or resolves to, a blocked address.
 * Returns the validated `{ address, family }` list so the caller can pin the
 * connection to the same resolution; a validation-time DNS failure is rejected
 * instead of being let through, and the message names it as such. The escape
 * hatch env var short-circuits the check and returns undefined (nothing to pin).
 *
 * @param {string} value - absolute HTTP(S) URL.
 * @param {{
 *   lookup?: (hostname: string) => Promise<Array<{ address: string, family?: number } | string>>,
 *   env?: object,
 * }} [options]
 * @returns {Promise<Array<{ address: string, family: number }> | undefined>} addresses to pin.
 */
export async function assertPublicHttpUrl(value, options = {}) {
  const { lookup = resolveAllAddresses, env = process.env } = options;
  if (privateNetworkAllowed(env)) return undefined;
  const host = new URL(value).hostname.replace(/^\[|\]$/gu, '');
  const literal = isIP(host);
  if (literal !== 0) {
    if (isPrivateAddress(host)) throw privateUrlError(host);
    return [{ address: host, family: literal }];
  }
  let resolved;
  try {
    resolved = await lookup(host);
  } catch (error) {
    throw unresolvedUrlError(host, error);
  }
  const addresses = [];
  for (const entry of resolved) {
    const address = typeof entry === 'string' ? entry : entry?.address;
    if (typeof address !== 'string') continue;
    if (isPrivateAddress(address)) throw privateUrlError(address);
    addresses.push({ address, family: entry?.family ?? isIP(address) });
  }
  if (addresses.length === 0) throw unresolvedUrlError(host);
  return addresses;
}

/**
 * Classify a GitHub fetch URL as an issue, pull request, or repository home so
 * the router can serve it from the API. Blob, tree and raw URLs return
 * undefined and keep the plain HTTP path.
 */
export function githubFetchTarget(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return undefined;
  }
  const host = normalizeHostname(parsed.hostname);
  if (host !== 'github.com') return undefined;
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 2) return { kind: 'readme', owner: segments[0], repo: segments[1] };
  if (
    segments.length === 4 &&
    (segments[2] === 'issues' || segments[2] === 'pull') &&
    /^\d+$/u.test(segments[3])
  ) {
    return { kind: 'issue', owner: segments[0], repo: segments[1], number: Number(segments[3]) };
  }
  return undefined;
}
