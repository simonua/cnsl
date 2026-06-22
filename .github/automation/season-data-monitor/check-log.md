# Seasonal Data Update Check Log

This append-only log records completed online checks of official active-season sources. Each entry uses an `America/New_York` timestamp with an explicit UTC offset, states whether the overall check was complete, and ends with an update-summary table.

## 2026-06-10T06:56:02-04:00

**Active season:** 2026

**Result:** Incomplete because one application-used destination could not be verified.

Checked 107 unique official URLs:

- 75 checked by `pnpm run check:data-updates`.
- 32 uncovered destinations checked separately.
- 106 sources successfully verified.
- 1 source remained blocked: the Phelps Luck Snappers merchandise store returned HTTP 403 and displayed `Request Blocked` in the shared browser.

The monitor reported candidate changes for the Columbia Association pool schedule page and Huntington Dolphins practice source. Review found no represented-data change: CA's short schedule links still resolved to the retained schedule documents, and Huntington's modeled practice details remained unchanged despite new home-page news content.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None accepted. |
| Visitor-facing records | Unchanged | None. |
| Review records | Not completed | This incomplete result was logged; completed-check timestamps were not advanced. |
| Reviewed source baseline | Not completed | The baseline was not refreshed because required source coverage was incomplete. |

## 2026-06-10T22:13:23-04:00

**Active season:** 2026

**Result:** Complete under an explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 132 required official sources and application-used destinations were successfully verified.
- 3 application-used destinations were exempt from required availability verification: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site.
- Browser review reached the Phelps Luck store and Long Reach booster site despite scripted HTTP 403 responses.
- The Long Reach merchandise store returned HTTP 403 and displayed `Request Blocked`; the availability exception allowed the review to complete without treating that response as an official-data failure.

The monitor detected no candidate source differences. No modeled data or application-used destination changed, so `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Completed-check timestamp, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed after the completed review. |

## 2026-06-11T18:08:10-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 76 modeled-evidence sources were reached by `pnpm run check:data-updates`.
- 56 uncovered application-used destinations were reached separately with live GET requests.
- 3 application-used destinations retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site.

The monitor detected no candidate source differences, and all required uncovered destinations were reachable. No modeled data or application-used destination changed, so `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Completed-check timestamp, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed after the completed review. |

## 2026-06-13T09:03:27-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 76 modeled-evidence sources were reached by the seasonal source monitor.
- 56 uncovered application-used destinations were reached separately with live GET requests.
- 3 application-used destinations retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site.

