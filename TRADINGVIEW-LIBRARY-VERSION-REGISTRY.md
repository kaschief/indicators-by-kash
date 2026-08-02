# TradingView Library Version Registry

Updated: 2026-08-02

This is the repository's single source of truth for TradingView library versions, publication status, publication instructions, source fingerprints, and required host imports. Pine imports are executable references, but version decisions and publication history are authoritative only here. Historical trackers must link here instead of maintaining a second current-version ledger.

## Required workflow

1. Read this file before changing a library, changing an import, or telling the user to publish.
2. When a published library source changes, reserve `highest published + 1` here before changing the host import.
3. Record every publication instruction as a new row before giving it to the user, including errors or superseded instructions.
4. Record the pending source SHA-256 and run `node scripts/check-library-version-registry.mjs`.
5. Give the user the exact private library name/version, source path, host to compile, test gate, and copy-ready version notes.
6. When the user confirms publication, mark that version published here immediately. Any later source edit requires another version.
7. Published versions are forward-only. Never move an import backward; an undo or restoration of older behavior must be released as the next new version.

## Current canonical state

<!-- VERSION_REGISTRY_CURRENT_START -->
| Library | Source | Highest published | Pending version | Development import | Production import | Pending SHA-256 | Status |
|---|---|---:|---:|---:|---:|---|---|
| RevelioCoreLibrary | `indicators/20-revelio/code/development/libraries/revelio-core-library.pine` | 1 | — | 1 | 1 | — | `PUBLISHED_STABLE` |
| RevelioGapsLibrary | `indicators/20-revelio/code/development/libraries/revelio-gaps-library.pine` | 1 | — | 1 | 1 | — | `PUBLISHED_STABLE` |
| RevelioInteractionsLibrary | `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine` | 10 | — | 10 | 10 | — | `PUBLISHED_VALIDATED` |
<!-- VERSION_REGISTRY_CURRENT_END -->

Development host: `indicators/20-revelio/code/development/indicator/revelio.pine`

Current truthful status: Interactions `/10` and the Revelio host importing `/10` are published, compiled, tested, and approved by the user. The release includes the profile-label order and shortening controls plus the bounded Quarterly histogram transport correction. Final principal source review found no P0–P3 issue. There is no pending library version.

## Publication history

| Library | Version | Status | Change carried by that version | Source fingerprint |
|---|---:|---|---|---|
| RevelioCoreLibrary | 1 | Published · production | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioGapsLibrary | 1 | Published · production | Initial library-backed Revelio production release | Not captured before registry creation |
| RevelioInteractionsLibrary | 1 | Published · production | Initial interaction compositor production release | Not captured before registry creation |
| RevelioInteractionsLibrary | 2 | Published · superseded | Mature appearance-input cleanup and obsolete Anchor Label contract removal | Not captured before registry creation |
| RevelioInteractionsLibrary | 3 | Published · superseded | First-hit context candidate before final principal-remediation library changes | Not captured before registry creation |
| RevelioInteractionsLibrary | 4 | Published · superseded · approved | Principal-remediated optional first-hit direction context | `01c9303c48b30d6cef6eb1671c0cb48d4c02dc2c6df400662b4da9d7e776545f` |
| RevelioInteractionsLibrary | 5 | Published · superseded · incomplete | Structured one-line right-edge label compression without mixed dated-anchor grouping | `623d47217147901d952a0e5136549dc5720355743b46da498e6bf3ff94de3433` |
| RevelioInteractionsLibrary | 6 | Published · superseded · incomplete | Mixed dated-anchor compression and its toggle for right-edge labels only | `73174ae4df0b08db9648119dff9552ae78d7fbb2ca7cd9dcfeff176819fbbe7f` |
| RevelioInteractionsLibrary | 7 | Published · superseded · not approved | Complete all-label-path compression plus expanded merge-distance controls | `aa17d7a8f2e3faf63a55e78053f7b47b029f3f9f86c02ea1ab017a44a3779929` |
| RevelioInteractionsLibrary | 8 | Published · superseded · approved | Fixed level-first merged-label hierarchy across all label paths | `1179309cbd3100b0775ce75934c6e59853fb7c76cf13e66f50c2d7e92656fae4` |
| RevelioInteractionsLibrary | 9 | Published · superseded · not approved | Initial progressive condensation-scope test control before clarified order and shortening controls | `de636833727ebfea22c998e4e225322fa0163bf993579afbf9a9eee3e55154b1` |
| RevelioInteractionsLibrary | 10 | Published · production · approved | Independent profile-label order and shortening controls with completed Quarterly histogram transport correction | `a2be262039f67b5635f63190c7ef298956e7967150efb8844bc882fcec212a56` |

