# Seasonal Source Update Detected

Checked official public sources for active season `2026` on 2026-05-27.

This pull request records changed official evidence. Source documents are refreshed automatically; JSON remains subject to review and transcription against the repository schemas.

## Detected Changes

| Domain | Source | Change | Evidence in this PR |
| --- | --- | --- | --- |
| teams | [CHS Swim Sundevils practice schedule page](https://www.gomotionapp.com/team/reccnslcfhss/page/team-information/practice-schedule) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Dorsey Search Dolphins home page](https://www.gomotionapp.com/team/reccnsldsd/page/home) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Dorsey Search Dolphins practice schedule page](https://www.gomotionapp.com/team/reccnsldsd/page/practice-schedule) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Dorsey Search Dolphins staff page](https://www.gomotionapp.com/team/reccnsldsd/page/system/coaches) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Harper's Choice Challenge home page](https://www.gomotionapp.com/team/reccnslhcc/page/home) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Harper's Choice Challenge practice schedule page](https://www.gomotionapp.com/team/reccnslhcc/page/team-information/practice-schedule) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Owen Brown Barracudas practice schedule page](https://www.gomotionapp.com/team/reccnslobb/page/practice-schedule1) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Pointers Run Piranhas home page](https://www.gomotionapp.com/team/reccnslprp/page/home) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Pheasant Ridge Rapids home page](https://www.gomotionapp.com/team/reccnslprr/page/home) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Thunder Hill Lightning calendar page](https://www.gomotionapp.com/team/reccnslthl/page/calendar) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Thunder Hill Lightning home page](https://www.gomotionapp.com/team/reccnslthl/page/home) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Thunder Hill Lightning staff page](https://www.gomotionapp.com/team/reccnslthl/page/system/coaches) | Public page content changed | `.github/automation/season-data-monitor/source-state.json` |

## Data Review Checklist

- [ ] Review practice assignments and public team, staff, practice-schedule, and calendar pages; update `src/assets/data/2026/teams/teams.json` if supported fields changed.
- [ ] After accepting reviewed application data, update `OFFICIAL_SOURCE_CHECKED_ON` in `src/js/config/app-config.js` and record the same accepted source-check date in `src/assets/data/2026/README.md` so the FAQ reports data currency.
- [ ] Run `pnpm run validate:data`, `pnpm test`, `pnpm run lint`, and `pnpm run build` after completing any transcription.

The nightly monitor pauses while this pull request is open so reviewer changes on this branch are not replaced by automation.
