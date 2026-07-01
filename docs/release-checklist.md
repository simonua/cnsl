# Release Verification Checklist

Use this checklist for a release that changes visitor-visible behavior, annual data, offline behavior, privacy controls, or published assets. Automated checks protect the build; the HTTPS PWA lifecycle and assistive-technology review must be performed on the delivered site or a secure preview.

## Automated Gate

Run before deploying:

```bash
pnpm run lint
pnpm run validate:data
pnpm audit --audit-level high
pnpm run build
pnpm run verify:pwa
```

Run the exact affected unit-test files and browser workflow/accessibility IDs identified by the release candidate's changes. Do not substitute `pnpm test`, `pnpm run test:coverage`, or `pnpm run test:browser:complete` locally; CI owns complete-suite verification. Record every scoped test command and non-test gate result in the pull request or release record. `pnpm run verify:pwa` reports the public artifact footprint, requires that only the configured active season's data is emitted, and prevents retained annual evidence PDFs from entering the deployment. GitHub Actions runs the complete unit gate, high-severity dependency audit, and the scheduled Chromium/WCAG suite separately.

## Secure-Origin PWA Review

Perform on an HTTPS deployment after a clean browser profile or cleared site data:

| Check | Evidence To Record |
| --- | --- |
| First visit registers a service worker and install is offered where supported. | Browser/version, deployment URL, worker state, install result. |
| After the worker finishes preparing the current app version, Pools, Teams, and Meets open with current directory content while offline without requiring a prior visit to each route. | Worker state, pages opened offline, result. |
| An uncached route while offline presents the intentional offline page. | Uncached URL tested and fallback result. |
| A new deployment activates a changed worker without losing usable offline navigation. | Previous/current cache version and post-update result. |
| Pools, teams, and meets use the precached current-season JSON from the active app version without waiting for a network request. | Route tested, worker/cache version, network observation, result. |

Do not use `pnpm start` for this review: local development deliberately unregisters application service workers and clears its caches.

## Accessibility Walkthrough

Use keyboard-only navigation and at least one available screen reader on the HTTPS build. Record the browser, screen reader and version, viewport, route, and any defect found.

| Workflow | Expected Result |
| --- | --- |
| Skip link and navigation menu | Skip link reaches main content; menu opening contains keyboard focus and closing restores it. |
| Pools filters and disclosures | Filters expose selected state and changed result counts; pool details can be expanded and collapsed by keyboard. |
| Teams and Meets directories | Loading, ready, empty, and error information is announced without repeated card-by-card noise. |
| Settings | Theme, location, favorites, and clearing settings have labels and usable status feedback. |
| Offline page | Status and recovery link are understandable without visual context. |

Automated axe results do not substitute for this walkthrough. Do not state full WCAG conformance unless manual evidence has been recorded. During May, June, and July, scheduled verification runs nightly after a push to `main` in the preceding seven days. It runs the complete unit suite with 100% line, branch, and function coverage thresholds before the complete Chromium workflow and accessibility suite. A unit-test failure, sub-100% coverage result, or browser-test failure creates or updates one issue assigned to the repository owner; the next fully successful run closes that issue.

## Google Analytics Review

Perform this review on the deployed HTTPS site whenever analytics code, the shared layout, Content Security Policy, service-worker behavior, release metadata, or GA administration changes. This is a manual user review: agents, automated browsers, integrated browsers, and VS Code-family embedded browsers must not navigate to the production site because the origin request itself pollutes delivery and geographic traffic records even when analytics collection is disabled or intercepted. Use a normal external browser with a clean profile or cleared site data, preserve the browser network log, and exercise both a normal browser tab and an installed or standalone PWA launch with an active service-worker controller.

### Transport And Payload

