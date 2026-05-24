---
applyTo: "src/js/**/*.js"
---

# JavaScript Conventions

## Module Pattern

- All browser JS uses `<script>` tag loading (no bundler, no ES modules).
- Classes and functions become globals. Declare them with `class` or `function` at the top level.
- Use the singleton pattern for managers: expose a `getXxxManager()` factory that caches the instance.
- Standardize on `getDataManager()` for DataManager access — never `new DataManager()` directly.

## DOM APIs

- Use native DOM APIs (`document.getElementById`, `querySelector`, and event listeners) consistently with the existing controllers.
- Do not add a DOM library for new behavior unless a broader architecture decision explicitly introduces one.
- Prefer `DOMContentLoaded` for initialization when a deferred script is not sufficient.

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
