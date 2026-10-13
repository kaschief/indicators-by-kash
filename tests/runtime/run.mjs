// Runs a compiled indicator over a synthetic chart and returns what TradingView would show:
// live drawings, plots and alerts, plus the per-bar context for deeper assertions.

import { readFileSync } from 'node:fs';
import { parse } from './parser.mjs';
import { Program, Frame } from './compiler.mjs';
import { DrawingStore } from './drawings.mjs';
import { PineRuntimeError, isNa } from './values.mjs';
import { normalizeTimeframe, timeframeSeconds } from './builtins.mjs';
import { localParts } from './timezone.mjs';

const compiled = new Map();

export const CME_NQ = Object.freeze({
  type: 'futures', root: 'NQ', ticker: 'NQ1!', tickerid: 'CME_MINI:NQ1!', main_tickerid: 'CME_MINI:NQ1!', prefix: 'CME_MINI',
  mintick: 0.25, timezone: 'America/Chicago', session: 'regular', pointvalue: 20, currency: 'USD', description: 'E-mini Nasdaq-100',
  basecurrency: 'USD', volumetype: 'base', minmove: 1, pricescale: 4,
});

export function compileSource(source, { libraries = {}, sourceName } = {}) {
  return new Program(parse(source), { libraries, sourceName });
}

// Libraries are compiled like scripts; their top-level constants are evaluated once.
export function loadLibrary(path, { libraries = {} } = {}) {
  const program = compileSource(readFileSync(path, 'utf8'), { libraries, sourceName: path });
  const frame = new Frame();
  const locals = new Array(program.main.slots.length);
  const ctx = libraryContext(program, frame, locals);
  program.body(ctx, locals);
  program.libraryState = { locals, frame };
  return { program };
}

function libraryContext(program, frame, locals) {
  return {
    program, frame, mainFrame: frame, mainLocals: locals, flow: 0, i: 0, lastIndex: 0,
    bars: { time: [0], timeClose: [0], open: [NaN], high: [NaN], low: [NaN], close: [NaN], volume: [NaN] },
    symbol: CME_NQ, tf: '1', chart: { isRange: false }, timenow: 0, realtimeLast: false,
  };
}

// Loads every library in a folder, keyed by its library() title, in dependency order. Imports
// resolve to this local source regardless of the published version number they name.
export function loadLibraryFolder(paths) {
  const sources = paths.map(path => {
    const source = readFileSync(path, 'utf8');
    const title = /library\("([^"]+)"/.exec(source)?.[1];
    if (!title) throw new Error(`${path} is not a library`);
    const imports = [...source.matchAll(/^import\s+[\w-]+\/(\w+)\/\d+/gm)].map(match => match[1]);
    return { path, title, imports };
  });
  const libraries = {};
  const pending = [...sources];
  while (pending.length) {
    const index = pending.findIndex(entry => entry.imports.every(name => libraries[name]));
    if (index < 0) throw new Error(`unresolved library imports: ${pending.map(entry => `${entry.title} -> ${entry.imports.join(',')}`).join('; ')}`);
    const [entry] = pending.splice(index, 1);
    libraries[entry.title] = loadLibrary(entry.path, { libraries });
  }
  return libraries;
}

export function loadIndicator(path, { libraries = {} } = {}) {
  const key = `${path}|${Object.keys(libraries).join(',')}`;
  if (!compiled.has(key)) compiled.set(key, compileSource(readFileSync(path, 'utf8'), { libraries, sourceName: path }));
  return compiled.get(key);
}

