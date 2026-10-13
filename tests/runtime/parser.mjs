import { logicalLines, PineSyntaxError } from './lexer.mjs';

const ASSIGN_OPS = new Set([':=', '+=', '-=', '*=', '/=', '%=']);
const QUALIFIERS = new Set(['const', 'simple', 'series']);
const BINARY_LEVELS = [
  ['or'], ['and'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%'],
];

class Tokens {
  constructor(tokens, line) { this.tokens = tokens; this.i = 0; this.line = line; }
  peek(offset = 0) { return this.tokens[this.i + offset]; }
  next() { return this.tokens[this.i++]; }
  done() { return this.i >= this.tokens.length; }
  is(value, offset = 0) {
    const token = this.peek(offset);
    return !!token && (token.type === 'op' || token.type === 'keyword') && token.value === value;
  }
  accept(value) { if (this.is(value)) { this.i++; return true; } return false; }
  expect(value) {
    if (!this.accept(value)) this.fail(`expected '${value}' but found ${this.describe()}`);
  }
  ident() {
    const token = this.next();
    if (!token || token.type !== 'ident') this.fail(`expected identifier but found ${token ? token.value : 'end of line'}`);
    return token.value;
  }
  describe() { const token = this.peek(); return token ? `'${token.value}'` : 'end of line'; }
  fail(message) { throw new PineSyntaxError(message, this.peek()?.line ?? this.line); }
  rest() { return this.tokens.slice(this.i); }
}

function findTopLevel(tokens, value, from = 0) {
  let depth = 0;
  for (let i = from; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'op') continue;
    if (token.value === '(' || token.value === '[') depth++;
    else if (token.value === ')' || token.value === ']') depth--;
    else if (depth === 0 && token.value === value) return i;
  }
  return -1;
}

export class Parser {
  constructor(source) {
    this.lines = logicalLines(source);
    this.pos = 0;
  }

  parseProgram() {
    const body = this.parseBlock(0);
    if (this.pos < this.lines.length) this.failLine(this.lines[this.pos], 'unexpected indentation');
    return { kind: 'Program', body };
  }

  failLine(line, message) { throw new PineSyntaxError(message, line.line); }

