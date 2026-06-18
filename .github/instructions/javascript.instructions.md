---
applyTo: "src/js/**/*.js"
description: "Use when changing browser JavaScript under src/js, including runtime architecture, DOM behavior, progressive loading, semantic constants, JSDoc, or analytics boundaries."
---

# JavaScript Conventions

## Module Pattern

- All browser JS uses `<script>` tag loading (no bundler, no ES modules).
- Classes and functions become globals. Declare them with `class` or `function` at the top level.
- Use the singleton pattern for managers: expose a `getXxxManager()` factory that caches the instance.
- Standardize on `getDataManager()` for DataManager access — never `new DataManager()` directly.
- Route templates list only summary-critical first-load dependencies explicitly. Optional interaction-driven dependencies may be loaded lazily when their order, build-version propagation, loading boundary, failure recovery, and resulting workflow are covered by browser tests.
- Treat `src/js/` as browser application code. New runtime dependencies must come from explicit script order and `globalThis`, never from `require()`, `module.exports`, `process`, `__dirname`, or another Node.js API.
- When a browser script begins referencing a global owned by another delivered script, treat that provider as a new explicit dependency. Search every route template, shared layout, lazy loader, and test browser-module manifest that loads the consumer; hoist the provider before the consumer in each applicable script list in the same change. Do not rely on the consumer's functions running only after a later script happens to load.
- Do not add test-only behavior to a delivered browser module. Put fixtures, adapters, loaders, mocks, and export shims under `tests/`; put build-time Node.js code under `scripts/`.
- The build must parse and validate every source script before copying it byte-for-byte. Never weaken or bypass that guard to make a test pass.
- Build-time Node consumers must import a narrow adapter under `scripts/adapters/`; they must not directly require a browser source file.

## DOM APIs

- Use native DOM APIs (`document.getElementById`, `querySelector`, and event listeners) consistently with the existing controllers.
- Do not add a DOM library for new behavior unless a broader architecture decision explicitly introduces one.
- A deferred route script may initialize immediately when its required DOM appears earlier in the document and every provider is already loaded; do not wait for `DOMContentLoaded` when that only delays primary data and useful summaries behind unrelated deferred work. Use `DOMContentLoaded` when the script is not deferred or its required DOM/lifecycle is not yet available.

## Progressive Directory Loading

- Distinguish network loading from model construction, summary rendering, optional enrichment, detail hydration, and paint. Add or preserve ordered performance marks for primary data ready, summaries visible, and optional enrichment settled when a route has those phases.
- When a shared annual document contains all directory records, fetch and parse it once. Do not split it into per-card requests without measured byte or readiness benefit and a reviewed offline/cache contract.
- Render lightweight summaries as the primary usable state. Keep collapsed detail containers empty and hydrate only the requested, favorite-expanded, or deep-linked card; do not generate large hidden subtrees during initial rendering.
- Load optional detail scripts once in deterministic classic-script order, preserve the controller's build-version query, share pending data requests through `DataManager`, and settle `aria-busy` plus a helpful unavailable state when a dependency or enrichment step fails.
- Start optional enrichment after summaries are visible so it cannot block primary readiness. Verify that paused optional requests still leave summaries usable and that enrichment does not replace focused controls, collapse disclosures, move scroll unexpectedly, duplicate annual-domain requests, or break offline details.
- Treat below-the-fold rendering as a separate optimization from data loading. Use `content-visibility`, incremental insertion, or virtualization only with measured benefit and stable intrinsic sizing; verify keyboard order, browser find, deep-link scrolling, favorites, filtering/sorting counts, accessibility inspection, and desktop/mobile layout before retaining it.

## Code Organization

- **Models** (`src/js/models/`): Data classes and domain value objects (e.g., `Pool`, `PoolSchedule`). No DOM access.
- **Services** (`src/js/services/`): Reusable logic (e.g., `TimeUtils`, `CacheService`). No DOM access.
- **Types** (`src/js/types/`): Immutable runtime state/constants (e.g., `PoolStatus`), not seasonal source vocabularies.
- **Config** (`src/js/config/`): Configuration values.
- **Managers** (`src/js/managers/`): Orchestrators that coordinate services and models (e.g., `PoolsManager`).
- **Browser entry points** (`src/js/`): Route controllers, shared shell controllers, and focused UI controllers loaded directly by views or other entry points.

