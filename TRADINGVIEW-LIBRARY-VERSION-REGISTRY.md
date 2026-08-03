# TradingView Library Version Registry

Updated: 2026-08-03

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
| RevelioInteractionsLibrary | `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine` | 13 | 14 | 14 | 13 | `0b6abf9e141416f2b405064e07f79edffaf7c94b2e1a0d41784443427f37dcde` | `PENDING_PUBLICATION` |
<!-- VERSION_REGISTRY_CURRENT_END -->

Development host: `indicators/20-revelio/code/development/indicator/revelio.pine`

Current truthful status: Interactions `/13` is the published, compiled and user-approved production import. Interactions `/14` is reserved for the proper condensation refactor: the library removes Level First and partial-scope formatting branches, exposes one `shortenLabels` parameter across all three compositors, fixes Profile First ordering, and shortens every profile scope only when the enabled-by-default `Shorten Labels` toggle is on. Local checks and final principal review found no P0–P3 issue. Publication, TradingView compilation and On/Off visual validation are pending.

## External pinned dependencies

These libraries are maintained outside this repository. Their versions are pinned in the host source and do not enter the internal publication workflow above. Check the linked TradingView release pages before intentionally advancing either import, then compile and visually test the dependent host.

| Host | External library | Pinned version | TradingView release page | Last verified |
|---|---|---:|---|---|
| `indicators/23-news/code/development/news.pine` | `toodegrees/forex_factory_utility` | 17 | [forex factory utility](https://www.tradingview.com/script/DHRsmWy1-forex-factory-utility/) | 2026-08-02 |
| `indicators/23-news/code/development/news.pine` | `toodegrees/forex_factory_decoding` | 44 | [forex factory decoding](https://www.tradingview.com/script/Q78LeoTL-forex-factory-decoding/) | 2026-08-02 |

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
| RevelioInteractionsLibrary | 10 | Published · superseded · approved | Independent profile-label order and shortening controls with completed Quarterly histogram transport correction | `a2be262039f67b5635f63190c7ef298956e7967150efb8844bc882fcec212a56` |
| RevelioInteractionsLibrary | 11 | Published · superseded · rejected | Temporary right-edge labels incorrectly reused Touch Marker dot color and glyph size | `db6cbd7e1434ae940dfdc599dec00b65acbb2734641654d192773daead775d61` |
| RevelioInteractionsLibrary | 12 | Published · superseded · rejected | Native label styling with an incorrect touched-versus-ordinary merge isolation rule | `6868a36cf78ec6ef60fe9f963b497610856dbbd9577f17869e819f0f94f25e4a` |
| RevelioInteractionsLibrary | 13 | Published · production · approved | Original merge behavior first; winning touched anchor's native label style only after composition | `35ab0ce9451707593e63a9fcbaab01bd0fce1d9d5d9ef83dc4c06a6881f21e1b` |
| RevelioInteractionsLibrary | 14 | Pending · development | One Shorten Labels contract with fixed Profile First formatting across every compositor | `0b6abf9e141416f2b405064e07f79edffaf7c94b2e1a0d41784443427f37dcde` |

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
| PUB-2026-08-03-01 | 2026-08-03 | RevelioInteractionsLibrary | 11 | Publish the Touch Marker right-edge style synchronization privately as `/11`, then compile and visually test the development Revelio host against `/11` | `PUBLISHED_TESTED_REJECTED` |
| PUB-2026-08-03-02 | 2026-08-03 | RevelioInteractionsLibrary | 12 | Publish the native-level label-style correction privately as `/12`, then compile and visually compare the development Revelio host against the rejected `/11` screenshot | `PUBLISHED_TESTED_REJECTED` |
| PUB-2026-08-03-03 | 2026-08-03 | RevelioInteractionsLibrary | 13 | Publish the merge-preserving native-label-style correction privately as `/13`, then compile and compare every merge preset, Custom percentage and Merge Off against the approved pre-style behavior | `PUBLISHED_TESTED_APPROVED` |
| PUB-2026-08-03-04 | 2026-08-03 | RevelioInteractionsLibrary | 14 | Publish the single-toggle Profile First condensation refactor privately as `/14`, then compile and compare Shorten Labels On/Off across right-edge labels, active-anchor reminders and swept reminders | `CURRENT_PENDING` |
<!-- VERSION_REGISTRY_INSTRUCTIONS_END -->

## Current production status

Canonical library source: `indicators/20-revelio/code/development/libraries/revelio-interactions-library.pine`

Latest published private library: `midnightpaws87/RevelioInteractionsLibrary/13`

Production Revelio host import: `midnightpaws87/RevelioInteractionsLibrary/13`.

Development Revelio host import: `midnightpaws87/RevelioInteractionsLibrary/14`.

Validation: `/13` passed static hygiene, registry, title, whitespace, merge-mode regression and final principal review against the approved `/10` baseline with no P0–P3 finding; the user then confirmed the issue resolved after TradingView publication and testing. `/14` passed local static, arity, stale-reference, registry, title, output-equivalence and final principal review with no P0–P3 finding. Publication, TradingView compilation, fresh/reset-default validation, Off/On comparison across all three label paths, and saved-setting validation remain pending.

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

## Published `/11` rejected status

Interactions `/11` gave each temporarily touched right-edge label the same dot color and glyph size as its corresponding Touch Marker group. TradingView compilation succeeded, but visual testing showed that the label text became much larger than the anchor's native level label and used the dot palette rather than the native label palette. The user rejected this presentation. The screenshot also confirmed `⁺` off-filter identities from the companion host's enabled Include All Anchors default; those are temporary Touch Marker labels rather than native level-line mutations.

### Copy-ready `/11` version notes

```text
Synchronizes temporary Touch Marker labels in the right column with their corresponding marker dots by applying the dominant marker's dot color and glyph size to the merged label. This published version was rejected after visual testing because those properties do not match the anchor's native level-label styling.
```

## Published `/12` rejected status

Interactions `/12` keeps the dominant Touch Marker anchor selection and gives the temporary right-edge label that anchor's native `labelColor` and `labelSize`. It also introduced a touched-versus-ordinary cluster boundary. TradingView comparison showed that this boundary prevented labels from merging under the same configured percentage, so the user rejected `/12`.

The principal review found no P0–P3 issue only because it was given the incorrect isolation criterion. It did not establish merge parity and is superseded by the `/13` review requirement.

### Copy-ready `/12` version notes

```text
Corrects temporary Touch Marker labels so the dominant anchor supplies its native level-label color and text size rather than the marker dot's color and glyph size. Quarterly, Monthly, Weekly, then RTH or Globex still determines the winning anchor, but the right-column text now looks exactly as that anchor's native level label would. Touched groups are isolated from unrelated nearby labels and line-carrier fading, while ordinary labels retain their existing merge behavior. The override remains limited to the active detection window; marker dots, history, reminders and native level-line properties are unchanged. The companion host defaults Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles.
```

## Published `/13` approved status

Interactions `/13` removes the new touched-versus-ordinary cluster boundary and restores the approved `/10` merger's control flow. Every label again uses the pre-existing Touch Marker group mapping and then the same `nearestLabelCluster()` fallback driven by Merge Off or the selected preset/Custom percentage. This deliberately retains `/10` behavior, including its same-marker-group colocation when Merge Off is selected; `/13` introduces no new cluster-membership rule. Existing carrier selection and secondary-line fading operate on that unchanged cluster. Only after the merged text and carrier are determined does an active Touch Marker winner replace the final label's text color and text size with its native `labelColor` and `labelSize`. Marker dots continue to use `lineColor` and `circleSize`. The publication-time host defaulted Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles; the current host-only follow-up replaces the two format dropdowns with one enabled `Shorten Labels` toggle while fixing Profile First ordering.

Final principal review compared `/13` directly with approved commit `980f0c64` and found no P0–P3 issue: cluster membership, composition, carrier selection, carrier price and line fading are unchanged, while the new native text style assignment occurs only after composition.

### Copy-ready `/13` version notes

```text
Restores the approved `/10` profile-label merger before applying Touch Marker presentation. The pre-existing Touch Marker group mapping, Merge Off behavior, every merge preset and every Custom percentage determine clusters exactly as they did before the style feature; no touched-versus-ordinary boundary is added. Existing carrier selection and secondary-line fading are preserved. After composition, an active touched cluster uses the highest anchor's native level-label color and text size. Marker dots, history, prices, reminders and native line properties are unchanged. The publication-time companion host defaulted Include All Anchors on, Profile Label Order to Profile First, and Shorten to All Profiles; a later host-only follow-up collapses the two format controls into one enabled `Shorten Labels` toggle with fixed Profile First ordering.
```

### Copy-ready `/4` version notes

```text
Adds optional Touch Marker first-hit context for the selected session window. The first right-edge cluster can show ① with its above/below direction, while the marker tooltip identifies FIRST, approach direction and NY hit time. Existing Touch Marker labels and tooltip behavior remain unchanged when First Hit is disabled. Includes the final reviewed timing and live-Focus retention corrections required by revelio • development importing RevelioInteractionsLibrary/4.
```

The initial host-only toggle candidate was superseded before runtime validation because it still carried removed formatting modes through the library API. `/14` performs the complete library refactor instead.

## Pending `/14` status

Interactions `/14` removes the obsolete Level First renderer, per-profile shortening scope selector, legacy formatting branches, and four-boolean compositor signatures. `composedClusterIdentities()` now accepts only `shortenLabels`: Off returns ordered full Profile First identities, while On uses the single shortened Profile First grammar for dated, previous and live profiles. Right-edge labels, active-anchor reminders and swept reminders each pass the same one boolean through their simplified exported APIs. Merge membership, carrier selection, line fading, Touch Marker presentation, prices, reminders and drawing budgets are unchanged.

Final principal review found no P0–P3 issue in the stable source fingerprint recorded above. It confirmed the minimal ten-field identity contract, exact constructor arity, single-boolean APIs, On/Off output equivalence and absence of obsolete formatting symbols or compatibility aliases.

### Copy-ready `/14` version notes

```text
Replaces the separate Profile Label Order and Shorten dropdowns with one enabled-by-default Shorten Labels toggle. Profile First is now the sole label order. On shortens dated, previous and live profile names; Off keeps their full Profile First identities. The same setting applies to right-edge labels, active-anchor reminders and swept reminders. Existing merge distances, carrier fading, Touch Marker styling, prices, provenance symbols and drawing behavior are unchanged.
```

## Next version rule

Interactions `/13` is the highest published version and approved production import. `/14` is reserved for the pending condensation API refactor. If `/14` changes before publication, refresh its fingerprint and validation; after publication, any later source edit requires `/15`. Never move the import backward to an earlier published version.
