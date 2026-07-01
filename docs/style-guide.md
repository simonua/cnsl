# Visual Style Guide

This guide records the visual decisions for the CA Pool & CNSL Assistant. Apply it to new visitor-facing work and preserve it when modifying existing views.

## Design Principles

- Keep the interface practical, calm, and easy to scan for families, swimmers, visitors, and volunteers.
- Prefer clear hierarchy, useful spacing, and familiar controls over decorative containers.
- Reuse established components and design tokens before introducing a new visual pattern.
- Keep visual choices consistent across mobile and desktop layouts and in light and dark themes.

## Voice And Manners

- Write like a helpful local swim parent: warm, familiar, straightforward, and respectful.
- Aim for about an eighth-grade reading level in visitor-facing text. Prefer common words, short sentences, and active voice. Start with what the visitor needs to know or will notice, then add only the detail needed to understand or act.
- Avoid internal implementation terms and technical jargon. When an exact official or technical term is necessary, explain it in plain language the first time.
- Use first person when the maintainer is speaking and address visitors directly as `you` when guidance is clearer that way.
- Refer to the software as `the web app` when describing what it does. Reserve `CNSL` for the league or proper names, and do not use `CNSL` as the actor for web-app behavior.
- Use `please` for requests, corrections, and troubleshooting steps. Thank visitors when they share feedback, report a correction, or recommend a community resource.
- Keep manners natural. Do not repeat `please` in every sentence or add it to concise control labels, navigation, headings, status labels, or urgent safety instructions.
- Never blame visitors for errors or missing information. Briefly explain what happened, mention anything that still works, and offer a polite next step when one is available.
- Preserve factual, privacy, safety, legal, and official-source boundaries, but explain them in plain language rather than sounding defensive or impersonal.

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
- Use title case for concise page, section, card, and dialog names. Capitalize the first and last words and principal words; lowercase articles, coordinating conjunctions, and short prepositions unless they begin or end the heading.
- Keep sentence case for complete questions, sentences, alerts, status messages, and instructional prompts, even when they use heading markup for semantic structure.
- Preserve the official capitalization of proper names, abbreviations, and branded terms.
- Use familiar icons that support the adjacent label. Keep decorative icons out of accessible names with `aria-hidden="true"`.
- Keep icon dimensions stable so labels and navigation items do not shift.

## Interaction And Layout

- Use native controls and semantic HTML before adding ARIA.
- Preserve visible keyboard focus, logical focus order, and touch targets of at least 44 by 44 CSS pixels where practical.
- Keep text and controls within their containers at supported phone and desktop widths.
- Verify affected views in light and dark themes and at mobile and desktop sizes before completion.

### Standard Buttons

- Build general action buttons from the shared `.btn` base, one visual variant such as `.btn-primary` or `.btn-secondary`, and one explicit size class.
- Use `.btn-sm` for compact secondary actions, `.btn-md` for ordinary card and form actions, `.btn-lg` for prominent page or dialog actions, and `.btn-xl` only for an exceptional primary action that needs the largest supported treatment.
- Let labels determine width. Use a component layout rule only when a group requires equal widths, full-width controls, or another documented container relationship.
- Keep icon-only controls, disclosure toggles, calendar navigation, and other controls with specialized interaction dimensions under their component classes instead of forcing them into the standard text-button scale.
- Place familiar decorative icons before button labels, keep them `aria-hidden`, and rely on the shared button gap and icon dimensions rather than literal whitespace or component-specific margins.

## Audience Viewports

Use CSS-pixel viewport dimensions and fluid layouts. The supported responsive range begins at 320 CSS pixels wide; content and controls must not overflow horizontally at or above that floor.

The shared browser harness owns the current audience-derived representatives in `tests/browser/browser-test-helpers.js`:

| Role | Viewport | Use |
| --- | --- | --- |
| Narrow phone | 320 by 693 | Minimum-width and overflow boundary checks |
| Compact phone | 360 by 780 | Compact navigation, controls, and wrapping |
| Primary phone | 393 by 852 | Default mobile workflow and accessibility checks |
| Large phone | 440 by 956 | Upper end of the high-volume phone range |
| Tablet portrait | 820 by 1180 | Phone-to-desktop layout transition |
| Laptop | 1440 by 900 | Default desktop layout with limited vertical space |
| Wide desktop | 1920 by 1080 | Maximum-width, alignment, and line-length checks |

- Treat the primary 393 by 852 viewport as representative of the adjacent high-volume 390 through 402 CSS-pixel audience cluster. Do not create separate breakpoints or duplicate every workflow for nearby resolutions unless a measured layout boundary requires it.
- Run ordinary mobile workflow coverage at the primary phone viewport. Use the focused responsive layout matrix for the full representative set, and add narrow, compact, large-phone, tablet, or desktop variants to a feature workflow only when its behavior or layout depends on that range.
- Keep performance comparisons at 390 by 844 so historical performance samples remain comparable. Performance dimensions and responsive browser-test dimensions have different purposes and need not be identical.
- Reassess the representative set when a meaningful new analytics sample shows an audience shift. Exclude confirmed development and strongly anomalous synthetic traffic before changing design support or test coverage.

## Review Checklist

- Is ordinary prose unframed and free of decorative accent borders?
- Does every callout or accent border communicate a named semantic or functional role?
- Is that meaning available without relying on color or position?
- Does the page reuse existing tokens, components, spacing, and typography?
- Are keyboard, responsive layout, contrast, and accessible naming preserved?
- Does responsive verification cover the affected audience viewport tier without adding redundant nearby-width cases?
- Do requests and recovery guidance sound courteous without becoming wordy or repetitive?
- Does the copy thank visitors where they have offered help, feedback, or a correction?
