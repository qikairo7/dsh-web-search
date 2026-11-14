/** Language routing for the Chinese/English-only product scope. */

const HAN = /\p{Script=Han}/u;

/** Return `zh` when the query contains Han characters; otherwise `en`. */
export function detectLanguage(text) {
  const value = typeof text === 'string' ? text : '';
  return HAN.test(value) ? 'zh' : 'en';
}
