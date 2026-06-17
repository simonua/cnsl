# CNSL Engineering Refactoring Plan

Review date: 2026-06-16

## Scope And Validation

The repository-wide audit reviewed changes since the 2026-06-10 audit together with current source, views, styles, build and validation scripts, package policy, GitHub workflows, browser-test organization, PWA delivery, accessibility boundaries, security hygiene, documentation, and performance. The review found no demonstrated accessibility barrier, data-integrity defect, security exposure, or material runtime failure that warrants high priority. Uncommitted seasonal-data edits appeared concurrently after validation and were not reviewed or modified as part of this refactoring audit.

Local validation completed on Windows ARM64 with Node.js 26.3.0. `pnpm run lint`, `pnpm test`, `pnpm run validate:data`, `pnpm run build`, `pnpm run verify:pwa`, and `pnpm audit --audit-level high` passed. Data validation covered 23 pools, 14 teams, 35 regular meets, 3 special meets, 26 retained official PDFs, and the lessons records present before the concurrent seasonal edits. The isolated five-sample `pnpm run measure:performance` benchmark completed with eight advisory warnings. Functional and accessibility Playwright verification was not run because this audit reserves it for the separate weekly browser-verification workflow.

Cold usable medians and spreads were Home 869 ms (666-5,383), Pools 1,509 ms (1,396-1,662), Teams 1,204 ms (1,075-1,434), Meets 911 ms (848-1,056), and My Meet Day 679 ms (629-718). Pools phase medians were 974 ms for primary data, 1,342 ms for visible summary, and 1,488 ms for optional enrichment. Every directory requested each annual data domain once. Installed first/repeat medians were Pools 865/774 ms, Teams 1,147/576 ms, and Meets 547/523 ms; all samples were worker-controlled and median transferred bytes were zero. The PWA inventory measured 106 resources / 3,163,595 bytes, split into 77 resources / 1,223,055 bytes install-critical and 29 resources / 1,940,540 bytes cache on use.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | No demonstrated high-priority refactoring defect | None | None |
| **ORANGE - Medium** | Reassess install-critical caching and directory first-load asset cost | Medium: lower install work and directory request/byte overhead while preserving offline behavior | Medium |
| **ORANGE - Medium** | Include pnpm workspace policy in deployment workflow triggers | Medium: ensure dependency-policy-only changes receive the deployment security and build gates | Low |
| **GREEN - Low** | Refresh recorded performance evidence after delivery work | Low: keep release decisions tied to current comparable measurements | Low |

## High Priority

No active high-priority findings are supported by the current repository evidence or local verification.

## Medium Priority

### 1. Reassess Install-Critical And First-Load Assets

**Finding:** The current delivery artifact exceeds all directory request and decoded-byte advisory budgets plus both install-critical PWA budgets. Route timing remains within budget and annual requests are deduplicated, so this is a measured optimization opportunity rather than a runtime incident. The install-critical classification currently includes every delivered JavaScript file, including scripts owned by cache-on-use routes.

**Repository evidence:**

- [posthtml.js](../posthtml.js) classifies every `.js` resource as install-critical while several HTML routes remain optional. The generated core contains 64 JavaScript files totaling 593,246 bytes.
- [scripts/measure-performance.js](../scripts/measure-performance.js) reported Pools at 59 requests / 971,707 decoded bytes, Teams at 52 / 1,130,594, and Meets at 49 / 856,947 against budgets of 55 / 900,000, 50 / 1,100,000, and 45 / 800,000 respectively.
- The same benchmark reported 77 install-critical resources / 1,223,055 bytes against advisory budgets of 75 resources / 1,200,000 bytes. The 2026-06-10 baseline in [docs/release-checklist.md](release-checklist.md) was 69 / 1,016,492.
- [src/views/lessons.html](../src/views/lessons.html) and [src/views/swim-meet-resources.html](../src/views/swim-meet-resources.html) demonstrate route-owned scripts whose pages are already cache-on-use resources.

**Scoped plan:**

1. Produce a deterministic route-to-script inventory from rendered views and the shared layout, including lazy dependencies and service-worker runtime dependencies.
2. Define an explicit install-critical contract around the offline shell and currently promised offline routes instead of inferring criticality from the `.js` extension alone.
3. Move only scripts proven unnecessary for install-critical routes to cache on use; preserve versioned cache keys, worker-update coherence, and current offline navigation fallbacks.
4. Profile the three directory routes before changing script loading. Remove duplicate or route-unneeded first-load dependencies only where the route inventory and browser coverage prove they are unnecessary; do not add bundling, speculative indexes, or new caching layers.
5. Keep warning budgets advisory and compare equivalent five-sample local runs. Add delivered-HTTPS evidence later through normal release review rather than an agent-controlled production visit.

**Acceptance checks:**

- Build validation proves every rendered route's dependency order is complete and the install-critical list contains every resource required by the documented offline shell.
- `pnpm run lint`, the exact affected unit-test files, `pnpm run build`, `pnpm run verify:pwa`, and the affected browser workflow/accessibility IDs pass after implementation; CI supplies complete unit and browser-suite coverage.
- `pnpm run measure:performance` records no regression in route usable medians, Pools phase order, annual-domain request counts, worker control, repeat navigation, or transferred bytes.
- The install-critical resource/byte totals and affected directory request/decoded-byte totals improve from this audit baseline, or the investigation records why each remaining warning represents an intentional offline or route dependency.
- Keyboard behavior, focus restoration, accessible loading state, and current offline commitments remain intact.

