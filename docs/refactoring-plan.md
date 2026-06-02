# CNSL Engineering Refactoring Plan

Status: Active recommendations. Completed or closed items are removed when resolved.

Audit date: 2026-06-02

## Scope And Validation

This audit reviewed the current default branch for maintainability, accessibility, annual-data integrity, PWA and delivery behavior, testing and CI coverage, security hygiene, performance risk, documentation drift, and desktop layout consistency. The evidence pass inspected the largest delivered JavaScript modules, generated-markup and storage call sites, the pool schedule projection pipeline, semantic status presentation, embedded team-agenda width rules, pinned GitHub Actions workflows, dependency update configuration, the nightly accessibility suite, the release checklist, the security and privacy decision, and the generated PWA artifact. No application code, configuration, workflows, dependencies, annual source data, or generated output was modified during the audit.

Playwright was intentionally not run as part of this audit. The serialized browser workflow remains owned by the separate nightly browser-verification workflow after repository updates. Delivered-HTTPS PWA lifecycle, keyboard and screen-reader behavior, CSP console review, analytics request review, and browser performance measurements remain pending manual release checks.

| Validation | Result | Evidence Recorded During Audit |
| --- | --- | --- |
| `pnpm run lint` | Passed | ESLint completed without diagnostics. |
| `pnpm test` | Passed | 436 tests passed. |
| `pnpm run test:coverage` | Passed | 436 tests passed; delivered JavaScript coverage reported 100% lines, 95.19% branches, and 100% functions. |
| `pnpm run validate:data` | Passed | Active 2026 data validated: 23 pools, 14 teams, 35 regular meets, 3 special meets, and 26 retained official PDFs. |
| `pnpm audit --audit-level high` | Passed | No known vulnerabilities were reported. |
| `pnpm run build` | Passed | Ten HTML pages were processed and a 76-resource precache inventory was generated. |
| `pnpm run verify:pwa` | Passed | Verified 76 cached resources and a 1,804,820-byte generated artifact for the active 2026 season. |
| `pnpm run test:browser:nightly` | Not run | Playwright is excluded from the audit pass; retain the separate nightly browser-verification workflow after repository updates. |
| Delivered-HTTPS walkthrough | Pending | Retain secure-origin PWA, assistive-technology, CSP, analytics-request, and browser-performance checks in the release process. |
| `git diff --check` | Passed | The documentation-only audit patch contains no whitespace errors. |

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| RED - High | No demonstrated high-priority finding | - | - |
| ORANGE - Medium | M1. Extract pool period-schedule projection from the pool entity | High | Medium |
| ORANGE - Medium | M2. Reduce the pool route controller to orchestration responsibilities | Medium | Medium |
| ORANGE - Medium | M3. Move time-slot highlight presentation out of `TimeUtils` | Medium | Medium |
| GREEN - Low | L1. Refresh the public-artifact baseline and record delivered performance measurements | Low | Low |
| GREEN - Low | L2. Align embedded team agendas to a readable desktop content width | Low | Low |

## High Priority

No demonstrated accessibility barrier, release or annual-data integrity risk, security exposure, or current runtime defect warrants a high-priority refactor. Preserve the manual delivered-HTTPS checks because local automation does not establish secure-origin behavior or full accessibility conformance.

## Medium Priority

### M1. Extract Pool Period-Schedule Projection

