// Compiles a parsed Pine program into JavaScript closures with Pine's execution model:
// one pass per bar, `var` state per call site, per-call-site series history for `x[n]`,
// lazy `and`/`or`, block-valued `if`/`switch`, and user types, enums, methods and libraries.

import { BUILTINS, isNa, pineEquals, PineRuntimeError, typeNameOf } from './builtins.mjs';

const NO_NAMED = Object.freeze({});
const FLOW_BREAK = 1;
const FLOW_CONTINUE = 2;
const MAX_LOOP_ITERATIONS = 2_000_000;

export class PineCompileError extends Error {
  constructor(message, node) {
    super(node?.line ? `line ${node.line}: ${message}` : message);
    this.line = node?.line;
  }
}

class Frame {
  constructor() {
    this.exec = 0;
    this.vars = [];
    this.varInitialized = [];
    this.series = new Map();
    this.children = new Map();
    this.state = new Map();
  }
  child(site) {
    let frame = this.children.get(site);
    if (!frame) { frame = new Frame(); this.children.set(site, frame); }
    return frame;
  }
}
export { Frame };

class SeriesSlot {
  constructor() { this.exec = -1; this.cur = NaN; this.hist = []; }
}

function seriesFor(frame, key) {
  let slot = frame.series.get(key);
  if (!slot) { slot = new SeriesSlot(); frame.series.set(key, slot); }
  return slot;
}

function seriesAdvance(slot, exec) {
  if (slot.exec === exec) return;
  if (slot.exec >= 0) {
    const missing = Math.min(exec - slot.exec, 5000);
    for (let i = 0; i < missing; i++) slot.hist.push(slot.cur);
    if (slot.hist.length > 6000) slot.hist.splice(0, slot.hist.length - 5000);
  }
  slot.exec = exec;
}

export function seriesWrite(frame, key, value) {
  const slot = seriesFor(frame, key);
  seriesAdvance(slot, frame.exec);
  slot.cur = value;
}

export function seriesRead(frame, key, offset) {
  const slot = seriesFor(frame, key);
  seriesAdvance(slot, frame.exec);
  if (offset === 0) return slot.cur;
  if (!Number.isInteger(offset) || offset < 0) throw new PineRuntimeError(`invalid history offset ${offset}`);
  const index = slot.hist.length - offset;
  return index >= 0 ? slot.hist[index] : NaN;
}

class SlotInfo {
  constructor(index, name, fn, mode) {
    this.index = index;
    this.name = name;
    this.fn = fn;
    this.persistent = mode === 'var' || mode === 'varip';
    this.tracked = false;
  }
}

class FunctionInfo {
  constructor(name, isMain) {
    this.name = name;
    this.isMain = isMain;
    this.slots = [];
    this.rootScope = null;
  }
  allocate(name, mode) {
    const slot = new SlotInfo(this.slots.length, name, this, mode);
    this.slots.push(slot);
    return slot;
  }
}

class CompileScope {
  constructor(parent, fn) { this.parent = parent; this.fn = fn; this.names = new Map(); }
  lookupLocal(name) {
    for (let scope = this; scope && scope.fn === this.fn; scope = scope.parent) {
      const slot = scope.names.get(name);
      if (slot) return slot;
    }
    return null;
  }
}

const MEMBER_NAMESPACES = { array: 'array', map: 'map', matrix: 'matrix', line: 'line', box: 'box', label: 'label', table: 'table', polyline: 'polyline', linefill: 'linefill', string: 'str', chartpoint: 'chart.point', color: 'color' };

export class Program {
  constructor(ast, { libraries = {}, sourceName = 'script' } = {}) {
    this.sourceName = sourceName;
    this.functions = new Map();
    this.methods = new Map();
    this.types = new Map();
    this.enums = new Map();
    this.imports = new Map();
    this.exports = new Map();
    this.libraries = libraries;
    this.siteCounter = 0;
    this.inputNames = [];
    this.main = new FunctionInfo('<main>', true);
    this.mainScope = new CompileScope(null, this.main);
    this.main.rootScope = this.mainScope;
    this.body = this.compileBlock(ast.body, this.mainScope, true);
  }

  site() { return ++this.siteCounter; }

  // DECLARATIONS

  compileBlock(statements, scope, valueMode) {
    const compiled = [];
    for (const statement of statements) {
      const result = this.compileStatement(statement, scope);
      if (result) compiled.push(result);
    }
    if (compiled.length === 0) return () => NaN;
    if (compiled.length === 1) return compiled[0];
    return (ctx, L) => {
      let value = NaN;
      for (let i = 0; i < compiled.length; i++) {
        value = compiled[i](ctx, L);
        if (ctx.flow) return value;
      }
      return value;
    };
  }

