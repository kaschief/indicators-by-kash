# TradingView Library Version Registry

Updated: 2026-08-01

This is the repository's single source of truth for TradingView library versions, publication status, publication instructions, source fingerprints, and required host imports. Pine imports are executable references, but version decisions and publication history are authoritative only here. Historical trackers must link here instead of maintaining a second current-version ledger.

## Required workflow

1. Read this file before changing a library, changing an import, or telling the user to publish.
2. When a published library source changes, reserve `highest published + 1` here before changing the host import.
3. Record every publication instruction as a new row before giving it to the user, including errors or superseded instructions.
4. Record the pending source SHA-256 and run `node scripts/check-library-version-registry.mjs`.
5. Give the user the exact private library name/version, source path, host to compile, test gate, and copy-ready version notes.
6. When the user confirms publication, mark that version published here immediately. Any later source edit requires another version.

## Current canonical state

<!-- VERSION_REGISTRY_CURRENT_START -->
| Library | Source | Highest published | Pending version | Development import | Production import | Pending SHA-256 | Status |
|---|---|---:|---:|---:|---:|---|---|
| RevelioCoreLibrary | `indicators/20-revelio/code/development/libraries/revelio-core-library.pine` | 1 | — | 1 | 1 | — | `PUBLISHED_STABLE` |
| RevelioGapsLibrary | `indicators/20-revelio/code/development/libraries/revelio-gaps-library.pine` | 1 | — | 1 | 1 | — | `PUBLISHED_STABLE` |
| RevelioInteractionsLibrary | `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine` | 4 | — | 4 | 4 | — | `PUBLISHED_VALIDATED` |
<!-- VERSION_REGISTRY_CURRENT_END -->

Development host: `indicators/20-revelio/code/development/indicator/revelio.pine`

Current truthful status: Interactions `/4` and the Revelio host importing `/4` are published. The optional first-hit Touch Marker feature passed principal review with no P0–P3 findings and was approved by the user after TradingView testing. There is no pending library version.

## Publication history

| Library | Version | Status | Change carried by that version | Source fingerprint |
|---|---:|---|---|---|
| RevelioCoreLibrary | 1 | Published · production | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioGapsLibrary | 1 | Published · production | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioInteractionsLibrary | 1 | Published · production | Initial interaction compositor production release | Not captured before registry creation |
| RevelioInteractionsLibrary | 2 | Published · superseded | Mature appearance-input cleanup and obsolete Anchor Label contract removal | Not captured before registry creation |
| RevelioInteractionsLibrary | 3 | Published · superseded | First-hit context candidate before final principal-remediation library changes | Not captured before registry creation |
| RevelioInteractionsLibrary | 4 | Published · production · approved | Principal-remediated optional first-hit direction context | `01c9303c48b30d6cef6eb1671c0cb48d4c02dc2c6df400662b4da9d7e776545f` |

## Publication-instruction log

Entries before this registry was created are reconstructed from the task history. Future entries must be appended once per publication handoff before that handoff is sent.

<!-- VERSION_REGISTRY_INSTRUCTIONS_START -->
| Instruction ID | Date | Library | Version | What Codex told the user | Result |
|---|---|---|---:|---|---|
| PUB-2026-07-31-01 | 2026-07-31 | RevelioInteractionsLibrary | 2 | Publish the first-hit candidate as `/2` | `INVALID_ALREADY_USED` |
| PUB-2026-07-31-02 | 2026-07-31 | RevelioInteractionsLibrary | 3 | Publish the first-hit candidate as `/3` | `PUBLISHED_THEN_SUPERSEDED` |
| PUB-2026-08-01-01 | 2026-08-01 | RevelioInteractionsLibrary | 3 | Publish the principal-remediated source as `/3` | `INVALID_VERSION_ALREADY_PUBLISHED` |
| PUB-2026-08-01-02 | 2026-08-01 | RevelioInteractionsLibrary | 4 | Publish the principal-remediated source privately as `/4` | `PUBLISHED_APPROVED` |
<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->

## Current production status

Canonical library source: `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine`

Published private library: `midnightpaws87/RevelioInteractionsLibrary/4`

Published Revelio host: canonical development source titled `revelio •`, pinned to `RevelioInteractionsLibrary/4`.

Approval: principal review found no P0–P3 issues after remediation; the user approved the published feature after TradingView testing.

### Copy-ready `/4` version notes

```text
Adds optional Touch Marker first-hit context for the selected session window. The first right-edge cluster can show ① with its above/below direction, while the marker tooltip identifies FIRST, approach direction and NY hit time. Existing Touch Marker labels and tooltip behavior remain unchanged when First Hit is disabled. Includes the final reviewed timing and live-Focus retention corrections required by revelio • development importing RevelioInteractionsLibrary/4.
```

## Next version rule

Interactions `/4` is the current published production version. If its library source changes, reserve `/5`, update the development import and fingerprint, add a publication-instruction row before the handoff, and provide new copy-ready version notes. Until that new version is published, the production import remains `/4`.
