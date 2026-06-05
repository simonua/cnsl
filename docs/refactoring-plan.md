# CNSL Engineering Refactoring Plan

Status: No actionable performance refactoring items.

Review date: 2026-06-05

## Scope And Validation

The performance follow-up completed the remaining measurement recommendations. The repeatable local report now exposes route usable-time spread, separate Pools primary-data, summary-visible, and optional-enrichment phases, maximum annual-domain request counts, and precise PWA complete-inventory, install-critical, and cache-on-use tier sizes.

The completed three-run baseline reported zero warnings. Pools summary-visible median was 478 ms and optional enrichment settled at 691 ms, confirming that optional work does not delay the visible summary. PWA reporting confirms that the 83-resource / 2,525,426-byte cache inventory partitions into a 61-resource / 945,362-byte install-critical core and a 22-resource / 1,580,064-byte cache-on-use optional tier.

Validation completed on 2026-06-05:

- Focused performance-reporting tests passed: 2 tests, 0 failures.
- `pnpm run lint` passed.
- `pnpm run measure:performance` passed with zero warnings across three cold runs per route.
- A one-run `CNSL_PERF_BUDGET_SCALE=0.1` sample emitted 11 advisory warnings and completed successfully.
- `pnpm run verify:pwa` passed with precise inventory, core, and optional tier reporting.

## Current Decisions

- Do not add local-data query indexes without a benchmark. Current collections remain small, direct pool and team lookups use `Map`, concurrent domain requests are deduplicated, and team practice-pool lookups already have a maintained index.
- Do not add asynchronous or stale-while-revalidate annual-data refresh. Annual JSON remains coherent with the versioned application build, and no application workflow currently calls `DataManager.refresh()`.
- Do not extend progressive detail hydration to Teams or Meets. Current repeatable route measurements do not demonstrate a visitor-facing need.
- Keep the current PWA core/optional split. Do not further reduce the core tier or proactively warm optional resources until delivered-HTTPS installation evidence demonstrates a problem.
- Keep performance budgets warning-only until repeated local and delivered-HTTPS measurements demonstrate stable blocking thresholds.

## Priority Matrix

| Priority | Finding | Impact | Effort |
| --- | --- | --- | --- |
| RED - High | No actionable item | - | - |
| ORANGE - Medium | No actionable item | - | - |
| GREEN - Low | No actionable item | - | - |

## Priority Summary

- **RED - High:** No actionable item.
- **ORANGE - Medium:** No actionable item.
- **GREEN - Low:** No actionable item.
