import { test, expect } from '../fixtures/index';

test.describe('Settings', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('settings page loads', async ({ dashboardPage, settingsPage }) => {
    await dashboardPage.navigateTo('Settings');
    await settingsPage.page.waitForTimeout(2000);
    await expect(settingsPage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await settingsPage.page.locator('body').textContent();
    expect(bodyText).toContain('Settings');
  });
});
