# Security And Privacy Decision

Updated: 2026-05-25

## Analytics Decision

The deployed site uses Google Analytics to understand site and feature usage. The tag enables analytics storage so GA4 can recognize users and sessions for standard reporting, while advertising storage, Google signals, and advertising personalization remain disabled. Application-authored page views include the public page path and title only; query strings, fragments, and referrers are not included. There is no in-app analytics preference. Local development does not load the Google tag, keeping development and automated browser checks deterministic.

When a visitor changes their favorite pool or favorite team in Settings, the site sends a `ca_select_favorite` usage event with `favorite_type` and `favorite_value` parameters. Those values are restricted to fixed public pool/team choices loaded from the published directory, or `none`; the app will not send arbitrary strings through that event. The app-defined event parameters do not supply visitor names, staff or contact details, location-awareness state, current coordinates, appearance settings, free-form text, or identifiers. As with standard GA4 events when analytics storage is enabled, GA4 can associate the event with its first-party reporting identifiers. Location is requested only by the Pools page when the visitor separately enables distance estimates.

Preferences stored by this app do not include analytics state or an analytics identifier. GA4 may set its own first-party analytics identifiers for reporting because analytics storage is enabled. Favorite selections remain stored locally and are additionally counted only when the visitor changes one of those published choices.

### Measured And Permitted Choice Data

| Measurement | Data Sent | Status |
| --- | --- | --- |
| Page use | Public page path and page title supplied by the app | Implemented |
| Sharing action | Fixed share method and fixed home-page item value | Implemented |
| Favorite change | `pool` or `team` plus one published directory choice or `none` | Implemented |
| Enhanced measurement | Automatically measured interaction types and associated fields enabled in GA4 web stream administration | Administrative configuration; retain only reviewed event types |
| Pool-feature filter use | Only a fixed published pool-feature choice, if introduced with disclosure and regression tests | Permitted boundary; not currently implemented |

Any future analytics change must remain purpose-limited to app and feature use. It must not introduce `user_id`, user properties describing a visitor, Google advertising/signals features, requested coordinates, contact details, user-entered text, or unsanitized URLs/referrers. Analytics storage and the first-party GA4 identifiers it uses for user/session reporting are approved; advertising storage is not. New fixed-choice events, including pool-feature filter measurement, require an update to the implemented-measurement table and tests proving arbitrary values cannot be emitted before release. The Google Analytics property must keep Google signals and advertising personalization disabled. Enhanced measurement or granular device/location reporting must remain limited to collected fields separately reviewed and documented against this boundary.

## Browser Policy Decision

GitHub Pages does not provide repository-managed HTTP response headers for this deployment, so the delivered HTML publishes a `Content-Security-Policy` meta policy in the shared layout. The policy is enforced by browsers for page-loaded content and must be checked after any new external integration.

| Directive Area | Allowed Sources | Reason |
| --- | --- | --- |
| Default, base URL, manifest, worker | Same origin only | Site artifact and PWA lifecycle. |
| Scripts | Same origin, inline script content, `https://www.googletagmanager.com`, `https://static.cloudflareinsights.com` | Site JavaScript, JSON-LD structured metadata, the deployed-site Google tag for Analytics, and the Cloudflare Insights beacon loaded by the delivery layer. |
| Styles | Same origin and inline styles | Existing calendar positioning/status presentation still uses controlled inline styles. |
| Connections | Same origin, `https://api.weather.gov`, Google Analytics endpoints, `https://cloudflareinsights.com` | Annual/static content, weather safety alerts, purpose-limited usage measurement, and Cloudflare Insights beacon delivery telemetry. |
| Images | Same origin, data URLs, Google Analytics endpoints | Delivered images and possible analytics beacon transport. |
| Frames and objects | None | No embedded third-party user experience is required. |

The use of `unsafe-inline` is an acknowledged constraint rather than a blanket security claim. Inline navigation and directory-card event handlers were removed in this pass; analytics is initialized from a shared same-origin script. A future tightening effort can externalize or hash JSON-LD/remaining inline rendering behavior before removing these allowances.

## Validation

- The artifact verifier requires analytics storage for standard reporting, the advertising and navigation-data guardrails, and rejects the removed consent loader or consent setting.
- Automated accessibility scans exercise all published routes under the enforced default policy.
- The secure-origin release checklist requires a browser-console CSP review while deployed-site analytics is active.
- Published text in About, FAQ, Settings, and What's New describes the visitor-facing privacy behavior.
