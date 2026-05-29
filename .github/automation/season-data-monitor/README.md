# Seasonal Data Source Monitor

The seasonal monitor checks public sources that support the active `YEAR` data set while the pool season is underway. Its scheduled run occurs daily at 05:17 UTC during May, June, and July only. It discovers source URLs from the active annual JSON and README rather than carrying a separate list that could drift.

## Coverage

- Pools: each retained pool schedule PDF, the Columbia Association schedule and directory pages, and each pool facility page supplying features.
- Meets: the retained official meet-schedule PDF and the CNSL publication page.
- Teams: retained practice and assignment PDFs, each public staff and recorded practice-schedule page, and the CNSL publication page. Team home pages and event calendars are destinations offered by the app, not transcribed team-data evidence, and are not fingerprinted unless a recorded practice source is hosted on the home page.

Stored PDFs are compared byte-for-byte against the public document. A changed PDF or a repeatedly unavailable monitored PDF link becomes a candidate for modeled-data review. Web pages are tracked by stable data roles, such as a team's staff page or practice-schedule page, and reduced to relevant content fingerprints in `source-state.json`; publication and schedule-index fingerprints include official PDF destinations so relocated source links can be reviewed. Individual Columbia Association pool pages remain limited to the facility evidence section, and the schedule index remains limited to its outdoor-pool schedule section and destination links.

## Review Boundary

The workflow never creates an issue and does not create an evidence-only pull request. Each confirmed candidate difference receives a stable key and starts one issue-free Copilot Agent Tasks API session. That reviewer reads the official evidence and active annual JSON, then opens a pull request only when a represented application value or visitor-used official source link needs updating. A material-data pull request updates the affected JSON together with supporting retained PDFs where applicable, accepted source-check metadata, and the reviewed fingerprint baseline. Presentation-only page edits, equivalent link relocations that do not affect an application destination, and PDF binary/metadata-only changes result in no repository edit and no pull request.

The workflow checks previous Copilot tasks for the stable candidate key before starting a session. An already reviewed candidate is not delegated again on later nightly runs, avoiding repeated work for an unchanged non-material observation without using issues as state.

Any material-data pull request describes only verified application changes, grouped under `Pools`, `Teams`, and `Meets` as applicable. Each affected pool, team, or meet contains indented property bullets whose property labels are bold, for example:

```markdown
### Teams
#### Long Reach Marlins
    - **Practice times:** Changed from X to Y.
```

## Operation

`.github/workflows/season-data-monitor.yml` runs daily at 05:17 UTC during May, June, and July only and passes `--season-only`; the monitor uses `seasonStartDate` and `seasonEndDate` from active pool data. A manual workflow dispatch can intentionally opt into checking outside that date range.

Before inspecting sources, each run compares the UTC calendar year with the configured active `YEAR`. When a new schedule window begins before that year's assets have been activated, the workflow does not read or update the prior year's annual data. Instead, it starts an issue-free rollover preparation task for `src/assets/data/<current-year>/`, following the `cnsl-season-rollover` skill. That task may open a pull request only for official target-year material and must leave earlier annual folders unchanged. An active rollover task or open rollover pull request suppresses duplicates; after a no-change conclusion or a partial preparation pull request is merged without activating `YEAR`, a later scheduled run may retry preparation.

The workflow uses the `CNSL_DATA_UPDATER_PR_TOKEN` repository secret to start a `season-data-reviewer` task through GitHub's Agent Tasks API when a previously unseen candidate is confirmed. GitHub currently documents that public-preview API for organizations with Copilot Business or Copilot Enterprise; confirm the repository is eligible before enabling the scheduled handoff. The secret must be a supported user-to-server token with repository `Agent tasks` read and write permission; GitHub App installation tokens are not accepted by this API. The built-in workflow token remains `contents: read` only for checkout.

The reviewer is constrained to active-season annual data, retained official evidence, accepted-source metadata, and the monitor baseline. It runs `pnpm run validate:data`, `pnpm test`, `pnpm run lint`, and `pnpm run build` before opening a material-data pull request.

## Rollover

After a reviewed annual rollover changes `YEAR`, establish diagnostic page fingerprints for that newly accepted data set:

```bash
node scripts/season-data-agent.js --initialize
```

Commit the resulting `source-state.json` with the rollover. Initialization refuses to proceed if a retained official PDF already differs from its public URL, because that difference needs data review first.

For a local source check that does not write files, run:

```bash
node scripts/season-data-agent.js
```

The command reports candidate document or webpage observations without writing evidence files. Use `--report` when generating the ignored, ephemeral candidate report supplied to an issue-free review task; it is not a pull-request artifact.
