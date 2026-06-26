import { test, expect } from '../fixtures/index';

test.describe('Functions', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('functions page loads', async ({ dashboardPage, functionsPage }) => {
    await dashboardPage.navigateTo('Functions');
    await functionsPage.page.waitForTimeout(2000);
    await expect(functionsPage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await functionsPage.page.locator('body').textContent();
    expect(bodyText).toContain('Functions');
  });
});
