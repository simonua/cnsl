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
| `node --test tests/<area>/<module>.test.js [additional-affected.test.js]` | Run the exact unit-test files affected by the change |
| `node scripts/run-playwright.js test <spec> --grep "<stable IDs>"` | Run affected browser or accessibility IDs through the serialized Playwright runner |
| `pnpm test` | Run all unit tests for CI parity or an explicitly requested full-suite investigation |
| `pnpm run test:coverage` | Run full delivered-JavaScript coverage for CI parity or an explicitly requested full-suite investigation |
| `pnpm run test:browser:nightly` | Run the complete serialized browser and WCAG suite for CI or an explicit full-suite request |
| `pnpm run measure:performance` | Clean build and measure the default desktop route, phase, request, byte, long-task, and PWA metrics |
| `pnpm run lint` | Run ESLint on all JS files |
| `pnpm run lint:fix` | Auto-fix lint issues |

Before starting a server or test command, inspect VS Code tasks and operating-system processes, including their command lines and workspace paths, for matching work launched by another chat, agent, terminal, or parallel task. Do not start duplicate or overlapping test runs for the same relevant suite; reuse an available result or wait for the active run to finish. Leave unrelated active processes untouched.

Before opening any local page, confirm that port 9090 is listening and make a lightweight HTTP request to `http://localhost:9090/`. Reuse a healthy `CNSL: Start Development Server` process across chat sessions. If a task or process is recorded but the health check fails, inspect its output and process state, then recover the shared server rather than navigating to an unavailable page or launching a competing live-reload server.

The development watcher uses nodemon's polling mode so source edits are detected reliably on Windows. After a successful development build, `posthtml.js` writes `tmp/development-build.txt`; BrowserSync watches only that stable marker and forces one full browser refresh against the complete `out/` artifact. The marker must stay outside `out/` because every build replaces that directory and would drop a file-specific watch. Do not disable nodemon's `legacyWatch` while polling or point BrowserSync directly at source files or the whole `out/` tree. Source events can reload before a rebuild finishes, and output-tree events can reload repeatedly while the directory is replaced.

## Dev CLI

Run `\.\start.ps1` from PowerShell for the interactive developer menu. It covers environment setup, local servers, focused and complete verification, tests, PWA checks, and performance measurement.

## Performance Measurement

- The default `desktop` profile uses the standard browser context. The `mobile` profile uses a 390 by 844 viewport, and `mobile-slow` adds 4x CPU slowdown to that viewport.
- Use at least three runs when drawing an optimization conclusion. Keep the profile, run count, built commit or working-tree state, and local machine comparable between before and after samples.
- In PowerShell, run a slower-device diagnostic with:

   ```powershell
   $env:CNSL_PERF_PROFILE = 'mobile-slow'
   $env:CNSL_PERF_RUNS = '3'
   pnpm run measure:performance
   Remove-Item Env:CNSL_PERF_PROFILE
   Remove-Item Env:CNSL_PERF_RUNS
   ```

- Compare useful-route readiness and phase deltas before interpreting totals. `primary-data-ready` isolates the initial dependency/data path, `summary-visible` isolates primary rendering, and `optional-enrichment-settled` measures background completeness where supported.
- Record median and spread, first contentful paint, DOM readiness, long-task time, annual-domain request counts, decoded/transferred bytes, installed first/repeat navigation, and PWA core/optional tiers. Do not treat `transferSize === 0` alone as proof of a service-worker cache hit.
- A slower `mobile-slow` result demonstrates CPU sensitivity, not a viewport-only defect. Use the unthrottled `mobile` profile when the distinction affects the recommendation.
- Performance budgets are warning thresholds until reviewed variance supports a blocking gate. Explain warnings and regressions rather than weakening a budget to make a run pass.

## Build Pipeline

