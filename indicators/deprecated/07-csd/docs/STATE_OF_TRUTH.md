# CSD Hunter° [Pro+] — State of Truth

This document is the authoritative, up‑to‑date reference for the indicator's behavior, inputs, naming, and rendering. Keep this file current when logic or UI changes.

## Overview
- Name: CSD Hunter° [Pro+] [v2.3-lenient-csd-detection]
- Purpose: Advanced CSD (Change in State of Delivery) detection with lenient mode, source gap validation, and cross-bar contamination prevention. Detects and renders Source Gaps for CSD validation.
- Script: indicators/deprecated/07-csd/code/development/csd-dev-v2.3-lenient-csd-detection.pine

## Terminology (canonical)
- Source Gaps: the only accepted term for gaps used by this script. Types:
  - FVG (Fair Value Gap): label prefix `FVG`
  - Implied FVG: label prefix `Imp`
  - Volume Imbalance: label prefix `Vol`
  - True Gap: label prefix `Gap`
- Polarity Suffix: `+` (bullish) or `-` (bearish) appended to every source gap label.
- CSD (Change in State of Delivery): Two detection modes available
  - **Standard CSD**: Current candle vs immediate previous candle (N-1)
    - Bullish CSD: bullish candle whose close > open[1] of prior bearish candle
    - Bearish CSD: bearish candle whose close < open[1] of prior bullish candle
  - **Lenient CSD**: Current candle vs configurable Nth candle back (2-5 candles)
    - Only triggers when standard CSD fails to form
    - Uses same logic but compares against candle N positions back
    - Displays with "L" suffix: ▲L (bullish) or ▼L (bearish)
- Anchor Candle: The candle being compared against (N-1 for standard, N-leniency_level for lenient).
- Cross-Bar Contamination Prevention: System prevents multiple CSD arrows on the same anchor bar.

## Detection Logic
- FVG: bullish if `low > high[2]`, bearish if `high < low[2]`.
- Volume Imbalance: bodies separated, wicks touching (per code); bullish/bearish as defined.
- True Gap: bullish if `high[1] < low`, bearish if `low[1] > high`.
- Implied FVG:
  - Uses displacement validation (defaults).
  - Displacement multiplier and lookback are constants (not user inputs):
    - DEFAULT_DISPLACEMENT_MULTIPLIER = 2.5
    - DEFAULT_LOOKBACK_CANDLES = 4

## Gap Origin + Mitigation
- Gap origin index: last formation candle (C3 for 3‑bar gaps: FVG/Implied; C2 for 2‑bar gaps: Vol/True).
- Mitigation: a rectangle is frozen at the first candle (wick/body) that enters its gap range (formation candles excluded).

## CSD Validation
- **Detection Priority**: Standard CSD has priority; lenient only triggers when standard fails and anchor bar is free
- **Opposite‑direction requirement** (core rule):
  - Bullish CSD requires a bearish source gap in lookback; bearish CSD requires a bullish source gap
  - Gap window calculation: `win_start = anchor_index - csd_gap_lookback + 1` to `win_end = anchor_index`
- **Lookback origin check**: a source gap validates only if its origin index is within the lookback window
- **Cross-Bar Contamination Prevention**: 
  - Tracks all bars that receive CSD labels via `csd_labeled_bars` array
  - Prevents any new CSD label placement on bars that already have one
  - Maintains memory of recent 100 bars for performance
- **Toggle: `Require Gap`** (on by default)
  - On: opposite‑direction source gap origin must exist within the window for CSD to be valid
  - Off: CSD can be valid without gaps; Anchor Gap label is suppressed; Anchor ID still displays
- **Lenient Mode Settings**:
  - `Enable Lenient CSD`: Master toggle for lenient detection
  - `Leniency Level` (2-5): Number of candles back to check when standard fails
- **Suppress Repeated Direction** (experimental): 
  - When enabled, shows only first CSD of each direction until opposite occurs
  - Reduces choppy repeated signals in ranging markets

## Labels and Rendering
- Source Gap Rectangles
  - Color: `Source Gap Color`.
  - Toggle: `Show Source Gaps (with Labels)` — labels are tied to boxes; detection always runs regardless of visibility.
  - Label format: text only (transparent background), `FVG+/Imp-/Vol+/Gap-`.
  - When `Show Source Gaps` is OFF, rectangles and their labels are not rendered; existing labels are removed.
