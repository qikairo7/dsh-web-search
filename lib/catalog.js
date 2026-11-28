/** Provider metadata shared by registration, settings lookup, and tests. */

/**
 * Every ctx.web provider this plugin registers, in registration order.
 *
 * `settingsKey` names the nested section returned by resolveSettings();
 * `zhihu-site` shares the `zhihu` configuration and credentials. `tier` marks
 * the quota class: `paid` backends stay fallback-only,
 * `keyless` backends need no key and have no metered quota and answer between
 * the free stack and the paid tail (Bing), and Exa's recurring
 * monthly allowance makes it free-tier free depth.
 * `operators` declares query-operator support with the vocabulary: 'site' =
 * site:, 'lang' = lang:, 'date' = after:/before:, 'language' = language hint,
 * 'news' = news routing. `newsSupplement` marks the news-freshness seam
 * holder, mirroring `domainSearch` for official docs and `newsBoost` for
 * AIHOT.
 */
export const PROVIDER_CATALOG = Object.freeze([
  Object.freeze({
    id: 'anysearch',
    capabilities: Object.freeze(['search', 'fetch']),
    tier: 'free',
    operators: Object.freeze(['language']),
    settingsKey: 'anysearch',
  }),
  Object.freeze({
    id: 'keenable',
    capabilities: Object.freeze(['search', 'fetch']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'keenable',
  }),
  Object.freeze({
    id: 'tavily',
    capabilities: Object.freeze(['search', 'fetch', 'domainSearch']),
    tier: 'paid',
    operators: Object.freeze(['site', 'lang', 'date', 'language', 'news']),
    settingsKey: 'tavily',
    newsSupplement: true,
  }),
  Object.freeze({
    id: 'firecrawl',
    capabilities: Object.freeze(['search', 'fetch']),
    tier: 'paid',
    operators: Object.freeze(['site', 'date', 'news']),
    settingsKey: 'firecrawl',
  }),
  Object.freeze({
    id: 'zhihu',
    capabilities: Object.freeze(['search']),
    tier: 'free',
    operators: Object.freeze(['site', 'date', 'news']),
    settingsKey: 'zhihu',
  }),
  Object.freeze({
    id: 'zhihu-site',
    capabilities: Object.freeze(['search']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'zhihu',
  }),
  Object.freeze({
    id: 'aihot',
    capabilities: Object.freeze(['search']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'aihot',
    newsBoost: 0.5,
  }),
  Object.freeze({
    id: 'exa',
    capabilities: Object.freeze(['search', 'fetch']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'exa',
  }),
  Object.freeze({
    id: 'bing',
    capabilities: Object.freeze(['search']),
    tier: 'keyless',
    operators: Object.freeze([]),
    settingsKey: 'bing',
  }),
  Object.freeze({
    id: 'github',
    capabilities: Object.freeze(['search', 'fetch']),
    tier: 'free',
    operators: Object.freeze(['site', 'date']),
    settingsKey: 'github',
  }),
  Object.freeze({
    id: 'x',
    capabilities: Object.freeze(['search']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'xTools',
  }),
  Object.freeze({
    id: 'http',
    capabilities: Object.freeze(['fetch']),
    tier: 'free',
    operators: Object.freeze([]),
    settingsKey: 'http',
  }),
]);

/** Provider ids in registration order. */
export const PROVIDER_IDS = Object.freeze(PROVIDER_CATALOG.map((provider) => provider.id));

// Declared paid search fallback order. The order is a routing decision stated
// here explicitly; it must not be derived from catalog registration order.
const PAID_SEARCH_FALLBACK = Object.freeze(['tavily', 'firecrawl']);

// Declared keyless search floor, answering between the free stack and the
// paid tail. Stated explicitly for the same reason as the paid order.
const KEYLESS_SEARCH_FALLBACK = Object.freeze(['bing']);

/** Return the catalog entry for one provider id. */
export function providerEntry(id) {
  return PROVIDER_CATALOG.find((provider) => provider.id === id);
}

/** Return provider ids that serve one capability, in registration order. */
export function providersWithCapability(capability) {
  return PROVIDER_CATALOG.filter((provider) => provider.capabilities.includes(capability)).map(
    (provider) => provider.id,
  );
}

/** Return the resolved-settings section key for one provider id. */
export function settingsKeyForProvider(id) {
  return providerEntry(id)?.settingsKey ?? id;
}

/**
 * Return the paid search fallback order used after the free providers in fast
 * mode. Each id resolves through the catalog, so an id that is not a
 * registered provider fails loudly instead of routing nowhere.
 */
export function paidSearchFallback() {
  return PAID_SEARCH_FALLBACK.map((id) => providerEntry(id).id);
}

/**
 * Return the keyless search floor used between the free providers and the
 * paid tail. Each id resolves through the catalog so a missing
 * registration fails loudly.
 */
export function keylessSearchFallback() {
  return KEYLESS_SEARCH_FALLBACK.map((id) => providerEntry(id).id);
}
