# CNSL Engineering Refactoring Plan

Review date: 2026-06-22

## Current Status

No actionable refactoring opportunity remains after the 2026-06-22 implementation and focused verification. Create a new recommendation only when current evidence identifies a concrete defect, obsolete contract, or measured visitor benefit.

The attention banner is an explicitly retained application capability. Its active configuration is currently `null`, so no notice is displayed, but the reusable configuration, storage, controller, semantic markup, theme styles, analytics allowlist, and focused browser coverage are current supported surfaces. An expired notice instance does not make that capability obsolete.

## Priority Matrix

| Priority | Actionable Finding | Impact | Effort |
| --- | --- | --- | --- |
| **RED - High** | None | No demonstrated accessibility, data-integrity, security, release, or material correctness defect | None |
| **ORANGE - Medium** | None | No active simplification has a demonstrated contract or maintenance benefit | None |
| **GREEN - Low** | None | No standalone cleanup is meaningful enough to retain | None |

## Monitored Boundaries

These are current migration contracts with future review conditions, not active refactoring work:

| Surface | Current Owner | Review Condition |
| --- | --- | --- |
| Analytics predecessor storage candidates | `analytics.js` | Reassess after the full 2027 season and remove only when the source-recorded report condition is satisfied |
| `practiceAgeGroups` preference input | `PreferencesService` | Remove no earlier than 2027-10-01 with focused migration and current-contract coverage |

## Evidence-Based Exclusions

Current evidence does not support a framework or bundler migration, annual-document split, per-card annual requests, persistent model cache, schedule index, `content-visibility`, incremental rendering, or virtualization. Active collections remain small, `DataManager` shares each annual-domain request, Pool construction is inexpensive, and collapsed Pool, Team, and Meet details remain empty until requested.

Generated-markup and URL reviews found contextual escaping, destination validation, and hostile-input coverage at the inspected annual-data, storage, and query-parameter boundaries. Browser coverage exercises semantic disclosure state, keyboard focus, loading announcements, and WCAG A/AA scans. Delivered-site HTTPS, manual assistive-technology, and field-device checks remain release activities rather than refactoring findings.

## Guardrails

- Retain the attention-banner capability unless the product owner explicitly changes this requirement. A dormant `APP_ATTENTION_NOTICE` value means no active message; it is not removal evidence.
- Do not restore the expired June notice or embed inactive notice copy in shared HTML. Future notices must use the nullable runtime contract and safe text population.
- Keep revision-scoped dismissal, expiry, non-dismissible mode, storage-failure resilience, fixed analytics vocabulary, semantic markup, and light/dark/high-contrast coverage together as one supported behavior.
- Do not introduce a framework, bundler, data-schema, or runtime-validation migration without separate current evidence and review.
