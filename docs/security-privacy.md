# Security And Privacy Decision

Updated: 2026-05-25

## Analytics Decision

The deployed site uses anonymized aggregate usage analytics through the Google tag for Google Analytics to understand general site use without tracking individual visitors. The tag denies analytics and advertising storage, disables Google signals and advertising personalization, redacts advertising data, and emits page views only with the public page path and title; query strings, fragments, and referrers are not included. There is no analytics-consent preference to store or administer because the app does not enable identifying analytics storage. Local development does not load the Google tag, keeping development and automated browser checks deterministic.

When a visitor changes their favorite pool or favorite team in Settings, the site sends a `select_favorite` aggregate usage event with `favorite_type` and `favorite_value` parameters. Those values are restricted to fixed public pool/team choices loaded from the published directory, or `none`; the app will not send arbitrary strings through that event. It does not deliberately send visitor names, staff or contact details, location-awareness state, current coordinates, appearance settings, free-form text, persistent identifiers, or annual-directory content beyond an explicitly approved fixed public choice. Location is requested only by the Pools page when the visitor separately enables distance estimates.

Preferences stored on the device do not include analytics state or an analytics identifier. Favorite selections remain stored locally and are additionally counted only when the visitor changes one of those published choices.

### Measured And Permitted Choice Data

| Measurement | Data Sent | Status |
| --- | --- | --- |
| Page use | Public page path and page title only | Implemented |
| Sharing action | Fixed share method and fixed home-page item value | Implemented |
| Favorite change | `pool` or `team` plus one published directory choice or `none` | Implemented |
| Pool-feature filter use | Only a fixed published pool-feature choice, if introduced with disclosure and regression tests | Permitted boundary; not currently implemented |

Any future analytics change must remain purpose-limited to aggregate app and feature use. It must not introduce `user_id`, user properties describing a visitor, Google advertising/signals features, cookies or other analytics storage, requested coordinates, contact details, user-entered text, or unsanitized URLs/referrers. New fixed-choice events, including pool-feature filter measurement, require an update to the implemented-measurement table and tests proving arbitrary values cannot be emitted before release. The Google Analytics property must also keep Google signals, advertising personalization, and granular location/device reporting disabled wherever its administrative controls can collect data beyond this source configuration. Enhanced measurement must remain disabled unless each enabled automatic event and every transmitted field has been reviewed and documented as meeting this anonymous-data boundary.

## Browser Policy Decision

GitHub Pages does not provide repository-managed HTTP response headers for this deployment, so the delivered HTML publishes a `Content-Security-Policy` meta policy in the shared layout. The policy is enforced by browsers for page-loaded content and must be checked after any new external integration.

| Directive Area | Allowed Sources | Reason |
| --- | --- | --- |
| Default, base URL, manifest, worker | Same origin only | Site artifact and PWA lifecycle. |
| Scripts | Same origin, inline script content, `https://www.googletagmanager.com`, `https://static.cloudflareinsights.com` | Site JavaScript, JSON-LD structured metadata, the deployed-site Google tag for Analytics, and the Cloudflare Insights beacon loaded by the delivery layer. |
| Styles | Same origin and inline styles | Existing calendar positioning/status presentation still uses controlled inline styles. |
| Connections | Same origin, `https://api.weather.gov`, Google Analytics endpoints, `https://cloudflareinsights.com` | Annual/static content, weather safety alerts, anonymized usage measurement, and Cloudflare Insights beacon delivery telemetry. |
| Images | Same origin, data URLs, Google Analytics endpoints | Delivered images and possible analytics beacon transport. |
| Frames and objects | None | No embedded third-party user experience is required. |

The use of `unsafe-inline` is an acknowledged constraint rather than a blanket security claim. Inline navigation and directory-card event handlers were removed in this pass; analytics is initialized from a shared same-origin script. A future tightening effort can externalize or hash JSON-LD/remaining inline rendering behavior before removing these allowances.

## Validation

- The artifact verifier requires the shared deployed-site analytics bootstrap, its anonymous configuration guardrails, and rejects the removed consent loader or consent setting.
- Automated accessibility scans exercise all published routes under the enforced default policy.
- The secure-origin release checklist requires a browser-console CSP review while deployed-site analytics is active.
- Published text in About, FAQ, Settings, and What's New describes the visitor-facing privacy behavior.
