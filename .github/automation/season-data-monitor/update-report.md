# Seasonal Source Update Detected

Checked official public sources for active season `2026` on 2026-05-28.

This pull request records changed official evidence, not a relocated source URL. Public pages are compared by the data role they supply, and JSON remains subject to review and transcription against the repository schemas.

## Detected Changes

| Domain | Source | Change | Evidence in this PR |
| --- | --- | --- | --- |
| pools | [Clary's Forest facility page](https://columbiaassociation.org/sports-recreation/pools/pool-locations/clarys-forest-cf-pool/) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| pools | [Dorsey Hall facility page](https://columbiaassociation.org/sports-recreation/pools/pool-locations/dorsey-hall-dh-pool/) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| pools | [Swansfield facility page](https://columbiaassociation.org/sports-recreation/pools/pool-locations/swansfield-mini-water-park-sw/) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| pools | [Thunder Hill facility page](https://columbiaassociation.org/sports-recreation/pools/pool-locations/thunder-hill-th-pool/) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| pools | [Columbia Association pool schedule page](https://columbiaassociation.org/sports-recreation/pools/pool-schedules/) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Clemens Crossing Cyclones staff page](https://www.gomotionapp.com/team/reccnslccc/page/system/coaches) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |
| teams | [Long Reach Marlins practice schedule page](https://www.gomotionapp.com/team/reccnsllrm/page/practice-schedule) | Published data page content changed | `.github/automation/season-data-monitor/source-state.json` |

## Data Review Checklist

- [ ] Review pool schedules, directory entries, and facility amenities; update `src/assets/data/2026/pools/pools.json` if published values changed.
- [ ] Review published coach and manager details and changed recorded practice schedules; update `src/assets/data/2026/teams/teams.json` only when supported data changed.
- [ ] After accepting reviewed application data, update `OFFICIAL_SOURCE_CHECKED_ON` in `src/js/config/app-config.js` and record the same accepted source-check date in `src/assets/data/2026/README.md` so the FAQ reports data currency.
- [ ] Run `pnpm run validate:data`, `pnpm test`, `pnpm run lint`, and `pnpm run build` after completing any transcription.

The nightly monitor pauses while this pull request is open so reviewer changes on this branch are not replaced by automation.
