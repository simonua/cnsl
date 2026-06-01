# Printable Flyer

This folder contains a one-page printable handout for the **CA Pool & CNSL Assistant** web app at <https://pools.longreachmarlins.org>. The flyer is intended for community sharing during the outdoor pool and summer swim season: it introduces the app as a convenient planning companion and directs families to the site by QR code.

The flyer should remain welcoming and factual. It may describe visitor-facing conveniences provided by the app, but it must not criticize Columbia Association (CA), CNSL, or their websites and tools. CA and CNSL published information remains authoritative for time-sensitive plans.

## Revisions

Each published flyer revision lives in its own self-contained folder named for its revision date in `YYYY-MM-DD` format. If more than one printable revision is prepared on the same date, append `-r2`, `-r3`, and so on. Do not overwrite an earlier distributed revision; copy its source into a new revision folder before making new visitor-facing edits.

| Revision | Purpose |
| --- | --- |
| [2026-05-31](2026-05-31) | Initial printable flyer revision for the 2026 outdoor pool season. |

Each revision folder contains the following files:

| File | Purpose |
| --- | --- |
| `ca-pool-cnsl-assistant-flyer.html` | Editable letter-size flyer source. Maintain the copy and visual layout here. |
| `ca-pool-cnsl-assistant-qr.svg` | Print-quality QR code encoding the reviewed flyer landing URL. |
| `ca-pool-cnsl-assistant-flyer.pdf` | Ready-to-print US Letter PDF distributed to printers or volunteers. |
| `ca-pool-cnsl-assistant-flyer-preview.png` | Quick visual preview for reviewing layout without opening the PDF. |

## Content Guidance

- Focus on common planning questions: where to swim today, what is next for a team, how to keep schedules handy, and where to check timely status information.
- Describe only app behavior that is already delivered and visible to visitors, such as pools, teams, meets, preferences, installation, or previously loaded offline information.
- Keep CA and CNSL references appreciative and neutral. Include the existing reminder to confirm time-sensitive details with the official sources linked in the app.
- Preserve the QR destination as `https://pools.longreachmarlins.org/?utm_source=flyer&utm_medium=qr&utm_campaign=2026_pool_season` unless the reviewed flyer measurement behavior or the app's published canonical home address changes. The fixed UTM values identify this printed QR campaign for aggregate Analytics attribution without enabling analytics storage for individual visitor tracking. The app removes the tags from the visible address after recording the campaign and a flyer visit event.
- Show the revision date in the printed flyer footer and make it match the containing revision folder date.
- Keep the flyer to one US Letter portrait page and ensure the QR code remains large, high-contrast, and unobstructed.

## Editing Workflow

1. Create a new dated revision folder beneath `docs/flyer/` and copy the most recent source and QR asset into it. Use a same-day `-rN` suffix only when needed.
2. Update the wording, layout, and printed revision date in the new revision's `ca-pool-cnsl-assistant-flyer.html` source.
3. If the destination URL changes, regenerate the new revision's `ca-pool-cnsl-assistant-qr.svg` from the repository root. The example below targets the initial revision; replace the folder name for a newer revision:

   ```powershell
   pnpm dlx qrcode -t svg -e H -q 4 -d 123E61FF -l FFFFFFFF -o docs/flyer/2026-05-31/ca-pool-cnsl-assistant-qr.svg "https://pools.longreachmarlins.org/?utm_source=flyer&utm_medium=qr&utm_campaign=2026_pool_season"
   ```

4. Open the HTML source in a browser and print to `ca-pool-cnsl-assistant-flyer.pdf` in the same revision folder using these settings:

   - Paper size: `Letter`
   - Orientation: `Portrait`
   - Margins: `None`
   - Scale: `100%`
   - Background graphics: enabled

5. Refresh `ca-pool-cnsl-assistant-flyer-preview.png` in the same revision folder from the rendered flyer when its layout or copy changes.

## Review Checklist

- Confirm the PDF is exactly one page and that no text is clipped or crowded.
- Confirm the printed revision date matches the revision folder name.
- Scan the printed or rendered QR code with a phone and confirm it opens the app and settles on <https://pools.longreachmarlins.org/> without leaving the flyer marker visible.
- Check that benefit statements still match delivered app behavior.
- Check that references to CA and CNSL remain respectful and that the official-source reminder is present.
- Inspect a color print or print preview to ensure text contrast and QR readability remain strong.

Flyer-only copy or design updates do not change the app version or require a What's New entry because they do not alter delivered application behavior. A change to QR attribution or address-bar cleanup does alter delivered behavior and must remain within the app's reviewed privacy boundary and release-note process.
