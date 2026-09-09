import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Sources and the distinction between compiler restrictions and repository policy:
// scripts/PINE-IDENTIFIER-RULES.md
export const RESERVED_NAMES = new Set(`
    and as bool break by catch class color const continue do ellipse else enum export
    false float for if import in int is matrix method na not or polygon range return
    series simple string struct switch text throw to true try type var varip void while
`.trim().split(/\s+/));

export const NAMESPACE_NAMES = new Set(`
    adjustment alert array backadjustment barmerge barstate box chart color currency
    dayofweek display dividends earnings extend font footprint format hline input label line
    linefill location log map math matrix order plot polyline position request runtime scale
    session settlement_as_close shape size splits str strategy syminfo ta table text
    timeframe ticker volume_row xloc yloc
`.trim().split(/\s+/));

export function tokenize(source) {
    const tokens = [];
    let offset = 0;
    let line = 1;
    let column = 1;
    const advance = () => {
        const char = source[offset++];
        if (char === "\n") { line++; column = 1; }
        else { column++; }
        return char;
    };
    while (offset < source.length) {
        const char = source[offset];
        if (/\s/.test(char)) { advance(); continue; }
        if (source.startsWith("//", offset)) {
            while (offset < source.length && source[offset] !== "\n") advance();
            continue;
        }
        const token = { value: "", line, column, kind: "symbol" };
        if (char === '"' || char === "'") {
            const delimiter = source.startsWith(char.repeat(3), offset) ? char.repeat(3) : char;
            for (let i = 0; i < delimiter.length; i++) advance();
            let closed = false;
            while (offset < source.length) {
                if (source.startsWith(delimiter, offset)) {
                    for (let i = 0; i < delimiter.length; i++) advance();
                    closed = true;
                    break;
                }
                if (advance() === "\\" && offset < source.length) advance();
            }
            if (!closed) throw new Error(`Unterminated string at ${token.line}:${token.column}`);
            token.kind = "string";
            token.value = "<string>";
        } else if (/[A-Za-z_]/.test(char)) {
            token.kind = "identifier";
            while (offset < source.length && /[A-Za-z_0-9]/.test(source[offset])) token.value += advance();
        } else if (/\d/.test(char)) {
            token.kind = "number";
            while (offset < source.length && /[\d.]/.test(source[offset])) token.value += advance();
        } else {
            const pair = source.slice(offset, offset + 2);
            if (["=>", ":=", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%="].includes(pair)) token.value = advance() + advance();
            else token.value = advance();
        }
        tokens.push(token);
    }
    return tokens;
}

export function checkSource(source) {
    const tokens = tokenize(source);
    const findings = new Map();
    const report = (index, role) => {
        const token = tokens[index];
        if (!token || token.kind !== "identifier") return;
        const category = RESERVED_NAMES.has(token.value) ? "reserved keyword/type" :
            NAMESPACE_NAMES.has(token.value) ? "built-in namespace (repository no-shadowing rule)" : null;
        if (category && !findings.has(index)) findings.set(index, { ...token, role, category });
    };
    const matches = new Map();
    const stack = [];
    const parenDepth = [];
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const value = tokens[i].value;
        parenDepth[i] = depth;
        if (value === "(" || value === "[") {
            stack.push(i);
            if (value === "(") depth++;
        } else if (value === ")" || value === "]") {
            const start = stack.pop();
            if (start === undefined || tokens[start].value !== (value === ")" ? "(" : "[")) {
                throw new Error(`Unmatched ${value} at ${tokens[i].line}:${tokens[i].column}`);
            }
            matches.set(start, i);
            matches.set(i, start);
            if (value === ")") depth--;
        }
    }
    if (stack.length) throw new Error(`Unclosed delimiter at ${tokens[stack[0]].line}:${tokens[stack[0]].column}`);

    const reportTuple = (start, end, role) => {
        for (let i = start + 1; i < end; i++) {
            if (tokens[i].kind === "identifier") report(i, role);
        }
    };
    const reportParameter = (start, end) => {
        let genericDepth = 0;
        for (let i = start; i < end; i++) {
            if (tokens[i].value === "<") genericDepth++;
            if (tokens[i].value === ">") genericDepth--;
            if (tokens[i].value === "=" && genericDepth === 0) { end = i; break; }
        }
        for (let i = end - 1; i >= start; i--) {
            if (tokens[i].kind === "identifier") { report(i, "parameter"); break; }
        }
    };
    // Function definitions are distinguished from calls by the following => token.
    for (let open = 0; open < tokens.length; open++) {
        if (tokens[open].value !== "(") continue;
        const close = matches.get(open);
        if (tokens[close + 1]?.value !== "=>") continue;
        let head = open - 1;
        while (head > 0 && tokens[head - 1].line === tokens[open - 1].line) head--;
        const prefix = tokens.slice(head, open - 1).map(token => token.value);
        if (tokens[open - 1]?.kind !== "identifier" || prefix.some(value => !["export", "method"].includes(value))) continue;
        report(open - 1, "function/method");
        let start = open + 1;
        let genericDepth = 0;
        let inDefault = false;
        for (let i = start; i < close; i++) {
            const value = tokens[i].value;
            if (value === "(" || value === "[") { i = matches.get(i); continue; }
            if (value === "=" && genericDepth === 0) inDefault = true;
            if (!inDefault && value === "<") genericDepth++;
            if (!inDefault && value === ">") genericDepth--;
            if (value === "," && genericDepth === 0) {
                reportParameter(start, i);
                start = i + 1;
                inDefault = false;
            }
        }
        reportParameter(start, close);
    }
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.value === "=" && parenDepth[i] === 0) {
            if (tokens[i - 1]?.value === "]") reportTuple(matches.get(i - 1), i - 1, "tuple variable");
            else if (tokens[i - 2]?.value !== ".") report(i - 1, "variable");
        }
        if (token.value === "for") {
            if (tokens[i + 1]?.value === "[") reportTuple(i + 1, matches.get(i + 1), "loop variable");
            else report(i + 1, "loop variable");
        }
        if (token.value === "import" && (i === 0 || tokens[i - 1].line < token.line)) {
            let end = i + 1;
            while (end < tokens.length && tokens[end].line === token.line) end++;
            const alias = tokens.slice(i, end).findIndex(t => t.value === "as");
            if (alias >= 0) report(i + alias + 1, "import alias");
            else if (end - i >= 5) report(end - 3, "implicit import alias");
        }
        if (["type", "enum"].includes(token.value) && (i === 0 || tokens[i - 1].line < token.line || tokens[i - 1].value === "export")) {
            report(i + 1, `${token.value} name`);
            const headerColumn = tokens[i - 1]?.value === "export" ? tokens[i - 1].column : token.column;
            let fieldStart = i + 2;
            while (fieldStart < tokens.length && tokens[fieldStart].line === token.line) fieldStart++;
            while (fieldStart < tokens.length && tokens[fieldStart].column > headerColumn) {
                let end = fieldStart + 1;
                while (end < tokens.length && tokens[end].line === tokens[fieldStart].line) end++;
                if (token.value === "enum") report(fieldStart, "enum member");
                else {
                    const equals = tokens.slice(fieldStart, end).findIndex(t => t.value === "=");
                    const fieldEnd = equals >= 0 ? fieldStart + equals : end;
                    report(fieldEnd - 1, "type field");
                }
                fieldStart = end;
            }
        }
    }
    return [...findings.values()].sort((a, b) => a.line - b.line || a.column - b.column);
}

