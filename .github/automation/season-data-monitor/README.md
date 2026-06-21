# Seasonal Data Source Review

The scheduled seasonal monitor checks public sources that support the active `YEAR` data set while the pool season is underway. [The workflow](../../workflows/season-data-monitor.yml) runs daily at 05:17 UTC during May, June, and July and can also be dispatched manually. It discovers source URLs from the active annual JSON and README rather than carrying a separate list that could drift. The workflow uses deterministic requests, hashes, and fingerprints only; it does not invoke Copilot or another AI service.

## Coverage

Every deliberate source check must perform live network requests during the current run. The expected set is every official source defined by the active annual JSON and annual README that supports modeled data or an application-used official source destination. Reconcile that expected set with the URLs collected by the monitor before claiming complete coverage. Use a live `HEAD` request when current `ETag`, `Last-Modified`, or equivalent metadata is sufficient, or a conditional `GET` that may return `304 Not Modified`; fall back to `GET` and compare the relevant content fingerprint or document hash when validators are missing or unreliable. Directly request any expected source omitted by the monitor, record the omission for automation follow-up, and report the overall check as incomplete if any expected source failed or was not attempted.

- Pools: each retained pool schedule PDF, the Columbia Association schedule and directory pages, and each pool facility page supplying features.
- Meets: the retained official meet-schedule PDF and the CNSL publication page.
- Teams: retained practice and assignment PDFs, each public staff and recorded practice-schedule page, and the CNSL publication page. Team home pages and event calendars are destinations offered by the app, not transcribed team-data evidence, and are not fingerprinted unless a recorded practice source is hosted on the home page.

The reviewed `source-state.json` baseline records each retained PDF's SHA-256 digest and available `ETag`, `Last-Modified`, and `Content-Length` response metadata. Normal checks send conditional requests so unchanged PDFs can return `304 Not Modified` without retransferring document bytes. When a validator is unavailable or the publisher returns `200 OK`, the monitor downloads and hashes the PDF before deciding whether content changed. A changed PDF or a repeatedly unavailable monitored PDF link becomes a candidate for modeled-data review. Web pages are tracked by stable data roles, such as a team's staff page or practice-schedule page, and reduced to relevant content fingerprints in `source-state.json`; publication and schedule-index fingerprints include official PDF destinations so relocated source links can be reviewed. Individual Columbia Association pool pages remain limited to the facility evidence section, and the schedule index remains limited to its outdoor-pool schedule section and destination links.

## Review Boundary

When all content hashes and fingerprints still match but HTTP validators or discovered source metadata changed, the workflow may update only `source-state.json` and open a deterministic pull request. A path-boundary validator rejects the pull request if any other file changed. This refresh improves later conditional requests but does not change modeled annual data, retained official documents, visitor-facing records, or application-used destinations.

Each confirmed content difference receives a stable key and creates one tracking issue for review. The workflow assigns every new or reused review issue to `simonua`. The issue can then be assigned to Copilot cloud agent manually from GitHub when available for the account, using the `season-data-reviewer` custom agent, or reviewed locally without AI. The reviewer reads the official evidence and active annual JSON in default `runlocal` mode, preparing verified material edits and validation results without creating a branch, committing, pushing to `origin`, or opening a pull request. Only an explicit `publish` request may publish a represented application value or visitor-used official source-link update. A published material-data pull request updates the affected JSON together with supporting retained PDFs where applicable, accepted source-check metadata, and the reviewed fingerprint baseline.

The workflow checks previous tracking issues for the stable candidate key before making a new assignment. An already reviewed candidate is not delegated again on later nightly runs, avoiding repeated work for an unchanged non-material observation.

Any material-data pull request describes only verified application changes, grouped under `Pools`, `Teams`, and `Meets` as applicable. Each affected pool, team, or meet contains indented property bullets whose property labels are bold, for example:

```markdown
### Teams
#### Long Reach Marlins
    - **Practice times:** Changed from X to Y.
```

## Operation

The nightly run uses `node scripts/season-data-agent.js --season-only --report --refresh-baseline`. A clean run makes no repository change. A metadata-only refresh opens a baseline pull request. A confirmed page or document content difference creates or reuses a review issue and attaches the exact affected records and property groups. An unavailable source or incomplete request fails or raises a review candidate rather than being accepted automatically.

The scheduled detector is not a completed semantic source review. It does not advance `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, the annual README review record, or `check-log.md`. Those records change only after the candidate evidence has received the deliberate review required by the data instructions.

Before inspecting sources, each run compares the UTC calendar year with the configured active `YEAR`. When a new schedule window begins before that year's assets have been activated, the workflow does not read or update the prior year's annual data. Instead, it creates a rollover preparation issue for `src/assets/data/<current-year>/`, following the `cnsl-season-rollover` skill. The issue may be assigned to Copilot manually, and any resulting pull request may be opened only for official target-year material and must leave earlier annual folders unchanged. An open rollover issue suppresses duplicates; after a no-change conclusion closes the issue or a partial preparation pull request is merged without activating `YEAR`, a later scheduled run may retry preparation.

The workflow uses its built-in token to create the narrowly bounded baseline pull request and deduplicated tracking issue. It assigns those artifacts to `simonua` and requests a review from `simonua` on each baseline pull request. Automatic Copilot assignment through GitHub's API is not used. Repository settings must allow GitHub Actions to create and approve pull requests; the workflow never approves or merges its own pull request.

Notifications stay within GitHub and require no mail service or notification secrets. A source-content difference creates or reuses a review issue assigned to `simonua`, and a metadata-only refresh creates a baseline pull request assigned to `simonua` with a review request. Those direct assignments and review requests use the account's normal GitHub web, email, and mobile notification settings. A failed check remains a failed workflow run and can use the account's Actions notification preferences. Clean and skipped runs do not create an issue or pull request.

Every run writes an Actions job summary with the status, source counts, workflow link, any review issue or baseline pull request, and the generated review report when one exists. This keeps non-actionable results available in the run history without sending a separate notification.

The reviewer is constrained to active-season annual data, retained official evidence, accepted-source metadata, and the monitor baseline. It runs `pnpm run validate:data`, `pnpm run lint`, and `pnpm run build` for a material update, plus only the exact tests for any changed schema, validator, configuration, or consumer contract. Publication remains a separate, explicit `publish` step.

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

The command is the deterministic, low-cost gate for data-review work. If it reports no candidate differences, stop without loading annual domain JSON or retrieving sources for AI review. Use `--season-only --report` when generating the ignored, ephemeral candidate report supplied to a tracking issue. Add `--refresh-baseline` only in controlled automation that validates the resulting changed paths before publishing. Each finding identifies the exact annual JSON record and modeled property group to inspect, allowing a reviewer to avoid unaffected domains and records. A clean report run removes any stale candidate report left by an earlier check. The report is not a pull-request artifact.

The command's clean result applies only to URLs it collected. Before reporting a comprehensive online check, compare that collected list with the expected sources above and make live requests for any gaps. `pnpm run validate:data` is a separate local integrity gate and is never evidence of current network access.

## Check Log

Append every completed online source review to [`check-log.md`](check-log.md). Use the review-completion timestamp in `America/New_York` with an explicit UTC offset, record the active season and source counts, and state whether the overall check was complete. End each entry with the same `Area`, `Status`, and `Details` update-summary table used in the reviewer response. Include modeled application data, application-used source destinations, retained official PDFs, visitor-facing records, review records, and the reviewed source baseline; use `Updated`, `Unchanged`, or `Not completed`, and state `None` for unchanged areas. Preserve prior entries; `update-report.md` remains an ephemeral candidate report and is not the historical audit log.
