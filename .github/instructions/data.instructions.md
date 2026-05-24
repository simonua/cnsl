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
- Keep one `src/assets/data/<YEAR>/README.md` annual source manifest with official download URLs, stored-document paths, readiness status, and transcription notes; do not create per-domain README files.
- Use `src/assets/data/<YEAR>/<domain>/` for `pools`, `meets`, and `teams`.
- JSON and schema files live together as `<domain>/<domain>.json` and `<domain>/<domain>.schema.json`.
- Official PDF subfolders are domain-specific: `pools/pool-schedules/`, `meets/meet-schedules/`, and `teams/team-schedules/` when source PDFs exist. Retain league-wide practice schedules and team-assignment PDFs under `teams/team-schedules/` when published.
- Use the `cnsl-season-rollover` skill when creating, auditing, or activating annual data.

## Schema Conventions

- Every data file has a corresponding `.schema.json` using JSON Schema draft-07.
- Schemas enforce required fields, value types, and enums.
- Date format: `YYYY-MM-DD` (ISO 8601).
- Preserve established pool IDs used by application links (e.g., `bwp`, `krp`).

## Data Loading

- Data files are loaded at runtime via `fetch()` from `assets/data/<YEAR>/<domain>/` paths.
- `FileHelper` resolves the correct base path for dev vs. production.
- The published active season is selected by the immutable `YEAR` constant in `src/js/config/app-config.js`.
- `DataManager` coordinates loading across all three data sources.
- Data is cached in `localStorage` via `CacheService` with expiration.
