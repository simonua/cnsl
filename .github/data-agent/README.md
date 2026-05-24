# Seasonal Data Source Monitor

The nightly monitor checks public sources that support the active `YEAR` data set while the pool season is underway. It discovers source URLs from the active annual JSON and README rather than carrying a separate list that could drift.

## Coverage

- Pools: each retained pool schedule PDF, the Columbia Association schedule and directory pages, and each pool facility page supplying features.
- Meets: the retained official meet-schedule PDF and the CNSL publication page.
- Teams: retained practice and assignment PDFs, each public team and staff page, and the CNSL publication page.

Stored PDFs are compared byte-for-byte against the public document and replaced on an update branch when they change. Web pages are reduced to relevant visible text and compared against fingerprints in `source-state.json`, which avoids routine script or styling changes causing review traffic. The Columbia Association schedule index is limited to its outdoor-pool schedule section and destination links so changes to indoor schedules or promotional page chrome are ignored. A differing page fingerprint must be reproduced by a second request in the same run before it opens a pull request.

## Review Boundary

Official source documents and changed-page fingerprints can be updated deterministically. The monitor intentionally does not infer schedules, assignments, amenities, or staff records from changed documents and silently write application JSON. Its pull request includes a domain-specific checklist so a reviewer can update the active JSON and annual source manifest from the new official evidence before merging.

Only one automation PR is opened at a time. While it is pending, nightly checks pause so reviewer changes to that branch are retained.

## Operation

`.github/workflows/season-data-monitor.yml` runs nightly at 05:17 UTC and passes `--season-only`; the monitor uses `seasonStartDate` and `seasonEndDate` from active pool data. A manual workflow dispatch can opt into checking outside that date range.

The repository must allow GitHub Actions to create pull requests. The workflow uses the built-in token with only `contents: write` and `pull-requests: write` permissions and a dedicated `automation/season-source-updates` branch.

## Rollover

After a reviewed annual rollover changes `YEAR`, establish page fingerprints for that newly accepted data set:

```bash
node scripts/season-data-agent.js --initialize
```

Commit the resulting `source-state.json` with the rollover. Initialization refuses to proceed if a retained official PDF already differs from its public URL, because that difference needs data review first.

For a local source check that does not write files, run:

```bash
node scripts/season-data-agent.js
```

The command reports detected source changes without writing evidence files.
