// Scenario helpers shared by indicator behavior suites: a cached CME market with optional
// flat stretches (to control when Range bars form) and readers that turn drawing handles
// into what a trader sees: where a zone starts and ends on the chart.

import { Market, minuteCandles, nyTime } from './market.mjs';
import { isNa } from './values.mjs';
import { formatNy } from './run.mjs';

export { nyTime, formatNy };

const markets = new Map();

// History starts months before the test week so every lookback (100 Daily sessions) is full.
export function cmeMarket({ start = nyTime(2026, 4, 5, 18), end = nyTime(2026, 10, 10, 17), seed = 7, flat = [] } = {}) {
  const key = JSON.stringify({ start, end, seed, flat });
  if (!markets.has(key)) {
    const shape = flat.length ? (time, price) => (flat.some(([from, to]) => time >= from && time < to) ? price : null) : null;
    markets.set(key, new Market(minuteCandles({ start, end, seed, shape })));
  }
  return markets.get(key);
}

export const isLive = object => !isNa(object) && object && !object.deleted;

// Chart position of a drawing edge: a timestamp for bar_time drawings and for bar_index
// drawings on existing bars; `{ barsPastLast }` for bar_index drawings projected past the last bar.
export function edge(result, object, key) {
  const x = object[key];
  if (object.xloc === 'xloc.bar_time') return { time: x };
  if (x > result.lastIndex) return { barsPastLast: x - result.lastIndex, index: x };
  return { time: result.bars.time[x], index: x };
}
