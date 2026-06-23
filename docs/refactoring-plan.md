# CNSL Engineering Refactoring Plan

Review date: 2026-06-23

## Audit Scope And Validation

This local audit reviewed delivered browser JavaScript, PostHTML build sequencing, automation scripts, views and shared script order, the single stylesheet, unit and browser test organization, declared dependencies, service-worker and generated cache policy, Node adapters, GitHub Actions path ownership, documentation, active configuration, and recent repository history. It did not modify application code, generated output, workflows, dependencies, or annual data.

Validation was static and read-only except for this plan update:

- Ranked delivered JavaScript, automation, CSS, views, and tests by size, then compared the largest files with recent 120-commit churn and their existing service boundaries.
- Searched definitions and consumers across runtime scripts, views, lazy script lists, adapters, test manifests, tests, configuration, documentation, build validation, and PWA policy before classifying retirement candidates.
- Reviewed the current recorded `desktop` and `mobile-slow` performance evidence in `docs/release-checklist.md`. The existing local generated inventory was read without rebuilding and contained 74 install-critical resources totaling 1,261,131 bytes; this corroborates the recorded warning but is not a fresh source-comparable performance run.
- Exercised the current 14-page PostHTML transform in memory without writing files. All current pages completed before the existing aggregate callback, but a delayed-transform probe demonstrated that the aggregate does not own asynchronous completion because its mapped values are `undefined`.
- Reviewed relevant `git log` and `git blame` history to avoid reopening recently completed refactors or treating documented migration windows as dead compatibility.
- Did not run application tests, build, PWA verification, browser automation, or fresh performance profiles because this audit changes documentation only and must not regenerate `out/`.

No demonstrated accessibility barrier, data-integrity defect, active security exposure, or current release failure supports a `RED - High` item. The Cloudflare inline-script CSP exception, attention banner, and two storage migrations remain documented current contracts.

## Priority Matrix

Render every priority matrix with a `Key` column immediately to the left of `Priority`. Key actionable findings independently within each priority category using `H`, `M`, or `L` followed by a one-based index, such as `H1`, `M1`, and `L1`. Always show High, Medium, and Low, even when a category has no actionable finding. Keep the colored priority circle in every `Priority` cell: 🔴 for High, 🟠 for Medium, and 🟢 for Low. For an empty category, leave `Key` blank, use `None` for the finding, and summarize why no item qualifies in the remaining cells.

| Key | Priority | Actionable Finding | Impact | Effort |
| --- | --- | --- | --- | --- |
| <!-- No key --> | 🔴 **High** | None | No demonstrated accessibility, data-integrity, security, release, or material runtime defect | None |
| M1 | 🟠 **Medium** | Make PostHTML page completion an owned promise contract | Prevents future asynchronous transforms or failures from finalizing PWA artifacts and the development reload marker too early | Low to medium |
| M2 | 🟠 **Medium** | Attribute and reduce the measured Meets cold-route CPU and delivery cost | Improves useful schedule readiness on slower CPUs while preserving progressive details and request deduplication | Medium |
| L1 | 🟢 **Low** | Consolidate season-neutral watcher configuration and its CI ownership | Removes unused watcher variants and avoids stale active-season rebuild behavior during rollover | Low |
| L2 | 🟢 **Low** | Retire obsolete browser-global lint registrations | Restores `no-undef` protection for seven names with no current definition or consumer | Low |

## High Priority

No high-priority item is supported by current repository evidence. Promote an item here only after demonstrating an accessibility barrier, data-integrity or release risk, active security exposure, or material current runtime failure.

## Medium Priority

### 1. Make PostHTML Page Completion An Owned Promise Contract

**Finding:** `posthtml.js` creates `pageBuilds` with `files.map`, but the callback does not return the `.process(...).then(...).catch(...)` promise. `Promise.all(pageBuilds)` therefore receives only `undefined` values and cannot guarantee that page writes succeeded before PWA inventory generation, the development build marker, or the success log. Current synchronous behavior happens to settle in time, but the contract fails as soon as a transform is delayed and does not route page rejection through the aggregate catch.

**Repository evidence:**

- `posthtml.js:367-388` starts each page transform without returning it; `posthtml.js:390-397` treats the resulting array as completion ownership and then writes PWA artifacts and the development marker.
- `browser-sync.config.js:4-7` explicitly relies on the marker being written only after complete output is ready.
- The in-memory current-pipeline probe completed all 14 current pages before the aggregate callback, so no current artifact corruption was asserted. A delayed PostHTML transform produced `pwa-write` before `page-write`, proving that the aggregate itself provides no ordering guarantee.
- Repository searches found service-worker tests and artifact validation, but no focused test that delays or rejects one page transform and asserts finalization order.

**Scoped plan:**

1. Return each PostHTML processing promise from the `files.map` callback and let one aggregate owner handle success and failure.
2. Finalize PWA artifacts, write the development marker, and print success only after every rendered page has been written.
3. On any page failure, preserve the nonzero exit, do not publish a completion marker, and do not report a successful complete build.
4. Add the smallest testable boundary needed to inject a delayed and a rejected page transform; do not introduce a second build pipeline or generic task framework.

