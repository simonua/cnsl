# CNSL Engineering Refactoring Plan

Review date: 2026-06-21

## Scope And Validation

This fresh audit reviewed the current working tree at `ee33293` after the completed Green refactors. It covered changed and delivered browser code, route script order, annual-data acquisition, current tests, PWA resource policy, retained storage migrations, active-season pool location records and schema, recent history where compatibility ownership was unclear, and the final three-run `desktop` and `mobile-slow` performance evidence. The unrelated staged changes in `src/css/styles.css` and `tests/browser/workflows/navigation.spec.js` were left untouched.

Validation was read-only except for this plan. It used source and reference searches, focused file inspection, `git status`, recent `git log`, targeted `git blame`, a parsed active-season pool-location summary, and a Pool route script count/byte summary. No application tests, build, browser workflow, performance rerun, annual-data edit, or generated-output edit was performed for this documentation-only audit. The generated `out/` artifact was not present, so the audit used the supplied final performance and PWA measurements rather than reconstructing per-resource generated sizes.

Current bounded evidence includes:

- The final Pool sample recorded `desktop` medians of 770 ms for primary data, 885 ms for visible summaries, 1,007 ms for optional enrichment, and 114 ms of long tasks. `mobile-slow` recorded 2,740 ms, 3,312 ms, 3,758 ms, and 1,430 ms respectively. Each annual domain was requested once, so the measured problem is CPU/main-thread and dependency sensitivity rather than duplicate annual requests.
- [pools.html](../src/views/pools.html) declares 26 route scripts totaling 233,465 source bytes. Twenty-three non-deferred scripts execute before `route-warmup-readiness.js`, `file-helper.js`, and the deferred Pool controller. Several of those providers are used only for expanded details or post-summary team/meet enrichment.
- The final PWA core contains 76 resources totaling 1,252,667 bytes, exceeding the advisory limits by one resource and 52,667 bytes. [pwa-resource-policy.js](../scripts/lib/pwa-resource-policy.js) intentionally keeps installed Pool, Team, and Meet routes available offline and currently marks only four route-only scripts cache-on-use. No reviewed optional core resource was identified that can move tiers without weakening that offline commitment.
- All 23 active pool records use the schema-required nested `location` object with `googleMapsUrl`, `mapsQuery`, `lat`, and `lng`; none publishes flat `address`, `mapsQuery`, `lat`, or `lng` fields. The active schema requires nested location fields and rejects additional pool properties.

## Priority Matrix

| Priority | Actionable Finding | Visitor / Engineering Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | No demonstrated accessibility, data-integrity, security, or material correctness defect | None | None |
| **ORANGE - Medium** | Reduce Pool summary-path script and main-thread work using the existing progressive boundary | High: target the route with 1,430 ms median slower-CPU long tasks and 3,312 ms summary readiness | Medium |
| **ORANGE - Medium** | Start the deferred Meets controller when its ordered dependencies are ready | Medium: begin the primary annual request before unrelated deferred shell scripts finish | Low |
| **ORANGE - Medium** | Retire the unsupported flat pool-location contract across model, rendering, links, and fixtures | Medium: remove a second representation that disagrees with active validation and expands maintenance/trust-boundary coverage | Low |
| **GREEN - Low** | Give `FileHelper` sole ownership of JSON transport while keeping current annual and lessons orchestration distinct | Low: remove one duplicated fetch implementation and error contract | Low |

## High Priority

No active High-priority recommendation is supported by current repository evidence. This audit found no demonstrated accessibility barrier, release or seasonal-data integrity risk, security exposure, or current runtime correctness defect. Secure-origin installation, production analytics, and delivered-site behavior remain release-time human checks rather than claims of conformance from this local audit.

## Medium Priority

### Reduce Pool Summary-Path Dependencies And Main-Thread Work

**Finding:** Pool is the measured slower-CPU outlier and still loads detail/enrichment providers before its summary controller can execute. The existing progressive rendering contract is sound, but the script boundary does not yet match it.

**Repository evidence:**

- [pools.html](../src/views/pools.html) loads 23 synchronous route scripts before the deferred controller. The route-specific source total is 233,465 bytes across 26 scripts.
- [pool-browser.js](../src/js/pool-browser.js) renders summaries before `startPoolBrowserEnrichment()`, keeps collapsed details empty, and hydrates requested details. However, detail-only services such as pool hours/calendar state and cross-domain team/meet enrichment are already loaded before that boundary.
- [pool-card-display.js](../src/js/services/pool-card-display.js) owns both summary and detail rendering; its summary path does not execute contact, directions, hours, feature, or calendar work when `isDetailsHydrated` is false.
- The supplied final sample shows a 3,312 ms `mobile-slow` summary median and 1,430 ms long-task median, versus 885 ms and 114 ms on `desktop`. One request per annual domain rules out a duplicate-fetch fix.

