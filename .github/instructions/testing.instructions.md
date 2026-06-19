---
applyTo: "tests/**/*.js"
description: "Use when writing or modifying tests. Covers test patterns, structure, and conventions."
---

# Testing Conventions

## Philosophy

- Tests should fail when behavior, semantic contracts, trust boundaries, accessibility, or integration wiring breaks. They should not fail only because visitor copy, diagnostic prose, markup serialization, CSS structure, logging language, or mutable published data changed without altering the tested behavior.
- Keep confidence high through representative positive, negative, boundary, fallback, and hostile-input cases. Loosening incidental presentation coupling must not remove branch coverage or reduce an assertion to a truthiness check when a stronger semantic, relational, or structural invariant is available.
- Assert at the narrowest stable public boundary. Prefer returned semantic state, normalized records, observable side effects, safe destinations, accessibility state, and relationships between inputs and outputs over private helpers, internal call order, or implementation choreography.

## Framework

- Unit tests use the Node.js built-in test runner (`node:test` module).
- Browser workflow and accessibility tests use Playwright with axe against the built artifact.
- Unit tests mirror the `src/js/` structure and are named `*.test.js`; browser tests live in `tests/browser/` and are named `*.spec.js`.

## Execution Scope

- Every local test command must explicitly name the test files, browser specs, or stable browser-test IDs that cover the current changes. A focused passing run is sufficient completion evidence for a focused change.
- Derive the initial scope from the diff: include each changed test file, the test file matching each changed source module, and tests for directly affected shared contracts or materially different entry paths. Do not add unrelated tests merely because they are inexpensive or likely to pass.
- Start with the smallest complete behavioral scope. Widen only by naming additional specific files or IDs when imports, manifests, shared ownership, a failure, or observed behavior demonstrates that they are affected. Widening does not mean switching to an all-tests command.
- Use `node --test tests/<area>/<module>.test.js [additional-affected.test.js]` for unit tests. Use `node scripts/run-playwright.js test <spec> --grep "<stable IDs>"` for browser or accessibility coverage.
- When focused coverage measurement is required, limit both coverage collection and test execution to the changed delivered modules and their affected tests. For example: `node --experimental-test-coverage --test-coverage-lines=100 --test-coverage-functions=100 --test-coverage-branches=100 --test-coverage-include=src/js/services/example.js --test tests/services/example.test.js`.
- Do not run `pnpm test`, `pnpm run test:coverage`, or `pnpm run test:browser:complete` as an automatic local completion step. Those broad commands are reserved for CI or an explicitly requested full-suite investigation.
- Report the exact test files and browser IDs executed. Never imply that unrelated tests were run.

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
      const input = { id: 'fixture-record', enabled: true };
      const result = MyClass.methodName(input);
      assert.equal(result.id, input.id);
      assert.equal(result.enabled, true);
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
- Keep workflow specs in `tests/browser/workflows/` and name each file for its stable `WF` area. Run only the affected area or IDs through the serialized runner, such as `node scripts/run-playwright.js test tests/browser/workflows/<area>.spec.js --grep "WF-<AREA>-00[12]"`.
- Keep every `[WF-*]` and `[AX-*]` reference ID unique across the browser suite. Preserve an existing ID when its wording or implementation changes, and use the next unused area number for genuinely new coverage. The unit-test gate validates uniqueness.
- Classify every exact unit or browser expectation before adding it as one of: a stable semantic/application contract, a deterministic fixture-owned transformation result, or mutable/presentational output. Exact values are appropriate for the first two categories only. Formatting helpers may use exact output when formatting is their direct contract; broader workflow and renderer tests should not repeat those same strings.
- Treat active annual pool, team, meet, lesson, and guidance records as mutable published data in every test layer. Tests that load those records directly may assert schema-derived invariants, referential relationships, nonempty semantic structure, safe destinations, accessibility state, and user-visible behavior; they must not pin a particular entity, count, date, matchup, schedule, external URL, or prose value merely because it is present in the current season.
- Own scenario values in the test. Use small deterministic records with distinctive values, then assert that outputs preserve, normalize, filter, order, escape, or reject those values as required. Do not copy a production record into the expected result or turn current application data into an accidental fixture.
- Test exact filtering, ordering, formatting, timing, enrichment, and edge-case transformations with small deterministic inputs owned under `tests/browser/fixtures/` or installed through shared browser-test route helpers. Intercept every annual domain that materially affects the expected result so unrelated published records cannot alter the scenario.
- Do not calculate an exact expected rendering from the same unmodified production payload consumed by the page. That only repeats the implementation input and can hide defects. Comparing two independently rendered surfaces or checking a clear relational invariant, such as sorted order or a summary count matching visible records, is appropriate.
- Use the active year and annual request patterns from `tests/browser/browser-test-helpers.js`; do not embed a calendar year in browser routes. Fixed dates are appropriate inside deterministic scenarios, but construct them through the active-season date helper or derive them from fixture metadata.
- Do not use mutable success prose as the general page-readiness primitive. Wait for semantic completion such as `aria-busy="false"`, the expected collection structure, a response boundary, or a stable application state. Assert exact success or failure copy only when that message is itself the behavior under test.
- Use exact text for security and privacy disclosures, analytics schemas, storage and protocol contracts, accessibility names, validation or recovery messages, and fixture-owned formatting behavior only when wording or serialization is intentionally part of the reviewed contract. Cover that wording once at its owner; consumers should assert semantic state and placement rather than repeat the copy.
- For generated markup, verify semantic attributes, relationships, escaped fixture values, allowlisted destinations, omission of unsafe input, and meaningful ordering. Do not pin a complete HTML string, incidental wrapper hierarchy, CSS class, icon choice, or static heading unless that exact structure is an accessibility, styling, security, or integration contract. Prefer structured DOM assertions in browser tests when general markup shape matters.
- For errors, warnings, and logs, prefer error types, codes, structured fields, affected records, counts, and state transitions. If an API exposes only prose, match the minimum stable diagnostic invariant and offending fixture value rather than the whole sentence or punctuation.
- Assert exact collection counts and order only when cardinality or order is the behavior under test. Otherwise, assert membership, uniqueness, subset relationships, sorting invariants, or correspondence with fixture inputs.
- Avoid snapshots and large serialized-object expectations for behavior already expressible through focused invariants. Do not assert private helper calls, stub invocation order, or intermediate object shape unless that boundary is itself a supported contract.
- Use `describe` blocks to group by class/function, nested `describe` for methods.
- Use descriptive `it` strings: "should return X when given Y".
- No mocking frameworks — use simple stubs when needed.
- Never require a file under `src/js/` directly. Add or reuse an explicit manifest in `tests/helpers/browser-module-loader.js`, inject dependencies before loading, and use the returned realm for mutable browser globals.
- Keep each browser-module manifest's script order aligned with production: providers of classic-script globals must appear before their consumers. When delivered code gains a new global dependency, add and hoist that provider in both the production route or loader and every affected test manifest in the same change.
- Unit tests must run without a browser; browser specs require a prior `pnpm run build`. Run focused Playwright coverage only when changed behavior requires a real browser. GitHub Actions runs the complete serialized browser suite in the scheduled workflow after a push to `main` in the preceding seven days or a manual dispatch; that separate broad result does not block deployment.
