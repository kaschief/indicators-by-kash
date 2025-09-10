# SIF Dual Alert System (v9.18)

This document describes the dual alert system added in SIF Hunter° [Pro+] v9.18.

- Alert Mode: `Individual Alerts`, `Grouped Alerts`, or `Both` via `alert_mode`.
- Grouped Alerts: Enable specific parts with checkboxes; create a single TradingView alert using "Any alert() function call".
- Priority: Immediate Inversion > Multi‑Source > Nested > Baseline SIF.
- Titles: Reuse existing SIF titles (SIF⁺/SIF⁻) and special titles for multi‑source, nested, and immediate inversion.

## Inputs
- `Alert Mode`: Global selector for alerting behavior.
- `SIF⁺`, `SIF⁻`: Include baseline SIF alerts in grouped mode.
- `Multi‑Source SIF⁺/⁻`: Include multi‑source grouped alerts.
- `Nested SIF⁺/⁻`: Include nested grouped alerts.
- `Immediate SIF Inversion⁺/⁻`: Include immediate inversion grouped alerts.

## How To Use (TradingView)
1. Add SIF Hunter° [Pro+] to your chart.
2. Open the Inputs → Alert Settings section at the bottom of the menu.
3. Choose `Grouped Alerts` or `Both`, tick the desired alert parts.
4. Create a new alert and choose "Any alert() function call".

## Notes
- Grouped alerts aggregate multiple parts into one succinct message (e.g., `Immediate SIF Inversion⁺ +2 • 15m`).
- Individual alerts remain available and can be created per condition as before.
- Grouped alerts are visual‑only toggles; detection still runs regardless of filter settings.
