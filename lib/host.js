/** Hostname normalization and domain matching shared by routing modules. */

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
