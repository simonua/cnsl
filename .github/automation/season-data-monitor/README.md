# Seasonal Data Source Review

The retired scheduled seasonal monitor checked public sources that support the active `YEAR` data set while the pool season was underway. Its scheduled run occurred daily at 05:17 UTC during May, June, and July only. It discovered source URLs from the active annual JSON and README rather than carrying a separate list that could drift. Its GitHub Actions workflow definition has been removed, so no push, schedule, or manual dispatch can start it. The deliberate local review documented below remains required.

## Coverage

Every deliberate source check must perform live network requests during the current run. The expected set is every official source defined by the active annual JSON and annual README that supports modeled data or an application-used official source destination. Reconcile that expected set with the URLs collected by the monitor before claiming complete coverage. Use a live `HEAD` request when current `ETag`, `Last-Modified`, or equivalent metadata is sufficient, or a conditional `GET` that may return `304 Not Modified`; fall back to `GET` and compare the relevant content fingerprint or document hash when validators are missing or unreliable. Directly request any expected source omitted by the monitor, record the omission for automation follow-up, and report the overall check as incomplete if any expected source failed or was not attempted.

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
pnpm run check:data-updates
```

The command is the deterministic, low-cost gate for data-review work. If it reports no candidate differences, stop without loading annual domain JSON or retrieving sources for AI review. Use `--season-only --report` when generating the ignored, ephemeral candidate report supplied to a tracking issue. Each finding identifies the exact annual JSON record and modeled property group to inspect, allowing a reviewer to avoid unaffected domains and records. A clean report run removes any stale candidate report left by an earlier check. The report is not a pull-request artifact.

The command's clean result applies only to URLs it collected. Before reporting a comprehensive online check, compare that collected list with the expected sources above and make live requests for any gaps. `pnpm run validate:data` is a separate local integrity gate and is never evidence of current network access.

## Check Log

Append every completed online source review to [`check-log.md`](check-log.md). Use the review-completion timestamp in `America/New_York` with an explicit UTC offset, record the active season and source counts, and state whether the overall check was complete. Preserve prior entries; `update-report.md` remains an ephemeral candidate report and is not the historical audit log.
