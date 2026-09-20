import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const host = readFileSync(new URL('../indicators/21-legilimens/code/legilimens.pine', import.meta.url), 'utf8');
const orchestration = readFileSync(new URL('../indicators/21-legilimens/code/libraries/legilimens-profile-orchestration-library.pine', import.meta.url), 'utf8');
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
  minute: value => parts(value).minute, timestamp, int: Math.trunc, math: Math,
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
for (const name of ['FOMC_END_MINUTE', 'FOMC_EXTENDED_END_MINUTE']) {
  const expression = host.match(new RegExp(`^const int ${name} = (.+)$`, 'm'))?.[1];
  assert.ok(expression, `Missing ${name}`);
  context[name] = vm.runInContext(expression, context);
}
for (const name of ['fomcDecisionDateAllowed', 'nySessionDayAllowed', 'activeNySessionStart', 'fomcCutoffMinute']) compile(host, name);

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