| Check | Evidence To Record |
| --- | --- |
| The page loads `https://www.googletagmanager.com/gtag/js` with the configured GA4 web-stream measurement ID. | Deployment URL, launch mode, script URL, HTTP status, and measurement ID. |
| The first browser-profile load of a newly published app version dispatches `page_view` and `ca_version` with the published `app_version`. | Collection endpoint, HTTP result when observable, event names, and app version. |
| Concurrent first loads in a browser tab and installed PWA dispatch only one `ca_version` event for the browser profile. | Launch modes, shared profile state, event count, and app version. |
| An older cached application context does not dispatch `ca_version` or replace a newer reported-version marker. | Cached/current versions, retained marker, and event count. |
| A load after an application upgrade dispatches `ca_upgrade` once with a validated `upgrade_path`; a clean first use does not dispatch it. | Previous and current versions, transmitted path, current local version, and event count. |
| A representative internal route load dispatches its sanitized `page_view`. | Route, event name, sanitized `page_location`, and empty `page_referrer`. |
| A reviewed flyer QR URL dispatches `ca_flyer_visit`, maps only the documented campaign source, medium, and name, and removes those tags from the visible URL before page measurement. | Starting URL, cleaned visible URL, collection fields, and event names. |
| An unrecognized or malformed campaign URL is not consumed or attributed. | Starting URL, unchanged visible URL, and absence of campaign fields and `ca_flyer_visit`. |
| Each authored analytics category in the event inventory is exercised and dispatches only its reviewed coarse event fields. | Interaction, event name, transmitted fields, and any category that is intentionally not applicable. |
| A service-worker-controlled PWA launch still loads the Google tag and dispatches the expected events. | Browser/device, standalone state, active worker state, event names, and app version. |

Treat an HTTP `2xx` or `204` collection response as proof that Google accepted a request for processing, not as proof that the event is visible in GA reports. Beacon-style requests may also appear as canceled or aborted in browser tooling after dispatch, so record the request payload and repeat with a clean cold launch when the response status is not observable.

### Event Inventory

| Event | Representative Trigger | Allowed App-Authored Fields |
| --- | --- | --- |
| `page_view` | Load the home page and one internal route. | Sanitized `page_title`, canonical `page_location`, and empty `page_referrer`. |
| `ca_version` | Load a public application version for the first time in a browser profile. | Published `app_version`. |
| `ca_upgrade` | Load a newer application version after prior use. | Validated `upgrade_path` in `<previous> -> <current>` form, using fixed `0` only when the prior version is unavailable. |
| `ca_error` | Cause one uncaught runtime error and one unhandled promise rejection in a controlled production-analytics simulation. | Published `app_version`; allowlisted `error_name`; fixed `error_context`; validated same-origin app script path or fixed `error_source`; bounded `error_line` and `error_column`; and an eight-character `error_fingerprint` computed locally. Never a raw message, rejection value, stack trace, query, fragment, or external URL. Duplicate fingerprints are suppressed, with at most five distinct reports per page. |
| `ca_flyer_visit` | Open the reviewed flyer QR destination. | No app-authored event fields; the reviewed campaign tuple is mapped separately. |
| `ca_share` | Use one visible sharing method. | Allowlisted sharing `method`, fixed `content_type`, and fixed `item_id`. |
| `ca_external_link` | Open one authored external link. | Allowlisted `link_context`, `link_purpose`, and fixed `link_destination`; pool-page and pool-schedule actions also include an annual-data-validated public `pool_id`. Never a URL, label, or destination host. |
| `ca_setting_change` | Change one available settings category. | Allowlisted `setting_name`; start-page events include an application-allowlisted `selection`; location-awareness events include only an application-allowlisted `enabled` or `disabled` selection; favorite pool/team events may include one annual-data-validated `selection` or fixed `none`; other selected values remain excluded. |
| `ca_banner_interaction` | View, open, or dismiss an available notice banner. | Allowlisted `banner_name` and `banner_action`. |
| `ca_resource_view` | Open or preview a published swim meet resource. | Allowlisted stable `resource_name`; never a URL, path, filename, or visible label. |
| `ca_resource_download` | Download a published swim meet resource. | Allowlisted stable `resource_name`; never a URL, path, filename, or visible label. |
| `ca_directory_detail_open` | Expand a pool, team, or meet-date detail card. | Allowlisted broad `directory_name`; never a pool, team, meet, date, favorite state, or other selection. |
| `ca_install_interaction` | Open install instructions or interact with the browser install prompt. | Allowlisted `install_action`; never platform, device, capability, or prompt metadata. |

### Privacy Boundary

