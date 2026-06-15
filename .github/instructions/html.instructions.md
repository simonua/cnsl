---
applyTo: "src/views/**/*.html"
---

# HTML & PostHTML Conventions

## Templating

- All pages extend `src/views/layouts/base.html` using `<block name="content">`.
- Reusable fragments go in `src/views/components/` and are included via `<include src="components/name.html">`.
- PostHTML plugins used: `posthtml-extend` (layouts), `posthtml-include` (components).

## Structure

- Pages live in `src/views/*.html` (flat, no subdirectories for pages).
- Components live in `src/views/components/` (header, nav, footer, search, quick-links).
- There is one layout: `src/views/layouts/base.html`.

## Rules

- Use semantic HTML5 elements (`<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`, `<article>`).
- Include proper `aria-` attributes for interactive elements.
- Keep inline `<script>` blocks minimal — prefer separate `.js` files.
- Load JS files at the end of `<body>` (before closing `</body>` tag) in dependency order: every script that provides a referenced global must appear before each consumer.
- When a consumer gains a dependency such as `HtmlSafety`, hoist the provider above that consumer on every applicable route or shared layout in the same change. Do not rely on delayed function execution to compensate for an incorrectly ordered script list.
