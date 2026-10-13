import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../code/pulse.pine', import.meta.url), 'utf8');
const toJavaScript = expression => expression.replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/\bnot\b/g, '!');
const assignment = name => {
  const match = source.match(new RegExp(`^\\s*${name} = (.+)$`, 'm'));
  assert.ok(match, name);
  return toJavaScript(match[1].split(' //')[0]);
};
const evaluate = (expression, values) => new Function(...Object.keys(values), `return ${expression};`)(...Object.values(values));
const weeklyReset = values => evaluate(assignment('weekly_reset_trigger'), values);

// Source-expression and lifecycle fixtures; these do not compile Pine or execute TradingView charts.
for (const includeSundayEvening of [false, true]) {
  test(`BTC calendar weeks complete with Include Sunday Evening=${includeSundayEvening}`, () => {
    const values = { is247Asset: true, includeSundayEvening, is_new_trading_week: false };
    assert.equal(weeklyReset({ ...values, is_new_weekly_bar: false }), false);
    assert.equal(weeklyReset({ ...values, is_new_weekly_bar: true }), true);
  });
}

test('traditional markets retain the selected Sunday or calendar week boundary', () => {
  for (const includeSundayEvening of [false, true]) {
    for (const is_new_trading_week of [false, true]) {
      for (const is_new_weekly_bar of [false, true]) {
        assert.equal(weeklyReset({ is247Asset: false, includeSundayEvening, is_new_trading_week, is_new_weekly_bar }),
          includeSundayEvening ? is_new_trading_week : is_new_weekly_bar);
      }
    }
  }
});

test('the Weekly collection block stores BTC high/low and anchors before resetting', () => {
  const block = source.match(/^    \/\/ Weekly\n([\s\S]*?)(?=^    if is_new_monthly_bar)/m)?.[1];
  assert.ok(block);
  const translated = block.trim().split('\n').map(raw => {
    const line = toJavaScript(raw.trim());
    if (line.startsWith('weekly_reset_trigger = ')) return `let ${line};`;
    if (line === 'if weekly_reset_trigger') return 'if (weekly_reset_trigger) {';
    if (line === 'else') return '} else {';
    assert.match(line, /^pool_(store_session|track_extremes)\(.+\)$/);
    return `${line};`;
  }).join('\n') + '\n}';
  const collect = new Function('env', `with (env) { ${translated} }`);
  for (const includeSundayEvening of [false, true]) {
    const pool = { high: 100, low: 90, highIndex: 0, lowIndex: 0, completed: [] };
    const env = {
      weekly_pool: pool, is247Asset: true, includeSundayEvening, is_new_trading_week: false,
      pool_store_session: state => state.completed.push([state.high, state.low, state.highIndex, state.lowIndex]),
      pool_track_extremes: (state, high, low, eventTime, index, reset) => {
        if (reset || high > state.high) { state.high = high; state.highIndex = index; }
        if (reset || low < state.low) { state.low = low; state.lowIndex = index; }
      },
    };
    for (const [bar_index, high, low, is_new_weekly_bar] of [
      [1, 105, 92, false], [2, 102, 85, false], [3, 110, 95, true],
      [4, 120, 88, false], [5, 115, 90, true],
    ]) collect(Object.assign(env, { bar_index, high, low, is_new_weekly_bar, time: bar_index * 1000 }));
    assert.deepEqual(pool.completed, [[105, 85, 1, 2], [120, 88, 4, 4]]);
    assert.equal(pool.high, 115);
    assert.equal(pool.low, 90);
  }
});

test('BTC crypto is recognized without waiting for weekend history; BTC futures remain traditional', () => {
  for (const type of ['crypto', 'futures']) {
    const values = { syminfo: { type } };
    assert.equal(evaluate(assignment('isKnown247Asset'), values), type === 'crypto');
    assert.equal(evaluate(assignment('isKnownTraditionalAsset'), values), type === 'futures');
  }
});

test('Daily, Monthly, sessions and range are not blocked by the shared Sunday gate on BTC', () => {
  const sundayRule = source.match(/^should_skip_sunday_liquidity\([^\n]+\) =>\n    if use_exchange_session\n        false\n    else\n        (.+)$/m)?.[1];
  assert.ok(sundayRule);
  for (const includeSundayEvening of [false, true]) {
    assert.equal(evaluate(toJavaScript(sundayRule), {
      is247Asset: true, includeSundayEvening, time_value: 0,
      NY_TIMEZONE: 'America/New_York', EXCHANGE_SESSION_START_HOUR: 18,
      dayofweek: Object.assign(() => 1, { sunday: 1 }), hour: () => 20,
    }), false);
    assert.equal(evaluate(assignment('skipSunday1600'), { is247Asset: true, isSunday: true }), false);
  }
  assert.match(source, /if not skip_sunday_liquidity\n    if showRangeBoxFiltered\n        track_range_session/);
  assert.match(source, /if is_new_monthly_bar\n        pool_store_session\(monthly_pool\)/);
});

test('all four BTC session windows include weekends', () => {
  assert.match(source, /DAY_CODE_ALL_DAYS = ":1234567"/);
  for (const name of ['ASIA_OPEN', 'RAFAEL']) {
    assert.match(source, new RegExp(`DEFAULT_${name}_SESSION_TIME = "[0-9-]+" \\+ DAY_CODE_ALL_DAYS`));
  }
  for (const name of ['Premarket', 'Overnight']) {
    const branch = source.match(new RegExp(`^actual${name}Session := is247Asset \\? \\(([^)]+)\\)`, 'm'))?.[1];
    assert.ok(branch);
    assert.match(branch, /DAY_CODE_ALL_DAYS/);
  }
});

test('key-open capture has no symbol-type or weekday exclusion', () => {
  for (const [start, end] of [['showMnoOpenFiltered', 'show830OpenFiltered'], ['show830OpenFiltered', 'show930OpenFiltered'], ['show930OpenFiltered', 'showDailyOpenFiltered']]) {
    const block = source.match(new RegExp(`^if ${start} and[\\s\\S]*?(?=^if ${end} and)`, 'm'))?.[0];
    assert.ok(block);
    assert.doesNotMatch(block, /is247Asset|syminfo\.type|dayofweek|skip_sunday/);
  }
});

test('Monthly uses the native 1M threshold and retains its mode/toggle gate', () => {
  for (const monthSeconds of [30 * 86400, 30.4167 * 86400, 31 * 86400]) {
    for (const visible of [false, true]) {
      for (const [chartSeconds, expected] of [[300, visible], [monthSeconds, visible], [monthSeconds * 3, false]]) {
        assert.equal(evaluate(assignment('showMonthlyFiltered'), {
          applyPulseModeFilter: () => visible, POOL_TYPE_MONTHLY: 'monthly', showMonthly: visible,
          timeframe: { in_seconds: value => value === '1M' ? monthSeconds : chartSeconds },
        }), expected);
      }
    }
  }
});
