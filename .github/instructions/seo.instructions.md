---
applyTo: "src/views/**/*.html"
description: "Use when changing SEO, page metadata, visible page titles, headings, navigation labels, quick links, social previews, canonical URLs, or structured data in HTML views."
---

# SEO And Visible Titles

## Metadata Owns Search Detail

- Keep descriptive search language in the metadata surfaces designed for it: `<title>`, meta descriptions, canonical URLs, Open Graph and Twitter metadata, and JSON-LD structured data.
- Use accurate current-season, organization, location, schedule, and directory terms in those metadata surfaces when they help visitors understand a search result or shared link.
- Keep related metadata semantically consistent without requiring every field to use identical wording.
- Do not treat an exact text match between `<title>` and the visible `h1` as an SEO requirement.

## Visible Interface Copy Stays Compact

- Keep each visible page `h1` concise, task-oriented, and less prominent than the home welcome treatment. A long browser title may pair with a shorter visible heading.
- Preserve the directory-page labels `Pools & Hours` and `Swim Teams` unless a visitor-facing requirement explicitly calls for different concise wording. Do not replace them with metadata phrases such as `Columbia Association Pool Hours & Schedules` or `CNSL Swim Teams & Practice Schedules`.
- Do not lengthen navigation labels, quick links, buttons, tabs, badges, or other compact controls to carry SEO keywords. These labels serve visitor navigation and interaction first.
- Preserve responsive compact labels where a wider label would wrap or crowd a mobile control. Keep the complete destination meaning available through the page metadata, surrounding content, or wider-screen presentation rather than forcing it into the narrow control.
- Do not increase heading size, weight, spacing, or visual prominence for SEO. Search relevance comes from accurate semantic content and metadata, not oversized typography.

## Semantic And Responsive Requirements

- Retain one meaningful `h1` for the primary page topic and maintain a logical heading hierarchy beneath it.
- Keep ordinary internal-page `h1`s visually restrained through the shared `main h1` treatment. Keep specialized home or feature headings independently styled only when their page role warrants stronger prominence.
- At supported phone widths, concise directory headings and compact quick-link labels should remain on one line where practical and must not cause horizontal overflow, clipped text, reduced touch targets, or undersized icons.
- When SEO metadata changes without a visitor-facing interface requirement, leave visible heading and control copy unchanged.

## Verification

- Build after changing view metadata or visible headings so the generated HTML can be inspected.
- Verify the affected page has the intended `<title>`, description, canonical destination, social metadata, structured data, and one meaningful visible `h1`.
- For visible heading or compact-control changes, run the exact affected mobile Playwright workflow and confirm text wrapping, icon dimensions, bounds, heading hierarchy, and accessible names remain correct.
- Update the relevant `sitemap.xml` `lastmod` only when an indexable public page or shared public layout materially changed, following the repository-wide sitemap rule.
