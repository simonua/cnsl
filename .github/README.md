# Repository Automation And Copilot Configuration

This directory keeps GitHub configuration organized by purpose:

- `agents/` contains discoverable GitHub Copilot custom agent profiles (`*.agent.md`).
- `automation/` contains instructions and persisted state used by scheduled workflows.
- `instructions/` and `skills/` contain repository-specific Copilot guidance.
- `workflows/` contains GitHub Actions definitions.
- `copilot-instructions.md` defines project-wide Copilot guardrails.
- `dependabot.yml` configures dependency update checks.

## Scheduled Automation

- [`automation/refactoring-audit/`](automation/refactoring-audit/README.md) retains the currently disabled Copilot refactoring assessment driven by the `refactoring-auditor` custom agent.
- [`automation/season-data-monitor/`](automation/season-data-monitor/README.md) retains the currently disabled seasonal-source review issue workflow and its reviewed fingerprint baseline.

Keeping workflow assets under `automation/` prevents their names from being confused with custom agent profiles, which must live under `agents/` for discovery.
