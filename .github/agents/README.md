# Repository Agents and Skills

This directory contains CNSL's repository-specific GitHub Copilot agent profiles. The profile files are the source of truth for each agent's workflow, boundaries, allowed edits, and verification. This catalog is a routing guide and should be updated whenever an agent or repository skill is added, removed, or materially re-scoped.

All agents follow the repository-wide [Copilot instructions](../copilot-instructions.md) and the path-specific instructions under [`.github/instructions/`](../instructions/).

## Agent Routing

| Agent | Primary responsibility | Use when | Do not use for | Repository skills |
| --- | --- | --- | --- | --- |
| [`meet-guidance-updater`](meet-guidance-updater.agent.md) | Converts a supplied team-manager communication into active-season My Meet Day guidance, preserves provenance and privacy, and verifies home-team and away-team output. | Parking, setup, check-in, warm-ups, concessions, or venue guidance supplied by an identified team manager or equivalent field owner. | Comprehensive online seasonal-source monitoring or unrelated annual-data changes. | Required: [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md) for annual-data authority, evidence, schema, and validation rules. |
| [`season-data-reviewer`](season-data-reviewer.agent.md) | Reviews candidate changes from official seasonal sources, resolves evidence authority and confidence, updates represented annual data when justified, and refreshes review records. | Nightly monitor findings, current official-source checks, changed official PDFs or destinations, and verified pool, meet, or team data corrections. | Manager-supplied operational guidance or general application refactoring. | Required: [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md). Conditional: [`cloudflare-verification-handoff`](../skills/cloudflare-verification-handoff/SKILL.md) if an authorized browser source presents human verification. |
| [`refactoring-auditor`](refactoring-auditor.agent.md) | Assesses engineering health, technical debt, obsolete compatibility paths, accessibility, data integrity, delivery, testing, security, and measured performance opportunities. Updates only the refactoring plan. | Evidence-based refactoring audits and priority planning. | Implementing recommendations, changing annual source data, or modifying application code during the audit. | Consult [`cnsl-code-retirement`](../skills/cnsl-code-retirement/SKILL.md) when evaluating superseded or legacy paths. The auditor plans retirement; implementation happens in a separate task. |
| [`version-update`](version-update.agent.md) | Maintains the undated What's New section for significant unreleased work and publishes release metadata only when a stable release is explicitly requested. | Significant visitor-facing functionality, release-note review, semantic version publication, or release-date metadata maintenance. | Ordinary data corrections, engineering-only changes, or silently rewriting published release history. | No dedicated repository skill. Follow the agent profile and [`docs/release-checklist.md`](../../docs/release-checklist.md) for release mode. |

## Responsibility Boundaries

### Meet Guidance Updater

- Owns a directly supplied manager communication from interpretation through local My Meet Day output verification.
- Maps facts to shared, home-team, or visiting-team audiences and excludes personal or manager-only coordination details.
- Changes only the matching host team's active-season guide and its required evidence records unless a reusable behavior contract also needs focused coverage.
- Defaults to local working-tree edits; publication requires an explicit request.

### Seasonal Data Reviewer

- Owns live official-source coverage, bounded evidence review, confidence classification, and accepted active-season source corrections.
- Updates modeled data or schemas only with high-confidence official evidence and records unresolved conflicts without guessing.
- Refreshes completed-review timestamps and the reviewed source baseline according to the seasonal-data contract.
- Defaults to local review; branch, push, and pull-request work require an explicit publication request.

### Refactoring Auditor

- Owns assessment and prioritization, including maintainability, code retirement, accessibility, security, PWA behavior, testing, and measurement-led performance review.
- Maintains only [`docs/refactoring-plan.md`](../../docs/refactoring-plan.md), removes completed findings, and keeps recommendations evidence-based.
- Does not implement refactors or modify application, workflow, dependency, configuration, or annual-data files.
- Defaults to a local plan update; publishing the plan requires an explicit request.

### Version Update

- Owns visitor-facing release notes and release metadata while protecting dated release history.
- Uses Upcoming mode unless the user explicitly requests a stable release.
- In release mode, promotes completed Upcoming items, adds a new dated release entry, and updates application version metadata.
- Does not change annual source-of-truth data or generated output.

## Repository Skills

| Skill | Invocation | Purpose | Used by |
| --- | --- | --- | --- |
| [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md) | User-invocable | Prepares, audits, validates, or activates annual pool, meet, and team assets using the repository's evidence and source-authority rules. | `meet-guidance-updater`, `season-data-reviewer`, and any direct annual-season task. |
| [`cnsl-code-retirement`](../skills/cnsl-code-retirement/SKILL.md) | Internal workflow | Classifies and removes obsolete code, compatibility paths, fixtures, dependencies, documentation, and registrations when a current implementation supersedes them. | Refactor implementations; consulted by `refactoring-auditor` for retirement findings. |
| [`cloudflare-verification-handoff`](../skills/cloudflare-verification-handoff/SKILL.md) | User-invocable | Pauses an authorized browser task for the user to complete human verification, then safely resumes the original task. | Any authorized browser workflow interrupted by Cloudflare, Turnstile, CAPTCHA, or another human-verification challenge. |

## Maintenance

When changing an agent or skill:

1. Update the authoritative profile or `SKILL.md` first.
2. Update the routing row, responsibility summary, or skill mapping here when its public purpose or boundary changed.
3. Keep names and links aligned with frontmatter so agents and skills remain discoverable.
4. Run focused Markdown validation for every changed Markdown file.
