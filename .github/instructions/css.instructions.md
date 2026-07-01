---
applyTo: "src/css/**/*.css"
description: "Use when changing visitor-facing CSS, layout, design tokens, responsive behavior, themes, typography delivery, or CSS-related Content Security Policy compatibility under src/css."
---

# CSS Conventions

## Architecture

- Single stylesheet: `src/css/styles.css`.
- Mobile-first responsive design using CSS custom properties (variables).
- No CSS preprocessor (no Sass/Less). Plain CSS only.

## CSS Ownership And CSP

- Keep all authored application presentation rules in `src/css/styles.css`. Do not add CSS rules to HTML, JavaScript, generated markup, JSON, or another asset; do not use HTML `style` attributes, `element.style`, `setAttribute('style', ...)`, CSS-in-JS, or equivalent runtime style injection.
- Preserve the existing `data-initial-canvas` block in `src/views/layouts/base.html` as the sole reviewed exception. It is limited to pre-stylesheet canvas and fixed-header paint stability, and its exact SHA-256 must remain authorized by `style-src`. Do not expand it for component, route, state, or responsive styling.
- Keep ordinary stylesheet changes compatible with the shared Content Security Policy in `src/views/layouts/base.html`: same-origin `styles.css` and the exact initial-canvas hash are the default style sources. Follow the proportionate CSP policy in `copilot-instructions.md`; `'unsafe-inline'`, `style-src-attr`, a new style origin, or a broader source expression may be used when a reviewed practical need outweighs the defense-in-depth benefit of the stricter default.
- Review every new CSS `url()`, `@import`, font, data URL, blob URL, or external asset against the applicable CSP directive and `docs/security-privacy.md`. Prefer an existing same-origin asset when it is equally practical, and document material CSP broadening with focused artifact coverage.
- When changing the initial canvas or any CSS delivery mechanism, update the CSP hash or directive intentionally, retain the PostHTML fail-closed validation, update `docs/security-privacy.md`, and run `pnpm run build` followed by `pnpm run verify:pwa`. For ordinary `styles.css` changes, confirm that no CSP source or exception is being introduced.

## Custom Properties

All theme values are defined in `:root` in `styles.css`. Use these instead of hardcoding colors:

- `--primary-color`, `--primary-dark`, `--primary-light`
- `--success-color`, `--warning-color`, `--error-color`, `--info-color`
- `--light-bg`, `--white`, `--text-dark`, `--text-muted`
- `--border-color`, `--shadow`, `--shadow-hover`
- `--header-height`, `--footer-height`, `--border-radius`, `--transition`

## Rules

- Follow the visual decisions in `docs/style-guide.md` for all visitor-facing CSS.
- Use `var(--property-name)` for all colors, spacing, and transitions.
- Use `rem` or `em` for font sizes and spacing. Avoid `px` except for borders and fine-grained control.
- Keep selectors shallow (max 3 levels of nesting).
- Use BEM-style naming for component classes when adding new components.
- Keep application typography on the existing local system font stacks. Do not add `@font-face`, font-file assets, hosted font stylesheets, font preloads, or font-swapping loaders without an explicit architecture and performance review that prevents visible font replacement during rendering.
- Keep `css/styles.css` as a normal render-blocking stylesheet in the shared layout; do not convert it to an asynchronous initial-style load.
- Keep ordinary prose unframed. Do not add backgrounds, rounded containers, or left accent borders to introductions, explanations, invitations, or disclaimers. Reserve accent borders for documented semantic or functional states, and never use color or border treatment as the only state cue.
