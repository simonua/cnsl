# Release Verification Checklist

Use this checklist for a release that changes visitor-visible behavior, annual data, offline behavior, privacy controls, or published assets. Automated checks protect the build; the HTTPS PWA lifecycle and assistive-technology review must be performed on the delivered site or a secure preview.

## Automated Gate

Run before deploying:

```bash
pnpm run lint
pnpm test
pnpm run validate:data
pnpm run build
pnpm run verify:pwa
pnpm run test:browser
```

Record the command results in the pull request or release record. The local browser command covers keyboard flows and accessible states. GitHub Actions runs `pnpm run test:browser:ci`, including automated WCAG A/AA scans, as a required pre-deployment gate. Use `pnpm run test:browser:accessibility` only when a CI accessibility result needs local reproduction.

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

## Privacy And Policy Check

- Confirm an HTTPS deployed page loads the intended anonymized Google Analytics path with analytics/ad storage denied, advertising and Google signals disabled, and no referrer or query/fragment page data transmitted.
- Confirm application events send no PII, contact details, coordinates, free-form text, persistent identifier, or user-property data. An implemented, documented event may include only an audited fixed public app choice, such as a favorite pool/team choice or a published pool-feature filter choice; tests must reject arbitrary values.
- Compare the emitted application events with the implemented-measurement table in [Security And Privacy Decision](security-privacy.md); an approved fixed-choice category is not collected until that table identifies it as implemented.
- In Google Analytics administration, confirm Google signals, advertising personalization, and granular location/device reporting are disabled for every applicable region; confirm enhanced measurement is disabled or limited only to separately audited anonymous fields; and confirm no linked advertising destination broadens data use.
- Confirm Settings exposes no obsolete analytics-consent toggle or stored analytics preference.
- Check the browser console for Content Security Policy violations on all published routes while analytics is active on HTTPS.
- Revisit [Security And Privacy Decision](security-privacy.md) before adding any external script, API, image, frame, font, or analytics destination.

## Performance Measurements

Record occasional browser measurements here or in the release record when UI behavior changes materially:

| Measurement | Route Or Scope | Result | Date / Environment |
| --- | --- | --- | --- |
| Directory usable/render completion | Pools, Teams, Meets | Pending next HTTPS release review | - |
| First-view request count and transfer size | Home and Pools | Pending next HTTPS release review | - |

## Release Evidence Record

| Release / Preview URL | Automated Gate | HTTPS PWA Review | Keyboard And Screen Reader Review | CSP / Analytics Review | Reviewer / Date |
| --- | --- | --- | --- | --- | --- |
| _Record each qualifying release here or in its pull request._ | - | - | - | - | - |
