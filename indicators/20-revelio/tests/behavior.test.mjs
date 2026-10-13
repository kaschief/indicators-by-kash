import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { loadIndicator, loadLibraryFolder, runIndicator } from '../../../tests/runtime/run.mjs';
import { Market, minuteCandles } from '../../../tests/runtime/market.mjs';
import { cmeMarket, nyTime, formatNy } from '../../../tests/runtime/scenario.mjs';

// Runs revelio.pine (with its local libraries) bar by bar on synthetic NQ data and checks what the
// chart would show. These pin approved behavior; they do not prove TradingView compilation or rendering.

const code = new URL('../code/', import.meta.url).pathname;
const libraries = loadLibraryFolder(['core', 'gaps', 'interactions', 'profile-orchestration'].map(name => `${code}libraries/revelio-${name}-library.pine`));
const program = loadIndicator(`${code}indicator/revelio.pine`, { libraries });

const MINUTE = 60_000;
const DAY = 86_400_000;
const TICK = 0.25;
const market = cmeMarket();
const candles = market.candles;

// Thursday 8 October 2026 is the test day. Touch Markers for hidden Weekly/Monthly/Quarterly anchors
// are switched off unless a test needs them: they add a full-history Quarterly request.
const day = (hour, minute = 0, date = 8) => nyTime(2026, 10, date, hour, minute);
const NOW = day(11);
const LEAN = { levelHitIncludeAllAnchors: false };
const ALL_ANCHORS = '● ● ● ● ● Quarterly + Monthly + Weekly + Globex + RTH';

const runs = new Map();
function revelio({ chart = '15', days = 8, at = NOW, mode = 'live', inputs = {}, market: chartMarket = market } = {}) {
  const key = JSON.stringify({ chart, days, at, mode, inputs, scripted: chartMarket !== market });
  if (!runs.has(key)) {
    const chartSpec = chart.startsWith('R') ? { type: 'range', size: Number(chart.slice(1)) * TICK } : { type: 'time', tf: chart };
    runs.set(key, runIndicator(program, { market: chartMarket, chart: chartSpec, from: at - days * DAY, until: at, mode, inputs: { ...LEAN, ...inputs } }));
  }
  return runs.get(key);
}
const base = () => revelio();

const ny = time => formatNy(time).slice(11, 16);
const rth = result => result.global('rthState').profiles;
const globex = result => result.global('globexState').profiles;
const levels = profile => ({ poc: profile.pocPrice, vah: profile.valueAreaHighPrice, val: profile.valueAreaLowPrice });
const summary = profile => ({ start: formatNy(profile.startTime), end: formatNy(profile.endTime), ...levels(profile) });
const rightEdgeLabels = result => result.live('label').filter(label => label.xloc === 'xloc.bar_index' && label.x === result.lastIndex + 20);
const touchMarkers = result => result.live('label').filter(label => label.text === '●');
const enumOption = (inputName, title) => base().inputs.get(inputName).options.find(option => option.title === title);

// Independent volume profile: 250 rows over the range, each one-minute candle's volume spread evenly
// over the rows it touches, value area grown from the POC towards the larger neighbour until 70%.
function referenceProfile(from, to, source = candles) {
  const samples = source.filter(candle => candle.time >= from && candle.time < to);
  const rows = 250;
  const high = Math.max(...samples.map(candle => candle.high));
  const low = Math.min(...samples.map(candle => candle.low));
  const span = Math.max(high - low, TICK * rows);
  const rowHeight = span / rows;
  const row = price => Math.max(0, Math.min(rows - 1, Math.floor((price - low) / rowHeight)));
  const volume = new Array(rows).fill(0);
  for (const candle of samples) {
    const first = row(candle.low);
    const last = row(candle.high);
    for (let index = first; index <= last; index++) volume[index] += candle.volume / (last - first + 1);
  }
  let poc = 0;
  for (let index = 1; index < rows; index++) if (volume[index] > volume[poc]) poc = index;
  const total = volume.reduce((sum, value) => sum + value, 0);
  let bottom = poc;
  let top = poc;
  let accumulated = volume[poc];
  while (accumulated < total * 0.7 && (bottom > 0 || top < rows - 1)) {
    const below = bottom > 0 ? volume[bottom - 1] : -1;
    const above = top < rows - 1 ? volume[top + 1] : -1;
    if (above >= below) accumulated += Math.max(volume[++top], 0);
    else accumulated += Math.max(volume[--bottom], 0);
  }
  return { poc: low + (poc + 0.5) * rowHeight, vah: low + (top + 1) * rowHeight, val: low + bottom * rowHeight, range: high - low };
}

