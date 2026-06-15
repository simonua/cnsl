---
applyTo: "**/*.md"
description: "Use when creating or changing Markdown files. Covers repository markdownlint and design-time validation expectations."
---

# Markdown Conventions

## Design-Time Validation

- Treat `.markdownlint.jsonc` as the shared Markdown style configuration for this repository.
- Use the recommended `DavidAnson.vscode-markdownlint` extension for live editor diagnostics while authoring Markdown.
- Markdown linting is a design-time aid in this repository; do not add it to package scripts, build checks, or deployment gates unless explicitly requested.

## Commands

- Run `pnpm dlx markdownlint-cli2 "**/*.md" "#node_modules" "#out" "#test-results"` from the repository root for a workspace-wide Markdown audit. Keep the exclusions quoted so third-party dependency documentation and generated output are not linted.
- Run `pnpm dlx markdownlint-cli2 "<path/to/file.md>"` for a focused command-line check of one changed Markdown file.

## Rules

- For every Markdown file created or modified, resolve markdownlint diagnostics in the affected file before completing the change.
- Follow the checked-in rule configuration; line length (`MD013`) is intentionally disabled for readable prose and long destinations.
- Preserve a logical heading hierarchy, use fenced code block language identifiers, and keep list and link formatting consistent with nearby documentation.
- Do not expand a focused change solely to reformat unrelated Markdown content; report an existing diagnostic if resolving it would broaden the requested work.

## Verification

- Review markdownlint diagnostics for each changed Markdown file and correct violations caused or exposed by the edit.
- For a repository-wide Markdown audit, run the workspace command above and report the linted file count and error count.