  parseBlock(indent) {
    const statements = [];
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.indent < indent) break;
      if (line.indent > indent) this.failLine(line, `unexpected indent ${line.indent} (block at ${indent})`);
      statements.push(this.parseStatement(line));
    }
    return statements;
  }

  childBlock(parent) {
    const next = this.lines[this.pos];
    if (!next || next.indent <= parent.indent) this.failLine(parent, 'expected an indented block');
    return this.parseBlock(next.indent);
  }

  parseStatement(line) {
    this.pos++;
    const t = new Tokens(line.tokens, line.line);
    const node = this.statementFrom(t, line);
    node.line = line.line;
    return node;
  }

  statementFrom(t, line) {
    let exported = false;
    if (t.is('export')) { t.next(); exported = true; }
    if (t.is('import')) return this.importStatement(t);
    if (t.is('type')) return this.typeDefinition(t, line, exported);
    if (t.is('enum')) return this.enumDefinition(t, line, exported);
    if (t.is('method')) { t.next(); return this.functionDefinition(t, line, exported, true); }
    if (this.isFunctionHeader(t)) return this.functionDefinition(t, line, exported, false);
    if (t.is('if')) { t.next(); return this.ifChain(t, line); }
    if (t.is('for')) { t.next(); return this.forLoop(t, line); }
    if (t.is('while')) {
      t.next();
      const cond = this.expression(t);
      this.endOfLine(t);
      return { kind: 'While', cond, body: this.childBlock(line) };
    }
    if (t.is('switch')) { t.next(); return this.switchBlock(t, line); }
    if (t.is('break')) { t.next(); return { kind: 'Break' }; }
    if (t.is('continue')) { t.next(); return { kind: 'Continue' }; }
    const statement = this.declarationOrExpression(t, line);
    if (exported) statement.exported = true;
    return statement;
  }

  endOfLine(t) { if (!t.done()) t.fail(`unexpected ${t.describe()}`); }

  importStatement(t) {
    t.next();
    const parts = [];
    while (!t.done() && !t.is('as')) parts.push(t.next().value);
    const path = parts.join('');
    let alias = path.split('/')[1];
    if (t.accept('as')) alias = t.ident();
    return { kind: 'Import', path, alias };
  }

  typeDefinition(t, line, exported) {
    t.next();
    const name = t.ident();
    this.endOfLine(t);
    const fields = [];
    const next = this.lines[this.pos];
    if (next && next.indent > line.indent) {
      const indent = next.indent;
      while (this.pos < this.lines.length && this.lines[this.pos].indent === indent) {
        const fieldLine = this.lines[this.pos++];
        const ft = new Tokens(fieldLine.tokens, fieldLine.line);
        if (ft.is('varip')) ft.next();
        const type = this.type(ft);
        const fieldName = ft.ident();
        let defaultValue = null;
        if (ft.accept('=')) defaultValue = this.expression(ft);
        this.endOfLine(ft);
        fields.push({ name: fieldName, type, defaultValue });
      }
    }
    return { kind: 'TypeDef', name, fields, exported };
  }

  enumDefinition(t, line, exported) {
    t.next();
    const name = t.ident();
    this.endOfLine(t);
    const members = [];
    const next = this.lines[this.pos];
    if (next && next.indent > line.indent) {
      const indent = next.indent;
      while (this.pos < this.lines.length && this.lines[this.pos].indent === indent) {
        const memberLine = this.lines[this.pos++];
        const mt = new Tokens(memberLine.tokens, memberLine.line);
        const member = mt.ident();
        let title = member;
        if (mt.accept('=')) title = mt.next().value;
        members.push({ name: member, title });
      }
    }
    return { kind: 'EnumDef', name, members, exported };
  }

  isFunctionHeader(t) {
    if (t.peek()?.type !== 'ident' || !t.is('(', 1)) return false;
    let depth = 0;
    for (let i = t.i + 1; i < t.tokens.length; i++) {
      const token = t.tokens[i];
      if (token.type !== 'op') continue;
      if (token.value === '(' || token.value === '[') depth++;
      if (token.value === ')' || token.value === ']') {
        depth--;
        if (depth === 0) return t.tokens[i + 1]?.type === 'op' && t.tokens[i + 1].value === '=>';
      }
    }
    return false;
  }

  functionDefinition(t, line, exported, isMethod) {
    const name = t.ident();
    t.expect('(');
    const params = [];
    while (!t.is(')')) {
      const param = { qualifier: null, type: null, name: null, defaultValue: null };
      if (t.peek()?.type === 'ident' && QUALIFIERS.has(t.peek().value) && t.peek(1)?.type === 'ident') param.qualifier = t.next().value;
      const save = t.i;
      const first = t.peek(1);
      const typed = !(first && first.type === 'op' && (first.value === ',' || first.value === ')' || first.value === '='));
      if (typed) param.type = this.type(t);
      else t.i = save;
      param.name = t.ident();
      if (t.accept('=')) param.defaultValue = this.expression(t);
      params.push(param);
      if (!t.accept(',')) break;
    }
    t.expect(')');
    t.expect('=>');
    let body;
    if (t.done()) body = this.childBlock(line);
    else {
      body = [this.inlineStatement(t, line)];
    }
    return { kind: 'FuncDef', name, params, body, exported, isMethod };
  }

  inlineStatement(t, line) {
    const statement = this.statementFrom(t, line);
    statement.line = line.line;
    return statement;
  }

  ifChain(t, line) {
    const branches = [];
    const cond = this.expression(t);
    this.endOfLine(t);
    branches.push({ cond, body: this.childBlock(line) });
    let elseBody = null;
    while (this.pos < this.lines.length) {
      const next = this.lines[this.pos];
      if (next.indent !== line.indent || !(next.tokens[0].type === 'keyword' && next.tokens[0].value === 'else')) break;
      this.pos++;
      const et = new Tokens(next.tokens, next.line);
      et.next();
      if (et.accept('if')) {
        const branchCond = this.expression(et);
        this.endOfLine(et);
        branches.push({ cond: branchCond, body: this.childBlock(next) });
      } else {
        this.endOfLine(et);
        elseBody = this.childBlock(next);
        break;
      }
    }
    return { kind: 'If', branches, elseBody };
  }

  forLoop(t, line) {
    if (t.is('[')) {
      t.next();
      const index = t.ident();
      t.expect(',');
      const item = t.ident();
      t.expect(']');
      t.expect('in');
      const iterable = this.expression(t);
      this.endOfLine(t);
      return { kind: 'ForIn', index, item, iterable, body: this.childBlock(line) };
    }
    const name = t.ident();
    if (t.accept('in')) {
      const iterable = this.expression(t);
      this.endOfLine(t);
      return { kind: 'ForIn', index: null, item: name, iterable, body: this.childBlock(line) };
    }
    t.expect('=');
    const from = this.expression(t);
    t.expect('to');
    const to = this.expression(t);
    let step = null;
    if (t.accept('by')) step = this.expression(t);
    this.endOfLine(t);
    return { kind: 'For', name, from, to, step, body: this.childBlock(line) };
  }

  switchBlock(t, line) {
    const subject = t.done() ? null : this.expression(t);
    this.endOfLine(t);
    const cases = [];
    const next = this.lines[this.pos];
    if (!next || next.indent <= line.indent) this.failLine(line, 'switch without cases');
    const indent = next.indent;
    while (this.pos < this.lines.length && this.lines[this.pos].indent === indent) {
      const caseLine = this.lines[this.pos++];
      const arrow = findTopLevel(caseLine.tokens, '=>');
      if (arrow < 0) this.failLine(caseLine, 'switch case without =>');
      const matchTokens = caseLine.tokens.slice(0, arrow);
      let match = null;
      if (matchTokens.length) {
        const mt = new Tokens(matchTokens, caseLine.line);
        match = this.expression(mt);
        this.endOfLine(mt);
      }
      const bodyTokens = caseLine.tokens.slice(arrow + 1);
      let body;
      if (bodyTokens.length) {
        const bt = new Tokens(bodyTokens, caseLine.line);
        body = [this.inlineStatement(bt, caseLine)];
      } else body = this.childBlock(caseLine);
      cases.push({ match, body });
    }
    return { kind: 'Switch', subject, cases };
  }

  // Block-valued right-hand sides: `x = if cond` / `x = switch value` with the body on later lines.
  blockExpression(t, line) {
    if (t.is('if')) { t.next(); return { ...this.ifChain(t, line), asExpression: true }; }
    if (t.is('switch')) { t.next(); return { ...this.switchBlock(t, line), asExpression: true }; }
    const value = this.expression(t);
    this.endOfLine(t);
    return value;
  }

  declarationOrExpression(t, line) {
    let mode = null;
    if (t.is('var') || t.is('varip')) mode = t.next().value;
    if (t.is('[')) {
      const afterClose = t.tokens[findMatching(t.tokens, t.i) + 1];
      if (afterClose && afterClose.type === 'op' && (afterClose.value === '=' || afterClose.value === ':=')) {
        t.next();
        const names = [];
        while (!t.is(']')) { names.push(t.ident()); if (!t.accept(',')) break; }
        t.expect(']');
        const op = t.next().value;
        return { kind: op === '=' ? 'TupleDecl' : 'TupleAssign', names, value: this.blockExpression(t, line) };
      }
    }
    const declaration = this.tryDeclarationHead(t);
    if (declaration) {
      const value = this.blockExpression(t, line);
      return { kind: 'VarDecl', mode, type: declaration.type, name: declaration.name, value };
    }
    if (mode) t.fail('expected a declaration after var');
    const target = this.expression(t);
    const op = t.peek();
    if (op && op.type === 'op' && ASSIGN_OPS.has(op.value)) {
      t.next();
      if (target.kind !== 'Ident' && target.kind !== 'Member') t.fail('invalid assignment target');
      return { kind: 'Assign', op: op.value, target, value: this.blockExpression(t, line) };
    }
    this.endOfLine(t);
    return { kind: 'ExprStmt', expr: target };
  }

  tryDeclarationHead(t) {
    const save = t.i;
    if (t.peek()?.type === 'ident' && QUALIFIERS.has(t.peek().value) && t.peek(1)?.type === 'ident') t.next();
    if (t.peek()?.type === 'ident' && t.is('=', 1)) {
      const name = t.ident();
      t.next();
      return { type: null, name };
    }
    try {
      const type = this.type(t);
      if (t.peek()?.type === 'ident' && t.is('=', 1)) {
        const name = t.ident();
        t.next();
        return { type, name };
      }
    } catch (error) {
      if (!(error instanceof PineSyntaxError)) throw error;
    }
    t.i = save;
    return null;
  }

  type(t) {
    let name = t.ident();
    while (t.is('.') && t.peek(1)?.type === 'ident') { t.next(); name += `.${t.ident()}`; }
    const args = [];
    if (t.is('<')) {
      t.next();
      while (!t.is('>')) { args.push(this.type(t)); if (!t.accept(',')) break; }
      t.expect('>');
    }
    let arrayOf = false;
    if (t.is('[') && t.is(']', 1)) { t.next(); t.next(); arrayOf = true; }
    const type = { name, args };
    return arrayOf ? { name: 'array', args: [type] } : type;
  }

  // EXPRESSIONS

  expression(t) { return this.ternary(t); }

  ternary(t) {
    const cond = this.binary(t, 0);
    if (!t.accept('?')) return cond;
    const whenTrue = this.ternary(t);
    t.expect(':');
    const whenFalse = this.ternary(t);
    return { kind: 'Ternary', cond, whenTrue, whenFalse };
  }

  binary(t, level) {
    if (level >= BINARY_LEVELS.length) return this.unary(t);
    let left = this.binary(t, level + 1);
    for (;;) {
      const token = t.peek();
      if (!token || !(token.type === 'op' || token.type === 'keyword') || !BINARY_LEVELS[level].includes(token.value)) return left;
      t.next();
      left = { kind: 'Binary', op: token.value, left, right: this.binary(t, level + 1) };
    }
  }

  unary(t) {
    if (t.is('not')) { t.next(); return { kind: 'Unary', op: 'not', arg: this.unary(t) }; }
    if (t.is('-') || t.is('+')) { const op = t.next().value; return { kind: 'Unary', op, arg: this.unary(t) }; }
    return this.postfix(t);
  }

  postfix(t) {
    let node = this.primary(t);
    for (;;) {
      if (t.is('.')) {
        t.next();
        const member = t.next();
        if (!member || (member.type !== 'ident' && member.type !== 'keyword')) t.fail('expected a member name');
        node = { kind: 'Member', object: node, name: member.value };
      } else if (t.is('<') && (node.kind === 'Member' || node.kind === 'Ident') && this.genericAhead(t)) {
        t.next();
        const typeArgs = [];
        while (!t.is('>')) { typeArgs.push(this.type(t)); if (!t.accept(',')) break; }
        t.expect('>');
        node = { ...node, typeArgs };
      } else if (t.is('(')) {
        t.next();
        node = { kind: 'Call', callee: node, args: [], named: {}, typeArgs: node.typeArgs ?? null };
        while (!t.is(')')) {
          if (t.peek()?.type === 'ident' && t.is('=', 1)) {
            const name = t.ident();
            t.next();
            node.named[name] = this.expression(t);
          } else node.args.push(this.expression(t));
          if (!t.accept(',')) break;
        }
        t.expect(')');
      } else if (t.is('[')) {
        t.next();
        const offset = this.expression(t);
        t.expect(']');
        node = { kind: 'History', target: node, offset };
      } else return node;
    }
  }

  genericAhead(t) {
    let depth = 0;
    for (let i = t.i; i < t.tokens.length; i++) {
      const token = t.tokens[i];
      if (token.type === 'op' && token.value === '<') depth++;
      else if (token.type === 'op' && token.value === '>') { depth--; if (depth === 0) return t.tokens[i + 1]?.type === 'op' && t.tokens[i + 1].value === '('; }
      else if (!(token.type === 'ident' || (token.type === 'op' && (token.value === ',' || token.value === '.' || token.value === '[' || token.value === ']')))) return false;
    }
    return false;
  }

  primary(t) {
    const token = t.next();
    if (!token) t.fail('unexpected end of line');
    switch (token.type) {
      case 'number': return { kind: 'Num', value: token.value, isFloat: token.isFloat };
      case 'string': return { kind: 'Str', value: token.value };
      case 'color': return { kind: 'Color', value: token.value };
      case 'ident': return { kind: 'Ident', name: token.value, line: token.line };
      case 'keyword':
        if (token.value === 'true' || token.value === 'false') return { kind: 'Bool', value: token.value === 'true' };
        break;
      case 'op':
        if (token.value === '(') { const inner = this.expression(t); t.expect(')'); return inner; }
        if (token.value === '[') {
          const items = [];
          while (!t.is(']')) { items.push(this.expression(t)); if (!t.accept(',')) break; }
          t.expect(']');
          return { kind: 'Tuple', items };
        }
        break;
      default: break;
    }
    throw new PineSyntaxError(`unexpected '${token.value}'`, token.line);
  }
}

function findMatching(tokens, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== 'op') continue;
    if (token.value === '(' || token.value === '[') depth++;
    if (token.value === ')' || token.value === ']') { depth--; if (depth === 0) return i; }
  }
  return tokens.length;
}

export function parse(source) {
  return new Parser(source).parseProgram();
}
