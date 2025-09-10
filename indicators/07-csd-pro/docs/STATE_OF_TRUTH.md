# Gap Visualizer [Pro+] — State of Truth

This document is the authoritative, up‑to‑date reference for the indicator’s behavior, inputs, naming, and rendering. Keep this file current when logic or UI changes.

## Overview
- Name: Gap Visualizer [Pro+]
- Purpose: Detect and render Source Gaps; validate and visualize Change in State of Delivery (CSD) with an Anchor Candle and optional anchor labels.
- Script: indicators/07-csd-pro/code/development/csd-pro-dev-v2.0.pine

## Terminology (canonical)
- Source Gaps: the only accepted term for gaps used by this script. Types:
  - FVG (Fair Value Gap): label prefix `FVG`
  - Implied FVG: label prefix `Imp`
  - Volume Imbalance: label prefix `Vol`
  - True Gap: label prefix `Gap`
- Polarity Suffix: `+` (bullish) or `-` (bearish) appended to every source gap label.
- CSD (Change in State of Delivery):
  - Bullish CSD: bullish candle whose close > open[1] of prior bearish candle.
  - Bearish CSD: bearish candle whose close < open[1] of prior bullish candle.
- Anchor Candle: the candle immediately preceding a valid CSD.

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
- Opposite‑direction requirement (core rule):
  - Bullish CSD requires a bearish source gap in lookback; bearish CSD requires a bullish source gap.
- Lookback origin check: a source gap validates only if its origin index is within the lookback window.
- Toggle: `CSD: Require Source Gap In Lookback` (on by default)
  - On: an opposite‑direction source gap origin must exist within the window for CSD to be valid.
  - Off: CSD can be valid without gaps; Anchor Gap label is suppressed; Anchor ID still displays on valid CSDs.

## Labels and Rendering
- Source Gap Rectangles
  - Color: `Source Gap Color`.
  - Toggle: `Show Source Gaps (with Labels)` — labels are tied to boxes; detection always runs regardless of visibility.
  - Label format: text only (transparent background), `FVG+/Imp-/Vol+/Gap-`.
  - When `Show Source Gaps` is OFF, rectangles and their labels are not rendered; existing labels are removed.
- Anchor Labels (drawn on valid CSD’s Anchor Candle)
  - Single combined label (two lines max) that follows the distal rule:
    - Bullish (belowbar): first line = ▲ (near the candle), second line = summary (farther)
    - Bearish (abovebar): first line = summary (nearer), second line = ▼ (farther)
  - Tooltip: always shows full gap details (counts by type, total, and types list) even when summary is grouped.
  - Size and color: `Label Size` and `Anchor Label Text Color` apply to the entire combined label.
  - Positioning: Bullish CSD → below the candle; Bearish CSD → above the candle; Anchor ID closer; summary farther.
  - Formatting (summary):
    - Single type → `FVG x2` (omit `x1`)
    - Two types, small total → `(Gap x Vol)`; include counts as `xN` only when >1 (e.g., `(FVG x2 x Vol)`)  
- Many types or total count ≥ 3 → `(3)` (total only)
  - Colors: text colors for Source Gap labels and Anchor labels are independently configurable; all label backgrounds are transparent.
  - Toggle: `Show Anchor Labels` (on/off).
- CSD Candle Coloring
  - Removed: candle colorization has been discarded to keep the UI minimal and focused on key visuals.
- Info Table
  - Shows `LB: <lookback>`; 9 positions (Top/Middle/Bottom × Left/Center/Right); customizable text/bg color and size.

## Inputs (grouped)
- Anchors (first)
  - `Show`
  - `Text Color`, `Size` (Tiny/Small/Normal/Large/Huge)
  - `Max Labels`
- CSD Validation
  - `Require Gap` (bool)
  - `Lookback (bars)`
- Source Gaps
  - `FVG` (enable_fvg): on by default
  - `Implied FVG` (enable_implied_fvg): on by default
  - `Vol Imbalance` (enable_vol): on by default
  - `True Gap` (enable_true_gap): on by default
  - `Show`, `Color`, `Text Color`, `Size`, `Max Gaps`
- Visibility
  - `Label Window (bars)` — display-only window for both Anchor and Source labels
- Info Table (kept at bottom)
  - `Show Lookback Info`, `Info Position`, `Info Text Color`, `Info BG Color`, `Info Text Size`

## Naming + Conventions
- Never use "IFVG" in code identifiers. Use: "Implied FVG" (UI) and `SOURCE_GAP_LABEL_IMPLIED` (code).
- All gaps are referred to as "Source Gaps" in UI, comments, and docs.
- Label prefixes are fixed: `FVG`, `Imp`, `Vol`, `Gap`; polarity appended as `+` or `-`.

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

## Quick Test Scenarios
- Toggle `Show Source Gaps (with Labels)` OFF → rectangles and their labels disappear; CSD detection continues; anchor labels unaffected.
- Toggle `CSD: Require Source Gap In Lookback` OFF → valid CSDs can occur without gaps; Anchor Gap label is suppressed; Anchor ID still appears on valid CSDs.
- Verify Anchor ID and Anchor Gap labels appear with correct vertical placement and polarity.
- Validate opposite‑direction requirement by constructing sequences where only the opposite gap exists in lookback.

*** End of State of Truth ***
