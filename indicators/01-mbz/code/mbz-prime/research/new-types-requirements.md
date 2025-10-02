# MBZ — Liquidity‑Pool Formation Rules (Immediate / Standard / Delayed)

**Type:** Feature
**Status:** Ready for Refinement
**Owner:** PM
**Partners:** Principal Eng, Indicator Eng, QA
**Out of scope:** Any change to GAP branch detection, display, alerts

---

## 0) Background & Intent

- Current product supports **gap** as a **source family** with one **formation rule** (gap confirmation). This path **must remain unchanged**.
- We are adding the **liquidity‑pool** source family with **three formation rules**: **Immediate**, **Standard**, **Delayed**.
- **Liquidity pools are inputs** (e.g., `daily`, later `weekly`, `monthly`, sessions). **Pools do not define the rule**; rules are structural (Mitigating Candle A + MBZ Candle B behavior).
- **Single label/extension/alert pipeline** is reused; no duplicate systems.

---

## 1) Canonical Vocabulary & Casing

- **Source family** (context provider)

  - **gap** → existing gap sources: `fvg`, `imp`, `vol`, `gap`, `rdrb`, …
  - **liquidity‑pool** → pools: `daily` (initial), later `weekly`, `monthly`, `asia`, `london`, `nyam`, `lunch`, `nypm`, …

- **Formation rule** (structure of A/B)

  - Gap branch: current gap confirmation rule (unchanged).
  - Liquidity‑pool branch: **Immediate**, **Standard**, **Delayed**.

- **Mitigating Candle (A)** — first candle; provides the midpoint already used in engine.
- **MBZ Candle (B)** — second candle; when rule passes, **B’s body is the MBZ zone**.

**Casing in labels (user‑visible):**

- **Pattern tag (liquidity only):** `LIMM-MBZ`, `LSTD-MBZ`, `LDEY-MBZ` (ALL‑CAPS, 3 letters + “-MBZ”).
- **Source tag:** lowercase words, no underscores (e.g., `daily`, `weekly`, `london`, `nypm`, `fvg`, `imp`, `gap`).
- Gap branch shows **no new pattern tag** (only one rule there); keep existing `MBZ` / arrow / subtype markers.

---

## 2) Liquidity‑Pool Formation Rules (direction‑explicit)

> _Midpoint_ = existing midpoint of Mitigating Candle A’s body.
> _Strict_ comparison: equality does **not** count as beyond.

### A) Immediate — label tag: `LIMM-MBZ`

**A (Mitigating):** body entirely inside the liquidity pool; **no wick** pierces the pool extreme; **no close** outside.
**B (MBZ):**

- **Open must be on the inside side of the pool (before the sweep):**

  - Pool high case: `B.open < pool_high`
  - Pool low case: `B.open > pool_low`

- **Wick must exceed** the pool extreme (strict):

  - Pool **high** → `B.high > pool_high`
  - Pool **low** → `B.low  < pool_low`

- **Close must finish beyond A’s midpoint on the opposite side of the sweep in the same candle:**

  - Swept **above high** → `B.close < A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close <= A.midpoint` and mark with `[½]`.
  - Swept **below low** → `B.close > A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close >= A.midpoint` and mark with `[½]`.

### B) Standard — label tag: `LSTD-MBZ`

**A (Mitigating):** **wick pierces** pool extreme but **body closes inside**:

- High case: `A.high > pool_high` and `A.close <= pool_high`
- Low case: `A.low  < pool_low` and `A.close >= pool_low`

**B (MBZ):**

- **Open must be on the inside side of the pool (before its move):**

  - High case: `B.open < pool_high`
  - Low case: `B.open > pool_low`

- **Must not set a new extreme beyond A’s wick:**

  - High case (default strict): `B.high < A.high`
    Optional equality (user toggle): allow `B.high <= A.high`.
  - Low case (default strict): `B.low  > A.low`
    Optional equality (user toggle): allow `B.low  >= A.low`.

- **Must close beyond A’s midpoint opposite A’s sweep:**

  - A swept **above high** → `B.close < A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close <= A.midpoint` and mark with `[½]`.
  - A swept **below low** → `B.close > A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close >= A.midpoint` and mark with `[½]`.

### C) Delayed — label tag: `LDEY-MBZ`

**A (Mitigating):** body **closes completely outside** the pool:

- High case: `A.close > pool_high`
- Low case: `A.close < pool_low`

**B (MBZ):**

- **Open must be outside the pool on the same side as A’s close:**

  - High case: `B.open > pool_high`
  - Low case: `B.open < pool_low`