## Publication-instruction log

Entries before this registry was created are reconstructed from the task history. Future entries must be appended once per publication handoff before that handoff is sent.

<!-- VERSION_REGISTRY_INSTRUCTIONS_START -->
| Instruction ID | Date | Library | Version | What Codex told the user | Result |
|---|---|---|---:|---|---|
| PUB-2026-07-31-01 | 2026-07-31 | RevelioInteractionsLibrary | 2 | Publish the first-hit candidate as `/2` | `INVALID_ALREADY_USED` |
| PUB-2026-07-31-02 | 2026-07-31 | RevelioInteractionsLibrary | 3 | Publish the first-hit candidate as `/3` | `PUBLISHED_THEN_SUPERSEDED` |
| PUB-2026-08-01-01 | 2026-08-01 | RevelioInteractionsLibrary | 3 | Publish the principal-remediated source as `/3` | `INVALID_VERSION_ALREADY_PUBLISHED` |
| PUB-2026-08-01-02 | 2026-08-01 | RevelioInteractionsLibrary | 4 | Publish the principal-remediated source privately as `/4` | `PUBLISHED_APPROVED` |
| PUB-2026-08-01-03 | 2026-08-01 | RevelioInteractionsLibrary | 5 | Publish the structured one-line label compositor privately as `/5`, then compile the development Revelio host against `/5` | `PUBLISHED_CURRENT` |
| PUB-2026-08-01-04 | 2026-08-01 | RevelioInteractionsLibrary | 6 | Publish the mixed dated-anchor compression correction privately as `/6`, then compile the development Revelio host against `/6` | `PUBLISHED_INCOMPLETE` |
| PUB-2026-08-01-05 | 2026-08-01 | RevelioInteractionsLibrary | 7 | Publish the complete all-label-path compression correction privately as `/7`, then compile the development Revelio host against `/7` | `PUBLISHED_TESTING` |
| PUB-2026-08-01-06 | 2026-08-01 | RevelioInteractionsLibrary | 8 | Publish the fixed level-first merged-label compositor privately as `/8`, then compile the development Revelio host against `/8` | `PUBLISHED_APPROVED` |
| PUB-2026-08-02-01 | 2026-08-02 | RevelioInteractionsLibrary | 9 | Publish the progressive condensation-scope test compositor privately as `/9`, then compile the development Revelio host against `/9` | `PUBLISHED_TESTED_THEN_SUPERSEDED` |
| PUB-2026-08-02-02 | 2026-08-02 | RevelioInteractionsLibrary | 10 | Publish the clarified profile-label order and shortening compositor privately as `/10`, then compile the development Revelio host containing the Quarterly histogram transport correction against `/10` | `PUBLISHED_APPROVED` |
<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->

## Current production status

Canonical library source: `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine`

Latest published private library: `midnightpaws87/RevelioInteractionsLibrary/10`

Production Revelio host import: `midnightpaws87/RevelioInteractionsLibrary/10`.

Development Revelio host import: `midnightpaws87/RevelioInteractionsLibrary/10`.

Validation: `/10` and its host were published, compiled, tested, and approved by the user on 2026-08-02. Local static checks and final principal source review also passed. Quantitative Profiler capture remains an optional follow-up rather than a release blocker.

## Published `/5` validation status

Published private library: `midnightpaws87/RevelioInteractionsLibrary/5`

Interactions `/5` provides the initial one-line right-edge label compression. TradingView validation confirmed that same-profile and same-level grouping works through the new compositor, but dated members whose levels and dates both differ do not remove their repeated anchor. `/6` corrects that incomplete case without moving backward.

### Copy-ready `/5` version notes

```text
Compresses merged right-edge profile labels onto one line without replacing identities with counts. Independent profile groups retain the pipe separator, repeated levels or periods share one heading, and swept, Auto, archived and unselected symbols remain attached to their own members. Existing merge distance, identity priority, carrier color, label size, Touch Marker prefix and optional price behavior are preserved.
```

## Published `/6` status

Interactions `/6` extends the one-line grammar to dated right-edge members that share an anchor while carrying different levels and dates. Its `Condense Merged Labels` toggle does not reach active-anchor or swept reminder compositors, so those labels still show the original repeated identities.

### Copy-ready `/6` version notes

