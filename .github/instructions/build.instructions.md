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
| `pnpm run test:browser:smoke` | Run focused Playwright interactions during UI iteration |
| `pnpm run test:browser` | Run local Playwright workflow checks against a built `out/` artifact |
| `pnpm run test:browser:accessibility` | Explicitly reproduce Playwright axe accessibility checks locally when needed |
| `pnpm run test:browser:ci` | Run workflow and automated WCAG A/AA checks in GitHub Actions |
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
   - Excludes `data/2025/` and `images/logos/originals/` from copy

## Output

- `out/` is the build output directory (gitignored).
- Never edit files in `out/` — they are overwritten on every build.
- GitHub Pages serves from the `out/` directory (or configured branch).
- `pnpm run verify:pwa` validates generated offline/cache, manifest, canonical, and crawler artifacts after a build.

## Testing

- Tests are in `tests/` using Node.js built-in test runner.
- Test files follow the pattern `tests/**/*.test.js`.
- Services and models export via `module.exports` for Node.js test access.
- Run `pnpm test` to execute all tests.
- Run `pnpm run build && pnpm run test:browser:smoke` during visitor-facing iteration for focused interactions.
- Run `pnpm run build && pnpm run test:browser` locally before publishing visitor-facing changes to validate rendered keyboard workflows.
- GitHub Actions runs `pnpm run test:browser:ci` before deployment to enforce the automated WCAG A/AA gate. Use `pnpm run test:browser:accessibility` locally only to diagnose or reproduce those failures.

## Linting

- ESLint 10+ with flat config (`eslint.config.js`).
- Three environments: browser JS (`src/js/`), Node build scripts, service worker.
- App globals (jQuery, DataManager, etc.) are declared in the ESLint config.