The monitor detected no candidate source differences, and all required uncovered destinations were reachable. No modeled data or application-used destination changed, so `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with the accepted June 13 fingerprints and PDF metadata. |

## 2026-06-13T21:03:58-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 76 modeled-evidence sources were reached by `pnpm run check:data-updates`.
- 56 uncovered application-used destinations were reached separately with live GET requests.
- 3 application-used destinations were attempted and retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site returned HTTP 403.

The live web review detected no candidate source differences, all required uncovered destinations were reachable, and all 26 retained official PDFs remained current. Separately, a directly supplied Long Reach host-team manager communication updated the modeled Marlins home-meet guidance; `OFFICIAL_SOURCE_UPDATED_AT` records its acceptance at 9:01 PM EDT.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins `homeMeetGuides` arrival guidance, swimmer check-in location, and source date in `teams/teams.json`. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Unchanged | `source-state.json` was refreshed; its fingerprints and PDF metadata remained unchanged. |

## 2026-06-15T08:41:26-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 138-source inventory:

- 76 modeled-evidence sources were reached by `pnpm run check:data-updates`.
- 59 uncovered application-used destinations and official evidence pages were reached separately with live GET requests, including the three outdoor Aqua Fitness class-series pages.
- 3 application-used destinations were attempted and retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site returned HTTP 403.

The monitor detected three team-page candidates. The official Clemens Crossing Cyclones staff page corrected assistant coach Sofia Luo to Sophia Luo. The Pointers Run Piranhas practice and staff findings were page-content churn and did not change represented data. The three official Columbia Association Aqua Fitness class series corrected represented occurrence boundaries and established restricted program access at Bryant Woods, Locust Park, and Stevens Forest. A classification review of the unchanged retained pool schedules also corrected recurring program, one-time event, and explicit shared-lane public-use statuses. All required uncovered sources were reachable, and all 26 retained official PDFs remained current.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Outdoor Aqua Fitness date boundaries; matrix-backed pool activity access statuses in `pools/pools.json`; Clemens Crossing Cyclones assistant coach Sophia Luo in `teams/teams.json`. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Updated | Pool schedule classification item in `src/views/whats-new.html` and homepage `lastmod` in `sitemap.xml`. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with accepted June 15 page fingerprints and retained-PDF metadata. |

## 2026-06-15T21:28:22-04:00

**Active season:** 2026

**Result:** Complete.

Checked the 139-source inventory:

- 76 modeled-evidence sources were reached by `pnpm run check:data-updates`.
- 62 previously recorded uncovered official sources and application-used destinations were reached separately with live browser requests.
- The newly recorded Columbia Association Pool Guide amenity layer was reached directly and supplied separate main-pool, wading-pool, splashpad, and general-facility fields.

The current CA facility pages and Pool Guide corrected broad pool-feature labels that could misrepresent where or what an amenity is. Main-pool slides and children's wading-pool slides are now separate, including the source-backed 5-foot Jeffers Hill wading-pool slide. Beach entries and water features identify their pool area; basketball distinguishes in-water hoops from courts; volleyball identifies sand or grass; and diving boards and diving wells are distinct. The two Harper's Choice Challenge monitor candidates were page-fingerprint churn: the published staff roster and all represented practice periods remained current. All 26 retained official PDFs were unchanged.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Pool `features` and schema V13 distinguish slide location, pool-area beach entries and water features, basketball type, volleyball surface, and diving facility; Jeffers Hill now includes its wading-pool slide. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Updated | `src/views/whats-new.html` documents the corrected feature details and filters; `sitemap.xml` already had the 2026-06-15 content date. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, annual README source evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with accepted facility-page and Harper's Choice Challenge fingerprints plus retained-PDF metadata. |

## 2026-06-16T07:07:01-04:00

**Active season:** 2026

**Result:** Local normalization correction; no new online official-source review performed.

The accepted Long Reach host-team manager concession list for Kendall Ridge retained the same six items. Breakfast sandwiches and hot dogs were normalized as meals; bagels, donuts, muffins, and snow cones were normalized as snacks, matching the existing My Meet Day category contract and the established treatment of comparable items. No conflicting source was identified, confidence is High, and there is no residual uncertainty. The official-source timestamps remain unchanged because this local categorization was not a completed online source review and did not identify a change in the underlying source facts.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge `homeMeetGuides` concessions changed from generic `foodItems` to `mealItems` and `snackItems`; the six menu items are unchanged. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Annual README normalization evidence and this check-log entry; official-source timestamps are unchanged. |
| Reviewed source baseline | Unchanged | None; no online source review or retained-document change occurred. |

## 2026-06-16T07:31:14-04:00

**Active season:** 2026

**Result:** Local schema and validation maintenance; no new online official-source review performed.

The active annual contracts now require structured pool identity and location data, consistently validate populated application-used destinations as HTTPS URLs, reject impossible meet calendar dates, and enforce meet and team timing chronology. Pools advanced to schema V14, teams to V17, and meets to V4. Current modeled records required no value changes, and official-source timestamps remain unchanged.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None; existing destinations satisfy the tightened HTTPS schema types. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Active annual README and this check-log entry document the schema contract maintenance; official-source timestamps are unchanged. |
| Reviewed source baseline | Unchanged | None; no online source review or retained-document change occurred. |

## 2026-06-17T06:39:31-04:00

**Active season:** 2026

**Result:** Local manager-supplied data correction; no new online official-source review performed.

A directly supplied Long Reach host-team manager communication for the June 20 Pointers Run meet refreshed recurring Kendall Ridge visitor guidance. The accepted venue facts add shaded visitor setup on the left from the entrance, swimmer check-in at the reserved table by the diving board, the data table under the large pavilion by the baby pool, and Tamar Drive parking cautions. The newer concession list supersedes the June 16 list with cash, PayPal, and Venmo payments; hot lunch food; bagels, donuts, snacks, and snow cones; and complimentary items for visiting coaches. Internal manager coordination, matchup-specific entry deadlines, attendance-count requests, and personal contact details remain unmodeled because they are not public family guidance. The host-manager communication is authoritative for the accepted field-owned facts, no conflicting source was identified, confidence is High, and there is no residual uncertainty. The official-source timestamps remain unchanged because this local correction was not a completed online source review.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge `homeMeetGuides` source date, shared parking and concession details, and Pointers Run visitor setup and check-in guidance in `teams/teams.json`; internal manager coordination was omitted. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Annual README evidence and this check-log entry; official-source timestamps are unchanged. |
| Reviewed source baseline | Unchanged | None; no online source review or retained-document change occurred. |

## 2026-06-17T09:58:31-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 139-source inventory:

- 76 modeled-evidence URLs were covered by `pnpm run check:data-updates` or direct retrieval of CA's replacement Dickinson document.
- 63 uncovered official sources and application-used destinations were reached separately with live GET requests.
- 136 required sources were successfully verified.
- 3 application-used destinations were attempted and retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site returned HTTP 403.

CA regenerated 22 pool schedule PDFs and replaced Dickinson's unavailable document destination. Comparison found no schedule-table changes: the regenerated documents changed only contact-email or punctuation boilerplate, or their binary export. The current CA schedule index and replacement Dickinson PDF established the new application destination with High confidence and no conflicting source. Huntington's official practice page changed the regular-morning 9-10 label to `9 & 10 Age Group`; its dates, locations, days, and times were unchanged. The central CNSL practice PDF does not represent that age-group detail, so the team page is the definitive source. The outdoor lessons page retained all represented planning details and destinations. No conflict or residual uncertainty remains.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Huntington Dolphins' regular-morning 9-10 practice group in `teams/teams.json`. |
| Application-used source destinations | Updated | Dickinson `scheduleUrl` now targets CA's current `Dickenson.pdf`. |
| Retained official PDFs | Updated | All 23 pool schedule PDFs refreshed; obsolete `Dickinson_Pool.pdf` replaced by `Dickenson.pdf`. Meet and team PDFs were unchanged. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with the accepted page fingerprints and current retained-PDF metadata. |

## 2026-06-17 Local Manager Correction

**Active season:** 2026

**Result:** Local manager-supplied data correction; no new online official-source review performed.

Directly supplied follow-up guidance from the Long Reach host-team manager added coffee, water, and soda to the shared Kendall Ridge concession list and established a 7:25 AM visiting-team warm-up. Juice remains unmodeled because the sender explicitly described its availability as uncertain. A follow-up product clarification keeps generic cash handling out of annual data: My Meet Day now asks visitors to use bills of $20 or less and identifies $5 and $1 bills as especially helpful whenever canonical `cash` is accepted. The active data and schema remove `smallBillsPreferred` and the transient `maximumBillDenomination`; Wilde Lake's explicit `denominationsNotAccepted: [100]` remains source-specific guidance. Teams schema V18 is retained because removing the V17 `smallBillsPreferred` contract is still a schema change. No conflicting accepted guidance was identified, confidence is High for the modeled manager-supplied facts, and the only residual uncertainty is the intentionally omitted juice availability. Personal and irrelevant conversational details were omitted. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge shared concession drinks and visiting-team warm-up time in `teams/teams.json`; removed `smallBillsPreferred` and `maximumBillDenomination` from active data and schema while retaining Wilde Lake's `denominationsNotAccepted: [100]`; teams schema remains V18. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | Annual README evidence and this check-log entry; official-source timestamps are unchanged. |
| Reviewed source baseline | Unchanged | None; `source-state.json` did not change. |

## 2026-06-18T11:53:27-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store availability.

Checked the 139-source inventory:

- 76 modeled-evidence URLs were reached by `pnpm run check:data-updates`.
- 63 uncovered official sources and application-used destinations were requested separately with live `HEAD` or `GET` requests.
- 137 required sources were successfully verified.
- 2 application-used destinations were attempted and retained their availability exception: the Long Reach and Phelps Luck merchandise stores returned HTTP 403. The Long Reach booster site returned HTTP 200.

The monitor reported one candidate for CA's Outdoor Swim Lessons page. The current field-owning page retained all represented locations, weekdays, formats, dates, preparation guidance, weather policy, and destinations. CA's main Swim Lessons and Leagues page independently corroborated the morning and evening formats and the outdoor and Personal Swim Training destinations; the published registration destination also remained reachable. No normalization or schema change was needed, no conflicting official source was identified, confidence is High, and there is no residual uncertainty. The page-fingerprint difference was therefore non-material to application data.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, active annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with the accepted June 18 fingerprints and retained-PDF metadata. |

## 2026-06-19 Local Manager Correction

**Active season:** 2026

**Result:** Local manager-supplied data correction; no new online official-source review performed.

Directly supplied guidance from the Long Reach host-team manager for the June 20 Pointers Run meet established a 6:50 AM Long Reach team-arrival time. `homeTeam.arrivalTime` keeps this guidance specific to the Marlins, and My Meet Day labels arrival with the selected team's short name for clarity. The new arrival time supplements the existing setup and check-in guidance, and no prior accepted fact was contradicted or superseded. No personal details or manager-only coordination were present in the supplied fact. The host manager owns this operational fact, no conflicting source was identified, confidence is High, and there is no residual uncertainty. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge guide source date, home-team `arrivalTime`, and My Meet Day's short-name arrival label. Teams schema remains V19. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this operational data correction. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | None; `source-state.json` did not change. |

## 2026-06-19T08:57:44-04:00 Pool Schedule Audit

**Active season:** 2026

**Result:** Completed focused official-source review of all 23 Columbia Association outdoor-pool schedule PDFs.

`pnpm run check:data-updates` made the required initial live requests and reported the changed Bryant Woods PDF, the changed pool-schedule index, and a Running Brook facility-page candidate. The focused audit then issued direct live GET requests to all 23 schedule PDFs; all succeeded with HTTP 200. Twenty-two current PDFs byte-matched retained evidence, while Bryant Woods' June 18 document differed and was added as a June 19 artifact beside its retained June 17 version. The live schedule index and all 23 published short links were also reached, and every short link resolved to its existing `pools[].scheduleUrl`. CA's holiday-hours page and the Bryant Woods Aqua Fitness series were reached as bounded corroborating sources. The Running Brook page was checked for the monitor's named modeled fields and retained its normalized name, address, pool-desk phone, features, and destination. No request in the reviewed scope failed.

The direct pool PDFs identify noon to 7:00 PM Laps and Rec Swim as the complete June 19 and July 4 holiday schedule for all 23 pools; many explicitly cancel evening CNSL. Phelps Luck separately publishes complete closure on July 24 and July 25 for the CNSL All-City meet. Pool schema V16 therefore adds `scheduleOverrides[].overrideMode`, and all 46 holiday records plus the two Phelps Luck closures use `replace-day`. Other dated programs, parties, meets, and timed closures remain interval overlays. The runtime now discards recurring slots for a matching replacement date, retains untimed all-day closures as semantic records, and lets confirmed timed meet intervals take precedence without restoring regular hours.

Bryant Woods' regenerated PDF newly and explicitly states that its July 4 Aqua Fitness class is canceled. The recurring class-series page still lists a July 4 occurrence, but the newer pool-specific schedule owns that date's exception and is more specific, resolving the conflict in favor of the cancellation. The 23 direct schedules own their pool-specific dates, the schedule index corroborates all destinations, and the holiday-hours page directs visitors to those schedules. Running Brook's current page retains the normalized `Running Brook` name, `5730 Columbia Rd` address, `410-730-5293` pool-desk phone, CA destination, and page-backed lap, shade, splash, and wifi features; the accepted CA Pool Guide and outdoor-lessons evidence continues to support its other modeled features. Confidence is High for all 48 replacement classifications, the Bryant Woods cancellation, and the unchanged Running Brook fields. No residual source uncertainty remains within the reviewed scope. After baseline initialization, a second `pnpm run check:data-updates` run reported no candidate source differences for 2026.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Added `overrideMode: replace-day` to all 23 pools' June 19 and July 4 overrides and to Phelps Luck's July 24-25 all-day closures; pool schema advanced to V16. |
| Application-used source destinations | Unchanged | None; all 23 schedule-index links resolve to the existing `pools[].scheduleUrl` values. |
| Retained official PDFs | Updated | Migrated all pool evidence to `<pool-id>/<YYYY-MM-DD>/<official-filename>`; retained the complete 23-file June 17 set and added Bryant Woods' June 19 artifact, for 24 total PDFs. |
| Visitor-facing records | Updated | Pool schedule resolution and display now honor `replace-day`, and the undated Upcoming note documents the correction. |
| Review records | Updated | Updated `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, active annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed after accepting the 23-PDF review and Bryant Woods replacement. |

