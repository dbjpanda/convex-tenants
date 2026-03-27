/**
 * E2E: Organization settings
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, navigateTo } from "./helpers";

test.describe("Settings", () => {
  test("settings page shows all sections for owner", async ({ page }) => {
    const email = uniqueEmail("set");
    await signUp(page, email);
    await createOrganization(page, "Settings Org");

    await navigateTo(page, "Settings");

    await expect(page.getByText("Organization Details")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();

    // Scroll down to see below-the-fold sections
    await page.getByRole("heading", { name: "Danger Zone" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "Leave Organization" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Danger Zone" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Organization" })).toBeVisible();
  });
});