**Scoped plan:**

- Measure the Pool critical path before changing it, then define the smallest ordered dependency list needed for the pool model, filters, live summary state, and collapsed-card renderer.
- Load expanded-detail and team/meet enrichment providers once after summaries are visible or when an initially expanded/deep-linked card requires them. Likely candidates include pool link/directions, hours/calendar state and controls, detailed team schedule matching, and meet override providers; confirm each dependency from the call graph before moving it.
- Preserve one `DataManager` request per annual domain, build-version propagation, deterministic classic-script order, prerender activation behavior, empty collapsed details, favorite/deep-link expansion, focus and scroll restoration, and an accessible settled failure state.
- Keep scripts required for first-install offline Pool details in the PWA core unless a separate reviewed offline-contract change proves they can move. Do not bundle, split annual JSON, add per-card requests, or add a cache/index merely to reduce the warning totals.

**Acceptance checks:**

- [ ] Record comparable three-run `desktop` and `mobile-slow` before/after Pool phase medians and spreads, DOM readiness, FCP, long tasks, requests, decoded/transferred bytes, and installed first/repeat navigation.
- [ ] Demonstrate a reduction in summary-blocking script count or work and a repeatable improvement in `primary-data-ready`, `summary-visible`, or long-task time; revert architectural complexity that produces no repeatable benefit.
- [ ] Keep annual-domain requests at one each and preserve the ordered `primary-data-ready`, `summary-visible`, and `optional-enrichment-settled` marks.
- [ ] Verify collapsed, favorite-expanded, deep-linked, offline, dependency-failure, keyboard, focus, scroll, filter/sort, and location-permission paths with named focused browser IDs.
- [ ] Run focused unit coverage for every moved provider, `pnpm run lint`, `pnpm run build`, `pnpm run verify:pwa`, and report PWA core/optional deltas without weakening advisory budgets.

### Start Meets Before Unrelated Deferred Shell Work

**Finding:** The deferred Meets controller still waits for `DOMContentLoaded` even though its required markup precedes the script block and all summary providers are explicitly ordered before it. This can delay the first meets request behind later deferred weather and settings scripts.

**Repository evidence:**

- [meets.html](../src/views/meets.html) places `#meetList` before its script block and orders `file-helper.js` immediately before deferred `meets-browser.js`.
- [meets-browser.js](../src/js/meets-browser.js) registers its initialization on `DOMContentLoaded`, while the equivalent Pool and Team deferred controllers start immediately.
- [base.html](../src/views/layouts/base.html) appends deferred weather providers, `weather-alert.js`, and `settings.js` after the route block. Deferred scripts execute in document order before `DOMContentLoaded`, so unrelated script fetch/execution can hold the Meets listener.
- Meets already has primary, summary, and optional-enrichment marks, allowing a bounded before/after check rather than a generic lifecycle cleanup.

**Scoped plan:**

- Extract the current listener body into one named start function and invoke it when the deferred controller executes, matching Pool and Team while retaining the existing route/off-season guards.
- Leave other `DOMContentLoaded` listeners unchanged unless their own markup, provider order, and measured route role are separately demonstrated.

**Acceptance checks:**

- [ ] Confirm the Meets annual request begins when its controller/provider chain is ready and is not gated by later weather/settings scripts.
- [ ] Preserve one request per annual domain, all three performance marks, prerender activation, collapsed-detail hydration, favorite and deep-link behavior, loading/error announcements, and keyboard operation.
- [ ] Run the focused Meets unit and browser IDs, then compare three-run `desktop` and `mobile-slow` Meets phases; retain the change only if timing is neutral or improved without request or long-task regression.
- [ ] Run `pnpm run lint`, `pnpm run build`, and `pnpm run verify:pwa` because script execution timing and the generated offline artifact are affected.

### Retire The Flat Pool-Location Contract

**Finding:** Delivered code still projects and accepts a flat pool-location shape that active validation cannot publish. Tests are the only verified consumers of that compatibility behavior.

**Repository evidence:**

