import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = resolve(repoRoot, "TRADINGVIEW-LIBRARY-VERSION-REGISTRY.md");
const titleCheckerPath = resolve(repoRoot, "scripts/check-pine-indicator-titles.mjs");
const registry = readFileSync(registryPath, "utf8");

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

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

const currentRows = tableRows(section("<!-- VERSION_REGISTRY_CURRENT_START -->", "<!-- VERSION_REGISTRY_CURRENT_END -->"));
const historyRows = tableRows(section("## Publication history", "## Publication-instruction log"));
const instructionRows = tableRows(section("<!-- VERSION_REGISTRY_INSTRUCTIONS_START -->", "<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->"));
const pendingNotes = section("## Pending release notes", "## Invariants");
const failures = [];
const currentLibraries = new Set();
const instructionIds = new Set();

for (const row of instructionRows) {
    const instructionId = row["Instruction ID"];
    if (!instructionId) {
        failures.push("Publication instruction is missing an Instruction ID");
    } else if (instructionIds.has(instructionId)) {
        failures.push(`${instructionId}: duplicate publication instruction ID`);
    }
    instructionIds.add(instructionId);
}

for (const host of new Set(currentRows.map(row => row.Host))) {
    const hostPath = resolve(repoRoot, host);
    try {
        execFileSync(process.execPath, [titleCheckerPath, hostPath], { cwd: repoRoot, encoding: "utf8", stdio: "pipe" });
    } catch (error) {
        const detail = typeof error.stderr === "string" ? error.stderr.trim() : "";
        failures.push(`${host}: title check failed` + (detail ? ": " + detail : ""));
    }
}

