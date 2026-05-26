# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved. No high-priority recommendations remain open.

Updated: 2026-05-26

## Scope

This living backlog contains only actionable refactoring findings from the current integrated tree. It prioritizes seasonal-data reliability, accessibility validation, maintainability, and visitor-facing performance. Completed implementation evidence belongs in release records and focused design documentation rather than this backlog.

## Priority Matrix

| Priority | Recommendation | Impact | Effort | Exit Criterion |
| --- | --- | --- | --- | --- |
| ORANGE - Medium | M1. Validate detailed practice recurrence as renderable data. | A source typo can pass validation while hiding schedule entries. | Medium | Invalid recurrence input fails validation with team-specific context and has negative tests. |
| ORANGE - Medium | M2. Exercise new schedule experiences in accessibility gates. | The agenda and expanded practice UI can regress outside axe coverage. | Low-Medium | Light/dark automated checks cover visible agenda and detailed-practice states. |
| GREEN - Low | L1. Make seasonal-monitor evidence allowlisting directly testable. | Future workflow changes could weaken protected-data boundaries unnoticed. | Low | The accepted-path rule runs through a focused automated test or reusable validation command. |

## Medium Priority

### M1. Validate Practice Recurrence As Renderable Data

**Finding**: [team-schedule-service.js](../src/js/services/team-schedule-service.js) interprets human-readable periods and weekday expressions, but the detailed-practice schema accepts schedule fields as non-empty strings and [validate-season-data.js](../scripts/validate-season-data.js) validates practice URLs and pool references rather than recurrence parseability. A typo can therefore validate successfully while silently omitting schedule items from the UI.

**Recommendation**: Prefer structured date/day fields or add validation that executes the supported recurrence parser with team-specific errors; add negative tests for unparseable published schedules.

### M2. Exercise New Schedule UI In Accessibility Gates

**Finding**: [accessibility.spec.js](../tests/browser/accessibility.spec.js) scans default home and team states, but it does not set a favorite team to expose the seven-day home agenda or expand a team with detailed practices. Workflow tests verify content rather than automated accessibility of those visible states.

**Recommendation**: Add light/dark axe scenarios for a visible favorite-team agenda and an expanded detailed-practice schedule, including meaningful loading or empty states introduced by that workflow.

## Low Priority

### L1. Make Seasonal-Monitor Allowlisting Directly Testable

**Finding**: [season-data-monitor.yml](../.github/workflows/season-data-monitor.yml) protects annual structured data through inline shell allowlisting. Current monitoring unit coverage verifies discovered practice and calendar sources, but does not execute the workflow path-classification rule itself.

**Recommendation**: Extract the accepted-evidence path rule into a testable script or reusable validation command before broadening monitor behavior again.

## Pending Validation

| Check | Current Status | Required Outcome |
| --- | --- | --- |
| `pnpm run test:browser` | The weather-alert-off scenario currently fails because an active banner remains visible after selecting Off. | Diagnose and pass the weather interaction before release. |
| `pnpm run test:browser:ci` | A complete final run has not been recorded for the integrated change set. | All workflow and automated WCAG A/AA cases pass in one completed run. |
| HTTPS release walkthrough | Pending delivered-site evidence. | Record PWA lifecycle, keyboard/screen-reader, CSP, and analytics results using [release-checklist.md](release-checklist.md). |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; use reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Preserve the purpose-limited analytics boundary, PWA checks, and accessibility gates unless a separately reviewed decision changes them.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain documented secure-origin and assistive-technology review.
