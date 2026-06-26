import { test, expect } from '../fixtures/index';

test.describe('Realtime', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('realtime page loads', async ({ dashboardPage, realtimePage }) => {
    await dashboardPage.navigateTo('Realtime');
    await realtimePage.page.waitForTimeout(2000);
    await expect(realtimePage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await realtimePage.page.locator('body').textContent();
    expect(bodyText).toContain('Realtime');
  });
});
