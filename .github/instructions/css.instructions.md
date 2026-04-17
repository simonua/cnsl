---
applyTo: "src/css/**/*.css"
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

- Use `var(--property-name)` for all colors, spacing, and transitions.
- Use `rem` or `em` for font sizes and spacing. Avoid `px` except for borders and fine-grained control.
- Keep selectors shallow (max 3 levels of nesting).
- Use BEM-style naming for component classes when adding new components.
