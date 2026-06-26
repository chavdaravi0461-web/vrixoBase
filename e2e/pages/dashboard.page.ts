import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly projectCards: Locator;
  readonly sidebarNav: Locator;
  readonly projectDropdown: Locator;

  constructor(readonly page: Page) {
    this.projectCards = page.locator('a[href*="/dashboard/project/"], [class*="project"] >> nth=0');
    this.sidebarNav = page.locator('nav a, [class*="sidebar"] a');
    this.projectDropdown = page.locator('[class*="project-select"] button, [class*="project-dropdown"] button, header [role="combobox"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async selectFirstProject() {
    const cards = this.page.locator('a[href*="/dashboard/project/"]');
    const count = await cards.count();
    if (count > 0) {
      await cards.first().click();
      await this.page.waitForTimeout(2000);
      return true;
    }
    return false;
  }

  async navigateTo(section: string) {
    const link = this.page.locator(`a:has-text("${section}"), nav a:has-text("${section}")`).first();
    if (await link.isVisible()) {
      await link.click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}
