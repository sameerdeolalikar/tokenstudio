# Repository Guidelines

## Project Structure & Module Organization

`src/core.ts` validates themes, resolves aliases, calculates contrast and computes diffs. `src/store.ts` stores revisions atomically; `src/server.ts` serves the local API. `web/` is the browser interface and `tests/` contains domain and UI checks. Read README.md before changing storage or data formats. Use examples/ for synthetic fixtures and keep runtime files in .local-data/, which is ignored.

## Build, Test, and Development Commands

The README contains the authoritative run commands and supported runtime versions. Run core verification with `npm test`. Browser verification uses `npm ci`, `npx playwright install chromium`, then `npm run test:ui` while the application runs against disposable data. Set BASE_URL for a different test endpoint. Rebuild compiled code or embedded assets before retesting changes.

## Coding Style & Naming Conventions

Follow nearby code. Python uses four spaces and snake_case; Go uses gofmt; JavaScript and TypeScript use two spaces, camelCase and semicolons. Apply only the relevant language conventions. Keep domain validation on the server and use textContent for user-controlled labels. Preserve explicit error handling and limits. Avoid unrelated reformatting and dependency changes.

## Testing Guidelines

Extend existing domain tests for behavior changes, especially malformed imports, stale revisions and boundary values. Browser tests should exercise observable workflows, persistence and keyboard interaction. Use fictional data, separate storage paths and deterministic assertions. No coverage threshold or hosted CI is configured. Never use an existing personal library as a test fixture.

## Commit & Pull Request Guidelines

Use focused imperative commit subjects. This is a new repository without an established historical convention. Explain the problem, resulting behavior, validation and limitations in pull requests. Include screenshots for UI changes and link an issue when applicable. Do not commit dependencies, build output, local state, secrets or test artifacts.
