---
name: cnsl-season-rollover
description: "Prepare, audit, or activate annual CNSL assets for pools, meets, and teams. Use when asked to add a swim season such as 2027, download pool, meet, practice, or team-assignment PDFs, create year-specific JSON, schemas, or annual source README files, update the active YEAR, check missing annual data, or perform a season rollover."
argument-hint: "Provide the target year and domains to prepare (pools, meets, teams)."
user-invocable: true
---

# CNSL Season Rollover

Use this workflow for annual schedule assets. The canonical human-facing contract is in [Annual Season Assets](../../../docs/annual-season-assets.md); read it before editing annual data.

## Guardrails

- Annual JSON, schemas, and official PDFs are human-maintained source data. Modify them only when the user's request authorizes that season/domain update.
- Keep retrieved official PDFs in source control; exclude them only from generated public `out/` artifacts.
- Never edit generated `out/` content; validate by rebuilding it.
- Do not copy schedule values from a prior year without checking the new official PDF or authoritative source.
- Keep historical year folders intact unless the user explicitly asks for a correction.
- Do not activate a year that lacks JSON for a domain still loaded by the published UI.

## Canonical Paths

```text
src/assets/data/<YEAR>/
  README.md                               # Source URLs, local inventory, status, transcription scope.
  pools/
    pools.json
    pools.schema.json
    pool-schedules/<Pool_Name>.pdf
  meets/
    meets.json
    meets.schema.json
    meet-schedules/<official-meet-schedule>.pdf
  teams/
    teams.json
    teams.schema.json
    team-schedules/<official-practice-schedule>.pdf     # only when available
    team-schedules/<official-team-assignments>.pdf      # only when available
```

Runtime data paths are built by `src/js/services/file-helper.js` from `YEAR` in `src/js/config/app-config.js`:

```text
assets/data/<YEAR>/pools/pools.json
assets/data/<YEAR>/meets/meets.json
assets/data/<YEAR>/teams/teams.json
assets/data/<YEAR>/pools/pool-schedules/<filename>
```

## Procedure

1. Identify the target year and requested domains (`pools`, `meets`, `teams`). Do not broaden a pool-only task into inferred meet/team data creation.
2. Read `docs/annual-season-assets.md`, inspect `src/assets/data/<YEAR>/`, and inspect `src/js/config/app-config.js` to learn whether the year is active or preparatory.
  For a latest-update check of the active season, run `pnpm run check:data-updates` first. This command must make live network requests during the current run; a prior report or local baseline is not a source check. Reconcile the monitor's collected source list with every official source defined by the active annual JSON and annual README for modeled data or an application-used official source destination. Directly issue `HEAD` or conditional `GET` requests for any defined source not collected by the monitor, falling back to `GET` content or document comparison when response validators are unavailable or unreliable. Treat `304 Not Modified` and unchanged current `ETag` or `Last-Modified` values as successful online checks. If any expected source was not attempted or failed, report the check as incomplete rather than clean and do not advance the completed-check timestamp. If all expected sources were reached, inspect only each candidate finding's exact JSON review scope and listed source. After resolving all candidates, always update `OFFICIAL_SOURCE_CHECKED_AT` and the matching active annual README evidence to the review-completion timestamp in `America/New_York`, even when represented data did not change. Update `OFFICIAL_SOURCE_UPDATED_AT` only when modeled data or an application-used official source destination changed. Run `node scripts/season-data-agent.js --initialize` to accept the completed review baseline, then report the active season, checked source categories and counts, request coverage, metadata files changed, and whether represented data changed. Ask whether the user wants the separate `pnpm run validate:data` integrity check. Explain that validation checks active JSON, schemas, cross-domain references, URL syntax, and retained PDF inventory locally; it does not go online and cannot replace the source check. Do not run it without confirmation.
