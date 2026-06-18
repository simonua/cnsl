# CNSL Engineering Refactoring Plan

Review date: 2026-06-18

## Scope And Validation

This focused audit reviewed the active annual schemas and payloads, runtime fetch and model-construction paths, cross-domain enrichment, route assembly, cache behavior, source validation, and the open findings from the 2026-06-16 repository-wide audit. It also reviewed the remaining visitor routes after the progressive Pools, Teams, My Meet Day, and Meets work. No active-season source file or schema was modified. Concurrent uncommitted seasonal-source work was outside this audit and remains untouched.

The current documents contain 23 pools, 14 teams, 35 regular meets, and 3 special meets. Raw/gzip sizes are 241,823/8,669 bytes for pools, 45,500/6,296 for teams, and 7,501/1,027 for meets. Warm Node.js 26.3.1 sampling measured parse plus model construction at approximately 6.5 ms for pools, 0.19 ms for teams, and 0.06 ms for meets. Approximate retained heap per loaded manager was 225 KB, 67 KB, and 15 KB respectively. These are diagnostic local samples rather than browser field measurements.

The annual loader already shares pending requests, retains one manager per domain, and limits each route to one request per requested domain. Pool-meet enrichment is idempotent. The active schemas are strict and normalized around source ownership, while repeated pool schedule structures compress extremely well. Splitting documents, adding relationship payloads, pre-expanding dates, or replacing small scans with indexes would add joins, invalidation, offline complexity, and annual-data governance without a demonstrated visitor benefit.

The progressive Meets work is complete. The route now renders every date summary from the primary meets document, keeps collapsed details empty, hydrates only expanded or deep-linked dates, and loads pool and team enrichment once in the background. Three-sample desktop measurement placed summary visibility at a 404 ms median and optional enrichment at 476 ms. The 4x-CPU `mobile-slow` profile placed those boundaries at 1,590 ms and 2,338 ms. Remaining route observations did not support another implementation without a new route-specific measurement.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | No demonstrated high-priority refactoring defect | None | None |
| **ORANGE - Medium** | No demonstrated medium-priority refactoring defect | None | None |
| **GREEN - Low** | Retire eager and unused annual-data compatibility paths | Low: remove about 4.5 ms of pool construction work and align runtime contracts with active schemas | Medium |
| **GREEN - Low** | Reassess slower-CPU route work from comparable evidence | Low: investigate only when repeatable route measurements identify the next useful-content constraint | Low |

## High Priority

No active high-priority findings are supported by the current repository evidence or focused measurements.

## Medium Priority

No active medium-priority findings are supported by the current repository evidence or focused measurements.

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

- [ ] Active pool construction no longer performs one date-sensitive compatibility projection per record.
- [ ] Pool status, hours, filtering, weather coordinates, course labels, meet enrichment, exports, and current fixtures retain their documented behavior.
- [ ] Runtime validation accepts exactly the shapes consumed by each manager.
- [ ] Focused model, manager, data-manager, weather, pool-link, and pool-directory tests pass with 100% focused coverage for changed delivered modules.
- [ ] Lint and build validation pass, and comparable pool primary-data timing does not regress.

### 2. Reassess Slower-CPU Route Work From Comparable Evidence

**Finding:** The delivered progressive routes now expose useful-content boundaries, but the three-sample `mobile-slow` profile remains CPU-sensitive and variable across the application. Meets reached a 1,590 ms summary median and 2,220 ms usable median, with an 840 ms long-task median. Home, Pools, Teams, and My Meet Day also exceeded their advisory usable-time budgets in the same profile. These measurements justify continued observation, not an unmeasured implementation on another route.

**Scoped plan:**

1. Repeat the same desktop and `mobile-slow` profiles after a material route change or a visitor-reported slowdown.
2. Compare useful-content phases, long tasks, request and byte counts, and installed navigation before selecting another route.
3. Investigate Lessons or another route only when its own measured useful-content boundary identifies a material constraint; do not infer priority from viewport size alone.

**Acceptance checks:**

- [ ] A repeatable measurement identifies a specific route phase or long task that materially delays useful content.
- [ ] The proposed change has a visitor-facing benefit and preserves accessibility, offline behavior, and annual-domain request sharing.
- [ ] Comparable before-and-after evidence distinguishes viewport effects from 4x-CPU effects.

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
| 1 | **GREEN - Low** | Retire measured pool and meet compatibility paths | Consumer inventory and current progressive-route stability | Focused coverage and reduced pool construction work |
| 2 | **GREEN - Low** | Reassess route performance after material changes or visitor reports | Comparable desktop and slower-CPU evidence | Evidence-backed route selection or a documented no-change decision |

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
- **ORANGE - Medium:** No actionable medium-priority items are supported by current evidence.
- **GREEN - Low:** Retire measured legacy pool/meet compatibility paths and reassess route work only when comparable measurements identify a specific visitor-facing constraint.
