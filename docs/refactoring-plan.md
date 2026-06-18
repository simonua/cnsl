# CNSL Engineering Refactoring Plan

Review date: 2026-06-18

## Scope And Validation

This focused audit reviewed the active annual schemas and payloads, runtime fetch and model-construction paths, cross-domain enrichment, route assembly, cache behavior, source validation, and the open findings from the 2026-06-16 repository-wide audit. No active-season source file or schema was modified. Concurrent uncommitted interface work was outside this audit and remains untouched.

The current documents contain 23 pools, 14 teams, 35 regular meets, and 3 special meets. Raw/gzip sizes are 241,823/8,669 bytes for pools, 45,500/6,296 for teams, and 7,501/1,027 for meets. Warm Node.js 26.3.1 sampling measured parse plus model construction at approximately 6.5 ms for pools, 0.19 ms for teams, and 0.06 ms for meets. Approximate retained heap per loaded manager was 225 KB, 67 KB, and 15 KB respectively. These are diagnostic local samples rather than browser field measurements.

The annual loader already shares pending requests, retains one manager per domain, and limits each route to one request per requested domain. Pool-meet enrichment is idempotent. The active schemas are strict and normalized around source ownership, while repeated pool schedule structures compress extremely well. Splitting documents, adding relationship payloads, pre-expanding dates, or replacing small scans with indexes would add joins, invalidation, offline complexity, and annual-data governance without a demonstrated visitor benefit.

A local browser sample of Meets rendered 38 meets in 8 date cards. Seven collapsed date groups contained 486 of the meet list's 679 descendants and 34,172 of its 48,896 HTML characters. The route also loaded pools and teams before displaying the meet list, although the meets document alone can provide the date summaries. This is the clearest measured data-assembly opportunity.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | No demonstrated high-priority refactoring defect | None | None |
| **ORANGE - Medium** | Assemble Meets progressively from its primary document | Medium: earlier useful content and materially less hidden initial DOM | Medium |
| **GREEN - Low** | Retire eager and unused annual-data compatibility paths | Low: remove about 4.5 ms of pool construction work and align runtime contracts with active schemas | Medium |
| **GREEN - Low** | Refresh recorded performance evidence after delivery work | Low: keep release decisions tied to current comparable measurements | Low |

## High Priority

No active high-priority findings are supported by the current repository evidence or focused measurements.

## Medium Priority

### 1. Assemble Meets Progressively

**Finding:** [src/js/meets-browser.js](../src/js/meets-browser.js) waits for pools, teams, and meets before rendering, then constructs details for every meet inside collapsed date groups. The current data scale does not justify schema normalization, but it does justify separating primary meet summaries from optional cross-domain enrichment and requested details.

**Repository evidence:**

- The 7.5 KB raw meets document parses and constructs its 38 models in approximately 0.06 ms in the focused Node sample.
- The local route sample generated 679 meet-list descendants and 48,896 HTML characters; collapsed groups owned approximately 72% of those descendants and 70% of the HTML.
- Pools and Teams already load their primary domain first, render lightweight summaries, and defer optional cross-domain enrichment or detail hydration.
- [src/views/meets.html](../src/views/meets.html) eagerly includes pool and team models and managers before the deferred route controller.
- The 2026-06-16 five-sample benchmark kept Meets within its usable-time budget but exceeded its advisory request and decoded-byte budgets at 49 requests and 856,947 bytes.

**Scoped plan:**

1. Add ordered Meets marks for primary data ready, date summaries visible, requested detail visible, and optional enrichment settled.
2. Load meets first and render date headers with live state from meet models only.
3. Load pools and teams once in parallel after summaries are visible. Use them for pool links, course labels, favorite-team presentation, and deep-link resolution without replacing focused controls or moving the page unexpectedly.
4. Hydrate only the initially expanded, deep-linked, or visitor-requested date. Keep collapsed detail containers empty and preserve expansion, focus, scroll, analytics, and live-state refresh behavior.
5. Settle optional failures accessibly with useful plain meet details rather than making the primary schedule unavailable.
6. Move route dependencies out of the initial Meets script list only after the lifecycle and offline path are covered. Coordinate this with the existing install-critical route inventory instead of introducing a separate cache policy.

**Acceptance checks:**

- Paused pool and team requests still leave every meet date summary visible and operable.
- Each annual domain is requested at most once, and requested or deep-linked details hydrate once without duplicate model construction.
- Initially collapsed groups contain no generated meet-detail subtree.
- Favorite markers, pool links, course labels, deep links, live-state changes, focus restoration, reduced motion, keyboard use, and accessible busy/failure states remain correct.
- Equivalent five-sample `desktop` and `mobile-slow` measurements show no usable-time, long-task, request, byte, worker-control, repeat-navigation, or offline regression and record the summary/detail phase improvement.
- Focused unit tests, exact Meets browser workflow and accessibility IDs, lint, build, and PWA verification pass.

## Low Priority

### 1. Retire Annual-Data Compatibility Paths

**Finding:** Current schemas require structured pool locations and period schedules plus separate regular and special meet arrays, but runtime code still constructs and accepts older shapes. The pool compatibility projection has a measurable absolute cost; the legacy meet shape is accepted but not populated by its manager.

**Repository evidence:**