export function selectSources(args, root = repoRoot) {
    const git = values => execFileSync("git", values, { cwd: root, encoding: "utf8" });
    if (args.length === 1 && args[0] === "--staged") {
        return git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--", ":(glob)**/*.pine"])
            .split("\0").filter(Boolean).map(path => ({ path, source: git(["show", `:${path}`]) }));
    }
    let paths = args;
    if (args.length === 1 && args[0] === "--all") {
        paths = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ":(glob)**/*.pine"])
            .split("\0").filter(Boolean);
    } else if (args.length === 0 || args.some(arg => arg.startsWith("--"))) {
        throw new Error("Usage: node scripts/check-pine-identifiers.mjs <file.pine> [...] | --staged | --all");
    }
    return [...new Set(paths)].map(path => ({ path: relative(root, resolve(root, path)), source: readFileSync(resolve(root, path), "utf8") }));
}

export function main(args = process.argv.slice(2)) {
    try {
        const sources = selectSources(args);
        let count = 0;
        for (const { path, source } of sources) {
            for (const finding of checkSource(source)) {
                console.error(`${path}:${finding.line}:${finding.column}: forbidden ${finding.role} name '${finding.value}' — ${finding.category}`);
                count++;
            }
        }
        if (count) {
            console.error(`FAIL: ${count} forbidden Pine identifier(s). Use descriptive names such as sessionState, labelText, or rangeState.`);
            return 1;
        }
        console.log(`PASS: Pine identifier declarations (${sources.length} file${sources.length === 1 ? "" : "s"})`);
        return 0;
    } catch (error) {
        console.error(`FAIL: ${error.message}`);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
