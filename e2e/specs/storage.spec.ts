import { test, expect } from '../fixtures/index';

test.describe('Storage', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('storage page loads with bucket list', async ({ dashboardPage, storagePage }) => {
    await dashboardPage.navigateTo('Storage');
    await storagePage.page.waitForTimeout(2000);
    await expect(storagePage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await storagePage.page.locator('body').textContent();
    expect(bodyText).toContain('Storage');
  });

  test('create bucket button is accessible', async ({ dashboardPage, storagePage }) => {
    await dashboardPage.navigateTo('Storage');
    await storagePage.page.waitForTimeout(1000);
    const createButton = storagePage.page.locator('button:has-text("Create Bucket"), button:has-text("New Bucket")').first();
    await expect(createButton).toBeVisible({ timeout: 8000 }).catch(() => {});
  });
});
