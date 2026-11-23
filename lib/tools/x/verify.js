/** Same-origin X cookie verification used by the settings page health route. */
import { XClient } from './client.js';
import { searchTweets } from './search.js';

/**
 * Run one minimal tweet search with the stored cookie so the settings page can
 * report a real success/failure instead of only a stored flag.
 */
export async function verifyXTool(settings, resolveKey) {
  const config = settings().xTools ?? {};
  if (config.enabled !== true) {
    throw Object.assign(new Error('X 搜索未启用（xToolsEnabled=false）'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
  }
  const reference = typeof config.cookieRef === 'string' ? config.cookieRef.trim() : '';
  const cookie = reference.length > 0 && typeof resolveKey === 'function' ? await resolveKey(reference) : undefined;
  if (cookie === undefined) {
    throw Object.assign(new Error('未配置 X cookie 凭据：请导入浏览器 cookie'), { code: 'WEB_PROVIDER_UNAVAILABLE' });
  }
  const startedAt = Date.now();
  const timeoutMs = Math.min(Number(settings().requestTimeoutMs) || 15_000, 15_000);
  const client = new XClient({ cookie, timeoutMs });
  await client.init();
  const result = await searchTweets(client, { query: 'DeepSeek', sort: 'latest', count: 1 });
  return { ok: true, capability: 'search', latencyMs: Date.now() - startedAt, count: result.results.length };
}
