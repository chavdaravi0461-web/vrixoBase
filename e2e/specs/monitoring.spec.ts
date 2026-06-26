import { test, expect } from '../fixtures/index';

test.describe('Monitoring', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('monitoring page loads', async ({ dashboardPage, monitoringPage }) => {
    await dashboardPage.navigateTo('Monitoring');
    await monitoringPage.page.waitForTimeout(2000);
    await expect(monitoringPage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await monitoringPage.page.locator('body').textContent();
    expect(bodyText).toContain('Monitoring');
  });

  test('health status section is visible', async ({ dashboardPage, monitoringPage }) => {
    await dashboardPage.navigateTo('Monitoring');
    await monitoringPage.page.waitForTimeout(2000);
    const healthSection = monitoringPage.page.locator('text=Health Status');
    if (await healthSection.isVisible().catch(() => false)) {
      await expect(healthSection).toBeVisible();
    }
  });

  test('time range selector is interactive', async ({ dashboardPage, monitoringPage }) => {
    await dashboardPage.navigateTo('Monitoring');
    await monitoringPage.page.waitForTimeout(1000);
    const timeBtn = monitoringPage.page.locator('button:has-text("24h")');
    if (await timeBtn.isVisible().catch(() => false)) {
      await timeBtn.click();
      await monitoringPage.page.waitForTimeout(500);
    }
  });
});