const expectLevels = (actual, expected, what) => {
  for (const level of ['poc', 'vah', 'val']) assert.ok(Math.abs(actual[level] - expected[level]) < 1e-6, `${what} ${level}: ${actual[level]} vs ${expected[level]}`);
};

// The chart opens mid-session on 30 September, so the first RTH and Globex profiles are partial.
const fullRth = result => rth(result).filter(profile => ny(profile.startTime) === '09:30');
const firstTouch = (price, from, to) => candles.find(candle => candle.time >= from && candle.time < to && candle.low <= price && candle.high >= price)?.time;

describe('Revelio session profiles', () => {
  test('on 15m, RTH profiles run 09:30 to the 15:45 candle on each weekday and Globex runs 18:00 to 18:00', () => {
    const result = base();
    assert.deepEqual(fullRth(result).map(profile => `${formatNy(profile.startTime)} → ${ny(profile.endTime)}`), [
      '2026-10-01 09:30 NY → 15:45', '2026-10-02 09:30 NY → 15:45', '2026-10-05 09:30 NY → 15:45', '2026-10-06 09:30 NY → 15:45', '2026-10-07 09:30 NY → 15:45',
    ]);
    assert.deepEqual(globex(result).slice(1).map(profile => `${formatNy(profile.startTime)} → ${formatNy(profile.endTime)}`), [
      '2026-09-30 18:00 NY → 2026-10-01 18:00 NY',
      '2026-10-01 18:00 NY → 2026-10-04 18:00 NY',
      '2026-10-04 18:00 NY → 2026-10-05 18:00 NY',
      '2026-10-05 18:00 NY → 2026-10-06 18:00 NY',
      '2026-10-06 18:00 NY → 2026-10-07 18:00 NY',
    ]);
  });

  test('POC, VAH and VAL are the 70% value area of the one-minute volume, and each has its right-edge label', () => {
    const result = base();
    for (const profile of fullRth(result)) expectLevels(levels(profile), referenceProfile(profile.startTime, profile.startTime + 390 * MINUTE), `RTH ${formatNy(profile.startTime)}`);
    for (const profile of globex(result).slice(1)) expectLevels(levels(profile), referenceProfile(profile.startTime, profile.endTime), `Globex ${formatNy(profile.startTime)}`);
    const oct5 = fullRth(result).find(profile => formatNy(profile.startTime).startsWith('2026-10-05'));
    for (const [name, price] of [['POC', oct5.pocPrice], ['VAH', oct5.valueAreaHighPrice], ['VAL', oct5.valueAreaLowPrice]]) {
      assert.ok(rightEdgeLabels(result).some(label => label.y === price && label.text.includes(`R ${name} Oct 5 · 3d`)), `R ${name} Oct 5 labelled at ${price}`);
    }
  });

  test('a 1m chart builds the same RTH levels as 15m, ending on the 15:59 candle', () => {
    const oneMinute = revelio({ chart: '1', at: day(9, 45), days: 1 + 45 / 1440 });
    const oct7 = rth(oneMinute).find(profile => formatNy(profile.startTime) === '2026-10-07 09:30 NY');
    assert.equal(ny(oct7.endTime), '15:59');
    expectLevels(levels(oct7), levels(fullRth(base()).at(-1)), '1m vs 15m Oct 7');
  });

  test('labels name the previous session and count older sessions in trading days, skipping the weekend', () => {
    const texts = rightEdgeLabels(base()).map(label => label.text).join('\n');
    for (const part of ['[PREV RTH] POC', '[PREV GLOBEX] VAH', 'R VAH Oct 6 · 2d', 'R POC Oct 5 · 3d', 'R VAH Oct 2 · 4d', 'R POC Oct 1 · 5d', 'G VAH Oct 1 · 4d']) {
      assert.ok(texts.includes(part), `missing "${part}"`);
    }
  });

  test('Show Only dims every candle outside 09:30–16:00 New York', () => {
    const result = base();
    const hidden = result.plot('Hidden Candles');
    for (let index = 0; index <= result.lastIndex; index++) {
      const time = ny(result.bars.time[index]);
      const inRth = time >= '09:30' && time < '16:00';
      assert.equal(Number.isNaN(hidden[index]), inRth, `${formatNy(result.bars.time[index])} ${inRth ? 'visible' : 'dimmed'}`);
    }
  });
});

