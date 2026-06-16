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
