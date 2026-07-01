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

## Authoring Readability

- Be generous with vertical whitespace by using exactly one empty line at each larger logical boundary, including before sibling `section`, `article`, `aside`, `dialog`, `form`, major control group, PostHTML `include` or `block`, and script or metadata group. One empty line is sufficient: never use two or more consecutive empty lines for separation. Also place exactly one empty line between a major item's closing tag and the next sibling when that makes the boundary easier to scan. Keep `<extends>` directly adjacent to its first `<block>` because `posthtml-extend` treats intervening whitespace as page content and will not apply the layout correctly.
- Keep tightly related leaf markup compact. Do not insert blank lines between a label and its control, an icon and its text, or other nodes that form one small semantic unit.
- Add concise HTML comments to identify non-obvious regions, dynamic-population boundaries, state groups, modal content, and script dependency groups. Explain purpose, ownership, or ordering rather than restating the next element name. Place each comment immediately before the element or element group it describes, with no blank line between them; put any separating whitespace before the comment instead.
- Treat these comments as source-only maintainer documentation. The PostHTML build strips HTML comments from generated pages; never depend on a comment for browser behavior, conditional markup, visitor information, accessibility, security, or build metadata.
- Prefer one useful comment for a coherent region over comments on every element. Small single-purpose components may need whitespace only, or no additional delineation when their structure is already obvious.

## Rules

- Use semantic HTML5 elements (`<main>`, `<nav>`, `<header>`, `<footer>`, `<section>`, `<article>`).
- Include proper `aria-` attributes for interactive elements.
- Keep executable JavaScript in separate `.js` files except for the single shared early-theme bootstrap in `layouts/base.html`. That bootstrap must remain before the stylesheet, use `data-cfasync="false"` and `data-theme-bootstrap="true"`, and stay within the exact build-validator exception in `posthtml.js`.
- When behavior must resolve before first paint, such as a saved start-page redirect or another startup gate, assess whether Cloudflare could defer any parser-blocking script in its dependency chain. Add `data-cfasync="false"` to each script that must retain pre-paint ordering when deferral would expose an incorrect view or state; keep a fail-open path that releases the intended page when evaluation cannot redirect, and add focused browser coverage that detects transient content. Do not add the attribute to ordinary deferred or end-of-body scripts without a verified pre-paint requirement.
- Follow the canonical CSS ownership and CSP boundary in `css.instructions.md`. Do not add CSS rules or `style` attributes to HTML. Preserve the shared `data-initial-canvas` block as the sole reviewed inline exception; its exact SHA-256 must remain in `style-src`, and it must not grow route or component styling.
- Load JS files at the end of `<body>` (before closing `</body>` tag) in dependency order: every script that provides a referenced global must appear before each consumer.
- When a consumer gains a dependency such as `HtmlSafety`, hoist the provider above that consumer on every applicable route or shared layout in the same change. Do not rely on delayed function execution to compensate for an incorrectly ordered script list.
