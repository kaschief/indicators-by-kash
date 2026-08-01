import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(repoRoot, "TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md");
const hostPath = resolve(repoRoot, "indicators/20-revelio/code/development/indicator/revelio.pine");
const titleCheckerPath = resolve(repoRoot, "scripts/check-pine-indicator-titles.mjs");
const registry = readFileSync(registryPath, "utf8");
const host = readFileSync(hostPath, "utf8");

function section(startMarker, endMarker) {
    const start = registry.indexOf(startMarker);
    const end = registry.indexOf(endMarker);
    if (start < 0 || end < 0 || end <= start) {
        throw new Error(`Missing registry section ${startMarker}`);
    }
    return registry.slice(start + startMarker.length, end);
}

function tableRows(markdown) {
    const lines = markdown.split(/\r?\n/).filter(line => line.trim().startsWith("|"));
    if (lines.length < 3) {
        throw new Error("Registry table is empty");
    }
    const cells = line => line.split("|").slice(1, -1).map(value => value.trim().replace(/^`|`$/g, ""));
    const headers = cells(lines[0]);
    return lines.slice(2).map(line => Object.fromEntries(headers.map((header, index) => [header, cells(line)[index]])));
}

function sha256(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function versionNumber(value) {
    return value === "—" ? null : Number(value);
}

const currentRows = tableRows(section("<!-- VERSION_REGISTRY_CURRENT_START -->", "<!-- VERSION_REGISTRY_CURRENT_END -->"));
const instructionRows = tableRows(section("<!-- VERSION_REGISTRY_INSTRUCTIONS_START -->", "<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->"));
const failures = [];

try {
    execFileSync(process.execPath, [titleCheckerPath, hostPath], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
} catch (error) {
    const detail = typeof error.stderr === "string" ? error.stderr.trim() : "";
    failures.push("Revelio host title check failed" + (detail ? ": " + detail : ""));
}

for (const row of currentRows) {
    const library = row.Library;
    const highestPublished = versionNumber(row["Highest published"]);
    const pendingVersion = versionNumber(row["Pending version"]);
    const developmentImport = versionNumber(row["Development import"]);
    const productionImport = versionNumber(row["Production import"]);
    const importMatch = host.match(new RegExp(`import\\s+midnightpaws87/${library}/(\\d+)\\s+as\\s+`));
    const actualImport = importMatch ? Number(importMatch[1]) : null;

    if (actualImport !== developmentImport) {
        failures.push(`${library}: host imports /${actualImport ?? "missing"}, registry requires /${developmentImport}`);
    }

    if (pendingVersion !== null) {
        if (pendingVersion !== highestPublished + 1) {
            failures.push(`${library}: pending /${pendingVersion} is not highest published /${highestPublished} + 1`);
        }
        if (developmentImport !== pendingVersion) {
            failures.push(`${library}: development import /${developmentImport} does not match pending /${pendingVersion}`);
        }
        const sourcePath = resolve(repoRoot, row.Source);
        const actualHash = sha256(sourcePath);
        if (actualHash !== row["Pending SHA-256"]) {
            failures.push(`${library}: source fingerprint changed; registry=${row["Pending SHA-256"]}, actual=${actualHash}`);
        }
        const pendingInstructions = instructionRows.filter(instruction => instruction.Library === library && Number(instruction.Version) === pendingVersion && instruction.Result === "CURRENT_PENDING");
        if (pendingInstructions.length !== 1) {
            failures.push(`${library}: expected exactly one CURRENT_PENDING instruction for /${pendingVersion}, found ${pendingInstructions.length}`);
        }
        if (!registry.includes(`Copy-ready \`/${pendingVersion}\` version notes`)) {
            failures.push(`${library}: pending /${pendingVersion} is missing copy-ready version notes`);
        }
    } else {
        if (row["Pending SHA-256"] !== "—") {
            failures.push(`${library}: stable row must not carry a pending fingerprint`);
        }
        if (developmentImport !== highestPublished) {
            failures.push(`${library}: stable development import /${developmentImport} must match highest published /${highestPublished}`);
        }
        if (productionImport !== highestPublished) {
            failures.push(`${library}: stable production import /${productionImport} must match highest published /${highestPublished}`);
        }
        const stalePendingInstructions = instructionRows.filter(instruction => instruction.Library === library && instruction.Result === "CURRENT_PENDING");
        if (stalePendingInstructions.length !== 0) {
            failures.push(`${library}: stable row has ${stalePendingInstructions.length} stale CURRENT_PENDING instruction(s)`);
        }
    }
}

if (failures.length > 0) {
    console.error("TradingView library version registry check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

for (const row of currentRows) {
    const pending = row["Pending version"] === "—" ? "none" : `/${row["Pending version"]}`;
    console.log(`PASS ${row.Library}: highest published /${row["Highest published"]}, pending ${pending}, development import /${row["Development import"]}, production import /${row["Production import"]}`);
}
