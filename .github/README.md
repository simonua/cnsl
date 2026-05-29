# Repository Automation And Copilot Configuration

This directory keeps GitHub configuration organized by purpose:

- `agents/` contains discoverable GitHub Copilot custom agent profiles (`*.agent.md`).
- `automation/` contains retained instructions and persisted state for retired or reviewed automations.
- `instructions/` and `skills/` contain repository-specific Copilot guidance.
- `workflows/` contains GitHub Actions definitions.
- `copilot-instructions.md` defines project-wide Copilot guardrails.
- `dependabot.yml` configures dependency update checks.

## Retired Automation

- [`automation/refactoring-audit/`](automation/refactoring-audit/README.md) retains design notes for the retired Copilot refactoring assessment driven by the `refactoring-auditor` custom agent.
- [`automation/season-data-monitor/`](automation/season-data-monitor/README.md) retains source-monitoring notes and its reviewed fingerprint baseline; no Actions workflow invokes it.

Keeping automation support assets under `automation/` prevents their names from being confused with custom agent profiles, which must live under `agents/` for discovery.
