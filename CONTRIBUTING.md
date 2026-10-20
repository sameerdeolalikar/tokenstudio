# Contributing to TokenStudio

Start with README.md and ROADMAP.md. Keep changes focused and use fictional fixtures. Never add local data files, credentials or generated dependencies.

## Development

`src/core.ts` validates themes, resolves aliases, calculates contrast and computes diffs. `src/store.ts` stores revisions atomically; `src/server.ts` serves the local API. `web/` is the browser interface and `tests/` contains domain and UI checks.

Follow adjacent conventions: Python uses four-space indentation and snake_case; Go uses gofmt; TypeScript and browser JavaScript use two-space indentation, camelCase and semicolons. Only the languages present in this repository apply. Format HTML, CSS and JavaScript consistently. No formatter or lint pipeline is enforced yet beyond the checks listed in the README.

## Validation

Run the documented core tests after domain or persistence changes. Run the browser test against an isolated data file after UI changes. Include keyboard and narrow-screen checks. Add regression tests for failures and avoid asserting only implementation details. No coverage percentage is required.

## Changes and review

Use concise imperative commit subjects, such as `Fix stale revision handling`. This new repository has no long-established commit convention. A pull request should describe the problem, observable result, test commands and known limitations. Link the relevant issue when one exists; include before/after screenshots for visible changes. Keep claims about accessibility and algorithm quality within what was tested.
