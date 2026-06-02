# CNSL Engineering Refactoring Plan

Status: No active recommendations. Completed or closed items are removed when resolved.

Audit date: 2026-06-02

## Scope And Validation

This reassessment reviewed the current working tree after the semantic schedule, purpose-limited external-link analytics, and browser-state refactors. The evidence pass inspected the affected schedule expansion and agenda rendering pipeline, analytics allowlists and published metadata, pool status filtering, favorite-card persistence, navigation state, delegated pool, team, and meet disclosure hooks, PWA verifier assertions, and focused unit and browser regression coverage. No application code, tests, annual source data, generated output, or other documentation was changed during this reassessment.

The primary implementation session supplied the completed automated validation results below. `git diff --check` was also rerun during this documentation refresh.

| Validation | Result | Evidence Recorded During Reassessment |
| --- | --- | --- |
| `pnpm run lint` | Passed | ESLint completed without diagnostics. |
| `pnpm test` | Passed | 430 tests passed. |
| `pnpm run validate:data` | Passed | Active 2026 data validated: 23 pools, 14 teams, 35 regular meets, 3 special meets, and 26 PDFs. |
| `pnpm run build` | Passed | Ten HTML pages and 75 resources built. |
| `pnpm run verify:pwa` | Passed | Verified 75 cached resources and a 1,736,888-byte generated artifact. |
| `pnpm run test:browser:nightly` | Passed | Serialized Playwright workflow and WCAG checks passed: 94 tests passed. |
| `git diff --check` | Passed | The current working-tree patch contains no whitespace errors. |

## Active Recommendations

No active recommendations are supported by the current repository evidence. The reassessed refactors satisfy the previously identified semantic-state, analytics-boundary, and delegated-interaction concerns, and the supplied validation evidence does not demonstrate a new maintainability, accessibility, data-integrity, PWA, delivery, testing, CI, security, privacy, performance, or documentation-drift finding that warrants backlog work.

## Manual Delivered-HTTPS Residual Checks

Local automation does not establish secure-origin behavior on the delivered site. Preserve the published-site walkthrough in [release-checklist.md](release-checklist.md), including installed-PWA lifecycle, keyboard and screen-reader behavior, CSP console review, analytics request review, and occasional browser performance measurements.

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Drive filtering, state transitions, interaction decisions, accessibility state, and analytics categorization from domain values or explicit semantic properties; map semantics to labels, icons, classes, and colors only at the rendering boundary.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, and accessibility gates while refactoring display state.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.
