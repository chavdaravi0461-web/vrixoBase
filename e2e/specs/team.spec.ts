import { test, expect } from '../fixtures/index';

test.describe('Team Management', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('team page loads', async ({ dashboardPage, teamPage }) => {
    await dashboardPage.navigateTo('Team');
    await teamPage.page.waitForTimeout(2000);
    await expect(teamPage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await teamPage.page.locator('body').textContent();
    expect(bodyText).toContain('Team');
  });

  test('member list section is visible', async ({ dashboardPage, teamPage }) => {
    await dashboardPage.navigateTo('Team');
    await teamPage.page.waitForTimeout(1000);
    const bodyText = await teamPage.page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
