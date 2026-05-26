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

```
tests/
├── browser/
│   ├── accessibility.spec.js # Playwright + axe route checks
│   └── workflows.spec.js     # Keyboard, live-status, and settings flows
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
const { MyClass } = require('../../src/js/services/my-service');

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
- Each unit test file covers one source module; each browser spec covers one cohesive user workflow or verification category.
- Use `describe` blocks to group by class/function, nested `describe` for methods.
- Use descriptive `it` strings: "should return X when given Y".
- No mocking frameworks — use simple stubs when needed.
- Unit tests must run without a browser; browser specs require a prior `pnpm run build`. Do not run Playwright during local development or release verification. GitHub Actions runs `pnpm run test:browser:nightly` only in the nightly browser workflow when `main` has changed since its preceding scheduled run; that separate result does not block deployment.