**Acceptance checks:**

- A delayed page transform demonstrably blocks PWA finalization, marker creation, and the success log until its page write completes.
- A rejected page transform produces a nonzero result and no completion marker or success message.
- Searches show no unobserved page-processing promise or duplicate finalization path remains.
- Run the exact new build-sequencing unit test, `pnpm run lint`, `pnpm run build`, and `pnpm run verify:pwa`.

### 2. Attribute And Reduce The Measured Meets Cold-Route Cost

**Finding:** The latest comparable Meets baseline is healthy on desktop but exceeds the route's advisory usable, request, and decoded-byte budgets on the slower-CPU profile. The delay is concentrated before and during primary-data readiness rather than in optional detail hydration, and the three-run spread is wide enough to require attribution before choosing an optimization.

**Repository evidence:**

- `docs/release-checklist.md:127-130` records three desktop runs at 448 / 452 / 465 ms usable with a 76 ms long-task median, versus three `mobile-slow` runs at 1,165 / 2,220 / 2,588 ms usable, 1,004 / 1,457 / 2,403 ms primary-data-ready, and an 840 ms long-task median. Both profiles used 49 requests, 877,619 decoded bytes, and one request per annual domain.
- `scripts/measure-performance.js:26-40` defines the ordered Meets phases and advisory budgets of 1,800 ms usable, 45 requests, and 800,000 decoded bytes; `scripts/measure-performance.js:407-420` reports those overruns as warnings rather than weakening or blocking the gate.
- `src/views/meets.html:50-61` keeps only summary dependencies on the initial route path.
- `src/js/meets-browser.js:11-18`, `src/js/meets-browser.js:327-338`, and `src/js/meets-browser.js:430-489` load enrichment separately, keep collapsed detail DOM empty, and hydrate only requested or initially expanded dates. Eager hidden-detail rendering and duplicate annual fetches are therefore rejected as causes.

**Scoped plan:**

1. Capture comparable three-run `desktop` and `mobile-slow` traces on one unchanged machine and working-tree state; add the unthrottled `mobile` profile only if viewport and CPU effects need separation.
2. Attribute the long task and pre-`primary-data-ready` time among shared script parsing/evaluation, dependency/data delay, meet model construction, sorting/grouping, summary DOM work, and paint.
3. Optimize only the demonstrated dominant owner. Prefer removing or deferring unnecessary work over adding caches, indexes, document splitting, virtualization, or a bundler.
4. Preserve one shared fetch per annual domain, build-version propagation, empty collapsed details, interaction-driven hydration, deep links, favorites, focus and scroll stability, accessible loading/failure states, and offline behavior.

**Acceptance checks:**

- Record minimum / median / maximum usable, primary-data-ready, summary-visible, and optional-enrichment-settled times for three comparable runs per required profile, plus FCP, DOM readiness, long-task time, requests, decoded/transferred bytes, annual-domain request maxima, and installed first/repeat navigation.
- Demonstrate a material reduction in the attributed median and spread without increasing the 49-request baseline, exceeding one request per annual domain, or moving optional detail work onto the summary-critical path.
- Run the exact affected unit tests, `pnpm run lint`, `pnpm run build`, affected Meets workflow and accessibility IDs through `scripts/run-playwright.js`, `pnpm run verify:pwa`, and the comparable performance profiles.

## Low Priority

### 3. Consolidate Season-Neutral Watcher Configuration And CI Ownership

**Finding:** The canonical watcher and two unreferenced package-script variants repeat active-year paths. All three currently hard-code `2026`, while the application and build derive the active season from `app-config.js`. A future `YEAR` activation can therefore leave local active-season edits unwatched. The helper imported directly by both PostHTML and BrowserSync is also absent from the build workflow's path filter.

**Repository evidence:**

- `package.json:9-18` makes `watch` through `nodemon.json` the path used by `start`; `start.ps1:241-251` exposes only `start` and `start:simple`. Searches found no repository consumer for `watch:poll` or `watch:manual` beyond their declarations.
- `package.json:10-11` duplicates the watcher command and hard-codes `src/assets/data/2026` in both unused variants.
- `nodemon.json:2-14` separately watches `src/assets/data/2026` and ignores `src/assets/data/2025/**`; `tests/services/nodemon-config.test.js:7-14` locks that annual value into the test.
- `posthtml.js:7` and `browser-sync.config.js:1` import `scripts/lib/development-server.js`, but `.github/workflows/build-deploy.yml:6-25` does not include that direct build dependency in its path filter.

**Scoped plan:**

1. Keep one supported live-reload watcher owned by `nodemon.json`; remove `watch:poll` and `watch:manual` with any tests or docs that exist only for them.
2. Replace year-specific watch and ignore entries with the simplest season-neutral data path that observes the configured active season without generating a second source of truth.
3. Update the focused nodemon test to assert semantic watcher behavior rather than the current year literal.
4. Add the directly imported development-server helper to the workflow path ownership that runs build and unit validation when it changes.

