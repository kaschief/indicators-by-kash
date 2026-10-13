// Synthetic CME futures market: one-minute candles on the Globex schedule (Sunday 18:00 to
// Friday 17:00 New York, with the 17:00–18:00 maintenance break), plus the aggregations
// TradingView builds from it: time-based bars, Range bars and higher-timeframe periods.

import { localParts, zonedTimestamp } from './timezone.mjs';
import { normalizeTimeframe } from './builtins.mjs';

export const NY = 'America/New_York';
const MINUTE = 60_000;
const SESSION_START_MINUTE = 18 * 60;
const SESSION_END_MINUTE = 17 * 60;

export const nyTime = (year, month, day, hour = 0, minute = 0) => zonedTimestamp(NY, year, month, day, hour, minute);

export function isGlobexOpen(time) {
  const parts = localParts(time, NY);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const day = parts.dayOfWeek;
  if (day === 7) return false;
  if (day === 1) return minuteOfDay >= SESSION_START_MINUTE;
  if (day === 6) return minuteOfDay < SESSION_END_MINUTE;
  return minuteOfDay < SESSION_END_MINUTE || minuteOfDay >= SESSION_START_MINUTE;
}

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

const roundToTick = (price, tick) => Math.round(price / tick) * tick;

// `shape(time, price)` may return a price target that the walk is pulled to, letting tests
// place highs and lows at chosen New York times.
export function minuteCandles({ start, end, seed = 7, basePrice = 20000, tick = 0.25, volatility = 24, shape = null }) {
  const random = seededRandom(seed);
  const candles = [];
  let price = basePrice;
  for (let time = start; time < end; time += MINUTE) {
    if (!isGlobexOpen(time)) continue;
    const open = price;
    const target = shape ? shape(time, price) : null;
    const drift = target === null || target === undefined ? (random() - 0.5) * volatility : target - open;
    const close = roundToTick(open + drift, tick);
    const high = roundToTick(Math.max(open, close) + random() * volatility * 0.4, tick);
    const low = roundToTick(Math.min(open, close) - random() * volatility * 0.4, tick);
    candles.push({ time, open, high, low, close, volume: 100 + Math.floor(random() * 900) });
    price = close;
  }
  return candles;
}

function tradingDate(time) {
  const parts = localParts(time + 6 * 3_600_000, NY);
  return { year: parts.year, month: parts.month, day: parts.day, dayOfWeek: parts.dayOfWeek };
}

function sessionStartOf(date) {
  return nyTime(date.year, date.month, date.day - 1, 18, 0);
}

export class Market {
  constructor(candles, { symbol } = {}) {
    this.candles = candles;
    this.symbol = symbol;
    this.cache = new Map();
  }

  tradingDay(time) {
    const date = tradingDate(time);
    return Date.UTC(date.year, date.month - 1, date.day);
  }

  periodStart(tf, time) {
    const normalized = normalizeTimeframe(tf, '1');
    const match = /^(\d+)([SDWM]?)$/.exec(normalized);
    const multiplier = Number(match[1]);
    const date = tradingDate(time);
    const dayStart = sessionStartOf(date);
    switch (match[2]) {
      case '': return dayStart + Math.floor((time - dayStart) / (multiplier * MINUTE)) * multiplier * MINUTE;
      case 'S': return Math.floor(time / (multiplier * 1000)) * multiplier * 1000;
      case 'D': return dayStart;
      case 'W': {
        const offset = date.dayOfWeek === 1 ? 0 : date.dayOfWeek - 2;
        return sessionStartOf({ year: date.year, month: date.month, day: date.day - offset });
      }
      case 'M': {
        const firstMonth = date.month - ((date.month - 1) % multiplier);
        let day = 1;
        for (;; day++) {
          const weekday = new Date(Date.UTC(date.year, firstMonth - 1, day)).getUTCDay();
          if (weekday >= 1 && weekday <= 5) break;
        }
        return sessionStartOf({ year: date.year, month: firstMonth, day });
      }
      default: throw new Error(`unsupported timeframe ${tf}`);
    }
  }

  periodEnd(tf, time) {
    const normalized = normalizeTimeframe(tf, '1');
    const match = /^(\d+)([SDWM]?)$/.exec(normalized);
    const start = this.periodStart(tf, time);
    const date = tradingDate(time);
    switch (match[2]) {
      case 'S': return start + Number(match[1]) * 1000;
      case '': {
        const sessionClose = nyTime(date.year, date.month, date.day, 17, 0);
        return Math.min(start + Number(match[1]) * MINUTE, sessionClose);
      }
      case 'D': return nyTime(date.year, date.month, date.day, 17, 0);
      case 'W': {
        const daysToFriday = 6 - date.dayOfWeek;
        return nyTime(date.year, date.month, date.day + daysToFriday, 17, 0);
      }
      case 'M': {
        const multiplier = Number(match[1]);
        const lastMonth = date.month - ((date.month - 1) % multiplier) + multiplier - 1;
        let day = new Date(Date.UTC(date.year, lastMonth, 0)).getUTCDate();
        for (;; day--) {
          const weekday = new Date(Date.UTC(date.year, lastMonth - 1, day)).getUTCDay();
          if (weekday >= 1 && weekday <= 5) break;
        }
        return nyTime(date.year, lastMonth, day, 17, 0);
      }
      default: throw new Error(`unsupported timeframe ${tf}`);
    }
  }

