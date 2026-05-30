# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved.

Audit date: 2026-05-30

## Scope And Validation

This audit reviewed the current `main` tree for maintainability, accessibility boundaries, seasonal-data integrity, PWA and delivery behavior, testing and CI coverage, security and privacy hygiene, performance risk, and documentation drift. Focused evidence included the annual-data validator, PostHTML/PWA artifact verification, shared CSP and privacy documentation, deploy and nightly browser workflows, dynamic HTML safety boundaries, and pool schedule status rendering.

| Validation | Result | Evidence Recorded During Audit |
| --- | --- | --- |
| `pnpm run lint` | Passed | ESLint completed without diagnostics. |
| `pnpm test` | Passed | 405 tests passed; 0 failed, cancelled, skipped, or todo. |
| `pnpm run validate:data` | Passed | Active 2026 data validated: 23 pools, 14 teams, 35 regular meets, 3 special meets, and 26 retained official PDFs. |
| `pnpm run build` | Passed | Ten HTML pages built; archived 2025 data and retained 2026 annual evidence PDF directories were excluded from generated output. |
| `pnpm run verify:pwa` | Passed | Verified 69 cached resources and a 1,689,621-byte generated artifact for the 2026 season. |
| Playwright accessibility and workflow checks | Not run in this audit | By repository policy these run only through the separate nightly browser-verification workflow after repository updates or manual dispatch. |

Pending manual validation remains the delivered-site HTTPS walkthrough in [release-checklist.md](release-checklist.md), including PWA lifecycle, keyboard and screen-reader behavior, CSP console review, and analytics request review. No current audit evidence demonstrates a high-priority accessibility, security, release, or data-integrity defect.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| RED - High | No actionable high-priority finding supported by current evidence. | No demonstrated material failure requiring immediate remediation. | Not applicable |
| ORANGE - Medium | M1. Complete semantic status adoption in pool schedule presentation. | Label or theme changes can silently alter schedule tinting or supporting practice detail even when validated access semantics are unchanged. | Medium |
| GREEN - Low | No actionable low-priority finding supported by current evidence. | Documentation and release follow-up currently remain tracked through existing checklists. | Not applicable |

## High Priority

No active high-priority recommendation is supported by this audit. Annual data validation, build publication restrictions, CSP and analytics artifact assertions, and the prescribed local test gates passed; delivered-site checks remain pending rather than presumed complete.

## Medium Priority

### M1. Complete Semantic Status Adoption In Pool Schedule Presentation

**Finding:** Pool schedule rendering retains presentation-derived interpretation after the data and model layers adopted semantic public-access status. Display behavior and supporting text should not depend on an activity label or a color token when a semantic status is already present.

**Repository evidence:**

- The active season schema requires `accessStatus` for schedule entries and defines its semantic values independently of visible schedule labels in [src/assets/data/2026/pools/pools.schema.json](../src/assets/data/2026/pools/pools.schema.json#L190-L227) and [src/assets/data/2026/pools/pools.schema.json](../src/assets/data/2026/pools/pools.schema.json#L337-L360).
- The model correctly resolves access behavior from `slot.accessStatus` in [src/js/models/pool.js](../src/js/models/pool.js#L418-L465), with regression evidence that conflicting visible labels do not change model status in [tests/models/pool.test.js](../tests/models/pool.test.js#L285-L311).
- The route controller still obtains tooltip copy from a color value and resolves detailed practice-team names only when the displayed activity array contains the literal `CNSL Practice Only` label in [src/js/pool-browser.js](../src/js/pool-browser.js#L93-L108) and [src/js/pool-browser.js](../src/js/pool-browser.js#L361-L380).
- The schedule display service categorizes activity styling by regular expressions over formatted activity text, and current unit tests encode that label-based mapping, in [src/js/services/pool-schedule-display.js](../src/js/services/pool-schedule-display.js#L157-L218) and [tests/services/pool-schedule-display.test.js](../tests/services/pool-schedule-display.test.js#L81-L88).

**Scoped plan:**

1. Define or expose a stable semantic schedule/status key at the model-to-display boundary using the existing `accessStatus` contract; keep CSS color and visible wording as output mappings only.
2. Update pool card status tooltip generation, schedule activity category selection, and practice-team detail inclusion to consume semantic status rather than `color` or literal activity text.
3. Preserve official activity labels as display content and do not rewrite active or archived annual source data as part of this refactor.
4. Extend focused unit tests with deliberately differing label and `accessStatus` values, then retain browser workflow coverage for practice-only availability and live status updates.

**Acceptance checks:**

- A schedule entry with `accessStatus: 'practice-only'` displays the appropriate practice treatment and resolved team detail even when its visible `types` label changes; a misleading label cannot override a different `accessStatus`.
- Status tooltip and activity styling tests assert semantic inputs and presentation outputs without requiring business decisions to branch on color or visible labels.
- `pnpm run lint`, `pnpm test`, `pnpm run validate:data`, `pnpm run build`, and `pnpm run verify:pwa` pass after implementation without changes under `src/assets/data/`.
- The next eligible nightly `pnpm run test:browser:nightly` run confirms the affected pools workflows and automated accessibility coverage after implementation reaches `main`.

## Low Priority

No active low-priority recommendation is supported by this audit. The outstanding HTTPS release walkthrough is a required operational verification step already maintained in [release-checklist.md](release-checklist.md), not evidence of a refactoring defect.

## Phased Roadmap

| Phase | Priority | Work | Prerequisites | Exit Evidence |
| --- | --- | --- | --- | --- |
| 1 | ORANGE - Medium | Implement M1 semantic status propagation and focused regressions for label/status disagreement. | Preserve the existing schema contract and current PostHTML/native JavaScript architecture. | Focused tests plus lint, unit, data, build, and PWA checks pass. |
| 2 | Operational verification | Observe the nightly browser accessibility/workflow execution and complete delivered-site checks when the change is released. | M1 merged and deployed through the normal delivery gate. | Nightly result and HTTPS PWA, assistive-technology, CSP, and analytics evidence recorded through the release process. |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, and accessibility gates while refactoring display state.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.

## Priority Summary

**RED - High:** No actionable high-priority items are supported by current evidence.

**ORANGE - Medium:** M1 should finish the semantic `accessStatus` boundary so pool schedule presentation and supporting practice details are independent of visible labels and color tokens.

**GREEN - Low:** No actionable low-priority items are supported by current evidence; retain the existing delivered-site manual validation checkpoint.
