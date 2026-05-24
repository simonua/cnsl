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
pnpm run verify:performance
pnpm run test:browser
```

Record the command results in the pull request or release record. `pnpm run verify:performance` verifies artifact budgets; browser tests cover keyboard flows, accessible states, and automated WCAG A/AA scans.

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

- Confirm an HTTPS deployed page loads the intended anonymized Google Tag Manager/Analytics path, without sending saved preference values or requested location through application code.
- Confirm Settings exposes no obsolete analytics-consent toggle or stored analytics preference.
- Check the browser console for Content Security Policy violations on all published routes while analytics is active on HTTPS.
- Revisit [Security And Privacy Decision](security-privacy.md) before adding any external script, API, image, frame, font, or analytics destination.

## Performance Baseline And Budget

The automated budget is enforced by `scripts/verify-performance-budget.js` after a build. It limits precached resource count, delivered JavaScript and CSS sizes, and declared first-load local dependencies on key routes. Raise a threshold only alongside a recorded reason and a reviewed measurement.

Baseline recorded on 2026-05-24 after dormant-delivery cleanup: 68 precache resources, 267,264 delivered JavaScript bytes, and 75,721 delivered CSS bytes. The automated limits allow only a small reviewed margin above this baseline.

Record occasional browser measurements here or in the release record when UI behavior changes materially:

| Measurement | Route Or Scope | Result | Date / Environment |
| --- | --- | --- | --- |
| Directory usable/render completion | Pools, Teams, Meets | Pending next HTTPS release review | - |
| First-view request count and transfer size | Home and Pools | Pending next HTTPS release review | - |

## Release Evidence Record

| Release / Preview URL | Automated Gate | HTTPS PWA Review | Keyboard And Screen Reader Review | CSP / Analytics Review | Reviewer / Date |
| --- | --- | --- | --- | --- | --- |
| _Record each qualifying release here or in its pull request._ | - | - | - | - | - |
