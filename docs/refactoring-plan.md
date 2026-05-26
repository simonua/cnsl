# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved.

Updated: 2026-05-26

## Scope

This living backlog contains only actionable refactoring findings from the current integrated tree. It prioritizes security and privacy governance, seasonal-data reliability, accessibility validation, maintainability, and visitor-facing performance. Completed implementation evidence belongs in release records and focused design documentation rather than this backlog.

## Priority Matrix

| Priority | Recommendation | Impact | Effort | Exit Criterion |
| --- | --- | --- | --- | --- |
| RED - High | H1. Reconcile expanded analytics with an approved measurement record. | Privacy-governance and release-review risk. | Medium | Every emitted application event and permitted field is documented and tested against the purpose-limited boundary. |
| ORANGE - Medium | M1. Validate detailed practice recurrence as renderable data. | A source typo can pass validation while hiding schedule entries. | Medium | Invalid recurrence input fails validation with team-specific context and has negative tests. |
| ORANGE - Medium | M2. Exercise new schedule experiences in accessibility gates. | The agenda and expanded practice UI can regress outside axe coverage. | Low-Medium | Light/dark automated checks cover visible agenda and detailed-practice states. |
| ORANGE - Medium | M3. Avoid conditional agenda cost on every home visit. | Primary-route scripts execute even when no favorite schedule can display. | Medium | Agenda dependencies load conditionally or a measured home-route budget is enforced. |
| GREEN - Low | L1. Make seasonal-monitor evidence allowlisting directly testable. | Future workflow changes could weaken protected-data boundaries unnoticed. | Low | The accepted-path rule runs through a focused automated test or reusable validation command. |

## High Priority

### H1. Reconcile Analytics Collection With The Decision Record

**Finding**: [analytics.js](../src/js/analytics.js), [settings.js](../src/js/settings.js), and [workflows.spec.js](../tests/browser/workflows.spec.js) implement and test fixed-choice setting events and external-link interaction measurement. [security-privacy.md](security-privacy.md) describes these categories generally, while [release-checklist.md](release-checklist.md) requires an implemented-measurement table identifying approved collected fields.

**Recommendation**: Restore an itemized implemented-measurement record for each emitted application event and its permitted fields, explicitly approve or remove each setting category, and retain tests proving arbitrary values and destination details cannot be emitted.

## Medium Priority

### M1. Validate Practice Recurrence As Renderable Data

**Finding**: [team-schedule-service.js](../src/js/services/team-schedule-service.js) interprets human-readable periods and weekday expressions, but the detailed-practice schema accepts schedule fields as non-empty strings and [validate-season-data.js](../scripts/validate-season-data.js) validates practice URLs and pool references rather than recurrence parseability. A typo can therefore validate successfully while silently omitting schedule items from the UI.

**Recommendation**: Prefer structured date/day fields or add validation that executes the supported recurrence parser with team-specific errors; add negative tests for unparseable published schedules.

### M2. Exercise New Schedule UI In Accessibility Gates

**Finding**: [accessibility.spec.js](../tests/browser/accessibility.spec.js) scans default home and team states, but it does not set a favorite team to expose the seven-day home agenda or expand a team with detailed practices. Workflow tests verify content rather than automated accessibility of those visible states.

**Recommendation**: Add light/dark axe scenarios for a visible favorite-team agenda and an expanded detailed-practice schedule, including meaningful loading or empty states introduced by that workflow.

### M3. Avoid Conditional Agenda Cost On Every Home Visit

**Finding**: [index.html](../src/views/index.html) always loads the teams, meets, data-manager, and schedule dependency chain, while [home-schedule.js](../src/js/home-schedule.js) hides the feature when the visitor has no favorite team. No home-route request or transfer budget currently captures this cost.

**Recommendation**: Move agenda acquisition behind a small conditional bootstrap or define and enforce an accepted home-route asset budget with measured evidence.

## Low Priority

### L1. Make Seasonal-Monitor Allowlisting Directly Testable

**Finding**: [season-data-monitor.yml](../.github/workflows/season-data-monitor.yml) protects annual structured data through inline shell allowlisting. Current monitoring unit coverage verifies discovered practice and calendar sources, but does not execute the workflow path-classification rule itself.

**Recommendation**: Extract the accepted-evidence path rule into a testable script or reusable validation command before broadening monitor behavior again.

## Pending Validation

| Check | Current Status | Required Outcome |
| --- | --- | --- |
| `pnpm run test:browser:smoke -- --workers=1` | Non-passing run is present in the current session. | Diagnose and pass affected browser interactions before release. |
| `pnpm run test:browser:ci` | A complete final run has not been recorded for the integrated change set. | All workflow and automated WCAG A/AA cases pass in one completed run. |
| HTTPS release walkthrough | Pending delivered-site evidence. | Record PWA lifecycle, keyboard/screen-reader, CSP, and analytics results using [release-checklist.md](release-checklist.md). |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; use reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Preserve the purpose-limited analytics boundary, PWA checks, and accessibility gates unless a separately reviewed decision changes them.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain documented secure-origin and assistive-technology review.