  compileStatement(node, scope) {
    if (node.line) this.currentLine = node.line;
    try {
      switch (node.kind) {
        case 'TypeDef': this.defineType(node); return null;
        case 'EnumDef': this.defineEnum(node); return null;
        case 'Import': this.defineImport(node); return null;
        case 'FuncDef': this.defineFunction(node, scope); return null;
        case 'VarDecl': return this.compileDeclaration(node, scope);
        case 'TupleDecl': return this.compileTupleDeclaration(node, scope);
        case 'TupleAssign': return this.compileTupleDeclaration(node, scope, true);
        case 'Assign': return this.compileAssignment(node, scope);
        case 'If': return this.compileIf(node, scope);
        case 'Switch': return this.compileSwitch(node, scope);
        case 'For': return this.compileFor(node, scope);
        case 'ForIn': return this.compileForIn(node, scope);
        case 'While': return this.compileWhile(node, scope);
        case 'Break': return ctx => { ctx.flow = FLOW_BREAK; return NaN; };
        case 'Continue': return ctx => { ctx.flow = FLOW_CONTINUE; return NaN; };
        case 'ExprStmt': return this.compileExpressionStatement(node, scope);
        default: throw new PineCompileError(`unsupported statement ${node.kind}`, node);
      }
    } catch (error) {
      if (error instanceof PineCompileError && !error.line && node.line) throw new PineCompileError(error.message, node);
      throw error;
    }
  }

  compileExpressionStatement(node, scope) {
    const expr = node.expr;
    if (expr.kind === 'Call' && expr.callee.kind === 'Ident' && ['indicator', 'library', 'strategy'].includes(expr.callee.name)) {
      const kind = expr.callee.name;
      const args = this.compileArguments(expr, scope, ['title', 'shorttitle', 'overlay']);
      this.declarationKind = kind;
      return (ctx, L) => {
        if (!ctx.declaration) {
          const [positional, named] = args(ctx, L);
          ctx.declaration = { kind, title: positional[0], shorttitle: positional[1], overlay: positional[2], ...named };
        }
        return NaN;
      };
    }
    return this.compileExpression(expr, scope);
  }

  defineType(node) {
    const fields = node.fields.map(field => ({
      name: field.name,
      type: field.type,
      defaultValue: field.defaultValue ? this.compileExpression(field.defaultValue, this.mainScope) : null,
    }));
    const typeName = node.name;
    const type = {
      name: typeName,
      fields,
      create: (ctx, positional, named) => {
        const instance = { __type: typeName };
        fields.forEach((field, index) => {
          if (Object.hasOwn(named, field.name)) instance[field.name] = named[field.name];
          else if (index < positional.length) instance[field.name] = positional[index];
          else instance[field.name] = field.defaultValue ? field.defaultValue(ctx, []) : NaN;
        });
        return instance;
      },
    };
    this.types.set(typeName, type);
    if (node.exported) this.exports.set(typeName, { kind: 'type', type });
  }

  defineEnum(node) {
    const members = {};
    for (const member of node.members) members[member.name] = Object.freeze({ __enum: node.name, name: member.name, title: member.title });
    const value = { name: node.name, members };
    this.enums.set(node.name, value);
    if (node.exported) this.exports.set(node.name, { kind: 'enum', value });
  }

  defineImport(node) {
    const library = this.libraries[node.path.split('/')[1]];
    if (!library) throw new PineCompileError(`library ${node.path} is not available to the test runtime`, node);
    this.imports.set(node.alias, library);
  }

  defineFunction(node, scope) {
    if (scope !== this.mainScope) throw new PineCompileError('functions must be declared at the top level', node);
    const info = new FunctionInfo(node.name, false);
    const fnScope = new CompileScope(this.mainScope, info);
    info.rootScope = fnScope;
    const params = node.params.map(param => ({
      name: param.name,
      type: param.type,
      slot: (() => { const slot = info.allocate(param.name, null); slot.type = param.type; fnScope.names.set(param.name, slot); return slot; })(),
      defaultValue: param.defaultValue ? this.compileExpression(param.defaultValue, this.mainScope) : null,
    }));
    const fn = { name: node.name, info, params, body: null, isMethod: node.isMethod, program: this };
    if (node.isMethod) {
      const list = this.methods.get(node.name) ?? [];
      list.push(fn);
      this.methods.set(node.name, list);
    } else this.functions.set(node.name, fn);
    if (node.exported) this.exports.set(node.name, { kind: node.isMethod ? 'method' : 'function', fn });
    fn.body = this.compileBlock(node.body, fnScope, true);
  }

  declareName(scope, name, mode, node) {
    if (name === '_') return null;
    const existing = scope.names.get(name);
    if (existing && !scope.fn.isMain) throw new PineCompileError(`'${name}' is already declared in this block`, node);
    const slot = scope.fn.allocate(name, mode);
    scope.names.set(name, slot);
    return slot;
  }

