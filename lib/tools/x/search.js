/** X tweet search request builder and orchestration (read-only item search).
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Only `item search` is ported; media search, item get, comments and every write path are not.
 */

import { cursorOf, item, tweetResults } from './normalize.js';
import { quote } from './py.js';
import { X_HOST } from './profile.js';

const SEARCH_PRODUCT = { general: 'Top', latest: 'Latest' };

/** SearchTimeline POST — variables keep the browser's key order. */
export function searchWork(client, query, { cursor, product = 'Top', count = 20 } = {}) {
  const variables = { rawQuery: query, count };
  if (cursor) variables.cursor = cursor;
  variables.querySource = 'typed_query';
  variables.product = product;
  variables.withGrokTranslatedBio = true;
  variables.withQuickPromoteEligibilityTweetFields = false;
  return client.graphqlPostQuery('SearchTimeline', variables, {
    referer: `${X_HOST}/search?q=${quote(query)}&src=typed_query`,
  });
}

/** Run a tweet search and return normalized items plus the next-page cursor. */
export async function searchTweets(client, { query, sort = 'general', cursor, count = 20 } = {}) {
  const product = SEARCH_PRODUCT[sort] ?? 'Top';
  const response = await searchWork(client, query, { cursor, product, count });
  const results = tweetResults(response).map(item);
  const next = cursorOf(response, 'Bottom');
  return { query, results, cursor: next && next !== cursor ? next : null };
}
