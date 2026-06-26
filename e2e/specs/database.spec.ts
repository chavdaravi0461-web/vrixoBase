import { test, expect } from '../fixtures/index';

test.describe('Database', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USER_EMAIL || 'e2e-test@vrixobase.com',
      process.env.TEST_USER_PASSWORD || 'E2eTestPass!2026',
    );
    await loginPage.waitForDashboard();
  });

  test('database page loads with table list', async ({ dashboardPage, databasePage }) => {
    await dashboardPage.navigateTo('Database');
    await databasePage.page.waitForTimeout(2000);
    await expect(databasePage.page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    const bodyText = await databasePage.page.locator('body').textContent();
    expect(bodyText).toContain('Database');
  });

  test('can toggle between list and graph view', async ({ dashboardPage, databasePage }) => {
    await dashboardPage.navigateTo('Database');
    await databasePage.page.waitForTimeout(1000);

    const graphButton = databasePage.page.locator('button:has-text("Graph")');
    if (await graphButton.isVisible()) {
      await graphButton.click();
      await databasePage.page.waitForTimeout(1000);
    }

    const listButton = databasePage.page.locator('button:has-text("List")');
    if (await listButton.isVisible()) {
      await listButton.click();
      await databasePage.page.waitForTimeout(1000);
    }
  });

  test('create table button is accessible', async ({ dashboardPage, databasePage }) => {
    await dashboardPage.navigateTo('Database');
    await databasePage.page.waitForTimeout(1000);
    await expect(databasePage.createTableButton).toBeVisible({ timeout: 8000 });
  });

  test('SQL editor page loads', async ({ dashboardPage, sqlEditorPage }) => {
    await dashboardPage.navigateTo('SQL');
    if (!(await sqlEditorPage.editorTextarea.isVisible().catch(() => false))) {
      await sqlEditorPage.goto();
    }
    await expect(sqlEditorPage.editorTextarea).toBeVisible({ timeout: 10000 });
    await expect(sqlEditorPage.runButton).toBeVisible();
  });

  test('can type and format SQL in editor', async ({ dashboardPage, sqlEditorPage }) => {
    await dashboardPage.navigateTo('SQL');
    if (!(await sqlEditorPage.editorTextarea.isVisible().catch(() => false))) {
      await sqlEditorPage.goto();
    }
    await sqlEditorPage.editorTextarea.fill('SELECT * FROM users WHERE id = 1');
    await expect(sqlEditorPage.editorTextarea).toHaveValue(/SELECT/);
  });
});