- [pools.schema.json](../src/assets/data/2026/pools/pools.schema.json) requires nested `location.street`, `city`, `state`, `zip`, `lat`, `lng`, `mapsQuery`, and `googleMapsUrl`, and sets `additionalProperties: false` for pool and location records.
- A read-only parse of [pools.json](../src/assets/data/2026/pools/pools.json) found 23 nested records and zero flat location records.
- [pool.js](../src/js/models/pool.js) projects nested location data back to flat `address`, `lat`, `lng`, `mapsQuery`, and `googleMapsUrl` properties even though delivered consumers use `pool.location` except in compatibility branches.
- [pool-link-helper.js](../src/js/services/pool-link-helper.js) accepts flat address/query/coordinate fallbacks, and [pool-card-display.js](../src/js/services/pool-card-display.js) accepts a flat address rendering shape. Searches found no delivered producer or external contract; focused tests explicitly construct the flat fixtures.

**Scoped plan:**

- Remove the flat projections from `Pool` and the flat address/query/coordinate branches from link and card rendering in one change.
- Keep nested `location.googleMapsUrl`, nested `mapsQuery`, structured address, nested coordinates, safe generic display-text fallback, and hostile-URL handling. Do not weaken safety behavior while deleting compatibility.
- Update the `PoolRecord` contract so nested location matches the active required schema, and replace flat-fixture tests with nested current-contract, missing/invalid-input, and hostile-destination coverage.
- Search models, services, tests, fixtures, browser-module manifests, documentation, and generated/PWA registrations for the retired flat properties; remove support surface that exists only for them.

**Acceptance checks:**

- [ ] Searches show no unexplained `Pool` flat location projections or fallback reads.
- [ ] Current nested records render safe addresses, map actions, Meet links, and distance calculations through Pool, Team, Meet, Home, and My Meet Day consumers.
- [ ] Legacy flat input is no longer treated as a supported successful location contract; missing/invalid nested input degrades safely.
- [ ] Focused model, pool-card, pool-link, agenda/meet-guide, and hostile-input tests pass with the applicable lint/build/browser checks.

## Low Priority

### Consolidate JSON Transport Without Merging Orchestration

**Finding:** `DataManager` and `FileHelper` have intentionally distinct callers but duplicate the same low-level `fetch(..., { cache: 'no-cache' })`, response check, JSON parse, logging, and rethrow behavior.

**Repository evidence:**

- [data-manager.js](../src/js/services/data-manager.js) owns annual-domain validation, shared pending promises, manager loading, refresh, and one collection per domain. Final measurements show no duplicate annual request.
- [file-helper.js](../src/js/services/file-helper.js) owns delivered paths and generic JSON transport.
- [lessons-browser.js](../src/js/lessons-browser.js) deliberately uses `FileHelper` for the non-seasonal lessons document and one raw pools document needed by lesson normalization; loading the full annual manager/model graph there would add responsibility without demonstrated benefit.
- `DataManager._loadJsonFile()` and `FileHelper.loadJsonFile()` are duplicate transport implementations with only diagnostic-text differences.

**Scoped plan:**

- Make `DataManager` delegate transport to `FileHelper.loadJsonFile()` and remove its private duplicate loader and tests tied only to that implementation.
- Preserve `DataManager` as the only stateful annual-domain coordinator and preserve the lessons route's stateless raw-document path. Do not create a generic loader abstraction beyond the existing `FileHelper` or migrate Lessons to models without measured need.

**Acceptance checks:**

- [ ] One JSON transport implementation remains, with non-success and malformed-response behavior covered at its owner.
- [ ] `DataManager` still validates domain shape, shares concurrent requests, retries after rejection, refreshes initialized managers, and issues at most one request per annual domain.
- [ ] Lessons still requests lessons and pools once, normalizes raw documents, and reports an accessible failure without loading the full annual manager graph.
- [ ] Focused `file-helper`, `data-manager`, lessons, and annual-request-deduplication checks pass, followed by `pnpm run lint` and `pnpm run build`.

## Retirement Classification

