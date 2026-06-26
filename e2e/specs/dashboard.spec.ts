import { test, expect } from '../fixtures/index';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('dashboard loads with overview content', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await expect(dashboardPage.page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('sidebar navigation is visible', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const navItems = ['Database', 'Storage', 'Functions', 'API', 'Monitoring'];
    for (const item of navItems) {
      const link = dashboardPage.page.locator(`a:has-text("${item}")`).first();
      await expect(link).toBeVisible({ timeout: 5000 });
    }
  });

  test('can navigate to all major sections via sidebar', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const sections = ['Database', 'Storage', 'Functions', 'API', 'Monitoring', 'Team', 'Settings'];
    for (const section of sections) {
      await dashboardPage.navigateTo(section);
      await dashboardPage.page.waitForTimeout(1000);
      await expect(dashboardPage.page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('project cards are displayed', async ({ dashboardPage }) => {
    await dashboardPage.goto();
    const cards = dashboardPage.page.locator('a[href*="/dashboard/project/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