## 2026-06-19 Role-Specific Parking Correction

**Active season:** 2026

**Result:** Local manager-supplied data correction; no new online official-source review performed.

A directly supplied Long Reach host-team manager correction replaced Kendall Ridge's three shared parking sentences with role-specific guidance. Home-team families may use open pool spaces or Tamar Drive, while visiting families are directed to Tamar Drive; both roles retain the fire-hydrant and Young School restrictions. Teams schema V20 permits `parkingNotes` on the home and visiting role guides while retaining `general.parkingNotes` for genuinely shared venue guidance. My Meet Day now combines shared parking only with the selected role's parking, and the superseded shared wording was removed without restoring the retired `parkingLocation` or `reservedParking` compatibility fields. No personal details or manager-only coordination were present. The host manager owns this operational guidance, no conflicting source was identified, confidence is High, and there is no residual uncertainty. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge `general.parkingNotes` moved to exact home-team and visiting-team `parkingNotes`; teams schema advanced to V20, and My Meet Day selects parking by role. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this operational data correction. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | This correction did not change `source-state.json`; pre-existing worktree edits were preserved. |

## 2026-06-19 Home-Team Helpful-Note Ordering Correction

**Active season:** 2026

**Result:** Local presentation correction for accepted manager-supplied guidance; no new online official-source review performed.

