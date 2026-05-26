# CNSL Engineering Refactoring Plan

Status: Active recommendations only. Completed or closed items are removed when resolved. No active refactoring recommendations remain open.

Updated: 2026-05-26

## Scope

This living backlog contains only actionable refactoring findings from the current integrated tree. It prioritizes seasonal-data reliability, accessibility validation, maintainability, and visitor-facing performance. Completed implementation evidence belongs in release records and focused design documentation rather than this backlog.

## Priority Matrix

No open refactoring recommendations remain from the current review.

## Pending Validation

| Check | Current Status | Required Outcome |
| --- | --- | --- |
| HTTPS release walkthrough | Pending delivered-site evidence. | Record PWA lifecycle, keyboard/screen-reader, CSP, and analytics results using [release-checklist.md](release-checklist.md). |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; use reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Preserve the purpose-limited analytics boundary, PWA checks, and accessibility gates unless a separately reviewed decision changes them.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain documented secure-origin and assistive-technology review.