- **Anchor Labels** (drawn on valid CSD's Anchor Candle)
  - **Standard CSD**: Uses ▲ (bullish) or ▼ (bearish) symbols
  - **Lenient CSD**: Uses ▲L (bullish) or ▼L (bearish) symbols  
  - Single combined label (two lines max) following distal rule:
    - Bullish (belowbar): first line = symbol (near candle), second line = summary (farther)
    - Bearish (abovebar): first line = summary (nearer), second line = symbol (farther)
  - Tooltip: shows full gap details (counts by type, total, types list) when gap requirement enabled
  - Size and color: `Size` and `Text Color` in Anchors section apply to entire combined label
  - **Cross-bar protection**: Prevents duplicate labels on same anchor bar regardless of detection source
  - **Summary formatting**:
    - Single type → `FVG x2` (omit `x1`)
    - Two types, small total → `(Gap x Vol)`; include counts as `xN` only when >1
    - Many types or total count ≥ 3 → `(3)` (total only)
  - Colors: text colors for Source Gap labels and Anchor labels are independently configurable; all label backgrounds are transparent.
  - Toggle: `Show Anchor Labels` (on/off).
- CSD Candle Coloring
  - Removed: candle colorization has been discarded to keep the UI minimal and focused on key visuals.
- **Info Table** (dynamic, ultra-compact CSD status display)
  - **Always shows**: `LB: <lookback>` (gap validation lookback)
  - **When lenient enabled**: `LL: <level>` (leniency level 2-5)  
  - **When suppress active**: `SUP` (suppress repeated direction indicator)
  - **Dynamic sizing**: 1-3 rows based on active features
  - **Smart recreation**: Table rebuilds when settings change (position, lenient, suppress)
  - **9 positions**: Top/Middle/Bottom × Left/Center/Right
  - **Customizable**: Text color, background color, text size (Tiny/Small/Normal)

## Inputs (grouped) — UI Order: Anchors → Source Gaps → Implied Source → CSD Validation → Alert Settings → Info Table
- **📌 Anchors** (first priority)
  - `Show Anchor Labels` (bool): Master toggle for anchor label display
  - `Size` (Tiny/Small/Normal/Large/Huge): Label size for anchor symbols and summaries
  - `Text Color`: Color for anchor label text  
  - `Max Labels` (0-500): Maximum anchor labels to keep; older ones removed FIFO
  - `No. of Bars for Label Retention` (0-5000): Display window for labels; 0=unlimited
- **📦 Source Gaps** (gap type toggles + visual settings)
  - **Gap Types** (all enabled by default):
    - `Fair Value Gap`, `Implied FVG`, `Volume Imbalance`, `True Gap`
  - **Visual Settings**:
    - `Size` (Tiny-Huge): Source gap label size
    - `Color`: Rectangle color for gap boxes
    - `Text`: Text color for source gap labels  
    - `Max Gaps` (1-100): Maximum gap rectangles and labels
    - `Enable Gaps` (bool): Show/hide gap rectangles and labels
- **⚙️ Implied Source Settings** (displacement validation)
  - `Implied: Displacement` (1.0-5.0, step 0.1): C2 body size multiplier vs recent average
  - `Lookback` (3-5): Bars to average for displacement comparison
- **🎯 CSD Validation** (core CSD detection settings)  
  - `Require Gap` (bool): Require opposite-direction source gaps for CSD validation
  - `Lookback (bars)` (1-20): Gap search window size from anchor candle
  - `Suppress Repeated Direction (experimental)` (bool): Show only first CSD per direction
  - `Enable Lenient CSD` (bool): Enable lenient detection mode
  - `Leniency Level` (2-5): Candles back to check when standard CSD fails
- **🚨 Alert Settings** (dual alert system)
  - `Alert Mode`: Individual → Both → **Grouped** (default)
  - Individual alert checkboxes: CSD⁺, CSD⁻, CSD⁺L, CSD⁻L
- **ℹ️ Info Table** (status display, placed last)
  - `Show` (bool): Display compact status table
  - `Position`: 9-position grid (Top/Middle/Bottom × Left/Center/Right)  
  - `Text Size` (Tiny/Small/Normal): Font size for table text
  - `Text Color`, `BG Color`: Table appearance customization

## Constants Architecture (v2.3)
**Centralized string and value management for maintainability:**
- **Anchor Symbols**: `SYMBOL_BULL = "▲"`, `SYMBOL_BEAR = "▼"`, `LENIENT_SUFFIX = "L"`
- **Info Table Display**: `INFO_LOOKBACK_PREFIX = "LB: "`, `INFO_LENIENCY_PREFIX = "LL: "`, `INFO_SUPPRESSED_TEXT = "SUP"`  
- **CSD Labels**: `CSD_PLUS = "CSD⁺"`, `CSD_MINUS = "CSD⁻"`, dynamic lenient constants
- **Alert Modes**: `ALERT_MODE_INDIVIDUAL`, `ALERT_MODE_GROUPED`, `ALERT_MODE_BOTH`
- **Source Gap Labels**: `SOURCE_GAP_LABEL_FVG = "FVG"`, etc.
- **Validation Bounds**: All input min/max values controlled by constants
- **UI Defaults**: Default values centralized (e.g., `DEFAULT_LABEL_WINDOW_BARS = 300`)

**Benefits**: Change display text globally by editing one constant; consistent validation bounds; maintainable codebase.

## Naming + Conventions  
- **Never use "IFVG"** in code identifiers. Use: "Implied FVG" (UI) and `SOURCE_GAP_LABEL_IMPLIED` (code)
- **All gaps** are referred to as "Source Gaps" in UI, comments, and docs  
- **Label prefixes** are fixed: `FVG`, `Imp`, `Vol`, `Gap`; polarity appended as `+` or `-`
- **CSD symbols**: Standard uses `▲`/`▼`, Lenient uses `▲L`/`▼L` (via constants)
- **Constant naming**: ALL_CAPS with descriptive prefixes (e.g., `INFO_`, `CSD_`, `SOURCE_GAP_`)

## Performance + Limits
- Indicator limits: `INDICATOR_MAX_BOXES = 500`, `INDICATOR_MAX_LABELS = 500`.
- Unified cap for source gaps: `Max Source Gaps & Labels` controls both box and label counts; older items pruned FIFO.
- Labels window: labels outside `Label Visibility Window (bars)` are removed for clarity; detection/validation unaffected.

## Maintenance Checklist
- When adding/changing inputs:
  - Assign them to the correct group.
  - Update this document (names, defaults, behavior).
- When changing detection/validation:
  - Reflect rules here (especially anything that affects opposite‑direction or origin logic).
- When adjusting labels or positions:
  - Update labeling rules and toggles.
- Keep terminology consistent: "Source Gap", "Implied FVG", "Anchor".

## Quick Test Scenarios (v2.3)
**Core Functionality:**
- Toggle `Enable Gaps` OFF → rectangles and labels disappear; CSD detection continues; anchor labels unaffected
- Toggle `Require Gap` OFF → CSDs can occur without gaps; anchor gap summary suppressed; anchor ID still appears
- Verify anchor ID and gap labels show correct vertical placement and polarity

**Lenient CSD Testing:**
- Enable lenient mode → set leniency level 3 → verify `LL: 3` appears in info table  
- Create scenarios where standard CSD fails but lenient succeeds → verify `▲L` or `▼L` labels appear
- Test priority: standard CSD should prevent lenient on same bar
- Verify lenient targets correct anchor bar (current bar - leniency level)

**Cross-Bar Contamination Prevention:**  
- Create Bar N standard CSD → Bar N+1 lenient CSD targeting same anchor → verify no duplicate arrows
- Test multiple detection attempts on same historical bar → only first should place arrow
- Verify `csd_labeled_bars` array prevents all duplication scenarios

**Suppress Functionality:**
- Enable suppress → create multiple bullish CSDs in sequence → only first should display  
- Trigger opposite direction CSD → reset should allow new signals in original direction
- Verify `SUP` indicator appears in info table when suppress active

**Info Table Dynamic Display:**
- Default state: shows `LB: 4` only
- Enable lenient: shows `LB: 4` and `LL: 2`  
- Enable suppress: shows `SUP` indicator
- All features: shows `LB: 4`, `LL: 3`, `SUP`

**Constants Verification:**
- Modify `INFO_SUPPRESSED_TEXT` → verify table display updates globally
- Change `LENIENT_SUFFIX` → verify all lenient labels use new suffix
- Test validation bounds controlled by constants

*** End of State of Truth ***