A user-directed My Meet Day correction made accepted home-team `helpfulNotes` render before shared `general` notes for the home perspective. The Long Reach Kendall Ridge home view now leads Good to know with the relay early-departure reminder, followed by the Marlins merchandise location and shared data-table location. The away perspective retains its existing shared-first ordering and content, and all guide facts remain unchanged. No source date, schema field, personal detail, manager-only coordination, conflict, or superseded fact was introduced. The existing host-manager provenance remains authoritative at High confidence with no residual uncertainty. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this presentation correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None; the accepted Long Reach Kendall Ridge guide properties and values did not change. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this ordering correction. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | This correction did not change `source-state.json`; pre-existing worktree edits were preserved. |

## 2026-06-19 Home-Team Merchandise Guidance Correction

**Active season:** 2026

**Result:** Local manager-supplied data correction; no new online official-source review performed.

Directly supplied guidance from the Long Reach host-team manager added the Marlins merchandise location under the large pavilion next to the baby pool. The exact sentence is stored in `homeTeam.helpfulNotes`, limiting it to Long Reach families; it was not added to `general` or `visitingTeam`. The existing shared data-table note and all other guide data remain unchanged. No personal details, manager-only coordination, conflicting guidance, or superseded facts were present. The identified host manager owns this operational guidance, confidence is High, and there is no residual uncertainty. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge `homeTeam.helpfulNotes` adds the home-team-only merchandise location; shared and visiting-team guidance are unchanged. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this operational data correction. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | This correction did not change `source-state.json`; pre-existing worktree edits were preserved. |

