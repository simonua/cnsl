---
applyTo: "tests/**/*.js"
description: "Use when writing or modifying unit tests. Covers test patterns, structure, and conventions."
---

# Testing Conventions

## Framework

- Node.js built-in test runner (`node:test` module).
- Tests are in `tests/` mirroring the `src/js/` structure.
- Test files are named `*.test.js`.

## Structure

```
tests/
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

- Test only DOM-free logic (services, models, types, managers).
- Each test file covers one source module.
- Use `describe` blocks to group by class/function, nested `describe` for methods.
- Use descriptive `it` strings: "should return X when given Y".
- No mocking frameworks — use simple stubs when needed.
- Tests must run without a browser (Node.js only).
