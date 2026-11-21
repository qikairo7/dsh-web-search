/** x-client-transaction-id (XCTID) pure computation for X requests.
 * Ported from catbus src/platforms/x@163424c67471d323ac3b1cb68e2b35a3427398ce (MIT).
 * Material comes from the bundled static/x transaction_l1.json; same input plus a random byte gives a fresh value each call.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const EPOCH_SECONDS = 1682924400;
const DEFAULT_KEYWORD = 'obfiowerehiring';
const ADDITIONAL_RANDOM_NUMBER = 3;
const TOTAL_TIME = 4096;
const MATERIAL_URL = new URL('./static/transaction_l1.json', import.meta.url);

let cached = null;

/** Load (once) the bundled XCTID material and return its generator. */
export function transaction() {
  if (!cached) {
    const profile = JSON.parse(readFileSync(MATERIAL_URL, 'utf8'));
    cached = new ClientTransaction(profile.key, profile.frames, profile.indices);
  }
  return cached;
}

function bezier(a, b, m) {
  return 3.0 * a * (1 - m) * (1 - m) * m + 3.0 * b * (1 - m) * m * m + m * m * m;
}

function cubicValue(c, target) {
  let startGradient = 0;
  let endGradient = 0;
  let start = 0;
  let end = 1;
  let mid = 0;
  if (target <= 0.0) {
    if (c[0] > 0.0) startGradient = c[1] / c[0];
    else if (!c[1] && c[2] > 0.0) startGradient = c[3] / c[2];
    return startGradient * target;
  }
  if (target >= 1.0) {
    if (c[2] < 1.0) endGradient = (c[3] - 1.0) / (c[2] - 1.0);
    else if (c[2] === 1.0 && c[0] < 1.0) endGradient = (c[1] - 1.0) / (c[0] - 1.0);
    return 1.0 + endGradient * (target - 1.0);
  }
  while (start < end) {
    mid = (start + end) / 2;
    const estimate = bezier(c[0], c[2], mid);
    if (Math.abs(target - estimate) < 0.00001) return bezier(c[1], c[3], mid);
    if (estimate < target) start = mid;
    else end = mid;
  }
  return bezier(c[1], c[3], mid);
}

function interpolate(from, to, f) {
  return from.map((a, i) => a * (1 - f) + to[i] * f);
}

function rotationMatrix(degrees) {
  const rad = (degrees * Math.PI) / 180;
  return [Math.cos(rad), -Math.sin(rad), Math.sin(rad), Math.cos(rad)];
}

function floatToHex(x) {
  const result = [];
  let quotient = Math.trunc(x);
  let fraction = x - quotient;
  while (quotient > 0) {
    quotient = Math.trunc(x / 16);
    const remainder = Math.trunc(x - quotient * 16);
    result.unshift(remainder > 9 ? String.fromCharCode(remainder + 55) : String(remainder));
    x = quotient;
  }
  if (fraction === 0) return result.join('');
  result.push('.');
  while (fraction > 0) {
    fraction *= 16;
    const integer = Math.trunc(fraction);
    fraction -= integer;
    result.push(integer > 9 ? String.fromCharCode(integer + 55) : String(integer));
  }
  return result.join('');
}

function solve(value, minVal, maxVal, rounding) {
  const result = (value * (maxVal - minVal)) / 255 + minVal;
  return rounding ? Math.floor(result) : Math.round(result * 100) / 100;
}

function isOdd(num) {
  return num % 2 ? -1.0 : 0.0;
}

/** XCTID generator seeded from the bundled material. */
export class ClientTransaction {
  constructor(key, frames, indices) {
    this.key = key;
    this.frames = frames;
    this.indices = indices;
    this.keyBytes = [...Buffer.from(key, 'base64')];
    this.animationKey = this.buildAnimationKey();
  }

  frameRows() {
    const frame = this.frames[this.keyBytes[5] % 4];
    return frame
      .slice(9)
      .split('C')
      .map((segment) =>
        segment
          .replace(/[^\d]+/g, ' ')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((x) => parseInt(x, 10)),
      );
  }

  buildAnimationKey() {
    const rowIndex = this.keyBytes[this.indices[0]] % 16;
    let frameTime = 1;
    for (const index of this.indices.slice(1)) frameTime *= this.keyBytes[index] % 16;
    const rows = this.frameRows();
    return ClientTransaction.animate(rows[rowIndex], frameTime / TOTAL_TIME);
  }

  static animate(frameRow, targetTime) {
    const fromColor = [...frameRow.slice(0, 3), 1].map(Number);
    const toColor = [...frameRow.slice(3, 6), 1].map(Number);
    const fromRotation = [0.0];
    const toRotation = [solve(Number(frameRow[6]), 60.0, 360.0, true)];
    const curves = frameRow.slice(7).map((v, i) => solve(Number(v), isOdd(i), 1.0, false));
    const progress = cubicValue(curves, targetTime);
    const color = interpolate(fromColor, toColor, progress).map((v) => Math.max(v, 0));
    const rotation = interpolate(fromRotation, toRotation, progress);
    const matrix = rotationMatrix(rotation[0]);
    const parts = color.slice(0, -1).map((v) => Math.round(v).toString(16));
    for (const value of matrix) {
      const rounded = Math.abs(Math.round(value * 100) / 100);
      const hexValue = floatToHex(rounded);
      if (hexValue.startsWith('.')) parts.push(`0${hexValue}`.toLowerCase());
      else parts.push(hexValue || '0');
    }
    parts.push('0', '0');
    return parts.join('').replace(/[.-]/g, '');
  }

  /** Compute one XCTID for a pathname (no query string). */
  generate(method, path, timeNow, randomByte) {
    const t = timeNow ?? Math.floor(Date.now() / 1000) - EPOCH_SECONDS;
    const timeBytes = [0, 1, 2, 3].map((i) => (t >>> (i * 8)) & 0xff);
    const message = `${method}!${path}!${t}${DEFAULT_KEYWORD}${this.animationKey}`;
    const digest = createHash('sha256').update(message).digest();
    const payload = [...this.keyBytes, ...timeBytes, ...digest.subarray(0, 16), ADDITIONAL_RANDOM_NUMBER];
    const rnd = randomByte ?? Math.floor(Math.random() * 256);
    const out = Buffer.from([rnd, ...payload.map((b) => b ^ rnd)]);
    return out.toString('base64').replace(/=+$/, '');
  }
}
