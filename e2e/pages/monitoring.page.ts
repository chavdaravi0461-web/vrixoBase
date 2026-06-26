import { Page, Locator } from '@playwright/test';

export class MonitoringPage {
  readonly metricCards: Locator;
  readonly databaseChart: Locator;
  readonly healthSection: Locator;
  readonly errorsSection: Locator;
  readonly timeRangeButtons: Locator;

  constructor(readonly page: Page) {
    this.metricCards = page.locator('[class*="card"]').filter({ has: page.locator('text=Requests, text=Queries, text=Storage, text=Functions') });
    this.databaseChart = page.locator('text=Database Metrics');
    this.healthSection = page.locator('text=Health Status');
    this.errorsSection = page.locator('text=Recent Errors');
    this.timeRangeButtons = page.locator('button:has-text("1h"), button:has-text("24h"), button:has-text("7d")');
  }

  async goto() {
    await this.page.goto('/monitoring');
    await this.page.waitForLoadState('networkidle');
  }
}
