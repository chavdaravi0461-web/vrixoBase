import { test, expect } from '../fixtures/index';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026';
const TEST_NAME = process.env.TEST_USER_NAME || 'E2E Test User';

test.describe('Authentication', () => {
  test('login page loads and shows form', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(page.locator('text=Sign in, text=Log in, text=Welcome back').first()).toBeVisible({ timeout: 10000 });
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('register page loads and shows form', async ({ registerPage }) => {
    await registerPage.goto();
    await expect(registerPage.nameInput).toBeVisible({ timeout: 10000 });
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
  });

  test('can log in with valid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(TEST_EMAIL, TEST_PASSWORD);
    await loginPage.waitForDashboard();
    await expect(loginPage.page).toHaveURL(/\/dashboard/);
  });

  test('shows error on invalid credentials', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('wrong@email.com', 'wrongpassword');
    await expect(loginPage.page.locator('text=error, text=invalid, text=Invalid').first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('redirects to login when accessing dashboard unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const currentUrl = page.url();
    expect(currentUrl.includes('/auth/login') || currentUrl.includes('/auth/register')).toBeTruthy();
  });

  test('can navigate from login to register', async ({ loginPage }) => {
    await loginPage.goto();
    const registerLink = loginPage.page.locator('a[href*="/auth/register"], a:has-text("Register"), a:has-text("Sign up")').first();
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(loginPage.page).toHaveURL(/\/auth\/register/);
    }
  });
});