  // Time bars from candles before `until`. The bar holding `until` is partial when it is cut.
  timeBars(tf, until = Infinity, from = -Infinity) {
    const key = `${tf}|${until}|${from}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const bars = { time: [], timeClose: [], open: [], high: [], low: [], close: [], volume: [], partialLast: false };
    let currentStart = NaN;
    const seconds = /S$/.test(normalizeTimeframe(tf, '1'));
    for (const candle of seconds ? this.secondCandles(tf) : this.candles) {
      if (candle.time >= until) break;
      if (candle.time < from) continue;
      const start = this.periodStart(tf, candle.time);
      if (start !== currentStart) {
        currentStart = start;
        bars.time.push(start);
        bars.timeClose.push(this.periodEnd(tf, candle.time));
        bars.open.push(candle.open);
        bars.high.push(candle.high);
        bars.low.push(candle.low);
        bars.close.push(candle.close);
        bars.volume.push(candle.volume);
      } else {
        const last = bars.time.length - 1;
        bars.high[last] = Math.max(bars.high[last], candle.high);
        bars.low[last] = Math.min(bars.low[last], candle.low);
        bars.close[last] = candle.close;
        bars.volume[last] += candle.volume;
      }
    }
    const last = bars.time.length - 1;
    bars.partialLast = last >= 0 && Number.isFinite(until) && bars.timeClose[last] > until;
    this.cache.set(key, bars);
    return bars;
  }

  // Seconds candles, cut from each minute along its open → nearer extreme → farther extreme → close path.
  secondCandles(tf) {
    const step = Number(/^(\d+)/.exec(normalizeTimeframe(tf, '1'))[1]);
    if (60 % step !== 0) throw new Error(`seconds timeframe ${tf} must divide a minute`);
    const key = `seconds|${step}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const pieces = 60 / step;
    const result = [];
    for (const candle of this.candles) {
      const path = candle.close >= candle.open
        ? [candle.open, candle.low, candle.high, candle.close]
        : [candle.open, candle.high, candle.low, candle.close];
      const at = fraction => {
        const position = fraction * 3;
        const leg = Math.min(2, Math.floor(position));
        return path[leg] + (path[leg + 1] - path[leg]) * (position - leg);
      };
      for (let piece = 0; piece < pieces; piece++) {
        const open = at(piece / pieces);
        const close = at((piece + 1) / pieces);
        const turns = [1 / 3, 2 / 3].filter(turn => turn > piece / pieces && turn < (piece + 1) / pieces).map(at);
        result.push({
          time: candle.time + piece * step * 1000, open, close,
          high: Math.max(open, close, ...turns), low: Math.min(open, close, ...turns), volume: candle.volume / pieces,
        });
      }
    }
    this.cache.set(key, result);
    return result;
  }

  // Range bars: every bar spans exactly `size` points from low to high. Each candle is walked
  // open → nearer extreme → farther extreme → close; bars that form inside one minute get
  // evenly spaced timestamps within it. A closed bar's time_close is the next bar's open time
  // and the forming last bar has none.
  rangeBars(size, until = Infinity, from = -Infinity) {
    const key = `range|${size}|${until}|${from}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const bars = { time: [], timeClose: [], open: [], high: [], low: [], close: [], volume: [], partialLast: true };
    let current = null;
    const start = (time, price) => {
      current = { time, open: price, high: price, low: price, close: price, volume: 0 };
    };
    const finish = closeTime => {
      bars.time.push(current.time);
      bars.timeClose.push(closeTime);
      for (const field of ['open', 'high', 'low', 'close', 'volume']) bars[field].push(current[field]);
    };
    for (const candle of this.candles) {
      if (candle.time >= until) break;
      if (candle.time < from) continue;
      const path = candle.close >= candle.open
        ? [candle.open, candle.low, candle.high, candle.close]
        : [candle.open, candle.high, candle.low, candle.close];
      const legs = [];
      let total = 0;
      for (let i = 1; i < path.length; i++) { const length = Math.abs(path[i] - path[i - 1]); legs.push(length); total += length; }
      let travelled = 0;
      if (!current) start(candle.time, candle.open);
      current.volume += candle.volume;
      for (let leg = 0; leg < legs.length; leg++) {
        const from = path[leg];
        const to = path[leg + 1];
        const direction = Math.sign(to - from);
        let price = from;
        while (direction !== 0 && price !== to) {
          const limit = direction > 0 ? current.low + size : current.high - size;
          const next = direction > 0 ? Math.min(to, limit) : Math.max(to, limit);
          travelled += Math.abs(next - price);
          price = next;
          current.high = Math.max(current.high, price);
          current.low = Math.min(current.low, price);
          current.close = price;
          if (price === limit && current.high - current.low >= size) {
            const at = candle.time + Math.min(MINUTE - 1, Math.floor((total ? travelled / total : 1) * (MINUTE - 1)));
            const closeTime = Math.max(at, current.time + 1);
            finish(closeTime);
            start(closeTime, price);
          }
        }
      }
    }
    if (current) finish(NaN);
    this.cache.set(key, bars);
    return bars;
  }

  // Times TradingView would assign to bars after the last one on a time chart.
  futureTimeBarTime(tf, lastTime, count) {
    const step = Number(normalizeTimeframe(tf, '1')) * MINUTE;
    let time = lastTime;
    for (let produced = 0; produced < count;) {
      time += step;
      if (isGlobexOpen(time)) produced++;
    }
    return time;
  }
}