for (const row of currentRows) {
    const library = row.Library;
    const highestPublished = versionNumber(row.Published);
    const pendingVersion = versionNumber(row.Pending);
    const developmentImport = pendingVersion ?? highestPublished;
    const hostPath = resolve(repoRoot, row.Host);
    const activeHost = readFileSync(hostPath, "utf8")
        .split(/\r?\n/)
        .map(line => line.replace(/\/\/.*$/, ""))
        .join("\n");
    const importMatches = [...activeHost.matchAll(new RegExp(`^\\s*import\\s+midnightpaws87/${library}/(\\d+)\\s+as\\s+\\w+\\s*$`, "gm"))];
    const actualImport = importMatches.length === 1 ? Number(importMatches[0][1]) : null;

    if (currentLibraries.has(library)) {
        failures.push(`${library}: duplicate current-state row`);
    }
    currentLibraries.add(library);

    if (highestPublished !== null && !isPositiveInteger(highestPublished)) {
        failures.push(`${library}: Published must be a positive integer or —`);
    }
    if (pendingVersion !== null && !isPositiveInteger(pendingVersion)) {
        failures.push(`${library}: Pending must be a positive integer or —`);
    }

    const publishedHistoryVersions = historyRows
        .filter(history => history.Library === library && history.Status.startsWith("Published"))
        .map(history => Number(history.Version))
        .filter(isPositiveInteger);
    const historyHighestPublished = publishedHistoryVersions.length > 0 ? Math.max(...publishedHistoryVersions) : null;
    if (historyHighestPublished !== highestPublished) {
        failures.push(`${library}: Published /${highestPublished} does not match history maximum /${historyHighestPublished ?? "missing"}`);
    }
    if (highestPublished === null && pendingVersion !== 1) {
        failures.push(`${library}: an unpublished library must begin with pending /1`);
    }

    if (importMatches.length !== 1) {
        failures.push(`${library}: expected exactly one active host import, found ${importMatches.length}`);
    } else if (actualImport !== developmentImport) {
        failures.push(`${library}: host imports /${actualImport ?? "missing"}, registry requires /${developmentImport}`);
    }

    if (pendingVersion !== null) {
        const occupiedHistoryVersions = historyRows
            .filter(history => history.Library === library && history.Status !== "Pending publication")
            .map(history => Number(history.Version))
            .filter(isPositiveInteger);
        const highestOccupiedVersion = occupiedHistoryVersions.length > 0 ? Math.max(...occupiedHistoryVersions) : highestPublished ?? 0;
        if (pendingVersion !== highestOccupiedVersion + 1) {
            failures.push(`${library}: pending /${pendingVersion} is not highest recorded /${highestOccupiedVersion} + 1`);
        }
        if (developmentImport !== pendingVersion) {
            failures.push(`${library}: development import /${developmentImport} does not match pending /${pendingVersion}`);
        }
        const pendingHistory = historyRows.filter(history => history.Library === library && Number(history.Version) === pendingVersion && history.Status === "Pending publication");
        if (pendingHistory.length !== 1) {
            failures.push(`${library}: expected exactly one pending history row for /${pendingVersion}, found ${pendingHistory.length}`);
        }
        const pendingFingerprint = pendingHistory[0]?.["Source fingerprint"];
        const sourcePath = resolve(repoRoot, row.Source);
        const actualHash = sha256(sourcePath);
        if (actualHash !== pendingFingerprint) {
            failures.push(`${library}: source fingerprint changed; registry=${pendingFingerprint ?? "missing"}, actual=${actualHash}`);
        }
        const pendingInstructions = instructionRows.filter(instruction => instruction.Library === library && instruction.Result === "CURRENT_PENDING");
        const pendingInstructionVersion = pendingInstructions.length === 1 ? Number(pendingInstructions[0].Version) : null;
        if (pendingInstructions.length !== 1 || pendingInstructionVersion !== pendingVersion) {
            failures.push(`${library}: expected one CURRENT_PENDING instruction for /${pendingVersion}; found ${pendingInstructions.length} with version /${pendingInstructionVersion ?? "missing"}`);
        }
        const notesHeading = `### ${library} \`/${pendingVersion}\``;
        const headingCount = pendingNotes.split(notesHeading).length - 1;
        const notesAfterHeading = headingCount === 1 ? pendingNotes.slice(pendingNotes.indexOf(notesHeading) + notesHeading.length) : "";
        const noteBlock = notesAfterHeading.match(/^\s*```text\r?\n([\s\S]*?)\r?\n```/);
        if (headingCount !== 1 || !noteBlock || noteBlock[1].trim().length === 0) {
            failures.push(`${library}: pending /${pendingVersion} is missing copy-ready version notes`);
        }
    } else {
        if (highestPublished === null) {
            failures.push(`${library}: a stable library requires a published version`);
        }
        if (developmentImport !== highestPublished) {
            failures.push(`${library}: stable development import /${developmentImport} must match highest published /${highestPublished}`);
        }
        const stalePendingInstructions = instructionRows.filter(instruction => instruction.Library === library && instruction.Result === "CURRENT_PENDING");
        if (stalePendingInstructions.length !== 0) {
            failures.push(`${library}: stable row has ${stalePendingInstructions.length} stale CURRENT_PENDING instruction(s)`);
        }
    }
}

const requiredLibraries = new Set([
    ...historyRows.filter(history => history.Status.startsWith("Published")).map(history => history.Library),
    ...instructionRows.filter(instruction => instruction.Result === "CURRENT_PENDING").map(instruction => instruction.Library),
]);
for (const library of requiredLibraries) {
    if (!currentLibraries.has(library)) {
        failures.push(`${library}: missing current-state row`);
    }
}

if (failures.length > 0) {
    console.error("TradingView library version registry check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

for (const row of currentRows) {
    const pending = row.Pending === "—" ? "none" : `/${row.Pending}`;
    const developmentImport = row.Pending === "—" ? row.Published : row.Pending;
    const published = row.Published === "—" ? "none" : `/${row.Published}`;
    console.log(`PASS ${row.Library}: published ${published}, pending ${pending}, host import /${developmentImport}`);
}
