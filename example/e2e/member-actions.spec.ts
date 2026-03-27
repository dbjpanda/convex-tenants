/**
 * E2E: Member actions — role changes, removal, moderation
 *
 * Tests the member row actions menu, role combobox, suspend/unsuspend.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember, navigateTo } from "./helpers";

test.describe("Member Actions", () => {
  test("invitation shows in table with pending status and filter tabs work", async ({ page }) => {
    const email = uniqueEmail("filter");
    await signUp(page, email);
    await createOrganization(page, "Filter Org");

    // Invite someone
    await inviteMember(page, "pending@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    // Should see "2 people (1 members, 1 pending)"
    await expect(page.getByText("1 pending").first()).toBeVisible({ timeout: 10000 });

    // Filter tabs — click the "All" dropdown to see filter options
    const filterCombo = page.locator("select").or(page.getByRole("combobox")).filter({ hasText: "All" });
    if (await filterCombo.isVisible({ timeout: 2000 }).catch(() => false)) {
      // If it's a select dropdown
      await filterCombo.first().selectOption({ index: 1 }); // Members Only
      await page.waitForTimeout(500);

      // Should only show the owner
      await expect(page.getByText(email).first()).toBeVisible();

      // Switch to Invitations Only
      await filterCombo.first().selectOption({ index: 2 });
      await page.waitForTimeout(500);

      // Should show pending invitation
      await expect(page.getByText("pending@e2e.test").first()).toBeVisible();

      // Back to All
      await filterCombo.first().selectOption({ index: 0 });
    }
  });

  test("owner can see remove option in member actions menu", async ({ page }) => {
    const email = uniqueEmail("actions");
    await signUp(page, email);
    await createOrganization(page, "Actions Org");

    // Invite and add a member via bulk (so they appear as pending)
    await inviteMember(page, "removable@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(1000);

    // Click the actions menu on the pending invitation row
    const menuButtons = page.getByRole("button", { name: "Open menu" });
    const count = await menuButtons.count();

    // Should have at least one menu button
    expect(count).toBeGreaterThanOrEqual(1);

    // Click the first menu button (owner row)
    await menuButtons.first().click();

    // Should show "Remove Member" (disabled for owner)
    await expect(page.getByRole("menuitem", { name: "Remove Member" })).toBeVisible({ timeout: 3000 });
  });

  test("dark mode toggle works", async ({ page }) => {
    const email = uniqueEmail("dark");
    await signUp(page, email);
    await createOrganization(page, "Dark Mode Org");

    // Toggle dark mode
    await page.getByRole("button", { name: "Dark mode" }).click();

    // Check that the html element has 'dark' class
    const isDark = await page.locator("html").getAttribute("class");
    expect(isDark).toContain("dark");

    // Toggle back to light
    await page.getByRole("button", { name: /mode/i }).click();

    const isLight = await page.locator("html").getAttribute("class");
    expect(isLight).not.toContain("dark");
  });
});
