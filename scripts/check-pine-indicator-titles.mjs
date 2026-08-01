import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indicatorDeclarationPattern = /^\s*indicator\s*\(/mu;
const indicatorArgumentPattern = /^\s*indicator\s*\(\s*(?:title\s*=\s*)?(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([A-Za-z_]\w*))/mu;
const validTitlePattern = /^[^\s•](?:[^•]*[^\s•])? •(?: development)?$/u;

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveIndicatorTitle(source) {
    const argumentMatch = source.match(indicatorArgumentPattern);
    if (!argumentMatch) return null;
    if (argumentMatch[1] !== undefined) return argumentMatch[1];
    if (argumentMatch[2] !== undefined) return argumentMatch[2];

    const variableName = argumentMatch[3];
    const assignmentPattern = new RegExp("^\\s*" + escapeRegExp(variableName) + "\\s*=\\s*([\"'])(.*?)\\1\\s*$", "mu");
    const assignmentMatch = source.match(assignmentPattern);
    return assignmentMatch ? assignmentMatch[2] : null;
}

function stagedSources() {
    const output = execFileSync(
        "git",
        ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z", "--", ":(glob)**/*.pine"],
        { cwd: repoRoot, encoding: "utf8" },
    );
    const paths = output.split("\0").filter(Boolean);
    return paths.map(path => ({
        label: path,
        source: execFileSync("git", ["show", ":" + path], { cwd: repoRoot, encoding: "utf8" }),
    }));
}

function workingTreeSources(paths) {
    return paths.map(path => {
        const absolutePath = resolve(repoRoot, path);
        return {
            label: relative(repoRoot, absolutePath),
            source: readFileSync(absolutePath, "utf8"),
        };
    });
}

const args = process.argv.slice(2);
let sources;

if (args.length === 1 && args[0] === "--staged") {
    sources = stagedSources();
} else if (args.length > 0 && args.every(arg => !arg.startsWith("--"))) {
    sources = workingTreeSources(args);
} else {
    console.error("Usage: node scripts/check-pine-indicator-titles.mjs --staged");
    console.error("   or: node scripts/check-pine-indicator-titles.mjs <file.pine> [file.pine ...]");
    process.exit(2);
}

let failures = 0;
let checkedIndicators = 0;

for (const { label, source } of sources) {
    if (!indicatorDeclarationPattern.test(source)) continue;
    checkedIndicators += 1;
    const title = resolveIndicatorTitle(source);
    if (title === null) {
        console.error(`FAIL ${label}: could not resolve the indicator title`);
        failures += 1;
    } else if (!validTitlePattern.test(title)) {
        console.error(`FAIL ${label}: invalid title ${JSON.stringify(title)}; expected "<indicator name> • development" or "<indicator name> •"`);
        failures += 1;
    } else {
        console.log(`PASS ${label}: ${title}`);
    }
}

if (failures > 0) process.exit(1);
if (checkedIndicators === 0) console.log("PASS: no indicator sources to check");