## Sibling And Alternate-Path Ownership

- Treat files that implement the same visitor-visible behavior through different paths as one review constellation even when their names, timing, or entry points differ. Common constellations include cached/live, initial/update, synchronous/deferred, desktop/mobile, route-specific directory controllers, manager families, source/generated forms, and browser/build/test adapters.
- Before adding a helper or changing a contract, search sibling files for the same DOM updates, normalization, validation, accessibility state, timestamp formatting, timer-boundary calculation, loading/error state, cache interpretation, collection loading, or rendering map. Review all matching paths together so one cannot silently drift.
- Extract the smallest stable responsibility that must remain identical. Prefer a semantic type for values and validation, a DOM-free service for domain calculations, a focused browser display/controller for shared DOM behavior, a time utility for scheduling math, or a narrow adapter for a genuine runtime boundary. Keep orchestration and path-specific eligibility in the entry point that owns that lifecycle.
- Multiple entry points are appropriate when they have different load timing, runtime, trust boundary, performance role, or domain rules. For example, an early cached renderer and a deferred live controller should stay separate but call the same stateless display contract. Do not merge files merely because their names or method shapes are similar.
- Do not introduce inheritance, a generic base manager/controller, or a broad utility solely to remove a few similar lines. Extract only when the shared code represents one behavioral contract, prevents likely drift, or already has multiple real consumers. Prefer composition and explicit delegation over parameter-heavy abstractions.
- When one member of a sibling family changes, inspect the others before completion. Either update them to use the same owner or document through code structure and tests why the behavior is domain-specific; do not rely on a prose comment to excuse otherwise identical implementations.
- Preserve performance characteristics while consolidating paths. Shared code must not turn pre-paint work into deferred work, cause hidden views to render eagerly, add duplicate requests, or make route-specific dependencies load globally without measured justification.
- Test the extracted contract directly and retain integration coverage for each materially different entry path. Include accessibility state and trust-boundary behavior when the shared contract renders external data or controls interactive UI.

## Compatibility And Code Retirement

- Treat removal as part of the implementation, not a future cleanup phase. When a new JavaScript path replaces an old path, search definitions, references, script lists, globals, browser-module manifests, adapters, tests, fixtures, configuration, validators, service-worker resources, documentation, and generated-resource policy before declaring the refactor complete.
- Classify each old surface as a current supported contract, a temporary migration boundary, or obsolete. Remove obsolete classes, methods, branches, aliases, fallback shapes, feature flags, constants, globals, adapters, and dependencies together with the tests and documentation that exist only to support them.
- Do not keep browser code for test fixtures. Update fixtures and browser-module manifests to the current published contract unless they deliberately cover a verified public compatibility requirement.
- Compatibility requires evidence of a current consumer. A repository test, stale documentation, historical payload, hypothetical downgrade, or unreferenced export does not establish that requirement. Inspect runtime consumers, published data/contracts, persisted browser state, service-worker handoff behavior, and any documented external caller before preserving it.
- When compatibility is genuinely required, isolate it at the narrowest boundary and document the consumer, accepted legacy scope, migration owner, and objective removal condition. Add focused coverage for both migration and eventual rejection; do not let a broad model or manager carry an indefinite second representation.
- Validation and consumption must agree. Never accept a legacy payload, status, option, or field that the downstream manager silently ignores or converts into an empty successful result.
- After removal, search for the retired symbols and values, verify unsupported legacy input fails or is intentionally migrated, and run the focused current-contract and alternate-path tests. Remove newly unused script tags, globals, dependency declarations, cache entries, and test-loader registrations.
- Preserve immutable historical annual assets and published release history. Retiring runtime compatibility does not authorize rewriting archived source data or dated visitor-facing records.

## Style Rules

