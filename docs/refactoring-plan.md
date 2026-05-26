# CNSL Engineering Refactoring Plan

Status: Orange and Green recommendations are implemented in the current working tree. An uninterrupted complete browser/accessibility gate rerun remains required before release.

Updated: 2026-05-26

## Scope And Current State

This assessment prioritized security, testability, maintainability, performance, and obsolete-asset removal. The implemented refactoring work now narrows seasonal automation write boundaries, removes retained annual PDF evidence from the published Pages artifact while preserving it in source control, tightens executable-script CSP policy, removes dormant search/voice presentation residue, and adds dependency and artifact-size drift gates.

Other active feature, content, analytics, and annual-data changes are present in the working tree and are preserved. Validation below describes the integrated current tree. The refactoring work does not delete or rewrite annual source evidence under `src/assets/data/`.

## Verification Status

| Check | Status | Evidence / Follow-Up |
| --- | --- | --- |
| `pnpm run lint` | GREEN - Passed | ESLint completed without findings after the CSP/build changes. |
| `pnpm test` | GREEN - Passed | `157` tests passed, `0` failed on the integrated tree. |
| `pnpm run validate:data` | GREEN - Passed | Active 2026 data validates with 23 pools, 14 teams, 35 regular meets, 3 special meets, and all 26 retained official PDFs. |
| `pnpm audit --audit-level high` | GREEN - Passed | Reported no known vulnerabilities; the Pages workflow now runs the same gate. |
| `pnpm run build` | GREEN - Passed | Generates 10 HTML pages and 57 precache resources; skips archived data, logo originals, and all three active annual evidence-PDF directories. |
| `pnpm run verify:pwa` | GREEN - Passed | Verifies CSP/hash requirements, publication boundaries, visitor resource PDFs, and an artifact of `1,494,487` bytes under the `2,500,000`-byte budget. |
| Focused browser replay | GREEN - Passed | The analytics routed-request cleanup passes; the previously timed-out pool/team accessibility and weather-navigation cases pass together (`5/5`). |
| Complete browser/accessibility gate | ORANGE - Rerun required | Two-worker runs encountered timeout/interruption noise and the attempted serial full rerun was cancelled before execution. Run `pnpm run test:browser:ci` uninterrupted before release. |

## Priority Matrix

| Priority | Recommendation | Implementation Status | Release Status |
| --- | --- | --- | --- |
| RED - High | No active high-priority finding was demonstrated in the assessed baseline. | No change required. | Continue existing release gates. |
| ORANGE - Medium | M1. Narrow seasonal-monitor change boundary. | GREEN - Implemented. | Review behavior when the next monitor PR is opened. |
| ORANGE - Medium | M2. Stop publishing retained annual evidence PDFs. | GREEN - Implemented and artifact-verified. | Complete. |
| ORANGE - Medium | M3. Tighten executable-script CSP. | GREEN - Implemented and artifact-verified. | Perform secure-origin CSP console review during release. |
| GREEN - Low | L1. Remove dormant search/voice styling and obsolete logo asset. | GREEN - Implemented. | Complete after final browser gate rerun. |
| GREEN - Low | L2. Make dependency and artifact drift visible. | GREEN - Implemented and baseline recorded. | Complete. |

## Implemented Medium Work

### M1. Seasonal Monitor Boundary

**Resolution**: [season-data-monitor.yml](../.github/workflows/season-data-monitor.yml) now validates the detected season, rejects any active annual-data diff outside approved official PDF evidence directories, and stages only monitor state/report output plus allowlisted changed PDF files. Annual JSON, schemas, and the annual README cannot be silently staged by the monitoring job.

**Preserved boundary**: Monitor reports can still prompt human transcription and source-check updates. `pnpm run validate:data` remains the release gate for accepted annual structured data.

### M2. Retained Evidence Versus Published Assets

**Resolution**: [posthtml.js](../posthtml.js) excludes the active season's `pool-schedules/`, `meet-schedules/`, and `team-schedules/` evidence directories from generated output. [file-helper.js](../src/js/services/file-helper.js) no longer exposes a public local-path API for those omitted PDFs, and [annual-season-assets.md](annual-season-assets.md) documents that visitor schedule links use reviewed official HTTPS destinations.

**Verified outcome**: [verify-pwa-build.js](../scripts/verify-pwa-build.js) rejects publication of the retained annual evidence folders and requires all three deliberate visitor-facing swim-meet resource PDFs to remain in the artifact. Source validation still confirms all 26 retained official PDFs.

### M3. Content-Security Policy Tightening

**Resolution**: [header.html](../src/views/components/header.html) loads the cached-weather early renderer from the same-origin [weather-alert-cached.js](../src/js/weather-alert-cached.js) asset instead of an executable inline block. [base.html](../src/views/layouts/base.html) removes `script-src 'unsafe-inline'`; the build generates SHA-256 permissions only for inline `application/ld+json` structured metadata and fails if a future inline executable script is introduced.

**Documented remaining constraint**: [security-privacy.md](security-privacy.md) retains `style-src 'unsafe-inline'` because supported navigation offsets, date-picker positioning, and status presentation still apply controlled runtime styles. Removing that allowance is a future class/state refactor, not part of this pass.

## Implemented Low Work

### L1. Dormant Asset And Style Cleanup

**Resolution**: The unreferenced `src/assets/images/cnsl-logo-230x230.jpg` asset has been removed. Unowned `.copilot-search`, `.copilot-response`, search-results, and voice-button style blocks were removed from [styles.css](../src/css/styles.css); active `.btn-secondary` visitor download styling and concurrent supported feature styling were retained.

**Remaining asset decision**: Keep `src/assets/images/logos/originals/`; they are excluded from published output and may remain useful sprite-authoring sources until explicitly retired.

### L2. Drift Visibility

**Resolution**: [build-deploy.yml](../.github/workflows/build-deploy.yml) gates deployment on `pnpm audit --audit-level high`. [verify-pwa-build.js](../scripts/verify-pwa-build.js) reports total generated artifact bytes and fails above the `2,500,000`-byte budget. [release-checklist.md](release-checklist.md) records the current verified baseline of `1,494,487` bytes.

## Remaining Release Actions

| Action | Reason | Completion Evidence |
| --- | --- | --- |
| Rerun `pnpm run test:browser:ci` without interruption. | A complete final browser/accessibility run did not finish after the integrated changes, although targeted affected cases passed. | All workflow and automated WCAG A/AA cases pass in one completed run. |
| Perform the HTTPS release walkthrough in [release-checklist.md](release-checklist.md). | Service worker lifecycle, analytics delivery, CSP console behavior, and screen-reader evidence require a secure delivered origin. | Release record includes PWA, CSP/analytics, keyboard, and screen-reader results. |

## Guardrails

- Do not edit, delete, regenerate, or mechanically rewrite annual JSON, schemas, READMEs, or official PDFs under `src/assets/data/` as part of general refactoring; use reviewed seasonal work.
- Do not edit `out/`; it is generated build output. Publication reductions must remain enforced through build logic and verifier assertions.
- Preserve the PostHTML static-site architecture, output-encoding rules, purpose-limited analytics boundary, PWA checks, and accessibility gates unless a separately reviewed decision changes them.
- Do not claim deployed security or full accessibility conformance from local automation alone; retain documented secure-origin and assistive-technology review.
