/** X response normalization: tweet objects to the tool's item shape.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Search subset: tweet entries and the Bottom cursor; user/comments/chat normalizers are not ported.
 */

import { X_HOST } from './profile.js';

/** Counts to integers; unparseable values become null. */
function count(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replaceAll(',', ''));
  return Number.isFinite(number) ? Math.round(number) : null;
}

const id = (value) => (value === null || value === undefined ? '' : String(value));
const str = (value) => (value === null || value === undefined || value === '' ? null : String(value));

/** URLs: `//host/path` and http:// become https://. */
function url(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('http://')) return 'https://' + s.slice(7);
  return s;
}

/** A timestamp to ISO 8601; X createdAt is RFC-2822-like and Date.parse handles it. */
function time(value) {
  if (value === null || value === undefined || value === '' || value === 0 || value === '0') return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** TweetWithVisibilityResults wraps the real tweet; unwrap once. */
export function unwrap(result) {
  if (result?.__typename === 'TweetWithVisibilityResults') return result.tweet ?? result;
  return result;
}

function screenNameOf(user) {
  return str(user?.core?.screen_name ?? user?.legacy?.screen_name);
}

const userUrl = (screenName) => `${X_HOST}/${screenName}`;
const tweetUrl = (tweetId, screenName) =>
  screenName ? `${X_HOST}/${screenName}/status/${tweetId}` : `${X_HOST}/i/status/${tweetId}`;

/** A compact author reference from a tweet's user_results.result. */
export function userRef(user) {
  if (!user) return null;
  const screenName = screenNameOf(user);
  const userId = user.rest_id ?? user.legacy?.id_str;
  if (userId === null || userId === undefined || userId === '') return null;
  return {
    id: id(userId),
    name: str(user.core?.name ?? user.legacy?.name),
    url: screenName ? userUrl(screenName) : null,
  };
}

/** Media from extended_entities (full list) — video picks the highest-bitrate mp4. */
function mediaOf(legacy) {
  const list = (legacy.extended_entities ?? legacy.entities ?? {}).media ?? [];
  const media = [];
  for (const item of list) {
    const info = item.original_info ?? {};
    if (item.type === 'photo') {
      media.push({
        id: id(item.id_str),
        type: 'image',
        url: item.media_url_https ?? null,
        width: count(info.width),
        height: count(info.height),
        duration: null,
      });
      continue;
    }
    const mp4 = (item.video_info?.variants ?? []).filter((variant) => variant.content_type === 'video/mp4');
    const best = mp4.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    if (!best) continue;
    const millis = item.video_info?.duration_millis;
    media.push({
      id: id(item.id_str),
      type: 'video',
      url: best.url,
      width: count(info.width),
      height: count(info.height),
      duration: millis === null || millis === undefined ? null : Number(millis) / 1000,
    });
  }
  return { media, cover: url(list[0]?.media_url_https) };
}

/** Full text: long posts live in note_tweet; legacy.full_text is truncated. */
function textOf(tweet) {
  return str(tweet.note_tweet?.note_tweet_results?.result?.text ?? tweet.legacy?.full_text);
}

/** One tweet result to the tool's item object. */
export function item(raw) {
  const tweet = unwrap(raw);
  const legacy = tweet.legacy ?? {};
  const author = tweet.core?.user_results?.result;
  const tweetId = id(tweet.rest_id ?? legacy.id_str);
  const { media, cover } = mediaOf(legacy);
  const kind = media.some((entry) => entry.type === 'video') ? 'video' : media.length > 0 ? 'image' : 'text';
  return {
    id: tweetId,
    kind,
    url: tweetUrl(tweetId, screenNameOf(author)),
    text: textOf(tweet),
    author: userRef(author),
    created_at: time(legacy.created_at),
    cover,
    media,
    stats: {
      views: count(tweet.views?.count),
      likes: count(legacy.favorite_count),
      comments: count(legacy.reply_count),
      collects: count(legacy.bookmark_count),
      shares: count(legacy.retweet_count),
    },
  };
}

function* walkEntries(node) {
  if (Array.isArray(node)) {
    for (const value of node) yield* walkEntries(value);
  } else if (node && typeof node === 'object') {
    if ('entryId' in node && 'content' in node) yield node;
    for (const value of Object.values(node)) yield* walkEntries(value);
  }
}

/** Real tweet entries: skip cursors, ads, modules and deleted/invisible tweets. */
export function tweetResults(response) {
  const out = [];
  for (const entry of walkEntries(response)) {
    if (!String(entry.entryId).startsWith('tweet-')) continue;
    const result = entry.content?.itemContent?.tweet_results?.result;
    if (unwrap(result)?.rest_id) out.push(result);
  }
  return out;
}

/** The Bottom cursor value, or null. */
export function cursorOf(response, direction = 'Bottom') {
  for (const entry of walkEntries(response)) {
    const content = entry.content ?? {};
    for (const holder of [content, content.itemContent ?? {}]) {
      if (holder && typeof holder === 'object' && holder.cursorType === direction && holder.value) return holder.value;
    }
  }
  return null;
}
