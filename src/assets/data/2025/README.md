# 2025 Season Assets

## Status

The 2025 folder is an archived season and is excluded from published builds. It retains completed JSON/schema data for pools, meets, and teams, together with source references available for audit.

| Domain | Local assets | Archive coverage | Source status |
| --- | --- | --- | --- |
| Pools | `pools/pools.json`, `pools/pools.schema.json`, and 23 PDFs in `pools/pool-schedules/` | Complete | Columbia Association pool source URLs are recorded in `pools/pools.json` |
| Meets | `meets/meets.json` and `meets/meets.schema.json` | Complete | Official CNSL meet schedule URL recorded in `meets/meets.json` |
| Teams | `teams/teams.json` and `teams/teams.schema.json` | Complete | Individual team source URLs recorded; no verified central PDF link |

## Pools

Pool schedule PDFs are stored in `pools/pool-schedules/`. The annual data file records the source links used for Columbia Association pool information and per-pool schedule downloads.

| Source | Official link | Local representation |
| --- | --- | --- |
| Columbia Association 2025 pool season guide | [View season guide](https://columbiaassociation.org/swim/your-guide-to-cas-2025-pool-season/) | `pools/pools.json` and `pools/pool-schedules/` |
| Columbia Association pool directory | [View pool directory](https://experience.arcgis.com/experience/ac58c73ab9bd4640a880c8ddf46bf198) | `pools/pools.json` |

## Meets

| Source document | Official download | Local copy | Recorded from |
| --- | --- | --- | --- |
| CNSL Meet Schedule 2025 - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/cnsl-meet-schedule-2025---final_026345.pdf) | Not stored | `meets/meets.json` `url` field |

The official meet link is retained here for auditability of the archived transcribed schedule data.

## Teams

A single official CNSL 2025 practice-schedule or team-assignment PDF link has not been verified from the public CNSL site. The archived team data records the source references currently available for that season.

| Source type | Location in archived data | Central download link |
| --- | --- | --- |
| Team home pages | `teams/teams.json` `teams[].url` | Not identified |
| Team-specific practice pages | `teams/teams.json` `teams[].practice.url`, where present | Not identified |

If an official 2025 league-wide team-assignment or practice PDF is recovered, add its direct download URL here before using it to revise archived data.

## Archive Notes

- The 2025 assets remain available as source history and should not be revised without an explicit archived-data correction.
- The build intentionally excludes `data/2025/` from published output.
