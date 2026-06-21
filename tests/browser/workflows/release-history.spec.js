const { test, expect } = require('../browser-test');

const INITIAL_VISIBLE_RELEASE_COUNT = 11;

test('[WF-RELEASE-002] release history reveals older releases on request', async ({ page }) => {
  await page.goto('/whats-new.html');

  const archive = page.locator('.release-archive');
  const allReleases = page.locator('.release-highlights');
  const visibleReleases = page.locator('.release-highlights:visible');
  const archivedReleases = archive.locator('.release-highlights');

  expect(await allReleases.count()).toBeGreaterThan(INITIAL_VISIBLE_RELEASE_COUNT);
  await expect(archive).not.toHaveAttribute('open', '');
  await expect(visibleReleases).toHaveCount(INITIAL_VISIBLE_RELEASE_COUNT);
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
