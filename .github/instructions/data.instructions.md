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
- Pool facility `features` come from the official Columbia Association page stored in each pool's `caUrl`. For every season rollover, review each page's description and Amenities list, normalize useful terms into feature labels, and record the verification date in the annual README instead of copying the prior year's array without review.
- Official public Columbia Association pages/documents are authoritative for pool data, and official public CNSL publication/team pages are authoritative for meet and team data. Do not accept social media or other community-shared information as data evidence unless it appears in an official public source.
- When an official Time Trials label uses `returning/experienced`, transcribe that qualifier as `returning / experienced` so visitor-facing text has a natural wrapping opportunity on narrow screens while preserving the published meaning.
- For the active season, keep the accepted official-source check date in the annual README synchronized with the date portion of `OFFICIAL_SOURCE_CHECKED_AT` in `src/js/config/app-config.js`. Record that config value as the review-completion timestamp in `America/New_York` with its explicit UTC offset; it supplies the public FAQ and footer timestamp.
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
