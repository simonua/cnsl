---
name: cloudflare-verification-handoff
description: "Handle a Cloudflare human-verification interruption during an authorized browser task. Use when a shared browser page displays Cloudflare, Turnstile, 'Verify you are human', 'Verify you are a human', a verification checkbox, CAPTCHA, managed challenge, or bot-check page; pause for the user to complete it manually, verify that the original page is available, and resume the requested workflow."
argument-hint: "Provide the intended site task or the browser page currently blocked by verification."
user-invocable: true
---

# Cloudflare Verification Handoff

Use this workflow when a legitimate browsing task is interrupted by a Cloudflare or similar human-verification page. The skill preserves the user's workflow while keeping proof-of-human-presence actions with the user.

## Guardrails

- Do not click a verification checkbox, solve a CAPTCHA, submit a challenge, or claim to be the user.
- Do not bypass or weaken the challenge through scripts, automated browser actions, replayed tokens, altered headers, cookies, storage, network requests, extensions, or third-party solver services.
- Do not repeatedly reload, navigate around, or interact with the challenge unless the user explicitly requests ordinary navigation after completing it.
- Keep the scope limited to the authorized browser task the user originally requested.

## Procedure

1. Identify that the visible browser page is a Cloudflare, Turnstile, CAPTCHA, managed challenge, or other human-verification interruption rather than the requested destination content.
2. Preserve the current browser tab and briefly tell the user that verification needs their manual input in the shared browser page.
3. Pause automation on that page while the challenge remains visible. Ask the user to complete the verification and confirm when the destination page loads.
4. After the user confirms completion, inspect the page again using a browser snapshot or the least invasive read-only browser check available.
5. If the destination content is available, continue only the original authorized workflow. If verification is still shown, report that it is still awaiting manual completion and remain paused.
6. If Cloudflare blocks access after manual completion, report the visible outcome and ask whether the user wants to continue manually or abandon that source.

## Completion Report

State whether verification was left for manual completion, whether access became available afterward, and what original browser task was resumed or could not proceed.
