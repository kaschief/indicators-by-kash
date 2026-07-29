# Revelio Change Tracker

Updated: 2026-07-29
Progress: Group A 6 / 6 validated and approved · Group B 1 / 7 code complete

Status flow: `Not Started` → `In Progress` → `Code Complete` → `TradingView Validated`

## Group A — Cosmetic Tweaks

- [x] **COS-01 — Default Value Gaps to Floating Only**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default Value Gaps display from `Most Recent + Floating` to `Floating Only`.
  - Done when a fresh Revelio instance draws floating gaps without historical gaps by default.

- [x] **COS-02 — Current / previous temporal symbols**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Use `★` for every current RTH, Globex, Weekly, Monthly, and Quarterly label.
  - Use grouped labels: `← [PREV RTH]`, `← [PREV GLOBEX]`, `← [LAST WEEK'S]`, `← [LAST MONTH'S]`, and `← [LAST QUARTER'S]`.
  - Keep the approved text in the paired `LABEL_*_LAST` constants.
  - Removed the Previous Label Format testing dropdown, formatter, and derived variables.
  - Removed the dedicated `PREV RTH / GLOBEX` text-size control and its specialized style path.
  - Previous labels continue using their anchor's normal text-size setting.

- [x] **COS-03 — Upcoming Gap offset**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default `Upcoming Gap · Offset` from `10` to `90`.
  - Keep the offset editable.

- [x] **COS-04 — Floating confirmed-gap offset**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Change the default `Floating Gaps · Offset` from `100` to `150`.
  - Keep the offset editable.

- [x] **COS-05 — Fixed floating-gap spacing**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Keep `10` empty bars between adjacent floating gap boxes.
  - Remove the spacing control from the UI.
  - Do not change the individual gap-box `Width`.
  - Depends on: `COS-04`.

- [x] **COS-06 — Simplify Quick Filter presets**
  - Status: `TradingView Validated`
  - TradingView: `Approved`
  - Remove the `Core` and `Prep` Quick Filter entries and their unused state branches.
  - Rename Macro Prep to describe its remaining behavior directly: `● Macro Prep: Full Spectrum`.
  - Prefix the Intraday preset with a plus sign: `+ Intraday: RTH + Globex`.
  - Preserve the anchor membership of every remaining preset.

## Group B — Touch Markers

- [x] **TOUCH-00 — Plain Touch Marker tooltip identities**
  - Status: `Code Complete`
  - TradingView: `Not Tested`
  - Keep `← […]` decoration on right-column labels and reminders.
  - Remove the arrow and brackets from Touch Marker hover identities.
  - Preserve plain wording such as `PREV RTH` and `LAST WEEK'S`.
  - Do not change swept checkmarks, marker styling, merging, or priority.

- [ ] **TOUCH-01 — Expired-level display dropdown**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - Replace the `Expired Guide` checkbox with a more descriptive dropdown.
  - Options:
    - `Dot`
    - `Dot + Guide`
  - `Dot` keeps the Touch Marker without drawing the temporary guide.
  - Working field name: `Expired Level Display`.

- [ ] **TOUCH-02 — Optional expired-level symbol**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - Optionally append a subtle symbol to an expired level’s visible identity.
  - Do not replace or conflict with the existing swept checkmark.
  - Recommended symbol: `◌`
  - Example: `RTH POC Jun 26 ◌`
  - Depends on: `TOUCH-01`.

- [ ] **TOUCH-02B — Optional expired dot/guide fade**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - Expose an editable `Expired Fade %`.
  - Use it to soften expired Touch Marker dots and their optional guides.
  - Do not fade active-level dots or lines.
  - `0%` should preserve the source color’s normal opacity.
  - Open decision: one shared fade percentage or separate dot and guide percentages.
  - Depends on: `TOUCH-01`.

- [ ] **TOUCH-03 — Visible Touch Marker context**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - Optionally show the touched level’s identity and price without requiring hover.
  - Show this context only during the selected Touch Marker trading window.
  - Include levels detected through `All Anchors`, even when their anchor is outside the active Quick Filter.
  - Do not change the normal right-edge price-label settings.
  - Example: `Quarterly VAH Q2 · 6125.25`
  - Depends on: `TOUCH-01`.

- [ ] **TOUCH-04 — Include expired levels in visible context**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - Add a separate option to include or exclude expired levels from the visible Touch Marker context.
  - Keep this independent from:
    - `Dot` versus `Dot + Guide`
    - The optional expired symbol
    - `Expired Fade %`
  - Depends on: `TOUCH-03`.

- [ ] **BUG-01 — Highest anchor controls a merged Touch Marker**
  - Status: `Not Started`
  - TradingView: `Not Tested`
  - When multiple levels share one Touch Marker, use this anchor priority:
    - `Quarterly`
    - `Monthly`
    - `Weekly`
    - `RTH / Globex`
  - The winning anchor must supply:
    - Dot color
    - Dot size
    - Optional expired-guide color
  - Keep the winning anchor first in the Touch Marker identity list.
  - Regression test: when `LAST WEEK'S VAL` merges with RTH and Globex levels, the marker must use the Weekly VAL color and Weekly marker size.

## Open Decisions

- [x] **D-01:** Should brackets contain only `PREV` / `LAST` or the complete previous-period phrase?
  - Approved with the complete previous-period phrase inside the brackets.

- [ ] **D-02:** Confirm the expired-level field name and symbol.
  - Working assumption: `Expired Level Display` and `◌`.

- [ ] **D-03:** Confirm the exact placement of visible Touch Marker identity and price context.
  - Working assumption: right-column context during the active Touch Marker window only.

- [ ] **D-04:** Define the priority tie between RTH and Globex.
  - Working assumption: preserve stable displayed-identity order because both are daily anchors.

- [x] **D-05:** Confirm the default floating-gap spacing.
  - Implemented as a fixed `10` bars with no UI control.

- [ ] **D-06:** Use one expired fade percentage or separate dot and guide percentages?
  - Working assumption: one shared `Expired Fade %`.

## Validation Checklist

- [x] Pine delimiter, constructor-arity, and stale-reference checks pass.
- [x] TradingView compilation passes for Group A.
- [x] Fresh-instance defaults match the requested gap display and offsets.
- [x] Final grouped labels preserve `WEEK'S`, `MONTH'S`, and `QUARTER'S`.
- [x] Floating-gap offset and width remain editable; adjacent gaps keep `10` empty bars.
- [ ] Touch Marker tooltips use plain temporal identities while right-column labels remain decorated.
- [ ] Expired marker presentation options behave independently.
- [ ] Active marker opacity remains unchanged when expired fading is enabled.
- [ ] `All Anchors` context appears without enabling normal Quick Filter prices.
- [ ] Weekly/Monthly/Quarterly merged-marker priority is visually correct.
- [ ] Standard charts, Replay, and the active Touch Marker trading window receive a visual pass.
