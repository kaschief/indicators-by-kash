// ta.* built-ins. Each call site keeps its own history in the calling frame, advancing once per
// execution of that frame, which reproduces Pine's per-call-site series.

import { isNa } from './values.mjs';

const MAX_HISTORY = 6000;

function history(ctx, meta, siteState) {
  const state = siteState(ctx, meta.site, () => ({ exec: -1, values: [], extra: {} }));
  return state;
}

// Records `value` as this execution's sample and returns the sample list (newest last).
function sample(state, exec, value) {
  if (state.exec !== exec) {
    state.values.push(value);
    if (state.values.length > MAX_HISTORY) state.values.splice(0, state.values.length - MAX_HISTORY + 1000);
    state.exec = exec;
  } else state.values[state.values.length - 1] = value;
  return state.values;
}

function windowOf(values, length) {
  if (values.length < length) return null;
  return values.slice(values.length - length);
}

export function registerTa({ fn, variable }, { siteState, median, stdev }) {
  const seriesFn = (name, params, compute) => fn(`ta.${name}`, params, (ctx, args, named, meta) => {
    const state = history(ctx, meta, siteState);
    return compute(state, ctx.frame.exec, args, ctx);
  });

  seriesFn('change', ['source', 'length'], (state, exec, [source, length = 1]) => {
    const values = sample(state, exec, source);
    const index = values.length - 1 - length;
    if (index < 0) return typeof source === 'boolean' ? false : NaN;
    if (typeof source === 'boolean') return source !== values[index];
    return source - values[index];
  });

  seriesFn('valuewhen', ['condition', 'source', 'occurrence'], (state, exec, [condition, source, occurrence = 0]) => {
    const extra = state.extra;
    if (extra.exec !== exec) {
      if (extra.pending !== undefined) { (extra.hits ??= []).push(extra.pending); if (extra.hits.length > MAX_HISTORY + 1000) extra.hits.splice(0, 1000); }
      extra.pending = undefined;
      extra.exec = exec;
    }
    extra.pending = condition === true ? source : undefined;
    const hits = extra.hits ?? [];
    const pendingCount = extra.pending !== undefined ? 1 : 0;
    if (occurrence < pendingCount) return extra.pending;
    const index = hits.length - 1 - (occurrence - pendingCount);
    return index >= 0 ? hits[index] : NaN;
  });

  const windowed = (name, reduce) => seriesFn(name, ['source', 'length'], (state, exec, [source, length]) => {
    const window = windowOf(sample(state, exec, source), length);
    if (!window || window.some(isNa)) return NaN;
    return reduce(window);
  });
  windowed('sma', window => window.reduce((sum, value) => sum + value, 0) / window.length);
  windowed('median', window => median(window));
  windowed('stdev', window => stdev(window, true));
  windowed('variance', window => stdev(window, true) ** 2);
  seriesFn('sum', ['source', 'length'], (state, exec, [source, length]) => {
    const window = windowOf(sample(state, exec, source), length);
    return window && !window.some(isNa) ? window.reduce((sum, value) => sum + value, 0) : NaN;
  });

  const extreme = (name, pick, sourceKey) => fn(`ta.${name}`, ['source', 'length'], (ctx, args, named, meta) => {
    const state = history(ctx, meta, siteState);
    let [source, length] = args;
    if (length === undefined) { length = source; source = ctx.bars[sourceKey][ctx.i]; }
    const window = windowOf(sample(state, ctx.frame.exec, source), length);
    if (!window) return NaN;
    const values = window.filter(value => !isNa(value));
    return values.length ? pick(...values) : NaN;
  });
  extreme('highest', Math.max, 'high');
  extreme('lowest', Math.min, 'low');

  const allTime = (name, pick) => seriesFn(name, ['source'], (state, exec, [source]) => {
    const extra = state.extra;
    if (extra.exec !== exec) { extra.committed = extra.current; extra.exec = exec; }
    const base = extra.committed;
    extra.current = isNa(source) ? base : isNa(base) || base === undefined ? source : pick(base, source);
    return extra.current ?? NaN;
  });
  allTime('max', Math.max);
  allTime('min', Math.min);

  seriesFn('cum', ['source'], (state, exec, [source]) => {
    const extra = state.extra;
    if (extra.exec !== exec) { extra.committed = extra.current ?? 0; extra.exec = exec; }
    extra.current = extra.committed + (isNa(source) ? 0 : source);
    return extra.current;
  });

  const recursive = (name, alphaOf) => seriesFn(name, ['source', 'length'], (state, exec, [source, length]) => {
    const extra = state.extra;
    if (extra.exec !== exec) { extra.committed = extra.current; extra.exec = exec; }
    sample(state, exec, source);
    const previous = extra.committed;
    if (isNa(previous) || previous === undefined) {
      const window = windowOf(state.values, length);
      extra.current = window && !window.some(isNa) ? window.reduce((sum, value) => sum + value, 0) / length : NaN;
    } else extra.current = isNa(source) ? previous : alphaOf(length) * source + (1 - alphaOf(length)) * previous;
    return extra.current;
  });
  recursive('ema', length => 2 / (length + 1));
  recursive('rma', length => 1 / length);

  fn('ta.tr', ['handle_na'], (ctx, [handleNa = false]) => trueRange(ctx, handleNa));
  variable('ta.tr', ctx => trueRange(ctx, false));
  fn('ta.atr', ['length'], (ctx, [length], named, meta) => {
    const state = history(ctx, meta, siteState);
    const extra = state.extra;
    const range = trueRange(ctx, true);
    if (extra.exec !== ctx.frame.exec) { extra.committed = extra.current; extra.exec = ctx.frame.exec; }
    const values = sample(state, ctx.frame.exec, range);
    const previous = extra.committed;
    if (isNa(previous) || previous === undefined) {
      const window = windowOf(values, length);
      extra.current = window ? window.reduce((sum, value) => sum + value, 0) / length : NaN;
    } else extra.current = (previous * (length - 1) + range) / length;
    return extra.current;
  });

  const crossing = (name, test) => seriesFn(name, ['source1', 'source2'], (state, exec, [a, b]) => {
    const extra = state.extra;
    if (extra.exec !== exec) { extra.previous = extra.current; extra.exec = exec; }
    extra.current = [a, b];
    if (!extra.previous) return false;
    const [pa, pb] = extra.previous;
    return test(a, b, pa, pb);
  });
  crossing('crossover', (a, b, pa, pb) => a > b && pa <= pb);
  crossing('crossunder', (a, b, pa, pb) => a < b && pa >= pb);
  crossing('cross', (a, b, pa, pb) => (a > b && pa <= pb) || (a < b && pa >= pb));

  seriesFn('barssince', ['condition'], (state, exec, [condition]) => {
    const extra = state.extra;
    if (extra.exec !== exec) { extra.committed = extra.current; extra.exec = exec; }
    const previous = extra.committed;
    extra.current = condition === true ? 0 : isNa(previous) || previous === undefined ? NaN : previous + 1;
    return extra.current;
  });

  const pivot = (name, isHigh) => fn(`ta.${name}`, ['source', 'leftbars', 'rightbars'], (ctx, args, named, meta) => {
    const state = history(ctx, meta, siteState);
    let [source, left, right] = args;
    if (right === undefined) { right = left; left = source; source = ctx.bars[isHigh ? 'high' : 'low'][ctx.i]; }
    const values = sample(state, ctx.frame.exec, source);
    if (values.length < left + right + 1) return NaN;
    const window = values.slice(values.length - left - right - 1);
    const candidate = window[left];
    if (isNa(candidate)) return NaN;
    const ok = window.every((value, index) => index === left || (isHigh ? candidate > value : candidate < value));
    return ok ? candidate : NaN;
  });
  pivot('pivothigh', true);
  pivot('pivotlow', false);

  fn('ta.vwap', ['source', 'anchor', 'stdev_mult'], (ctx, [source, anchor, mult], named, meta) => {
    const state = history(ctx, meta, siteState);
    const extra = state.extra;
    if (extra.exec !== ctx.frame.exec) { extra.committed = extra.current ?? { pv: 0, v: 0, pv2: 0 }; extra.exec = ctx.frame.exec; }
    const reset = anchor === true || (anchor === undefined && ctx.i > 0 && ctx.market.tradingDay(ctx.bars.time[ctx.i]) !== ctx.market.tradingDay(ctx.bars.time[ctx.i - 1]));
    const base = reset ? { pv: 0, v: 0, pv2: 0 } : extra.committed;
    const volume = ctx.bars.volume[ctx.i];
    extra.current = { pv: base.pv + source * volume, v: base.v + volume, pv2: base.pv2 + source * source * volume };
    const vwap = extra.current.v ? extra.current.pv / extra.current.v : NaN;
    if (mult === undefined) return vwap;
    const deviation = Math.sqrt(Math.max(0, extra.current.pv2 / extra.current.v - vwap * vwap));
    return [vwap, vwap + mult * deviation, vwap - mult * deviation];
  });
}

function trueRange(ctx, handleNa) {
  const { high, low, close } = ctx.bars;
  const i = ctx.i;
  if (i === 0) return handleNa ? high[i] - low[i] : NaN;
  return Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
}
