import { Page, Locator } from '@playwright/test';

export class FunctionsPage {
  readonly functionList: Locator;

  constructor(readonly page: Page) {
    this.functionList = page.locator('[class*="function"], [class*="Function"]');
  }

  async goto() {
    await this.page.goto('/functions');
    await this.page.waitForLoadState('networkidle');
  }
}
