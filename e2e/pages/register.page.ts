import { Page, Locator } from '@playwright/test';

export class RegisterPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly termsCheckbox: Locator;

  constructor(readonly page: Page) {
    this.nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]');
    this.submitButton = page.locator('button[type="submit"]').first();
    this.termsCheckbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
  }

  async goto() {
    await this.page.goto('/auth/register');
    await this.page.waitForLoadState('networkidle');
  }

  async register(name: string, email: string, password: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    try { await this.termsCheckbox.check({ timeout: 3000 }); } catch {}
    await this.submitButton.click();
  }
}
