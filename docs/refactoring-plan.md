# CNSL Engineering Refactoring Plan

Status: Active recommendations. Completed or closed items are removed when resolved.

Audit date: 2026-06-02

## Scope And Validation

This plan retains only actionable recommendations. The 2026-06-02 implementation pass extracted pool period-schedule projection into a DOM-free service, reduced pool-calendar interaction handling to a dedicated browser adapter, moved time-slot highlight markup ownership out of `TimeUtils`, and aligned expanded team agendas to a readable desktop width. Completed recommendations are removed instead of retained as implementation history.

The clean local artifact baseline has also been refreshed in [release-checklist.md](release-checklist.md#L65). Delivered-HTTPS PWA lifecycle, keyboard and screen-reader behavior, CSP console review, analytics request review, and browser performance measurements remain pending manual release checks.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| 🔴 High | No demonstrated high-priority finding | - | - |
| 🟠 Medium | No open medium-priority recommendation | - | - |
| 🟢 Low | L1. Record delivered HTTPS performance measurements | Low | Low |

## High Priority

No demonstrated accessibility barrier, release or annual-data integrity risk, security exposure, or current runtime defect warrants a high-priority refactor. Preserve the manual delivered-HTTPS checks because local automation does not establish secure-origin behavior or full accessibility conformance.

## Medium Priority

No medium-priority recommendation remains open after the 2026-06-02 implementation pass.

## Low Priority

### L1. Record Delivered HTTPS Performance Measurements

- **Finding:** The generated PWA artifact baseline is current, but delivered render-completion and request measurements remain pending. This is monitoring follow-up rather than a demonstrated runtime regression.
- **Repository evidence:** The current clean `pnpm run verify:pwa` result is 78 cached resources and 1,791,640 bytes. Delivered directory render completion and first-view request measurements remain pending at [release-checklist.md](release-checklist.md#L66) and [release-checklist.md](release-checklist.md#L67).
- **Scoped plan:** During the next qualifying delivered-HTTPS review, record browser measurements for Home, Pools, Teams, and Meets. Compare transfer size, cache behavior, and usable render completion before proposing asset optimization. Treat annual source documents and active-season data as protected inputs; any optimization proposal must preserve reviewed source evidence and public behavior.
- **Acceptance checks:** Record the clean-build artifact size, browser and network environment, first-view request count and transfer size, directory usable-render completion, and any follow-up budget decision in the release record or checklist. Do not edit generated `out/` files or annual source assets as a measurement shortcut.

## Phased Roadmap

| Phase | Work | Risk And Prerequisites | Completion Evidence |
| --- | --- | --- | --- |
| 1. Record delivered measurements | L1. Record delivered HTTPS performance measurements | Perform on a qualifying HTTPS release or preview. | Delivered browser measurements and a recorded budget decision. |

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
- **🟢 Low:** Record delivered HTTPS browser performance measurements during the next qualifying release or preview review.