3. Locate official source material for each requested domain. For pool features, visit every official Columbia Association pool-location page recorded by `caUrl` and review both the facility description and Amenities list. For CNSL schedules, check the official home page for meet schedules, practice schedules, and team-assignment PDFs. Create only the required annual/domain and document subfolders, then place PDFs under the domain they describe.
4. Create or update one `<YEAR>/README.md` manifest with official download URLs, local stored-file paths, current application-readiness status, verification date, and transcription notes. For pool features, record the CA page verification date and any normalized label choices. Do not split this source record into domain-level README files.
5. Create or update `<domain>.json` beside `<domain>.schema.json`. Every schema declares a top-level `"version"` metadata annotation, starting at `"V1"`; preserve the prior version when its validation contract, excluding annotations, is unchanged and increment it only when that contract differs. Start with the prior schema only as a structural baseline; derive schedules, dates, meet matchups, current team pool assignments, events, and pool feature values from current official material. When a useful published pool amenity has no `FeatureType` representation, add a clear normalized enum value instead of omitting it. When an official Time Trials label uses `returning/experienced`, transcribe that qualifier as `returning / experienced` to give the visitor-facing text a clean mobile wrapping opportunity. Retain stable identifiers and still-valid team URL patterns only as identity metadata, not as substituted seasonal data.
6. For team PDFs, store both league-wide practice schedules and team-assignment documents when available. Transcribe only structures supported by the current schema; record unmodeled official material, such as neighborhood or school assignment matrices, in the annual README rather than inventing unused fields.
7. Validate each completed JSON document against its sibling schema. Require ISO `YYYY-MM-DD` dates, maintain stable pool identifiers used by application links, and confirm every pool has a reviewed `features` array sourced from its official CA page.
8. Decide whether to activate the target year:
   - For preparation only, leave `YEAR` unchanged and update the coverage record.
   - For activation, confirm `pools.json`, `meets.json`, and `teams.json` exist for the new year if their screens remain enabled; then update `YEAR` in `src/js/config/app-config.js`.
9. Review `src/js/services/file-helper.js`, `src/js/services/data-manager.js`, `service-worker.js`, and `nodemon.json`. Their generic year/domain paths should normally make annual activation a one-line `YEAR` change; edit only if a new asset class is introduced.
10. Update the coverage table in `docs/annual-season-assets.md` with what is complete, source-only, missing, active, or archived.
11. After accepted active-season PDF acquisition, accepted PDF replacement, or annual activation, run `node scripts/season-data-agent.js --initialize`. Commit the refreshed `.github/automation/season-data-monitor/source-state.json` when publishing so each retained PDF has a reviewed SHA-256 digest, its available `ETag` and `Last-Modified` HTTP validators, and `Content-Length` response metadata. Normal monitor runs use the validators for conditional requests and fall back to full downloads when validators are unavailable.
12. Run verification and report incomplete domains clearly.

## Verification

Run the repository checks after code, JSON, schema, or configuration changes:

```powershell
pnpm run validate:data
pnpm test
pnpm run lint
pnpm run build
```

`pnpm run validate:data` targets the season selected by `YEAR`; run it after active-season corrections or after activating a newly completed year.

After the build, verify:

- Active JSON and schemas are present beneath `out/assets/data/<YEAR>/`.
- Retained source PDF evidence directories are not present beneath `out/assets/data/<YEAR>/`.
- The active annual `README.md` is copied to `out/assets/data/<YEAR>/` and accurately describes source links and retained local documents.
- Archived year folders are not present in `out/assets/data/`.
- The pools, teams, and meets views do not request missing active-year JSON files.
- Any domain left incomplete is explicitly documented and not silently activated.

## Completion Report

State:

- Target year and domains updated.
- Official PDFs added or retained as source material.
- Whether the reviewed seasonal-source baseline was refreshed with retained-PDF validators and digests.
- JSON/schema files completed and validated.
- Whether `YEAR` changed and why.
- Commands run and any intentionally incomplete domain awaiting source data.

Make an `Updates` table the final section of the response. Put the validation offer and any other prose before this table so nothing follows it. Use `Updated`, `Unchanged`, or `Not completed`, name changed files or modeled properties, and write `None` when an area did not change:

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated / Unchanged / Not completed | Name changed records and properties, or `None`. |
| Application-used source destinations | Updated / Unchanged / Not completed | Name changed URLs, or `None`. |
| Retained official PDFs | Updated / Unchanged / Not completed | Name added or replaced files, or `None`. |
| Visitor-facing records | Updated / Unchanged / Not completed | Name What's New and sitemap edits, or `None`. |
| Review records | Updated / Unchanged / Not completed | Name timestamp, annual README, and check-log edits. |
| Reviewed source baseline | Updated / Unchanged / Not completed | State whether `source-state.json` was refreshed. |

Append the same table, with values for that run, as the final content of the matching `.github/automation/season-data-monitor/check-log.md` entry.