describe('Revelio settings', () => {
  test('RTH Only with Show Last 3 keeps the three latest RTH sessions and draws nothing from Globex', () => {
    const result = revelio({ inputs: { quickFilter: 'RTH Only', rthProfilesToShow: 3 } });
    assert.deepEqual(rth(result).map(profile => formatNy(profile.startTime)), ['2026-10-05 09:30 NY', '2026-10-06 09:30 NY', '2026-10-07 09:30 NY']);
    const texts = rightEdgeLabels(result).map(label => label.text);
    assert.ok(texts.length > 0);
    for (const text of texts) {
      assert.doesNotMatch(text, /GLOBEX|\bG (POC|VAH|VAL)/, text);
      assert.doesNotMatch(text, /Oct [12]\b|Sep/, text);
    }
  });

  // Developing RTH waits for asset classification, which needs a week of chart bars (672 on 15m).
  test('+RTH On shows today\'s developing levels from 09:30; Auto at 11:00 does not', () => {
    const on = revelio({ days: 10, inputs: { rthCurrentMode: enumOption('rthCurrentMode', 'On') } });
    const developing = referenceProfile(day(9, 30), NOW);
    for (const [name, price] of [['POC', developing.poc], ['VAH', developing.vah], ['VAL', developing.val]]) {
      assert.ok(rightEdgeLabels(on).some(label => Math.abs(label.y - price) < 1e-6 && label.text.includes(`★ R ${name}`)), `★ R ${name} at ${price}`);
    }
    assert.ok(!rightEdgeLabels(base()).some(label => label.text.includes('★ R')), 'Auto hides the immature RTH profile');
  });

  test('Session Only stops each completed RTH level at its session end with no right-edge label', () => {
    const result = revelio({ inputs: { quickFilter: 'RTH Only', rthExtensionMode: 'Session Only' } });
    const lines = result.live('line').filter(line => line.xloc === 'xloc.bar_time');
    for (const profile of rth(result)) {
      for (const price of Object.values(levels(profile))) {
        const line = lines.find(candidate => candidate.y1 === price);
        assert.ok(line, `line at ${price}`);
        assert.equal(`${formatNy(line.x1)} → ${formatNy(line.x2)}`, `${formatNy(profile.startTime)} → ${formatNy(profile.endTime)}`);
      }
    }
    assert.equal(rightEdgeLabels(result).length, 0);
  });
});

