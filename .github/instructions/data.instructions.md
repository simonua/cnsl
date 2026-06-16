---
description: "Use when working with JSON data files, schemas, data loading, source authority, evidence confidence, or conflicting official data."
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
- Normalize a published heated-pool amenity as `heated pool`, not `heated`, so the feature label identifies the heated facility rather than describing an unspecified object.
- Official public Columbia Association pages/documents are authoritative for pool data, and official public CNSL publication/team pages are authoritative for meet and team data. Do not accept social media or other community-shared information as data evidence unless it appears in an official public source.
- When an official Time Trials label uses `returning/experienced`, transcribe that qualifier as `returning / experienced` so visitor-facing text has a natural wrapping opportunity on narrow screens while preserving the published meaning.
- For the active season, keep two source-review dates in the annual README synchronized with `src/js/config/app-config.js`. `OFFICIAL_SOURCE_CHECKED_AT` records every successfully completed official-source review, including a review that finds no represented change. Updating it and the README evidence is a required completion step, so never report that a successful check changed no files. `OFFICIAL_SOURCE_UPDATED_AT` changes only when reviewed evidence updates modeled application data or an application-used source destination. Record both as timestamps in `America/New_York` with explicit UTC offsets; they supply the public FAQ and footer timestamps.
- Use the `cnsl-season-rollover` skill when creating, auditing, or activating annual data.

## Evidence Certainty

- Make each review cumulative: begin with the accepted provenance in the annual README and reviewed baseline, then revalidate the affected fact against current live first-party evidence. A prior transcription, retained file, monitor fingerprint, or source validator proves provenance or change detection, not semantic correctness by itself.
- Authority follows ownership of the field, specificity, explicit scope, and currency rather than presentation format. Prefer, in order: a direct publisher artifact or structured record that owns the value; an entity-specific official page; an aggregate official directory or index; then a qualified official communication allowed by the annual source policy. Use search results, snippets, caches, archived copies, and community pages only to discover a first-party source, never as final evidence.
- For every proposed modeled-data or schema change, inspect the candidate source plus every reasonably available independent official representation of the same fact. Keep the expansion bounded to the affected field and records; do not turn corroboration into an unrelated domain-wide scan.
- Classify the result before editing:
  - `High`: a current authoritative source states the value explicitly with no unresolved contradiction, and either another official representation corroborates it or it is the sole definitive publisher record for that field.
  - `Moderate`: one current official source supports an interpretation, but scope, semantics, currency, or available corroboration is incomplete.
  - `Unresolved`: official sources conflict, the source does not identify the represented scope, or no current authoritative source settles the value.
- Change modeled data or a schema only at `High` confidence. Do not use source counts or majority vote to resolve conflicts. Compare which source directly owns the field, which is more specific, whether the wording explicitly identifies the represented pool, team, period, or amenity, and which source is demonstrably current. If that does not settle the conflict, preserve the current value, mark that field's review incomplete, and seek clarification from the responsible publisher or source owner.
- A schema change needs stronger evidence than a display-label adjustment. Require explicit official evidence that the existing contract cannot faithfully represent the fact, inspect all affected current records and consumers, and document why a new value, split, required field, or validation rule is semantically necessary. Do not expand a schema from one ambiguous phrase or merely because a source uses different prose.
- In the annual README and matching check-log entry, record the authoritative sources inspected, the relevant field or record each source supports, the normalization or schema decision, any official-source conflict and how it was resolved, the final confidence classification, and any residual uncertainty. Never write `verified` or advance the completed-check timestamp for a field left `Unresolved`.

## Schema Conventions

- Every data file has a corresponding `.schema.json` using JSON Schema draft-07.
- Every schema declares a top-level `"version"` metadata annotation. Begin a domain at `"V1"`, retain that version in later seasons while its validation contract (excluding annotations) is unchanged, and increment it only when that contract differs from the preceding version.
- Schemas enforce required fields, value types, and enums.
- Model calendar dates with `type: "string"` and `format: "date"`; do not substitute a `YYYY-MM-DD` regular expression, because syntax alone accepts impossible dates.
- Define one reusable `HttpsUrl` schema type with `type: "string"`, `format: "uri"`, and `pattern: "^https://"`, then reference it for every application-used official source or destination. When a required field may intentionally be blank, use a named optional-HTTPS definition that accepts either an empty string or `HttpsUrl`; do not weaken populated destinations to a generic nonempty string.
- Keep active pool records on the structured-location contract: require stable `id`, official `caUrl`, `location`, and `scheduleUrl` fields, and require the document-level CA directory and guide URLs. Runtime compatibility with legacy flat addresses does not make that shape valid annual source data.
- Enforce clock syntax in schemas and cross-field chronology in `scripts/validate-season-data.js`. Meet and team timing windows must end after they start; standard dual-meet milestones must remain ordered from start through relay check-in and first swim to end.
- If CA publishes a user-relevant pool amenity that the `FeatureType` enum does not cover, add an intentional normalized enum value and transcribe it rather than omitting source information.
- Date format: `YYYY-MM-DD` (ISO 8601).
- Preserve established pool IDs used by application links (e.g., `bwp`, `krp`).

## Pool Activity Classification

- Use `docs/pool-activity-classification.md` as the canonical source for pool schedule activity and `accessStatus` mappings.
- Treat `accessStatus` as whole-slot public availability. Derive it from official access conditions, never from an activity label, color, icon, or other presentation.
- Keep qualification-only activities such as Adult Laps, Adult Swim, and Senior Swim `public`; age and ordinary facility-admission rules do not constitute program restriction.
- Use `restricted` for recurring class or program participation, even when advance registration is not required. Use `practice-only`, `special-event`, `swim-meet`, and `closed-to-public` only for their documented semantic cases.
- A combined slot may be `public` only when an explicitly named general-use activity remains available concurrently. Preserve useful lane-allocation evidence in `notes`, and use separate overlapping slots when simultaneous activities have different access conditions or time boundaries.
- Before transcribing a new activity label or combination, update the canonical matrix and annual pool schema together. Do not activate annual pool data while an activity's access conditions remain ambiguous.
- Author `types` as a nonempty array and use `accessStatus` as the sole public-availability owner; do not add a duplicate event or restriction flag.
- Require both `startTime` and `endTime` for every non-closure slot. A `closed-to-public` slot may omit both for an all-day closure or supply both for a timed closure. Require valid 12-hour clocks and an end later than the start on the same day.

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