  compileDeclaration(node, scope) {
    const value = this.compileExpression(node.value, scope);
    if (scope.fn.isMain && node.value.kind === 'Call' && this.calleePath(node.value.callee, scope)?.startsWith('input')) {
      node.value.inputName = node.name;
      this.inputNames.push(node.name);
    }
    const slot = this.declareName(scope, node.name, node.mode, node);
    if (!slot) return value;
    slot.type = node.type ?? this.staticType(node.value, scope);
    if (node.exported && scope === this.mainScope) this.exports.set(node.name, { kind: 'value', slot });
    const writer = this.slotWriter(slot);
    if (slot.persistent) {
      const index = slot.index;
      return (ctx, L) => {
        const frame = slot.fn.isMain ? ctx.mainFrame : ctx.frame;
        if (!frame.varInitialized[index]) {
          frame.varInitialized[index] = true;
          writer(ctx, L, value(ctx, L));
        } else if (slot.tracked) writer(ctx, L, frame.vars[index]);
        return frame.vars[index];
      };
    }
    return (ctx, L) => {
      const result = value(ctx, L);
      writer(ctx, L, result);
      return result;
    };
  }

  compileTupleDeclaration(node, scope, reassign = false) {
    const value = this.compileExpression(node.value, scope);
    const writers = node.names.map(name => {
      if (name === '_') return null;
      const slot = reassign ? this.resolveSlot(name, scope, node) : this.declareName(scope, name, null, node);
      return slot ? this.slotWriter(slot) : null;
    });
    return (ctx, L) => {
      const result = value(ctx, L);
      const items = Array.isArray(result) ? result : [];
      for (let i = 0; i < writers.length; i++) if (writers[i]) writers[i](ctx, L, i < items.length ? items[i] : NaN);
      return result;
    };
  }

  resolveSlot(name, scope, node) {
    const local = scope.lookupLocal(name);
    if (local) return local;
    const global = this.mainScope.names.get(name);
    if (global) return global;
    throw new PineCompileError(`unknown variable '${name}'`, node);
  }

  slotReader(slot) {
    const index = slot.index;
    if (slot.fn.isMain) return slot.persistent ? ctx => ctx.mainFrame.vars[index] : ctx => ctx.mainLocals[index];
    return slot.persistent ? ctx => ctx.frame.vars[index] : (ctx, L) => L[index];
  }

  // A variable declared `int` holds whole numbers: TradingView accepts `int half = 7 / 2`, so the
  // fractional v6 division result is truncated when stored.
  slotWriter(slot) {
    const writer = this.rawSlotWriter(slot);
    if (slot.type?.name !== 'int') return writer;
    return (ctx, L, value) => writer(ctx, L, typeof value === 'number' && !Number.isInteger(value) && !Number.isNaN(value) ? Math.trunc(value) : value);
  }

  rawSlotWriter(slot) {
    const index = slot.index;
    const key = `s${index}`;
    if (slot.fn.isMain) {
      return slot.persistent
        ? (ctx, L, value) => { ctx.mainFrame.vars[index] = value; if (slot.tracked) seriesWrite(ctx.mainFrame, key, value); }
        : (ctx, L, value) => { ctx.mainLocals[index] = value; if (slot.tracked) seriesWrite(ctx.mainFrame, key, value); };
    }
    return slot.persistent
      ? (ctx, L, value) => { ctx.frame.vars[index] = value; if (slot.tracked) seriesWrite(ctx.frame, key, value); }
      : (ctx, L, value) => { L[index] = value; if (slot.tracked) seriesWrite(ctx.frame, key, value); };
  }

  compileAssignment(node, scope) {
    const value = this.compileExpression(node.value, scope);
    const combine = {
      ':=': (_, next) => next,
      '+=': (current, next) => current + next,
      '-=': (current, next) => current - next,
      '*=': (current, next) => current * next,
      '/=': (current, next) => current / next,
      '%=': (current, next) => current % next,
    }[node.op];
    if (node.target.kind === 'Ident') {
      const slot = this.resolveSlot(node.target.name, scope, node);
      const read = this.slotReader(slot);
      const write = this.slotWriter(slot);
      if (node.op === ':=') return (ctx, L) => { const result = value(ctx, L); write(ctx, L, result); return result; };
      return (ctx, L) => { const result = combine(read(ctx, L), value(ctx, L)); write(ctx, L, result); return result; };
    }
    const object = this.compileExpression(node.target.object, scope);
    const field = node.target.name;
    return (ctx, L) => {
      const target = object(ctx, L);
      if (isNa(target) || typeof target !== 'object') throw new PineRuntimeError(`cannot assign field '${field}' of na object`, node.line);
      const result = node.op === ':=' ? value(ctx, L) : combine(target[field], value(ctx, L));
      target[field] = result;
      return result;
    };
  }

  // CONTROL FLOW