const formatNy = time => {
  if (isNa(time)) return 'na';
  const p = localParts(time, 'America/New_York');
  const pad = value => String(value).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)} NY`;
};
export { formatNy };

// chart: { type: 'time', tf } | { type: 'range', size, period }
// until: data cut-off; the bar holding it is the last, still-forming candle.
// mode: 'live'   — the last candle is updating in realtime and timenow is `now`
//       'loaded' — the chart has just loaded: the last candle is historical (no realtime tick yet)
//       'replay' — Bar Replay: the last candle is realtime, but timenow stays at the real clock
// now: wall clock for timenow (defaults to `until`; Replay defaults to 30 days later).
export function runIndicator(program, { market, chart, from = -Infinity, until = Infinity, mode = 'live', now, inputs = {}, symbol = CME_NQ, rangeFutureBarMs = null, currencyRates = {} }) {
  if (!['live', 'loaded', 'replay'].includes(mode)) throw new Error(`unknown mode ${mode}`);
  const isRange = chart.type === 'range';
  const bars = isRange ? market.rangeBars(chart.size, until, from) : market.timeBars(chart.tf, until, from);
  if (!bars.time.length) throw new Error('scenario produced no bars');
  const lastIndex = bars.time.length - 1;
  const dataEnd = Number.isFinite(until) ? until : market.candles.at(-1).time + 60_000;
  const realtimeLast = mode !== 'loaded';
  const timenow = now ?? (mode === 'replay' ? dataEnd + 30 * 86_400_000 : dataEnd);
  const tf = isRange ? (chart.period ?? '1') : chart.tf;

  const ctx = {
    program, bars, lastIndex, i: 0, tf, mainTf: tf, chart: { isRange, ...chart }, symbol, market, timenow, realtimeLast,
    inputs, usedInputs: new Set(), inputRecords: new Map(), plots: new Map(), alerts: [], drawings: new DrawingStore(),
    declaration: null, flow: 0, mainFrame: new Frame(), mainLocals: null, frame: null, random: seeded(11),
    futureBarTime: count => {
      if (isRange) return rangeFutureBarMs === null ? NaN : bars.time[lastIndex] + count * rangeFutureBarMs;
      return market.futureTimeBarTime(tf, bars.time[lastIndex], count);
    },
    requestSecurity: request => requestSecurity(ctx, request, dataEnd),
    requestLowerTimeframe: request => requestLowerTimeframe(ctx, request, dataEnd),
    currencyRates,
  };

  const unknownInputs = () => Object.keys(inputs).filter(name => !ctx.inputRecords.has(name));
  for (let i = 0; i <= lastIndex; i++) {
    ctx.i = i;
    ctx.mainFrame.exec = i;
    ctx.frame = ctx.mainFrame;
    ctx.flow = 0;
    ctx.mainLocals = new Array(program.main.slots.length);
    try {
      program.body(ctx, ctx.mainLocals);
    } catch (error) {
      error.message = `${error.message} (bar ${i}, ${formatNy(bars.time[i])})`;
      throw error;
    }
    if (i === 0 && unknownInputs().length) throw new Error(`unknown inputs: ${unknownInputs().join(', ')}`);
  }
  return new RunResult(ctx);
}

function seeded(seed) {
  let state = seed;
  return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
}

function requestSecurity(ctx, request, dataEnd) {
  const tf = normalizeTimeframe(request.tf, ctx.tf);
  const frame = ctx.frame;
  let states = frame.state.get(`security${request.site}`);
  if (!states) { states = new Map(); frame.state.set(`security${request.site}`, states); }
  const key = `${request.symbol}|${tf}`;
  let state = states.get(key);
  if (!state) {
    const full = ctx.market.timeBars(tf, dataEnd);
    const count = full.time.length;
    const first = request.calcBars ? Math.max(0, count - request.calcBars) : 0;
    const slice = Object.fromEntries(['time', 'timeClose', 'open', 'high', 'low', 'close', 'volume'].map(field => [field, full[field].slice(first)]));
    const sctx = {
      program: ctx.program, bars: slice, lastIndex: slice.time.length - 1, i: 0, tf, mainTf: ctx.tf, chart: ctx.chart, symbol: ctx.symbol,
      market: ctx.market, timenow: ctx.timenow, realtimeLast: ctx.realtimeLast && full.partialLast, inputs: ctx.inputs,
      declaration: ctx.declaration, flow: 0, frame: new Frame(), mainFrame: ctx.mainFrame, mainLocals: ctx.mainLocals,
      isSecurityContext: true, drawings: null, random: ctx.random,
      futureBarTime: () => NaN, currencyRates: ctx.currencyRates,
    };
    sctx.requestSecurity = nested => requestSecurity(sctx, nested, dataEnd);
    sctx.requestLowerTimeframe = nested => requestLowerTimeframe(sctx, nested, dataEnd);
    state = { sctx, results: [], evaluated: -1, root: sctx.frame };
    states.set(key, state);
  }
  const { sctx } = state;
  // A request finer than the chart bar returns the bar's last intrabar; otherwise the period holding the bar's open.
  const chartTime = ctx.bars.time[ctx.i];
  const nextTime = ctx.i < ctx.lastIndex ? ctx.bars.time[ctx.i + 1] : dataEnd;
  const chartEnd = isNa(ctx.bars.timeClose[ctx.i]) ? nextTime : Math.min(ctx.bars.timeClose[ctx.i], nextTime);
  const lookaheadOn = request.lookahead === 'barmerge.lookahead_on';
  const chartRealtime = ctx.i === ctx.lastIndex && ctx.realtimeLast;
  // Range bars have no fixed length: without lookahead they see the last period completed by the bar's close.
  const rangeCompleted = ctx.chart.isRange && !lookaheadOn;
  const lowerTimeframe = !ctx.chart.isRange && timeframeSeconds(tf, ctx.tf) * 1000 < chartEnd - chartTime;
  let k = state.cursor ?? -1;
  if (rangeCompleted) {
    while (k + 1 <= sctx.lastIndex && (chartRealtime ? sctx.bars.time[k + 1] < chartEnd : sctx.bars.timeClose[k + 1] <= chartEnd)) k++;
  } else if (lowerTimeframe) while (k + 1 <= sctx.lastIndex && sctx.bars.time[k + 1] < chartEnd) k++;
  else while (k + 1 <= sctx.lastIndex && sctx.bars.time[k + 1] <= chartTime) k++;
  state.cursor = k;
  if (k < 0) return NaN;
  sctx.mainLocals = ctx.mainLocals;
  sctx.mainFrame = ctx.mainFrame;
  while (state.evaluated < k) {
    const index = ++state.evaluated;
    sctx.i = index;
    sctx.frame = state.root;
    state.root.exec = index;
    sctx.flow = 0;
    try {
      state.results[index] = request.evaluate(sctx);
    } catch (error) {
      error.message = `${error.message} (request.security ${tf} bar ${formatNy(sctx.bars.time[index])})`;
      throw error;
    }
  }
  if (lookaheadOn || rangeCompleted || lowerTimeframe) return state.results[k];
  const chartClose = ctx.bars.timeClose[ctx.i];
  const closesPeriod = !isNa(chartClose) && chartClose >= sctx.bars.timeClose[k];
  if (chartRealtime || closesPeriod) return state.results[k];
  return k > 0 ? state.results[k - 1] : NaN;
}

// Intrabar values for the current chart bar: every lower-timeframe bar inside it, evaluated once
// in order in its own context.
function requestLowerTimeframe(ctx, request, dataEnd) {
  const tf = normalizeTimeframe(request.tf, ctx.tf);
  const frame = ctx.frame;
  const stateKey = `ltf${request.site}|${request.symbol}|${tf}`;
  let state = frame.state.get(stateKey);
  if (!state) {
    const bars = ctx.market.timeBars(tf, dataEnd);
    const sctx = {
      program: ctx.program, bars, lastIndex: bars.time.length - 1, i: 0, tf, mainTf: ctx.tf, chart: ctx.chart, symbol: ctx.symbol,
      market: ctx.market, timenow: ctx.timenow, realtimeLast: ctx.realtimeLast && bars.partialLast, inputs: ctx.inputs,
      declaration: ctx.declaration, flow: 0, frame: new Frame(), mainFrame: ctx.mainFrame, mainLocals: ctx.mainLocals,
      isSecurityContext: true, drawings: null, random: ctx.random, futureBarTime: () => NaN, currencyRates: ctx.currencyRates,
    };
    sctx.requestSecurity = nested => requestSecurity(sctx, nested, dataEnd);
    sctx.requestLowerTimeframe = nested => requestLowerTimeframe(sctx, nested, dataEnd);
    state = { sctx, root: sctx.frame, next: 0, results: [] };
    frame.state.set(stateKey, state);
  }
  const { sctx } = state;
  const start = ctx.bars.time[ctx.i];
  const nextBarTime = ctx.i < ctx.lastIndex ? ctx.bars.time[ctx.i + 1] : Infinity;
  const end = Math.min(isNa(ctx.bars.timeClose[ctx.i]) ? nextBarTime : ctx.bars.timeClose[ctx.i], nextBarTime);
  // Intrabars the script skipped (it did not call the request on their chart bar) still run, in order,
  // so state inside the requested expression stays continuous; only this bar's intrabars are returned.
  const collected = [];
  sctx.mainLocals = ctx.mainLocals;
  sctx.mainFrame = ctx.mainFrame;
  while (state.next <= sctx.lastIndex && sctx.bars.time[state.next] < end) {
    const index = state.next++;
    sctx.i = index;
    sctx.frame = state.root;
    state.root.exec = index;
    sctx.flow = 0;
    const value = request.evaluate(sctx);
    if (sctx.bars.time[index] >= start) collected.push(value);
  }
  if (!request.tupleSize) return collected;
  return Array.from({ length: request.tupleSize }, (_, item) => collected.map(values => values[item]));
}

export class RunResult {
  constructor(ctx) { this.ctx = ctx; }
  get bars() { return this.ctx.bars; }
  get lastIndex() { return this.ctx.lastIndex; }
  live(kind) { return this.ctx.drawings.live(kind); }
  all(kind) { return this.ctx.drawings.all[kind]; }
  plot(title) { return this.ctx.plots.get(title)?.values ?? []; }
  get alerts() { return this.ctx.alerts; }
  get inputs() { return this.ctx.inputRecords; }

  // Reads a top-level Pine variable as it stood after the last bar.
  global(name) {
    const slot = this.ctx.program.mainScope.names.get(name);
    if (!slot) throw new Error(`no top-level variable ${name}`);
    return slot.persistent ? this.ctx.mainFrame.vars[slot.index] : this.ctx.mainLocals[slot.index];
  }

  // Converts a drawing x coordinate to a timestamp: bar_time values pass through, bar_index
  // values map through the chart's bars (indices past the last bar stay as indices).
  xTime(x, xloc) {
    if (isNa(x)) return NaN;
    if (xloc === 'xloc.bar_time') return x;
    const index = Math.round(x);
    return index <= this.lastIndex && index >= 0 ? this.bars.time[index] : NaN;
  }
}
