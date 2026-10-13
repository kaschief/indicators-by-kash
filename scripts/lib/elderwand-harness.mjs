import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const sourcePath = 'indicators/19-elderwand/code/elderwand.pine';
export const executedFunctions = new Set();
export const source = process.env.ELDERWAND_TEST_STAGED === '1'
  ? execFileSync('git', ['show', `:${sourcePath}`], { encoding: 'utf8' })
  : readFileSync(new URL(`../../${sourcePath}`, import.meta.url), 'utf8');

// This adapter executes Elderwand's source, not Pine's runtime. Unsupported syntax
// throws; TradingView series rollback, built-in VWAP, and drawing limits need chart QA.
const strings = /"(?:[^"\\]|\\.)*"/g;
function protectStrings(text, transform) {
  const saved = [];
  const masked = text.replace(strings, value => `__string${saved.push(value) - 1}__`);
  return transform(masked).replace(/__string(\d+)__/g, (_, index) => saved[index]);
}
function splitArgs(text) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if ('([{'.includes(text[i])) depth++;
    if (')]}'.includes(text[i])) depth--;
    if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}
function calls(text) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(') { result += text[i]; continue; }
    let end = i + 1, depth = 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === '(') depth++;
      if (text[end] === ')') depth--;
    }
    assert.equal(depth, 0, `unbalanced expression: ${text}`);
    const inner = calls(text.slice(i + 1, end - 1));
    const args = splitArgs(inner);
    const firstNamed = args.findIndex(arg => /^\w+\s*=(?!=)/.test(arg));
    if (firstNamed >= 0) {
      const named = args.slice(firstNamed).map(arg => {
        assert.match(arg, /^\w+\s*=(?!=)/);
        return arg.replace(/^(\w+)\s*=\s*/, '$1: ');
      });
      result += `(${[...args.slice(0, firstNamed), `{${named.join(', ')}}`].join(', ')})`;
    } else result += `(${inner})`;
    i = end - 1;
  }
  return result;
}
export function expression(text) {
  return protectStrings(text, code => calls(code
    .replace(/array\.new<[\w.]+>/g, 'array.make')
    .replace(/\bna\s*\(/g, 'isNA(').replace(/\bna\b/g, 'NaN')
    .replace(/\bnot\b/g, '!').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||')
    .replace(/\btime\(/g, 'pineTime(')
    .replace(/\b(time|hlc3|inNYSession|inDailyReopen|nyEarlyInWindow)\[1\]/g, 'previous.$1')));
}
const typePrefix = /^(?:var\s+)?(?:array<[\w.]+>|int|float|bool|string|color|label|table|VwapAnchor|ContinuingAvwap|PendingLabel|PeriodLines)\s+/;
export function compileBlock(text, returns = false) {
  const lines = text.split('\n').filter(line => line.trim() && !line.trimStart().startsWith('//'));
  const baseIndent = Math.min(...lines.map(line => line.length - line.trimStart().length));
  const blocks = [], output = [];
  for (const [index, raw] of lines.entries()) {
    const indent = raw.length - raw.trimStart().length;
    const code = raw.trim();
    while (blocks.length && indent <= blocks.at(-1).indent) { output.push('}'); blocks.pop(); }
    const open = value => { output.push(value); blocks.push({ indent }); };
    if (code.startsWith('switch ')) {
      open(`switch (${expression(code.slice(7))}) {`);
    } else if (code.includes(' => ' ) || code.startsWith('=> ')) {
      const [key, value] = code.split('=>').map(part => part.trim());
      output.push(`${key ? `case ${expression(key)}` : 'default'}: return ${expression(value)};`);
    } else if (code.startsWith('else if ')) open(`else if (${expression(code.slice(8))}) {`);
    else if (code === 'else') open('else {');
    else if (code.startsWith('if ')) open(`if (${expression(code.slice(3))}) {`);
    else if (code.startsWith('while ')) open(`while (${expression(code.slice(6))}) {`);
    else if (/^for \w+ in /.test(code)) {
      const [, name, values] = code.match(/^for (\w+) in (.+)$/);
      open(`for (const ${name} of ${expression(values)}) {`);
    } else if (code.startsWith('for ')) {
      const match = code.match(/^for (\w+) = (.+) to (.+)$/);
      assert.ok(match, `unsupported loop: ${code}`);
      const [, name, from, to] = match;
      open(`for (let ${name} = ${expression(from)}, end_${name} = ${expression(to)}, step_${name} = ${name} <= end_${name} ? 1 : -1; step_${name} > 0 ? ${name} <= end_${name} : ${name} >= end_${name}; ${name} += step_${name}) {`);
    } else if (code === 'break') output.push('break;');
    else {
      const declaration = typePrefix.test(code) || /^\w+\s*=(?!=)/.test(code) || /^\[[\w, ]+\]\s*=/.test(code);
      const statement = expression(code.replace(typePrefix, '').replace(':=', '='));
      assert.ok(!/\b(?:switch|for|if|while|var)\b/.test(statement.replace(strings, '')), `unsupported statement: ${code}`);
      const implicitReturn = returns && index === lines.length - 1 && indent === baseIndent && !declaration && !/(?:^|[^=!<>])=(?!=)/.test(statement);
      output.push(`${implicitReturn ? 'return ' : declaration ? 'let ' : ''}${statement};`);
    }
  }
  while (blocks.length) { output.push('}'); blocks.pop(); }
  return output.join('\n');
}
export function section(pine, from, to) {
  const start = pine.indexOf(from), end = to ? pine.indexOf(to, start + from.length) : pine.length;
  assert.ok(start >= 0 && end > start, `missing section ${from} / ${to}`);
  return pine.slice(start, end);
}
export function createHarness(pine = source) {
  const callsMade = { polylines: [], labels: [], tables: [], vwap: [] };
  const rangeCheck = (values, index) => assert.ok(Number.isInteger(index) && index >= 0 && index < values.length, `array index ${index}/${values.length}`);
  const context = {
    NaN, isNA: value => value == null || Number.isNaN(value), int: Math.trunc, float: Number,
    math: Math, syminfo: { mintick: 0.25 }, showBands: true, mergeOverlappingLabels: true,
    labelMergeDistancePercent: 0.025, pendingLabels: [], renderedLabels: [],
    time: 1000, previous: { time: NaN, hlc3: NaN, inNYSession: false, inDailyReopen: false, nyEarlyInWindow: false },
    barstate: { isconfirmed: true, islast: true }, chart: { is_range: false, point: { from_time: (time, price) => ({ time, price }) } },
    size: { tiny: 'tiny', small: 'small', normal: 'normal' }, xloc: { bar_time: 'bar_time' }, yloc: { price: 'price' },
    position: { top_right: 'top_right' }, format: { mintick: 'mintick' },
    array: {
      make: (length = 0, value = NaN) => Array(length).fill(value), from: (...values) => values,
      size: values => values.length, get: (values, index) => { rangeCheck(values, index); return values[index]; },
      set: (values, index, value) => { rangeCheck(values, index); values[index] = value; },
      first: values => { rangeCheck(values, 0); return values[0]; },
      last: values => { rangeCheck(values, values.length - 1); return values.at(-1); },
      shift: values => { rangeCheck(values, 0); return values.shift(); },
      push: (values, value) => { values.push(value); }, clear: values => { values.length = 0; },
    },
    color: {
      rgb: (r, g, b) => ({ r, g, b, t: 0 }), new: (clr, t) => ({ ...clr, t }),
      r: clr => clr.r, g: clr => clr.g, b: clr => clr.b, t: clr => clr.t,
      white: { r: 255, g: 255, b: 255, t: 0 }, black: { r: 0, g: 0, b: 0, t: 0 }, gray: { r: 128, g: 128, b: 128, t: 0 },
    },
    str: { tonumber: Number, tostring: value => String(value), format: (pattern, ...values) => pattern.replace(/\{(\d+)\}/g, (_, index) => String(values[index])) },
    polyline: {
      new: (points, options) => { const drawing = { points, ...options, deleted: false }; callsMade.polylines.push(drawing); return drawing; },
      delete: drawing => { drawing.deleted = true; },
    },
    label: {
      style_label_left: 'label_left',
      new: (x, y, text, options) => { const drawing = { x, y, text, ...options, deleted: false }; callsMade.labels.push(drawing); return drawing; },
      delete: drawing => { drawing.deleted = true; },
    },
    table: {
      new: (position, columns, rows, options) => { const tbl = { position, columns, rows, options, cells: new Map() }; callsMade.tables.push(tbl); return tbl; },
      cell: (tbl, col, row, text, options) => { assert.ok(col >= 0 && col < tbl.columns && row >= 0 && row < tbl.rows, `table overflow: ${col},${row}/${tbl.columns},${tbl.rows}`); tbl.cells.set(`${col},${row}`, { text, ...options }); },
    },
    ta: { vwap: (...args) => { callsMade.vwap.push(args); return [100, 102, 98]; } },
  };
  const evaluate = text => new Function('scope', `with (scope) { return (${expression(text)}); }`)(context);
  const definitions = [...pine.matchAll(/^(\w+)\(([^\n]*)\) =>\n((?:[ \t]+[^\n]*\n|\n)+)/gm)];
  for (const [, name, params, body] of definitions) {
    const args = params ? params.split(',').map(param => param.trim().split(/\s+/).at(-1)).join(',') : '';
    const generated = compileBlock(body, true);
    try { context[name] = new Function('scope', `with (scope) { return function ${name}(${args}) { ${generated} }; }`)(context); }
    catch (error) { throw new Error(`Cannot adapt ${name}: ${error.message}\n${generated}`); }
  }
  for (const [, name] of definitions) {
    const implementation = context[name];
    context[name] = (...args) => { executedFunctions.add(name); return implementation(...args); };
  }
  for (const [, name, body] of pine.matchAll(/^type (\w+)\n((?:[ \t]+[^\n]*\n)+)/gm)) {
    const fields = body.trim().split('\n').map(line => line.trim().split(/\s+/).at(-1));
    context[name] = { new: (...args) => {
      const named = args.length === 1 && args[0]?.constructor === Object ? args[0] : {};
      return Object.fromEntries(fields.map((field, index) => [field, field in named ? named[field] : index < args.length && !Object.keys(named).length ? args[index] : NaN]));
    } };
  }
  for (const [, name, value] of pine.matchAll(/^const \w+\s+(\w+)\s*= (.+)$/gm)) context[name] = evaluate(value);
  const body = name => {
    const definition = definitions.find(definition => definition[1] === name);
    assert.ok(definition, `missing function ${name}`);
    return definition[3];
  };
  const assignment = name => {
    const match = pine.match(new RegExp(`^(?:${typePrefix.source.slice(1)})?${name}\\s*(?::=|=)\\s*(.+)$`, 'm'));
    assert.ok(match, `missing assignment ${name}`);
    return context[name] = evaluate(match[1]);
  };
  const run = text => new Function('scope', `with (scope) { ${compileBlock(text)} }`)(context);
  const globals = text => {
    for (const line of text.split('\n')) {
      if (!line || /^\s|^\/\/|=>\s*$/.test(line)) continue;
      const clean = line.replace(typePrefix, '');
      const match = clean.match(/^(\w+(?:\.\w+)?|\[[\w, ]+\])\s*(?::=|=)\s*(.+)$/);
      if (!match) { evaluate(clean); continue; }
      const [, target, value] = match;
      const result = evaluate(value);
      if (target.startsWith('[')) target.slice(1, -1).split(',').forEach((name, index) => { context[name.trim()] = result[index]; });
      else if (target.includes('.')) { const [object, key] = target.split('.'); context[object][key] = result; }
      else context[target] = result;
    }
  };
  const anchor = (name, overrides = {}) => ({ ...context.new_anchor(name), visible: true, drawVisible: true,
    displayName: name, lineColor: context.DEFAULT_DAILY_COLOR, lineWidth: 3,
    labelSize: 'tiny', pricesEnabled: false, labelVwapValue: NaN, labelStdevValue: NaN,
    labelPricePriority: context.anchor_label_priority(name), historyDepth: 1, history: [],
    currentPeriod: { polylines: [] }, fillRange: context.FILL_RANGE_NONE, fillOpacity: 3,
    band1Enabled: false, band2Enabled: true, band3Enabled: true,
    band1Width: 1, band2Width: 2, band3Width: 2,
    band1Color: context.color.new(context.DEFAULT_DAILY_COLOR, 53),
    band2Color: context.color.new(context.DEFAULT_DAILY_COLOR, 59),
    band3Color: context.color.new(context.DEFAULT_DAILY_COLOR, 18),
    barTimes: [1000, 2000], vwapValues: [100, 100], stdevValues: [2, 2], ...overrides });
  return { c: context, calls: callsMade, evaluate, assignment, run, globals, body, anchor, pine, functionNames: definitions.map(definition => definition[1]) };
}
