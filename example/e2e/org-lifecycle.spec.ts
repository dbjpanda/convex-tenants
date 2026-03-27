/**
 * E2E: Organization lifecycle
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, navigateTo } from "./helpers";

test.describe("Organization Lifecycle", () => {
  test("create org → see members page with owner listed", async ({ page }) => {
    const email = uniqueEmail("org");
    await signUp(page, email);
    await createOrganization(page, "Acme Corp");

    // Org heading visible
    await expect(page.getByRole("heading", { name: "Acme Corp", level: 2 })).toBeVisible();

    // Members page loads with owner listed
    await expect(page.getByText("Members & Invitations")).toBeVisible();
    const table = page.getByRole("table").first();
    await expect(table.getByText(email).first()).toBeVisible({ timeout: 10000 });

    // Role shows "owner" in the table
    await expect(table.getByText("owner")).toBeVisible();

    // Admin nav items visible
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Permissions" })).toBeVisible();
  });

  test("update org name via settings", async ({ page }) => {
    const email = uniqueEmail("orgup");
    await signUp(page, email);
    await createOrganization(page, "OldName Inc");

    await navigateTo(page, "Settings");
    await expect(page.getByText("Organization Details")).toBeVisible();

    // Update name
    const nameInput = page.locator('#org-name').or(page.getByRole("textbox").first());
    await nameInput.clear();
    await nameInput.fill("NewName Corp");
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Verify updated name appears
    await expect(page.getByRole("heading", { name: "NewName Corp", level: 2 })).toBeVisible({ timeout: 10000 });
  });

  test("delete organization → returns to empty state", async ({ page }) => {
    const orgName = "DelOrg";
    const email = uniqueEmail("orgdel");
    await signUp(page, email);
    await createOrganization(page, orgName);

    await navigateTo(page, "Settings");
    // Scroll to Danger Zone and click Delete
    await page.getByRole("heading", { name: "Danger Zone" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Delete Organization" }).click();

    // Type org name in the confirmation input
    const confirmInput = page.getByPlaceholder(orgName);
    await confirmInput.fill(orgName);

    // Click the now-enabled Delete button
    await page.getByRole("button", { name: "Delete Organization" }).click();

    await expect(page.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });
  });
});