- [src/js/models/pool.js](../src/js/models/pool.js) calls `normalizeActiveSchedule()` once for every current pool and creates a day-keyed `PoolSchedule` even though period-aware methods delegate to `PoolPeriodScheduleService`.
- Focused sampling attributed approximately 4.5 ms of a warmed 4.7 ms pool-manager construction to those 23 compatibility projections. Constructing all pool `toJSON()` views afterward averaged approximately 0.2 ms.
- The active pool schema has no flat location, day-keyed `hours`, `amenities`, `divingBoard`, or `babyPool` fields, but the model and manager retain branches and APIs for them.
- [src/js/services/data-manager.js](../src/js/services/data-manager.js) accepts a top-level `meets` array, while [src/js/managers/meets-manager.js](../src/js/managers/meets-manager.js) consumes only `regular_meets` and `special_meets`. The active meet schema permits only the latter shape.

**Scoped plan:**

1. Inventory delivered consumers and tests for day-keyed pool methods, broad pool `toJSON()` use, flat locations, legacy amenity flags, and the top-level `meets` shape.
2. Replace broad pool projections at weather and link boundaries with the smallest stable record contract each consumer needs.
3. Stop constructing the active day-keyed compatibility schedule eagerly. Remove delivered compatibility used only by fixtures; if a verified current caller remains, isolate the narrowest lazy migration boundary and define its removal condition.
4. Remove unused pool compatibility members and manager APIs after their callers are migrated; do not change active annual source data merely to match old runtime fields.
5. Remove the accepted top-level `meets` shape, or deliberately map populated records if a real external contract is discovered. Do not keep validation that reports success while loading zero models.

**Acceptance checks:**

- Active pool construction no longer performs one date-sensitive compatibility projection per record.
- Pool status, hours, filtering, weather coordinates, course labels, meet enrichment, exports, and current fixtures retain their documented behavior.
- Runtime validation accepts exactly the shapes consumed by each manager.
- Focused model, manager, data-manager, weather, pool-link, and pool-directory tests pass with 100% focused coverage for changed delivered modules.
- Lint and build validation pass, and comparable pool primary-data timing does not regress.

### 2. Refresh The Recorded Performance Baseline

**Finding:** The row labeled "Current PWA cache tiers" in [docs/release-checklist.md](release-checklist.md) still records the 2026-06-10 artifact at 97 resources / 2,877,025 bytes, while the 2026-06-16 audit measured 106 / 3,163,595 and eight warnings. Leaving the older row labeled current makes future comparisons ambiguous.

**Scoped plan:**

1. After the medium-priority delivery review is accepted, add a dated comparable five-sample measurement row and label older rows as historical baselines.
2. Record the environment, route medians and spreads, directory phases, annual-domain maxima, PWA tiers, and warning count in the established compact format.
3. Keep local and delivered-HTTPS evidence distinct and do not imply field-device or production validation from an isolated local run.

**Acceptance checks:**

- The newest recorded artifact is dated and no historical row is ambiguously labeled current.
- The row agrees with the complete performance output and notes every remaining advisory warning.
- Markdown lint passes for the updated documentation.

## Schema And Data Decision

No active schema or source-data adjustment is recommended from this audit.

- Pool schedule repetition is highly compressible: 241,823 raw bytes become 8,669 gzip bytes. The 599 regular and override slots contain only 14 activity `sourceUrl` occurrences, so URL inheritance would save negligible data.
- Pool, team, and meet collections are too small for additional runtime indexes to offset their memory and invalidation cost.
- Normalized relationship tables would make human-maintained annual sources harder to review and would move simple source records into runtime joins.
- Pre-expanded calendar dates would increase payload size and rollover work while making date-sensitive state easier to stale.
- Generated meet-to-pool overrides correctly remain runtime-only because meets own meet facts and pool schedules own facility hours.

Revisit the schema only when authoritative source semantics cannot be represented, or when comparable measurements show that payload shape rather than rendering and dependency sequencing limits useful readiness.

## Phased Roadmap

| Phase | Priority | Work | Prerequisites | Completion Evidence |
| --- | --- | --- | --- | --- |
| 1 | **ORANGE - Medium** | Add Meets phase marks and focused paused-dependency coverage | Current route and annual-request baselines | Stable summary, detail, and enrichment measurements |
| 2 | **ORANGE - Medium** | Implement progressive Meets summaries, enrichment, and detail hydration | Phase 1 evidence | Focused unit/browser/WCAG, build, PWA, and performance evidence |
| 3 | **GREEN - Low** | Retire measured pool and meet compatibility paths | Consumer inventory and Phase 2 stability | Focused coverage and reduced pool construction work |
| 4 | **GREEN - Low** | Refresh the release-checklist performance record | Phase 2 outcome | Dated comparable baseline and clean Markdown lint |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring work. Seasonal sources require the annual-data workflow, live official-source review, recorded evidence, and human approval.
- Never edit `out/`; it is generated by `pnpm run build`.
- Keep one shared annual request and model collection per domain. Do not introduce per-card requests, persistent model caches, generated relationship payloads, or duplicate indexes without new measurements.
- Preserve the PostHTML architecture, native DOM APIs, classic browser-script boundary, analytics privacy boundary, accessibility behavior, and current offline commitments.
- Preserve source ownership: meet facts remain in meets data, team facts remain in teams data, and facility schedules remain in pools data.
- Keep performance budgets advisory until comparable local and delivered samples establish stable variance.
- Do not navigate an automated browser to production; collect delivered-site evidence through the approved human release review.

## Priority Summary

- **RED - High:** No actionable high-priority items are supported by current evidence.
- **ORANGE - Medium:** Render Meets date summaries from the primary document, then enrich and hydrate only requested details.
- **GREEN - Low:** Retire measured legacy pool/meet compatibility paths and refresh the recorded performance baseline after delivery work.
