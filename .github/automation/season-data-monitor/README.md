# Seasonal Data Source Monitor

The nightly monitor checks public sources that support the active `YEAR` data set while the pool season is underway. It discovers source URLs from the active annual JSON and README rather than carrying a separate list that could drift.

## Coverage

- Pools: each retained pool schedule PDF, the Columbia Association schedule and directory pages, and each pool facility page supplying features.
- Meets: the retained official meet-schedule PDF and the CNSL publication page.
- Teams: retained practice and assignment PDFs, each public staff and recorded practice-schedule page, and the CNSL publication page. Team home pages and event calendars are destinations offered by the app, not transcribed team-data evidence, and are not fingerprinted unless a recorded practice source is hosted on the home page.

Stored PDFs are compared byte-for-byte against the public document. A changed PDF or a repeatedly unavailable monitored PDF link becomes a candidate for modeled-data review. Web pages are tracked by stable data roles, such as a team's staff page or practice-schedule page, and reduced to relevant content fingerprints in `source-state.json`; publication and schedule-index fingerprints include official PDF destinations so relocated source links can be reviewed. Individual Columbia Association pool pages remain limited to the facility evidence section, and the schedule index remains limited to its outdoor-pool schedule section and destination links.

## Review Boundary

The workflow does not create an evidence-only pull request. Instead, each confirmed candidate difference receives a stable key and is assigned once to the `season-data-reviewer` Copilot agent. That reviewer reads the official evidence and active annual JSON, then opens a pull request only when a represented application value or visitor-used official source link needs updating. A material-data pull request updates the affected JSON together with supporting retained PDFs where applicable, accepted source-check metadata, and the reviewed fingerprint baseline. Presentation-only page edits, equivalent link relocations that do not affect an application destination, and PDF binary/metadata-only changes result in no repository edit and no pull request.

Only one open seasonal review issue is delegated at a time. A candidate key already recorded in an open or closed issue is not re-delegated on later nightly runs, avoiding repeated review traffic for an unchanged non-material observation.

## Operation

`.github/workflows/season-data-monitor.yml` runs nightly at 05:17 UTC and passes `--season-only`; the monitor uses `seasonStartDate` and `seasonEndDate` from active pool data. A manual workflow dispatch can opt into checking outside that date range.

The workflow uses the `COPILOT_AGENT_TOKEN` repository secret to create an issue assigned to the `season-data-reviewer` custom Copilot agent when a previously unseen candidate is confirmed. Keep that token narrowly scoped to the issue assignment capability required by Copilot; the built-in workflow token remains `contents: read` only for checkout.

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

The command reports candidate document or webpage observations without writing evidence files. Use `--report` when generating the ignored, ephemeral candidate report consumed by the scheduled review delegation; it is not a pull-request artifact.
