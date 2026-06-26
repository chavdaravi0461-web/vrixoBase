import { Page, Locator } from '@playwright/test';

export class SettingsPage {
  readonly projectNameInput: Locator;
  readonly saveButton: Locator;

  constructor(readonly page: Page) {
    this.projectNameInput = page.locator('input[name="name"], input[placeholder*="project name" i], input#name').first();
    this.saveButton = page.locator('button:has-text("Save")');
  }

  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }
}
