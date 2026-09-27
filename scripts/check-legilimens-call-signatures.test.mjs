import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Static Pine contract check: the source adapters coerce values freely, so they cannot catch
// arity or literal-type mismatches that TradingView rejects at compile time.
const FILES = {
  host: '../indicators/21-legilimens/code/legilimens.pine',
  legilimensProfile: '../indicators/21-legilimens/code/libraries/legilimens-profile-library.pine',
  legilimensOrchestration: '../indicators/21-legilimens/code/libraries/legilimens-profile-orchestration-library.pine',
  legilimensPresentation: '../indicators/21-legilimens/code/libraries/legilimens-presentation-library.pine',
};

function stripComments(source) {
  return source.split('\n').map(line => {
    let inString = false;
    for (let index = 0; index < line.length; index++) {
      if (line[index] === '"' && line[index - 1] !== '\\') inString = !inString;
      if (!inString && line.startsWith('//', index)) return line.slice(0, index);
    }
    return line;
  }).join('\n');
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0, inString = false, current = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && text[index - 1] !== '\\') inString = !inString;
    if (!inString) {
      if ('([<'.includes(char) && !(char === '<' && /[\s=!<>]/.test(text[index + 1] ?? ''))) depth++;
      else if (')]'.includes(char) || (char === '>' && depth > 0 && /[\w\]>]/.test(text[index - 1] ?? '') && !/[=]/.test(text[index + 1] ?? ''))) depth--;
      else if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseParameter(text) {
  const [declaration, fallback] = text.split(/\s=\s/);
  const tokens = declaration.trim().split(/\s+/);
  const name = tokens.pop();
  return { name, type: tokens.join(' ') || null, optional: fallback !== undefined };
}

function parseModule(source) {
  const types = new Map(), functions = new Map();
  for (const match of source.matchAll(/^(export )?type (\w+)\n((?:    [^\n]+\n)+)/gm)) {
    const fields = match[3].trimEnd().split('\n').map(line => {
      const field = line.trim().match(/^(.+?) (\w+)(?: = (.+))?$/);
      return { name: field[2], type: field[1], optional: field[3] !== undefined };
    });
    types.set(match[2], { exported: Boolean(match[1]), params: fields });
  }
  for (const match of source.matchAll(/^(export )?(\w+)\(([^\n]*)\) =>/gm)) {
    functions.set(match[2], { exported: Boolean(match[1]), params: match[3].trim() ? splitTopLevel(match[3]).map(parseParameter) : [], headerIndex: match.index });
  }
  return { types, functions };
}

function argumentList(source, openIndex) {
  let depth = 0, inString = false;
  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];
    if (char === '"' && source[index - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return source.slice(openIndex + 1, index);
  }
  throw new Error(`Unclosed call at ${openIndex}`);
}

function literalType(value) {
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) return 'string';
  if (/^(?:true|false)$/.test(value)) return 'bool';
  if (/^-?\d+\.\d*$/.test(value)) return 'float';
  if (/^-?\d+$/.test(value)) return 'int';
  return null;
}

function literalCompatible(literal, declaredType) {
  if (!literal || !declaredType) return true;
  const base = declaredType.replace(/^(?:simple|series|const|input) /, '');
  if (literal === 'int') return base === 'int' || base === 'float';
  return base === literal;
}

function checkCall(label, callee, argsText, problems) {
  problems.checked.add(label.replace(/ \(line \d+\)$/, ''));
  const args = argsText.trim() ? splitTopLevel(argsText) : [];
  const named = new Map(), positional = [];
  for (const arg of args) {
    const namedMatch = arg.match(/^(\w+)\s*=(?!=)\s*([\s\S]+)$/);
    if (namedMatch) named.set(namedMatch[1], namedMatch[2].trim());
    else positional.push(arg);
  }
  if (positional.length > callee.params.length) problems.push(`${label}: ${positional.length} positional arguments for ${callee.params.length} parameters`);
  callee.params.forEach((param, index) => {
    const value = index < positional.length ? positional[index] : named.get(param.name);
    if (value === undefined && !param.optional) problems.push(`${label}: missing ${param.name}`);
    const literal = value === undefined ? null : literalType(value);
    if (!literalCompatible(literal, param.type)) problems.push(`${label}: ${param.name} expects ${param.type}, got ${literal} ${value}`);
  });
  for (const name of named.keys()) {
    if (!callee.params.some(param => param.name === name)) problems.push(`${label}: unknown argument ${name}`);
  }
}

