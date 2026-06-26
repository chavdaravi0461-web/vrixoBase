import { Page, Locator } from '@playwright/test';

export class DatabasePage {
  readonly createTableButton: Locator;
  readonly tableRows: Locator;
  readonly searchInput: Locator;
  readonly viewToggle: Locator;

  constructor(readonly page: Page) {
    this.createTableButton = page.locator('button:has-text("Create Table")');
    this.tableRows = page.locator('[class*="card"], [class*="table-row"]');
    this.searchInput = page.locator('input[placeholder*="Search"]');
    this.viewToggle = page.locator('button:has-text("List"), button:has-text("Graph")');
  }

  async goto() {
    await this.page.goto('/database');
    await this.page.waitForLoadState('networkidle');
  }

  async getTableCount(): Promise<number> {
    const cards = this.page.locator('[class*="card"]').filter({ has: this.page.locator('text=rows, text=columns') });
    return cards.count();
  }
}
