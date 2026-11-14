/** Small text helpers shared by routing and adapters. */

const HAN_CHARACTER = /\p{Script=Han}/u;

/** True when the text contains at least one Han script character. */
export function hasHan(value) {
  return typeof value === 'string' && HAN_CHARACTER.test(value);
}

/** Language routing for the Chinese/English-only scope: `zh` for Han text, otherwise `en`. */
export function detectLanguage(text) {
  return hasHan(text) ? 'zh' : 'en';
}
