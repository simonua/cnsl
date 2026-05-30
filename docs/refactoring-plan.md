# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved.

Audit date: 2026-05-30

## Scope And Validation

This review examined the current tree for maintainability, accessibility boundaries, seasonal-data integrity, PWA and delivery behavior, testing and CI coverage, security and privacy hygiene, performance risk, and documentation drift. Focused evidence included the annual-data validator, PostHTML/PWA artifact verification, shared CSP and privacy documentation, deploy and nightly browser workflows, dynamic HTML safety boundaries, and semantic pool schedule status rendering.

| Validation | Result | Evidence Recorded During Audit |
| --- | --- | --- |
| `pnpm run lint` | Passed | ESLint completed without diagnostics. |
| `pnpm test` | Passed | 406 tests passed; 0 failed, cancelled, skipped, or todo. |
| `pnpm run validate:data` | Passed | Active 2026 data validated: 23 pools, 14 teams, 35 regular meets, 3 special meets, and 26 retained official PDFs. |
| `pnpm run build` | Passed | Ten HTML pages built; archived 2025 data and retained 2026 annual evidence PDF directories were excluded from generated output. |
| `pnpm run verify:pwa` | Passed | Verified 69 cached resources and a 1,690,030-byte generated artifact for the 2026 season. |
| Playwright accessibility and workflow checks | Passed | `pnpm run test:browser:nightly --workers=1` passed all 85 workflow and WCAG checks after correcting the M1 regression assertion and avoiding the earlier parallel local timeout cluster. |

Pending manual validation remains the delivered-site HTTPS walkthrough in [release-checklist.md](release-checklist.md), including PWA lifecycle, keyboard and screen-reader behavior, CSP console review, and analytics request review. No current audit evidence demonstrates a high-priority accessibility, security, release, or data-integrity defect.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| RED - High | No actionable high-priority finding supported by current evidence. | No demonstrated material failure requiring immediate remediation. | Not applicable |
| ORANGE - Medium | No actionable medium-priority finding supported by current evidence. | No demonstrated semantic presentation drift requiring further refactoring. | Not applicable |
| GREEN - Low | No actionable low-priority finding supported by current evidence. | Documentation and release follow-up currently remain tracked through existing checklists. | Not applicable |

## High Priority

No active high-priority recommendation is supported by this audit. Annual data validation, build publication restrictions, CSP and analytics artifact assertions, and the prescribed local test gates passed; delivered-site checks remain pending rather than presumed complete.

## Medium Priority

No active medium-priority recommendation is supported by this review. Pool schedule status messaging, practice-team detail inclusion, and activity color categories now consume semantic status at the presentation boundary; the annual source data remains unchanged.

## Low Priority

No active low-priority recommendation is supported by this audit. The outstanding HTTPS release walkthrough is a required operational verification step already maintained in [release-checklist.md](release-checklist.md), not evidence of a refactoring defect.

## Phased Roadmap

No active refactoring phase remains. Retain the delivered-site checks in [release-checklist.md](release-checklist.md) when repository changes are published.

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, and accessibility gates while refactoring display state.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.

## Priority Summary

**RED - High:** No actionable high-priority items are supported by current evidence.

**ORANGE - Medium:** No actionable medium-priority items are supported by current evidence.

**GREEN - Low:** No actionable low-priority items are supported by current evidence; retain the existing delivered-site manual validation checkpoint.