// A scripted market that forces every value-gap case. RTH sessions oscillate ±25 points around a
// centre; overnight the price moves between centres:
//   Sep 30 18000 → Oct 1 19000 → Oct 2 20000   two large bullish gaps
//   Sunday night dips to 17800 and returns       both gaps traded through, but only overnight
//   Oct 5 20000                                  overlapping value: no gap
//   Oct 6 20032                                  clears Oct 5 by under 5% of its range: ignored
//   Oct 7 19100                                  large bearish gap
//   Oct 8 10:00–10:20 rallies to 20100           trades through the bearish gap during RTH
const gapDay = (date, hour, minute = 0) => nyTime(2026, date > 15 ? 9 : 10, date, hour, minute);
const GAP_NOW = gapDay(8, 11, 30);
const GAP_SESSIONS = [[30], [1], [2], [5], [6], [7]].map(([date]) => gapDay(date, 9, 30));
const gapMarket = (() => {
  const path = [
    [gapDay(29, 18), 18000], [gapDay(30, 20), 18000], [gapDay(30, 22), 19000], [gapDay(1, 20), 19000], [gapDay(1, 22), 20000],
    [gapDay(4, 18), 20000], [gapDay(4, 20), 17800], [gapDay(5, 3), 20000], [gapDay(5, 20), 20000], [gapDay(5, 22), 20032],
    [gapDay(6, 20), 20032], [gapDay(6, 22), 19100], [gapDay(8, 10), 19100], [gapDay(8, 10, 20), 20100], [gapDay(9, 17), 20100],
  ];
  const target = time => {
    const next = path.findIndex(([keyTime]) => keyTime > time);
    const [fromTime, fromPrice] = path[next - 1];
    const [toTime, toPrice] = path[next];
    const minuteOfDay = Number(ny(time).slice(0, 2)) * 60 + Number(ny(time).slice(3));
    const swing = minuteOfDay >= 570 && minuteOfDay < 960 ? 25 * (1 - 2 * Math.abs((minuteOfDay % 30) / 15 - 1)) : 0;
    return Math.round((fromPrice + (toPrice - fromPrice) * (time - fromTime) / (toTime - fromTime) + swing) / TICK) * TICK;
  };
  return new Market(minuteCandles({ start: gapDay(29, 18), end: gapDay(9, 17), seed: 3, shape: target }));
})();
const gapCandles = gapMarket.candles;
const inFillWindow = time => ny(time) >= '08:30' && ny(time) < '16:00' && new Date(time).getUTCDay() % 6 !== 0;

// Gaps from the one-minute value areas of consecutive RTH sessions, and their fill candle: the first
// 15m candle by which prices traded 08:30–16:00 after the gap formed have reached both of its edges.
function expectedGaps() {
  const sessions = GAP_SESSIONS.map(start => ({ start, ...referenceProfile(start, start + 390 * MINUTE, gapCandles) }));
  const gaps = [];
  const ignored = [];
  for (let index = 1; index < sessions.length; index++) {
    const previous = sessions[index - 1];
    const current = sessions[index];
    const bullish = current.val - previous.vah >= TICK;
    const bearish = !bullish && previous.val - current.vah >= TICK;
    if (!bullish && !bearish) continue;
    const [top, bottom] = bullish ? [current.val, previous.vah] : [previous.val, current.vah];
    const gap = { start: current.start, formed: current.start + 375 * MINUTE, bullish, top, bottom };
    if ((top - bottom) / previous.range < 0.05) { ignored.push(gap); continue; }
    let low = Infinity;
    let high = -Infinity;
    const traded = gapCandles.filter(candle => candle.time >= gap.formed + 15 * MINUTE && candle.time < GAP_NOW && inFillWindow(candle.time));
    const through = traded.find(candle => { low = Math.min(low, candle.low); high = Math.max(high, candle.high); return low <= bottom && high >= top; });
    const crossedOvernight = gapCandles.some(candle => candle.time > gap.formed && candle.low <= bottom) && gapCandles.some(candle => candle.time > gap.formed && candle.high >= top);
    gaps.push({ ...gap, fill: through ? through.time - (through.time - gapDay(29, 18)) % (15 * MINUTE) : NaN, crossedOvernight });
  }
  return { gaps, ignored, sessions };
}

