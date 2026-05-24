# Security And Privacy Decision

Updated: 2026-05-24

## Analytics Decision

The deployed site uses anonymized aggregate usage analytics through Google Tag Manager to understand general site use without tracking individual visitors. There is no analytics-consent preference to store or administer. Local development does not load Tag Manager, keeping development and automated browser checks deterministic.

This site does not deliberately send favorite pool, favorite team, location-awareness state, current coordinates, or annual-directory content to analytics. Location is requested only by the Pools page when the visitor separately enables distance estimates.

Preferences stored on the device do not include analytics state and are not deliberately sent through analytics.

## Browser Policy Decision

GitHub Pages does not provide repository-managed HTTP response headers for this deployment, so the delivered HTML publishes a `Content-Security-Policy` meta policy in the shared layout. The policy is enforced by browsers for page-loaded content and must be checked after any new external integration.

| Directive Area | Allowed Sources | Reason |
| --- | --- | --- |
| Default, base URL, manifest, worker | Same origin only | Site artifact and PWA lifecycle. |
| Scripts | Same origin, inline script content, `https://www.googletagmanager.com` | Site JavaScript, JSON-LD structured metadata, and deployed-site Tag Manager. |
| Styles | Same origin and inline styles | Existing calendar positioning/status presentation still uses controlled inline styles. |
| Connections | Same origin, `https://api.weather.gov`, Google Analytics endpoints | Annual/static content, weather safety alerts, and anonymized usage measurement. |
| Images | Same origin, data URLs, Google Analytics endpoints | Delivered images and possible analytics beacon transport. |
| Frames and objects | None | No embedded third-party user experience is required. |

The use of `unsafe-inline` is an acknowledged constraint rather than a blanket security claim. Inline navigation and directory-card event handlers were removed in this pass; analytics is initialized from a shared same-origin script. A future tightening effort can externalize or hash JSON-LD/remaining inline rendering behavior before removing these allowances.

## Validation

- The artifact verifier requires the shared deployed-site analytics bootstrap and rejects the removed consent loader or consent setting.
- Automated accessibility scans exercise all published routes under the enforced default policy.
- The secure-origin release checklist requires a browser-console CSP review while deployed-site analytics is active.
- Published text in About, FAQ, Settings, and What's New describes the visitor-facing privacy behavior.
