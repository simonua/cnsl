# Seasonal Data Update Check Log

This append-only log records completed online checks of official active-season sources. Each entry uses an `America/New_York` timestamp with an explicit UTC offset and states whether the overall check was complete.

## 2026-06-10T06:56:02-04:00

**Active season:** 2026

**Result:** Incomplete because one application-used destination could not be verified.

Checked 107 unique official URLs:

- 75 checked by `pnpm run check:data-updates`.
- 32 uncovered destinations checked separately.
- 106 sources successfully verified.
- 1 source remained blocked: the Phelps Luck Snappers merchandise store returned HTTP 403 and displayed `Request Blocked` in the shared browser.

The monitor reported candidate changes for the Columbia Association pool schedule page and Huntington Dolphins practice source. Review found no represented-data change: CA's short schedule links still resolved to the retained schedule documents, and Huntington's modeled practice details remained unchanged despite new home-page news content.

## 2026-06-10T22:13:23-04:00

**Active season:** 2026

**Result:** Complete under an explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 132 required official sources and application-used destinations were successfully verified.
- 3 application-used destinations were exempt from required availability verification: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site.
- Browser review reached the Phelps Luck store and Long Reach booster site despite scripted HTTP 403 responses.
- The Long Reach merchandise store returned HTTP 403 and displayed `Request Blocked`; the availability exception allowed the review to complete without treating that response as an official-data failure.

The monitor detected no candidate source differences. No modeled data or application-used destination changed, so `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged.

## 2026-06-11T18:08:10-04:00

**Active season:** 2026

**Result:** Complete under the existing explicit maintainer exception for merchandise-store and booster-site availability.

Checked the 135-source inventory:

- 76 modeled-evidence sources were reached by `pnpm run check:data-updates`.
- 56 uncovered application-used destinations were reached separately with live GET requests.
- 3 application-used destinations retained their availability exception: the Long Reach and Phelps Luck merchandise stores and the Long Reach booster site.

The monitor detected no candidate source differences, and all required uncovered destinations were reachable. No modeled data or application-used destination changed, so `OFFICIAL_SOURCE_UPDATED_AT` remains unchanged.
