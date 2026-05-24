# CNSL Engineering Refactoring Plan

Status: Plan only. No implementation or annual data changes are part of this document.

Audit date: 2026-05-24

## Purpose

This plan records a whole-workspace review of application structure, separation of concerns, testability, accessibility, PWA and cache behavior, build and deployment controls, seasonal data governance, security hygiene, and documentation accuracy. It preserves the deliberately lightweight PostHTML and GitHub Pages architecture unless a future design decision justifies a change.

## Scope Reviewed

- Build and deployment: [posthtml.js](../posthtml.js), [package.json](../package.json), [eslint.config.js](../eslint.config.js), [build-deploy.yml](../.github/workflows/build-deploy.yml), and [season-data-monitor.yml](../.github/workflows/season-data-monitor.yml).
- PWA delivery: [service-worker.js](../service-worker.js), [pwa.js](../src/js/pwa.js), [install-app.js](../src/js/install-app.js), [manifest.webmanifest](../manifest.webmanifest), and [site.webmanifest](../site.webmanifest).
- Page structure and accessibility: source views and shared components, [navigation.js](../src/js/navigation.js), browser controllers, and [styles.css](../src/css/styles.css).
- Runtime architecture: managers, models, services, configuration, seasonal loading, preferences, weather alerts, and dormant search/voice paths.
- Test and data safeguards: current tests, annual source documentation, monitoring implementation, JSON/schema layout, and related repository rules.
- Documentation and metadata: [README.md](../README.md), [LICENSE](../LICENSE), [robots.txt](../robots.txt), [sitemap.xml](../sitemap.xml), and What's New content.

## Foundations To Preserve

- Source/generated separation is clear: sources are edited under `src/`, while the build owns `out/` and excludes archived annual data.
- Seasonal data governance is strong: official evidence is retained, current data is selected by [app-config.js](../src/js/config/app-config.js), source monitoring opens review work rather than silently rewriting JSON, and rollover expectations are documented in [annual-season-assets.md](annual-season-assets.md).
- Managers, models, and multiple services already isolate useful DOM-free behavior, with fast Node tests around meaningful domain logic.
- Accessibility building blocks are present: card disclosures use buttons with `aria-expanded` and `aria-controls`, Settings fields are labeled, status feedback exists, weather alerts use an alert region, and keyboard focus styling is visible.
- PWA cache busting has a coherent base: generated version query strings, a matching service-worker cache name, network-first annual JSON, cache-first static resources, and `updateViaCache: 'none'` on registration.
- GitHub Actions use full-SHA action pins, frozen dependency installation, and scoped Pages deployment permissions.

## Verification Baseline

