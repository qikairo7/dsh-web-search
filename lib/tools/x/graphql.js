/** GraphQL operation assembly for the X search path.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * The registry is trimmed to SearchTimeline (see docs/subsystems/x-port.md); featureDefaults kept whole.
 */

import { readFileSync } from 'node:fs';
import { upstreamChanged } from './errors.js';

const GRAPHQL_BASE = 'https://x.com/i/api/graphql';
const REGISTRY_URL = new URL('./static/graphql.json', import.meta.url);

let cached = null;

function registry() {
  if (!cached) cached = JSON.parse(readFileSync(REGISTRY_URL, 'utf8'));
  return cached;
}

/** Per-operation fieldToggles the browser actually sends; null means it omits them. */
const BROWSER_FIELD_TOGGLES = { SearchTimeline: null };

/** One GraphQL operation's URL, features and POST body. */
export class GraphQLOperation {
  constructor(name) {
    const op = registry().operations[name];
    if (!op) throw upstreamChanged(`GraphQL 注册表里没有操作 ${name}`);
    this.name = name;
    this.meta = op;
  }

  path() {
    return `/i/api/graphql/${this.meta.queryId}/${this.name}`;
  }

  url() {
    return `${GRAPHQL_BASE}/${this.meta.queryId}/${this.name}`;
  }

  features() {
    const defaults = registry().featureDefaults;
    const out = {};
    for (const key of this.meta.featureSwitches) out[key] = defaults[key] ?? false;
    return out;
  }

  fieldToggles() {
    if (this.name in BROWSER_FIELD_TOGGLES) return BROWSER_FIELD_TOGGLES[this.name];
    const defaults = registry().featureDefaults;
    const out = {};
    for (const key of this.meta.fieldToggles) out[key] = defaults[key] ?? false;
    return out;
  }

  jsonBody(variables) {
    const body = { variables };
    const features = this.features();
    if (Object.keys(features).length) body.features = features;
    const toggles = this.fieldToggles();
    if (toggles && Object.keys(toggles).length) body.fieldToggles = toggles;
    body.queryId = this.meta.queryId;
    return body;
  }
}
