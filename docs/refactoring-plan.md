# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved.

Audit date: 2026-06-02

## Scope And Validation

This fresh review examined the current `main` tree for maintainability, browser-facing semantics and accessibility boundaries, seasonal-data integrity, PWA and delivery behavior, testing and CI coverage, security and privacy hygiene, performance risk, and documentation drift. The evidence pass inspected the shared repository guardrails, route renderers, reusable schedule and link services, analytics handling, PostHTML build, service worker, artifact verifier, release documentation, deploy workflow, nightly browser workflow, refactoring-plan pull-request boundary, and representative unit and browser specifications. Generated `out/` content was rebuilt for verification only; no annual source data was edited.

| Validation | Result | Evidence Recorded During Audit |
| --- | --- | --- |
| `git status --short --branch` | Passed | The audit began on clean `main` tracking `origin/main`. |
| `pnpm run lint` | Passed | ESLint completed without diagnostics. |
| `pnpm test` | Passed | 428 tests passed; 0 failed, cancelled, skipped, or todo. |
| `pnpm run validate:data` | Passed | Active 2026 data validated: 23 pools, 14 teams, 35 regular meets, 3 special meets, and 26 retained official PDFs. |
| `pnpm audit --audit-level high` | Passed | pnpm reported no known vulnerabilities. |
| `pnpm run build` | Passed | Ten HTML pages built; archived 2025 data, retained 2026 annual evidence PDF directories, and original logo sources were excluded from generated output. |
| `pnpm run verify:pwa` | Passed | Verified 75 cached resources and a 1,734,542-byte generated artifact for the 2026 season, including publication, CSP, analytics, crawler, canonical-page, and offline-contract assertions. |
| Playwright accessibility and workflow checks | Not run during this audit | The refactoring-auditor workflow intentionally leaves Playwright to the separate nightly browser-verification workflow after repository updates. Any implementation that changes delivered browser behavior must run `pnpm run test:browser:nightly` as its significant-refactor completion gate. |

Pending manual validation remains the delivered-site HTTPS walkthrough in [release-checklist.md](release-checklist.md), including installed-PWA lifecycle, keyboard and screen-reader behavior, CSP console review, analytics request review, and occasional browser performance measurements. Local automation does not establish those secure-origin results. No current audit evidence demonstrates a high-priority accessibility, security, release, or data-integrity defect.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| RED - High | No actionable high-priority finding supported by current evidence. | No demonstrated accessibility barrier, release or data-integrity risk, security exposure, or material runtime failure requires immediate remediation. | Not applicable |
| ORANGE - Medium | M1. Preserve semantic practice-period metadata through the team schedule and agenda pipeline. | Prevents labels and formatted session text from becoming hidden business rules for the home and team upcoming-event agenda. | Medium |
| ORANGE - Medium | M2. Annotate external-link analytics categories with explicit semantic metadata. | Keeps purpose-limited measurement stable when layout or styling classes change and makes the reviewed category boundary visible at each published link. | Medium |
| ORANGE - Medium | M3. Remove remaining stateful branches that treat presentation classes or display strings as semantic truth. | Reduces maintenance coupling in pool filtering, favorite-card persistence, and disclosure behavior while preserving the existing native-DOM architecture. | Medium |
| GREEN - Low | No actionable low-priority finding supported by current evidence. | Documentation and release follow-up currently remain tracked through existing checklists. | Not applicable |

## High Priority

No active high-priority recommendation is supported by this audit. Annual-data validation, dependency audit, lint, unit tests, clean build publication restrictions, and PWA artifact verification passed. Browser automation and delivered-site checks remain explicitly separate evidence rather than presumed conformance.

## Medium Priority

### M1. Preserve Semantic Practice-Period Metadata Through The Agenda Pipeline

**Finding:** Upcoming-practice selection and icon rendering reconstruct morning and evening meaning from presentation labels and formatted session-time strings. This conflicts with the repository guardrail that filtering and state decisions derive from semantic properties and leaves agenda behavior coupled to copy formatting.

**Repository evidence:**

