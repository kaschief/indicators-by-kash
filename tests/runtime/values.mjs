// Shared value model: na is NaN for every type, tuples are a marked Array subclass,
// colors are frozen {r, g, b, t} records and user objects carry their type in __type.

export class PineRuntimeError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.line = line;
  }
}

export function isNa(value) {
  return value === undefined || value === null || (typeof value === 'number' && Number.isNaN(value));
}

export function isColor(value) {
  return !!value && typeof value === 'object' && value.__color === true;
}

export function makeColor(r, g, b, t = 0) {
  if ([r, g, b, t].some(isNa)) return NaN;
  const clamp = (value, max) => Math.min(Math.max(value, 0), max);
  return Object.freeze({ __color: true, r: clamp(Math.round(r), 255), g: clamp(Math.round(g), 255), b: clamp(Math.round(b), 255), t: clamp(t, 100) });
}

export function colorFromHex(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
  return makeColor(r, g, b, Math.round((1 - alpha / 255) * 100));
}

export function pineEquals(a, b) {
  if (isNa(a) || isNa(b)) return false;
  if (isColor(a) && isColor(b)) return a.r === b.r && a.g === b.g && a.b === b.b && a.t === b.t;
  return a === b;
}

export function typeNameOf(value) {
  if (isNa(value)) return 'na';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Map) return 'map';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'float';
  if (typeof value === 'boolean') return 'bool';
  if (isColor(value)) return 'color';
  if (value.__drawing) return value.__drawing;
  if (value.__type) return value.__type;
  if (value.__enum) return value.__enum;
  return 'object';
}
