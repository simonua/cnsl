# Visual Style Guide

This guide records the visual decisions for the CA Pool & CNSL Assistant. Apply it to new visitor-facing work and preserve it when modifying existing views.

## Design Principles

- Keep the interface practical, calm, and easy to scan for families, swimmers, visitors, and volunteers.
- Prefer clear hierarchy, useful spacing, and familiar controls over decorative containers.
- Reuse established components and design tokens before introducing a new visual pattern.
- Keep visual choices consistent across mobile and desktop layouts and in light and dark themes.

## Prose And Sections

- Present ordinary introductions, explanations, invitations, and disclaimers as unframed prose.
- Do not place ordinary prose in a tinted panel or add a rounded container or left accent border.
- Use headings, paragraph spacing, section spacing, and subtle horizontal dividers to establish hierarchy.
- Use `.prose-section` when a group of ordinary paragraphs needs consistent section spacing.
- Do not turn a paragraph into a callout solely to make a page look more visually varied.

## Semantic Callouts

- Reserve callout containers and accent borders for information with a specific semantic or functional role, such as a warning, error, live status, current selection, or schedule exception.
- State the meaning in visible text and appropriate semantics. Color, position, and border styling must not be the only cues.
- Use the existing status colors and components for an established meaning rather than creating a page-specific variation.
- Keep informational legal or source notes as ordinary prose unless immediate visitor attention is required for safety or task completion.

## Cards And Containers

- Use cards for repeated, independently actionable items such as providers, resources, pools, teams, and meets.
- Present directory providers consistently and neutrally. Do not use featured, preferred, sponsored, or ranking treatments unless a separately reviewed product requirement introduces them.
- Do not wrap page introductions or whole page sections in cards.
- Do not nest cards inside cards.
- Keep card corners at the shared `--border-radius` and use shared border and shadow tokens.

## Color And Borders

- Use CSS custom properties from `src/css/styles.css`; do not introduce isolated hard-coded colors.
- Use borders to define controls, repeated items, or meaningful state, not as general paragraph decoration.
- Maintain WCAG 2.0 Level AA contrast in light and dark themes.
- Never rely on color alone to communicate status or an available action.

## Typography And Icons

- Use the existing system font stack and established heading scale.
- Match heading size to its context; compact panels and cards use compact headings.
- Use familiar icons that support the adjacent label. Keep decorative icons out of accessible names with `aria-hidden="true"`.
- Keep icon dimensions stable so labels and navigation items do not shift.

## Interaction And Layout

- Use native controls and semantic HTML before adding ARIA.
- Preserve visible keyboard focus, logical focus order, and touch targets of at least 44 by 44 CSS pixels where practical.
- Keep text and controls within their containers at supported phone and desktop widths.
- Verify affected views in light and dark themes and at mobile and desktop sizes before completion.

## Review Checklist

- Is ordinary prose unframed and free of decorative accent borders?
- Does every callout or accent border communicate a named semantic or functional role?
- Is that meaning available without relying on color or position?
- Does the page reuse existing tokens, components, spacing, and typography?
- Are keyboard, responsive layout, contrast, and accessible naming preserved?
