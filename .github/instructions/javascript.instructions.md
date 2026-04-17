---
applyTo: "src/js/**/*.js"
---

# JavaScript Conventions

## Module Pattern

- All browser JS uses `<script>` tag loading (no bundler, no ES modules).
- Classes and functions become globals. Declare them with `class` or `function` at the top level.
- Use the singleton pattern for managers: expose a `getXxxManager()` factory that caches the instance.
- Standardize on `getDataManager()` for DataManager access — never `new DataManager()` directly.

## jQuery

- Use jQuery selectors (`$('#id')`, `$('.class')`) over vanilla DOM APIs.
- Use full (non-minified) jQuery. Do not add minified builds.
- Prefer `$(document).ready()` or `$(() => { })` for initialization.

## Code Organization

- **Models** (`src/js/models/`): Data classes (e.g., `Pool`). No DOM access.
- **Services** (`src/js/services/`): Reusable logic (e.g., `TimeUtils`, `CacheService`). No DOM access.
- **Types** (`src/js/types/`): Enums and constants (e.g., `PoolStatus`, `PoolNames`).
- **Config** (`src/js/config/`): Configuration values.
- **Managers** (`src/js/`): Orchestrators that coordinate services and models (e.g., `PoolsManager`).
- **Browsers** (`src/js/`): UI rendering modules that read from managers and write to the DOM.

## Style Rules

- Prefer `const` over `let`. Never use `var`.
- Use strict equality (`===`, `!==`).
- Use template literals for string interpolation.
- Name classes in PascalCase, functions/variables in camelCase, constants in UPPER_SNAKE_CASE.

## Testability

- Keep DOM-free logic in services/models so it can be tested with Node.js.
- Export via `if (typeof module !== 'undefined') module.exports = { ... }` for Node.js test access.
- Services and models must not reference `$`, `document`, or `window` directly.
