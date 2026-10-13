import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const host = readFileSync(new URL('../code/legilimens.pine', import.meta.url), 'utf8');
const orchestration = readFileSync(new URL('../code/libraries/legilimens-profile-orchestration-library.pine', import.meta.url), 'utf8');
const nyClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});
const parts = value => Object.fromEntries(nyClock.formatToParts(value).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
const timestamp = (zone, yr, mo, day, hr, min) => {
  const target = Date.UTC(yr, mo - 1, day, hr, min);
  let result = target;
  for (let attempt = 0; attempt < 3; attempt++) {
    const p = parts(result);
    result += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return result;
};
const context = vm.createContext({
  NY_TIMEZONE: 'America/New_York', START_TIME_UNSET: -1,
  year: value => parts(value).year, month: value => parts(value).month,
  dayofmonth: value => parts(value).day, hour: value => parts(value).hour,
  minute: value => parts(value).minute, timestamp, int: Math.trunc, math: Math, na: value => value == null,
  dayofweek: Object.assign(value => {
    const p = parts(value);
    return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 1;
  }, { monday: 2, friday: 6 }),
  array: { from: (...values) => values, binary_search: (values, key) => values.indexOf(key) },
});

// Execute the straight-line Pine date predicates with NY calendar adapters; this is not Pine compilation.
const compile = (source, name, alias = name) => {
  const match = source.match(new RegExp(`^(?:export )?${name}\\(([^\\n]*)\\) =>\\n((?:[ \\t]+[^\\n]*\\n|\\n)+)`, 'm'));
  assert.ok(match, `Missing function ${name}`);
  const parameters = match[1].replace(/\b(?:int|bool|string)\s+/g, '');
  const lines = match[2].trim().split('\n');
  lines[lines.length - 1] = `return ${lines.at(-1).trim()};`;
  const body = lines.join('\n')
    .replace(/\bvar array<int>\s+/g, 'const ')
    .replace(/\b(?:int|bool)\s+(\w+)\s*=/g, 'const $1 =')
    .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!');
  vm.runInContext(`function ${alias}(${parameters}) { ${body} }`, context);
};
for (const name of ['isNyWeekdayValue', 'nySessionStartBoundaryValue', 'nySessionEndBoundaryValue', 'inNyMinuteWindowValue']) compile(orchestration, name);
compile(orchestration, 'nySessionStartBoundary', 'nySessionStartBoundary');
compile(orchestration, 'nySessionEndBoundary', 'nySessionEndBoundary');
compile(orchestration, 'inNyMinuteWindow', 'inNyMinuteWindow');
compile(orchestration, 'isNySessionTradingDay');
compile(orchestration, 'barFitsNyMinuteWindow');
for (const name of ['FOMC_END_MINUTE', 'FOMC_EXTENDED_END_MINUTE', 'NY_AFTERNOON_START_MINUTE', 'ALL_DAY_TO_AFTERNOON_START_MINUTE', 'AFTERNOON_END_MINUTE']) {
  const expression = host.match(new RegExp(`^const int ${name} = (.+)$`, 'm'))?.[1];
  assert.ok(expression, `Missing ${name}`);
  context[name] = vm.runInContext(expression, context);
}
for (const name of ['fomcDecisionDateAllowed', 'nySessionDayAllowed', 'activeNySessionStart', 'boundedNySessionStart', 'fomcCutoffMinute']) compile(host, name);

const active = (instant, { extended = false, forceOn = false, crypto = false, enabled = true } = {}) =>
  context.activeNySessionStart(Date.parse(instant), enabled, 1080, context.fomcCutoffMinute(extended), crypto, !forceOn);

test('historical winter, summer and Thursday decisions include the prior evening', () => {
  for (const [evening, nextMorning] of [
    ['2021-01-26T18:00:00-05:00', '2021-01-27T09:00:00-05:00'],
    ['2025-07-29T18:00:00-04:00', '2025-07-30T09:00:00-04:00'],
    ['2024-11-06T18:00:00-05:00', '2024-11-07T09:00:00-05:00'],
  ]) {
    assert.equal(active(evening), Date.parse(evening));
    assert.equal(active(nextMorning), Date.parse(evening));
    assert.equal(active(new Date(Date.parse(evening) - 60_000).toISOString()), -1);
  }
});

test('both endpoints are exclusive while the final minute remains included', () => {
  assert.notEqual(active('2026-09-16T13:44:00-04:00'), -1);
  assert.equal(active('2026-09-16T13:45:00-04:00'), -1);
  assert.notEqual(active('2026-09-16T13:45:00-04:00', { extended: true }), -1);
  assert.notEqual(active('2026-09-16T14:14:00-04:00', { extended: true }), -1);
  assert.equal(active('2026-09-16T14:15:00-04:00', { extended: true }), -1);
});

test('ordinary dates and notation votes do not create FOMC profiles, including crypto', () => {
  for (const instant of ['2026-09-15T09:00:00-04:00', '2026-09-16T18:00:00-04:00', '2025-08-22T09:00:00-04:00']) {
    assert.equal(active(instant), -1);
    assert.equal(active(instant, { crypto: true }), -1);
  }
});

test('Force On bypasses the calendar but preserves selection and session boundaries', () => {
  assert.notEqual(active('2026-09-17T09:00:00-04:00', { forceOn: true }), -1);
  assert.notEqual(active('2030-01-09T09:00:00-05:00', { forceOn: true }), -1);
  assert.equal(active('2026-09-17T13:45:00-04:00', { forceOn: true }), -1);
  assert.equal(active('2026-09-17T09:00:00-04:00', { forceOn: true, enabled: false }), -1);
});

test('announced future dates work and unknown future dates stay disabled', () => {
  assert.notEqual(active('2027-06-09T09:00:00-04:00'), -1);
  assert.notEqual(active('2028-01-26T09:00:00-05:00'), -1);
  assert.equal(active('2030-01-09T09:00:00-05:00'), -1);
});

test('the registry is sorted and unique for binary search', () => {
  const dates = [...host.match(/decisionDates = array\.from\(([\s\S]*?)\)/)[1].matchAll(/\d{8}/g)].map(match => Number(match[0]));
  assert.equal(dates.length, 57);
  assert.deepEqual(dates, [...new Set(dates)].sort((a, b) => a - b));
});

test('sample routing and live state share the override; the overnight profile stays daily', () => {
  assert.match(host, /fomcSamples = selectNySessionSamples\([^\n]+not fomcForceOn, fomcSampleSessionStarts\)/);
  assert.match(host, /fomcCurrentSessionStart = activeNySessionStart\([^\n]+not fomcForceOn\)/);
  assert.match(host, /nySessionDayAllowed\(sampleStartTime, startMinute, endMinute, twentyFourSeven, fomcOnly\)/);
  assert.match(host, /overnightNineSamples = selectNySessionSamples\([^\n]+false, overnightNineSampleSessionStarts\)/);
  assert.match(host, /fomcForceOn = input\.bool\(false, "Force On"/);
  assert.match(host, /fomcEndMinute = fomcCutoffMinute\(fomcExtended\)/);
});

for (const [name, prefix, startConstant, startClock, beforeStart, straddlingStart] of [
  ['NY Afternoon', 'nyAfternoon', 'NY_AFTERNOON_START_MINUTE', '09:30:00', '09:29:00', ['09:00:00', '10:00:00']],
  ['All Day to Afternoon', 'allDayToAfternoon', 'ALL_DAY_TO_AFTERNOON_START_MINUTE', '06:00:00', '05:59:00', ['05:30:00', '06:30:00']],
]) {
  test(`${name} includes its opening, excludes 13:30, and follows New York DST`, () => {
    const start = context[startConstant], end = context.AFTERNOON_END_MINUTE;
    assert.equal(start, startClock === '06:00:00' ? 360 : 570);
    assert.equal(end, 810);
    for (const [day, offset] of [['2026-01-15', '-05:00'], ['2026-07-15', '-04:00']]) {
      const at = clock => Date.parse(day + 'T' + clock + offset);
      const activeSession = clock => context.activeNySessionStart(at(clock), true, start, end, false, false);
      assert.equal(activeSession(beforeStart), -1);
      assert.equal(activeSession(startClock), at(startClock));
      assert.equal(activeSession('13:29:00'), at(startClock));
      assert.equal(activeSession('13:30:00'), -1);
      assert.equal(context.nySessionEndBoundary(at(startClock), start, end), at('13:30:00'));
      assert.equal(context.barFitsNyMinuteWindow(at('13:29:00'), at('13:30:00'), start, end), true);
      assert.equal(context.barFitsNyMinuteWindow(at('13:30:00'), at('13:31:00'), start, end), false);
      assert.equal(context.barFitsNyMinuteWindow(at(straddlingStart[0]), at(straddlingStart[1]), start, end), false);
      assert.equal(context.barFitsNyMinuteWindow(at('13:00:00'), at('14:00:00'), start, end), false);
    }
  });

  test(`${name} runs on weekdays and daily for 24/7 assets without an FOMC date filter`, () => {
    const start = context[startConstant], end = context.AFTERNOON_END_MINUTE;
    const activeSession = (date, crypto, enabled = true) => context.activeNySessionStart(Date.parse(date + 'T10:00:00-04:00'), enabled, start, end, crypto, false);
    assert.notEqual(activeSession('2026-09-23', false), -1);
    for (const date of ['2026-09-26', '2026-09-27']) {
      assert.equal(activeSession(date, false), -1);
      assert.notEqual(activeSession(date, true), -1);
    }
    assert.equal(activeSession('2026-09-23', false, false), -1);
  });

  test(`${name} sampling, lifecycle and selection share its session boundaries`, () => {
    assert.ok(host.includes(`${prefix}Samples = selectNySessionSamples(barSamples, ${prefix}ModeActive, ${startConstant}, AFTERNOON_END_MINUTE, isTwentyFourSevenAsset, false, ${prefix}SampleSessionStarts)`));
    assert.ok(host.includes(`${prefix}CurrentSessionStart = activeNySessionStart(sessionClockTime, ${prefix}ModeActive, ${startConstant}, AFTERNOON_END_MINUTE, isTwentyFourSevenAsset, false)`));
    assert.ok(host.includes(`processKeyedBoundedNyAnchor(${prefix}Anchor, ${prefix}ModeActive, sessionProfileRetention, ${startConstant}, AFTERNOON_END_MINUTE, ${prefix}InSession, ${prefix}CurrentSessionStart, ${prefix}SampleSessionStarts, ${prefix}Samples.endTimes, ${prefix}Samples,`));
    assert.ok(host.includes(`selectSessionProfiles(priorProfilesToShow, ${prefix}InSession, legilimensPresentation.developingProfileVisible(${prefix}PresentationSource, presentationConfig), ${prefix}Anchor, keyedNoSamples, false, ${prefix}Anchor.lastBarTime)`));
  });
}

test('empty NY session bars use New York boundaries through DST and exclude closed weekdays', () => {
  for (const [startMinute, endMinute] of [[360, 540], [360, 575], [570, 630]]) {
    for (const [date, offset] of [['2026-03-06', '-05:00'], ['2026-03-09', '-04:00'], ['2026-11-02', '-05:00']]) {
      const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
      const startTime = Date.parse(`${date}T${clock(startMinute)}${offset}`);
      const endTime = Date.parse(`${date}T${clock(endMinute)}${offset}`);
      const resolve = instant => context.boundedNySessionStart(instant, true, false, null, startMinute, endMinute, false);
      assert.equal(resolve(startTime - 1), -1);
      assert.equal(resolve(startTime), startTime);
      assert.equal(resolve(endTime - 1), startTime);
      assert.equal(resolve(endTime), -1);
    }
  }
  const saturday = Date.parse('2026-09-05T07:00:00-04:00');
  assert.equal(context.boundedNySessionStart(saturday, true, false, null, 360, 540, false), -1);
  assert.equal(context.boundedNySessionStart(saturday, true, false, null, 360, 540, true), Date.parse('2026-09-05T06:00:00-04:00'));
});

test('session clock follows the replay candle instead of the wall clock', () => {
  const body = host.match(/^candleClockTime\(\) =>\n\s+(.+)$/m)?.[1];
  assert.ok(body, 'Missing candleClockTime');
  assert.ok(!host.includes('str.contains(syminfo.tickerid, "replay")'));
  const expression = body.replace(/\bna\(/g, 'isNa(');
  const clock = (state) => vm.runInNewContext(expression, {
    ...state, barstate: { isrealtime: state.realtime }, isNa: value => value == null,
    math: Math, nz: (value, fallback) => value ?? fallback,
  });
  const open = Date.parse('2025-01-29T13:40:00-05:00');
  const close = open + 5 * 60_000;
  assert.equal(clock({ realtime: false, time: open, time_close: close, timenow: 0 }), close);
  assert.equal(clock({ realtime: true, time: open, time_close: close, timenow: open + 60_000 }), open + 60_000);
  assert.equal(clock({ realtime: true, time: open, time_close: close, timenow: open - 3_600_000 }), open);
  assert.equal(clock({ realtime: true, time: open, time_close: close, timenow: Date.parse('2026-10-07T16:00:00-04:00') }), close);
  assert.equal(clock({ realtime: true, time: open, time_close: null, timenow: open + 60_000 }), open + 60_000);
  for (const name of ['fomc', 'overnightNine', 'nyAfternoon', 'allDayToAfternoon']) {
    assert.ok(host.includes(`${name}CurrentSessionStart = activeNySessionStart(sessionClockTime, `), name);
  }
});
