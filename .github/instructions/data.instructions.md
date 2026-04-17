---
description: "Use when working with JSON data files, schemas, or data loading. Covers data protection rules and schema conventions."
---

# Data File Conventions

## Critical Rule

**Never modify files in `src/assets/data/`.** These are source-of-truth data files maintained by humans. This includes:

- `pools.json`, `teams.json`, `meets.json`
- Their `.schema.json` counterparts
- Everything under `src/assets/data/2025/` (pool schedule PDFs)

## Schema Conventions

- Every data file has a corresponding `.schema.json` using JSON Schema draft-07.
- Schemas enforce required fields, value types, and enums.
- Date format: `YYYY-MM-DD` (ISO 8601).
- Pool IDs use kebab-case (e.g., `bryant-woods`, `kendall-ridge`).

## Data Loading

- Data files are loaded at runtime via `fetch()` from the `assets/data/` path.
- `FileHelper` resolves the correct base path for dev vs. production.
- `DataManager` coordinates loading across all three data sources.
- Data is cached in `localStorage` via `CacheService` with expiration.