function checkSources(sources) {
  const modules = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, { source: stripComments(source), ...parseModule(stripComments(source)) }]));
  const problems = [];
  problems.checked = new Set();
  for (const [moduleKey, module] of Object.entries(modules)) {
    const source = module.source;
    for (const match of source.matchAll(/(?<![\w.])((?:\w+\.)*\w+)\(/g)) {
      const path = match[1].split('.');
      const lineStart = source.lastIndexOf('\n', match.index) + 1;
      if (path.length === 1 && lineStart === match.index && module.functions.get(path[0])?.headerIndex === match.index) continue;
      let target = null, label = null;
      if (path.at(-1) === 'new' && path.length <= 3) {
        const qualifier = path.length === 3 ? path[0] : null;
        const typeName = path.at(-2);
        const owner = qualifier ? modules[qualifier] : module;
        const type = owner?.types.get(typeName);
        if (!type) continue;
        if (qualifier && !type.exported) problems.push(`${moduleKey}: ${qualifier}.${typeName} is not exported`);
        target = type; label = `${moduleKey}: ${path.join('.')}`;
      } else if (path.length === 2) {
        const [qualifier, name] = path;
        const owner = modules[qualifier];
        if (!owner || qualifier === moduleKey) continue;
        target = owner.functions.get(name);
        if (!target) { problems.push(`${moduleKey}: ${qualifier}.${name} does not exist`); continue; }
        if (!target.exported) problems.push(`${moduleKey}: ${qualifier}.${name} is not exported`);
        label = `${moduleKey}: ${qualifier}.${name}`;
      } else if (path.length === 1) {
        target = module.functions.get(path[0]);
        if (!target) continue;
        label = `${moduleKey}: ${path[0]}`;
      } else continue;
      const line = source.slice(0, match.index).split('\n').length;
      checkCall(`${label} (line ${line})`, target, argumentList(source, match.index + match[0].length - 1), problems);
    }
  }
  return problems;
}

const sources = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, readFileSync(new URL(path, import.meta.url), 'utf8')]));

test('every Legilimens call matches its declared arity, argument names and literal types', () => {
  assert.deepEqual([...checkSources(sources)], []);
});

test('signature check rejects a string literal passed to a bool field', () => {
  const broken = { ...sources, legilimensPresentation: sources.legilimensPresentation.replace('ProfileRenderItem.new(geometry, false, false, false, developing, contentVisible)', 'ProfileRenderItem.new(geometry, "", false, false, developing, contentVisible)') };
  assert.notEqual(broken.legilimensPresentation, sources.legilimensPresentation);
  assert.ok(checkSources(broken).some(problem => problem.includes('ProfileRenderItem.new') && problem.includes('primaryPlus expects bool')));
});

test('signature check rejects missing arguments and unknown exports', () => {
  const missing = { ...sources, host: sources.host.replace(', showDeltaFormationTime, showLvnFormationTime)', ', showDeltaFormationTime)') };
  assert.ok(checkSources(missing).some(problem => problem.includes('DeltaSettings.new') && problem.includes('missing showLvnFormationTime')));
  const unknown = { ...sources, host: sources.host.replace('legilimensOrchestration.setFormationTracking(', 'legilimensOrchestration.enableFormationTracking(') };
  assert.ok(checkSources(unknown).some(problem => problem.includes('enableFormationTracking does not exist')));
});

test('signature check covers local and imported constructors and functions', () => {
  const { checked } = checkSources(sources);
  for (const label of ['legilimensPresentation: ProfileRenderItem.new', 'legilimensPresentation: FocusCandidate.new', 'legilimensPresentation: PendingOutlierLevel.new', 'legilimensOrchestration: RenderDecision.new', 'legilimensProfile: ProfileData.new', 'host: legilimensPresentation.DeltaSettings.new', 'host: legilimensProfile.SampleBatch.new', 'host: legilimensOrchestration.setFormationTracking', 'legilimensPresentation: renderSelectedProfile', 'legilimensPresentation: legilimensOrchestration.renderDecision']) {
    assert.ok(checked.has(label), label);
  }
  assert.ok(checked.size > 150, `only ${checked.size} callees checked`);
});
