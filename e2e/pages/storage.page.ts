import { Page, Locator } from '@playwright/test';

export class StoragePage {
  readonly createBucketButton: Locator;
  readonly bucketList: Locator;

  constructor(readonly page: Page) {
    this.createBucketButton = page.locator('button:has-text("Create Bucket")');
    this.bucketList = page.locator('a[href*="/storage/buckets/"]');
  }

  async goto() {
    await this.page.goto('/storage');
    await this.page.waitForLoadState('networkidle');
  }

  async clickFirstBucket() {
    const count = await this.bucketList.count();
    if (count > 0) {
      await this.bucketList.first().click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}
