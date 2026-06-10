---
description: "Use when working with JSON data files, schemas, or data loading. Covers data protection rules and schema conventions."
---

# Data File Conventions

## Critical Rule

**Never modify files in `src/assets/data/` unless the user explicitly requests an annual data update or source correction.** These are source-of-truth files maintained by humans. This includes:

- Annual `pools.json`, `teams.json`, and `meets.json` files
- Their `.schema.json` counterparts
- Official schedule PDFs stored beneath each annual domain directory

## Annual Structure

- Canonical documentation: `docs/annual-season-assets.md`.
- Keep one `src/assets/data/<YEAR>/README.md` annual source manifest with official download URLs, stored-document paths, the ISO `YYYY-MM-DD` date each stored source document was downloaded, readiness status, and transcription notes; do not create per-domain README files.
- Record a PDF's download date in the annual README when the local source file is retrieved. For historical retained files whose actual download date was not recorded, state that it is not recorded and optionally note the earliest repository retention evidence; do not substitute a verification date or inferred timestamp for a known download date.
- A single inventory row may cover an explicitly scoped PDF set only when the same download-date value or `Not recorded` status applies to every member and the README states that coverage; otherwise list retained documents individually.
- Use `src/assets/data/<YEAR>/<domain>/` for `pools`, `meets`, and `teams`.
- JSON and schema files live together as `<domain>/<domain>.json` and `<domain>/<domain>.schema.json`.
- Official PDF subfolders are domain-specific: `pools/pool-schedules/`, `meets/meet-schedules/`, and `teams/team-schedules/` when source PDFs exist. Retain league-wide practice schedules and team-assignment PDFs under `teams/team-schedules/` when published.
- Keep official source PDFs under `src/assets/data/<YEAR>/` in source control; their exclusion applies only when generating the public `out/` artifact.
- Treat every request to check for current annual data as an online operation. Build the expected source set from the active annual JSON and annual README links that support modeled data or an application-used official source destination, and issue a live request to every expected source during the current run. `HEAD` is sufficient when it returns useful current validators such as `ETag` or `Last-Modified`; conditional `GET` with `304 Not Modified` is also sufficient. Fall back to `GET` and a relevant content fingerprint or document hash when `HEAD` is unsupported, redirects ambiguously, or lacks useful validators.
- Run `pnpm run check:data-updates` as the first live gate, then reconcile its collected sources with the expected source set. Directly request any defined source omitted by the monitor and record that coverage gap for automation follow-up. A check with any failed or unattempted expected source is incomplete. Local schema validation, retained files, cached responses, and the previous source baseline do not prove that a current online check occurred.
- After accepted active-season PDF acquisition, accepted PDF replacement, or annual activation, run `node scripts/season-data-agent.js --initialize`. Commit the refreshed `.github/automation/season-data-monitor/source-state.json` when publishing so each retained PDF has a reviewed SHA-256 digest, its available `ETag` and `Last-Modified` HTTP validators, and `Content-Length` response metadata. Normal monitor runs use the validators for conditional requests and fall back to full downloads when validators are unavailable.
- Pool facility `features` come from the official Columbia Association page stored in each pool's `caUrl`. For every season rollover, review each page's description and Amenities list, normalize useful terms into feature labels, and record the verification date in the annual README instead of copying the prior year's array without review.
- Official public Columbia Association pages/documents are authoritative for pool data, and official public CNSL publication/team pages are authoritative for meet and team data. Do not accept social media or other community-shared information as data evidence unless it appears in an official public source.
- When an official Time Trials label uses `returning/experienced`, transcribe that qualifier as `returning / experienced` so visitor-facing text has a natural wrapping opportunity on narrow screens while preserving the published meaning.
- For the active season, keep two source-review dates in the annual README synchronized with `src/js/config/app-config.js`. `OFFICIAL_SOURCE_CHECKED_AT` records every successfully completed official-source review, including a review that finds no represented change. `OFFICIAL_SOURCE_UPDATED_AT` changes only when reviewed evidence updates modeled application data or an application-used source destination. Record both as timestamps in `America/New_York` with explicit UTC offsets; they supply the public FAQ and footer timestamps.
- Use the `cnsl-season-rollover` skill when creating, auditing, or activating annual data.

## Schema Conventions

- Every data file has a corresponding `.schema.json` using JSON Schema draft-07.
- Every schema declares a top-level `"version"` metadata annotation. Begin a domain at `"V1"`, retain that version in later seasons while its validation contract (excluding annotations) is unchanged, and increment it only when that contract differs from the preceding version.
- Schemas enforce required fields, value types, and enums.
- If CA publishes a user-relevant pool amenity that the `FeatureType` enum does not cover, add an intentional normalized enum value and transcribe it rather than omitting source information.
- Date format: `YYYY-MM-DD` (ISO 8601).
- Preserve established pool IDs used by application links (e.g., `bwp`, `krp`).

## Data Loading

- Data files are loaded at runtime via `fetch()` from `assets/data/<YEAR>/<domain>/` paths.
- `FileHelper` resolves the correct base path for dev vs. production.
- The published active season is selected by the immutable `YEAR` constant in `src/js/config/app-config.js`.
- `DataManager` coordinates loading across all three data sources.
- Data is cached in `localStorage` via `CacheService` with expiration.

## Non-Seasonal Lesson Providers

- Maintain the swim lesson provider directory in `src/assets/data/lessons.json` with its draft-07 contract in `src/assets/data/lessons.schema.json`.
- Keep provider entries factual and source-backed: organization name, local official logo asset, public website, optional public contact URL and phone, broad class types, source URL, and review date.
- Keep related swimming opportunities separate from lesson providers. Their entries may include factual, source-backed eligibility, training highlights, current practice setting, and a neutral explanation of how the opportunity relates to summer league, along with the program type, local official logo asset, official website/source, and review date.
- Do not model or publish pricing, rankings, ratings, promotional claims, or inferred qualifications in the lesson provider directory. Source-backed outdoor lesson schedules may be modeled in the Lessons data when they support visitor planning; reference active annual pool IDs rather than duplicating pool records.
- Treat listing order as non-semantic. Inclusion is informational and does not constitute an endorsement.
- Run `pnpm run validate:data` after changing either Lessons data file.
