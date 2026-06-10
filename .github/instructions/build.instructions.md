---
description: "Use when working with the build pipeline, dev server, testing, linting, or CI/CD. Covers pnpm, PostHTML, and dev workflow."
---

# Build & Development Conventions

## Package Manager

- **Use pnpm** (not npm). The lockfile is `pnpm-lock.yaml`.
- `package-lock.json` is gitignored.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm start` | Clean, build, watch for changes, and serve with live reload (port 9090) |
| `pnpm run build` | One-time clean build to `out/` |
| `pnpm test` | Run all unit tests |
| `pnpm run test:coverage` | Run unit tests with coverage for delivered application JavaScript (`src/js/**`, `service-worker.js`); omit `scripts/**` maintenance implementations from the report |
| `node --test tests/<area>/<module>.test.js` | Run one affected unit-test file during iteration |
| `pnpm run test:browser:nightly` | Run serialized Playwright workflow and WCAG A/AA checks for the conditional nightly workflow or required significant-refactor completion gate |
| `pnpm run lint` | Run ESLint on all JS files |
| `pnpm run lint:fix` | Auto-fix lint issues |

Before starting a server or test command, inspect VS Code tasks and operating-system processes, including their command lines and workspace paths, for matching work launched by another chat, agent, terminal, or parallel task. Do not start duplicate or overlapping test runs for the same relevant suite; reuse an available result or wait for the active run to finish. Leave unrelated active processes untouched.

Before opening any local page, confirm that port 9090 is listening and make a lightweight HTTP request to `http://localhost:9090/`. Reuse a healthy `CNSL: Start Development Server` process across chat sessions. If a task or process is recorded but the health check fails, inspect its output and process state, then recover the shared server rather than navigating to an unavailable page or launching a competing live-reload server.

## Dev CLI

Run `\.\start.ps1` from PowerShell for the interactive developer menu. It covers environment setup, local servers, focused and complete verification, tests, PWA checks, and performance measurement.

## Build Pipeline

1. `rimraf out` — Clean output directory
2. `node posthtml.js` — Custom build script that:
   - Copies `src/assets/` and `src/css/` to `out/`
   - Parses `src/js/` with Acorn, rejects CommonJS, Node.js runtime code, and Node-environment guards, then copies validated scripts byte-for-byte to `out/js/`
   - Copies required root static files (`manifest.webmanifest`, `browserconfig.xml`, `BingSiteAuth.xml`, `google3dd9d57115818ebb.html`, `robots.txt`, `sitemap.xml`, `LICENSE`, and `CNAME`)
   - Generates a precache inventory from the delivered artifact and updates `service-worker.js` with a build cache version
   - Processes HTML with PostHTML (extend + include plugins)
   - Publishes only `data/<YEAR>/` for the configured active season; all other annual data folders are excluded
   - Excludes retained active-season PDF evidence directories and `images/logos/originals/` from copy

## Output

- `out/` is the build output directory (gitignored).
- Never edit files in `out/` — they are overwritten on every build.
- GitHub Pages serves from the `out/` directory (or configured branch).
- Published `out/js/` assets must never contain `require()`, `module.exports`, `process`, `__dirname`, test harnesses, fixtures, mocks, or other Node.js/test-only code.
- `pnpm run verify:pwa` validates generated offline/cache, manifest, canonical, and crawler artifacts after a build.

## Testing

- Tests are in `tests/` using Node.js built-in test runner.
- Test files follow the pattern `tests/**/*.test.js`.
- Test-only loaders, manifests, fixtures, and mocks belong under `tests/` and must not be copied into `out/`. Narrow adapters for genuine build-time Node consumers belong under `scripts/adapters/`.
- `pnpm run test:coverage` still executes tests that import `scripts/**`, but reports only delivered application JavaScript (`src/js/**` and `service-worker.js`) and excludes maintenance/validation implementations.
- Choose local checks by affected behavior while iterating; do not run the complete test suite for a documentation-only change or an isolated edit already covered by one focused test file.
- Run `pnpm run lint` whenever executable JavaScript, JavaScript configuration, build scripts, or automation scripts change; combine it with the focused behavior check below when applicable.

| Change Scope | Local Iteration Check | When To Widen Coverage |
| --- | --- | --- |
| Documentation or agent instructions only | Review the changed content and links; no application test is required. | Run the named command only if the edit changes a command, workflow, or release requirement. |
| One service, model, manager, or type | `node --test tests/<area>/<module>.test.js` | Run `pnpm test` when shared contracts, utility behavior, or several consumers change. |
| Visitor-facing view, CSS, or interaction | `pnpm run build` and inspect the affected workflow in the running site. | The next nightly browser-verification run covers Playwright workflows and automated accessibility after repository updates. |
| Significant implemented refactor affecting delivered code or browser-facing contracts | Run focused checks while iterating, then `pnpm run build` and `pnpm run test:browser:nightly` when the refactor is complete. | Treat the serialized browser workflow and WCAG result as required completion evidence for the refactor. |
| Annual data or active-season configuration | Follow the season rollover verification, beginning with `pnpm run validate:data`. | Use its complete required checks when activating or publishing a season. |
| Build, PWA/offline, privacy/analytics, shared navigation, or release candidate | Use the complete automated gate in the release checklist. | Complete secure-origin or manual review sections where required. |

- Do not run Playwright for ordinary local iteration or the general release gate. As an explicit exception, run `pnpm run test:browser:nightly` locally after a significant implemented refactor affecting delivered application behavior or browser-facing contracts.
- Both the nightly workflow and the significant-refactor completion gate must run Playwright through `pnpm run test:browser:nightly`. The Playwright configuration serializes invocations for the same workspace, waiting for an existing browser-test process to finish and recovering locks abandoned by interrupted runs.
- When an explicitly requested, required significant-refactor, or nightly `pnpm run test:browser:nightly` run is blocked by a long-running idle lock holder, inspect the owning process command line and activity. If it is a persistent Playwright `test-server` process for this workspace, has produced no test progress while blocking the requested run, and has remained idle for at least 15 minutes, automatically terminate only that `test-server` process and allow the queued command to recover the abandoned lock. Do not terminate an active Playwright test execution, a process still reporting test progress, or the shared development server.
- The complete local release gate is defined in [docs/release-checklist.md](../../docs/release-checklist.md); it is a publishing checkpoint rather than the default iteration loop.
- The GitHub Pages build contains no Playwright setup or execution. A nightly GitHub Actions workflow also runs `pnpm run test:browser:nightly` after a push to `main` in the preceding 24 hours, or when manually dispatched, and its result does not block deployment.

## Linting

- ESLint 10+ with flat config (`eslint.config.js`).
- Three environments: browser JS (`src/js/`), Node build scripts, service worker.
- App globals (jQuery, DataManager, etc.) are declared in the ESLint config.
- A lint failure blocks the GitHub build and must be resolved before deployment.
- Values exposed by `src/js/config/app-config.js` must be read from `globalThis` or `window` in browser scripts rather than repeated as local literals. Use an intentional bare script global only when it is established by the surrounding module and declared in `eslint.config.js`.