describe('Revelio value gaps on a scripted market', () => {
  const historical = hideFilledValueGaps => revelio({ market: gapMarket, at: GAP_NOW, days: GAP_NOW / DAY - gapDay(29, 18) / DAY, inputs: { valueGapDisplayMode: 'Historical', hideFilledValueGaps } });
  const gapBoxes = result => result.live('box').filter(box => box.xloc === 'xloc.bar_time');
  const outlineOf = (result, gap) => gapBoxes(result).find(box => box.left === gap.start && Math.abs(box.top - gap.top) < 1e-6 && Math.abs(box.bottom - gap.bottom) < 1e-6);
  const gapLabels = result => result.live('label').filter(label => label.text.includes('Value Gap'));
  const dateText = time => new Date(time - 4 * 3_600_000).toUTCString().replace(/^\w+, (\d+) (\w+) (\d+).*/, (_, d, m, y) => `${m} ${Number(d)}, ${y}`);

  test('a gap is drawn where a session\'s value area clears the prior one by 5% of its range; overlapping and smaller moves draw none', () => {
    const { gaps, ignored } = expectedGaps();
    assert.ok(gaps.some(gap => gap.bullish) && gaps.some(gap => !gap.bullish), 'bullish and bearish gaps');
    assert.equal(ignored.length, 1, 'one gap under 5%');
    assert.equal(gaps.length + ignored.length, GAP_SESSIONS.length - 2, 'one session overlaps the prior value area');
    const result = historical(false);
    for (const gap of gaps) assert.ok(outlineOf(result, gap), `gap from ${formatNy(gap.start)} drawn ${gap.bottom}–${gap.top}`);
    assert.deepEqual([...new Set(gapBoxes(result).map(box => formatNy(box.left)))].sort(), gaps.map(gap => formatNy(gap.start)).sort());
    assert.equal(gapLabels(result).length, gaps.length);
  });

  test('a gap fills when price trades through it 08:30–16:00 and is marked ✓ there; crossing it only overnight leaves it open', () => {
    const { gaps } = expectedGaps();
    const filled = gaps.filter(gap => !Number.isNaN(gap.fill));
    const open = gaps.filter(gap => Number.isNaN(gap.fill));
    assert.equal(filled.length, 1, 'one gap traded through during RTH');
    assert.ok(open.filter(gap => gap.crossedOvernight).length >= 2, 'gaps crossed only overnight');
    const result = historical(false);
    const openEdge = result.bars.time[result.lastIndex] + 3 * 15 * MINUTE;
    for (const gap of gaps) {
      const outline = outlineOf(result, gap);
      assert.equal(formatNy(outline.right), formatNy(Number.isNaN(gap.fill) ? openEdge : gap.fill), `gap from ${formatNy(gap.start)} right edge`);
      const label = gapLabels(result).find(candidate => candidate.text.endsWith(dateText(gap.formed)));
      assert.ok(label, `label for ${dateText(gap.formed)}`);
      assert.equal(label.text.startsWith('RTH Value Gap ✓'), !Number.isNaN(gap.fill), label.text);
    }
    const hidden = historical(true);
    for (const gap of filled) assert.ok(!outlineOf(hidden, gap), 'Hide Filled removes the filled gap');
    for (const gap of open) assert.ok(outlineOf(hidden, gap), 'Hide Filled keeps open gaps');
  });
});

describe('Revelio value gaps', () => {
  test('Floating Only (default) floats the newest open gap and the nearest other 150 bars right, 10 wide and 10 apart', () => {
    const result = base();
    const boxes = result.live('box');
    assert.ok(boxes.every(box => box.xloc === 'xloc.bar_index'), 'no historical gap boxes');
    const spans = boxes.map(box => `${box.left - result.lastIndex}→${box.right - result.lastIndex}`);
    assert.deepEqual([...new Set(spans)], ['150→160', '170→180']);
    const gapLabels = result.live('label').filter(label => label.text.includes('Value Gap')).map(label => [label.x - result.lastIndex, label.y, label.text]);
    assert.deepEqual(gapLabels, [[155, 22335.47, 'RTH Value Gap 57%\nOct 6, 2026'], [175, 22294.255, 'RTH Value Gap\nOct 5, 2026']]);
  });
});

describe('Revelio touch markers', () => {
  test('each marker sits on the 15m candle holding the first minute after 09:30 today that traded the level', () => {
    const result = base();
    const events = result.global('levelHitEvents');
    const retained = [...rth(result), ...globex(result)].flatMap(profile => Object.values(levels(profile)));
    assert.ok(events.length >= 4, `${events.length} touches`);
    for (const event of events) {
      assert.ok(retained.includes(event.price), `${event.price} is a retained level`);
      assert.equal(formatNy(event.hitTime), formatNy(firstTouch(event.price, day(9, 30), NOW)), `first touch of ${event.price}`);
      assert.equal(formatNy(event.barTime), formatNy(event.hitTime - (event.hitTime - day(9, 30)) % (15 * MINUTE)), 'marker candle');
    }
    const markers = touchMarkers(result);
    assert.ok(markers.length > 0);
    for (const marker of markers) {
      const event = events.find(candidate => candidate.barTime === marker.x && candidate.price === marker.y);
      assert.ok(event, `marker at ${formatNy(marker.x)} ${marker.y} has a touch`);
      assert.match(marker.tooltip, /\nHit \d\d:\d\d NY$/);
    }
    assert.ok(markers.some(marker => marker.tooltip === 'PREV RTH VAH ✓\nHit 09:47 NY'));
  });
});

