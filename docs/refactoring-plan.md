# CNSL Engineering Refactoring Plan

Review date: 2026-06-10

## Scope

The repository-wide audit reviewed source, views, styles, assets, annual-data organization, tests, scripts, package and editor configuration, GitHub workflows and retained automation support, documentation, PWA delivery, accessibility boundaries, security hygiene, and performance. Completed work is removed from this plan so it remains an actionable backlog.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | Align seasonal-source documentation with the mandatory live review workflow | High | Low |
| **ORANGE - Medium** | Remove proven unused browser helpers and their residual configuration/styles | Medium | Low |

## High Priority

### Align Seasonal-Source Documentation With The Mandatory Live Review Workflow

**Finding:** The root contributor guidance calls seasonal-source monitoring retired and directs annual changes to local schema validation, but current repository instructions require every seasonal-source review to begin with live `pnpm run check:data-updates` requests, reconcile all official source coverage, record successful completion, and refresh the reviewed baseline. This contradiction can cause a maintainer to substitute offline validation for required current-source evidence.

**Repository evidence:**

- [README.md](../README.md) states that automated seasonal-source monitoring is retired and mentions only `pnpm run validate:data` in its annual-data workflow.
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) defines live source requests, review timestamps, check-log evidence, and baseline initialization as critical requirements.
- [.github/automation/season-data-monitor/README.md](../.github/automation/season-data-monitor/README.md) distinguishes the retired scheduled GitHub workflow from the supported deliberate local monitor and documents `pnpm run check:data-updates`.
- [package.json](../package.json) exposes `check:data-updates`, while [scripts/season-data-agent.js](../scripts/season-data-agent.js), its reviewed state, and its unit tests remain active.

**Scoped plan:** Rewrite the README wording to say that only the scheduled GitHub Actions monitor is retired. Document the mandatory deliberate local source-review command, live coverage reconciliation, check-log and timestamp evidence, and the separate role of `validate:data`. Link to the detailed operational contract in the existing automation README rather than duplicating every step.

**Acceptance checks:**

- README guidance no longer describes the local source-review capability itself as retired.
- README guidance does not imply that `validate:data` proves online source currency.
- The documented command and evidence steps agree with the critical repository instructions and seasonal-monitor README.
- Focused Markdown lint passes.

## Medium Priority

### Remove Proven Unused Browser Helpers And Residual Surface

**Finding:** Three delivered route scripts retain helper paths with no tracked caller. They are explicitly lint-suppressed or labeled compatibility code, increasing shipped bytes and preserving misleading APIs. Exact symbol checks found declarations only for `generateTeamLink` and `generateWeatherDisplay`; `getWeatherIcon` is reachable only from the dead weather renderer; the route-level `isPoolOpen` wrapper has no caller. These are distinct from the live `PoolSchedule.isPoolOpen` model method.

**Repository evidence:**

- [src/js/teams-browser.js](../src/js/teams-browser.js) declares lint-suppressed `generateTeamLink`, with no other tracked occurrence.
- [src/js/meets-browser.js](../src/js/meets-browser.js) declares lint-suppressed `generateWeatherDisplay`; its `getWeatherIcon` helper is called only by that renderer. Live meet-card weather markup uses `weather-info` and `weather-temp` directly.
- [src/js/pool-browser.js](../src/js/pool-browser.js) labels `isPoolOpen` a compatibility wrapper and suppresses its unused-variable warning; no tracked caller exists.
- [eslint.config.js](../eslint.config.js) still declares route-level `getPoolStatus` and `isPoolOpen` globals even though templates and scripts do not consume them.
- [src/css/styles.css](../src/css/styles.css) retains `weather-icon`, `weather-condition`, and `weather-wind` selectors used only by the dead renderer. `weather-info`, `weather-temp`, and their color custom property remain live and must stay.
- [src/js/services/icon-catalog.js](../src/js/services/icon-catalog.js) has weather glyphs mostly reachable only through the dead helper, but `weatherStorm` remains live in [src/js/weather-alert-display.js](../src/js/weather-alert-display.js); icon cleanup must therefore be key-specific.

**Scoped plan:** Remove `generateTeamLink`, route-level `isPoolOpen`, `generateWeatherDisplay`, and `getWeatherIcon`. Remove only globals, CSS selectors, icon keys, and tests proven to become unreferenced after those deletions. Preserve live model methods, status rendering, meet temperature markup, weather-alert glyphs, and shared CSS tokens. Do not combine this cleanup with route-controller extraction unless separate duplication or change-pressure evidence emerges.

**Acceptance checks:**

- Exact symbol searches return no obsolete helper declarations or stale ESLint globals.
- The browser JavaScript validator and `pnpm run lint` pass without replacement suppressions.
- `pnpm run test:coverage` retains 100% line, branch, and function coverage for delivered JavaScript.
- `pnpm run build` and `pnpm run verify:pwa` pass; meet temperature and pool status output remain unchanged.

## Roadmap

| Phase | Work | Completion evidence |
| --- | --- | --- |
| 1 | Correct seasonal-source contributor guidance | Focused Markdown review and lint; no annual-data edits |
| 2 | Remove proven unused route helpers and residual surface | Full JS coverage, lint, build, and PWA verification |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring work. Seasonal sources require the annual-data workflow, live official-source review, recorded evidence, and human approval.
- Never edit `out/`; it is generated by `pnpm run build`.
- Preserve archived annual folders, retained official PDFs, source team logos, root verification files, and conventional deployment entry points.
- Preserve the PostHTML architecture, native DOM APIs, classic browser-script boundary, analytics privacy boundary, accessibility behavior, and current offline commitments unless measured evidence supports a separately reviewed decision.
- Keep performance budgets advisory until comparable local and delivered samples establish stable variance.

## Priority Summary

- **RED - High:** Correct the contributor-facing seasonal-source workflow so offline validation cannot be mistaken for the mandatory live source review.
- **ORANGE - Medium:** Remove proven dead route helpers and their narrowly associated surface.
- **GREEN - Low:** No actionable low-priority items remain.