1. `rimraf out` — Clean output directory
2. `node posthtml.js` — Custom build script that:
   - Copies `src/assets/` and `src/css/` to `out/`
   - Parses `src/js/` with Acorn, rejects CommonJS, Node.js runtime code, and Node-environment guards, then copies validated scripts byte-for-byte to `out/js/`
   - Copies required root static files (`manifest.webmanifest`, `browserconfig.xml`, `robots.txt`, `sitemap.xml`, `LICENSE`, and `CNAME`)
   - Publishes the allowlisted ownership files from `src/site-verification/` at the deployed root and verifies their exact contents
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
- Coverage is a floor, not the assertion strategy. Follow `testing.instructions.md`: preserve confidence with semantic, relational, boundary, and trust-boundary assertions while avoiding incidental coupling to mutable copy, markup serialization, logs, and active annual records.
- Choose every local test command by affected behavior and list its exact files or IDs. A focused passing run completes a focused change; do not run a complete suite afterward for reassurance.
- When a shared contract affects multiple consumers, name their specific tests in one focused command. Add another test only when the changed dependency graph, integration path, or a failure shows that it belongs in scope.
- Run `pnpm run lint` whenever executable JavaScript, JavaScript configuration, build scripts, or automation scripts change; combine it with the focused behavior check below when applicable.

| Change Scope | Local Iteration Check | When To Widen Coverage |
| --- | --- | --- |
| Documentation or agent instructions only | Review the changed content and links; no application test is required. | Run the named command only if the edit changes a command, workflow, or release requirement. |
| One service, model, manager, or type | `node --test tests/<area>/<module>.test.js` | Add exact tests for directly affected consumers or shared owners; do not switch to `pnpm test`. |
| Visitor-facing view, CSS, or interaction | `pnpm run build`, then run the affected Playwright spec and stable IDs. | Add exact sibling workflow or accessibility IDs only when the changed behavior crosses those paths. |
| Significant implemented refactor affecting delivered code or browser-facing contracts | Run affected unit files, then `pnpm run build` and affected Playwright workflow/accessibility IDs. | Add specific alternate-path tests until each changed contract is covered; CI owns the complete browser suite. |
| Annual data or active-season configuration | Follow the season rollover verification, beginning with `pnpm run validate:data`. | Use its complete required checks when activating or publishing a season. |
| Build, PWA/offline, privacy/analytics, shared navigation, or release candidate | Run the exact affected unit and browser tests plus the non-test gates in the release checklist. | CI provides complete-suite coverage; complete secure-origin or manual review where required. |

- Do not run the complete Playwright suite for ordinary local iteration or local release verification. Run changed browser workflows through `node scripts/run-playwright.js test <spec> --grep "<stable IDs>"`; CI owns `pnpm run test:browser:nightly` unless the user explicitly requests it.
- All focused and complete Playwright invocations must use `scripts/run-playwright.js`. The runner serializes invocations for the same workspace, waiting for an existing browser-test process to finish and recovering locks abandoned by interrupted runs.
- The serialized runner validates the lock owner's PID and exact process instance before waiting. It recovers dead or PID-reused locks immediately, records Playwright lifecycle progress, and terminates only a verified CNSL Playwright process tree after 90 seconds without progress. This interval exceeds the configured test and server-startup timeouts. Do not manually terminate an active Playwright test execution or the shared development server.
- The complete local release gate is defined in [docs/release-checklist.md](../../docs/release-checklist.md); it is a publishing checkpoint rather than the default iteration loop.
- The GitHub Pages build contains no Playwright setup or execution. A weekly GitHub Actions workflow also runs `pnpm run test:browser:nightly` after a push to `main` in the preceding seven days, or when manually dispatched, and its result does not block deployment.

## Linting

- ESLint 10+ with flat config (`eslint.config.js`).
- Three environments: browser JS (`src/js/`), Node build scripts, service worker.
- App globals (jQuery, DataManager, etc.) are declared in the ESLint config.
- A lint failure blocks the GitHub build and must be resolved before deployment.
- Values exposed by `src/js/config/app-config.js` must be read from `globalThis` or `window` in browser scripts rather than repeated as local literals. Use an intentional bare script global only when it is established by the surrounding module and declared in `eslint.config.js`.
