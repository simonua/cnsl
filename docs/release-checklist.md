# Release Verification Checklist

Use this checklist for a release that changes visitor-visible behavior, annual data, offline behavior, privacy controls, or published assets. Automated checks protect the build; the HTTPS PWA lifecycle and assistive-technology review must be performed on the delivered site or a secure preview.

## Automated Gate

Run before deploying:

```bash
pnpm run lint
pnpm test
pnpm run validate:data
pnpm audit --audit-level high
pnpm run build
pnpm run verify:pwa
```

Record the command results in the pull request or release record. `pnpm run verify:pwa` reports the public artifact footprint, requires that only the configured active season's data is emitted, and prevents retained annual evidence PDFs from entering the deployment. GitHub Actions runs the high-severity dependency audit as a required pre-deployment gate. Playwright is intentionally excluded from local release verification and the Pages build: the nightly browser-verification workflow runs Chromium workflows and automated WCAG A/AA scans after a push to `main` in the preceding 24 hours, or when manually dispatched, without blocking deployment.

## Secure-Origin PWA Review

Perform on an HTTPS deployment after a clean browser profile or cleared site data:

| Check | Evidence To Record |
| --- | --- |
| First visit registers a service worker and install is offered where supported. | Browser/version, deployment URL, worker state, install result. |
| Opening Pools, Teams, and Meets once makes current directory content available offline. | Pages visited online, pages opened offline, result. |
| An uncached route while offline presents the intentional offline page. | Uncached URL tested and fallback result. |
| A new deployment activates a changed worker without losing usable offline navigation. | Previous/current cache version and post-update result. |
| Annual JSON network failure uses cached current-season content after it has been loaded once. | Route tested and offline/cached result. |

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

Automated axe results do not substitute for this walkthrough. Do not state full WCAG conformance unless manual evidence has been recorded.

## Google Analytics Review

Perform this review on the deployed HTTPS site whenever analytics code, the shared layout, Content Security Policy, service-worker behavior, release metadata, or GA administration changes. Local development deliberately does not load the Google tag. Use a clean browser profile or cleared site data, preserve the browser network log, and exercise both a normal browser tab and an installed or standalone PWA launch with an active service-worker controller.

### Transport And Payload

| Check | Evidence To Record |
| --- | --- |
| The page loads `https://www.googletagmanager.com/gtag/js` with the configured GA4 web-stream measurement ID. | Deployment URL, launch mode, script URL, HTTP status, and measurement ID. |
| A home-page load dispatches `page_view` and `ca_version`; `ca_version` carries the published `app_version`. | Collection endpoint, HTTP result when observable, event names, and app version. |
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
| `ca_version` | Load any published page. | Published `app_version`. |
| `ca_flyer_visit` | Open the reviewed flyer QR destination. | No app-authored event fields; the reviewed campaign tuple is mapped separately. |
| `ca_share` | Use one visible sharing method. | Allowlisted sharing `method`, fixed `content_type`, and fixed `item_id`. |
| `ca_external_link` | Open one authored external link. | Allowlisted `link_context` and `link_purpose`; never a URL, label, or destination host. |
| `ca_setting_change` | Change one available settings category. | Allowlisted `setting_name`; never the selected value. |
| `ca_banner_interaction` | View, open, or dismiss an available notice banner. | Allowlisted `banner_name` and `banner_action`. |

### Privacy Boundary

- Confirm every collection request uses analytics storage granted, advertising storage denied, Google signals disabled, advertising personalization disabled, and ads-data redaction enabled.
- Confirm Google Analytics may store its own first-party analytics identifier for aggregate visit and session reporting, while application preferences contain no analytics state or app-authored analytics identifier.
- Confirm application measurement sends no PII, contact details, coordinates, free-form text, persistent identifier, user-property data, saved preference value, selected pool/team, selected filter value, arbitrary URL query or fragment value, or referrer. Measurement may count aggregate public page paths, app-version adoption, coarse feature-interaction categories, and only documented fixed campaign labels for app-published inbound links.
- Compare delivered requests with the categorical data-collection boundary in [Security And Privacy Decision](security-privacy.md); any field outside that boundary requires a separate privacy review before collection.
- Confirm Settings exposes no obsolete analytics-consent toggle or stored analytics preference.
- Check the browser console for Content Security Policy violations on all published routes while analytics is active on HTTPS.

### GA Administration And Reportability

- Confirm the GA4 web data stream uses the same measurement ID as the deployed application configuration.
- Confirm Google signals, advertising personalization, enhanced measurement, and granular location/device reporting are disabled unless a separately reviewed exception exists; confirm no linked advertising destination broadens purpose-limited usage reporting into advertising or profiling use.
- Confirm event-scoped custom dimensions required for intended aggregate reporting are registered in GA administration. Register `app_version` before relying on a release-adoption report.
- Check the GA Realtime view or another appropriate GA report for the expected aggregate events, but record the result separately from browser transport evidence.
- Do not treat successful browser requests as the only completion evidence. Confirm that the intended aggregate events become visible in GA reporting after the expected processing interval, and record any delay or missing report rows separately from browser transport evidence.
- Do not change analytics storage to denied, add app-authored identifiers, or weaken the privacy boundary. Any change to the reporting model requires a separate privacy review, visitor-facing documentation update, and regression coverage.
- Revisit [Security And Privacy Decision](security-privacy.md) before adding any external script, API, image, frame, font, or analytics destination.

Record the network evidence, GA administration evidence, and GA reportability result in the pull request or release record. A review is complete only when it states both whether requests were dispatched and whether the intended aggregate reporting is actually usable under the approved privacy boundary.

## Performance Measurements

Record occasional browser measurements here or in the release record when UI behavior changes materially:

| Measurement | Route Or Scope | Result | Date / Environment |
| --- | --- | --- | --- |
| Published artifact size | Generated public `out/` artifact | 1,791,640 bytes observed; 78 cached resources; active season output only | 2026-06-02 / local clean build and `verify:pwa` |
| Directory usable/render completion | Pools, Teams, Meets | Cold median: Pools 1,840 ms; Teams 1,424 ms; Meets 1,365 ms | 2026-06-02 / production HTTPS; Windows; Playwright Chromium channel with desktop Chrome 137 UA; cache disabled, service workers blocked, fresh context per cold run; median of 3 runs |
| First-view request count and transfer size | Home and Pools | Cold median: Home 37 requests / 298,427 bytes transferred; Pools 51 requests / 360,911 bytes transferred | 2026-06-02 / production HTTPS; Windows; Playwright Chromium channel with desktop Chrome 137 UA; cache disabled, service workers blocked, fresh context per cold run; median of 3 runs |
| Authored webfont / FOUT boundary | All routes | System-font-only source boundary covered by unit test; confirm no font requests in delivered page inspection | 2026-05-28 / local validation |

The 2026-06-02 delivered measurements establish the initial HTTPS browser baseline. No asset-optimization follow-up is indicated until a comparable measurement demonstrates a material regression or a visitor-facing performance issue is observed.

## Release Evidence Record

| Release / Preview URL | Automated Gate | HTTPS PWA Review | Keyboard And Screen Reader Review | CSP / Analytics Review | Reviewer / Date |
| --- | --- | --- | --- | --- | --- |
| _Record each qualifying release here or in its pull request._ | - | - | - | - | - |