- Target ECMAScript 2023 (`ES2023`) for delivered JavaScript, Node scripts, tests, and the service worker. Keep `jsconfig.json` `target`/`lib` and every `eslint.config.js` `ecmaVersion` aligned to that baseline.
- Browser JavaScript is delivered without transpilation. Do not use syntax or APIs newer than ES2023 unless the browser-support baseline is reviewed, runtime compatibility is verified, and the JavaScript and ESLint configuration are upgraded together.
- Prefer `const` over `let`. Never use `var`.
- Use strict equality (`===`, `!==`).
- Use template literals for string interpolation.
- Name classes in PascalCase, functions/variables in camelCase, constants in UPPER_SNAKE_CASE.
- Group module-level constants by domain, keep related source and derived constants together, and alphabetize independent fixed keys or allowlist values when order has no semantic meaning.
- Prefix validation sets with `ALLOWED_` so trust-boundary allowlists are easy to identify and audit.

## JSDoc And Code Clarity

- Give every named class, constructor, class method, and named function a directly associated `/** ... */` JSDoc block. This includes closure-private named helpers in browser entry scripts; anonymous callbacks and the IIFE wrapper expression itself do not need JSDoc.
- Start each JSDoc block with a concise behavioral summary that explains responsibility or contract. Do not merely restate the symbol name or narrate its implementation line by line.
- Document every declared parameter with the exact parameter name, including defaulted, optional, rest, destructured, callback, and options-object parameters. Describe meaningful option properties when callers need them to use the API correctly.
- Add `@returns` to every function or method that returns a value. Use `Promise<T>` for async results and omit `@returns` for functions that intentionally return no value unless an explicit `void` contract prevents ambiguity.
- Add `@throws` only when callers can observe an intentional thrown error. Do not document errors that are caught internally or invent guarantees that the implementation does not enforce.
- Mark underscore-prefixed and clearly internal class or closure helpers with `@private`. Do not mark a symbol private when another delivered script consumes it through the classic-script global boundary.
- Prefer existing typedefs, literal unions, DOM types, and named record shapes from `src/js/types/`. Use an honest broad type such as `Object`, `Array`, or `*` when no stable narrower contract exists; do not invent undefined type names merely to appear precise.
- Keep JSDoc synchronized when signatures, return shapes, async behavior, semantic states, or thrown errors change. A behavior change is incomplete when its documentation still describes the old contract.
- Use descriptive names and small, cohesive functions so control flow is understandable without explanatory comments. Extract complex domain decisions into models or services instead of compensating for tangled code with long comments.
- Reserve inline comments for non-obvious constraints, compatibility boundaries, trust decisions, or algorithmic intent. Remove stale, redundant, banner-style, and line-by-line narration when nearby names and JSDoc already make the code clear.
- Keep abstraction boundaries visible: models represent domain data, services own reusable behavior, managers coordinate collections, and browser entry points translate semantic state into DOM presentation. Do not hide cross-layer work behind vague helpers such as `processData` or `handleStuff`.

## Constant Ownership

- Constants and enums are the default, not an optional cleanup. Before writing behavior, inventory its application-owned states, statuses, actions, modes, categories, result kinds, hazards, event names, storage keys, routes, durations, and other values used in branching, validation, persistence, rendering decisions, tests, or module-boundary data. Search for an existing semantic owner before adding a value.
- Do not introduce raw string or numeric literals for behavior-bearing values. Give each value one semantic owner and reference that owner in producers, consumers, validators, rendering maps, caches, fixtures, and assertions. A repeated behavior literal, or a raw literal compared outside its owner, must be resolved before the change is complete.
- Use an immutable enum in `src/js/types/` for a closed set of related runtime values that crosses module boundaries or drives branching, such as statuses, actions, and modes. Use a named module-local constant for a single-file implementation value and shared configuration for a fixed value consumed across broader application boundaries.
- Put normalization, membership validation, accepted aliases, and stable ordering on the semantic owner when they define that value set. Consumers should ask the owner to interpret values instead of recreating regular expressions, arrays, switches, or allowlists.
- Type enum values and the objects that carry them with JSDoc literal unions, typedefs, or named shapes. Prefer validation helpers on the semantic owner over rebuilding literal arrays or allowlists in each consumer.
- Keep semantic values separate from their labels, CSS classes, colors, icons, and accessibility copy. Map enum or constant values to presentation only at the rendering boundary; never infer semantic state by reading presentation values back.
- Keep a constant module-local when only one script owns the value or when the value is an implementation detail, such as a debounce duration, validation pattern, private allowlist, or DOM selector.
- Define a constant once in `src/js/config/app-config.js` when multiple delivered scripts, the service worker, generated views, tests, or cleanup registries share the same value. Export it through `RUNTIME_CONFIG` when browser runtime code consumes it.
- Do not repeat a shared string, storage key, route, filename, duration, or other fixed value in consumers. Reference the named configuration constant and derive related collections, such as `APP_LOCAL_STORAGE_KEYS` and `APP_SESSION_STORAGE_KEYS`, from those constants.
- Use descriptive `UPPER_SNAKE_CASE` names that identify both purpose and kind, such as `SERVICE_WORKER_UPDATE_CHECKED_AT_STORAGE_KEY`. Avoid vague aliases that merely rename an exported constant inside a consumer.
- Browser scripts should read exported runtime constants from `window` or `globalThis`; Node code should import them from `src/js/config/app-config.js`. Add a bare script global to `eslint.config.js` only when direct global access is intentional and established by the surrounding module.
- Add focused regression coverage when introducing or moving a shared constant. Verify its exported value, its membership in any derived registry, and consumer use when duplicated literals would create behavioral drift.