- **Closes beyond A’s midpoint back toward the prior range:**

  - A closed **above high** → `B.close < A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close <= A.midpoint` and mark with `[½]`.
  - A closed **below low** → `B.close > A.midpoint` (default strict)
    Optional equality (50% toggle): allow `B.close >= A.midpoint` and mark with `[½]`.

- B wick sweep is **not required**.

---

## 3) Pools (inputs)

- **Initial pool set:** `daily` (both high/low are implied by direction; we do **not** print “high/low” in the label).
- **Roadmap pools:** `weekly`, `monthly`, `asia`, `london`, `nyam`, `lunch`, `nypm`, … (additive; does not change rules).
- **Timezone:** Construct pools in **America/New_York** (midnight/day/session boundaries consistent).

---

## 4) Display, Labels, Extensions (single pipeline)

**Label template:**

```
<arrow> <PATTERN-MBZ> (<source list>) <optional inc/ref> <optional [STRONG]>
```

- **Source list** groups all contributing sources for that MBZ **without duplicating the box**. Examples:

  - Mixed gap+liquidity: `↓ LIMM-MBZ (fvg, daily)`
  - Multi-gap: `↑ MBZ (4: fvg, vol×2, imp)`
  - Multi-liquidity: `↓ LDEY-MBZ (3: daily×2, weekly)`

**Examples:**

- Gap FVG (unchanged): `↑ MBZ (fvg) ↓inc`
- Liquidity Immediate daily: `↓ LIMM-MBZ (daily)`
- Liquidity Standard weekly: `↑ LSTD-MBZ (weekly)`
- Liquidity Delayed london: `↓ LDEY-MBZ (london) ↑ref`

**Rules:**

- **Deeper‑wick markers apply to gap branch only; never to liquidity‑pool MBZs.**
- Inclusion/Reflection markers continue as today.
- Pattern tag present **only** for liquidity branch.
- Source tags are lowercase; no underscores.
- If multiple sources contributed on the same B, **render a single MBZ box** and aggregate all sources in the label source list as shown above.
- Extensions, projections, invalidation, grouped alerts, styling → **reuse** current pipeline.

---

## 5) User Controls (v1)

> **UI naming clarity:** The two equality options must be clearly differentiated in copy so users do not confuse them. Suggested labels:
>
> - “Confirm on 50% close (adds [½])” — reuses existing system; applies to any rule that checks close vs midpoint.
> - “Standard: allow B = A’s sweep extreme (no label change)” — affects only LSTD-MBZ’s extreme guard.

- **Detection source:** `gap` | `liquidity‑pool` | `both`
- **Liquidity formation rules** (visible if liquidity‑pool enabled): checkboxes `Immediate`, `Standard`, `Delayed` (no abbreviations in UI)
- **Liquidity pools:** checkbox list; initially `daily`; later adds `weekly`, `monthly`, sessions (`asia`, `london`, `nyam`, `lunch`, `nypm`, …)
- **Gap source toggles:** unchanged (fvg, imp, vol, gap, rdrb, …)
- **Equality options:**

  - **Midpoint-close equality (reuse existing):** allow `B.close == A.midpoint` to count as confirmation and add `[½]` in labels (mirrors current gap behavior). _This reuses the existing 50% pipeline; do not reimplement._
  - **Standard: allow B extreme equality to A’s wick extreme (new):** when ON, accept `B.high <= A.high` / `B.low >= A.low` in **LSTD-MBZ**. _Logic only; no `[½]` or label change._

- **Source visualization:**

  - _Show source gaps_ (existing)
  - _Show source liquidity pools_ (new): draw the specific pool level lines used by each MBZ (style settings below).:\*\*
  - _Show source gaps_ (existing)
  - _Show source liquidity pools_ (new): draw the specific pool level lines used by each MBZ (style settings below).

---

## 6) Conflict & Coexistence

- **Single box policy:** If gap and liquidity sources both qualify on the same MBZ Candle B, **render one MBZ zone** (from B’s body) and **aggregate sources** into the label’s source list: e.g., `LIMM-MBZ (fvg, daily)`.
- **No dedupe of labels into separate boxes** in v1; we consolidate into one label per MBZ zone.
- **Global limits:** Existing max counts/capacity modes apply to all MBZs.

---

## 7) Edge‑Case Policies