  compileIf(node, scope) {
    const branches = node.branches.map(branch => ({
      cond: this.compileExpression(branch.cond, scope),
      body: this.compileBlock(branch.body, new CompileScope(scope, scope.fn), true),
    }));
    const elseBody = node.elseBody ? this.compileBlock(node.elseBody, new CompileScope(scope, scope.fn), true) : null;
    return (ctx, L) => {
      for (let i = 0; i < branches.length; i++) if (requireBool(branches[i].cond(ctx, L), node) === true) return branches[i].body(ctx, L);
      return elseBody ? elseBody(ctx, L) : NaN;
    };
  }

  compileSwitch(node, scope) {
    const subject = node.subject ? this.compileExpression(node.subject, scope) : null;
    const cases = node.cases.map(entry => ({
      match: entry.match ? this.compileExpression(entry.match, scope) : null,
      body: this.compileBlock(entry.body, new CompileScope(scope, scope.fn), true),
    }));
    return (ctx, L) => {
      const value = subject ? subject(ctx, L) : null;
      for (let i = 0; i < cases.length; i++) {
        const entry = cases[i];
        if (!entry.match) return entry.body(ctx, L);
        const candidate = entry.match(ctx, L);
        if (subject ? pineEquals(candidate, value) : candidate === true) return entry.body(ctx, L);
      }
      return NaN;
    };
  }

  compileFor(node, scope) {
    const from = this.compileExpression(node.from, scope);
    const to = this.compileExpression(node.to, scope);
    const step = node.step ? this.compileExpression(node.step, scope) : null;
    const loopScope = new CompileScope(scope, scope.fn);
    const slot = this.declareName(loopScope, node.name, null, node);
    const write = this.slotWriter(slot);
    const body = this.compileBlock(node.body, loopScope, true);
    return (ctx, L) => {
      let index = from(ctx, L);
      const initialTo = to(ctx, L);
      if (isNa(index) || isNa(initialTo)) return NaN;
      const magnitude = step ? Math.abs(step(ctx, L)) : 1;
      const direction = index <= initialTo ? 1 : -1;
      let value = NaN;
      for (let guard = 0; ; guard++) {
        if (guard > MAX_LOOP_ITERATIONS) throw new PineRuntimeError('for loop did not terminate', node.line);
        const limit = to(ctx, L);
        if (direction > 0 ? index > limit : index < limit) break;
        write(ctx, L, index);
        value = body(ctx, L);
        if (ctx.flow === FLOW_BREAK) { ctx.flow = 0; break; }
        if (ctx.flow === FLOW_CONTINUE) ctx.flow = 0;
        index += direction * magnitude;
      }
      return value;
    };
  }

  compileForIn(node, scope) {
    const iterable = this.compileExpression(node.iterable, scope);
    const loopScope = new CompileScope(scope, scope.fn);
    const indexWriter = node.index ? this.slotWriter(this.declareName(loopScope, node.index, null, node)) : null;
    const itemSlot = this.declareName(loopScope, node.item, null, node);
    const iterableType = this.staticType(node.iterable, scope);
    if (itemSlot && iterableType && (iterableType.name === 'array' || iterableType.name === 'map')) itemSlot.type = iterableType.args.at(-1) ?? null;
    const itemWriter = itemSlot ? this.slotWriter(itemSlot) : null;
    const body = this.compileBlock(node.body, loopScope, true);
    return (ctx, L) => {
      const collection = iterable(ctx, L);
      if (isNa(collection)) return NaN;
      let value = NaN;
      const entries = collection instanceof Map ? [...collection.entries()] : null;
      const length = () => (entries ? entries.length : collection.length);
      for (let i = 0; i < length(); i++) {
        if (entries) {
          if (indexWriter) indexWriter(ctx, L, entries[i][0]);
          if (itemWriter) itemWriter(ctx, L, entries[i][1]);
        } else {
          if (indexWriter) indexWriter(ctx, L, i);
          if (itemWriter) itemWriter(ctx, L, collection[i]);
        }
        value = body(ctx, L);
        if (ctx.flow === FLOW_BREAK) { ctx.flow = 0; break; }
        if (ctx.flow === FLOW_CONTINUE) ctx.flow = 0;
      }
      return value;
    };
  }

  compileWhile(node, scope) {
    const cond = this.compileExpression(node.cond, scope);
    const body = this.compileBlock(node.body, new CompileScope(scope, scope.fn), true);
    return (ctx, L) => {
      let value = NaN;
      for (let guard = 0; requireBool(cond(ctx, L), node) === true; guard++) {
        if (guard > MAX_LOOP_ITERATIONS) throw new PineRuntimeError('while loop did not terminate', node.line);
        value = body(ctx, L);
        if (ctx.flow === FLOW_BREAK) { ctx.flow = 0; break; }
        if (ctx.flow === FLOW_CONTINUE) ctx.flow = 0;
      }
      return value;
    };
  }

  // EXPRESSIONS

