/** Provider metadata shared by registration, settings lookup, and tests. */

/**
 * Every ctx.web provider this plugin registers, in registration order.
 *
 * `settingsKey` names the nested section returned by resolveSettings();
 * `zhihu-site` shares the `zhihu` configuration and credentials.
 */
export const PROVIDER_CATALOG = Object.freeze([
  Object.freeze({
    id: 'anysearch',
    capabilities: Object.freeze(['search', 'fetch']),
    settingsKey: 'anysearch',
  }),
  Object.freeze({
    id: 'keenable',
    capabilities: Object.freeze(['search', 'fetch']),
    settingsKey: 'keenable',
  }),
  Object.freeze({
    id: 'tavily',
    capabilities: Object.freeze(['search', 'fetch']),
    settingsKey: 'tavily',
    officialDocs: true,
  }),
  Object.freeze({
    id: 'firecrawl',
    capabilities: Object.freeze(['search', 'fetch']),
    settingsKey: 'firecrawl',
  }),
  Object.freeze({
    id: 'zhihu',
    capabilities: Object.freeze(['search']),
    settingsKey: 'zhihu',
  }),
  Object.freeze({
    id: 'zhihu-site',
    capabilities: Object.freeze(['search']),
    settingsKey: 'zhihu',
  }),
  Object.freeze({
    id: 'aihot',
    capabilities: Object.freeze(['search']),
    settingsKey: 'aihot',
    newsBoost: 0.5,
  }),
  Object.freeze({
    id: 'exa',
    capabilities: Object.freeze(['search', 'fetch']),
    settingsKey: 'exa',
  }),
  Object.freeze({
    id: 'http',
    capabilities: Object.freeze(['fetch']),
    settingsKey: 'http',
  }),
]);

/** Provider ids in registration order. */
export const PROVIDER_IDS = Object.freeze(PROVIDER_CATALOG.map((provider) => provider.id));

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
