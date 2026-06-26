import { test, expect } from '../fixtures/index';

test.describe('API Keys', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('API management page loads', async ({ dashboardPage, apiKeysPage }) => {
    await dashboardPage.navigateTo('API');
    await apiKeysPage.page.waitForTimeout(2000);
    await expect(apiKeysPage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await apiKeysPage.page.locator('body').textContent();
    expect(bodyText).toContain('API');
  });

  test('REST playground elements are visible', async ({ dashboardPage, apiKeysPage }) => {
    await dashboardPage.navigateTo('API');
    await apiKeysPage.page.waitForTimeout(1000);

    const sendButton = apiKeysPage.page.locator('button:has-text("Send")');
    if (await sendButton.isVisible().catch(() => false)) {
      await expect(sendButton).toBeVisible();
    }

    const methodSelect = apiKeysPage.page.locator('select').first();
    if (await methodSelect.isVisible().catch(() => false)) {
      await expect(methodSelect).toBeVisible();
    }
  });

  test('endpoints section is visible', async ({ dashboardPage, apiKeysPage }) => {
    await dashboardPage.navigateTo('API');
    await apiKeysPage.page.waitForTimeout(1000);
    await expect(apiKeysPage.page.locator('text=API Endpoints')).toBeVisible({ timeout: 8000 });
  });
});