  compileExpression(node, scope) {
    switch (node.kind) {
      case 'Num': { const value = node.value; return () => value; }
      case 'Str': { const value = node.value; return () => value; }
      case 'Bool': { const value = node.value; return () => value; }
      case 'Color': { const value = BUILTINS.colorFromHex(node.value); return () => value; }
      case 'Tuple': {
        const items = node.items.map(item => this.compileExpression(item, scope));
        const count = items.length;
        return (ctx, L) => {
          const values = new Array(count);
          for (let i = 0; i < count; i++) values[i] = items[i](ctx, L);
          return values;
        };
      }
      case 'Ident': return this.compileIdentifier(node, scope);
      case 'Member': return this.compileMember(node, scope);
      case 'Call': return this.compileCall(node, scope);
      case 'History': return this.compileHistory(node, scope);
      case 'Unary': return this.compileUnary(node, scope);
      case 'Binary': return this.compileBinary(node, scope);
      case 'Ternary': {
        const cond = this.compileExpression(node.cond, scope);
        const whenTrue = this.compileExpression(node.whenTrue, scope);
        const whenFalse = this.compileExpression(node.whenFalse, scope);
        return (ctx, L) => (requireBool(cond(ctx, L), node) === true ? whenTrue(ctx, L) : whenFalse(ctx, L));
      }
      case 'If': return this.compileIf(node, scope);
      case 'Switch': return this.compileSwitch(node, scope);
      default: throw new PineCompileError(`unsupported expression ${node.kind}`, node);
    }
  }

  compileIdentifier(node, scope) {
    const name = node.name;
    const local = scope.lookupLocal(name);
    if (local) return this.slotReader(local);
    const global = this.mainScope.names.get(name);
    if (global) return this.slotReader(global);
    if (name === 'na') return () => NaN;
    const variable = BUILTINS.variables.get(name);
    if (variable) return variable;
    if (BUILTINS.constants.has(name)) { const value = BUILTINS.constants.get(name); return () => value; }
    throw new PineCompileError(`unknown identifier '${name}'`, node);
  }

  isShadowed(name, scope) { return !!(scope.lookupLocal(name) || this.mainScope.names.get(name)); }

  // Returns the dotted builtin path for chains such as chart.point.from_time, or null.
  calleePath(node, scope) {
    if (node.kind === 'Ident') return this.isShadowed(node.name, scope) ? null : node.name;
    if (node.kind === 'Member') {
      const base = this.calleePath(node.object, scope);
      return base === null ? null : `${base}.${node.name}`;
    }
    return null;
  }

  compileMember(node, scope) {
    node.line ??= this.currentLine;
    if (node.object.kind === 'Ident' && !this.isShadowed(node.object.name, scope)) {
      const rootName = node.object.name;
      const enumeration = this.enums.get(rootName);
      if (enumeration) {
        const member = enumeration.members[node.name];
        if (!member) throw new PineCompileError(`unknown enum member ${rootName}.${node.name}`, node);
        return () => member;
      }
      const library = this.imports.get(rootName);
      if (library) {
        const exported = library.program.exports.get(node.name);
        if (exported?.kind === 'enum') return () => exported.value;
        if (exported?.kind === 'value') {
          const index = exported.slot.index;
          const persistent = exported.slot.persistent;
          return () => (persistent ? library.program.libraryState.frame.vars[index] : library.program.libraryState.locals[index]);
        }
        throw new PineCompileError(`library value ${rootName}.${node.name} is not supported`, node);
      }
    }
    if (node.object.kind === 'Member' && node.object.object.kind === 'Ident' && this.imports.has(node.object.object.name)) {
      const library = this.imports.get(node.object.object.name);
      const exported = library.program.exports.get(node.object.name);
      if (exported?.kind === 'enum') {
        const member = exported.value.members[node.name];
        if (!member) throw new PineCompileError(`unknown enum member ${node.object.name}.${node.name}`, node);
        return () => member;
      }
    }
    const path = this.calleePath(node, scope);
    if (path !== null) {
      if (BUILTINS.variables.has(path)) return BUILTINS.variables.get(path);
      if (BUILTINS.constants.has(path)) { const value = BUILTINS.constants.get(path); return () => value; }
    }
    const object = this.compileExpression(node.object, scope);
    const field = node.name;
    return (ctx, L) => {
      const target = object(ctx, L);
      if (isNa(target) || typeof target !== 'object') throw new PineRuntimeError(`cannot read field '${field}' of na object`, node.line);
      if (target.__enum && field === 'name') return target.name;
      return target[field];
    };
  }

