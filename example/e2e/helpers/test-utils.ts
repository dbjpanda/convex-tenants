import { Page } from '@playwright/test';

/**
 * Wait for navigation and network to be idle
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/**
 * Fill a form field by label text
 */
export async function fillByLabel(page: Page, label: string, value: string) {
  const input = page.locator(`input[name="${label}"], textarea[name="${label}"]`);
  await input.fill(value);
}

/**
 * Click a button by text content
 */
export async function clickButton(page: Page, text: string) {
  await page.click(`button:has-text("${text}")`);
}

/**
 * Wait for a toast/notification message
 */
export async function waitForToast(page: Page, message?: string) {
  if (message) {
    await page.waitForSelector(`text=${message}`, { timeout: 5000 });
  } else {
    await page.waitForTimeout(1000);
  }
}

/**
 * Extract invitation ID from URL or page content
 */
export async function extractInvitationId(page: Page): Promise<string | null> {
  // Try to find invitation link in the page
  const link = await page.locator('a[href*="/accept-invitation/"]').first();
  
  if (await link.count() > 0) {
    const href = await link.getAttribute('href');
    if (href) {
      const match = href.match(/\/accept-invitation\/([^/?]+)/);
      return match ? match[1] : null;
    }
  }
  
  // Try to find in page content
  const content = await page.content();
  const match = content.match(/\/accept-invitation\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
