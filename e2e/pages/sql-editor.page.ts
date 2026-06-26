import { Page, Locator } from '@playwright/test';

export class SqlEditorPage {
  readonly editorTextarea: Locator;
  readonly runButton: Locator;
  readonly formatButton: Locator;
  readonly resultsTable: Locator;
  readonly statusIndicator: Locator;

  constructor(readonly page: Page) {
    this.editorTextarea = page.locator('textarea[placeholder*="SQL"]');
    this.runButton = page.locator('button:has-text("Run")');
    this.formatButton = page.locator('button:has-text("Format")');
    this.resultsTable = page.locator('table, [class*="result"] table');
    this.statusIndicator = page.locator('text=Success, text=Running');
  }

  async goto() {
    await this.page.goto('/database/sql');
    await this.page.waitForLoadState('networkidle');
  }

  async executeQuery(sql: string) {
    await this.editorTextarea.fill(sql);
    await this.runButton.click();
    await this.page.waitForTimeout(3000);
  }

  async getResultText(): Promise<string> {
    return (await this.page.locator('text=Success').textContent({ timeout: 10000 }).catch(() => '')) || '';
  }
}
