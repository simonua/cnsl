const { test, expect } = require('../browser-test');

const VISIBLE_DATED_RELEASE_COUNT = 10;

test('[WF-RELEASE-002] release history reveals older releases on request', async ({ page }) => {
  await page.goto('/whats-new.html');

  const archive = page.locator('.release-archive');
  const allReleases = page.locator('.release-highlights');
  const visibleReleases = page.locator('.release-highlights:visible');
  const visibleDatedReleases = page.locator('.release-highlights[id^="version-"]:visible');
  const archivedReleases = archive.locator('.release-highlights');
  const expectedVisibleReleaseCount = VISIBLE_DATED_RELEASE_COUNT + await page.locator('#upcoming').count();

  expect(await allReleases.count()).toBeGreaterThan(expectedVisibleReleaseCount);
  await expect(archive).not.toHaveAttribute('open', '');
  await expect(visibleReleases).toHaveCount(expectedVisibleReleaseCount);
  await expect(visibleDatedReleases).toHaveCount(VISIBLE_DATED_RELEASE_COUNT);
  await expect(archivedReleases.first()).toBeHidden();

  await archive.locator('summary').click();

  await expect(archive).toHaveAttribute('open', '');
  await expect(archivedReleases.first()).toBeVisible();
  await expect(visibleReleases).toHaveCount(await allReleases.count());
});

test('[WF-RELEASE-003] archived release fragments reveal their targets', async ({ page }) => {
  await page.goto('/whats-new.html');

  const archivedTarget = page.locator('.release-archive .release-highlights').last();
  const targetId = await archivedTarget.getAttribute('id');
  expect(targetId).toBeTruthy();

  await page.goto(`/whats-new.html#${targetId}`);

  await expect(page.locator('.release-archive')).toHaveAttribute('open', '');
  await expect(archivedTarget).toBeVisible();
});
