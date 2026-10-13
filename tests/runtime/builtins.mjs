// Pine built-ins for the local test runtime. Each function receives (ctx, args, named, meta);
// `params` maps named arguments onto positions. Anything TradingView-specific that cannot be
// derived from candles (future bar times, Range bar timing, request.security alignment) is
// delegated to the chart model on ctx so it stays an explicit, documented assumption.

import { isNa, pineEquals, PineRuntimeError, typeNameOf, makeColor, colorFromHex, isColor } from './values.mjs';
import { localParts, zonedTimestamp } from './timezone.mjs';
import { registerDrawings } from './drawings.mjs';
import { registerTa } from './ta.mjs';

export { isNa, pineEquals, PineRuntimeError, typeNameOf };

const functions = new Map();
const variables = new Map();
const constants = new Map();
const seriesHistory = new Map();
const namespaces = new Set();

function fn(path, params, impl, extra = {}) {
  functions.set(path, { params, impl, ...extra });
  namespaces.add(path.split('.')[0]);
}
function variable(path, read) { variables.set(path, read); namespaces.add(path.split('.')[0]); }
function constant(path, value) { constants.set(path, value); namespaces.add(path.split('.')[0]); }
function constantList(namespace, names) { for (const name of names) constant(`${namespace}.${name}`, `${namespace}.${name}`); }

const registry = { fn, variable, constant, functions, variables, constants, seriesHistory };

// VALUE HELPERS

const nz = (value, replacement = 0) => (isNa(value) ? replacement : value);
const truncate = value => (isNa(value) ? NaN : Math.trunc(value));
function roundHalfAway(value) { return Math.sign(value) * Math.round(Math.abs(value)); }
function requireIndex(array, index, op) {
  if (isNa(array)) throw new PineRuntimeError(`${op} on na array`);
  if (!Number.isInteger(index) || index < 0 || index >= array.length) throw new PineRuntimeError(`${op}: index ${index} is out of bounds (size ${array.length})`);
}

fn('na', ['x'], (ctx, [x]) => isNa(x));
fn('nz', ['source', 'replacement'], (ctx, [x, y]) => nz(x, y === undefined ? 0 : y));
fn('int', ['x'], (ctx, [x]) => truncate(x));
fn('float', ['x'], (ctx, [x]) => (isNa(x) ? NaN : Number(x)));
fn('bool', ['x'], (ctx, [x]) => !isNa(x) && x !== 0 && x !== false);
fn('string', ['x'], (ctx, [x]) => x);
fn('color', ['x'], (ctx, [x]) => x);
fn('max_bars_back', ['var', 'num'], () => NaN);
fn('fixnan', ['source'], (ctx, [x], named, meta) => {
  const state = siteState(ctx, meta.site, () => ({ last: NaN }));
  if (!isNa(x)) state.last = x;
  return state.last;
});

export function siteState(ctx, site, init) {
  let state = ctx.frame.state.get(site);
  if (!state) { state = init(); ctx.frame.state.set(site, state); }
  return state;
}

// MATH

