---
applyTo: "tests/**/*.js"
description: "Use when writing or modifying unit tests. Covers test patterns, structure, and conventions."
---

# Testing Conventions

## Framework

- Unit tests use the Node.js built-in test runner (`node:test` module).
- Browser workflow and accessibility tests use Playwright with axe against the built artifact.
- Unit tests mirror the `src/js/` structure and are named `*.test.js`; browser tests live in `tests/browser/` and are named `*.spec.js`.

## Structure

```text
tests/
├── browser/
│   ├── accessibility.spec.js # Playwright + axe route checks
│   ├── browser-test.js       # Shared Playwright fixtures
│   └── workflows/            # Workflow specs grouped by stable WF area
│       ├── analytics.spec.js
│       ├── data.spec.js
│       ├── navigation.spec.js
│       └── ...
├── services/
│   ├── time-utils.test.js
│   ├── cache-service.test.js
│   └── ...
├── models/
│   ├── pool.test.js
│   └── ...
├── types/
│   └── pool-enums.test.js
└── helpers/
    └── test-helpers.js       # Shared test utilities
```

## Patterns

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MyClass } = require('../helpers/browser-module-loader.js').loadBrowserModule('my-service');

describe('MyClass', () => {
  describe('methodName', () => {
    it('should do the expected thing', () => {
      const result = MyClass.methodName('input');
      assert.strictEqual(result, 'expected');
    });
  });
});
```

## Rules

- Keep `*.test.js` tests DOM-free (services, models, types, managers).
- Use `tests/browser/*.spec.js` only for delivered page behavior that needs a real browser, including focus, semantic state, and automated accessibility inspection.
- Prefix browser workflow titles with a stable reference ID in the form `[WF-<AREA>-NNN]`, such as `[WF-AGENDA-003]`; prefix browser accessibility titles with `[AX-<AREA>-NNN]`. Parameterized route or theme variants append an uppercase suffix, such as `[AX-PAGE-001-HOME-LIGHT]`.
- Keep an existing browser-test reference ID when wording or assertions change. Allocate the next unused number within that behavior area for new coverage so CI failures and review notes can cite a durable handle.
- Each unit test file covers one source module; each browser spec covers one cohesive user workflow or verification category.
- Keep workflow specs in `tests/browser/workflows/` and name each file for its stable `WF` area. Run one area through the serialized runner with `node scripts/run-playwright.js test tests/browser/workflows/<area>.spec.js`.
- Keep every `[WF-*]` and `[AX-*]` reference ID unique across the browser suite. Preserve an existing ID when its wording or implementation changes, and use the next unused area number for genuinely new coverage. The unit-test gate validates uniqueness.
- Classify every exact browser expectation before adding it as one of: a stable application contract, a value owned by a deterministic test fixture, or mutable published data. Exact values are appropriate for the first two categories only.
- Treat active annual pool, team, meet, lesson, and guidance records as mutable published data. Browser tests that load those records directly may assert schema-derived invariants, nonempty semantic structure, safe destinations, accessibility state, and user-visible behavior; they must not pin a particular entity, count, date, matchup, schedule, external URL, or prose value merely because it is present in the current season.
- Test exact filtering, ordering, formatting, timing, enrichment, and edge-case transformations with small deterministic inputs owned under `tests/browser/fixtures/` or installed through shared browser-test route helpers. Intercept every annual domain that materially affects the expected result so unrelated published records cannot alter the scenario.
- Do not calculate an exact expected rendering from the same unmodified production payload consumed by the page. That only repeats the implementation input and can hide defects. Comparing two independently rendered surfaces or checking a clear relational invariant, such as sorted order or a summary count matching visible records, is appropriate.
- Use the active year and annual request patterns from `tests/browser/browser-test-helpers.js`; do not embed a calendar year in browser routes. Fixed dates are appropriate inside deterministic scenarios, but construct them through the active-season date helper or derive them from fixture metadata.
- Do not use mutable success prose as the general page-readiness primitive. Wait for semantic completion such as `aria-busy="false"`, the expected collection structure, a response boundary, or a stable application state. Assert exact success or failure copy only when that message is itself the behavior under test.
- Use exact text for security and privacy messages, analytics schemas, storage and protocol contracts, accessibility names, validation or recovery messages, and fixture-owned formatting behavior when wording is intentionally part of the contract. Prefer roles, states, attributes, relationships, and structural assertions for general workflow coverage.
- Use `describe` blocks to group by class/function, nested `describe` for methods.
- Use descriptive `it` strings: "should return X when given Y".
- No mocking frameworks — use simple stubs when needed.
- Never require a file under `src/js/` directly. Add or reuse an explicit manifest in `tests/helpers/browser-module-loader.js`, inject dependencies before loading, and use the returned realm for mutable browser globals.
- Keep each browser-module manifest's script order aligned with production: providers of classic-script globals must appear before their consumers. When delivered code gains a new global dependency, add and hoist that provider in both the production route or loader and every affected test manifest in the same change.
- Unit tests must run without a browser; browser specs require a prior `pnpm run build`. Do not run Playwright during ordinary local iteration or the general release gate. After a significant implemented refactor affecting delivered application behavior or browser-facing contracts, run `pnpm run test:browser:nightly` as required completion verification. GitHub Actions also runs that serialized command in the weekly browser workflow after a push to `main` in the preceding seven days or a manual dispatch; that separate result does not block deployment.
