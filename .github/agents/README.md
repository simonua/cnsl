# Repository Agents, Skills, and Instructions

This directory contains CNSL's repository-specific GitHub Copilot agent profiles. The profile files are the source of truth for each agent's workflow, boundaries, allowed edits, and verification. This catalog is a routing guide and should be updated whenever an agent or repository skill is added, removed, or materially re-scoped.

All agents follow the repository-wide [Copilot instructions](../copilot-instructions.md) and the path-specific instructions under [`.github/instructions/`](../instructions/).

## Agent Routing

| Agent | Primary responsibility | Use when | Do not use for | Repository skills |
| --- | --- | --- | --- | --- |
| [`meet-guidance-updater`](meet-guidance-updater.agent.md) | Converts a supplied team-manager communication into active-season My Meet Day guidance, preserves provenance and privacy, and verifies home-team and away-team output. | Parking, setup, check-in, warm-ups, concessions, or venue guidance supplied by an identified team manager or equivalent field owner. | Broad active-year source reviews (use `season-data-reviewer`), target-year preparation or activation (use `cnsl-season-rollover`), and unrelated annual-data changes. | Required: [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md) for annual-data authority, evidence, schema, and validation rules. |
| [`season-data-reviewer`](season-data-reviewer.agent.md) | Reviews the active year's official sources, resolves evidence authority and confidence, updates represented annual data when justified, and refreshes review records. | Deliberate active-year source checks, locally reported candidate differences, changed official PDFs or destinations, and verified pool, meet, or team data corrections. | Manager-supplied operational guidance (use `meet-guidance-updater`), target-year preparation or activation (use `cnsl-season-rollover`), and general application refactoring. | Required: [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md). Conditional: [`cloudflare-verification-handoff`](../skills/cloudflare-verification-handoff/SKILL.md) if an authorized browser source presents human verification. |
| [`refactoring-auditor`](refactoring-auditor.agent.md) | Assesses engineering health, technical debt, obsolete compatibility paths, accessibility, data integrity, delivery, testing, security, and measured performance opportunities. Updates only the refactoring plan. | Evidence-based refactoring audits and priority planning. | Implementing recommendations, changing annual source data, or modifying application code during the audit. | Consult [`cnsl-code-retirement`](../skills/cnsl-code-retirement/SKILL.md) when evaluating superseded or legacy paths. The auditor plans retirement; implementation happens in a separate task. |
| [`version-update`](version-update.agent.md) | Maintains the undated What's New section for significant unreleased work and publishes release metadata only when a stable release is explicitly requested. | Significant visitor-facing functionality, release-note review, semantic version publication, or release-date metadata maintenance. | Interpreting annual-source evidence or authoring the initial note for a material data correction (use `season-data-reviewer`), engineering-only changes, or silently rewriting published release history. | No dedicated repository skill. Follow the agent profile and [`docs/release-checklist.md`](../../docs/release-checklist.md) for release mode. |

## Responsibility Boundaries

### Meet Guidance Updater

- Owns a directly supplied manager communication from interpretation through local My Meet Day output verification.
- Maps facts to shared, home-team, or visiting-team audiences and excludes personal or manager-only coordination details.
- Changes only the matching host team's active-season guide and its required evidence records unless a reusable behavior contract also needs focused coverage.
- Defaults to local working-tree edits; publication requires an explicit request.

### Seasonal Data Reviewer

- Owns standalone live official-source coverage for the active year, bounded evidence review, confidence classification, and accepted active-season source corrections.
- Updates modeled data or schemas only with high-confidence official evidence and records unresolved conflicts without guessing.
- Refreshes completed-review timestamps and the reviewed source baseline according to the seasonal-data contract.
- Authors and ranks any required material-data note in `Upcoming`; `version-update` later owns promotion into a stable release.
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
- Leaves annual-source interpretation and the initial note for a material data correction to `season-data-reviewer`.
- Changes the current working tree only; Git branch, commit, push, and pull-request operations are separate publication tasks.
- Does not change annual source-of-truth data or generated output.

## Repository Skills

