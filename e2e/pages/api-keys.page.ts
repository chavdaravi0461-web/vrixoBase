import { Page, Locator } from '@playwright/test';

export class ApiKeysPage {
  readonly apiKeysSection: Locator;
  readonly createKeyButton: Locator;
  readonly endpointGroups: Locator;
  readonly playgroundUrlInput: Locator;
  readonly playgroundSendButton: Locator;

  constructor(readonly page: Page) {
    this.apiKeysSection = page.locator('text=API Keys');
    this.createKeyButton = page.locator('button:has-text("Create"), [aria-label*="create" i]').first();
    this.endpointGroups = page.locator('button:has-text("endpoints")');
    this.playgroundUrlInput = page.locator('input[placeholder*="https://"]');
    this.playgroundSendButton = page.locator('button:has-text("Send")');
  }

  async goto() {
    await this.page.goto('/api');
    await this.page.waitForLoadState('networkidle');
  }
}
