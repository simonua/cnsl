---
name: cnsl-season-rollover
description: "Prepare, audit, or activate annual CNSL assets for pools, meets, and teams. Use when asked to add a swim season such as 2027, obtain public team coach or manager listings, download pool, meet, practice, or team-assignment PDFs, create year-specific JSON, schemas, or annual source README files, update the active YEAR, check missing annual data, or perform a season rollover."
argument-hint: "Provide the target year and domains to prepare (pools, meets, teams)."
user-invocable: true
---

# CNSL Season Rollover

Use this workflow for annual schedule assets. The canonical human-facing contract is in [Annual Season Assets](../../../docs/annual-season-assets.md); read it before editing annual data.

## Guardrails

- Annual JSON, schemas, and official PDFs are human-maintained source data. Modify them only when the user's request authorizes that season/domain update.
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
3. Locate official source material for each requested domain. For pool features, visit every official Columbia Association pool-location page recorded by `caUrl` and review both the facility description and Amenities list. For CNSL schedules, check the official home page for meet schedules, practice schedules, and team-assignment PDFs. For team staff, follow each public team `url`, then its publicly accessible coaches/managers or equivalent team-information page. Create only the required annual/domain and document subfolders, then place PDFs under the domain they describe.
4. Create or update one `<YEAR>/README.md` manifest with official download URLs, local stored-file paths, current application-readiness status, verification date, and transcription notes. For pool features, record the CA page verification date and any normalized label choices. For team staff, record that individual source pages are stored as `teams[].staff.sourceUrl`, the verification date, and any teams with incomplete or older public listings. Do not split this source record into domain-level README files.
5. Create or update `<domain>.json` beside `<domain>.schema.json`. Every schema declares a top-level `"version"` metadata annotation, starting at `"V1"`; preserve the prior version when its validation contract, excluding annotations, is unchanged and increment it only when that contract differs. Start with the prior schema only as a structural baseline; derive schedules, dates, meet matchups, current team pool assignments, events, staff, and pool feature values from current official material. When a useful published pool amenity has no `FeatureType` representation, add a clear normalized enum value instead of omitting it. Retain stable identifiers and still-valid team URL patterns only as identity metadata, not as substituted seasonal data.
6. For team PDFs, store both league-wide practice schedules and team-assignment documents when available. Transcribe only structures supported by the current schema; record unmodeled official material, such as neighborhood or school assignment matrices, in the annual README rather than inventing unused fields.
7. For each team's public staff listing, transcribe only names and roles actually displayed by the public page into `staff.coaches` and `staff.managers`; do not infer a name from an email address or reclassify board/director labels. Preserve partial names exactly as displayed. When the site publishes no current names, use empty arrays and explain the gap in `staff.note` rather than carrying prior-year staff forward.
8. Validate each completed JSON document against its sibling schema. Require ISO `YYYY-MM-DD` dates, maintain stable pool identifiers used by application links, confirm every pool has a reviewed `features` array sourced from its official CA page, and confirm every team has its current public staff-source review recorded.
9. Decide whether to activate the target year:
   - For preparation only, leave `YEAR` unchanged and update the coverage record.
   - For activation, confirm `pools.json`, `meets.json`, and `teams.json` exist for the new year if their screens remain enabled; then update `YEAR` in `src/js/config/app-config.js`.
10. Review `src/js/services/file-helper.js`, `src/js/services/data-manager.js`, `service-worker.js`, and `nodemon.json`. Their generic year/domain paths should normally make annual activation a one-line `YEAR` change; edit only if a new asset class is introduced.
11. Update the coverage table in `docs/annual-season-assets.md` with what is complete, source-only, missing, active, or archived.
12. Run verification and report incomplete domains clearly.

## Verification

Run the repository checks after code, JSON, schema, or configuration changes:

```powershell
pnpm test
pnpm run lint
pnpm run build
```

After the build, verify:

- Active JSON and source PDF assets are present beneath `out/assets/data/<YEAR>/`.
- The active annual `README.md` is copied to `out/assets/data/<YEAR>/` and accurately describes source links and local documents.
- Archived year folders are not present in `out/assets/data/`.
- The pools, teams, and meets views do not request missing active-year JSON files.
- Every rendered public team-staff section corresponds to its recorded `staff.sourceUrl`, and incomplete site listings are described rather than silently populated from older data.
- Any domain left incomplete is explicitly documented and not silently activated.

## Completion Report

State:

- Target year and domains updated.
- Official PDFs added or retained as source material.
- JSON/schema files completed and validated.
- Whether `YEAR` changed and why.
- Commands run and any intentionally incomplete domain awaiting source data.
