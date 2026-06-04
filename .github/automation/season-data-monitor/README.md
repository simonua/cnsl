# Retired Seasonal Data Source Monitor

The retired seasonal monitor checked public sources that support the active `YEAR` data set while the pool season was underway. Its scheduled run occurred daily at 05:17 UTC during May, June, and July only. It discovered source URLs from the active annual JSON and README rather than carrying a separate list that could drift. Its GitHub Actions workflow definition has been removed, so no push, schedule, or manual dispatch can start it.

## Coverage

- Pools: each retained pool schedule PDF, the Columbia Association schedule and directory pages, and each pool facility page supplying features.
- Meets: the retained official meet-schedule PDF and the CNSL publication page.
- Teams: retained practice and assignment PDFs, each public staff and recorded practice-schedule page, and the CNSL publication page. Team home pages and event calendars are destinations offered by the app, not transcribed team-data evidence, and are not fingerprinted unless a recorded practice source is hosted on the home page.

The reviewed `source-state.json` baseline records each retained PDF's SHA-256 digest and available `ETag`, `Last-Modified`, and `Content-Length` response metadata. Normal checks send conditional requests so unchanged PDFs can return `304 Not Modified` without retransferring document bytes. When a validator is unavailable or the publisher returns `200 OK`, the monitor downloads and hashes the PDF before deciding whether content changed. A changed PDF or a repeatedly unavailable monitored PDF link becomes a candidate for modeled-data review. Web pages are tracked by stable data roles, such as a team's staff page or practice-schedule page, and reduced to relevant content fingerprints in `source-state.json`; publication and schedule-index fingerprints include official PDF destinations so relocated source links can be reviewed. Individual Columbia Association pool pages remain limited to the facility evidence section, and the schedule index remains limited to its outdoor-pool schedule section and destination links.

## Review Boundary

The workflow does not create an evidence-only pull request. Each confirmed candidate difference receives a stable key and creates one tracking issue for review. The issue can be assigned to Copilot cloud agent manually from GitHub when available for the account, using the `season-data-reviewer` custom agent. The reviewer reads the official evidence and active annual JSON in default `runlocal` mode, preparing verified material edits and validation results without creating a branch, committing, pushing to `origin`, or opening a pull request. Only an explicit `publish` request may publish a represented application value or visitor-used official source-link update. A published material-data pull request updates the affected JSON together with supporting retained PDFs where applicable, accepted source-check metadata, and the reviewed fingerprint baseline. Presentation-only page edits, equivalent link relocations that do not affect an application destination, and PDF binary/metadata-only changes result in no repository edit and no pull request; the tracking issue records that reviewed conclusion.

The workflow checks previous tracking issues for the stable candidate key before making a new assignment. An already reviewed candidate is not delegated again on later nightly runs, avoiding repeated work for an unchanged non-material observation.

Any material-data pull request describes only verified application changes, grouped under `Pools`, `Teams`, and `Meets` as applicable. Each affected pool, team, or meet contains indented property bullets whose property labels are bold, for example:

```markdown
### Teams
#### Long Reach Marlins
    - **Practice times:** Changed from X to Y.
```

## Operation

The workflow definition was removed to prevent automatic seasonal review issue creation. The script and reviewed baseline remain available for deliberate local investigation or for designing a future reviewed automation.

Before inspecting sources, each run compares the UTC calendar year with the configured active `YEAR`. When a new schedule window begins before that year's assets have been activated, the workflow does not read or update the prior year's annual data. Instead, it creates a rollover preparation issue for `src/assets/data/<current-year>/`, following the `cnsl-season-rollover` skill. The issue may be assigned to Copilot manually, and any resulting pull request may be opened only for official target-year material and must leave earlier annual folders unchanged. An open rollover issue suppresses duplicates; after a no-change conclusion closes the issue or a partial preparation pull request is merged without activating `YEAR`, a later scheduled run may retry preparation.

A future restored workflow would use the `CNSL_DATA_UPDATER_PR_TOKEN` repository secret only to create and query tracking issues when a previously unseen candidate is confirmed. Configure a fine-grained user token with repository read/write access to `Issues` plus the required metadata read permission. Its built-in workflow token should remain `contents: read` only for checkout. Automatic Copilot assignment through GitHub's API is not used because GitHub documents that API entry point for organizations with Copilot Business or Copilot Enterprise plans; users with an eligible Copilot plan can instead assign a generated issue to Copilot manually on GitHub.

The reviewer is constrained to active-season annual data, retained official evidence, accepted-source metadata, and the monitor baseline. It runs `pnpm run validate:data`, `pnpm test`, `pnpm run lint`, and `pnpm run build` for a material update. Publication remains a separate, explicit `publish` step.

## Rollover

After accepted active-season PDF acquisition, accepted PDF replacement, or a reviewed annual rollover that changes `YEAR`, establish document validators, document digests, and diagnostic page fingerprints for that accepted data set:

```bash
node scripts/season-data-agent.js --initialize
```

Commit the resulting `source-state.json` when publishing. Initialization performs a full retrieval of retained PDFs, records their reviewed SHA-256 digests and available `ETag`, `Last-Modified`, and `Content-Length` response metadata, and refuses to proceed if a retained official PDF already differs from its public URL because that difference needs data review first.

For a local source check that does not write files, run:

```bash
node scripts/season-data-agent.js
```

The command reports candidate document or webpage observations without writing evidence files. Use `--report` when generating the ignored, ephemeral candidate report supplied to a tracking issue; it is not a pull-request artifact.
