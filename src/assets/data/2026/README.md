# 2026 Season Assets

## Status

The 2026 folder is the active season selected by the application. Pools, meets, and teams now contain application-ready JSON and schema files backed by retained official source documents.

| Domain | Local assets | Application readiness | Source status |
| --- | --- | --- | --- |
| Pools | `pools/pools.json`, `pools/pools.schema.json`, and 23 PDFs in `pools/pool-schedules/` | Ready | Columbia Association pool source URLs are recorded in `pools/pools.json` |
| Meets | `meets/meets.json`, `meets/meets.schema.json`, and one PDF in `meets/meet-schedules/` | Ready | Official CNSL meet schedule downloaded and transcribed |
| Teams | `teams/teams.json`, `teams/teams.schema.json`, and two PDFs in `teams/team-schedules/` | Ready | Official CNSL practice and team-assignment documents retained; supported team fields transcribed |

## Pools

Pool schedule PDFs are stored in `pools/pool-schedules/`. The annual data file records official links for the pool directory, schedule guide, pool pages, and per-pool schedule downloads.

| Source | Official link | Local representation |
| --- | --- | --- |
| Columbia Association pool schedule page | [View pool schedules](https://columbiaassociation.org/sports-recreation/pools/pool-schedules/) | `pools/pools.json` and `pools/pool-schedules/` |
| Columbia Association pool directory | [View pool directory](https://experience.arcgis.com/experience/ac58c73ab9bd4640a880c8ddf46bf198) | `pools/pools.json` |

## Meets

| Source document | Official download | Local copy | Verified |
| --- | --- | --- | --- |
| 2026 CNSL Meet Schedule - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-meet-schedule--final_047535.pdf) | `meets/meet-schedules/2026-cnsl-meet-schedule--final_047535.pdf` | 2026-05-23 |

The stored meet PDF is the authoritative source used to create `meets/meets.json` and its sibling schema. Team names are normalized to the stable application naming used in the prior-season data where the PDF includes a typographical or punctuation variation.

## Teams

| Source document | Official download | Local copy | Verified |
| --- | --- | --- | --- |
| 2026 CNSL Practice Schedule - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-practice-schedule--final_046743.pdf) | `teams/team-schedules/2026-cnsl-practice-schedule--final_046743.pdf` | 2026-05-23 |
| 2026 CNSL Team Assignments - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-team-assignments--final_059448.pdf) | `teams/team-schedules/2026-cnsl-team-assignments--final_059448.pdf` | 2026-05-23 |

The practice-schedule PDF supplies the current team pool associations recorded in `teams/teams.json`. The team-assignment PDF is retained as the official registration-assignment source; neighborhood and school assignment matrices are not represented in the existing 2025-modeled application schema.

## Publication Page

The 2026 CNSL downloads above were verified from the official [CNSL home page](https://www.gomotionapp.com/team/reccnsl/page/home) on 2026-05-23.

## Transcription Notes

- The meets file transcribes the five scheduled dual-meet dates and three special-meet entries from the official PDF.
- The teams file preserves the stable team IDs and destination URL pattern from the archived model, updating current home and practice pool associations from official 2026 sources.
- The central practice PDF supplies pool associations and team-wide practice windows, while directing families to each team for age-group times; the 2025-modeled JSON records the supported pool associations. Registration-assignment matrices remain in their official PDF because the application schema does not model them.