Before completing a JavaScript change, review every added string and number used by executable behavior. Confirm that each one is either referenced through its semantic owner or belongs to one of the explicitly allowed literal categories below.

Hard-coded literals remain appropriate when they are not application-owned semantics: one-off visitor-facing copy, DOM selectors and attribute names, standardized browser or language values, external protocol tokens, and values read from annual data or its schemas. Do not create aliases that only rename these values without adding ownership, typing, validation, or drift prevention.

## File Header Comments

- Leave at least one empty line between a top-of-file comment and the first statement.
- Keep top-of-file comments concise but informative. Summarize the module's primary responsibility and add a short note about its main boundary, collaborator, or output when that context helps orient the reader.
- Prefer two or three focused lines over a one-sentence label or a paragraph.

## Testability

- Keep DOM-free logic in services/models so it can be tested with Node.js.
- Test browser modules through `tests/helpers/browser-module-loader.js` and its explicit dependency manifests. Use fresh realms and explicit injection or bridging for test dependencies; do not add CommonJS exports or Node.js dependency branches for test access.
- Design public return values around semantic state so tests and consumers do not need to infer behavior from labels, CSS classes, complete HTML strings, or log messages.
- Keep presentation formatting at focused rendering boundaries. Test an exact formatter result when serialization is the formatter's contract, but make higher-level tests assert that fixture-owned values, semantic attributes, accessibility state, and safe destinations flow through correctly without repeating mutable copy.
- Services and models must not reference `$`, `document`, or `window` directly.
- Published annual pool/team/meet names and schema enum vocabularies come from annual data and schemas; do not mirror them in JavaScript enums for validation or behavior.

## Analytics Privacy Boundary

- Analytics may report public page counts, reviewed fixed campaign labels on app-published inbound links, coarse feature-use categories, annual-data-validated favorite pool and team selections, and annual-data-validated public pool identities for pool-specific interactions; public pool identities are directory facts rather than visitor-identifying data. Do not introduce account identifiers, contact data, coordinates, application-stored device values, other selected preference values, user-entered strings, arbitrary URL query/fragment content, or referrer data.
- Favorite pool and team analytics may report one selection only after validating it against the currently published annual data, or the fixed `none` value when cleared. Do not track filter values, themes, layouts, refresh values, location choices, or any other selected settings; those settings may report the changed category only.
- Keep Google tag measurement purpose-limited and reportable: grant `analytics_storage` so Google Analytics can use its own first-party analytics identifier for aggregate visit and session reporting; deny advertising storage, Google signals, and ad personalization; and strip referrers, query strings, and fragments from app-authored page measurement. An approved campaign link may map its validated, allowlisted UTM tuple to GA campaign fields after those tags are removed from the visible URL for aggregate source attribution. Do not send full tagged page locations, arbitrary campaign input, or app-authored identifiers intended to identify or profile a visitor. Do not change `analytics_storage` to denied or enable additional GA4 enhanced measurement events unless separately reviewed under this same boundary.
- Publish feature interactions through `cnslAnalytics.trackInteraction(AnalyticsInteractionType.TYPE, parameters)`. Load shared runtime enums before their consumers, and keep event-specific validation and Google event publication private to the analytics module rather than exposing additional tracking methods.
- Add regression coverage for every new analytics event or configuration change.