```text
Extends merged right-edge profile labels so a repeated dated anchor is shown once even when its members use different levels and dates. Mixed RTH and Globex groups remain separated by a pipe, while entries such as Globex POC Jul 27 and Globex VAL Jul 26 become Globex: POC Jul 27, VAL Jul 26. Condense Merged Labels controls this right-edge grammar; active-anchor and swept reminder labels remain uncondensed in this version.
```

## Published `/7` testing status

Interactions `/7` gives right-edge labels, active-anchor reminders, and swept reminders the same structured identity composer. `Condense Merged Labels` controls all three paths; turning it off restores the full identities on all three. The merge dropdown adds `Extra Wide` at `0.050%`, while Custom accepts values through `0.5%`. Publication is complete and visual testing is in progress.

### Copy-ready `/7` version notes

```text
Completes compact merged-label formatting across right-edge labels, active-anchor reminders and swept reminders. Condense Merged Labels now controls the same structured one-line grammar everywhere; turning it off restores every full identity separated by a pipe. Adds an Extra Wide merge-distance preset at 0.050% and raises the Custom maximum to 0.5%. Existing brackets, capitalization, per-member symbols, carrier styling, label size, optional price and merge-off behavior are preserved.
```

## Published `/8` status

Interactions `/8` replaces adaptive shortest-string grouping with one fixed level-first hierarchy across right-edge labels, active-anchor reminders and swept reminders. Dated contributors are regrouped across the complete cluster only when both level and anchor match. Pipes start new groups, commas continue periods, and live or bracketed previous identities remain complete single contributors. `Condense Merged Labels` gates the feature. The published host compiled and the user approved the visible result.

### Copy-ready `/8` version notes

```text
Replaces adaptive merged-label formatting with a consistent level-first hierarchy across right-edge labels and reminders. POC, aPOC, VAH or VAL always leads each group; pipes separate different level/profile groups, while commas join periods only when both level and profile match. Touch Marker and First Hit prefixes, brackets, per-member status symbols, shared price, carrier styling, merge distances and condensation-off behavior are preserved.
```

## Published `/9` status

Interactions `/9` introduced the first progressive condensation-scope test control. It was published and compiled, and the user's test exposed that its control name and combined modes did not clearly describe the actual profile-label scope. Those revisions were carried forward and approved in `/10`.

### Copy-ready `/9` version notes

```text
Adds progressive merged-label condensation scopes while retaining the approved Standard format as the default. Dated shortens completed profiles with R, G and W tokens plus natural Monthly and Quarterly periods; Dated + Previous also shortens previous identities; All Profiles also shortens live identities. Compact modes retain swept and Auto status on-chart while keeping Touch Marker source provenance in hover. Off, First Hit, shared price, carrier styling, merge distances and all reminder paths remain supported.
```

## Published `/10` status

Interactions `/10` separates profile-label order from shortening scope. `Profile Label Order` offers `Profile First` and `Level First`; `Shorten` offers `None`, `Dated Profiles`, `Dated + Previous`, and `All Profiles`. The approved `/8` output remains the default through `Level First` plus `None`. Shortened identities consistently use `R`, `G`, `W`, `M`, and `Q`, while the order choice independently controls whether the profile or level leads. The same settings are used by right-edge labels, active-anchor reminders, and swept reminders. Touch Marker provenance stays at the rear of affected shortened identities and remains explained in hover; Value Gap labels are outside the profile-label controls. The companion host exposes completed Quarterly histogram rows throughout the bounded completion day so intraday higher-timeframe bars can receive them without an additional request or repeated host copy. Final principal source review found no P0–P3 issue, and the user approved the published build after TradingView testing.

### Copy-ready `/10` version notes

```text
Separates Profile Label Order from profile-name shortening while retaining the approved Level First plus None combination as the default. Profile First and Level First can be tested independently with None, Dated Profiles, Dated + Previous, or All Profiles. Shortened identities consistently use R, G, W, M and Q; swept and Auto status remain attached, while Touch Marker source provenance stays at the rear of affected identities and in hover. First Hit, shared price, carrier styling, merge distances and all reminder paths remain supported.
```

### Copy-ready `/4` version notes

```text
Adds optional Touch Marker first-hit context for the selected session window. The first right-edge cluster can show ① with its above/below direction, while the marker tooltip identifies FIRST, approach direction and NY hit time. Existing Touch Marker labels and tooltip behavior remain unchanged when First Hit is disabled. Includes the final reviewed timing and live-Focus retention corrections required by revelio • development importing RevelioInteractionsLibrary/4.
```

## Next version rule

Interactions `/10` is the current published production version. If its library source changes—including an undo—reserve and publish `/11`; never move the import backward to an earlier published version.
