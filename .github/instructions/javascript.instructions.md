---
applyTo: "src/js/**/*.js"
---

# JavaScript Conventions

## Module Pattern

- All browser JS uses `<script>` tag loading (no bundler, no ES modules).
- Classes and functions become globals. Declare them with `class` or `function` at the top level.
- Use the singleton pattern for managers: expose a `getXxxManager()` factory that caches the instance.
- Standardize on `getDataManager()` for DataManager access — never `new DataManager()` directly.
- Route templates list first-load dependencies explicitly. Optional interaction-driven dependencies may be loaded lazily when the loading boundary and resulting workflow are covered by browser tests.

## DOM APIs

- Use native DOM APIs (`document.getElementById`, `querySelector`, and event listeners) consistently with the existing controllers.
- Do not add a DOM library for new behavior unless a broader architecture decision explicitly introduces one.
- Prefer `DOMContentLoaded` for initialization when a deferred script is not sufficient.

## Code Organization

- **Models** (`src/js/models/`): Data classes (e.g., `Pool`). No DOM access.
- **Services** (`src/js/services/`): Reusable logic (e.g., `TimeUtils`, `CacheService`). No DOM access.
- **Types** (`src/js/types/`): Immutable runtime state/constants (e.g., `PoolStatus`), not seasonal source vocabularies.
- **Config** (`src/js/config/`): Configuration values.
- **Managers** (`src/js/`): Orchestrators that coordinate services and models (e.g., `PoolsManager`).
- **Browsers** (`src/js/`): UI rendering modules that read from managers and write to the DOM.

## Style Rules

- Prefer `const` over `let`. Never use `var`.
- Use strict equality (`===`, `!==`).
- Use template literals for string interpolation.
- Name classes in PascalCase, functions/variables in camelCase, constants in UPPER_SNAKE_CASE.

## File Header Comments

- Leave at least one empty line between a top-of-file comment and the first statement.
- Keep top-of-file comments concise but informative. Summarize the module's primary responsibility and add a short note about its main boundary, collaborator, or output when that context helps orient the reader.
- Prefer two or three focused lines over a one-sentence label or a paragraph.

## Testability

- Keep DOM-free logic in services/models so it can be tested with Node.js.
- Export via `if (typeof module !== 'undefined') module.exports = { ... }` for Node.js test access.
- Services and models must not reference `$`, `document`, or `window` directly.
- Published annual pool/team/meet names and schema enum vocabularies come from annual data and schemas; do not mirror them in JavaScript enums for validation or behavior.

## Analytics Privacy Boundary

- Analytics may report public page counts, reviewed fixed campaign labels on app-published inbound links, and coarse feature-use categories only; do not introduce account identifiers, contact data, coordinates, application-stored device values, selected preference values, user-entered strings, arbitrary URL query/fragment content, or referrer data.
- Do not track selected pools, teams, filter values, themes, layouts, refresh values, or location choices; settings analytics may report the changed setting category only.
- Keep Google tag measurement purpose-limited and reportable: grant `analytics_storage` so Google Analytics can use its own first-party analytics identifier for aggregate visit and session reporting; deny advertising storage, Google signals, and ad personalization; and strip referrers, query strings, and fragments from app-authored page measurement. An approved campaign link may map its validated, allowlisted UTM tuple to GA campaign fields after those tags are removed from the visible URL for aggregate source attribution. Do not send full tagged page locations, arbitrary campaign input, or app-authored identifiers intended to identify or profile a visitor. Do not change `analytics_storage` to denied or enable additional GA4 enhanced measurement events unless separately reviewed under this same boundary.
- Add regression coverage for every new analytics event or configuration change.
