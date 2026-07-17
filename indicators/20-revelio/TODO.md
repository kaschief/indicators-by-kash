# Revelio TODO

## Interface audit

- [ ] Audit every exposed input before doing further machinery-hiding cleanup. For each control, document the user-facing outcome, expected change frequency, implementation dependencies, calibrated default, and whether it should remain exposed, be renamed or reframed, be consolidated, move to an advanced section, or be removed from the interface and kept internal. Review the recommendations before changing controls or behavior.
- [ ] After the audit is approved, apply an Apple-like interface cleanup across the rest of the indicator: foreground meaningful user decisions and outcomes, hide stable implementation and calibration machinery, use clear plain-language labels and progressive disclosure, preserve necessary expert overrides, and verify that existing user-facing behavior remains unchanged after each phase.

## Future features

- [ ] Add a temporary `Early` designation to Weekly, Monthly, and Quarterly developing profiles when Auto reveals them through smart early maturity before the normal completed-session threshold. Show the designation only during the early-maturity stage; remove it once the profile reaches normal maturity or the applicable early-stage/stabilization window has passed. Define the exact removal condition before implementation.
- [ ] Explore showing how far the live Weekly, Monthly, and Quarterly profile has progressed through its full period as part of its column label—for example, `Monthly · 79% elapsed`. This is profile-period progress, not maturity progress. Consider elapsed percentage, time remaining, or the next boundary date/time, and define whether progress is based on calendar time or eligible trading time for weekends, holidays, 24/7 assets, and session-based markets.
- [ ] Evaluate Monthly and Quarterly profiles as additional Value Gap sources, following the existing confirmed-gap lifecycle, mitigation, filtering, and drawing-budget behavior.
- [ ] Add an optional side-by-side column layout for open Value Gaps, following the existing Gaps indicator pattern. Define ordering, maximum visible columns, spacing, and how this layout interacts with the current historical and floating display modes.

## Completed

- [x] Make dated Monthly profile labels use the same calendar timezone as their profile boundary. Crypto and other 24/7 Monthly profiles are anchored in UTC; futures and other session-based Monthly profiles use New York time.
