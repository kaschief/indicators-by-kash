import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSource, NAMESPACE_NAMES, RESERVED_NAMES, selectSources } from "./check-pine-identifiers.mjs";

const names = source => checkSource(source).map(finding => finding.value);
for (const name of new Set([...RESERVED_NAMES, ...NAMESPACE_NAMES])) {
    test(`reject declaration named ${name}`, () => {
        assert.deepEqual(names(`var SessionRange ${name} = na`), [name]);
    });
}
test("documented collision regressions independent of the production inventory", () => {
    // Explicit fixtures catch omissions that set-generated coverage cannot detect.
    for (const name of ["session", "text", "range", "order", "footprint", "volume_row"]) {
        assert.deepEqual(names(`var State ${name} = na`), [name]);
        assert.deepEqual(names(`render(State ${name}) => ${name}`), [name]);
        assert.deepEqual(names(`enum ${name}\n    item`), [name]);
    }
});

const forbiddenCases = [
    ["inferred object", "session = SessionRange.new()", ["session"]],
    ["scalar namespace policy", "float position = 0.5", ["position"]],
    ["exported constant", "export const string text = 'value'", ["text"]],
    ["tuple", "[good, session, text] = values()", ["session", "text"]],
    ["for counter", "for range = 0 to 2\n    doWork()", ["range"]],
    ["for item", "for session in sessions\n    use(session)", ["session"]],
    ["for tuple", "for [idx, text] in items\n    use(text)", ["text"]],
    ["object parameter", "render(SessionRange session, color bgColor) =>\n    session", ["session"]],
    ["untyped parameter", "render(text, value) => value", ["text"]],
    ["multiline parameters", "render(\n    array<map<string, lib.State>> session,\n    string text = str.format('{0}', close)\n) =>\n    true", ["session", "text"]],
    ["comparison in parameter default", "f(bool flag = 1 < 2, SessionRange session = na) => flag", ["session"]],
    ["method parameter", "export method render(lib.State session) => session", ["session"]],
    ["function name", "text() => 'value'", ["text"]],
    ["inline body", "render() => text = 'value'", ["text"]],
    ["multiple declarations", "safe = 1, text = 2", ["text"]],
    ["type name", "type session\n    float price", ["session"]],
    ["uninitialized field", "type State\n    array<float> text\n    lib.State session", ["text", "session"]],
    ["initialized field", "type State\n    float range = na", ["range"]],
    ["enum type", "enum line\n    safe", ["line"]],
    ["enum member", "enum State\n    text = 'Label'", ["text"]],
    ["import alias", "import owner/Library/1 as session", ["session"]],
    ["implicit import alias", "import owner/session/1", ["session"]],
];
for (const [label, source, expected] of forbiddenCases) {
    test(label, () => assert.deepEqual(names(source), expected));
}
const validCases = [
    ["legitimate built-ins", "inSession = not na(time(timeframe.period, session = '1800-2100'))\nlabel.new(bar_index, close, text = 'session', color = color.red)"],
    ["wrapped named arguments", "label.new(\n    bar_index, close,\n    text = 'text',\n    color = color.red\n)"],
    ["comments", "// SessionRange session = na\n// f(text) => text\nvalid = 1"],
    ["quoted text", "message = 'text = 1; session = State.new()'\nmessage2 = \"escaped \\\" text = 2\""],
    ["triple-quoted strings", "message = \"\"\"\ntext = 1\nf(SessionRange session) => session\n\"\"\"\nother = '''\nsession = na\n'''"],
    ["named defaults", "f(string labelText = str.format('{0}', close), color lineColor = color.red) => labelText"],
    ["case sensitive", "Text = 1\nSession = 2\nrangeState = 3"],
    ["discard tuple", "[_, safeValue, _] = getValues()"],
    ["reassignment/member access", "state.text := 'hello'\nstate.range += 1\nsessionState := otherState\nvalid = session.ismarket and close == open"],
    ["switch default after parentheses", "f() =>\n    switch mode\n        1 => showFlag and not (hidden and filled)\n        => false"],
    ["generic arrays", "var array<map<string, State>> states = array.new<map<string, State>>()"],
];
for (const [label, source] of validCases) test(label, () => assert.deepEqual(names(source), []));
test("source coordinates survive multiline strings", () => {
    const [finding] = checkSource('message = """\ntext = 0\n"""\n    var State session = na');
    assert.equal(finding.line, 4);
    assert.equal(finding.column, 15);
});
test("malformed source fails closed", () => {
    assert.throws(() => checkSource('message = "unterminated'), /Unterminated string/);
    assert.throws(() => checkSource('values = array.from(1, 2'), /Unclosed delimiter/);
});
test("staged checks read index content, including filenames with spaces", () => {
    // This isolated temporary repository never changes the user's repository state.
    const dir = mkdtempSync(join(tmpdir(), "pine-identifiers-test-"));
    const git = args => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
    try {
        git(["init", "--quiet"]);
        const file = "indicator with spaces.pine";
        writeFileSync(join(dir, file), "var State session = na\n");
        git(["add", "--", file]);
        writeFileSync(join(dir, file), "var State sessionState = na\n");
        const [staged] = selectSources(["--staged"], dir);
        assert.equal(staged.path, file);
        assert.deepEqual(names(staged.source), ["session"]);
        assert.deepEqual(names(selectSources([file], dir)[0].source), []);
        assert.equal(selectSources(["--all"], dir).length, 1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("CLI fails for a forbidden declaration", () => {
    const dir = mkdtempSync(join(tmpdir(), "pine-identifiers-cli-"));
    try {
        const file = join(dir, "fixture.pine");
        writeFileSync(file, "text = 1\n");
        const result = spawnSync(process.execPath, [new URL('./check-pine-identifiers.mjs', import.meta.url).pathname, file], { encoding: "utf8" });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /fixture\.pine:1:1: forbidden variable name 'text'/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
