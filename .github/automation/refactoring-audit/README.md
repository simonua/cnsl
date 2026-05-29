# Scheduled Refactoring Auditor

The monthly refactoring audit delegates a documentation-only assessment to GitHub Copilot cloud agent. Copilot reviews the repository using `.github/agents/refactoring-auditor.agent.md` and opens a pull request refreshing `docs/refactoring-plan.md` with evidence-based high, medium, and low priorities. The custom agent targets GitHub Copilot cloud execution and is not intended as a VS Code interactive agent.

## Schedule And Duplicate Protection

`.github/workflows/refactoring-audit.yml` runs at 06:41 UTC on the first day of May, June, and July only, and can also be run manually. Before assigning a new audit, it looks for an open issue whose title contains `Scheduled refactoring audit`. An existing open audit keeps the schedule from creating overlapping Copilot work.

## Required Repository Setup

GitHub's issue-assignment API requires a user token when assigning work to Copilot cloud agent; the workflow token cannot start this task. Configure the repository as follows:

1. Enable GitHub Copilot cloud agent for the repository and confirm that the licensed user creating the token can assign Copilot to issues.
2. Create a fine-grained personal access token for that user with read access to metadata and read/write access to Actions, Contents, Issues, and Pull requests for this repository. A classic token needs the `repo` scope instead.
3. Store the token as the repository Actions secret `COPILOT_AGENT_TOKEN`.
4. Run `Schedule Refactoring Audit With Copilot` with `workflow_dispatch` once to confirm Copilot creates an audit issue and plan-only pull request.

The token requirements follow GitHub's documented API contract for assigning an issue to `copilot-swe-agent[bot]`. The workflow keeps its built-in `GITHUB_TOKEN` at read-only contents access for checkout; the configured user token is supplied only to the issue API calls.

## Review Boundary

The audit agent may inspect the application and run verification commands, but it is instructed to change only `docs/refactoring-plan.md`. Any pull request updating that plan is validated by `.github/workflows/refactoring-plan-boundary.yml`, which runs the validator from the trusted base branch and rejects additional files, plan deletion, or plan renames. Refactoring implementation, dependency updates, workflow changes, and annual-data maintenance remain separate reviewed tasks.

When an audit identifies no actionable findings, the plan may remain in its compact empty-state format rather than accumulating empty priority sections or roadmap rows. The audit must still state its date, verification status, pending manual checks, and preservation guardrails.
