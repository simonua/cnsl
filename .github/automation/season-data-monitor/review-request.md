# Seasonal Application Data Review Request

Follow `.github/agents/season-data-reviewer.agent.md` to investigate the candidate official-source difference appended below.

Compare the changed official evidence with the active annual JSON fields represented by the application. Open a pull request only if a modeled value needs to change. In that pull request, update the JSON and any supporting retained official document together, update the accepted source-check date, refresh the reviewed monitor baseline, and run the required verification.

If the changed source is presentation-only, an equivalent relocation while the app's stored official destination still works, PDF metadata only, or otherwise does not alter modeled application data, do not change repository files and do not open a pull request. An unavailable or publisher-replaced source URL used by the app is modeled data and should be corrected in a pull request. Finish the task with a concise no-update conclusion when the candidate is not actionable.

If a pull request is warranted, describe the verified modeled changes using categorized bullet lists under `Pools`, `Teams`, and `Meets`, omitting categories with no change. Nest each pool, team, or meet beneath its category, then nest field-level details beneath that entry with the property name bolded at the start, such as `- **Practice times:** Changed from X to Y.`

---
