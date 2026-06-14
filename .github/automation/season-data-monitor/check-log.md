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
