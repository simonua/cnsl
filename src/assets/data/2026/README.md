# 2026 Season Assets

## Status

The 2026 folder is the active season selected by the application. Pools, meets, and teams now contain application-ready JSON and schema files backed by retained official source documents.

## Source Authority And Currency

Pool information is accepted only from official public Columbia Association pages and documents. Meet and team information is accepted only from official public CNSL publication and team pages. Social media posts, email threads, messaging groups, and other community-shared content are not source evidence for application data unless the information is published through an official public source.

**Last accepted official-source check:** 2026-05-31. This accepted review date is published in the FAQ through `OFFICIAL_SOURCE_CHECKED_ON` in `src/js/config/app-config.js`; update both records together after a reviewed official-source refresh or check changes accepted application data.

| Domain | Local assets | Application readiness | Source status |
| --- | --- | --- | --- |
| Pools | `pools/pools.json`, `pools/pools.schema.json`, and 23 PDFs in `pools/pool-schedules/` | Ready, including facility features | Columbia Association pool pages and directory URLs are recorded in `pools/pools.json` |
| Meets | `meets/meets.json`, `meets/meets.schema.json`, and one PDF in `meets/meet-schedules/` | Ready | Official CNSL meet schedule downloaded and transcribed |
| Teams | `teams/teams.json`, `teams/teams.schema.json`, and two PDFs in `teams/team-schedules/` | Ready, with complete detailed published practices for seven teams, a published First Splash schedule for Harper's Choice, public calendar/event links for all fourteen teams, and an available booster-club link | Official CNSL practice and team-assignment documents retained; public team-page practice schedules and calendars recorded where verified; Long Reach Marlins booster-club site recorded |

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

The practice-schedule PDF supplies the current team pool associations recorded in `teams/teams.json`. Complete detailed public schedule pages were accepted and transcribed for CHS Swim Sundevils, Huntington Dolphins, Long Reach Marlins, Phelps Luck Snappers, and Pointers Run Piranhas on 2026-05-26, and for Dorsey Search Dolphins and Owen Brown Barracudas on 2026-05-27. Harper's Choice Challenge now includes its fully published First Splash sessions; its later age-group practice times remain untranscribed because its public page still marks them `TBD`. A public practice source link remains recorded for Oakland Mills Tigersharks while detailed transcription is incomplete. Public calendar or event destinations were verified for all fourteen official team sites on 2026-05-27. Dorsey Search, Kings Contrivance, Long Reach, Oakland Mills, and Pheasant Ridge publish visitor-accessible `Events` pages while their direct calendar routes either redirect to sign-in or do not provide the public destination; their `calendarUrl` values therefore target the official events pages shown to visitors. The team-assignment PDF is retained as the official registration-assignment source; neighborhood and school assignment matrices are not represented in the application schema.

The Long Reach Marlins team record includes its available booster-club destination, [Long Reach Marlins, Inc.](https://www.longreachmarlins.org/), for display with the team's published links.

## Publication Page

The 2026 CNSL downloads above were verified from the official [CNSL home page](https://www.gomotionapp.com/team/reccnsl/page/home) on 2026-05-24.

## Transcription Notes

- Missing pool facility features were completed from each official Columbia Association pool-location page on 2026-05-24, while existing CA-backed values were retained. The update combines the pages' facility descriptions and Amenities lists, normalizing terms to schema labels such as `lap`, `play features`, and `splash` while retaining specifically published amenities such as `heated`, `climbing wall`, and `sensory friendly`.
- A 2026-05-24 facility-page audit corrected published location text for Bryant Woods, Dickinson, Dorsey Hall, Faulkner Ridge, Hobbit's Glen, Hopewell, Longfellow, and Swansfield, and removed an unsupported `pool lift` designation from Bryant Woods. Coordinate fields were not re-derived from facility-page map-link coordinates because the CA directory remains the recorded location source.
- Clary's Forest, Dorsey Hall, Swansfield, and Thunder Hill facility-page monitor findings were rechecked on 2026-05-27; their supported address, phone, and amenity values remain consistent with `pools/pools.json`, so no pool transcription changed.
- Lane counts were added for all 23 pools from the provided 2026 pool lane inventory on 2026-05-28. On 2026-05-29, a corrected provided lane inventory supplied course measurement and 25-unit lengths for all pools except Hobbit's Glen. On 2026-05-30, a follow-up correction confirmed Hobbit's Glen as a 25-yard pool.
- Stevens Forest's official PDF includes adult and class programming beginning 2026-05-04 before the general outdoor season start; its early schedule entries in `pools/pools.json` are intentional.
- On 2026-05-29, each pool schedule period received an `accessStatus` value so live public availability is derived independently from official activity wording. `Clippers Practice Only` periods at Jeffers Hill and Stevens Forest are classified as `practice-only`, matching other exclusive team-use periods for status indicators and availability filtering.
- The source monitor byte-matched all retained official PDFs to their public URLs on 2026-05-24. Extracted PDF text supported spot verification of the JSON transcription, but the source tables do not extract with reliable cell ordering for an exhaustive automated field-by-field comparison.
- The meets file transcribes the five scheduled dual-meet dates and three special-meet entries from the official PDF, including standard 8:00 AM - 12:00 PM timing windows for regular dual meets and Time Trials.
- The teams file preserves the stable team IDs and destination URL pattern from the archived model, updating current home and practice pool associations from official 2026 sources. Optional per-team meet-time overrides can represent a published exception to the standard meet timing without duplicating the league schedule. Each team's `timeTrialsPool` resolves the official schedule's delegated home-pool location for time trials, including its stated Pointers Run exception at Jeffers Hill Pool.
- Each team record includes a compact `shortName`, transcribed from the published team name for concise favorite-team headings on narrow screens (for example, `Long Reach Marlins` is displayed as `Marlins`).
- Public staff pages for Dorsey Search Dolphins and Thunder Hill Lightning were rechecked on 2026-05-27; supported coach, manager, and contact fields still agree with the published pages, including Dorsey Search's page that does not publish a current roster.
- The central practice PDF supplies pool associations and team-wide practice windows, while directing families to each team for age-group times. Complete official public pages now supply `practice` records for CHS Swim Sundevils, Dorsey Search Dolphins, Huntington Dolphins, Long Reach Marlins, Owen Brown Barracudas, Phelps Luck Snappers, and Pointers Run Piranhas; Harper's Choice Challenge supplies its fully published First Splash sessions while later age-group times remain `TBD`. Other teams remain limited to verified pool associations until a complete detailed current schedule can be transcribed from an official public page.
- The seasonal source monitor fingerprints public staff pages and recorded practice-schedule pages that supply modeled team data, while ignoring team-home news and event-calendar churn that is not transcribed into annual JSON.