### 2. Cover pnpm Workspace Policy Changes In Deployment CI

**Finding:** The deployment workflow is path-filtered for `package.json` and `pnpm-lock.yaml`, but not `pnpm-workspace.yaml`. A workspace-policy-only security override or install-policy change can therefore reach `main` without triggering the workflow that runs frozen install, dependency audit, lint, unit tests, data validation, build, and PWA verification.

**Repository evidence:**

- [pnpm-workspace.yaml](../pnpm-workspace.yaml) now owns the `ws` security override and its minimum-release-age exception.
- [.github/workflows/build-deploy.yml](../.github/workflows/build-deploy.yml) runs the relevant dependency and build gates but omits `pnpm-workspace.yaml` from `on.push.paths`.
- The workspace policy was introduced in commit `228105b` alongside a lockfile change, so the current revision received CI; the gap affects future policy-only changes.

**Scoped plan:**

1. Add `pnpm-workspace.yaml` to the deployment workflow's path filter.
2. Review other root files that can change frozen-install resolution or supply-chain policy and add only those with a demonstrated effect.
3. Add a focused workflow-boundary assertion if an existing deterministic validation pattern can cover required dependency-policy paths without duplicating workflow semantics.

**Acceptance checks:**

- A pull request changing only `pnpm-workspace.yaml` shows the Build and Deploy workflow as triggered.
- The workflow completes frozen install, `pnpm audit --audit-level high`, lint, unit tests, data validation, build, and PWA verification.
- GitHub Actions remain SHA-pinned and workflow permissions remain least-privilege.

## Low Priority

### 1. Refresh The Recorded Performance Baseline

**Finding:** The row labeled "Current PWA cache tiers" in the release checklist still records the 2026-06-10 artifact at 97 resources / 2,877,025 bytes, while this audit measured 106 / 3,163,595 and eight warnings. Leaving the older row labeled current makes future performance comparisons ambiguous.

**Repository evidence:**

- [docs/release-checklist.md](release-checklist.md) records the older artifact as current and says it produced zero warnings.
- This audit recorded current route phases, sample spreads, directory request and byte totals, annual-domain request counts, worker control, PWA tiers, and warning count.

**Scoped plan:**

1. After the medium-priority delivery review is accepted, add a dated comparable five-sample measurement row and rename or retain older rows clearly as historical baselines.
2. Record the environment, route medians and spreads, Pools phases, annual-domain maxima, PWA tiers, and warning count in the established compact format.
3. Keep local and delivered-HTTPS evidence distinct and do not imply field-device or production validation from the isolated local run.

**Acceptance checks:**

- The newest recorded artifact is dated and no historical row is ambiguously labeled current.
- The row agrees with the complete `pnpm run measure:performance` output and notes every remaining advisory warning.
- Markdown lint passes for the updated documentation.

## Phased Roadmap

| Phase | Priority | Work | Prerequisites | Completion Evidence |
| --- | --- | --- | --- | --- |
| 1 | **ORANGE - Medium** | Add pnpm workspace policy to deployment triggers | None | Policy-only trigger proof and passing deployment gates |
| 2 | **ORANGE - Medium** | Inventory route dependencies and define the install-critical offline contract | Current PWA and route baseline | Reviewed inventory, offline contract, and scoped implementation decision |
| 3 | **ORANGE - Medium** | Implement only evidence-backed cache-tier or route-load reductions | Phase 2 decision | Complete unit, build, PWA, browser/WCAG, and performance evidence |
| 4 | **GREEN - Low** | Refresh the release-checklist performance record | Phase 3 outcome, or a documented decision to retain current delivery | Dated comparable baseline and clean Markdown lint |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring work. Seasonal sources require the annual-data workflow, live official-source review, recorded evidence, and human approval.
- Never edit `out/`; it is generated by `pnpm run build`.
- Preserve archived annual folders, retained official PDFs, source team logos, root verification files, and conventional deployment entry points.
- Preserve the PostHTML architecture, native DOM APIs, classic browser-script boundary, analytics privacy boundary, accessibility behavior, and current offline commitments unless measured evidence supports a separately reviewed decision.
- Derive cache tiers from explicit route and offline contracts. Do not make annual data unavailable offline, introduce duplicate requests, or weaken build-version coherence to reduce install totals.
- Keep performance budgets advisory until comparable local and delivered samples establish stable variance.
- Do not navigate an automated browser to production; collect delivered-site evidence through the approved human release review.

## Priority Summary

- **RED - High:** No actionable high-priority items are supported by current evidence.
- **ORANGE - Medium:** Reassess the all-JavaScript install-critical policy and directory first-load costs; include `pnpm-workspace.yaml` in deployment workflow triggers.
- **GREEN - Low:** Replace the ambiguously current June 10 performance record with a dated comparable baseline after delivery work is resolved.
