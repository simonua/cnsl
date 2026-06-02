# Security And Privacy Decision

Updated: 2026-06-01

## Analytics Decision

The deployed site uses Google Analytics for purpose-limited aggregate site and feature usage reporting. Analytics storage and advertising storage are denied, and Google signals and advertising personalization are disabled, so the app does not enable Analytics identifiers that associate campaign visits with a visitor across visits. The app does not send an account identity or app-maintained identifier to Analytics. Measurement is implemented only in the maintained analytics script; the tracker ID remains in shared application configuration. There is no in-app analytics preference, and local development does not load the Google tag.

App-authored measurement is limited to aggregate public page-path counts, app version adoption, reviewed fixed campaign labels for app-published inbound links, a fixed count of visits opened from the published flyer QR code, use of visible sharing methods, external-link use without destination details, and the category of a settings interaction. The flyer QR code uses `utm_source=flyer`, `utm_medium=qr`, and `utm_campaign=2026_pool_season`; only that complete reviewed tuple is mapped to Google Analytics campaign source, medium, and name fields to compare source effectiveness in aggregate. Those tags are removed locally from the home-page address before page measurement, and the full tagged URL is not transmitted as page location. Measurement does not transmit arbitrary query or fragment values, a selected pool, team, filter, layout, theme, refresh value, location choice, or expanded-state value. Page measurement excludes query strings, fragments, and referrers. External-link measurement does not send the link URL, label, or destination host. Location is requested only by the Pools page when a visitor separately enables distance estimates; granted coordinates are used only in the browser to calculate distances and are never tracked, saved, or sent by the app.

Preferences stored by this app do not include analytics state or an analytics identifier. Google Analytics is configured with analytics storage denied so the app does not permit first-party analytics storage for usage, campaign, or session reporting. Any future analytics change must remain purpose-limited to aggregate site, campaign, and feature use and must not introduce app-authored visitor identifiers, stored preference values, contact details, requested coordinates, user-entered text, arbitrary query or fragment values, or unsanitized URLs or referrers. Campaign fields require reviewed, fixed labels on app-published inbound links and regression coverage before use. Enhanced measurement or granular device/location reporting must remain disabled unless separately reviewed against it.

## Browser Policy Decision

GitHub Pages does not provide repository-managed HTTP response headers for this deployment, so the delivered HTML publishes a `Content-Security-Policy` meta policy in the shared layout. The policy is enforced by browsers for page-loaded content and must be checked after any new external integration.

| Directive Area | Allowed Sources | Reason |
| --- | --- | --- |
| Default, base URL, manifest, worker | Same origin only | Site artifact and PWA lifecycle. |
| Scripts | Same origin, generated SHA-256 hashes for inline JSON-LD only, `https://www.googletagmanager.com`, `https://static.cloudflareinsights.com` | Site JavaScript, structured metadata, the deployed-site Google tag for Analytics, and the Cloudflare Insights beacon loaded by the delivery layer. |
| Styles | Same origin and inline styles | Navigation offset calculation, calendar positioning, and status presentation still use controlled runtime styles. |
| Connections | Same origin, `https://api.weather.gov`, Google Analytics endpoints, `https://cloudflareinsights.com` | Annual/static content, weather safety alerts, purpose-limited usage measurement, and Cloudflare Insights beacon delivery telemetry. |
| Images | Same origin, data URLs, Google Analytics endpoints | Delivered images and possible analytics beacon transport. |
| Frames and objects | None | No embedded third-party user experience is required. |

Arbitrary inline executable scripts are no longer permitted: the early cached-weather rendering path is a same-origin asset and the build grants a SHA-256 authorization only to page JSON-LD. The remaining `style-src 'unsafe-inline'` permission is an acknowledged constraint rather than a blanket security claim because supported UI positioning and status styling still update runtime styles. A future tightening effort can move those presentation states to class-based or otherwise CSP-compatible styling before removing that remaining allowance.

## Weather Service Location Decision

Weather safety alerts use a fixed Columbia-area point representing the pool area (`39.2014,-76.8610`), not a visitor's current location or ZIP code. The app requests [active alerts](https://api.weather.gov/alerts/active?point=39.2014%2C-76.8610) and [forecast metadata](https://api.weather.gov/points/39.2014,-76.8610) from the National Weather Service for that fixed point. The forecast metadata response supplies the National Weather Service forecast URL used for the near-term forecast check. Optional browser location awareness is a separate Pools-page feature used only to calculate visitor-enabled distance estimates in the browser; even when access is granted, the app never tracks, saves, or sends the visitor's current location.

## Validation

- The artifact verifier requires analytics storage to remain denied, permits only the reviewed flyer campaign tuple and parameter-free flyer visit count for the locally consumed flyer link, rejects transmitted setting values and direct Google tracking calls outside the analytics module, protects the advertising and navigation-data guardrails, rejects arbitrary inline executable scripts, and rejects the removed consent loader or consent setting.
- Automated accessibility scans exercise all published routes under the enforced default policy.
- The secure-origin release checklist requires a browser-console CSP review while deployed-site analytics is active.
- Published text in About, FAQ, Settings, and What's New describes the visitor-facing privacy behavior.
