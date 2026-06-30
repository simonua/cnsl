---
name: cnsl-season-rollover
description: "Prepare, audit, or activate target-year CNSL assets for pools, meets, and teams. Use when adding a swim season, downloading official target-year PDFs, creating year-specific JSON or schemas, auditing target-year completeness, updating the active YEAR, or performing a season rollover. Do not use for a standalone active-year source update check or manager-supplied meet guidance."
argument-hint: "Provide the target year and domains to prepare (pools, meets, teams)."
user-invocable: true
---

# CNSL Season Rollover

Use this workflow for annual schedule assets. The canonical human-facing contract is in [Annual Season Assets](../../../docs/annual-season-assets.md); read it before editing annual data.

## Decision Boundary

This skill owns target-year preparation, completeness review, and activation. Use `season-data-reviewer` for a standalone online update check or official-source correction to the already active year. Use `meet-guidance-updater` for operational facts supplied directly by an identified team manager. Those agents consult this skill for the shared annual-data, evidence, schema, and validation contract; they do not transfer their task ownership to it.

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
    pool-schedules/<pool-id>/<YYYY-MM-DD>/<official-filename>.pdf
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
assets/data/<YEAR>/pools/pool-schedules/<pool-id>/<YYYY-MM-DD>/<official-filename>
```

## Procedure

1. Identify the target year and requested domains (`pools`, `meets`, `teams`). Do not broaden a pool-only task into inferred meet/team data creation.
2. Read `docs/annual-season-assets.md`, inspect `src/assets/data/<YEAR>/`, and inspect `src/js/config/app-config.js` to learn whether the target year is active or preparatory. If the request is instead a standalone latest-update check or correction for the already active year, hand it off to `season-data-reviewer` and stop this workflow. During target-year preparation, retrieve the current official target-year sources directly and record incomplete or unavailable domains without copying active-year values forward.
3. Locate official source material for each requested domain. For pool features, visit every official Columbia Association pool-location page recorded by `caUrl` and review both the facility description and Amenities list. Also inspect a current publisher-maintained structured pool record or directory field when it can clarify which pool or facility area owns an amenity. For CNSL schedules, check the direct official schedule or team record plus any current official publication page that identifies the same document or represented period. Create only the required annual/domain and document subfolders. Store pool PDFs under `<pool-id>/<YYYY-MM-DD>/<official-filename>` using the stable pool ID and actual download date; add a new dated artifact instead of replacing an earlier version. Place meet and team PDFs under their existing domain folders.
4. Apply the evidence-certainty standard in `.github/instructions/data.instructions.md` before editing. For each proposed value, identify the source that owns the field and seek every reasonably available independent official representation of that same fact. Classify the result as `High`, `Moderate`, or `Unresolved`; only `High` evidence may change modeled data or a schema. Resolve conflicts by ownership, specificity, explicit scope, and currency rather than source count. If a conflict remains unresolved, preserve the current model, do not broaden the schema, and report the authoritative clarification still needed.
5. Create or update one `<YEAR>/README.md` manifest with official download URLs, local stored-file paths, current application-readiness status, verification date, and transcription notes. For each accepted material or schema change, record the evidence set, affected fields, normalization decision, conflicts and resolution, final confidence classification, and residual uncertainty. For pool features, record the CA page verification date and any normalized label choices. Do not split this source record into domain-level README files.
6. Create or update `<domain>.json` beside `<domain>.schema.json`. Every schema declares a top-level `"version"` metadata annotation, starting at `"V1"`; preserve the prior version when its validation contract, excluding annotations, is unchanged and increment it only when that contract differs. Start with the prior schema only as a structural baseline; derive schedules, dates, meet matchups, current team pool assignments, events, and pool feature values from current official material. Model calendar dates with JSON Schema `format: "date"`, reference a shared `HttpsUrl` definition for populated application-used official sources and destinations, and keep active pool records on the stable-ID plus structured-location contract. Keep clock syntax in schemas and cross-field meet/team chronology in `scripts/validate-season-data.js`. Before changing a schema, require `High` evidence that the existing contract cannot faithfully express the supported fact, inspect every affected current record and consumer, and document why the semantic change is necessary. Harvest every pool schedule through the canonical `Pool Schedule Harvesting` checklist in `.github/instructions/data.instructions.md`, then classify every activity and exact combined array through `docs/pool-activity-classification.md`; verify whether general use remains available, and update the matrix and annual schema together before accepting a new label or combination. When a useful published pool amenity has no `FeatureType` representation, add a clear normalized enum value instead of omitting it only after the evidence standard is met. When an official Time Trials label uses `returning/experienced`, transcribe that qualifier as `returning / experienced` to give the visitor-facing text a clean mobile wrapping opportunity. Retain stable identifiers and still-valid team URL patterns only as identity metadata, not as substituted seasonal data.
7. For team PDFs, store both league-wide practice schedules and team-assignment documents when available. Transcribe only structures supported by the current schema; record unmodeled official material, such as neighborhood or school assignment matrices, in the annual README rather than inventing unused fields.
8. Validate each completed JSON document against its sibling schema. Require real ISO `YYYY-MM-DD` calendar dates, HTTPS application-used official sources and destinations when populated, stable pool identifiers and structured locations, and chronologically ordered meet and team timing windows. Confirm every pool has a reviewed `features` array supported by `High`-confidence official evidence, and confirm every pool activity and combined activity array has an explicit matrix-backed access classification.
9. Decide whether to activate the target year:
   - For preparation only, leave `YEAR` unchanged and update the coverage record.
   - For activation, confirm `pools.json`, `meets.json`, and `teams.json` exist for the new year if their screens remain enabled; then update `YEAR` in `src/js/config/app-config.js`.
10. Review `src/js/services/file-helper.js`, `src/js/services/data-manager.js`, `service-worker.js`, and `nodemon.json`. Their generic year/domain paths should normally make annual activation a one-line `YEAR` change; edit only if a new asset class is introduced.
11. Update the coverage table in `docs/annual-season-assets.md` with what is complete, source-only, missing, active, or archived.
12. After accepted active-season PDF acquisition, accepted PDF replacement, or annual activation, run `node scripts/season-data-agent.js --initialize`. Commit the refreshed `.github/automation/season-data-monitor/source-state.json` when publishing so each retained PDF has a reviewed SHA-256 digest, its available `ETag` and `Last-Modified` HTTP validators, and `Content-Length` response metadata. Normal monitor runs use the validators for conditional requests and fall back to full downloads when validators are unavailable.
13. Run verification and report incomplete domains or unresolved fields clearly.

## Verification

Run the repository checks after code, JSON, schema, or configuration changes:

```powershell
pnpm run validate:data
pnpm run lint
pnpm run build
```

`pnpm run validate:data` targets the season selected by `YEAR`; run it after active-season corrections or after activating a newly completed year.

Run only tests whose contracts changed during the rollover. Examples include `tests/services/season-data-validation.test.js` for validator/schema behavior and `tests/services/app-config.test.js` when active-season configuration changes. Add other test files only for directly affected consumers; do not run the broad unit suite for annual-record-only changes.

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

Follow the canonical completion-response and check-log contract in `.github/automation/season-data-monitor/README.md`. Put the validation offer and any other prose before the required final `Updates` table.
