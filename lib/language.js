/** Lightweight language detection for query routing. */

const HAN = /\p{Script=Han}/u;
const JAPANESE = /[\u3040-\u30ff]/u;
const KOREAN = /[\uac00-\ud7af]/u;
const SPANISH = /[ñáéíóúü]|\b(?:el|la|los|las|de|que|como|para|con|tiempo|espera)\b/iu;
const FRENCH = /[àâçéèêëîïôûùüÿœ]|\b(?:le|la|les|des|est|pour|avec|temps)\b/iu;
const GERMAN = /[äöüß]|\b(?:der|die|das|und|ist|für|mit|zeit)\b/iu;

/**
 * Return a coarse language id for a search query.
 * Chinese/Japanese/Korean are detected by script; European languages use a
 * small stop-word/accent heuristic and fall back to English.
 */
export function detectLanguage(text) {
  const value = typeof text === 'string' ? text : '';
  if (JAPANESE.test(value)) return 'ja';
  if (KOREAN.test(value)) return 'ko';
  if (HAN.test(value)) return 'zh';
  if (GERMAN.test(value)) return 'de';
  if (FRENCH.test(value)) return 'fr';
  if (SPANISH.test(value)) return 'es';
  return 'en';
}
