# CNSL Engineering Refactoring Plan

Status: Active recommendations. Completed or closed items are removed when resolved.

Audit date: 2026-06-02

## Scope And Validation

This plan retains only actionable recommendations. The 2026-06-02 implementation pass extracted pool period-schedule projection into a DOM-free service, reduced pool-calendar interaction handling to a dedicated browser adapter, moved time-slot highlight markup ownership out of `TimeUtils`, and aligned expanded team agendas to a readable desktop width. Completed recommendations are removed instead of retained as implementation history.

The clean local artifact baseline and delivered HTTPS browser performance measurements have also been recorded in [release-checklist.md](release-checklist.md#L65). Delivered-HTTPS PWA lifecycle, keyboard and screen-reader behavior, CSP console review, and analytics request review remain pending manual release checks.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| 🔴 High | No demonstrated high-priority finding | - | - |
| 🟠 Medium | No open medium-priority recommendation | - | - |
| 🟢 Low | No open low-priority recommendation | - | - |

## High Priority

No demonstrated accessibility barrier, release or annual-data integrity risk, security exposure, or current runtime defect warrants a high-priority refactor. Preserve the manual delivered-HTTPS checks because local automation does not establish secure-origin behavior or full accessibility conformance.

## Medium Priority

No medium-priority recommendation remains open after the 2026-06-02 implementation pass.

## Low Priority

No low-priority recommendation remains open after recording the initial delivered HTTPS browser performance baseline.

## Phased Roadmap

No active refactoring phases remain.

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; annual source data requires reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication boundaries remain enforced through build logic and verifier assertions.
- Keep the PostHTML static-site, single delivered stylesheet, and native DOM architecture unless a separately reviewed decision is justified by measured need.
- Drive filtering, state transitions, interaction decisions, accessibility state, and analytics categorization from domain values or explicit semantic properties; map semantics to labels, icons, classes, and colors only at the rendering boundary.
- Preserve purpose-limited analytics, CSP checks, PWA artifact checks, accessibility gates, and pinned workflow actions while refactoring display state.
- Run focused checks while iterating on delivered code, then run the required complete automated gate and serialized `pnpm run test:browser:nightly` completion gate for significant refactors.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain secure-origin and assistive-technology review in the release process.

## Priority Summary

- **🔴 High:** No demonstrated high-priority finding.
- **🟠 Medium:** No open medium-priority recommendation.
- **🟢 Low:** No open low-priority recommendation.
