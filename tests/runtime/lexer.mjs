// Splits Pine source into logical lines of tokens. A physical line joins the previous one
// when brackets are still open or when its indent is not a multiple of four (Pine's
// line-wrapping rule).

const KEYWORDS = new Set([
  'and', 'or', 'not', 'if', 'else', 'for', 'to', 'by', 'in', 'while', 'switch', 'var', 'varip',
  'true', 'false', 'import', 'export', 'method', 'type', 'enum', 'break', 'continue', 'as',
]);

const OPERATORS = [':=', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '=>',
  '=', '<', '>', '+', '-', '*', '/', '%', '?', ':', ',', '.', '(', ')', '[', ']'];

export class PineSyntaxError extends Error {
  constructor(message, line) {
    super(`line ${line}: ${message}`);
    this.line = line;
  }
}

function tokenizeLine(text, lineNumber) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '/' && text[i + 1] === '/') break;
    const start = i;
    if (ch === '"' || ch === "'") {
      let value = '';
      i++;
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') {
          const next = text[i + 1];
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
        } else value += text[i++];
      }
      if (i >= text.length) throw new PineSyntaxError('unterminated string', lineNumber);
      i++;
      tokens.push({ type: 'string', value, line: lineNumber, col: start });
      continue;
    }
    if (ch === '#' && /[0-9a-fA-F]/.test(text[i + 1] ?? '')) {
      const match = text.slice(i).match(/^#([0-9a-fA-F]{8}|[0-9a-fA-F]{6})/);
      if (!match) throw new PineSyntaxError(`bad color literal ${text.slice(i, i + 9)}`, lineNumber);
      tokens.push({ type: 'color', value: match[1], line: lineNumber, col: start });
      i += match[0].length;
      continue;
    }
    const number = text.slice(i).match(/^(?:\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/);
    if (number && /[\d.]/.test(ch)) {
      tokens.push({ type: 'number', value: Number(number[0]), isFloat: /[.eE]/.test(number[0]), line: lineNumber, col: start });
      i += number[0].length;
      continue;
    }
    const word = text.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (word) {
      const value = word[0];
      tokens.push({ type: KEYWORDS.has(value) ? 'keyword' : 'ident', value, line: lineNumber, col: start });
      i += value.length;
      continue;
    }
    const op = OPERATORS.find(candidate => text.startsWith(candidate, i));
    if (!op) throw new PineSyntaxError(`unexpected character ${JSON.stringify(ch)}`, lineNumber);
    tokens.push({ type: 'op', value: op, line: lineNumber, col: start });
    i += op.length;
  }
  return tokens;
}

function bracketDelta(tokens) {
  let delta = 0;
  for (const token of tokens) {
    if (token.type !== 'op') continue;
    if (token.value === '(' || token.value === '[') delta++;
    if (token.value === ')' || token.value === ']') delta--;
  }
  return delta;
}

export function logicalLines(source) {
  const physical = source.replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  let open = null;
  let depth = 0;
  for (let index = 0; index < physical.length; index++) {
    const raw = physical[index];
    const lineNumber = index + 1;
    const tokens = tokenizeLine(raw, lineNumber);
    if (!tokens.length) continue;
    const indentText = raw.match(/^[ \t]*/)[0];
    const indent = indentText.replace(/\t/g, '    ').length;
    const continuation = open && (depth > 0 || indent % 4 !== 0);
    if (continuation) {
      open.tokens.push(...tokens);
    } else {
      open = { indent, tokens, line: lineNumber };
      lines.push(open);
      depth = 0;
    }
    depth += bracketDelta(tokens);
  }
  return lines;
}
