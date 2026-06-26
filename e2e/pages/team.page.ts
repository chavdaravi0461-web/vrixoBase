import { Page, Locator } from '@playwright/test';

export class TeamPage {
  readonly memberList: Locator;

  constructor(readonly page: Page) {
    this.memberList = page.locator('[class*="member"], [class*="Member"]');
  }

  async goto() {
    await this.page.goto('/team');
    await this.page.waitForLoadState('networkidle');
  }
}
