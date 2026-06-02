# Printable Flyer

This folder contains a one-page printable handout for the **CA Pool & CNSL Assistant** web app at <https://pools.longreachmarlins.org>. The flyer is intended for community sharing during the outdoor pool and summer swim season: it introduces the app as a convenient planning companion and directs families to the site by QR code.

The flyer should remain welcoming and factual. It may describe visitor-facing conveniences provided by the app, but it must not criticize Columbia Association (CA), CNSL, or their websites and tools. CA and CNSL published information remains authoritative for time-sensitive plans.

## Revisions

Each published flyer revision lives in its own folder named for its revision date in `YYYY-MM-DD` format. If more than one printable revision is prepared on the same date, append `-r2`, `-r3`, and so on. Do not overwrite an earlier distributed revision; create a new revision folder before making a newly distributed PDF.

| Revision | Purpose |
| --- | --- |
| [2026-06-01](2026-06-01) | Revised PDF flyer with parent-focused planning highlights and Pexels stock photography. |
| [2026-05-31](2026-05-31) | Initial printable flyer revision for the 2026 outdoor pool season. |

New revision folders contain the following finished distribution files when a QR handoff asset is needed:

| File | Purpose |
| --- | --- |
| `ca-pool-cnsl-assistant-flyer.pdf` | Ready-to-print US Letter PDF distributed to printers or volunteers. |
| `ca-pool-cnsl-assistant-qr.svg` | Reviewed high-contrast QR asset for placement or reuse with the printed flyer. |

The initial `2026-05-31` revision retains its HTML source and PNG preview for now. These files are legacy artifacts: do not regenerate, revise, or add them to newer flyer revisions unless this decision is intentionally revisited. Its reviewed QR SVG is copied into the `2026-06-01` revision for reuse with the updated PDF.

The `2026-06-01` PDF uses illustrative stock photos from Pexels for general pool play and a swim race: [people and children in a pool by Willian Justen de Vasconcellos](https://www.pexels.com/photo/people-and-children-in-pool-19821197/) and [people doing a swim race by Jim De Ramos](https://www.pexels.com/photo/people-doing-swim-race-1263349/). Pexels lists these as free stock photos and permits their use in print marketing materials under the [Pexels License](https://www.pexels.com/license/). The water-play photo is the official [CA Pools-8 image from the Columbia Association Pools page](https://columbiaassociation.org/sports-recreation/pools/), credited to Columbia Association in the flyer footer.

## Content Guidance

- Focus on common planning questions: where to swim today, what is next for a team, how to keep schedules handy, and where to check timely status information.
- Describe only app behavior that is already delivered and visible to visitors, such as pools, teams, meets, preferences, installation, or previously loaded offline information.
- Keep CA and CNSL references appreciative and neutral. Include the existing reminder to confirm time-sensitive details with the official sources linked in the app.
- Preserve the QR destination as `https://pools.longreachmarlins.org/?utm_source=flyer&utm_medium=qr&utm_campaign=2026_pool_season` unless the reviewed flyer measurement behavior or the app's published canonical home address changes. The fixed UTM values identify this printed QR campaign for aggregate Analytics attribution. Analytics storage supports reportable aggregate visits and sessions using Google Analytics' own first-party identifier; the app does not send app-authored identity data. The app removes the tags from the visible address after recording the campaign and a flyer visit event.
- Show the revision date in the printed flyer footer and make it match the containing revision folder date.
- Keep the flyer to one US Letter portrait page and ensure the QR code remains large, high-contrast, and unobstructed.

## Editing Workflow

1. Create a new dated revision folder beneath `docs/flyer/` for the finished PDF. Use a same-day `-rN` suffix only when needed.
2. Prepare the updated one-page flyer in the chosen authoring tool, keeping any working HTML or preview image outside the committed revision artifacts.
3. Copy the approved `ca-pool-cnsl-assistant-qr.svg` into a revision when it should be distributed for reuse. If the destination URL changes, regenerate and review the QR asset before publishing it. For example:

   ```powershell
   pnpm dlx qrcode -t svg -e H -q 4 -d 123E61FF -l FFFFFFFF -o tmp/flyer/ca-pool-cnsl-assistant-qr.svg "https://pools.longreachmarlins.org/?utm_source=flyer&utm_medium=qr&utm_campaign=2026_pool_season"
   ```

4. Export or print `ca-pool-cnsl-assistant-flyer.pdf` into the revision folder using these settings:

   - Paper size: `Letter`
   - Orientation: `Portrait`
   - Margins: `None`
   - Scale: `100%`
   - Background graphics: enabled

5. Commit the finished PDF and, when intentionally included, its reviewed QR SVG. PNG previews and HTML sources are disabled publication artifacts.

## Review Checklist

- Confirm the PDF is exactly one page and that no text is clipped or crowded.
- Confirm the printed revision date matches the revision folder name.
- Scan the printed or rendered QR code with a phone and confirm it opens the app and settles on <https://pools.longreachmarlins.org/> without leaving the flyer marker visible.
- Check that benefit statements still match delivered app behavior.
- Check that references to CA and CNSL remain respectful and that the official-source reminder is present.
- Inspect a color print or print preview to ensure text contrast and QR readability remain strong.

Flyer-only copy or design updates do not change the app version or require a What's New entry because they do not alter delivered application behavior. A change to QR attribution or address-bar cleanup does alter delivered behavior and must remain within the app's reviewed privacy boundary and release-note process.
