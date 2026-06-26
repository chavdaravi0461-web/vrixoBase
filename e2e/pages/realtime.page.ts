import { Page, Locator } from '@playwright/test';

export class RealtimePage {
  readonly connectionList: Locator;
  readonly eventLog: Locator;

  constructor(readonly page: Page) {
    this.connectionList = page.locator('text=Connections');
    this.eventLog = page.locator('text=Events, text=Event Log');
  }

  async goto() {
    await this.page.goto('/realtime');
    await this.page.waitForLoadState('networkidle');
  }
}
