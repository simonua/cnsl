# CNSL Engineering Refactoring And Feature Plan

Review date: 2026-06-21

## Scope And Validation

This repository-wide audit reviewed the baseline at `e59bedc`, recent architecture history, current Pool, Team, Meet, My Meet Day, weather, analytics, build, and service-worker paths, relevant unit and browser coverage, and active-season record counts. It specifically rechecked the previously measured Pool compatibility projection and Meets collapsed-detail rendering costs.

The audit used source and reference searches, recent commit diffs, read-only active-season summaries, and the existing development build. The implementation follow-up used focused unit and browser coverage, JavaScript and Markdown lint, a clean rebuild, PWA verification, and comparable three-run `desktop` and `mobile-slow` measurements. No active annual data or generated output was modified.

Current bounded evidence includes:

- The active season has 23 pools, 14 teams, 35 regular meets, and 3 special meets. All 14 teams publish an official `calendarUrl`; one also publishes an `eventsSubscriptionUrl`.
- Four teams currently have one reviewed `homeMeetGuides` record each. All four records include general and visiting-team guidance; one also includes home-team guidance. My Meet Day already degrades to matchup and generic planning information when host guidance is absent.
- The current artifact contains 76 install-critical resources totaling 1,252,667 bytes and 39 cache-on-use resources totaling 2,214,966 bytes. The resource count and core bytes remain above the advisory budgets in [scripts/measure-performance.js](../scripts/measure-performance.js).
- The final 2026-06-21 three-run Pool baseline recorded `desktop` medians of 770 ms for primary data, 885 ms for visible summaries, 1,007 ms for optional enrichment, and 114 ms of long tasks. The `mobile-slow` profile recorded 2,740 ms, 3,312 ms, 3,758 ms, and 1,430 ms respectively. This final sample was slower than the earlier same-day snapshot, but both profiles still made one request per annual domain by optional-enrichment completion, with no duplicate annual request.
- The final My Meet Day sample recorded `desktop` medians of 569 ms for primary data and 584 ms for visible summaries. The `mobile-slow` profile recorded 2,734 ms and 2,818 ms respectively after moving the existing calendar renderer and its provider into the primary script phase. Optional Pool enrichment remained later at 715 ms on `desktop` and 3,294 ms on `mobile-slow`.

## Priority Matrix

| Priority | Type | Actionable Finding Or Feature | Visitor / Engineering Impact | Effort |
| --- | --- | --- | --- | --- |
| **RED - High** | None | No demonstrated accessibility barrier, data-integrity risk, security exposure, or material runtime defect | None | None |
| **ORANGE - Medium** | None | No demonstrated Medium-priority refactor or approved feature proposal remains | None | None |
| **GREEN - Low** | None | No demonstrated Low-priority refactor or approved feature proposal remains | None | None |

## High Priority

No active High-priority recommendation is supported by current repository evidence. Existing browser coverage includes keyboard, automated WCAG, hostile URL, analytics privacy, offline, PWA update, progressive-rendering, and annual-request-deduplication workflows. This audit does not claim full delivered-site conformance; secure-origin installation and production analytics remain human release checks.

## Medium Priority

No active Medium-priority recommendation remains after the two approved refactors were completed. My Meet Day remains experimental, and no favorite-pool summary is planned for Home.

## Low Priority

No active Low-priority recommendation remains. The preference migration has an objective retirement gate, the Pool feature disclosure follows the shared decorative triangle pattern, and safe official calendar actions share one renderer across Team details, Home, and My Meet Day.

## Retirement Classification

| Surface | Classification | Evidence / Removal Condition |
| --- | --- | --- |
| Manager `clearData()` methods | Current contract | Called by `DataManager.clear()` for initialized-domain reset |
| Analytics predecessor storage candidates | Temporary migration | Current profile/session upgrade reporting consumes them; comments require reassessment after the full 2027 season |
| `practiceAgeGroups` preference input | Temporary migration | Introduced with canonical `practiceGroups` in `488607d` on 2026-05-26. `PreferencesService` owns age-group-array input from persisted browser profiles, rewrites it to canonical storage on read, and preserves First Splash. Removing it early could discard returning visitors' saved age filters. Remove the branch and its focused tests in the first release after 2027-09-30. |

## Evidence-Based Exclusions

Current evidence does not support a framework or bundler migration, generic route-controller base class, universal script loader, annual-document split, per-card data requests, persistent model cache, relationship payload, runtime index, pre-expanded calendar dates, `content-visibility`, or virtualization. Active collections remain small, requests are shared, compressed annual payloads are modest, and progressive summary/detail boundaries already exist.

My Meet Day graduation and a favorite-pool Today summary on Home are excluded by current product direction. Do not add push notifications, accounts, background location, weather-derived facility closures, unofficial schedule inference, or user-profile analytics as shortcuts for future features. Revisit those boundaries only through separate product, privacy, data-authority, accessibility, and PWA reviews.

## Guardrails

- Do not modify `src/assets/data/` during general refactoring or feature implementation. Seasonal facts and manager-provided guidance require authoritative evidence, recorded provenance, and human review through the annual-data workflow.
- Never edit `out/`; it is generated by `pnpm run build`.
- Preserve `getDataManager()`, one shared pending request and manager collection per annual domain, and source ownership across pools, teams, and meets.
- Retire obsolete definitions, callers, fallbacks, aliases, fixtures, tests, types, dependencies, registrations, documentation, build rules, and cache references together.
- Preserve the PostHTML static-site architecture, native DOM APIs, classic-script ordering, CSP and rendering trust boundaries, analytics privacy limits, WCAG 2.0 AA behavior, and current offline commitments.
- Keep collapsed details empty and hydrate only requested content. Do not replace one shared annual document with per-card requests merely to describe a route as lazy-loaded.
- Keep weather safety separate from facility operating truth. Weather data may provide safety context but must not claim a pool is open or closed.
- Keep performance budgets advisory until comparable local and approved delivered-site samples establish stable variance. Do not navigate an automated browser to production.
- Run only change-scoped unit and browser tests for later implementation work, with required lint, build, data, and PWA gates selected by the affected boundary.

## Priority Summary

- **RED - High:** No demonstrated High-priority defect or release risk.
- **ORANGE - Medium:** No demonstrated Medium-priority refactor or approved feature proposal remains.
- **GREEN - Low:** No demonstrated Low-priority refactor or approved feature proposal remains.
