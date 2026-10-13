# Pine identifier safety

Verified against TradingView documentation on 2026-09-09. The executable name sets live in `check-pine-identifiers.mjs`; this file explains their provenance and scope.

## Why the check exists

Pulse failed TradingView compilation with `Invalid object name: session. Namespaces of built-ins cannot be used.` A `SessionRange` object variable and a parameter were named `session`. Title and delimiter checks did not catch this.

TradingView documents different restrictions:

- UDT-valued variables cannot share built-in namespace names. Some scalar variables can. [Variable declarations: shadowing](https://www.tradingview.com/pine-script-docs/language/variable-declarations/#shadowing)
- The v5 migration guide explicitly reserves `catch`, `class`, `do`, `ellipse`, `in`, `is`, `polygon`, `range`, `return`, `struct`, `text`, `throw`, and `try` for variable/function naming. This list is not a complete v6 grammar. [Reserved keywords](https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-5/#reserved-keywords)
- UDT type names have different shadowing rules from object variables; fundamental type names are prohibited. Enum names must avoid built-in type/namespace names. [Objects](https://www.tradingview.com/pine-script-docs/language/objects/#shadowing), [Enums](https://www.tradingview.com/pine-script-docs/language/enums/)
- Language/type/qualifier keywords are covered alongside the namespace set. [Type system](https://www.tradingview.com/pine-script-docs/language/type-system/), [Built-ins](https://www.tradingview.com/pine-script-docs/language/built-ins/), [Pine v6 reference](https://www.tradingview.com/pine-script-reference/v6/)
- `order` is a namespace containing the ascending/descending sort constants. Independent regression fixtures cover this namespace so an omitted name cannot hide behind tests generated from the production set. [Arrays: sorting](https://www.tradingview.com/pine-script-docs/language/arrays/#sorting)
- `footprint` and `volume_row` were added in January 2026; triple-quoted multiline strings were added in April 2026. The checker covers those names and ignores the contents of multiline strings. [Release notes](https://www.tradingview.com/pine-script-docs/release-notes/)

## Repository policy

Use no reserved/type/qualifier words or known built-in namespace names for custom declarations, regardless of inferred type. This intentionally stricter rule covers names that Pine permits in some contexts. It avoids needing a partial type-inference engine to identify namespace collisions.

The checker examines variable declarations, tuples, function/method names and parameters, loop bindings, UDT/enum names and fields, and explicit or implicit import aliases. It ignores comments, strings, built-in/member access, named arguments in calls, and reassignment operators. Names are case-sensitive, as in Pine.

Examples:

```pine
// Rejected declarations:
var SessionRange session = na
render(SessionRange session) => session
text = "Asia Open"

// Accepted declarations and built-in uses:
var SessionRange sessionState = na
render(SessionRange sessionState) => sessionState
labelText = "Asia Open"
label.new(bar_index, close, text=labelText, color=color.red)
```

## Required checks

```sh
# Complete working-tree content of each edited indicator or library:
node scripts/check-pine-identifiers.mjs indicators/09-pulse/code/pulse.pine

# Optional inspection of exact staged content:
node scripts/check-pine-identifiers.mjs --staged

# Read-only audit of tracked and non-ignored untracked Pine sources:
node scripts/check-pine-identifiers.mjs --all

# Checker regression tests:
node --test tests/tooling/pine-identifiers.test.mjs
```

A failure prints the filename, line, column, declaration role, offending name, and restriction category, and exits nonzero. A whole-file check includes older declarations in a touched file; there is no allowlist or baseline exemption. An all-files audit can therefore identify old policy violations without proving that those scripts fail TradingView compilation. Do not expand a focused task into unrelated source/library migrations merely to clear that audit.

## Maintenance and limits

TradingView's reference manual and release notes are authoritative. The checked-in namespace inventory is a dated local policy set, not a claim that TradingView publishes an exhaustive static reserved-word list. When new built-ins appear, update the sets and their tests. Keep the checker offline and deterministic during edits and commits.

This is a lightweight declaration checker, not a Pine parser/compiler. Passing it does not validate types, function signatures, security requests, execution order, Replay, or drawings. TradingView compilation remains a separate required validation state. The AGENTS.md rule requires this check after every Pine edit and before handing code to the user. The naming check is not attached to a Git hook; it must run before the user reaches TradingView compilation.
