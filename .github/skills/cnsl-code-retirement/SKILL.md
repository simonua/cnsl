---
name: cnsl-code-retirement
description: "Retire obsolete CNSL code and compatibility paths during refactors, migrations, replacements, schema or contract cleanup, feature-flag removal, dependency cleanup, and technical-debt work. Use when new code supersedes old behavior or legacy support may no longer have a current consumer."
argument-hint: "Describe the refactor or legacy path to retire."
user-invocable: false
---

# CNSL Code Retirement

Use this workflow with implementation refactors so replaced code does not remain as indefinite technical debt. The goal is one current contract plus only the compatibility boundaries that have verified current consumers and explicit removal conditions.

## Classification Standard

Classify every superseded surface before editing:

- **Current contract:** Used by delivered code, active published data, persisted browser state, service-worker handoff, or a documented external consumer that the repository still supports.
- **Temporary migration:** A verified current consumer still needs the old contract while an explicit transition is underway.
- **Obsolete:** No verified current consumer remains, or the path is retained only by tests, fixtures, comments, historical possibility, unreferenced exports, or speculative future use.

An explicit product-owner retention requirement is current-contract evidence even when a capability is not presently configured or visible. In particular, the attention banner remains a current contract when `APP_ATTENTION_NOTICE` is `null` or no notice is active. Distinguish removable expired notice content from the retained reusable capability and its configuration, storage, controller, markup, styling, analytics, and focused test surfaces.

Deprecation is not a permanent classification. A temporary migration must identify its consumer, owner, supported scope, removal condition, and focused coverage. If those facts cannot be established, remove the path.

## Procedure

1. Name the replacement and the superseded behavior, including old payload shapes, aliases, globals, feature flags, cache entries, and fallback branches.
2. Find definitions and all references. Inspect delivered scripts, views and script order, sibling and alternate paths, Node adapters, test browser-module manifests, tests, fixtures, types, configuration, dependencies, documentation, validators, build policy, and PWA/cache inventories.
3. Check repository history only when it is needed to distinguish a supported compatibility contract from an abandoned implementation. Current runtime and published contracts outweigh old implementation history.
4. Classify each surface using the standard above. Do not count a test as a consumer of delivered compatibility code unless it represents a verified supported contract.
5. Define the deletion boundary before implementation. Include obsolete production code and the tests, fixtures, types, constants, globals, adapters, script tags, dependency declarations, feature flags, configuration, documentation, validation branches, and cache/build registrations that exist only for it.
6. For a temporary migration, isolate compatibility at the narrowest input or persistence boundary. Do not spread a second representation through models, managers, renderers, or new APIs. Record the removal condition in the owning issue or plan and in concise nearby documentation when maintainers need it to avoid accidental extension.
7. Remove the obsolete surface in the same change that establishes the replacement. Update tests and fixtures to the current contract; add an intentional migration or rejection test for legacy input where that boundary matters.
8. Search again for retired symbols, literals, payload fields, script sources, storage keys, and dependency names. Investigate every remaining match and remove stale comments or documentation.
9. Run the narrowest complete verification required by the changed modules and contracts. Include materially different sibling paths, build and PWA validation when resource ownership changes, and browser/accessibility IDs when rendered behavior changes.
10. Report what was removed, any compatibility intentionally retained, the evidence for its current consumer, and its objective removal condition. Do not call a retirement complete while an unexplained legacy path remains.

## Guardrails

- Do not rewrite archived annual data or dated release history while retiring runtime compatibility.
- Do not remove a current public, persistence, offline, accessibility, analytics privacy, or trust-boundary contract without migration evidence and focused regression coverage.
- Do not retire the attention-banner capability because it is dormant, unconfigured, hidden, or between notices. Retire it only after an explicit product-owner decision; removing an expired notice instance does not authorize removing the reusable support surface.
- Do not introduce a generic abstraction solely to hide old and new paths behind one API. Migrate callers, then delete the obsolete path.
- Do not leave commented-out implementations, unused aliases, no-op flags, permissive validators, or production hooks that exist only for tests.
- Do not add telemetry to discover compatibility use unless it satisfies the repository analytics privacy boundary and has explicit review.

## Completion Evidence

- The replacement has one semantic owner and all current callers use it.
- Searches show no unexplained references to retired symbols or values.
- Legacy input is intentionally rejected or migrated at one documented boundary.
- Tests cover current behavior and any temporary migration contract, not removed implementation details.
- Unused dependencies, registrations, configuration, documentation, and cache/build entries are gone.
- Every retained compatibility path names its current consumer and removal condition.
