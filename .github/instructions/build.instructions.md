---
description: "Use when working with the build pipeline, dev server, testing, linting, or CI/CD. Covers pnpm, PostHTML, and dev workflow."
---

# Build & Development Conventions

## Package Manager

- **Use pnpm** (not npm). The lockfile is `pnpm-lock.yaml`.
- `package-lock.json` is gitignored.

## Commands

| Command | Purpose |
|---|---|
| `pnpm start` | Clean, build, watch for changes, and serve with live reload (port 9090) |
| `pnpm run build` | One-time clean build to `out/` |
| `pnpm test` | Run all unit tests |
| `node --test tests/<area>/<module>.test.js` | Run one affected unit-test file during iteration |
| `pnpm run test:browser:nightly` | Run Playwright workflow and WCAG A/AA checks from the conditional nightly workflow only |
| `pnpm run lint` | Run ESLint on all JS files |
| `pnpm run lint:fix` | Auto-fix lint issues |

## Dev CLI

Run `.\start.ps1` (Windows) or `./start.sh` (macOS/Linux) for an interactive menu covering setup, verification, linting, and testing.

## Build Pipeline

1. `rimraf out` — Clean output directory
2. `node posthtml.js` — Custom build script that:
   - Copies `src/assets/`, `src/css/`, `src/js/` to `out/`
   - Copies required root static files (`manifest.webmanifest`, `browserconfig.xml`, `robots.txt`, `sitemap.xml`, and `LICENSE`) and copies optional `CNAME` only when configured
   - Generates a precache inventory from the delivered artifact and updates `service-worker.js` with a build cache version
   - Processes HTML with PostHTML (extend + include plugins)
   - Publishes only `data/<YEAR>/` for the configured active season; all other annual data folders are excluded
   - Excludes retained active-season PDF evidence directories and `images/logos/originals/` from copy

## Output

- `out/` is the build output directory (gitignored).
- Never edit files in `out/` — they are overwritten on every build.
- GitHub Pages serves from the `out/` directory (or configured branch).
- `pnpm run verify:pwa` validates generated offline/cache, manifest, canonical, and crawler artifacts after a build.

## Testing

- Tests are in `tests/` using Node.js built-in test runner.
- Test files follow the pattern `tests/**/*.test.js`.
- Services and models export via `module.exports` for Node.js test access.
- Choose local checks by affected behavior while iterating; do not run the complete test suite for a documentation-only change or an isolated edit already covered by one focused test file.
- Run `pnpm run lint` whenever executable JavaScript, JavaScript configuration, build scripts, or automation scripts change; combine it with the focused behavior check below when applicable.

| Change Scope | Local Iteration Check | When To Widen Coverage |
|---|---|---|
| Documentation or agent instructions only | Review the changed content and links; no application test is required. | Run the named command only if the edit changes a command, workflow, or release requirement. |
| One service, model, manager, or type | `node --test tests/<area>/<module>.test.js` | Run `pnpm test` when shared contracts, utility behavior, or several consumers change. |
| Visitor-facing view, CSS, or interaction | `pnpm run build` and inspect the affected workflow in the running site. | The next nightly browser-verification run covers Playwright workflows and automated accessibility after repository updates. |
| Annual data or active-season configuration | Follow the season rollover verification, beginning with `pnpm run validate:data`. | Use its complete required checks when activating or publishing a season. |
| Build, PWA/offline, privacy/analytics, shared navigation, or release candidate | Use the complete automated gate in the release checklist. | Complete secure-origin or manual review sections where required. |

- Do not run Playwright locally as part of development or release verification; it is reserved for the nightly browser-verification workflow.
- The complete local release gate is defined in [docs/release-checklist.md](../../docs/release-checklist.md); it is a publishing checkpoint rather than the default iteration loop.
- The GitHub Pages build contains no Playwright setup or execution. A nightly GitHub Actions workflow runs `pnpm run test:browser:nightly` only when `main` has a different head revision from its prior scheduled run, and its result does not block deployment.

## Linting

- ESLint 10+ with flat config (`eslint.config.js`).
- Three environments: browser JS (`src/js/`), Node build scripts, service worker.
- App globals (jQuery, DataManager, etc.) are declared in the ESLint config.
- A lint failure blocks the GitHub build and must be resolved before deployment.
- Values exposed by `src/js/config/app-config.js` should be read from `globalThis` or `window` in browser scripts unless an intentional bare script global is also declared in `eslint.config.js`.
