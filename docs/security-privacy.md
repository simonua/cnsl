# Security And Privacy Decision

Updated: 2026-05-26

## Analytics Decision

The deployed site uses Google Analytics to understand site and feature usage. The tag enables analytics storage so GA4 can recognize users and sessions for standard reporting, while advertising storage, Google signals, and advertising personalization remain disabled. Measurement is implemented only in the maintained analytics script; the tracker ID remains in shared application configuration. There is no in-app analytics preference, and local development does not load the Google tag.

App-authored measurement is limited to public site navigation and feature interactions, outbound-link use without destination details, and settings choices drawn from visible fixed options or the published pool and team directory. Page measurement excludes query strings, fragments, and referrers. Settings measurement excludes current coordinates, and external-link measurement does not send the link URL, label, or destination host. Location is requested only by the Pools page when a visitor separately enables distance estimates.

Preferences stored by this app do not include analytics state or an analytics identifier. GA4 may set its own first-party analytics identifiers for reporting because analytics storage is enabled. Any future analytics change must remain purpose-limited to site and feature use and must not introduce visitor identifiers, contact details, requested coordinates, user-entered text, or unsanitized URLs or referrers. Regression tests must protect that boundary. Enhanced measurement or granular device/location reporting must remain limited to fields separately reviewed against it.

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

## Validation

- The artifact verifier requires analytics storage for standard reporting, rejects direct Google tracking calls outside the analytics module, protects the advertising and navigation-data guardrails, rejects arbitrary inline executable scripts, and rejects the removed consent loader or consent setting.
- Automated accessibility scans exercise all published routes under the enforced default policy.
- The secure-origin release checklist requires a browser-console CSP review while deployed-site analytics is active.
- Published text in About, FAQ, Settings, and What's New describes the visitor-facing privacy behavior.