describe('Revelio on Range charts (180R)', () => {
  test('RTH profiles start on the first Range candle opening 09:30–16:00 and touches are still marked', () => {
    const result = revelio({ chart: 'R180', days: 3 });
    const { time } = result.bars;
    for (const profile of rth(result).slice(1)) {
      const date = formatNy(profile.startTime).slice(0, 10);
      const firstInSession = time.find(barTime => formatNy(barTime).startsWith(date) && ny(barTime) >= '09:30');
      assert.equal(formatNy(profile.startTime), formatNy(firstInSession));
      assert.ok(ny(profile.endTime) >= '15:30' && ny(profile.endTime) < '16:00', `ends ${formatNy(profile.endTime)}`);
      assert.ok(profile.valueAreaLowPrice < profile.pocPrice && profile.pocPrice < profile.valueAreaHighPrice);
    }
    const events = result.global('levelHitEvents');
    assert.ok(events.length > 0 && touchMarkers(result).length > 0);
    for (const event of events) assert.ok(event.hitTime >= day(9, 30) && event.hitTime <= NOW, formatNy(event.hitTime));
  });
});

describe('Revelio in Bar Replay', () => {
  const profilesOf = result => [...rth(result), ...globex(result)].map(summary);
  const gapsOf = result => result.live('box').map(box => [box.xloc, box.left, box.right, box.top, box.bottom]);

  test('replaying 11:00 on 15m shows the same profiles, gaps, labels and touch markers as live', () => {
    const live = base();
    const replay = revelio({ mode: 'replay' });
    assert.deepEqual(profilesOf(replay), profilesOf(live));
    assert.deepEqual(gapsOf(replay), gapsOf(live));
    assert.deepEqual(replay.live('label').map(label => label.text).sort(), live.live('label').map(label => label.text).sort());
    assert.deepEqual(touchMarkers(replay).map(marker => marker.tooltip), touchMarkers(live).map(marker => marker.tooltip));
  });

  test('replaying 11:00 on 180R keeps the live profiles and gaps', () => {
    const live = revelio({ chart: 'R180', days: 3 });
    const replay = revelio({ chart: 'R180', days: 3, mode: 'replay' });
    assert.deepEqual(profilesOf(replay), profilesOf(live));
    assert.deepEqual(gapsOf(replay), gapsOf(live));
  });
});

describe('Revelio drawing budget', () => {
  test('on 60m with all five anchors, histograms, boxes, prices and every gap view, nothing is silently dropped', () => {
    const result = revelio({
      chart: '60', days: 30,
      inputs: {
        levelHitIncludeAllAnchors: true, quickFilter: ALL_ANCHORS, quickPriceMode: 'Active', valueGapDisplayMode: 'Historical + Floating', hideFilledValueGaps: false,
        upcomingValueGapEnabled: true, valueGapShowInternalReminders: true, levelHitHistory: '1 Week',
        rthShowSessionBox: true, globexShowSessionBox: true, weeklyShowSessionBox: true, monthlyShowSessionBox: true, quarterlyShowSessionBox: true,
      },
    });
    for (const [kind, limit] of [['box', 500], ['line', 500], ['label', 500], ['polyline', 100]]) {
      const dropped = result.all(kind).filter(object => object.garbageCollected);
      assert.equal(dropped.length, 0, `${dropped.length} ${kind}s dropped by the ${kind} limit`);
      assert.ok(result.live(kind).length <= limit);
    }
    const texts = rightEdgeLabels(result).map(label => label.text).join('\n');
    for (const token of ['R POC', 'G POC', 'W POC', '[LAST MONTH] POC', '[LAST QUARTER] POC']) assert.ok(texts.includes(token), `${token} drawn on 60m`);
    assert.ok(result.live('polyline').length > 0, 'histograms drawn');
  });
});