- **Finding:** The pool entity still owns a broad period-schedule projection pipeline in addition to pool identity, facility data, searching, summaries, and serialization. Moving that projection into one DOM-free collaborator would reduce the risk of changing public-availability behavior while making future schedule work easier to isolate.
- **Repository evidence:** [src/js/models/pool.js](../src/js/models/pool.js#L117) normalizes active period schedules, [src/js/models/pool.js](../src/js/models/pool.js#L411) resolves dated slots, [src/js/models/pool.js](../src/js/models/pool.js#L529) projects seven-day schedules, and [src/js/models/pool.js](../src/js/models/pool.js#L638) merges dated overrides into regular hours. The same model also retains grouping and merged-slot helpers at [src/js/models/pool.js](../src/js/models/pool.js#L798) and [src/js/models/pool.js](../src/js/models/pool.js#L843); the audit scan found those two helpers referenced by focused tests but not by the current runtime path. Existing characterization coverage is substantial in [tests/models/pool.test.js](../tests/models/pool.test.js#L90).
- **Scoped plan:** Introduce one DOM-free schedule-projection service under `src/js/services/` and delegate the period-schedule normalization, dated-slot lookup, override merge, week projection, and semantic access-status resolution from `Pool`. Preserve the `Pool` public methods consumed by existing services. Review the retained grouping and merged-slot helpers during extraction; remove them only if runtime and regression evidence confirm they are obsolete.
- **Acceptance checks:** Preserve current public-availability, override, same-day transition, valid-date-range, and browser-registration behavior. Keep annual JSON and schemas unchanged. Run focused pool-model and pool-hours service tests, then `pnpm run lint`, `pnpm test`, `pnpm run test:coverage`, `pnpm run validate:data`, `pnpm run build`, `pnpm run verify:pwa`, and the required serialized `pnpm run test:browser:nightly` completion gate for the delivered-code refactor.

### M2. Reduce The Pool Route Controller

- **Finding:** The pool route entry script remains a large mixed-responsibility controller. It handles geolocation, filter-surface state, live-status refresh scheduling, card rendering, disclosure behavior, week navigation, and date-picker positioning. Keeping the entry script as an orchestrator while extracting cohesive collaborators would lower the cost of future pool-directory changes.
- **Repository evidence:** [src/js/pool-browser.js](../src/js/pool-browser.js#L256) requests location, [src/js/pool-browser.js](../src/js/pool-browser.js#L302) configures feature filters, [src/js/pool-browser.js](../src/js/pool-browser.js#L559) refreshes live pool status, [src/js/pool-browser.js](../src/js/pool-browser.js#L610) renders the directory, and [src/js/pool-browser.js](../src/js/pool-browser.js#L861) delegates pool-navigation clicks. The architectural decision already defines route scripts as display and interaction owners while keeping reusable behavior in services at [runtime-architecture.md](runtime-architecture.md#L13).
- **Scoped plan:** Keep `pool-browser.js` as the route entry point and retain native DOM APIs. Extract only cohesive behavior with a clear ownership gain, beginning with the calendar-control adapter and filter-surface adapter or refresh coordinator. Reuse the existing pool-directory, hours-view-model, display, and week-state services instead of adding parallel abstractions.
- **Acceptance checks:** Preserve initial annual-data loading, status announcements, keyboard operation, focus restoration, linked-pool scrolling, filters, sorting, location-aware ordering, disclosure state, week navigation, date selection, and timer cleanup. Run focused service tests during extraction, then the full delivered-code gate including `pnpm run test:browser:nightly`.

### M3. Move Time-Slot Highlight Presentation Out Of `TimeUtils`

- **Finding:** The general time utility still emits HTML, validates presentation colors, and injects inline highlight styles. CSS classes already exist for the same visual states. Moving the mapping to the schedule display boundary would make time arithmetic DOM-free, keep semantic status separate from presentation color, and remove one contributor to the acknowledged inline-style CSP constraint.
- **Repository evidence:** [src/js/services/time-utils.js](../src/js/services/time-utils.js#L23) declares allowed status colors, [src/js/services/time-utils.js](../src/js/services/time-utils.js#L727) formats highlighted HTML, [src/js/services/time-utils.js](../src/js/services/time-utils.js#L746) branches on `status.color`, and [src/js/services/time-utils.js](../src/js/services/time-utils.js#L854) duplicates highlight styles inline. Equivalent classes already live in [src/css/styles.css](../src/css/styles.css#L3324). The security decision records the remaining `style-src 'unsafe-inline'` limitation and a future class-based tightening path at [security-privacy.md](security-privacy.md#L26).
- **Scoped plan:** Move time-range markup formatting into the schedule display boundary or a dedicated DOM-free display helper. Map explicit semantic schedule state to allowlisted classes at that boundary, use the shared HTML-safety service for generated text, and remove duplicated inline styles from time-range markup. Keep the broader CSP permission until every supported runtime-style use has been separately reviewed.
- **Acceptance checks:** Preserve active-slot timing, safe fallback markup, light and dark theme contrast, and schedule rendering. Confirm generated time-range markup contains allowlisted classes without inline styles and that interaction behavior does not branch on colors or visible labels. Run focused time-utils and schedule-display tests, then the full delivered-code gate including `pnpm run test:browser:nightly`. Reevaluate the documented CSP limitation without claiming that this item alone removes `style-src 'unsafe-inline'`.

## Low Priority

### L1. Refresh Public-Artifact Performance Evidence

- **Finding:** The generated PWA artifact verifies successfully, but the checked-in release checklist retains an older local footprint and leaves delivered render-completion and request measurements pending. This is documentation and monitoring drift rather than a demonstrated runtime regression.
- **Repository evidence:** The current `pnpm run verify:pwa` audit result is 76 cached resources and 1,804,820 bytes. The release checklist still records a 1,545,251-byte artifact from 2026-05-26 at [release-checklist.md](release-checklist.md#L65), while delivered directory render completion and first-view request measurements remain pending at [release-checklist.md](release-checklist.md#L66) and [release-checklist.md](release-checklist.md#L67).
- **Scoped plan:** During the next qualifying delivered-HTTPS review, refresh the local artifact baseline and record browser measurements for Home, Pools, Teams, and Meets. Compare transfer size, cache behavior, and usable render completion before proposing asset optimization. Treat annual source documents and active-season data as protected inputs; any optimization proposal must preserve reviewed source evidence and public behavior.
- **Acceptance checks:** Record the clean-build artifact size, browser and network environment, first-view request count and transfer size, directory usable-render completion, and any follow-up budget decision in the release record or checklist. Do not edit generated `out/` files or annual source assets as a measurement shortcut.

### L2. Align Embedded Team Agendas On Desktop

- **Finding:** The upcoming-events agenda embedded in an expanded team card mixes a compact event-content width with a full-card date-heading width. On wide desktop viewports, the relative-day pill such as `today` or `in 4 days` is right-aligned against the distant card edge instead of the readable agenda region. This is a desktop consistency and polish issue, not a demonstrated accessibility barrier.
- **Repository evidence:** [src/css/styles.css](../src/css/styles.css#L1199) makes each agenda day heading a space-between flex row, while [src/css/styles.css](../src/css/styles.css#L1214) applies the matching `30rem` heading cap only to the home-page `#favoriteWeek` instance. Embedded team-card agendas reuse the shared renderer at [src/js/teams-browser.js](../src/js/teams-browser.js#L441) and [src/js/teams-browser.js](../src/js/teams-browser.js#L453), but their event headings and session rows already use compact `30rem` caps at [src/css/styles.css](../src/css/styles.css#L1244) and [src/css/styles.css](../src/css/styles.css#L4217). Nearby expanded-team blocks also use bounded desktop widths: practice disclosures at [src/css/styles.css](../src/css/styles.css#L3905) and staff columns at [src/css/styles.css](../src/css/styles.css#L4085). The existing browser workflow asserts that practice panels remain narrower than the desktop team card at [tests/browser/workflows.spec.js](../tests/browser/workflows.spec.js#L645), but it does not assert embedded agenda-heading geometry.
- **Scoped plan:** Give the embedded team agenda one readable-width container or equivalent shared width rule so its date headings, relative-day pills, event headings, and session rows align consistently on desktop. Preserve the intentionally centered home-page favorite agenda, the full-width outer team card, and the existing phone layout. Review the expanded team-detail blocks together for visual rhythm, but keep the implementation limited to width and alignment rules supported by the desktop evidence.
- **Acceptance checks:** At representative desktop widths, expand Long Reach Marlins and confirm each relative-day pill remains right-aligned within the same readable agenda region as its event and session rows. Confirm the home-page favorite agenda stays centered, team practice and staff sections retain their current bounded widths, narrow phone layouts do not overflow, and keyboard focus remains visible. Add a browser geometry assertion for the embedded desktop agenda and run `pnpm run build` followed by the required serialized `pnpm run test:browser:nightly` completion gate for the visitor-facing CSS change.

## Phased Roadmap

| Phase | Work | Risk And Prerequisites | Completion Evidence |
| --- | --- | --- | --- |
| 1. Isolate schedule rules | M1. Extract pool period-schedule projection | Highest behavioral sensitivity; preserve the current `Pool` public contract and annual source data. | Focused characterization tests, complete automated gate, and serialized nightly browser verification. |
| 2. Thin route orchestration | M2. Reduce the pool route controller | Start after M1 to avoid overlapping churn in pool-directory behavior. | Pool workflow checks, keyboard verification, complete automated gate, and serialized nightly browser verification. |
| 3. Tighten presentation ownership | M3. Move time-slot highlight presentation out of `TimeUtils` | Coordinate with schedule display tests and retain CSP permission until all runtime-style uses are reviewed. | Focused markup and contrast checks, complete automated gate, and serialized nightly browser verification. |
| 4. Normalize desktop team-detail alignment | L2. Align embedded team agendas to a readable content width | Keep the shared home agenda centered and preserve narrow-layout behavior while correcting the embedded desktop presentation. | Desktop agenda geometry assertion, focused visual review, clean build, and serialized nightly browser verification. |
| 5. Refresh delivered measurements | L1. Update public-artifact performance evidence | Perform on a qualifying HTTPS release or preview after the higher-risk refactors land. | Updated baseline, delivered browser measurements, and a recorded budget decision. |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site, single delivered stylesheet, and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Drive filtering, state transitions, interaction decisions, accessibility state, and analytics categorization from domain values or explicit semantic properties; map semantics to labels, icons, classes, and colors only at the rendering boundary.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, accessibility gates, and pinned workflow actions while refactoring display state.
- Run focused checks while iterating on delivered code, then run the required complete automated gate and serialized `pnpm run test:browser:nightly` completion gate for significant refactors.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.

## Priority Summary

- **RED - High:** No demonstrated high-priority finding.
- **ORANGE - Medium:** Extract pool period-schedule projection, slim the pool route controller, and move time-slot highlight presentation out of `TimeUtils`.
- **GREEN - Low:** Refresh the verified public-artifact baseline, record delivered browser performance measurements, and align embedded team agendas to a readable desktop content width.
