---
applyTo: ".github/workflows/**/*.yml"
description: "Use when creating or modifying GitHub Actions workflows. Covers SHA pinning and workflow security."
---

# GitHub Workflows

## Action Pinning

- Pin every action to the full 40-character commit SHA of its current vetted release.
- Retain a trailing release comment, for example `uses: actions/checkout@<sha> # v6.0.2`, so Dependabot can update the SHA without replacing it with a mutable tag.
- Never use a version tag, branch name, or `latest` as the `uses:` reference.

## Security

- Declare only required `permissions`; scope elevated deployment permissions to the deploy job.
- Use `persist-credentials: false` for checkout unless later steps must push through the workflow token.
- Do not interpolate untrusted event values directly into `run:` scripts.
- Use GitHub-hosted runners for this public repository.

## Maintenance

- Keep `.github/dependabot.yml` configured for `github-actions` updates.
- Confirm workflow syntax and execute the local build command before completing workflow changes.
