/**
 * E2E: Organization switcher
 *
 * Tests switching between orgs, searching, creating from switcher.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization } from "./helpers";

test.describe("Organization Switcher", () => {
  test("create second org from switcher → switch between them", async ({ page }) => {
    const email = uniqueEmail("switch");
    await signUp(page, email);
    await createOrganization(page, "First Org");
    await expect(page.getByRole("heading", { name: "First Org", level: 2 })).toBeVisible();

    // Open switcher
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await expect(page.getByText("Create Organization")).toBeVisible({ timeout: 5000 });

    // Create second org from switcher
    await page.getByRole("button", { name: "Create Organization" }).click();
    // Dialog should open — the switcher's dialog uses "Organization Name" label
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole("textbox").first().fill("Second Org");
    // Wait for slug to auto-generate
    await page.waitForTimeout(500);
    await dialog.getByRole("button", { name: "Create Organization" }).click();

    // Second org should load
    await expect(page.getByRole("heading", { name: "Second Org", level: 2 })).toBeVisible({ timeout: 15000 });

    // Switch back to first org via switcher
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "First Org" }).click();

    // First org heading should appear
    await expect(page.getByRole("heading", { name: "First Org", level: 2 })).toBeVisible({ timeout: 10000 });
  });

  test("org switcher search filters organizations", async ({ page }) => {
    const email = uniqueEmail("search");
    await signUp(page, email);
    await createOrganization(page, "Alpha Corp");

    // Create second org
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "Create Organization" }).click();
    const dialog2 = page.getByRole("dialog");
    await expect(dialog2).toBeVisible({ timeout: 5000 });
    await dialog2.getByRole("textbox").first().fill("Beta Inc");
    await page.waitForTimeout(500);
    await dialog2.getByRole("button", { name: "Create Organization" }).click();
    await expect(page.getByRole("heading", { name: "Beta Inc", level: 2 })).toBeVisible({ timeout: 15000 });

    // Open switcher and search
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByPlaceholder("Search organization...").fill("Alpha");

    // Should see Alpha, not Beta
    await expect(page.getByRole("button", { name: "Alpha Corp" })).toBeVisible({ timeout: 5000 });
    // Beta should be filtered out
    await expect(page.getByRole("button", { name: "Beta Inc" })).not.toBeVisible();
  });
});
