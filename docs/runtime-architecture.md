# Runtime And Stylesheet Ownership Decision

Updated: 2026-05-24

## Decision

CNSL will retain its lightweight PostHTML build with native browser JavaScript loaded by script tags and one delivered stylesheet. There is no current user-facing or operational benefit that justifies adding a bundler or framework migration. Structural work should make the existing delivery model explicit and testable instead of adding a second module system.

## JavaScript Ownership

| Concern | Owner | Rule |
| --- | --- | --- |
| Shared shell behavior | Shared layout scripts: preferences theme, deployed-site analytics, navigation, PWA, weather alert | Every page may load these through the base layout; they must not depend on a route controller. |
| Annual-data acquisition | `getDataManager()` and its managers | Routes use the singleton; do not issue competing initial annual JSON loads. |
| DOM-free reusable behavior | `src/js/services/`, `models/`, and `types/` | Keep testable without `window` or `document` where practical; export for Node tests. |
| Route display and interaction | One `*-browser.js` or `settings.js` entry script per route | Route templates list their dependencies in order, then load only their entry script. |
| Future/experimental features | Documentation or a separately reviewed implementation | Do not ship placeholder controls or source files in `src/js/`; shipped code is supported code. |

Dependencies remain explicit in each PostHTML route template. A new shared dependency belongs in the base layout only when multiple routes need it on first load; otherwise it belongs beside the route that uses it. Browser coverage must protect any reordering or removal of page scripts.

## CSS Ownership

The site retains one delivered `css/styles.css` resource for simple caching and static hosting. New and refactored source rules should be kept in clear ownership regions within that file:

1. Custom properties, theme values, resets, and common typography.
2. Shared shell components: header, navigation, footer, links, notices, focus, and motion behavior.
3. Reusable controls: buttons, forms, cards, disclosure state, and status messaging.
4. Route-specific sections: Home, Pools, Teams, Meets, Settings, FAQ/resources, and offline content.
5. Media queries adjacent to the component or route they adapt unless a global responsive rule is genuinely shared.

A later split into source partials is appropriate only if the build intentionally concatenates them into the same delivered artifact and the move makes ownership clearer without changing visual behavior.

## Migration Boundary

- Do not introduce ES-module/bundler-only dependencies one route at a time while other pages depend on global script ordering.
- Consider a bundler only after recording a concrete need such as dependency scale, compilation requirements, or measurable performance benefit, together with PWA and browser-test migration work.
- Keep all visitor-visible output changes covered by existing unit/browser/accessibility checks, adding focused coverage where new behavior warrants it.