- **Equality isn’t beyond**: touching a pool is **not** a sweep; strict `>`/`<` checks only (no equality option for pool sweeps).
- **Midpoint equality policy (reused):** when the 50% toggle is ON, equality to A.midpoint confirms and adds `[½]` to labels (parity with gap branch). _Re-use existing implementation._
- **Standard’s new‑extreme guard:** default strict `<` / `>`; equality (`<=`/`>=`) allowed only when the **Standard extreme equality** toggle is ON. No label change when used.
- **Doji A:** midpoint = open = close; rules apply unchanged.
- **Inside tests:**

  - Pool **high** inside = `A.high < pool_high` and `A.close <= pool_high`.
  - Pool **low** inside = `A.low > pool_low` and `A.close >= pool_low`.

- **Delayed:** B wick sweep **not required**.
- **Timezone:** Always America/New_York for pool construction.:\*\* Always America/New_York for pool construction.

---

## 8) Acceptance Criteria

- No regressions on gap branch (detection, visuals, alerts, performance).
- Liquidity branch forms `LIMM-MBZ`, `LSTD-MBZ`, `LDEY-MBZ` correctly on **daily** pools.
- Labels show arrow + `PATTERN-MBZ` (liquidity only) + aggregated source list in parentheses + optional `inc/ref`.
- **No deeper** markers on liquidity MBZs.
- **Midpoint-close equality** reuses the existing 50% logic: equality confirms and `[½]` appears when the toggle is ON.
- **Standard extreme equality**: when the toggle is ON, equality to A’s wick extreme is accepted and **no label change** occurs; when OFF, strict `<`/`>` is enforced.
- Source visualization works for **source liquidity pools** (lines) and **source gaps** (existing).
- Hover tooltips include aggregated source breakdown and counts for both gap and liquidity contributors.
- Source and rule toggles affect output immediately.
- Performance parity with v10 under typical loads. with v10 under typical loads.

---

## 9) Out of Scope (v1)

- Adding `weekly`, `monthly`, or session pools (post‑v1 roadmap).
- Any change to gap detection/labels/alerts.
- New alert categories.

---

## 10) QA Matrix (minimum cases)

- **Immediate (high):** A inside high; B: `B.open < pool_high`, `B.high > pool_high`, `B.close < A.midpoint` → expect `↓ LIMM-MBZ (daily)`; with 50% toggle ON, equality `<=` allowed and `[½]` appears.
- **Immediate (low):** A inside low; B: `B.open > pool_low`, `B.low < pool_low`, `B.close > A.midpoint` → expect `↑ LIMM-MBZ (daily)`; with 50% toggle ON, equality `>=` allowed and `[½]` appears.
- **Standard (high):** A: `A.high > pool_high`, `A.close <= pool_high`; B: `B.open < pool_high`, `B.high < A.high` (or `<=` with toggle), `B.close < A.midpoint` (or `<=` with 50% toggle) → expect `↓ LSTD-MBZ (daily)`.
- **Standard (low):** A: `A.low < pool_low`, `A.close >= pool_low`; B: `B.open > pool_low`, `B.low > A.low` (or `>=` with toggle), `B.close > A.midpoint` (or `>=` with 50% toggle) → expect `↑ LSTD-MBZ (daily)`.
- **Delayed (high):** A: `A.close > pool_high`; B: `B.open > pool_high`, `B.close < A.midpoint` (or `<=` with 50% toggle) → expect `↓ LDEY-MBZ (daily)`.
- **Delayed (low):** A: `A.close < pool_low`; B: `B.open < pool_low`, `B.close > A.midpoint` (or `>=` with 50% toggle) → expect `↑ LDEY-MBZ (daily)`.
- **Equality guard:** equality at the pool level never counts as sweep; verify toggles don’t alter this.
- **Single-box aggregation:** same-bar gap + liquidity → one box with label `PATTERN-MBZ (fvg, daily)`; counts roll up when multiple sources (e.g., `(4: fvg, vol×2, imp)`, `(3: daily×2, weekly)`).

---

## 11) Telemetry (optional)

- Counts per branch/rule (`gap` vs `LIMM/LSTD/LDEY`) and per source tag.
- Aggregated source counts per MBZ (e.g., `(4: fvg, vol×2, imp)`; `(3: daily×2, weekly)`).
- Time‑to‑breach/invalidation per pattern.

---

## 12) Risks & Mitigations

- **Ambiguity on “inside/outside”** → strict inequalities specified.
- **Label noise** → consistent `PATTERN-MBZ` + lowercase pool tag keeps labels terse.
- **Performance** → bound arrays for pools; reuse existing capacity controls.

---

## 13) Rollout

- Ship with liquidity‑pool source disabled by default (or enabled only with **Immediate**) for validation.
- Changelog includes screenshots for Immediate/Standard/Delayed (daily).
- Gather usage/feedback; then enable `weekly`, `monthly`, sessions in stages.