- Confirm every collection request uses analytics storage granted, advertising storage denied, Google signals disabled, advertising personalization disabled, and ads-data redaction enabled.
- Confirm Google Analytics may store its own first-party analytics identifier for aggregate visit and session reporting, while application preferences contain no analytics state or app-authored analytics identifier.
- Confirm application measurement sends no PII, contact details, coordinates, free-form text, persistent app-authored visitor identifier, user-property data, selected filter or preference value outside the reviewed start-page, location-awareness, favorite, and pool-feature exceptions, arbitrary URL query or fragment value, or referrer. Start-page events may include only `home`, `pools`, or `teams`. Location-awareness events may include only `enabled` or `disabled`, never coordinates, current or saved location, calculated distance, browser permission state, or permission results. Favorite pool/team events may include one selection validated against the current annual directory, or fixed `none` when cleared. Pool-specific interactions may include a public pool identifier validated against the current annual directory. Measurement may also count aggregate public page paths, app-version adoption, coarse feature-interaction categories, and only documented fixed campaign labels for app-published inbound links.
- Compare delivered requests with the categorical data-collection boundary in [Security And Privacy Decision](security-privacy.md); any field outside that boundary requires a separate privacy review before collection.
- Confirm Settings exposes no obsolete analytics-consent toggle or stored analytics preference.
- Check the browser console for enforced and report-only Content Security Policy violations on all published routes while analytics is active on HTTPS. If Cloudflare Client-side security emits a `Content-Security-Policy-Report-Only` header, confirm its Scripts and Connections allowlists remain aligned with the application-owned policy in [Security And Privacy Decision](security-privacy.md); changing the HTML meta policy does not update the Cloudflare rule.

### GA Administration And Reportability

- Confirm the GA4 web data stream uses the same measurement ID as the deployed application configuration.
- Confirm Google signals, advertising personalization, enhanced measurement, and granular location/device reporting are disabled unless a separately reviewed exception exists; confirm no linked advertising destination broadens purpose-limited usage reporting into advertising or profiling use.
- Confirm event-scoped custom dimensions required for intended aggregate reporting are registered in GA administration. Register `app_version` before relying on a release-adoption report, `upgrade_path` before comparing application upgrade paths, `error_context`, `error_name`, `error_source`, and `error_fingerprint` before grouping technical errors, `resource_name` before comparing swim meet resource views or downloads by document, `directory_name` before comparing broad directory engagement, `setting_name` before comparing settings categories, `selection` before comparing start-page, location-awareness, or favorite choices, `pool_id` before comparing pool-specific interactions, and `install_action` before reviewing the install funnel.
- Check the GA Realtime view or another appropriate GA report for the expected aggregate events, but record the result separately from browser transport evidence.
- Do not treat successful browser requests as the only completion evidence. Confirm that the intended aggregate events become visible in GA reporting after the expected processing interval, and record any delay or missing report rows separately from browser transport evidence.
- Do not change analytics storage to denied, add app-authored identifiers, or weaken the privacy boundary. Any change to the reporting model requires a separate privacy review, visitor-facing documentation update, and regression coverage.
- Revisit [Security And Privacy Decision](security-privacy.md) before adding any external script, API, image, frame, font, or analytics destination.

Record the network evidence, GA administration evidence, and GA reportability result in the pull request or release record. A review is complete only when it states both whether requests were dispatched and whether the intended aggregate reporting is actually usable under the approved privacy boundary.

## Performance Measurements

Record occasional browser measurements here or in the release record when UI behavior changes materially:

Run `pnpm run measure:performance` for the repeatable local warning baseline. It performs a clean build and starts an isolated local server. By default, it records five cold Chromium samples for Home, Pools, Teams, Meets, and My Meet Day with service workers and external requests blocked, then records five installed samples in persistent worker-controlled contexts with first and repeat directory navigation kept separate. The report includes minimum / median / maximum usable time, first contentful paint, DOM readiness, long tasks, available route phases, median same-origin request, decoded-byte, and transferred-byte counts, request initiators, cache hits, maximum annual-domain request counts, worker readiness and control, and complete PWA cache inventory, install-critical core, and cache-on-use optional tier sizes. It is intentionally separate from functional gates, delivered-HTTPS evidence, and field-device evidence.