  compileHistory(node, scope) {
    const offset = this.compileExpression(node.offset, scope);
    const target = node.target;
    if (target.kind === 'Ident') {
      const slot = scope.lookupLocal(target.name) ?? this.mainScope.names.get(target.name);
      if (slot) {
        slot.tracked = true;
        const key = `s${slot.index}`;
        const read = this.slotReader(slot);
        const isMainSlot = slot.fn.isMain;
        return (ctx, L) => {
          const frame = isMainSlot ? ctx.mainFrame : ctx.frame;
          const n = offset(ctx, L);
          if (n === 0) return read(ctx, L);
          return seriesRead(frame, key, n);
        };
      }
      const builtinSeries = BUILTINS.seriesHistory.get(target.name);
      if (builtinSeries && !this.isShadowed(target.name, scope)) return (ctx, L) => builtinSeries(ctx, offset(ctx, L));
    }
    if (target.kind === 'Member') {
      const path = this.calleePath(target, scope);
      const builtinSeries = path && BUILTINS.seriesHistory.get(path);
      if (builtinSeries) return (ctx, L) => builtinSeries(ctx, offset(ctx, L));
    }
    const value = this.compileExpression(target, scope);
    const key = `h${this.site()}`;
    return (ctx, L) => {
      const current = value(ctx, L);
      seriesWrite(ctx.frame, key, current);
      const n = offset(ctx, L);
      return n === 0 ? current : seriesRead(ctx.frame, key, n);
    };
  }

  compileUnary(node, scope) {
    const arg = this.compileExpression(node.arg, scope);
    if (node.op === 'not') return (ctx, L) => !arg(ctx, L);
    if (node.op === '-') return (ctx, L) => -arg(ctx, L);
    return arg;
  }

  compileBinary(node, scope) {
    const left = this.compileExpression(node.left, scope);
    const right = this.compileExpression(node.right, scope);
    switch (node.op) {
      case 'and': return (ctx, L) => left(ctx, L) === true && right(ctx, L) === true;
      case 'or': return (ctx, L) => left(ctx, L) === true || right(ctx, L) === true;
      case '==': return (ctx, L) => pineEquals(left(ctx, L), right(ctx, L));
      case '!=': return (ctx, L) => { const a = left(ctx, L); const b = right(ctx, L); return isNa(a) || isNa(b) ? false : !pineEquals(a, b); };
      case '<': return (ctx, L) => left(ctx, L) < right(ctx, L);
      case '>': return (ctx, L) => left(ctx, L) > right(ctx, L);
      case '<=': return (ctx, L) => left(ctx, L) <= right(ctx, L);
      case '>=': return (ctx, L) => left(ctx, L) >= right(ctx, L);
      case '+': return (ctx, L) => {
        const a = left(ctx, L); const b = right(ctx, L);
        if (typeof a === 'string' || typeof b === 'string') return isNa(a) || isNa(b) ? NaN : a + b;
        return a + b;
      };
      case '-': return (ctx, L) => left(ctx, L) - right(ctx, L);
      case '*': return (ctx, L) => left(ctx, L) * right(ctx, L);
      case '/': return (ctx, L) => { const b = right(ctx, L); return b === 0 ? NaN : left(ctx, L) / b; };
      case '%': return (ctx, L) => { const b = right(ctx, L); return b === 0 ? NaN : left(ctx, L) % b; };
      default: throw new PineCompileError(`unsupported operator ${node.op}`, node);
    }
  }

  // CALLS

  compileArguments(node, scope, paramNames) {
    const positional = node.args.map(arg => this.compileExpression(arg, scope));
    const named = {};
    for (const [key, value] of Object.entries(node.named)) {
      const index = paramNames ? paramNames.indexOf(key) : -1;
      if (index >= 0) {
        if (positional[index]) throw new PineCompileError(`argument '${key}' given twice`, node);
        while (positional.length < index) positional.push(null);
        positional[index] = this.compileExpression(value, scope);
      } else named[key] = this.compileExpression(value, scope);
    }
    const namedKeys = Object.keys(named);
    const namedValues = namedKeys.map(key => named[key]);
    const count = positional.length;
    return (ctx, L) => {
      const args = new Array(count);
      for (let i = 0; i < count; i++) args[i] = positional[i] ? positional[i](ctx, L) : undefined;
      if (namedKeys.length === 0) return [args, NO_NAMED];
      const values = {};
      for (let i = 0; i < namedKeys.length; i++) values[namedKeys[i]] = namedValues[i](ctx, L);
      return [args, values];
    };
  }

