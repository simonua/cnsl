# CNSL Engineering Refactoring Plan

Review date: 2026-06-23

## Audit Scope And Validation

This local audit reviewed delivered browser JavaScript, PostHTML build sequencing, automation scripts, views and shared script order, the single stylesheet, unit and browser test organization, declared dependencies, service-worker and generated cache policy, Node adapters, GitHub Actions path ownership, documentation, active configuration, and recent repository history.

Validation was static and read-only except for this plan update:

- Ranked delivered JavaScript, automation, CSS, views, and tests by size, then compared the largest files with recent 120-commit churn and their existing service boundaries.
- Searched definitions and consumers across runtime scripts, views, lazy script lists, adapters, test manifests, tests, configuration, documentation, build validation, and PWA policy before classifying retirement candidates.
- Reviewed the current recorded `desktop` and `mobile-slow` performance evidence in `docs/release-checklist.md`. The existing local generated inventory was read without rebuilding and contained 74 install-critical resources totaling 1,261,131 bytes; this corroborates the recorded warning but is not a fresh source-comparable performance run.
- Reviewed relevant `git log` and `git blame` history to avoid reopening recently completed refactors or treating documented migration windows as dead compatibility.

No demonstrated accessibility barrier, data-integrity defect, active security exposure, or current release failure supports a `RED - High` item. The Cloudflare inline-script CSP exception, attention banner, and two storage migrations remain documented current contracts.

## Priority Matrix

Render every priority matrix with a `Key` column immediately to the left of `Priority`. Key actionable findings independently within each priority category using `H`, `M`, or `L` followed by a one-based index, such as `H1`, `M1`, and `L1`. Always show High, Medium, and Low, even when a category has no actionable finding. Keep the colored priority circle in every `Priority` cell: 🔴 for High, 🟠 for Medium, and 🟢 for Low. For an empty category, leave `Key` blank, use `None` for the finding, and summarize why no item qualifies in the remaining cells.

| Key | Priority | Actionable Finding | Impact | Effort |
| --- | --- | --- | --- | --- |
| <!-- No key --> | 🔴 **High** | None | No demonstrated accessibility, data-integrity, security, release, or material runtime defect | None |
| <!-- No key --> | 🟠 **Medium** | None | No measured medium-priority refactoring remains open | None |
| L1 | 🟢 **Low** | Retire obsolete browser-global lint registrations | Restores `no-undef` protection for seven names with no current definition or consumer | Low |

## High Priority

No high-priority item is supported by current repository evidence. Promote an item here only after demonstrating an accessibility barrier, data-integrity or release risk, active security exposure, or material current runtime failure.

## Medium Priority

No medium-priority item is supported by current repository evidence.

## Low Priority

### 1. Retire Obsolete Browser-Global Lint Registrations

**Finding:** Seven browser globals remain allowlisted even though no maintained runtime definition or consumer exists. These entries are obsolete support surface and can hide accidental references from ESLint's `no-undef` rule.

**Repository evidence:**

- `eslint.config.js:30-31`, `eslint.config.js:42`, `eslint.config.js:62`, `eslint.config.js:66-67`, and `eslint.config.js:75` register `$`, `jQuery`, `PoolSchedule`, `CacheService`, `CNSLSearchEngine`, `WeatherService`, and `handleSearch` as read-only globals.
- Exact whole-repository searches excluding generated output and dependencies found no maintained runtime definition or consumer for those names; `$(` had no maintained JavaScript consumer.
- `.github/instructions/build.instructions.md` still describes jQuery as an application global, and `.github/instructions/data.instructions.md` still describes a removed `CacheService` localStorage layer. These are stale guidance to retire with the lint registrations, not current-contract evidence.
- No matching view script, lazy dependency, adapter, browser-module manifest, test, fixture, current documentation contract, build rule, dependency, or PWA registration was found.

**Scoped plan:**

1. Remove the seven obsolete global declarations and update the inaccurate jQuery environment comment.
2. Remove the stale jQuery and `CacheService` statements from the scoped instruction files so repository guidance describes the current runtime.
3. Do not add aliases or compatibility shims; any newly exposed reference must instead identify and load its real semantic owner.
4. Search the full retirement surface again after removal.

**Acceptance checks:**

- Exact searches return no unexplained references to the seven retired names.
- ESLint rejects a fixture-owned accidental reference rather than accepting it as a configured global.
- `pnpm run lint` passes with no replacement allowlist or dependency.

## Phased Roadmap

| Phase | Work | Prerequisites | Exit Evidence |
| --- | --- | --- | --- |
| 1. Registration cleanup | Complete L1 | None | Retired-name searches are clean and lint passes |

## Monitored Boundaries

These are current migration contracts with future review conditions, not active refactoring work:

| Surface | Current Owner | Review Condition |
| --- | --- | --- |
| Analytics predecessor storage candidates | `analytics.js` | Reassess after the full 2027 season and remove only when the source-recorded report condition is satisfied |
| `practiceAgeGroups` preference input | `PreferencesService` | Remove no earlier than 2027-10-01 with focused migration and current-contract coverage |

## Guardrails

- Do not modify `src/assets/data/` during general refactoring. Seasonal facts and schemas require authoritative evidence, annual workflow records, and human review.
- Never edit `out/`; it is generated by `pnpm run build`.
- Retain the attention-banner capability unless the product owner explicitly changes this requirement. A dormant `APP_ATTENTION_NOTICE` value means no active message; it is not removal evidence.
- Retain the documented Cloudflare `script-src 'unsafe-inline'` integration constraint until a delivered-site review proves Cloudflare and Analytics operate without it; authored inline executable scripts remain prohibited.
- Preserve the analytics predecessor candidates and `practiceAgeGroups` migration until their recorded 2027 review conditions are met. Tests alone neither justify early removal nor permanent retention after those conditions.
- Retire obsolete production code and its tests, fixtures, types, registrations, dependencies, documentation, build rules, and cache entries together. Keep a compatibility path only for a verified consumer with an owner, removal condition, and focused coverage.
- Do not introduce a framework, bundler, data split, cache, index, or rendering mechanism without current evidence of visitor or maintenance benefit.
- Preserve the current install-critical offline routes and one-fetch annual-data contract unless measured evidence and an explicit offline-product decision support changing them.
- Keep local verification scoped to the changed behavior. Do not run complete unit or browser suites for these focused refactors unless a failure or shared contract justifies named additional coverage.

## Priority Summary

- **High:** No actionable item is supported by current evidence.
- **Medium:** No actionable item is supported by current evidence.
- **Low:** Remove seven obsolete browser-global lint registrations.