## 2026-06-19 Home-Team Setup Wording Correction

**Active season:** 2026

**Result:** Local wording correction to accepted manager-supplied guidance; no new online official-source review performed.

A user-directed correction to the accepted Long Reach host-team manager guidance changed Kendall Ridge's home-team `familySetupLocation` from `on the right side from the pool entrance` to `on the right side of the pool from the entrance`. The unchanged reusable My Meet Day renderer continues to prepend `Set up` followed by a separating space and append punctuation, producing `Set up on the right side of the pool from the entrance.` exactly. The visiting-team setup guidance and all other guide data remain unchanged. No schema field, source date, personal detail, manager-only coordination, conflict, or other superseded fact was introduced. The existing host-manager provenance remains authoritative at High confidence with no residual uncertainty. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this correction was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Long Reach Marlins' Kendall Ridge `homeTeam.familySetupLocation` wording in `teams/teams.json`; visiting-team setup guidance is unchanged. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this operational wording correction. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | This correction did not change `source-state.json`; pre-existing worktree edits were preserved. |

## 2026-06-19 Universal Relay Reminder Normalization

**Active season:** 2026

**Result:** Local application-guidance normalization; no new online official-source review performed.

A user-directed My Meet Day cleanup made the relay early-departure reminder universal for every home and away perspective. The web app now owns the reminder and places it first under Good to know before existing role-aware venue notes. Two identical seasonal copies were removed from role-specific `helpfulNotes`, including the Long Reach Kendall Ridge home guide and the Clary's Forest visiting guide. The accepted operational meaning, schema, source dates, and source authority remain unchanged. `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, and the reviewed source baseline remain unchanged because this ownership cleanup was not a completed online source review and did not add or replace retained source documents.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Removed two duplicate relay early-departure reminder strings from role-specific `helpfulNotes`; no venue-specific fact changed. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed for this ownership cleanup. |
| Review records | Updated | Active annual README evidence and this check-log entry; official-source timestamps remain unchanged. |
| Reviewed source baseline | Unchanged | This normalization did not change `source-state.json`; pre-existing worktree edits were preserved. |