| Surface | Classification | Consumer / Owner / Removal Condition |
| --- | --- | --- |
| Flat pool `address`, `lat`, `lng`, `mapsQuery`, and `googleMapsUrl` projections and fallbacks | Obsolete | No active-schema or delivered consumer. Remove model projections, renderer/link branches, fixtures, and compatibility assertions together. |
| Manager `clearData()` methods | Current contract | `DataManager.refresh()` calls the initialized domain manager's method before reloading that domain. |
| Canonical analytics profile marker and service-worker handoff | Current contract | `analytics.js` owns `ANALYTICS_APP_VERSION_STORAGE_KEY`; `pwa.js` produces the session handoff needed to preserve the outgoing version across controller activation. |
| Analytics reads of `ANALYTICS_VERSION_REPORTED_STORAGE_KEY` and `APP_VERSION_STORAGE_KEY` as predecessor candidates | Temporary migration | Analytics upgrade tracking owns the fallback reads. After 2027-09-30, the release reviewer must confirm the full 2027 `ca_upgrade` report has no required pre-2.16 predecessor path, then remove only these candidate reads and migration tests. Keep the keys while version-event deduplication and the release notice still consume them. |
| `practiceAgeGroups` preference input | Temporary migration | `PreferencesService` owns persisted profiles, rewrites the legacy property to canonical `practiceGroups` on read, and preserves First Splash. Remove the legacy constant, normalization input, rewrite check, and focused fixtures in the first release after 2027-09-30. |

## Evidence-Based Exclusions

Current evidence does not support a framework or bundler migration, annual-document split, per-card data requests, persistent model cache, runtime index, `content-visibility`, incremental rendering, or virtualization. Active collections remain small, annual requests are deduplicated, and collapsed details are already empty. The Pool work must first test a smaller summary dependency boundary against the existing performance marks.

The PWA budget overage alone does not support moving Pool detail providers to cache-on-use: installed Pool details are a current first-install offline commitment. Keep the 75-resource and 1,200,000-byte budgets advisory, report deltas from scoped work, and require a separately reviewed offline-policy change before altering cache tiers. Do not propose bundling solely to cross either threshold.

My Meet Day remains experimental and must not be graduated by this plan. Favorite Pool Today on Home remains excluded. Do not introduce either feature through refactoring work.

## Phased Roadmap

| Phase | Priority | Work | Prerequisites | Completion Evidence |
| --- | --- | --- | --- | --- |
| 1 | **ORANGE - Medium** | Retire the flat pool-location contract | Current active schema and focused trust-boundary fixtures | Removed-symbol search plus nested/hostile-input focused checks |
| 2 | **ORANGE - Medium** | Start Meets immediately from its deferred controller | Preserve current ordered providers and route guards | Focused browser behavior plus comparable phase measurements |
| 3 | **ORANGE - Medium** | Reduce Pool summary-path dependencies and main-thread work | Phase 1 simplifies detail providers; capture comparable baseline first | Three-run desktop/mobile-slow improvement with unchanged annual requests, accessibility, offline behavior, and PWA coherence |
| 4 | **GREEN - Low** | Delegate DataManager JSON transport to FileHelper | Keep annual orchestration and Lessons raw-document flow separate | One transport owner plus focused loading/deduplication checks |
| Gate after 2027-09-30 | Migration review | Reassess analytics predecessor candidates and remove `practiceAgeGroups` migration | Full 2027 season elapsed; analytics report reviewed | Candidate-specific removal searches and focused migration/current-contract checks |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring. Seasonal facts and schemas require authoritative evidence, annual workflow records, and human review.
- Never edit `out/`; it is generated by `pnpm run build`.
- Preserve `getDataManager()`, one shared pending request and manager collection per annual domain, and source ownership across pools, teams, and meets.
- Retire obsolete definitions, projections, branches, callers, fixtures, tests, types, dependencies, registrations, documentation, build rules, and cache references together.
- Preserve the PostHTML static-site architecture, native DOM APIs, explicit classic-script order, CSP and rendering trust boundaries, analytics privacy limits, WCAG 2.0 AA behavior, and current first-install offline commitments.
- Keep collapsed details empty and hydrate only requested content. Do not replace one shared annual document with per-card requests.
- Keep performance budgets advisory until comparable local and approved delivered-site samples establish stable variance. Do not navigate an automated browser to production.
- Run only change-scoped unit and browser tests for implementation work, with required lint, build, data, PWA, accessibility, and performance gates selected by the affected boundary.

## Priority Summary

- **RED - High:** No demonstrated High-priority defect or release risk.
- **ORANGE - Medium:** Reduce measured Pool summary-path/main-thread cost, remove the unnecessary Meets lifecycle gate, and retire the unsupported flat pool-location contract.
- **GREEN - Low:** Delegate DataManager's duplicate JSON transport to FileHelper without merging their intentionally distinct orchestration paths.
