# MBZ Hunter° Pro+ — v9.18 Dual Alert System

This document centralizes the explanatory comments previously embedded in the script. The Pine file now keeps only minimal, essential comments. Refer here for details on alert behavior, label structure, and recent feature notes.

## Alert Modes
- Individual Alerts: Attach alerts per `alertcondition` in TradingView.
- Grouped Alerts: Create one alert using "Any alert() function call"; the script composes messages.
- Both: Enables both methods (may duplicate notifications if overlapping signals).

## Individual Alerts
- Title: condition name (e.g., "MBZ⁺", "Nested MBZ⁻").
- Message: timeframe only (e.g., "15m").
- No price or extra wording.

## Grouped Alerts
- Format: "<lead> +N • <timeframe>" (no prefix/price/commas/dashes).
- Lead priority (specials only): Deeper Wick > Multi-Source > Nested > MBZ baseline.
- +N counts other specials on the same bar (baseline MBZ never counted).
  - If lead is a special: N = specials_count - 1 (omit when 0).
  - If lead is MBZ only: N = specials_count (omit when 0).
- Examples:
  - "Deeper Wick MBZ⁺ • 15m"
  - "Multi-Source MBZ⁻ +1 • 5m"

## Checkbox Labels (Grouped Controls)
- MBZ⁺ / MBZ⁻: Baseline MBZ formations.
- Multi-Source MBZ⁺/⁻: Same-bar, same-direction MBZs ≥ 2.
- Nested MBZ⁺/⁻: Overlapping MBZs in same direction.
- Deeper Wick MBZ⁺/⁻: MBZs with deeper wick conditions (see below).

## Label Structure Guide

Candle labels (behavior-first):
- Format: [SUPER] + BEHAVIOR + MBZ⁺/⁻ + [½] + (source) + [subtype]
- Examples: "Inclusion MBZ⁺ (imp) ↓inc", "✔ Reflection MBZ⁻[½] (vol) ↑ref" (the word Inclusion or Reflection appears in hover tooltips only)
- Reversal rule: For MBZ⁻, multi-part labels reverse their order.

Tooltips (comprehensive):
- Format: MBZ⁺/⁻ + subtype + deeper_wick + [½] + fill% + overlap + breach + [X]
- Example lines include overlap percent, breach state/percent, and invalidation.

Extension boxes (clean):
- Format: [SUPER] + MBZ⁺/⁻ + [½] + (source_breakdown) + [subtype] + [special] + [status]
- Status always last: [BREACHED], [X].

## Deeper Wick Marking
- Modes: Off, Star, Border, Star + Border.
- Symbol options: Circle (◉) or Text (deeper).
- Standard deeper wick: MBZ formation candle wick penetrates the source gap ≥ mitigating candle.
- Optional (Reflection pattern deeper): Project reflection wick and compare to mitigating wick depth.

## Source Types & Subtypes (Summary)
- Sources: FVG (implied by default), Implied FVG, Volume Imbalance, True Gap.
- Behaviors: Inclusion (toward body), Reflection (away from body).
- Subtype display arrows: ↑ref, ↓ref, ↑inc, ↓inc (+* for risky tier when applicable).

## Breach vs Invalidation (Concepts)
- Breach: Early warning before invalidation; can fade extension box and change label color.
- Invalidation: Confirmed by close penetration (or gap open beyond zone boundary).

## v9.17 Notables (Now integrated in v9.18)
- Source Gap Wick Detection + visual border/star modes.
- Special Properties menu group (Nested, Multi-Source border, Wick Dominance, Deeper Wick).
- Behavior-first tooltip structure (e.g., "Inclusion MBZ⁺ (imp)").
- Invalidation lines default OFF for cleaner charts.
- Superscript MBZ⁺/MBZ⁻ notation across UI.

---

For developers: keep explanatory sections here. In-code comments should stay minimal and only aid understanding of non-obvious logic.