## 2026-06-21T11:58:31-04:00 Seasonal Data Review

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store availability.

Checked the 139-source inventory:

- 76 modeled-evidence URLs were reached by `pnpm run check:data-updates`.
- 63 uncovered official sources and application-used destinations were requested separately with live GET requests.
- 137 required sources were successfully verified.
- 2 application-used destinations were attempted and retained their availability exception: the Long Reach and Phelps Luck merchandise stores returned HTTP 403.

The monitor reported candidates for Columbia Association's Outdoor Swim Lessons page and the Huntington Dolphins practice schedule. The outdoor lesson page retained all represented locations, weekdays, formats, dates, preparation guidance, weather policy, registration destination, and Personal Swim Training destination. CA's main lessons page independently corroborated the one-week morning and six-week evening formats, and the represented destinations remained reachable. The lesson candidate was non-material, required no normalization or schema change, and had High-confidence unchanged evidence with no conflict or residual uncertainty.

Huntington's field-owning team page now explicitly publishes preseason from May 26 through June 18 and regular practices from June 19 through July 24. The live monitor confirmed that the current central CNSL practice PDF still byte-matches retained evidence; its published boundary says preseason continues through the last HCPSS school day and regular practices begin afterward. The sources do not conflict, the detailed team page owns the exact dates, and confidence is High with no residual uncertainty. `teams[id="hd"].practice.preseason[0].period` and `teams[id="hd"].practice.regular.season` were corrected without changing the schema, source destinations, or retained PDFs.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Updated | Huntington Dolphins `practice.preseason[0].period` and `practice.regular.season` in `teams/teams.json`. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Updated | The undated Upcoming section in What's New summarizes the corrected practice-season transition; existing June 21 sitemap dates were preserved. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, `OFFICIAL_SOURCE_UPDATED_AT`, active annual README evidence, and this check-log entry. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with the accepted June 21 fingerprints and current retained-PDF metadata. |

## 2026-06-22T06:40:55-04:00 Seasonal Data Review

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store availability.

Checked the 139-source inventory:

- The first `pnpm run check:data-updates` attempt stopped on a transient HTTP 502 from the Dickinson facility page; a successful retry reached all 76 modeled-evidence URLs.
- All 63 uncovered official sources and application-used destinations were then requested separately with live GET requests.
- 137 required sources returned successful responses.
- The Long Reach and Phelps Luck merchandise stores were attempted and returned the same HTTP 403 responses covered by the existing availability exception.

GitHub Actions run 27946669606 and issue 24 identified candidate `85090cc8811891c6` for the Clemens Crossing Cyclones staff page. The live field-owning page still lists Nick Barnes as head coach and Sofia Hufft, Sophia Luo, and Yaakov Englander as assistant coaches. Its protected links retain the modeled coach and team-manager contact destinations. The page renders Sophia Luo's email as `sophia.luo@columbiaassociation.org`, while the same link resolves to `mailto:sofia.luo@columbiaassociation.org`. Because the annual email field represents the functional contact destination, the actionable first-party link owns that value and agrees with `teams[id="ccc"].staff`; the differing visible spelling is presentation-only. No staff name, role, email destination, manager listing, general contact, source URL, schema, or normalization changed. Confidence is High, with no residual uncertainty about represented data; the publisher may still align the visible email spelling with its functional link target.

| Area | Status | Details |
| --- | --- | --- |
| Modeled application data | Unchanged | None; `teams[id="ccc"].staff` remains current. |
| Application-used source destinations | Unchanged | None. |
| Retained official PDFs | Unchanged | None. |
| Visitor-facing records | Unchanged | None; What's New and sitemap were not changed. |
| Review records | Updated | `OFFICIAL_SOURCE_CHECKED_AT`, active annual README evidence, and this check-log entry; `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged. |
| Reviewed source baseline | Updated | `source-state.json` refreshed with the accepted June 22 staff-page fingerprint and current retained-PDF metadata. |