- Set `CNSL_PERF_RUNS` to change both the cold and installed-navigation sample counts while investigating variance.
- Set `CNSL_PERF_BUDGET_SCALE` below `1` to verify that a sample regression produces warnings without changing source. Warnings are advisory and do not fail the command.

| Measurement | Route Or Scope | Result | Date / Environment |
| --- | --- | --- | --- |
| Published artifact size | Generated public `out/` artifact | 1,791,640 bytes observed; 78-resource cache inventory; active season output only | 2026-06-02 / local clean build and `verify:pwa` |
| Directory usable/render completion | Pools, Teams, Meets | Cold median: Pools 1,840 ms; Teams 1,424 ms; Meets 1,365 ms | 2026-06-02 / production HTTPS; Windows; Playwright Chromium channel with desktop Chrome 137 UA; cache disabled, service workers blocked, fresh context per cold run; median of 3 runs |
| First-view request count and transfer size | Home and Pools | Cold median: Home 37 requests / 298,427 bytes transferred; Pools 51 requests / 360,911 bytes transferred | 2026-06-02 / production HTTPS; Windows; Playwright Chromium channel with desktop Chrome 137 UA; cache disabled, service workers blocked, fresh context per cold run; median of 3 runs |
| Repeatable local directory baseline | Pools, Teams, Meets | Usable min / median / max: Pools 511 / 553 / 750 ms; Teams 516 / 519 / 547 ms; Meets 405 / 439 / 986 ms; each annual domain requested once per route | 2026-06-05 / clean local artifact; Playwright Chromium; service workers and external requests blocked; fresh context per cold run; 3 runs |
| Pools progressive-render phases | Pools | Median: primary data ready 432 ms; summary visible 478 ms; optional enrichment settled 691 ms | 2026-06-05 / same repeatable local directory baseline |
| PWA cache tiers | Generated public `out/` artifact | 83-resource / 2,525,426-byte complete cache inventory; 61 resources / 945,362 bytes install-critical; 22 resources / 1,580,064 bytes cache on use | 2026-06-05 / local clean build and `measure:performance` |
| Five-sample cold baseline | Home, Pools, Teams, Meets | Usable median: Home 592 ms; Pools 678 ms; Teams 609 ms; Meets 476 ms. Median decoded bytes: Home 325,729; Pools 818,195; Teams 999,337; Meets 737,093. Median transferred bytes: Home 334,729; Pools 833,195; Teams 1,012,537; Meets 749,393. Each directory requested each annual domain once | 2026-06-10 / clean local artifact; Windows ARM64; Node.js 26.3.0; Playwright Chromium; service workers and external requests blocked; fresh context per cold run; 5 runs |
| Five-sample Pools render phases | Pools | Median: primary data ready 444 ms; summary visible 599 ms; optional enrichment settled 672 ms | 2026-06-10 / same five-sample cold baseline |
| Installed navigation lifecycle | Pools, Teams, Meets | All first and repeat samples were worker-controlled and transferred zero bytes. Repeat usable median: Pools 372 ms; Teams 291 ms; Meets 197 ms. One first Pools sample reached 3,548 ms without a corresponding cold or repeat regression | 2026-06-10 / persistent local worker-controlled context; 5 installed samples per route |
| Historical PWA cache tiers | Generated public `out/` artifact | 97-resource / 2,877,025-byte complete cache inventory; 69 resources / 1,016,492 bytes install-critical; 28 resources / 1,860,533 bytes cache on use; zero performance warnings | 2026-06-10 / local clean build and `measure:performance` |
| Current desktop progressive-route baseline | Meets | Usable 448 / 452 / 465 ms; primary data 383 / 388 / 403 ms; summary visible 398 / 404 / 419 ms; optional enrichment 469 / 476 / 491 ms; 76 ms long-task median; 49 requests; 877,619 decoded bytes; each annual domain requested once | 2026-06-18 / freshly built local artifact based on commit `983e4c5`, with concurrent seasonal-review metadata edits present; Windows ARM64; Node.js 26.3.1; Playwright Chromium; service workers and external requests blocked; 3 runs |
| Current slower-CPU progressive-route baseline | Meets | Usable 1,165 / 2,220 / 2,588 ms; primary data 1,004 / 1,457 / 2,403 ms; summary visible 1,021 / 1,590 / 2,460 ms; optional enrichment 1,236 / 2,338 / 2,712 ms; 840 ms long-task median; request and byte totals matched desktop | 2026-06-18 / same freshly built local artifact and working-tree state; 390 by 844 viewport; 4x CPU slowdown; 3 runs; advisory usable, request, and decoded-byte warnings remain |
| Current installed Meets navigation | Meets | All first and repeat samples were worker-controlled and transferred zero bytes. Desktop first / repeat usable median: 193 / 163 ms. `mobile-slow` first / repeat usable median: 723 / 655 ms. Each annual domain was requested once | 2026-06-18 / persistent local worker-controlled contexts; 3 runs per profile |
| Current PWA cache tiers | Generated public `out/` artifact | 107-resource / 3,241,259-byte complete cache inventory; 74 resources / 1,243,976 bytes install-critical; 33 resources / 1,997,283 bytes cache on use. Desktop produced 9 advisory warnings across all routes; `mobile-slow` produced 14 | 2026-06-18 / freshly built local artifact based on commit `983e4c5`, with concurrent seasonal-review metadata edits present; `measure:performance` |
| Refreshed Meets progressive-route baseline | Meets | Desktop usable 507 / 583 / 625 ms; primary data 431 / 506 / 512 ms; summary visible 450 / 530 / 540 ms; optional enrichment 524 / 607 / 624 ms; FCP 180 ms median; DOM ready 462 ms median; long tasks 128 ms median. Unthrottled 390px usable 576 / 734 / 1,666 ms; primary data 504 / 578 / 1,562 ms; summary visible 522 / 611 / 1,587 ms; optional enrichment 596 / 703 / 1,671 ms; FCP 244 ms median; DOM ready 536 ms median; long tasks 114 ms median | 2026-06-23 / clean local artifact based on commit `fa0ad65` with only this refactoring plan modified; Windows ARM64; Node.js 26.3.1; Playwright Chromium; service workers and external requests blocked; 3 runs per profile |
| Refreshed slower-CPU Meets diagnostic | Meets | Usable 1,829 / 2,129 / 3,433 ms; primary data 1,325 / 1,480 / 3,003 ms; summary visible 1,427 / 1,598 / 3,151 ms; optional enrichment 2,164 / 2,560 / 3,524 ms; FCP 528 ms median; DOM ready 1,293 ms median; long tasks 1,303 ms median. The unthrottled mobile profile remained below the usable budget, all measured routes slowed under 4x CPU throttling, and no Meets-specific implementation owner was demonstrated | 2026-06-23 / same source state and machine; 390 by 844 viewport; 4x CPU slowdown; 3 runs |
| Refreshed installed Meets and PWA evidence | Meets and generated public `out/` artifact | Desktop first / repeat usable median 185 / 172 ms; unthrottled mobile 175 / 171 ms; `mobile-slow` 608 / 589 ms. Every sample was worker-controlled with zero transferred bytes and one request per annual domain. Cold profiles used 49 requests, 818,942 decoded bytes, and 833,642 transferred bytes. Cache inventory: 114 resources / 3,485,502 bytes; install-critical core: 75 requests / 1,265,700 bytes; optional tier: 39 resources / 2,219,802 bytes | 2026-06-23 / same three local profiles and source state; current evidence closes the stale Meets optimization recommendation without speculative code changes |
| Authored webfont / FOUT boundary | All routes | System-font-only source boundary covered by unit test; confirm no font requests in delivered page inspection | 2026-05-28 / local validation |

The 2026-06-02 delivered measurements establish the initial HTTPS browser baseline. No asset-optimization follow-up is indicated until a comparable measurement demonstrates a material regression or a visitor-facing performance issue is observed.

## Release Evidence Record

| Release / Preview URL | Automated Gate | HTTPS PWA Review | Keyboard And Screen Reader Review | CSP / Analytics Review | Reviewer / Date |
| --- | --- | --- | --- | --- | --- |
| _Record each qualifying release here or in its pull request._ | - | - | - | - | - |