  compileCall(node, scope) {
    const callee = node.callee;
    if (callee.kind === 'Ident' && !this.isShadowed(callee.name, scope)) {
      const fn = this.functions.get(callee.name);
      if (fn) return this.compileUserCall(fn, node, scope, null);
    }
    if (callee.kind === 'Member' && callee.object.kind === 'Ident' && !this.isShadowed(callee.object.name, scope)) {
      const rootName = callee.object.name;
      const type = this.types.get(rootName);
      if (type) return this.compileTypeCall(type, callee.name, node, scope);
      const library = this.imports.get(rootName);
      if (library) return this.compileLibraryCall(library, callee.name, node, scope);
    }
    if (callee.kind === 'Member' && callee.object.kind === 'Member' && callee.object.object.kind === 'Ident' && this.imports.has(callee.object.object.name)) {
      const library = this.imports.get(callee.object.object.name);
      const exported = library.program.exports.get(callee.object.name);
      if (exported?.kind === 'type') return this.compileTypeCall(exported.type, callee.name, node, scope);
    }
    const path = this.calleePath(callee, scope);
    if (path !== null) {
      const builtin = BUILTINS.functions.get(path);
      if (builtin) return this.compileBuiltinCall(builtin, path, node, scope);
      if (callee.kind === 'Ident') throw new PineCompileError(`unknown function '${path}'`, node);
      if (BUILTINS.namespaces.has(path.split('.')[0]) && !this.methods.has(callee.name)) throw new PineCompileError(`unknown builtin '${path}'`, node);
    }
    if (callee.kind === 'Member') return this.compileMethodCall(node, scope);
    throw new PineCompileError('unsupported call target', node);
  }

  compileTypeCall(type, member, node, scope) {
    if (member === 'new') {
      const args = this.compileArguments(node, scope, type.fields.map(field => field.name));
      return (ctx, L) => {
        const [positional, named] = args(ctx, L);
        const fieldNamed = {};
        positional.forEach((value, index) => { if (value !== undefined) fieldNamed[type.fields[index].name] = value; });
        return type.create(ctx, [], { ...fieldNamed, ...named });
      };
    }
    if (member === 'copy') {
      const args = this.compileArguments(node, scope, ['id']);
      return (ctx, L) => { const [[value]] = args(ctx, L); return isNa(value) ? NaN : { ...value }; };
    }
    throw new PineCompileError(`unsupported type member ${type.name}.${member}`, node);
  }

  compileUserCall(fn, node, scope, receiver) {
    const params = fn.params;
    const args = this.compileArguments(node, scope, (receiver ? params.slice(1) : params).map(param => param.name));
    const site = this.site();
    const invoke = makeInvoker(fn);
    return (ctx, L) => {
      const [positional, named] = args(ctx, L);
      const values = receiver ? [receiver(ctx, L), ...positional] : positional;
      if (named !== NO_NAMED) for (const [key, value] of Object.entries(named)) {
        const index = params.findIndex(param => param.name === key);
        if (index < 0) throw new PineRuntimeError(`unknown argument '${key}' for ${fn.name}`, node.line);
        values[index] = value;
      }
      return invoke(ctx, site, values);
    };
  }

  compileLibraryCall(library, name, node, scope) {
    const exported = library.program.exports.get(name);
    if (!exported || exported.kind !== 'function') throw new PineCompileError(`library function ${name} is not exported`, node);
    return this.compileUserCall(exported.fn, node, scope, null);
  }

  // Best-effort static type of an expression, used where Pine dispatches on declared types
  // (methods called on a field that is currently na).
  staticType(node, scope) {
    switch (node?.kind) {
      case 'Ident': {
        const slot = scope.lookupLocal(node.name) ?? this.mainScope.names.get(node.name);
        return slot?.type ?? null;
      }
      case 'Member': {
        const owner = this.staticType(node.object, scope);
        const type = owner && this.lookupType(owner.name);
        return type?.fields.find(field => field.name === node.name)?.type ?? null;
      }
      case 'History': return this.staticType(node.target, scope);
      case 'Ternary': return this.staticType(node.whenTrue, scope) ?? this.staticType(node.whenFalse, scope);
      case 'Call': {
        const callee = node.callee;
        if (callee.kind === 'Member' && callee.name === 'new') {
          const typeName = callee.object.kind === 'Ident' ? callee.object.name : this.calleePath(callee.object, scope);
          if (typeName && this.lookupType(typeName)) return { name: typeName, args: [] };
          if (typeName === 'array' || typeName === 'map') return { name: typeName, args: callee.typeArgs ?? node.typeArgs ?? [] };
        }
        if (callee.kind === 'Member' && ['get', 'first', 'last', 'pop', 'shift', 'remove'].includes(callee.name)) {
          const ownerNode = callee.object.kind === 'Ident' && callee.object.name === 'array' ? node.args[0] : callee.object;
          const owner = this.staticType(ownerNode, scope);
          if (owner?.name === 'array' || owner?.name === 'map') return owner.args.at(-1) ?? null;
        }
        return null;
      }
      default: return null;
    }
  }

  enumByName(name) {
    if (this.enums.has(name)) return this.enums.get(name);
    for (const library of this.imports.values()) {
      const found = library.program.enumByName(name);
      if (found) return found;
    }
    return null;
  }

  lookupType(name) {
    if (this.types.has(name)) return this.types.get(name);
    const [alias, typeName] = name.split('.');
    const exported = typeName && this.imports.get(alias)?.program.exports.get(typeName);
    return exported?.kind === 'type' ? exported.type : null;
  }