| Check | Result | Notes |
| --- | --- | --- |
| Tracked tree at audit start | Clean | No tracked changes existed before this plan was created. A later concurrent stylesheet change is not part of this plan edit. |
| `pnpm run build` | Passed | Nine HTML pages generated; build reports that `CNAME` is missing. |
| `pnpm test` | Passed | 135 tests passed, 0 failed. |
| `pnpm run lint` | Passed | ESLint reported no findings. |
| VS Code diagnostics before plan drafting | Passed | No source diagnostics were reported. |
| `pnpm audit --audit-level high` | Failed | One high and four moderate advisories; the high advisory is `braces` through the development-only `live-server` chain. |
| Rendered Pools browser inspection | Functional with gaps | 23 pool cards rendered; 29 scripts and 17 annual-data resource timing entries appeared on initial load. |
| Keyboard menu inspection | Needs work | There is no skip link; while the menu overlay is open, focus moves from its links into page content behind it. |
| Production PWA offline behavior | Not browser-verified locally | [pwa.js](../src/js/pwa.js#L7-L24) intentionally unregisters local workers and clears local caches. Test on a production-like origin. |

## Priority Definitions

- High: known user accessibility failure, data-integrity or release-safety gap, or current runtime ownership problem that creates unnecessary behavior and refactoring risk.
- Medium: resilience, security posture, maintainability, delivery completeness, or architectural clarity work that follows the highest-risk corrections.
- Low: cleanup, accuracy, performance monitoring, and polish that should not displace safety and user access.

## High Priority

### H1. Complete The Accessibility Contract For Core Workflows

**Finding**: Disclosure controls and form labeling are good, but the navigational and asynchronous user journeys are not yet fully verifiable as accessible. There is no skip link; the off-canvas overlay menu does not contain focus or disable background focus; dynamically populated directory lists do not consistently expose loading/result state; and motion is not reduced for users requesting it. The currently observed footer link styling should also be checked because links must remain identifiable without relying on color alone.

**Evidence**: [base.html](../src/views/layouts/base.html#L72-L81), [header.html](../src/views/components/header.html#L13), [navigation.js](../src/js/navigation.js#L8-L107), [pools.html](../src/views/pools.html#L25-L30), [teams.html](../src/views/teams.html#L14-L19), [meets.html](../src/views/meets.html#L14-L19), [styles.css](../src/css/styles.css#L30), [styles.css](../src/css/styles.css#L98), [styles.css](../src/css/styles.css#L2478).

**Plan**:

1. Decide whether the overlaid navigation is modal-like or a non-modal disclosure; implement focus movement, containment/background behavior, and focus restoration appropriate to that choice.
2. Provide a first-focus skip route to a stable main-content destination on every page.
3. Standardize loading, success, empty, filter-change, and error announcements for Pools, Teams, and Meets without announcing each rendered card.
4. Provide reduced-motion behavior for CSS transitions, smooth scrolling, highlights, and scripted scrolling.
5. Verify contrast and non-color link identification, including footer links and both theme modes.

**Acceptance checks**:

- Keyboard-only walkthroughs cover navigation, filters, disclosures, and Settings with no focus reaching obscured controls.
- Screen-reader inspection announces directory status and failures usefully and without repeated noise.
- Automated accessibility scans report no serious or critical findings on primary pages in light and dark modes.
- Reduced-motion mode removes nonessential movement while retaining visible focus and state.

### H2. Give Each Page One Bootstrap And Data-Loading Owner

**Finding**: Page controllers currently mix shared data management with direct loads and dormant feature initialization. Pools separately loads pool season data, initializes the shared manager, and loads inactive search/team/meet scripts; `copilot.js` initializes another manager even though the search surface is disabled. Meets directly fetches meet JSON and also creates a manager for related links. This is observable as repeated data activity and excessive startup script loading.

**Evidence**: [data-manager.js](../src/js/services/data-manager.js#L7-L17), [data-manager.js](../src/js/services/data-manager.js#L397-L417), [pools.html](../src/views/pools.html#L34-L103), [pool-browser.js](../src/js/pool-browser.js#L112-L225), [copilot.js](../src/js/copilot.js#L263-L378), [meets-browser.js](../src/js/meets-browser.js#L12-L16), [meets-browser.js](../src/js/meets-browser.js#L253-L285), [index.html](../src/views/index.html#L16).

**Plan**:

1. Define a minimal entrypoint and domain dependency list for each route.
2. Make one bootstrap/service path own acquisition and state for each required annual JSON document.
3. Remove or defer initialization of features that have no rendered control on the current route.
4. Replace user-visible diagnostics and verbose production startup logging with purposeful status/error handling and opt-in development diagnostics.
5. Decide explicitly whether data loading is full-season shared loading or domain-scoped loading, then apply the choice consistently.

**Acceptance checks**:

- Primary pages perform no duplicate initial fetch of a required annual JSON document absent explicit refresh.
- No disabled or unrelated page feature initializes data or attaches unsupported behavior.
- Browser smoke tests assert list rendering, failure states, and agreed request/script budgets.

### H3. Turn Annual Schema Rules Into Automated Integrity Gates

**Finding**: The repository documents and stores JSON Schemas, but its runtime "validation" checks URL availability rather than schema conformance. No executable schema gate is currently present in tests or deployment workflow evidence.

**Evidence**: [annual-season-assets.md](annual-season-assets.md#L46-L52), [data.instructions.md](../.github/instructions/data.instructions.md#L25-L34), [file-helper.js](../src/js/services/file-helper.js#L387-L406), [data-manager.js](../src/js/services/data-manager.js#L106-L123), [build-deploy.yml](../.github/workflows/build-deploy.yml#L25-L38).

**Plan**:

1. Provide a deterministic command validating active annual JSON against sibling draft-07 schemas.
2. Require it in local release checks, deployment CI, and the reviewed seasonal update workflow after transcription work.
3. Add minimal runtime shape/error handling for malformed published responses while preserving useful user-facing failure states.
4. Preserve human review as authority for source meaning; schema checks protect structure, not factual transcription.

**Acceptance checks**:

- Invalid required fields, enum values, and dates fail with year/domain context.
- Active-season structured data cannot be deployed without schema validation.
- The monitoring flow continues to propose reviewed evidence changes rather than auto-editing application JSON.

### H4. Put Release-Critical Behavior Behind Tests And CI Gates

**Finding**: The unit baseline is valuable but omits the shared data orchestrator, page controllers, menu focus behavior, build-output contract, and service-worker strategies. The Pages deployment workflow builds without running the existing lint or test suites.

**Evidence**: [tests](../tests), [package.json](../package.json#L18-L20), [data-manager.js](../src/js/services/data-manager.js), [service-worker.js](../service-worker.js), [posthtml.js](../posthtml.js#L163-L188), [build-deploy.yml](../.github/workflows/build-deploy.yml#L25-L38).

**Plan**:

1. Add deterministic tests for shared initialization, error/optional data policy, refresh, and duplicate-load prevention.
2. Add browser/DOM tests for page loading and errors, favorites/filtering, disclosures, Settings, and navigation focus behavior.
3. Test the generated cache version, precache inventory, offline fallbacks, worker update behavior, and GitHub Pages path handling.
4. Gate Pages artifact upload on lint, tests, schema validation, build success, and a small accessibility/browser smoke suite.
5. Make a failed template transform or missing required public artifact fail the build rather than only logging.

**Acceptance checks**:

- A duplicate data load, keyboard navigation regression, broken annual path, cache-list drift, or partial build blocks release.
- CI results separate code quality, data integrity, PWA/build, and browser accessibility responsibilities clearly.

## Medium Priority

### M1. Harden PWA Offline Behavior And Cache Inventory

**Finding**: Existing cache-busting is sound, but the long precache list is manual; `cache.addAll` makes a single missing resource capable of failing installation; misses yield generic network responses; and manifest ownership/season metadata has drifted.

**Evidence**: [service-worker.js](../service-worker.js#L16-L125), [service-worker.js](../service-worker.js#L199-L288), [manifest.webmanifest](../manifest.webmanifest#L1-L39), [site.webmanifest](../site.webmanifest), [base.html](../src/views/layouts/base.html#L38), [posthtml.js](../posthtml.js#L128-L136).

**Plan**:

1. Generate or validate precache inventory against produced artifacts.
2. Define intentional offline navigation and stale/unavailable seasonal-data messaging.
3. Consolidate manifests and incorporate active-season install metadata into rollover/release verification.
4. Verify install, update, and offline flows from a production-like secure origin.

### M2. Correct The Published Artifact And Metadata Contract

**Finding**: Checked-in crawler artifacts are not copied to output; `CNAME` is expected by build/documentation but absent; failed HTML processing is logged without a demonstrated failing exit status; and the shared canonical URL points every page at home.

**Evidence**: [posthtml.js](../posthtml.js#L128-L136), [posthtml.js](../posthtml.js#L163-L188), [robots.txt](../robots.txt), [sitemap.xml](../sitemap.xml), [base.html](../src/views/layouts/base.html#L60), [README.md](../README.md#L82-L104).

**Plan**:

1. Define required output files and enforce their generation/copying in build verification.
2. Decide whether custom-domain ownership resides in the artifact or GitHub Pages configuration and remove contradictory warning/documentation behavior.
3. Supply page-specific canonical/title/description metadata and current discovery metadata.

### M3. Resolve Dependency, Analytics, And HTML-Boundary Hygiene

**Finding**: The dev toolchain has a high advisory; the layout configures direct Google tag loading alongside Google Tag Manager; and curated annual/source values are commonly interpolated into HTML strings and link attributes.

**Evidence**: [package.json](../package.json#L30-L53), [dependabot.yml](../.github/dependabot.yml), [base.html](../src/views/layouts/base.html#L9-L31), [pool-browser.js](../src/js/pool-browser.js#L678-L807), [teams-browser.js](../src/js/teams-browser.js#L289-L489), [meets-browser.js](../src/js/meets-browser.js#L100-L236).

**Plan**:

1. Upgrade or replace the vulnerable local server chain and establish dependency audit/upgrade policy for pnpm tooling.
2. Decide analytics ownership and privacy behavior; avoid unnecessary development loads and duplicate collection paths.
3. Define output-encoding and URL-validation boundaries for maintained data and any external response content.
4. Assess feasible content-security protection under GitHub Pages constraints.

### M4. Reduce Global And Styling Coupling Without Premature Stack Replacement

**Finding**: Views repeat ordered global script chains; browser/CommonJS compatibility is useful for current tests but creates manual runtime dependencies; project jQuery guidance does not match primarily native-DOM code; and the single stylesheet now contains several thousand lines of route and component concerns.

**Evidence**: [pools.html](../src/views/pools.html#L34-L103), [teams.html](../src/views/teams.html#L21-L40), [meets.html](../src/views/meets.html#L22-L41), [settings.html](../src/views/settings.html#L49-L61), [javascript.instructions.md](../.github/instructions/javascript.instructions.md#L13-L29), [styles.css](../src/css/styles.css).

**Plan**:

1. Make an architecture decision between a tightened no-bundler page-entry/namespace pattern and incremental ES modules or bundling, including PWA and test migration consequences.
2. Align repository instructions to the chosen DOM/module convention before broad controller refactoring.
3. Decompose large route controllers into DOM-free formatting/state units and small UI controllers where tests justify the split.
4. Organize stylesheet ownership by tokens, base behavior, components, and routes while retaining one delivered CSS resource if appropriate.

## Low Priority

### L1. Align Documentation And Metadata With Enabled Features

**Finding**: Public documentation advertises natural-language search, voice input, and blanket WCAG compliance while search is not enabled on the home view and verified accessibility work remains. Package metadata declares ISC while the authoritative license file is MIT.

**Evidence**: [README.md](../README.md#L7), [README.md](../README.md#L67-L104), [index.html](../src/views/index.html#L16), [package.json](../package.json#L29), [LICENSE](../LICENSE).

**Plan**:

1. Describe enabled, experimental, and dormant features accurately once the support decision is made.
2. Replace broad accessibility claims with recorded verification scope until acceptance checks pass.
3. Align license and deployment metadata with their authoritative sources.

### L2. Retire Or Isolate Diagnostic And Dormant Runtime Surfaces

**Finding**: Pools contains visible diagnostic states and verbose startup traces; a simple meets diagnostic browser remains in source; and dormant search/voice assets are included on a route without a visible search experience.

**Evidence**: [pool-browser.js](../src/js/pool-browser.js#L121-L226), [copilot.js](../src/js/copilot.js#L263-L378), [search-engine.js](../src/js/services/search-engine.js#L24-L102), [meets-browser-simple.js](../src/js/meets-browser-simple.js), [search.html](../src/views/components/search.html).

**Plan**:

1. Retire, test, or explicitly fence diagnostic/experimental code after high-priority route tests protect supported behavior.
2. Keep production output free of developer-facing status text and unnecessary diagnostic asset loading.

### L3. Record Lightweight Performance And Release Budgets

**Plan**:

1. After data/bootstrap correction, record baseline page request counts, delivered asset weight, cache inventory size, and primary directory render times.
2. Maintain a concise release checklist covering annual schema validation, accessibility review, PWA offline/update checks, dependency audit, and deploy-artifact verification.

## Recommended Sequence

| Wave | Work | Exit Criterion |
| --- | --- | --- |
| 1 | H1 accessibility, H3 schema validation, essential CI gates from H4 | Accessibility and active structured-data regressions fail before deploy. |
| 2 | H2 bootstrap/data ownership and browser coverage from H4 | Primary pages load only intended behavior with no duplicate initial annual-data acquisition. |
| 3 | Remaining H4 build/PWA tests, M1 offline/cache work, M2 artifact contract | Deployment, offline use, and update behavior are production-like tested. |
| 4 | M3 security/toolchain boundaries and M4 architecture/style decision | Long-term conventions are explicit, maintained, and protected by tests. |
| 5 | Low-priority documentation, dormant-code cleanup, and budgets | Published claims and delivered assets reflect only supported behavior. |

## Guardrails

- Do not change annual JSON, schemas, or official PDFs as part of general refactoring; use the reviewed seasonal workflow.
- Do not replace PostHTML or introduce a bundler without an architecture decision and regression coverage.
- Do not weaken working cache versioning while improving offline behavior and inventory maintenance.
- Do not claim full WCAG conformance until automated and keyboard/screen-reader verification is recorded for affected workflows.
- Do not make the source monitor automatically transcribe application JSON; preserve human review.
