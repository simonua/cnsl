# Live Pool Status Integration Proposal

Status: Proposal only; no implementation is authorized by this document.

Reviewed: 2026-06-22

## Purpose

Evaluate a future, optional integration with Columbia Association's ArcGIS Pool Guide so the web app could show recently reported operating status, closures, maintenance conditions, attendance, and capacity alongside the existing schedule-derived pool information.

This document records feasibility, constraints, and an implementation plan. It does not change browser behavior, annual data, schemas, build output, or the current Columbia Association Pool Guide links.

## Feasibility Summary

The integration appears technically feasible. Columbia Association publishes a public ArcGIS Feature Service whose pool layer contains operational fields and supports cross-origin browser queries. The ArcGIS item is owned by a `columbiaassociation.org` account, marked public authoritative, and described as an input form for pool counts and status. Its current ArcGIS configuration requests a five-minute refresh interval.

The live layer is an external, staff-reported source rather than a sensor feed. Values can be delayed, incomplete, internally inconsistent, or unavailable. The web app must therefore present them as recently reported information, retain published schedules as a fallback, and continue directing visitors to Columbia Association's Pool Guide for official confirmation.

## Reviewed Sources

| Source | Purpose |
| --- | --- |
| [Columbia Association Pool Guide](https://experience.arcgis.com/experience/ac58c73ab9bd4640a880c8ddf46bf198) | Current visitor-facing pool status experience |
| [Columbia Association Pools layer](https://services8.arcgis.com/Qah4YRlnA96tI4X9/arcgis/rest/services/CA_Ammenities/FeatureServer/0?f=pjson) | Field definitions, domains, capabilities, and edit metadata |
| [Feature Service metadata](https://services8.arcgis.com/Qah4YRlnA96tI4X9/arcgis/rest/services/CA_Ammenities/FeatureServer?f=pjson) | Service capabilities, access configuration, and layer inventory |
| [ArcGIS item metadata](https://www.arcgis.com/sharing/rest/content/items/2af336eb205e4c19b627a2a19ca10040?f=pjson) | Ownership, authority, description, and public access |
| [Columbia Association Pools Status page](https://columbiaassociation.org/sports-recreation/pools/pool-locations/status/) | First-party statement that the Pool Guide provides status, attendance, and schedule updates |

## Candidate Data

| ArcGIS field | Possible use | Required interpretation |
| --- | --- | --- |
| `Name` | Match a live record to an annual pool record | Normalize through an explicit, reviewed identifier map; do not rely on display labels alone |
| `Status` | Current reported activity or closure | Map allowlisted ArcGIS values to web-app semantic status constants |
| `Status2` | Partial maintenance condition | Display separately from the primary operating status when meaningful |
| `Pool_Attendance` | Current reported attendance | Accept only a finite nonnegative number from a sufficiently fresh record |
| `Pool_Capacity` | Capacity used to contextualize attendance | Validate against reasonable bounds; do not copy into annual data through this runtime path |
| `Pool_usage_percentage` | Pool Guide utilization | Do not trust directly when attendance and capacity are available; observed records can retain stale percentages after attendance resets |
| `EditDate` | Freshness and visitor-facing "Last reported" time | Parse as an ArcGIS UTC epoch timestamp and render in Eastern time |

The initial review observed current-day edits and populated live values. It also found closed records where attendance had reset to zero while `Pool_usage_percentage` retained an earlier nonzero value. A future implementation should derive utilization as `attendance / capacity * 100` after validation rather than use the published percentage as its primary value.

## Proposed Visitor Experience

Live data should enrich the existing Pools page without delaying its useful initial content.

- Keep schedule-derived availability visible while the external request is pending or unavailable.
- Add a clearly labeled "Reported by CA" status only after a valid record is matched and accepted.
- Show "Last reported" with an absolute or understandable relative time so visitors can judge freshness.
- Distinguish full operating status from partial maintenance, such as a closed wading pool or slide.
- Show attendance and calculated utilization only while the report meets the approved freshness policy.
- Use calm fallback language and retain the existing link to Columbia Association's Pool Guide.
- Do not imply that weather closure status is predictive. A weather closure appears only when CA reports the corresponding operational status.

Exact labels, placement, responsive behavior, and stale-state wording require a separate visitor-facing design review before implementation.

## Proposed Architecture

Treat the ArcGIS request as optional runtime enrichment on the Pools route:

1. Load and render annual pool data through the existing `DataManager` path.
2. Mark primary data ready and render lightweight pool summaries as the route does today.
3. Request a minimal ArcGIS field projection once for the full pool collection.
4. Parse and validate the response through a dedicated DOM-free service.
5. Match accepted records to annual pools through an explicit semantic identifier map.
6. Update only affected live-status regions while preserving focus, disclosure state, scroll position, filters, and sorting.
7. Settle the existing optional-enrichment boundary whether the request succeeds, fails, times out, or returns invalid data.

The implementation should use one collection request, not per-card requests. It should remain a classic browser-script dependency with explicit script order, matching the current runtime architecture in [runtime-architecture.md](runtime-architecture.md).

### Suggested Ownership

| Concern | Suggested owner |
| --- | --- |
| ArcGIS URL, requested field set, refresh interval, timeout, and freshness thresholds | Shared configuration or focused semantic constants |
| Fetch, response-shape validation, field normalization, and status mapping | New DOM-free service under `src/js/services/` |
| Closed set of accepted live status kinds | Existing or extended immutable pool status enum under `src/js/types/` |
| Pool record matching | Explicit mapping owned beside the integration; annual data remains authoritative for web-app pool identity |
| Rendering and accessible announcements | Existing Pool route display/controller boundary |
| External URL and payload trust checks | Service boundary before values reach rendering code |

## Trust And Reliability Boundaries

The source is official but still external and mutable. The Feature Service metadata currently advertises create, update, and delete capabilities, including anonymous editing permissions. No destructive verification should be attempted. Before implementation, confirm whether Columbia Association provides a public read-only hosted feature view or another query-only endpoint and prefer it over the editable source service.

If no read-only endpoint is available, the implementation requires a documented risk decision and strict defensive handling:

- Query only with `where=1=1`, an explicit `outFields` allowlist, `returnGeometry=false`, and JSON output.
- Treat every returned field as untrusted input.
- Accept only known pool identifiers and allowlisted status values.
- Reject duplicate identities, missing required fields, invalid dates, non-finite numbers, negative attendance, nonpositive capacity, and attendance above an approved tolerance.
- Render external strings through text APIs; never insert returned values as HTML.
- Never follow URLs supplied by live records.
- Do not expose editor names, team-member fields, form links, global IDs, object IDs, or other operational metadata.
- Fail closed to existing schedule-derived behavior when source ownership, shape, freshness, or matching is uncertain.

## Freshness And Refresh Policy

The five-minute ArcGIS map refresh setting is evidence of intended cadence, not a guaranteed update service level. Before shipping, define and test separate concepts:

| State | Proposed meaning |
| --- | --- |
| Current | Report timestamp is within an approved short window and the record passes validation |
| Stale | Record is structurally valid but older than the approved window; status may be shown with an explicit stale label, while attendance is hidden |
| Unavailable | Request failed, timed out, was rejected, or returned no trustworthy match; use existing schedule behavior |

The browser should not poll faster than every five minutes. Refresh only while the document is visible, avoid concurrent requests, and perform an immediate refresh after a sufficiently long hidden period. Use a bounded timeout and retain the last accepted value only for the duration and stale behavior approved during implementation. Do not persist live attendance or status into annual JSON, preferences, analytics, or long-lived browser storage.

## Offline And PWA Behavior

Live status is network-dependent enrichment and must not weaken the installed web app's current offline pool directory.

- Keep annual schedules and pool information available from their existing PWA cache policy.
- Do not precache ArcGIS responses or add the external origin to the service worker's core resources.
- When offline, omit live attendance and present the existing schedule-derived status with a concise offline explanation where needed.
- Prevent a previously viewed live status from appearing current after an offline restart.
- Verify that an ArcGIS outage cannot block route readiness or service-worker installation.

## Privacy And Analytics

Pool attendance and facility status are public operational facts, but they should remain purpose-limited.

- Do not send attendance, capacity, utilization, timestamps, closure details, or fetch failures to Google Analytics.
- Existing approved aggregate pool-interaction analytics may continue only with annual-data-validated pool identity.
- Do not expose ArcGIS editor identities, form links, or internal operational fields.
- Do not create visitor identifiers or associate a visitor with a live pool selection.

## Performance Requirements

- Preserve one annual request per domain and add at most one ArcGIS collection request per refresh cycle.
- Request only the fields required for the visitor experience and omit geometry.
- Do not delay `primary-data-ready` or `summary-visible` on the external source.
- Reconcile this request with the existing optional-enrichment lifecycle so route readiness remains measurable.
- Update targeted status elements where practical instead of rerendering every pool card.
- Measure desktop and slower-CPU profiles before and after implementation because the Pools route already has material main-thread work.

## Implementation Phases

| Phase | Scope | Completion evidence |
| --- | --- | --- |
| 1. Source contract | Confirm a read-only endpoint, document ownership and terms, capture representative fixtures, define freshness, and approve field/status mappings | Reviewed source contract and no unresolved trust-boundary questions |
| 2. Service layer | Add constants, fetch/timeout behavior, validation, normalization, utilization calculation, matching, and deterministic unit fixtures | Focused service tests with valid, stale, malformed, duplicate, hostile, and unavailable responses |
| 3. Pool route integration | Start enrichment after summaries, update targeted status regions, preserve current schedule fallback, and settle all lifecycle paths | Focused Pool route tests for success, stale data, timeout, failure, and state preservation |
| 4. Visitor interface | Add accessible status, freshness, maintenance, attendance, loading, stale, and unavailable states | Keyboard and automated accessibility verification across desktop and mobile layouts |
| 5. Operational validation | Measure refresh behavior, requests, bytes, route phases, PWA behavior, and outage recovery | Comparable performance evidence, focused browser checks, build, lint, and PWA verification |
| 6. Release review | Document the visitor-facing capability in `Upcoming` and review production configuration without automated production navigation | Version-update review and release checklist evidence |

## Pre-Implementation Decisions

- [ ] Confirm whether a query-only hosted feature view or other read-only CA endpoint exists.
- [ ] Confirm that Columbia Association permits direct reuse of the service by the web app and document any attribution requirement.
- [ ] Decide which ArcGIS statuses override, supplement, or defer to published schedule state.
- [ ] Approve current, stale, and unavailable time thresholds separately for status and attendance.
- [ ] Approve the complete annual-pool-to-ArcGIS identifier map, including indoor facilities and naming differences.
- [ ] Decide whether stale operating status remains visible and how prominently its timestamp appears.
- [ ] Decide whether attendance is shown as a count, utilization, broad range, or both.
- [ ] Review visitor wording with accessibility and operational clarity in mind.
- [ ] Decide whether the feature remains Pool-route-only or also supplies the shared weather alert link/status experience.

## Acceptance Criteria For Future Work

- [ ] Existing schedule-derived pool information renders without waiting for ArcGIS.
- [ ] Only allowlisted fields and semantic status values cross the external-data boundary.
- [ ] Every accepted live value has a valid annual pool identity and source timestamp.
- [ ] Attendance and utilization are hidden when invalid or stale.
- [ ] Weather, air-quality, maintenance, and unplanned closures remain distinguishable without relying on color alone.
- [ ] Failure, timeout, malformed payload, duplicate record, unknown pool, unknown status, and partial data paths degrade to existing behavior.
- [ ] Refresh does not duplicate requests, run while hidden, disrupt focus, collapse disclosures, move scroll unexpectedly, or reset filters and sorting.
- [ ] Offline startup never presents cached live information as current.
- [ ] No external payload value is inserted as HTML or used as an unvalidated destination.
- [ ] No live operational value is added to analytics, annual data, preferences, or persistent visitor storage.
- [ ] Focused unit coverage for changed delivered modules is complete, and named browser workflows cover each materially different path.
- [ ] `pnpm run lint`, `pnpm run build`, focused Playwright checks, automated accessibility checks, `pnpm run verify:pwa`, and scoped performance measurements pass.

## Explicit Non-Goals

- No change to annual pool records or schemas as part of runtime status ingestion.
- No prediction of closures from weather forecasts.
- No attempt to update, correct, or test editing against Columbia Association's service.
- No background tracking of attendance history or crowd trends.
- No per-pool network request architecture.
- No replacement of Columbia Association's Pool Guide as the official visitor destination.
- No implementation work until the pre-implementation decisions and source trust boundary are reviewed.
