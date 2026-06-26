import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { RegisterPage } from '../pages/register.page';
import { DashboardPage } from '../pages/dashboard.page';
import { DatabasePage } from '../pages/database.page';
import { SqlEditorPage } from '../pages/sql-editor.page';
import { StoragePage } from '../pages/storage.page';
import { FunctionsPage } from '../pages/functions.page';
import { ApiKeysPage } from '../pages/api-keys.page';
import { TeamPage } from '../pages/team.page';
import { MonitoringPage } from '../pages/monitoring.page';
import { SettingsPage } from '../pages/settings.page';
import { RealtimePage } from '../pages/realtime.page';

interface TestFixtures {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  databasePage: DatabasePage;
  sqlEditorPage: SqlEditorPage;
  storagePage: StoragePage;
  functionsPage: FunctionsPage;
  apiKeysPage: ApiKeysPage;
  teamPage: TeamPage;
  monitoringPage: MonitoringPage;
  settingsPage: SettingsPage;
  realtimePage: RealtimePage;
  authToken: string;
  testProjectId: string;
}

export const test = base.extend<TestFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  databasePage: async ({ page }, use) => use(new DatabasePage(page)),
  sqlEditorPage: async ({ page }, use) => use(new SqlEditorPage(page)),
  storagePage: async ({ page }, use) => use(new StoragePage(page)),
  functionsPage: async ({ page }, use) => use(new FunctionsPage(page)),
  apiKeysPage: async ({ page }, use) => use(new ApiKeysPage(page)),
  teamPage: async ({ page }, use) => use(new TeamPage(page)),
  monitoringPage: async ({ page }, use) => use(new MonitoringPage(page)),
  settingsPage: async ({ page }, use) => use(new SettingsPage(page)),
  realtimePage: async ({ page }, use) => use(new RealtimePage(page)),

  authToken: async ({}, use) => {
    const token = process.env.E2E_ACCESS_TOKEN;
    if (!token) throw new Error('E2E_ACCESS_TOKEN not set. Run global-setup first.');
    await use(token);
  },

  testProjectId: async ({}, use) => {
    const projectId = process.env.E2E_PROJECT_ID;
    await use(projectId || '');
  },
});

export { expect } from '@playwright/test';
