---
name: cnsl-site-verification
description: "Use when verifying CNSL build, PostHTML, CSS, JavaScript, data, PWA, workflow, or browser-facing changes; selecting focused checks; reusing the BrowserSync site on port 3100; performing local accessibility and interaction checks; or assessing release readiness."
argument-hint: "Describe the changed files or behavior to verify."
---

# CNSL Site Verification

Select the lowest verification class that covers the changed behavior. Escalate when a change crosses classes or its blast radius is uncertain. Follow the repository-wide verification boundaries in [`copilot-instructions.md`](../../copilot-instructions.md), the command and server rules in [`build.instructions.md`](../../instructions/build.instructions.md), and the test-selection rules in [`testing.instructions.md`](../../instructions/testing.instructions.md). This skill selects and reports the scope; those instructions remain authoritative for command details.

## Verification Classes

| Class | Typical changes | Required scope |
| --- | --- | --- |
| 0: Non-executable | Documentation, customization, audit-report, or comment-only edits | Inspect diagnostics, validate links or frontmatter, run focused Markdown validation when applicable, and run `git diff --check`. Do not run application tests. |
| 1: Generated content or data | Copy-only HTML, metadata, structured data, annual records, schemas, or static assets without browser behavior risk | Run the affected validator and `pnpm run build`; inspect the generated artifact. Follow the annual-data workflow for seasonal source changes. Add `pnpm run verify:pwa` when publication, cache inventory, metadata, or offline availability can change. |
| 2: Isolated logic or build contract | Browser JavaScript testable without rendering, services, models, managers, types, build helpers, configuration, service-worker logic, or deterministic test changes | Run the exact affected unit tests and required lint/build/PWA gates. Collect focused coverage only when required for changed delivered modules. Do not run Playwright unless the behavior depends on a browser. |
| 3: Browser-scoped | Layout, responsive behavior, semantics, focus, keyboard interaction, color, rendering, navigation, first paint, or browser-only integration | Run `pnpm run build`, required lint or domain checks, and the exact affected Playwright workflow or accessibility IDs through `scripts/run-playwright.js`. Inspect the affected local BrowserSync states when visual or interactive evidence is needed. |
| 4: Release or cross-cutting gate | Release readiness, shared browser/build infrastructure, broad dependency changes, privacy or analytics boundaries, PWA lifecycle, or changes with an uncertain cross-module blast radius | Follow [`docs/release-checklist.md`](../../../docs/release-checklist.md), including all required non-test gates and explicitly named affected unit and browser IDs. Complete suites remain CI-owned unless the user explicitly requests them. |

A shared file path does not automatically require Class 4. Classify the observable behavior and affected contracts.

## Procedure

1. Inspect the changed behavior and assign a verification class.
2. Identify every changed delivered module, generated artifact, trust boundary, and materially different browser path.
3. Select the narrowest complete tests by file or stable browser ID. Do not add a full-suite run after focused checks pass.
4. Run applicable domain checks before browser work: lint for executable JavaScript, annual-data validation for represented data, PWA verification for cache or publication changes, and performance measurement only when the repository performance rule requires it.
5. Build before inspecting generated output or running browser workflows.
6. For focused Playwright, first inspect active test processes and the configured runner port. Use `node scripts/run-playwright.js test <spec> --grep "<stable IDs>"`. If its default port `4173` belongs to another process, select a free runner port with `CNSL_PLAYWRIGHT_PORT`; do not stop the unrelated process.
7. For local browser inspection, check the recorded VS Code task and operating-system process, confirm port `3100` is listening, and request `http://localhost:3100/`. Reuse a healthy existing `CNSL: Start Development Server` BrowserSync session and leave it running. Do not start a second inspection server. If the recorded server is unhealthy, inspect and recover that shared task before opening a page.
8. Keep browser automation headless unless the user explicitly requests visible inspection. Inspect only the local built site; never navigate an agent-controlled browser to the production origin unless the user explicitly authorizes the resulting traffic record.
9. Check affected states for overflow, missing assets, console errors, keyboard operation, visible focus, semantic accessibility, and responsive layout. Run the exact affected automated accessibility IDs when semantics, interaction, layout, or color changes can alter accessibility.
10. For color changes, verify WCAG 2.0 Level AA contrast in every affected light, dark, high-contrast, hover, focus, selected, and disabled state.
11. Run `git diff --check`. Verify UTF-8, LF line endings, and exactly one final LF for changed text files when an editing or generation tool could violate the repository byte contract.
12. Review the final diff without reverting unrelated working-tree changes.

## Browser Server Boundary

BrowserSync on port `3100` is the shared interactive development site. Reuse it for page inspection and do not stop it when verification finishes.

The serialized Playwright runner owns a separate isolated server, normally on port `4173`. An alternate runner port does not replace BrowserSync and is not the URL for ordinary inspection. Report both URLs when both were used so the distinction is clear.

## Completion Report

Report:

- the selected class and why it covered the change;
- every exact command, test file, and stable browser ID executed;
- whether BrowserSync at `http://localhost:3100/` was reused, recovered, or unnecessary;
- the pages, viewports, themes, interaction states, and accessibility states actually inspected;
- what passed and any unavailable, manual, HTTPS-only, production-only, or CI-owned checks still outstanding.

Do not claim full visual, accessibility, PWA, analytics, or release conformance beyond the evidence gathered. State explicitly when Playwright or browser inspection was intentionally unnecessary.