for (const name of ['abs', 'ceil', 'floor', 'sqrt', 'exp', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sign']) fn(`math.${name}`, ['number'], (ctx, [x]) => Math[name](x));
fn('math.log', ['number'], (ctx, [x]) => Math.log(x));
fn('math.log10', ['number'], (ctx, [x]) => Math.log10(x));
fn('math.pow', ['base', 'exponent'], (ctx, [a, b]) => Math.pow(a, b));
fn('math.round', ['number', 'precision'], (ctx, [x, precision]) => {
  if (isNa(x)) return NaN;
  if (precision === undefined || isNa(precision)) return roundHalfAway(x);
  const factor = 10 ** precision;
  return roundHalfAway(x * factor) / factor;
});
fn('math.round_to_mintick', ['number'], (ctx, [x]) => roundHalfAway(x / ctx.symbol.mintick) * ctx.symbol.mintick);
fn('math.max', null, (ctx, values) => (values.some(isNa) ? NaN : Math.max(...values)));
fn('math.min', null, (ctx, values) => (values.some(isNa) ? NaN : Math.min(...values)));
fn('math.avg', null, (ctx, values) => values.reduce((sum, value) => sum + value, 0) / values.length);
fn('math.todegrees', ['radians'], (ctx, [x]) => x * 180 / Math.PI);
fn('math.toradians', ['degrees'], (ctx, [x]) => x * Math.PI / 180);
fn('math.random', ['min', 'max', 'seed'], (ctx, [min = 0, max = 1]) => min + (max - min) * ctx.random());
constant('math.pi', Math.PI);
constant('math.e', Math.E);
constant('math.phi', (1 + Math.sqrt(5)) / 2);
constant('math.rphi', 2 / (1 + Math.sqrt(5)));

// STRINGS

function formatNumber(ctx, value, pattern) {
  if (isNa(value)) return 'NaN';
  if (typeof value !== 'number') return String(value);
  if (pattern === undefined || pattern === null) {
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toPrecision(15)));
  }
  if (pattern === 'format.mintick') {
    const decimals = Math.max(0, (String(ctx.symbol.mintick).split('.')[1] ?? '').length);
    return (roundHalfAway(value / ctx.symbol.mintick) * ctx.symbol.mintick).toFixed(decimals);
  }
  if (pattern === 'format.percent') return `${formatNumber(ctx, value, '#.##')}%`;
  if (pattern === 'format.volume') return formatNumber(ctx, value, '#.##');
  if (pattern === 'format.price' || pattern === 'format.inherit') return formatNumber(ctx, value, null);
  const grouped = /[#0],[#0]/.test(pattern);
  const [integerPart, decimalPart = ''] = pattern.replace(/[^#0.]/g, '').split('.');
  const required = (decimalPart.match(/0/g) ?? []).length;
  const optional = decimalPart.length;
  let text = (roundHalfAway(value * 10 ** optional) / 10 ** optional).toFixed(optional);
  if (optional > required) text = text.replace(new RegExp(`0{1,${optional - required}}$`), '').replace(/\.$/, '');
  const minimumInteger = (integerPart.match(/0/g) ?? []).length;
  if (minimumInteger > 1) {
    const [whole, fraction] = text.split('.');
    const negative = whole.startsWith('-');
    const digits = (negative ? whole.slice(1) : whole).padStart(minimumInteger, '0');
    text = `${negative ? '-' : ''}${digits}${fraction !== undefined ? `.${fraction}` : ''}`;
  }
  if (grouped) {
    const [whole, fraction] = text.split('.');
    text = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction !== undefined ? `.${fraction}` : ''}`;
  }
  const prefix = pattern.match(/^[^#0.,]*/)[0];
  const suffix = pattern.match(/[^#0.,]*$/)[0];
  return `${prefix}${text}${suffix}`;
}
export { formatNumber };

fn('str.tostring', ['value', 'format'], (ctx, [value, format]) => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value?.__enum) return value.title;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.map(item => formatNumber(ctx, item)).join(', ')}]`;
  return formatNumber(ctx, value, format);
});
fn('str.format', null, (ctx, [pattern, ...values]) => pattern.replace(/\{(\d+)(?:,([^}]*))?\}/g, (_, index, spec) => {
  const value = values[Number(index)];
  if (spec?.startsWith('number')) return formatNumber(ctx, value, spec.split(',')[1]?.trim() || '#.###');
  if (typeof value === 'number') return formatNumber(ctx, value);
  return isNa(value) ? 'NaN' : String(value);
}));
fn('str.length', ['string'], (ctx, [s]) => (isNa(s) ? NaN : s.length));
fn('str.contains', ['source', 'str'], (ctx, [s, part]) => !isNa(s) && s.includes(part));
fn('str.startswith', ['source', 'str'], (ctx, [s, part]) => !isNa(s) && s.startsWith(part));
fn('str.endswith', ['source', 'str'], (ctx, [s, part]) => !isNa(s) && s.endsWith(part));
fn('str.pos', ['source', 'str'], (ctx, [s, part]) => { const index = s.indexOf(part); return index < 0 ? NaN : index; });
fn('str.substring', ['source', 'begin_pos', 'end_pos'], (ctx, [s, begin, end]) => s.substring(begin, end === undefined ? s.length : end));
fn('str.replace', ['source', 'target', 'replacement', 'occurrence'], (ctx, [s, target, replacement, occurrence = 0]) => {
  let index = -1;
  for (let found = 0; found <= occurrence; found++) { index = s.indexOf(target, index + 1); if (index < 0) return s; }
  return s.slice(0, index) + replacement + s.slice(index + target.length);
});
fn('str.replace_all', ['source', 'target', 'replacement'], (ctx, [s, target, replacement]) => s.split(target).join(replacement));
fn('str.split', ['string', 'separator'], (ctx, [s, separator]) => (separator === '' ? [...s] : s.split(separator)));
fn('str.tonumber', ['string'], (ctx, [s]) => { if (isNa(s) || String(s).trim() === '') return NaN; const value = Number(s); return Number.isNaN(value) ? NaN : value; });
fn('str.upper', ['source'], (ctx, [s]) => s.toUpperCase());
fn('str.lower', ['source'], (ctx, [s]) => s.toLowerCase());
fn('str.trim', ['source'], (ctx, [s]) => s.trim());
fn('str.repeat', ['source', 'repeat', 'separator'], (ctx, [s, count, separator = '']) => Array(Math.max(0, count)).fill(s).join(separator));
fn('str.match', ['source', 'regex'], (ctx, [s, regex]) => s.match(new RegExp(regex))?.[0] ?? '');
fn('str.format_time', ['time', 'format', 'timezone'], (ctx, [time, format = "yyyy-MM-dd'T'HH:mm:ssZ", zone]) => {
  const parts = localParts(time, zone ?? ctx.symbol.timezone);
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return format.replace(/yyyy|MM|dd|HH|mm|ss|'T'|Z/g, token => ({
    yyyy: parts.year, MM: pad(parts.month), dd: pad(parts.day), HH: pad(parts.hour), mm: pad(parts.minute), ss: pad(parts.second), "'T'": 'T', Z: '',
  })[token]);
});

// ARRAYS

const ARRAY_TYPES = ['float', 'int', 'bool', 'string', 'color', 'line', 'box', 'label', 'table', 'linefill'];
const newArray = (ctx, [size = 0, initial = NaN]) => Array.from({ length: size }, () => initial);
fn('array.new', ['size', 'initial_value'], newArray);
for (const type of ARRAY_TYPES) fn(`array.new_${type}`, ['size', 'initial_value'], newArray);
fn('array.from', null, (ctx, values) => [...values]);
fn('array.size', ['id'], (ctx, [a]) => { if (isNa(a)) throw new PineRuntimeError('array.size on na array'); return a.length; });
fn('array.get', ['id', 'index'], (ctx, [a, i]) => { const index = i < 0 ? a.length + i : i; requireIndex(a, index, 'array.get'); return a[index]; });
fn('array.set', ['id', 'index', 'value'], (ctx, [a, i, v]) => { requireIndex(a, i, 'array.set'); a[i] = v; return NaN; });
fn('array.push', ['id', 'value'], (ctx, [a, v]) => { if (isNa(a)) throw new PineRuntimeError('array.push on na array'); a.push(v); return NaN; });
fn('array.unshift', ['id', 'value'], (ctx, [a, v]) => { a.unshift(v); return NaN; });
fn('array.pop', ['id'], (ctx, [a]) => { requireIndex(a, a.length - 1, 'array.pop'); return a.pop(); });
fn('array.shift', ['id'], (ctx, [a]) => { requireIndex(a, 0, 'array.shift'); return a.shift(); });
fn('array.insert', ['id', 'index', 'value'], (ctx, [a, i, v]) => { if (i < 0 || i > a.length) throw new PineRuntimeError(`array.insert: index ${i} out of bounds`); a.splice(i, 0, v); return NaN; });
fn('array.remove', ['id', 'index'], (ctx, [a, i]) => { requireIndex(a, i, 'array.remove'); return a.splice(i, 1)[0]; });
fn('array.clear', ['id'], (ctx, [a]) => { a.length = 0; return NaN; });
fn('array.first', ['id'], (ctx, [a]) => { requireIndex(a, 0, 'array.first'); return a[0]; });
fn('array.last', ['id'], (ctx, [a]) => { requireIndex(a, a.length - 1, 'array.last'); return a[a.length - 1]; });
fn('array.slice', ['id', 'index_from', 'index_to'], (ctx, [a, from, to]) => a.slice(from, to));
fn('array.copy', ['id'], (ctx, [a]) => [...a]);
fn('array.concat', ['id1', 'id2'], (ctx, [a, b]) => { a.push(...b); return a; });
fn('array.indexof', ['id', 'value'], (ctx, [a, v]) => a.findIndex(item => pineEquals(item, v) || item === v));
fn('array.lastindexof', ['id', 'value'], (ctx, [a, v]) => a.findLastIndex(item => pineEquals(item, v) || item === v));
fn('array.includes', ['id', 'value'], (ctx, [a, v]) => a.some(item => pineEquals(item, v) || item === v));
fn('array.reverse', ['id'], (ctx, [a]) => { a.reverse(); return NaN; });
fn('array.fill', ['id', 'value', 'index_from', 'index_to'], (ctx, [a, v, from = 0, to = a.length]) => { a.fill(v, from, to); return NaN; });
fn('array.sort', ['id', 'order'], (ctx, [a, order = 'order.ascending']) => {
  const direction = order === 'order.descending' ? -1 : 1;
  a.sort((x, y) => (typeof x === 'string' ? x.localeCompare(y) : (x - y)) * direction);
  return NaN;
});
fn('array.sort_indices', ['id', 'order'], (ctx, [a, order = 'order.ascending']) => {
  const direction = order === 'order.descending' ? -1 : 1;
  return a.map((_, index) => index).sort((x, y) => (a[x] - a[y]) * direction);
});
fn('array.join', ['id', 'separator'], (ctx, [a, separator = '']) => a.map(item => (typeof item === 'number' ? formatNumber(ctx, item) : String(item))).join(separator));
const numeric = a => a.filter(value => !isNa(value));
fn('array.sum', ['id'], (ctx, [a]) => numeric(a).reduce((sum, value) => sum + value, 0));
fn('array.avg', ['id'], (ctx, [a]) => { const values = numeric(a); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN; });
fn('array.min', ['id', 'nth'], (ctx, [a, nth = 0]) => { const values = numeric(a).sort((x, y) => x - y); return values.length > nth ? values[nth] : NaN; });
fn('array.max', ['id', 'nth'], (ctx, [a, nth = 0]) => { const values = numeric(a).sort((x, y) => y - x); return values.length > nth ? values[nth] : NaN; });
fn('array.range', ['id'], (ctx, [a]) => { const values = numeric(a); return values.length ? Math.max(...values) - Math.min(...values) : NaN; });
export function median(values) {
  const sorted = numeric(values).sort((x, y) => x - y);
  if (!sorted.length) return NaN;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
fn('array.median', ['id'], (ctx, [a]) => median(a));
export function stdev(values, biased = true) {
  const items = numeric(values);
  if (!items.length) return NaN;
  const mean = items.reduce((sum, value) => sum + value, 0) / items.length;
  const squares = items.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(squares / (biased ? items.length : items.length - 1));
}
fn('array.stdev', ['id', 'biased'], (ctx, [a, biased = true]) => stdev(a, biased));
fn('array.variance', ['id', 'biased'], (ctx, [a, biased = true]) => stdev(a, biased) ** 2);
fn('array.percentile_linear_interpolation', ['id', 'percentage'], (ctx, [a, p]) => {
  const sorted = numeric(a).sort((x, y) => x - y);
  if (!sorted.length) return NaN;
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  return sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (rank - low);
});
fn('array.percentile_nearest_rank', ['id', 'percentage'], (ctx, [a, p]) => {
  const sorted = numeric(a).sort((x, y) => x - y);
  if (!sorted.length) return NaN;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
});
fn('array.every', ['id'], (ctx, [a]) => a.every(value => value === true));
fn('array.some', ['id'], (ctx, [a]) => a.some(value => value === true));
fn('array.abs', ['id'], (ctx, [a]) => a.map(Math.abs));
fn('array.binary_search', ['id', 'val'], (ctx, [a, v]) => a.indexOf(v));
fn('array.binary_search_leftmost', ['id', 'val'], (ctx, [a, v]) => {
  const exact = a.indexOf(v);
  if (exact >= 0) return exact;
  let index = -1;
  for (let i = 0; i < a.length && a[i] < v; i++) index = i;
  return index;
});
fn('array.binary_search_rightmost', ['id', 'val'], (ctx, [a, v]) => {
  const exact = a.lastIndexOf(v);
  if (exact >= 0) return exact;
  let index = a.length;
  for (let i = a.length - 1; i >= 0 && a[i] > v; i--) index = i;
  return index;
});

// MAPS

fn('map.new', [], () => new Map());
fn('map.put', ['id', 'key', 'value'], (ctx, [m, k, v]) => { const previous = m.get(k); m.set(k, v); return previous ?? NaN; });
fn('map.get', ['id', 'key'], (ctx, [m, k]) => (m.has(k) ? m.get(k) : NaN));
fn('map.contains', ['id', 'key'], (ctx, [m, k]) => m.has(k));
fn('map.remove', ['id', 'key'], (ctx, [m, k]) => { const previous = m.get(k); m.delete(k); return previous ?? NaN; });
fn('map.keys', ['id'], (ctx, [m]) => [...m.keys()]);
fn('map.values', ['id'], (ctx, [m]) => [...m.values()]);
fn('map.size', ['id'], (ctx, [m]) => m.size);
fn('map.clear', ['id'], (ctx, [m]) => { m.clear(); return NaN; });
fn('map.copy', ['id'], (ctx, [m]) => new Map(m));
fn('map.put_all', ['id', 'id2'], (ctx, [m, other]) => { for (const [k, v] of other) m.set(k, v); return NaN; });

// COLORS

const NAMED_COLORS = {
  aqua: '00BCD4', black: '363A45', blue: '2196F3', fuchsia: 'E040FB', gray: '787B86', green: '4CAF50', lime: '00E676',
  maroon: '880E4F', navy: '311B92', olive: '808000', orange: 'FF9800', purple: '9C27B0', red: 'F23645', silver: 'B2B5BE',
  teal: '089981', white: 'FFFFFF', yellow: 'FDD835',
};
for (const [name, hex] of Object.entries(NAMED_COLORS)) constant(`color.${name}`, colorFromHex(hex));
fn('color.rgb', ['red', 'green', 'blue', 'transp'], (ctx, [r, g, b, t = 0]) => makeColor(r, g, b, t));
fn('color.new', ['color', 'transp'], (ctx, [c, t]) => (isNa(c) || !isColor(c) ? NaN : makeColor(c.r, c.g, c.b, t)));
for (const channel of ['r', 'g', 'b', 't']) fn(`color.${channel}`, ['color'], (ctx, [c]) => (isNa(c) ? NaN : c[channel]));
fn('color.from_gradient', ['value', 'bottom_value', 'top_value', 'bottom_color', 'top_color'], (ctx, [value, bottom, top, from, to]) => {
  if ([value, bottom, top, from, to].some(isNa)) return NaN;
  const ratio = top === bottom ? 0 : Math.min(Math.max((value - bottom) / (top - bottom), 0), 1);
  const mix = key => from[key] + (to[key] - from[key]) * ratio;
  return makeColor(mix('r'), mix('g'), mix('b'), mix('t'));
});

// CONSTANT NAMESPACES

constantList('xloc', ['bar_index', 'bar_time']);
constantList('yloc', ['price', 'abovebar', 'belowbar']);
constantList('extend', ['none', 'left', 'right', 'both']);
constantList('size', ['auto', 'tiny', 'small', 'normal', 'large', 'huge']);
constantList('text', ['align_left', 'align_center', 'align_right', 'align_top', 'align_bottom', 'wrap_auto', 'wrap_none', 'format_bold', 'format_italic', 'format_none']);
constantList('position', ['top_left', 'top_center', 'top_right', 'middle_left', 'middle_center', 'middle_right', 'bottom_left', 'bottom_center', 'bottom_right']);
constantList('display', ['all', 'none', 'pane', 'data_window', 'price_scale', 'status_line']);
constantList('shape', ['xcross', 'cross', 'triangleup', 'triangledown', 'flag', 'circle', 'arrowup', 'arrowdown', 'labelup', 'labeldown', 'square', 'diamond']);
constantList('location', ['abovebar', 'belowbar', 'top', 'bottom', 'absolute']);
constantList('font', ['family_default', 'family_monospace']);
constantList('format', ['mintick', 'percent', 'price', 'volume', 'inherit']);
constantList('order', ['ascending', 'descending']);
constantList('barmerge', ['gaps_on', 'gaps_off', 'lookahead_on', 'lookahead_off']);
constantList('alert', ['freq_all', 'freq_once_per_bar', 'freq_once_per_bar_close']);
constantList('scale', ['right', 'left', 'none']);
constantList('adjustment', ['none', 'splits', 'dividends']);
constantList('currency', ['USD', 'EUR', 'NONE']);
constantList('line', ['style_solid', 'style_dotted', 'style_dashed', 'style_arrow_left', 'style_arrow_right', 'style_arrow_both']);
constantList('hline', ['style_solid', 'style_dotted', 'style_dashed']);
constantList('plot', ['style_line', 'style_linebr', 'style_stepline', 'style_stepline_diamond', 'style_histogram', 'style_cross', 'style_area', 'style_areabr', 'style_columns', 'style_circles', 'style_steplinebr']);
constantList('label', ['style_none', 'style_xcross', 'style_cross', 'style_triangleup', 'style_triangledown', 'style_flag', 'style_circle', 'style_arrowup', 'style_arrowdown', 'style_label_up', 'style_label_down', 'style_label_left', 'style_label_right', 'style_label_lower_left', 'style_label_lower_right', 'style_label_upper_left', 'style_label_upper_right', 'style_label_center', 'style_square', 'style_diamond', 'style_text_outline']);
constantList('session', ['regular', 'extended']);
constantList('splits', ['numerator', 'denominator']);
constantList('backadjustment', ['on', 'off', 'inherit']);
constantList('settlement_as_close', ['on', 'off', 'inherit']);
['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach((day, index) => constant(`dayofweek.${day}`, index + 1));

// BAR DATA AND STATE

const bar = key => ctx => ctx.bars[key][ctx.i];
for (const key of ['open', 'high', 'low', 'close', 'volume']) {
  variable(key, bar(key));
  seriesHistory.set(key, (ctx, offset) => (ctx.i - offset >= 0 ? ctx.bars[key][ctx.i - offset] : NaN));
}
variable('time', ctx => ctx.bars.time[ctx.i]);
seriesHistory.set('time', (ctx, offset) => (ctx.i - offset >= 0 ? ctx.bars.time[ctx.i - offset] : NaN));
variable('time_close', ctx => ctx.bars.timeClose[ctx.i]);
seriesHistory.set('time_close', (ctx, offset) => (ctx.i - offset >= 0 ? ctx.bars.timeClose[ctx.i - offset] : NaN));
variable('bar_index', ctx => ctx.i);
seriesHistory.set('bar_index', (ctx, offset) => (ctx.i - offset >= 0 ? ctx.i - offset : NaN));
const derived = {
  hl2: (ctx, i) => (ctx.bars.high[i] + ctx.bars.low[i]) / 2,
  hlc3: (ctx, i) => (ctx.bars.high[i] + ctx.bars.low[i] + ctx.bars.close[i]) / 3,
  ohlc4: (ctx, i) => (ctx.bars.open[i] + ctx.bars.high[i] + ctx.bars.low[i] + ctx.bars.close[i]) / 4,
  hlcc4: (ctx, i) => (ctx.bars.high[i] + ctx.bars.low[i] + 2 * ctx.bars.close[i]) / 4,
};
for (const [name, compute] of Object.entries(derived)) {
  variable(name, ctx => compute(ctx, ctx.i));
  seriesHistory.set(name, (ctx, offset) => (ctx.i - offset >= 0 ? compute(ctx, ctx.i - offset) : NaN));
}
variable('last_bar_index', ctx => ctx.lastIndex);
variable('last_bar_time', ctx => ctx.bars.time[ctx.lastIndex]);
variable('timenow', ctx => ctx.timenow);
variable('barstate.isfirst', ctx => ctx.i === 0);
variable('barstate.islast', ctx => ctx.i === ctx.lastIndex);
variable('barstate.isrealtime', ctx => ctx.i === ctx.lastIndex && ctx.realtimeLast);
variable('barstate.ishistory', ctx => !(ctx.i === ctx.lastIndex && ctx.realtimeLast));
variable('barstate.isnew', ctx => !(ctx.i === ctx.lastIndex && ctx.realtimeLast) || ctx.tickIsNew !== false);
variable('barstate.isconfirmed', ctx => !(ctx.i === ctx.lastIndex && ctx.realtimeLast));
variable('barstate.islastconfirmedhistory', ctx => (ctx.realtimeLast ? ctx.i === ctx.lastIndex - 1 : ctx.i === ctx.lastIndex));
variable('chart.is_range', ctx => ctx.chart.isRange);
variable('chart.is_standard', ctx => !ctx.chart.isRange);
for (const kind of ['heikinashi', 'renko', 'kagi', 'linebreak', 'pnf']) variable(`chart.is_${kind}`, () => false);
variable('chart.bg_color', () => makeColor(255, 255, 255, 0));
variable('chart.fg_color', () => makeColor(19, 23, 34, 0));
variable('chart.left_visible_bar_time', ctx => ctx.bars.time[Math.max(0, ctx.lastIndex - 200)]);
variable('chart.right_visible_bar_time', ctx => ctx.bars.time[ctx.lastIndex]);
for (const key of ['type', 'root', 'ticker', 'tickerid', 'mintick', 'timezone', 'session', 'pointvalue', 'currency', 'prefix', 'description', 'basecurrency', 'volumetype', 'minmove', 'pricescale', 'main_tickerid']) {
  variable(`syminfo.${key}`, ctx => ctx.symbol[key]);
}
variable('session.ismarket', () => true);
variable('session.ispremarket', () => false);
variable('session.ispostmarket', () => false);

// INPUTS — overrides are keyed by the Pine variable that receives the input.

function inputImpl(kind) {
  return (ctx, [defval, title], named, meta) => {
    const cache = ctx.inputCache ??= new Map();
    if (cache.has(meta.site)) return cache.get(meta.site);
    const value = resolveInput(kind, ctx, defval, title, named, meta);
    cache.set(meta.site, value);
    return value;
  };
}
function resolveInput(kind, ctx, defval, title, named, meta) {
  {
    const name = meta.inputName ?? title;
    const options = named.options;
    let value = defval;
    if (ctx.inputs && Object.hasOwn(ctx.inputs, name)) {
      value = ctx.inputs[name];
      ctx.usedInputs?.add(name);
      if (typeof value === 'string' && defval?.__enum) {
        const members = Object.values(ctx.program.enumByName(defval.__enum)?.members ?? {});
        value = members.find(member => member.title === value || member.name === value) ?? value;
      }
      if (options && !options.some(option => pineEquals(option, value) || option === value)) {
        throw new PineRuntimeError(`input ${name}: ${JSON.stringify(value)} is not one of ${JSON.stringify(options)}`);
      }
    }
    if (ctx.inputRecords && !ctx.inputRecords.has(name)) ctx.inputRecords.set(name, { kind, title, defval, options, group: named.group, inline: named.inline });
    return value;
  }
}
for (const kind of ['bool', 'int', 'float', 'string', 'color', 'timeframe', 'session', 'source', 'symbol', 'price', 'time', 'text_area', 'enum']) {
  fn(`input.${kind}`, ['defval', 'title'], inputImpl(kind));
}
fn('input', ['defval', 'title'], inputImpl('auto'));

// OUTPUTS WITHOUT TEST-RELEVANT STATE

function recordPlot(kind) {
  return (ctx, [series, title], named, meta) => {
    if (!ctx.plots) return NaN;
    const key = named.title ?? title ?? `${kind}#${meta.site}`;
    let entry = ctx.plots.get(key);
    if (!entry) { entry = { kind, values: [] }; ctx.plots.set(key, entry); }
    entry.values[ctx.i] = series;
    return NaN;
  };
}
fn('plot', ['series', 'title'], recordPlot('plot'));
fn('plotshape', ['series', 'title'], recordPlot('plotshape'));
fn('plotchar', ['series', 'title'], recordPlot('plotchar'));
fn('plotcandle', ['open', 'high', 'low', 'close', 'title'], (ctx, [open, high, low, close, title], named, meta) => recordPlot('plotcandle')(ctx, [open, title], named, meta));
fn('plotbar', ['open', 'high', 'low', 'close', 'title'], () => NaN);
fn('plotarrow', ['series', 'title'], recordPlot('plotarrow'));
fn('bgcolor', ['color'], (ctx, [color], named, meta) => recordPlot('bgcolor')(ctx, [color, named.title], named, meta));
fn('barcolor', ['color'], () => NaN);
fn('fill', ['hline1', 'hline2', 'color'], () => NaN);
fn('hline', ['price', 'title'], () => NaN);
fn('alertcondition', ['condition', 'title', 'message'], (ctx, [condition, title]) => {
  if (condition === true && ctx.alerts) ctx.alerts.push({ bar: ctx.i, time: ctx.bars.time[ctx.i], title });
  return NaN;
});
fn('alert', ['message', 'freq'], (ctx, [message]) => { if (ctx.alerts) ctx.alerts.push({ bar: ctx.i, time: ctx.bars.time[ctx.i], message }); return NaN; });
for (const level of ['info', 'warning', 'error']) fn(`log.${level}`, null, () => NaN);
fn('runtime.error', ['message'], (ctx, [message]) => { throw new PineRuntimeError(`runtime.error: ${message}`); });

// SYMBOLS AND TIMEFRAMES

fn('ticker.standard', ['symbol'], (ctx, [symbol]) => symbol ?? ctx.symbol.tickerid);
fn('ticker.new', ['prefix', 'ticker', 'session', 'adjustment', 'backadjustment', 'settlement_as_close'], (ctx, [prefix, ticker]) => `${prefix}:${ticker}`);
fn('ticker.modify', ['tickerid', 'session', 'adjustment', 'backadjustment', 'settlement_as_close'], (ctx, [tickerid]) => tickerid);

export function normalizeTimeframe(tf, chartTf) {
  const value = tf === undefined || tf === null || tf === '' ? chartTf : String(tf);
  const match = /^(\d*)([SDWM]?)$/.exec(value);
  if (!match) throw new PineRuntimeError(`unsupported timeframe ${JSON.stringify(value)}`);
  const multiplier = match[1] === '' ? 1 : Number(match[1]);
  const unit = match[2];
  return unit === '' ? String(multiplier) : `${multiplier}${unit}`;
}

export function timeframeSeconds(tf, chartTf) {
  const normalized = normalizeTimeframe(tf, chartTf);
  const match = /^(\d+)([SDWM]?)$/.exec(normalized);
  const multiplier = Number(match[1]);
  switch (match[2]) {
    case 'S': return multiplier;
    case 'D': return multiplier * 86400;
    case 'W': return multiplier * 604800;
    case 'M': return multiplier * 2628003;
    default: return multiplier * 60;
  }
}

variable('timeframe.period', ctx => normalizeTimeframe(ctx.tf));
variable('timeframe.main_period', ctx => normalizeTimeframe(ctx.mainTf ?? ctx.tf));
variable('timeframe.multiplier', ctx => Number(/^\d+/.exec(normalizeTimeframe(ctx.tf))[0]));
variable('timeframe.isintraday', ctx => /^\d+S?$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.isminutes', ctx => /^\d+$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.isseconds', ctx => /S$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.isdaily', ctx => /D$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.isweekly', ctx => /W$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.ismonthly', ctx => /M$/.test(normalizeTimeframe(ctx.tf)));
variable('timeframe.isdwm', ctx => /[DWM]$/.test(normalizeTimeframe(ctx.tf)));
fn('timeframe.in_seconds', ['timeframe'], (ctx, [tf]) => timeframeSeconds(tf, ctx.tf));
fn('timeframe.from_seconds', ['seconds'], (ctx, [seconds]) => {
  if (seconds % 604800 === 0) return `${seconds / 604800}W`;
  if (seconds % 86400 === 0) return `${seconds / 86400}D`;
  if (seconds % 60 === 0) return String(seconds / 60);
  return `${seconds}S`;
});
fn('timeframe.change', ['timeframe'], (ctx, [tf]) => {
  if (ctx.i === 0) return true;
  return ctx.market.periodStart(tf, ctx.bars.time[ctx.i]) !== ctx.market.periodStart(tf, ctx.bars.time[ctx.i - 1]);
});

// CALENDAR

const calendarFields = { year: 'year', month: 'month', dayofmonth: 'day', hour: 'hour', minute: 'minute', second: 'second', dayofweek: 'dayOfWeek' };
for (const [name, field] of Object.entries(calendarFields)) {
  fn(name, ['time', 'timezone'], (ctx, [time, zone]) => (isNa(time) ? NaN : localParts(time, zone ?? ctx.symbol.timezone)[field]));
  variable(name, ctx => localParts(ctx.bars.time[ctx.i], ctx.symbol.timezone)[field]);
}
fn('weekofyear', ['time', 'timezone'], (ctx, [time, zone]) => {
  const parts = localParts(time, zone ?? ctx.symbol.timezone);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const start = new Date(Date.UTC(parts.year, 0, 1));
  return Math.floor(((date - start) / 86400000 + start.getUTCDay()) / 7) + 1;
});
fn('timestamp', null, (ctx, args) => {
  if (args.length === 1 && typeof args[0] === 'string') return Date.parse(args[0]);
  const hasZone = typeof args[0] === 'string';
  const zone = hasZone ? args[0] : ctx.symbol.timezone;
  const [year, month, day, hour = 0, minute = 0, second = 0] = hasZone ? args.slice(1) : args;
  if ([year, month, day, hour, minute, second].some(isNa)) return NaN;
  return zonedTimestamp(zone, year, month, day, hour, minute, second);
});

function inSession(ctx, time, spec, zone) {
  if (isNa(spec) || spec === '' ) return true;
  const parts = localParts(time, zone ?? ctx.symbol.timezone);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  return String(spec).split(',').some(segment => {
    const [range, days = '1234567'] = segment.split(':');
    const [start, end] = range.split('-').map(value => Number(value.slice(0, 2)) * 60 + Number(value.slice(2, 4)));
    if (start === end) return days.includes(String(parts.dayOfWeek));
    if (start < end) return minuteOfDay >= start && minuteOfDay < end && days.includes(String(parts.dayOfWeek));
    if (minuteOfDay >= start) {
      const next = parts.dayOfWeek % 7 + 1;
      return days.includes(String(next));
    }
    return minuteOfDay < end && days.includes(String(parts.dayOfWeek));
  });
}

function barTimeWithOffset(ctx, barsBack) {
  if (!barsBack) return ctx.bars.time[ctx.i];
  const index = ctx.i - barsBack;
  if (index >= 0 && index <= ctx.lastIndex) return ctx.bars.time[index];
  if (index > ctx.lastIndex) return ctx.futureBarTime(index - ctx.lastIndex);
  return NaN;
}

fn('time', ['timeframe', 'session', 'timezone', 'bars_back', 'timeframe_bars_back'], (ctx, [tf, session, zone, barsBack = 0]) => {
  const time = barTimeWithOffset(ctx, barsBack);
  if (isNa(time)) return NaN;
  const sameTimeframe = tf === undefined || tf === '' || normalizeTimeframe(tf, ctx.tf) === normalizeTimeframe(ctx.tf);
  if (session !== undefined && !inSession(ctx, time, session, zone)) return NaN;
  return sameTimeframe ? time : ctx.market.periodStart(tf, time);
});
fn('time_close', ['timeframe', 'session', 'timezone', 'bars_back', 'timeframe_bars_back'], (ctx, [tf, session, zone, barsBack = 0]) => {
  const time = barTimeWithOffset(ctx, barsBack);
  if (isNa(time)) return NaN;
  if (session !== undefined && !inSession(ctx, time, session, zone)) return NaN;
  const sameTimeframe = tf === undefined || tf === '' || normalizeTimeframe(tf, ctx.tf) === normalizeTimeframe(ctx.tf);
  if (sameTimeframe) return barsBack ? NaN : ctx.bars.timeClose[ctx.i];
  return ctx.market.periodEnd(tf, time);
});
fn('time_tradingday', [], ctx => ctx.market.tradingDay(ctx.bars.time[ctx.i]));
variable('time_tradingday', ctx => ctx.market.tradingDay(ctx.bars.time[ctx.i]));

// REQUESTS — the expression is compiled as a thunk and run in its own bar context.

fn('request.security', ['symbol', 'timeframe', 'expression', 'gaps', 'lookahead', 'ignore_invalid_symbol', 'currency', 'calc_bars_count'], null, {
  compile(program, node, scope) {
    const expressionNode = node.args[2] ?? node.named.expression;
    const reduced = { ...node, args: node.args.slice(0, 2), named: { ...node.named } };
    delete reduced.named.expression;
    const args = program.compileArguments(reduced, scope, ['symbol', 'timeframe', 'gaps', 'lookahead', 'ignore_invalid_symbol', 'currency', 'calc_bars_count']);
    const expression = program.compileExpression(expressionNode, scope);
    const site = program.site();
    return (ctx, L) => {
      const [[symbol, tf, gaps, lookahead, , , calcBars], named] = args(ctx, L);
      return ctx.requestSecurity({
        site, symbol, tf, gaps: gaps ?? named.gaps, lookahead: lookahead ?? named.lookahead ?? 'barmerge.lookahead_off',
        calcBars: calcBars ?? named.calc_bars_count, evaluate: securityCtx => expression(securityCtx, L), line: node.line,
      });
    };
  },
});

fn('request.security_lower_tf', ['symbol', 'timeframe', 'expression', 'ignore_invalid_symbol', 'currency', 'ignore_invalid_timeframe', 'calc_bars_count'], null, {
  compile(program, node, scope) {
    const expressionNode = node.args[2] ?? node.named.expression;
    const reduced = { ...node, args: node.args.slice(0, 2), named: { ...node.named } };
    delete reduced.named.expression;
    const args = program.compileArguments(reduced, scope, ['symbol', 'timeframe', 'ignore_invalid_symbol', 'currency', 'ignore_invalid_timeframe', 'calc_bars_count']);
    const expression = program.compileExpression(expressionNode, scope);
    const site = program.site();
    return (ctx, L) => {
      const [[symbol, tf]] = args(ctx, L);
      return ctx.requestLowerTimeframe({ site, symbol, tf, tupleSize: expressionNode.kind === 'Tuple' ? expressionNode.items.length : 0, evaluate: securityCtx => expression(securityCtx, L), line: node.line });
    };
  },
});
fn('request.currency_rate', ['from', 'to', 'ignore_invalid_currency'], (ctx, [from, to]) => (from === to ? 1 : ctx.currencyRates?.[`${from}/${to}`] ?? NaN));

registerDrawings(registry);
registerTa(registry, { siteState, median, stdev });

export const BUILTINS = { functions, variables, constants, seriesHistory, namespaces, colorFromHex };