| Skill | Invocation | Purpose | Used by |
| --- | --- | --- | --- |
| [`cnsl-site-verification`](../skills/cnsl-site-verification/SKILL.md) | User-invocable | Selects focused verification for CNSL changes, coordinates build and browser checks, and reuses the shared BrowserSync site on port 3100 for local inspection. | Build, behavior, accessibility, PWA, and release-readiness verification across repository tasks. |
| [`cnsl-season-rollover`](../skills/cnsl-season-rollover/SKILL.md) | User-invocable | Prepares, audits, validates, or activates target-year pool, meet, and team assets using the repository's evidence and source-authority rules. | New-season preparation and activation; consulted by `meet-guidance-updater` and `season-data-reviewer` for the shared annual-data contract. |
| [`cnsl-code-retirement`](../skills/cnsl-code-retirement/SKILL.md) | Internal workflow | Classifies and removes obsolete code, compatibility paths, fixtures, dependencies, documentation, and registrations when a current implementation supersedes them. | Refactor implementations; consulted by `refactoring-auditor` for retirement findings. |
| [`cloudflare-verification-handoff`](../skills/cloudflare-verification-handoff/SKILL.md) | User-invocable | Pauses an authorized browser task for the user to complete human verification, then safely resumes the original task. | Any authorized browser workflow interrupted by Cloudflare, Turnstile, CAPTCHA, or another human-verification challenge. |

## Instruction Routing

Repository instructions define standing constraints and file-specific implementation conventions. They do not replace the task ownership above.

| Instruction | Attachment | Owns | Does not own |
| --- | --- | --- | --- |
| [`copilot-instructions.md`](../copilot-instructions.md) | Always | Repository invariants, visitor tone, safety, accessibility, verification scope, delegation, and architecture boundaries. | Detailed language or file-format conventions when a scoped instruction applies. |
| [`build.instructions.md`](../instructions/build.instructions.md) | Task-discovered | pnpm, build and dev-server operation, linting, test execution, performance measurement, and CI/release gates. | Test assertion design or GitHub Actions security. |
| [`code-quality.instructions.md`](../instructions/code-quality.instructions.md) | JavaScript and HTML | URLs, navigation, external-data rendering, generated markup, and trust boundaries. | General JavaScript structure or HTML composition. |
| [`css.instructions.md`](../instructions/css.instructions.md) | `src/css/**/*.css` | Stylesheet architecture, design tokens, responsive styling, and typography delivery. | HTML semantics or interaction behavior. |
| [`data.instructions.md`](../instructions/data.instructions.md) | Annual data files and task discovery | Source authority, evidence confidence, schemas, annual records, and non-seasonal lesson-provider data. | Executing a rollover, active-year review, or manager-message workflow. |
| [`github-workflows.instructions.md`](../instructions/github-workflows.instructions.md) | `.github/workflows/**/*.yml` | GitHub Actions permissions, action pinning, and workflow security. | General build commands or application behavior. |
| [`html.instructions.md`](../instructions/html.instructions.md) | `src/views/**/*.html` | PostHTML composition, semantic structure, accessibility markup, and script ordering. | SEO content strategy or browser implementation logic. |
| [`javascript.instructions.md`](../instructions/javascript.instructions.md) | `src/js/**/*.js` | Browser-runtime architecture, DOM behavior, semantic owners, JSDoc, loading, and analytics boundaries. | Node build scripts or test-only implementation. |
| [`markdown.instructions.md`](../instructions/markdown.instructions.md) | `**/*.md` | Markdown authoring and focused markdownlint validation. | The domain correctness of the document being edited. |
| [`seo.instructions.md`](../instructions/seo.instructions.md) | `src/views/**/*.html` | Search metadata, visible-title boundaries, structured data, and SEO verification. | General page structure or styling. |
| [`testing.instructions.md`](../instructions/testing.instructions.md) | `tests/**/*.js` | Test design, fixtures, assertions, browser-module loading, and local test scope. | Production implementation or release-gate ownership. |

## Maintenance

When changing an agent or skill:

1. Update the authoritative profile or `SKILL.md` first.
2. Update the routing row, responsibility summary, or skill mapping here when its public purpose or boundary changed.
3. Keep names and links aligned with frontmatter so agents and skills remain discoverable.
4. Run focused Markdown validation for every changed Markdown file.