  compileMethodCall(node, scope) {
    node.line ??= this.currentLine;
    const receiver = this.compileExpression(node.callee.object, scope);
    const name = node.callee.name;
    const declared = this.staticType(node.callee.object, scope);
    const userMethods = [...(this.methods.get(name) ?? [])];
    for (const library of this.imports.values()) {
      const exported = library.program.exports.get(name);
      if (exported?.kind === 'method') userMethods.push(exported.fn);
      for (const [, entry] of library.program.exports) if (entry.kind === 'method' && entry.fn.name === name && !userMethods.includes(entry.fn)) userMethods.push(entry.fn);
    }
    const typeMatches = (fnTypeName, typeName) => fnTypeName === typeName || fnTypeName?.split('.').at(-1) === typeName?.split('.').at(-1);
    if (declared) {
      const bound = userMethods.find(fn => typeMatches(fn.params[0]?.type?.name, declared.name));
      if (bound) return this.compileUserCall(bound, node, scope, receiver);
    }
    const userCalls = userMethods.map(fn => ({ fn, call: this.compileUserCall(fn, node, scope, receiver), typeName: fn.params[0]?.type?.name }));
    const builtinArgs = this.compileArguments(node, scope, null);
    return (ctx, L) => {
      const target = receiver(ctx, L);
      const typeName = typeNameOf(target);
      for (const candidate of userCalls) {
        if (candidate.typeName === typeName || candidate.typeName?.endsWith(`.${typeName}`) || userCalls.length === 1 && !MEMBER_NAMESPACES[typeName]) return candidate.call(ctx, L);
      }
      if (name === 'copy' && target?.__type) return { ...target };
      const namespace = MEMBER_NAMESPACES[typeName];
      const builtin = namespace && BUILTINS.functions.get(`${namespace}.${name}`);
      if (!builtin) throw new PineRuntimeError(`unknown method '${name}' for ${typeName}`, node.line);
      const [positional, named] = builtinArgs(ctx, L);
      return callBuiltin(builtin, ctx, [target, ...positional], named, node);
    };
  }

  compileBuiltinCall(builtin, path, node, scope) {
    node.line ??= this.currentLine;
    if (builtin.compile) return builtin.compile(this, node, scope);
    const args = this.compileArguments(node, scope, builtin.params);
    const site = this.site();
    const inputName = () => node.inputName;
    return (ctx, L) => {
      const [positional, named] = args(ctx, L);
      return callBuiltin(builtin, ctx, positional, named, node, site, inputName());
    };
  }
}

function callBuiltin(builtin, ctx, positional, named, node, site, inputName) {
  try {
    return builtin.impl(ctx, positional, named, { site, node, inputName });
  } catch (error) {
    if (error instanceof PineRuntimeError && !error.line && node?.line) {
      error.line = node.line;
      error.message = `${node.sourceName ?? ''}line ${node.line}: ${error.message}`;
    }
    throw error;
  }
}

// Pine v6 conditions must be bool; anything else would not compile in TradingView.
function requireBool(value, node) {
  if (typeof value !== 'boolean') throw new PineRuntimeError(`condition must be bool, got ${typeof value === 'number' && Number.isNaN(value) ? 'na' : typeof value}`, node.line);
  return value;
}

function makeInvoker(fn) {
  const params = fn.params;
  const slotCount = () => fn.info.slots.length;
  return (ctx, site, values) => {
    const parent = ctx.frame;
    const frame = parent.child(site);
    // History advances once per bar for every call site, like ta.*; repeated calls in one bar share a slot.
    frame.exec = ctx.i;
    const locals = new Array(slotCount());
    for (let i = 0; i < params.length; i++) {
      let value = values[i];
      if (value === undefined) value = params[i].defaultValue ? params[i].defaultValue(ctx, locals) : NaN;
      if (params[i].type?.name === 'int' && typeof value === 'number' && !Number.isInteger(value) && !Number.isNaN(value)) value = Math.trunc(value);
      locals[params[i].slot.index] = value;
    }
    ctx.frame = frame;
    const library = fn.program.libraryState;
    const swap = library && ctx.mainLocals !== library.locals;
    const savedLocals = ctx.mainLocals;
    const savedMainFrame = ctx.mainFrame;
    if (swap) { ctx.mainLocals = library.locals; ctx.mainFrame = library.frame; }
    try {
      for (let i = 0; i < params.length; i++) if (params[i].slot.tracked) seriesWrite(frame, `s${params[i].slot.index}`, locals[params[i].slot.index]);
      const result = fn.body(ctx, locals);
      ctx.flow = 0;
      return result;
    } finally {
      ctx.frame = parent;
      if (swap) { ctx.mainLocals = savedLocals; ctx.mainFrame = savedMainFrame; }
    }
  };
}

export { FLOW_BREAK, FLOW_CONTINUE };
