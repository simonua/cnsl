---
applyTo: "src/css/**/*.css"
description: "Use when changing visitor-facing CSS, layout, design tokens, responsive behavior, themes, or typography delivery under src/css."
---

# CSS Conventions

## Architecture

- Single stylesheet: `src/css/styles.css`.
- Mobile-first responsive design using CSS custom properties (variables).
- No CSS preprocessor (no Sass/Less). Plain CSS only.

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