- [team-schedule-service.js](../src/js/services/team-schedule-service.js#L93) creates recurring patterns with labels such as `Morning Practice` and `Evening Practice`, then [team-schedule-service.js](../src/js/services/team-schedule-service.js#L132) forwards the label without a semantic period key.
- [team-agenda-display.js](../src/js/services/team-agenda-display.js#L23) first classifies practices by those labels and then falls back to regular expressions over formatted session text. [team-agenda-display.js](../src/js/services/team-agenda-display.js#L124) later selects decorative icon state from the rendered event label.
- [team-agenda-display.test.js](../tests/services/team-agenda-display.test.js#L176) explicitly exercises classification from time labels, and [team-agenda-display.test.js](../tests/services/team-agenda-display.test.js#L190) locks in display-label classification ahead of session inspection.

**Scoped plan:** Add an explicit bounded practice-period property such as `morning`, `evening`, or `other` when `TeamScheduleService` expands recurring patterns. Preserve that property through upcoming-event selection and map it to labels and icons only at the rendering boundary. For pre-season entries that require time-derived classification, parse schedule ranges in the service layer and store the semantic result before the display service receives the event. Keep the active annual JSON unchanged.

**Acceptance checks:**

- `TeamAgendaDisplay` no longer decides practice category or decorative icon state from visible labels or free-form formatted session strings.
- Focused schedule and agenda unit tests cover regular morning, regular evening, pre-season time-derived classification, unknown classification, same-day expiry, and rendered labels/icons.
- Existing home-agenda browser workflow expectations remain intact.
- Run `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:pwa`, and `pnpm run test:browser:nightly` after implementation.

### M2. Annotate External-Link Analytics Categories With Explicit Semantic Metadata

**Finding:** External-link analytics derives approved aggregate context and merchandise-purpose categories from CSS selectors and a styling class. The payload remains bounded today, but the semantic decision is coupled to presentation structure contrary to the analytics guardrail.

**Repository evidence:**

- [analytics.js](../src/js/analytics.js#L30) defines context categories as CSS selectors. [analytics.js](../src/js/analytics.js#L109) searches ancestor selectors and [analytics.js](../src/js/analytics.js#L114) decides merchandise purpose from `classList.contains('team-merchandise')`.
- [teams-browser.js](../src/js/teams-browser.js#L467) renders the merchandise destination with its styling class but no explicit reviewed analytics-purpose attribute.
- [workflows.spec.js](../tests/browser/workflows.spec.js#L173) verifies the fixed aggregate share-link payload, while [workflows.spec.js](../tests/browser/workflows.spec.js#L725) verifies the merchandise payload. These tests protect output values but currently preserve the presentation coupling.

**Scoped plan:** Render explicit `data-analytics-context` and `data-analytics-link-purpose` metadata for app-published external links, validate both values against fixed allowlists inside `analytics.js`, and publish only allowlisted aggregate categories. Keep CSS selectors for styling and ordinary DOM targeting only. Retain the existing privacy boundary: never transmit URLs, labels, hosts, preference values, or arbitrary dataset values.

**Acceptance checks:**

- External-link analytics category selection no longer branches on styling classes or layout selectors.
- Unit or browser regression coverage proves approved attributes emit the existing bounded categories and unknown, malformed, or injected values cannot be transmitted.
- `scripts/verify-pwa-build.js` continues to assert the approved analytics boundary without relying on CSS classification.
- Run `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:pwa`, and `pnpm run test:browser:nightly` after implementation; retain the delivered-site analytics request review in [release-checklist.md](release-checklist.md).

### M3. Remove Remaining Presentation-Derived Stateful Branches

**Finding:** A small set of stateful helpers still reads display text or presentation classes as domain state. The current tests pass, so this is a maintainability correction rather than a demonstrated visitor-facing defect.

**Repository evidence:**

- [pools-manager.js](../src/js/pools-manager.js#L95) filters status by comparing visitor-facing `status` text even though [pool-enums.js](../src/js/types/pool-enums.js#L6) exposes stable semantic `kind` values.
- [pool-browser.js](../src/js/pool-browser.js#L734) and [teams-browser.js](../src/js/teams-browser.js#L377) decide whether to persist favorite-card expansion by checking the `favorite-card` presentation class after card rendering.
- [navigation.js](../src/js/navigation.js#L62) and [navigation.js](../src/js/navigation.js#L86) use the `active` class as the menu-state source for toggling and focus containment even though the control already exposes `aria-expanded` and the menu exposes inert state.
- [meets-browser.js](../src/js/meets-browser.js#L368), [pool-browser.js](../src/js/pool-browser.js#L866), and [teams-browser.js](../src/js/teams-browser.js#L596) show nearby delegated interaction paths where stable semantic hooks should be distinguished from styling selectors during the cleanup.

**Scoped plan:** Compare pool statuses by semantic `kind`, derive favorite identity from stored identifiers or explicit semantic card metadata, and make disclosure state flow from an explicit property or accessible state before mapping it to CSS classes. Where delegated listeners need a durable command hook, use an explicit action attribute and leave styling classes free to change. Keep the work bounded to the evidenced stateful decisions; do not mechanically rewrite ordinary query selectors that only locate DOM nodes.

**Acceptance checks:**

- Pool status filtering remains correct when visible status copy changes while semantic `kind` remains stable.
- Favorite pool and team expansion persistence no longer depends on the `favorite-card` CSS class.
- Menu focus containment and card disclosures continue to work by keyboard with CSS classes treated as rendered output rather than the state source.
- Focused unit tests and existing browser workflow checks cover the changed branches, followed by `pnpm run lint`, `pnpm test`, `pnpm run build`, `pnpm run verify:pwa`, and `pnpm run test:browser:nightly`.

## Low Priority

No active low-priority recommendation is supported by this audit. The outstanding HTTPS release walkthrough is a required operational verification step already maintained in [release-checklist.md](release-checklist.md), not evidence of a refactoring defect. The dated artifact-size row in that checklist remains a historical measurement rather than a claim about the latest build.

## Phased Roadmap

| Phase | Work | Why This Order | Completion Evidence |
| --- | --- | --- | --- |
| 1. Semantic schedule model | Complete M1. | The agenda pipeline has the clearest domain boundary and establishes the semantic-property pattern for later cleanup. | Focused schedule and agenda tests, lint, unit suite, clean build, PWA verification, serialized browser workflow and WCAG checks. |
| 2. Browser semantic hooks | Complete M3. | Apply the same pattern to the bounded stateful browser branches without mixing analytics review into disclosure work. | Focused manager and workflow coverage, keyboard disclosure checks, lint, unit suite, clean build, PWA verification, serialized browser workflow and WCAG checks. |
| 3. Purpose-limited analytics metadata | Complete M2. | Keep the privacy-sensitive change isolated for clear payload review after the semantic-hook pattern is established. | Fixed-category and hostile-value regression coverage, artifact assertions, lint, unit suite, clean build, PWA verification, serialized browser workflow and WCAG checks, delivered HTTPS analytics request review. |
| 4. Delivered-site review | Complete the existing secure-origin checklist after publishing. | Local automation cannot establish installed-PWA lifecycle, assistive-technology behavior, CSP console state, or real analytics requests. | Recorded HTTPS evidence in the release pull request or [release-checklist.md](release-checklist.md). |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Drive filtering, state transitions, interaction decisions, accessibility state, and analytics categorization from domain values or explicit semantic properties; map semantics to labels, icons, classes, and colors only at the rendering boundary.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, and accessibility gates while refactoring display state.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.

## Priority Summary

**RED - High:** No actionable high-priority items are supported by current evidence.

**ORANGE - Medium:** Preserve semantic practice-period metadata through the agenda pipeline; replace CSS-derived external-link analytics categories with validated semantic metadata; and remove the bounded remaining stateful branches that treat presentation classes or display strings as semantic truth.

**GREEN - Low:** No actionable low-priority items are supported by current evidence; retain the existing delivered-site manual validation checkpoint.
