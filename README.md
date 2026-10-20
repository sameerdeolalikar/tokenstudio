# TokenStudio

A local design-token workbench for comparing theme revisions and checking color choices against reusable interface previews. Built with TypeScript 5.9, Node.js 20+, vanilla JavaScript and CSS. This is a new, independently useful application prototype, developed with AI assistance. The bundled sample is fictional; no accounts, API keys or external services are required.

## What works today

- Edit typed color and pixel-dimension tokens with live component previews.
- Resolve aliases and reject cycles, missing references, mismatched types and unsafe CSS values.
- Check named foreground/background pairs against normal or large-text contrast thresholds.
- Compare raw and resolved changes against saved revisions, including indirect alias changes.
- Save themes, retain the last 20 revisions, restore a revision as a draft, undo/redo edits and export resolved CSS or portable JSON.

## Run locally

```sh
npm ci
npm run build
npm start
# Open http://127.0.0.1:7423
```

Start commands run from the repository root. The server binds to `127.0.0.1`; open that address rather than `localhost`, because host/origin checks are deliberate. This local server is not configured for public internet hosting.

Set `TOKENSTUDIO_DATA` to choose the JSON library; the default is `.local-data/themes.json`. Restart after rebuilding backend changes.

## Verify

```sh
npm test
# Browser checks: start a separate server with a disposable data path first.
npm ci
npx playwright install chromium
npm run test:ui
```

Browser tests create synthetic saved records. Point `BASE_URL` at the test server if needed. Chromium requires its normal OS libraries; consult Playwright installation guidance for your system. Set `UI_SCREENSHOTS` to an output directory to capture desktop and narrow-screen evidence. There is no hosted CI configured yet.

## Organization

`src/core.ts` validates themes, resolves aliases, calculates contrast and computes diffs. `src/store.ts` stores revisions atomically; `src/server.ts` serves the local API. `web/` is the browser interface and `tests/` contains domain and UI checks.

## Scope and limitations

Colors are opaque hexadecimal RGB values; dimensions are 0–128px. Limits are 100 tokens, 30 contrast pairs, 100 themes and 20 retained revisions per theme. Aliases must reference a token of the same type. Token names use lowercase dot-separated segments; CSS export converts dots to hyphens.

Contrast checks use unrounded ratios and [WCAG text contrast thresholds](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). They are not a complete accessibility audit and do not inspect actual text size, focus, semantics or non-text contrast. The preview uses a fixed set of token roles with defaults. This custom JSON schema does not claim design-token interchange standard compliance. Run one server process per data file; there is no interprocess lock.

Local state, build output and browser downloads are excluded from Git. Back up your data file before experimenting with it. No telemetry or remote synchronization is implemented.

## Next steps

See [ROADMAP.md](ROADMAP.md) for concrete work with acceptance criteria and rough estimates, and [CONTRIBUTING.md](CONTRIBUTING.md) for development conventions.

## License

MIT. See [LICENSE](LICENSE).