**Acceptance checks:**

- Searches show no `watch:poll`, `watch:manual`, or watcher-owned `src/assets/data/2026` / archived-year literal remains.
- A controlled non-data fixture or temporary-path test proves active-season JSON changes are observed without editing annual source assets.
- A workflow-boundary test covers every direct local module imported by `posthtml.js` and `browser-sync.config.js`, including `scripts/lib/development-server.js`.
- Run the exact nodemon and workflow tests, `pnpm run lint`, and one local watcher smoke check without modifying `src/assets/data/`.

### 4. Retire Obsolete Browser-Global Lint Registrations

**Finding:** Seven browser globals remain allowlisted even though no maintained runtime definition or consumer exists. These entries are obsolete support surface and can hide accidental references from ESLint's `no-undef` rule.

**Repository evidence:**

- `eslint.config.js:30-31`, `eslint.config.js:42`, `eslint.config.js:62`, `eslint.config.js:66-67`, and `eslint.config.js:75` register `$`, `jQuery`, `PoolSchedule`, `CacheService`, `CNSLSearchEngine`, `WeatherService`, and `handleSearch` as read-only globals.
- Exact whole-repository searches excluding generated output and dependencies found no maintained runtime definition or consumer for those names; `$(` had no maintained JavaScript consumer.
- `.github/instructions/build.instructions.md` still describes jQuery as an application global, and `.github/instructions/data.instructions.md` still describes a removed `CacheService` localStorage layer. These are stale guidance to retire with the lint registrations, not current-contract evidence.
- No matching view script, lazy dependency, adapter, browser-module manifest, test, fixture, current documentation contract, build rule, dependency, or PWA registration was found.

**Scoped plan:**

1. Remove the seven obsolete global declarations and update the inaccurate jQuery environment comment.
2. Remove the stale jQuery and `CacheService` statements from the scoped instruction files so repository guidance describes the current runtime.
3. Do not add aliases or compatibility shims; any newly exposed reference must instead identify and load its real semantic owner.
4. Search the full retirement surface again after removal.

**Acceptance checks:**

- Exact searches return no unexplained references to the seven retired names.
- ESLint rejects a fixture-owned accidental reference rather than accepting it as a configured global.
- `pnpm run lint` passes with no replacement allowlist or dependency.

## Phased Roadmap

| Phase | Work | Prerequisites | Exit Evidence |
| --- | --- | --- | --- |
| 1. Build ownership | Complete Medium item 1 | None | Delayed and rejected page transforms prove finalization order; build and PWA verification pass |
| 2. Measured route work | Complete Medium item 2 | Stable build sequencing and comparable local environment | Before/after three-run route evidence shows lower attributed cost with preserved request, accessibility, and offline contracts |
| 3. Development configuration | Complete Low item 3 | No active season-data edit in progress | One season-neutral watcher, direct CI path ownership, focused tests, and smoke evidence |
| 4. Registration cleanup | Complete Low item 4 | None; may run independently | Retired-name searches are clean and lint passes |

## Monitored Boundaries

These are current migration contracts with future review conditions, not active refactoring work:

| Surface | Current Owner | Review Condition |
| --- | --- | --- |
| Analytics predecessor storage candidates | `analytics.js` | Reassess after the full 2027 season and remove only when the source-recorded report condition is satisfied |
| `practiceAgeGroups` preference input | `PreferencesService` | Remove no earlier than 2027-10-01 with focused migration and current-contract coverage |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring. Seasonal facts and schemas require authoritative evidence, annual workflow records, and human review.
- Never edit `out/`; it is generated by `pnpm run build`.
- Retain the attention-banner capability unless the product owner explicitly changes this requirement. A dormant `APP_ATTENTION_NOTICE` value means no active message; it is not removal evidence.
- Retain the documented Cloudflare `script-src 'unsafe-inline'` integration constraint until a delivered-site review proves Cloudflare and Analytics operate without it; authored inline executable scripts remain prohibited.
- Preserve the analytics predecessor candidates and `practiceAgeGroups` migration until their recorded 2027 review conditions are met. Tests alone neither justify early removal nor permanent retention after those conditions.
- Retire obsolete production code and its tests, fixtures, types, registrations, dependencies, documentation, build rules, and cache entries together. Keep a compatibility path only for a verified consumer with an owner, removal condition, and focused coverage.
- Do not introduce a framework, bundler, data split, cache, index, or rendering mechanism without current evidence of visitor or maintenance benefit.
- Preserve the current install-critical offline routes and one-fetch annual-data contract unless measured evidence and an explicit offline-product decision support changing them.
- Keep local verification scoped to the changed behavior. Do not run complete unit or browser suites for these focused refactors unless a failure or shared contract justifies named additional coverage.

## Priority Summary

- **High:** No actionable item is supported by current evidence.
- **Medium:** Own PostHTML page completion before finalization; attribute and reduce the measured slower-CPU Meets cold-route cost.
- **Low:** Consolidate season-neutral watcher and CI ownership; remove seven obsolete browser-global lint registrations.
