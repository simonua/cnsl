# 2026 Season Assets

## Status

The 2026 folder is the active season selected by the application. Pools, meets, and teams now contain application-ready JSON and schema files backed by retained official source documents.

## Source Authority And Currency

Pool information is accepted only from official public Columbia Association pages and documents. Meet and team information is accepted only from official public CNSL publication and team pages. Social media posts, email threads, messaging groups, and other community-shared content are not source evidence for application data unless the information is published through an official public source.

**Last accepted official-source check:** 2026-05-24. This accepted review date is published in the FAQ through `OFFICIAL_SOURCE_CHECKED_ON` in `src/js/config/app-config.js`; update both records together after a reviewed official-source refresh or check changes accepted application data.

| Domain | Local assets | Application readiness | Source status |
| --- | --- | --- | --- |
| Pools | `pools/pools.json`, `pools/pools.schema.json`, and 23 PDFs in `pools/pool-schedules/` | Ready, including facility features | Columbia Association pool pages and directory URLs are recorded in `pools/pools.json` |
| Meets | `meets/meets.json`, `meets/meets.schema.json`, and one PDF in `meets/meet-schedules/` | Ready | Official CNSL meet schedule downloaded and transcribed |
| Teams | `teams/teams.json`, `teams/teams.schema.json`, and two PDFs in `teams/team-schedules/` | Ready | Official CNSL practice and team-assignment documents retained; supported team fields transcribed |

## Pools

Pool schedule PDFs are stored in `pools/pool-schedules/`. The annual data file records official links for the pool directory, schedule guide, pool pages, and per-pool schedule downloads.

| Source | Official link | Local representation |
| --- | --- | --- |
| Columbia Association pool schedule page | [View pool schedules](https://columbiaassociation.org/sports-recreation/pools/pool-schedules/) | `pools/pools.json` and `pools/pool-schedules/` |
| Columbia Association pool directory | [View pool directory](https://experience.arcgis.com/experience/ac58c73ab9bd4640a880c8ddf46bf198) | `pools/pools.json` |
| Columbia Association individual pool-location pages | Official page stored as each `pools[].caUrl` | `pools[].features`, verified 2026-05-24 |

## Meets

| Source document | Official download | Local copy | Verified |
| --- | --- | --- | --- |
| 2026 CNSL Meet Schedule - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-meet-schedule--final_047535.pdf) | `meets/meet-schedules/2026-cnsl-meet-schedule--final_047535.pdf` | 2026-05-24 |

The stored meet PDF is the authoritative source used to create `meets/meets.json` and its sibling schema. Team names are normalized to the stable application naming used in the prior-season data where the PDF includes a typographical or punctuation variation.

## Teams

| Source document | Official download | Local copy | Verified |
| --- | --- | --- | --- |
| 2026 CNSL Practice Schedule - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-practice-schedule--final_046743.pdf) | `teams/team-schedules/2026-cnsl-practice-schedule--final_046743.pdf` | 2026-05-24 |
| 2026 CNSL Team Assignments - Final | [Download PDF](https://www.gomotionapp.com/reccnsl/UserFiles/Image/QuickUpload/2026-cnsl-team-assignments--final_059448.pdf) | `teams/team-schedules/2026-cnsl-team-assignments--final_059448.pdf` | 2026-05-24 |

The practice-schedule PDF supplies the current team pool associations recorded in `teams/teams.json`. The team-assignment PDF is retained as the official registration-assignment source; neighborhood and school assignment matrices are not represented in the existing 2025-modeled application schema.

## Publication Page

The 2026 CNSL downloads above were verified from the official [CNSL home page](https://www.gomotionapp.com/team/reccnsl/page/home) on 2026-05-24.

## Transcription Notes

- Missing pool facility features were completed from each official Columbia Association pool-location page on 2026-05-24, while existing CA-backed values were retained. The update combines the pages' facility descriptions and Amenities lists, normalizing terms to schema labels such as `lap`, `play features`, and `splash` while retaining specifically published amenities such as `heated`, `climbing wall`, and `sensory friendly`.
- A 2026-05-24 facility-page audit corrected published location text for Bryant Woods, Dickinson, Dorsey Hall, Faulkner Ridge, Hobbit's Glen, Hopewell, Longfellow, and Swansfield, and removed an unsupported `pool lift` designation from Bryant Woods. Coordinate fields were not re-derived from facility-page map-link coordinates because the CA directory remains the recorded location source.
- Stevens Forest's official PDF includes adult and class programming beginning 2026-05-04 before the general outdoor season start; its early schedule entries in `pools/pools.json` are intentional.
- The source monitor byte-matched all retained official PDFs to their public URLs on 2026-05-24. Extracted PDF text supported spot verification of the JSON transcription, but the source tables do not extract with reliable cell ordering for an exhaustive automated field-by-field comparison.
- The meets file transcribes the five scheduled dual-meet dates and three special-meet entries from the official PDF.
- The teams file preserves the stable team IDs and destination URL pattern from the archived model, updating current home and practice pool associations from official 2026 sources.
- Public team and staff pages referenced by `teams.json` were rechecked on 2026-05-24; supported coach, manager, and contact fields agree with the published pages, including pages that do not publish a current roster.
- The central practice PDF supplies pool associations and team-wide practice windows, while directing families to each team for age-group times; the 2025-modeled JSON records the supported pool associations. Registration-assignment matrices remain in their official PDF because the application schema does not model them.
