---
applyTo: "src/views/**/*.html"
description: "Use when changing PostHTML views, layouts, components, semantic structure, accessibility markup, or browser-script ordering under src/views."
---

# HTML & PostHTML Conventions

## Templating

- All pages extend `src/views/layouts/base.html` using `<block name="content">`.
- Reusable fragments go in `src/views/components/` and are included via `<include src="components/name.html">`.
- PostHTML uses `posthtml-extend` for layouts and the local `includePlugin` in `posthtml.js` for components.

## Structure

- Pages live in `src/views/*.html` (flat, no subdirectories for pages).
- Components live in `src/views/components/` (header, nav, footer, search, quick-links).
- There is one layout: `src/views/layouts/base.html`.

## Rules

- Use semantic HTML5 elements (`<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`, `<article>`).
- Include proper `aria-` attributes for interactive elements.
- Keep executable JavaScript in separate `.js` files except for the single shared early-theme bootstrap in `layouts/base.html`. That bootstrap must remain before the stylesheet, use `data-cfasync="false"` and `data-theme-bootstrap="true"`, and stay within the exact build-validator exception in `posthtml.js`.
- Keep inline CSS in the shared `data-initial-canvas` style block only. Its exact SHA-256 must remain in `style-src`; the build validator rejects a stale hash or another inline style block.
- Load JS files at the end of `<body>` (before closing `</body>` tag) in dependency order: every script that provides a referenced global must appear before each consumer.
- When a consumer gains a dependency such as `HtmlSafety`, hoist the provider above that consumer on every applicable route or shared layout in the same change. Do not rely on delayed function execution to compensate for an incorrectly ordered script list.
