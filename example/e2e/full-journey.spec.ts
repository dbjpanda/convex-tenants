/**
 * E2E: Complete user journey — the most important test.
 *
 * Sign up → Create org → Invite member → Create team → Navigate all pages → Delete org
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember, navigateTo } from "./helpers";

test.describe("Full User Journey", () => {
  test("complete SaaS onboarding flow", async ({ page }) => {
    const ownerEmail = uniqueEmail("journey");

    // Step 1: Sign up
    await signUp(page, ownerEmail);
    await expect(page.getByText("No Organization Yet")).toBeVisible();

    // Step 2: Create org
    await createOrganization(page, "Journey Corp");
    await expect(page.getByRole("heading", { name: "Journey Corp", level: 2 })).toBeVisible();

    // Step 3: Verify owner in members table
    const table = page.getByRole("table").first();
    await expect(table.getByText(ownerEmail).first()).toBeVisible({ timeout: 10000 });
    await expect(table.getByText("owner")).toBeVisible();

    // Step 4: Invite a member
    await inviteMember(page, "colleague@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("colleague@e2e.test").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Pending").first()).toBeVisible();

    // Step 5: Teams page — create a team
    await navigateTo(page, "Teams");
    await expect(page.getByText("No teams yet")).toBeVisible({ timeout: 10000 });

    // Create team via nested section form (use last button to avoid ambiguity)
    await page.getByPlaceholder("Team name").fill("Backend");
    await page.locator("button", { hasText: "Create team" }).last().click();
    await page.waitForTimeout(2000);
    await expect(page.getByText("Backend").first()).toBeVisible({ timeout: 10000 });

    // Step 6: Settings page
    await navigateTo(page, "Settings");
    await expect(page.getByText("Organization Details")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Danger Zone")).toBeVisible();

    // Step 7: Audit Log page
    await navigateTo(page, "Audit Log");
    await page.waitForTimeout(1000);

    // Step 8: Permissions page
    await navigateTo(page, "Permissions");
    await page.waitForTimeout(1000);

    // Step 9: Back to Members
    await navigateTo(page, "Members");
    await expect(page.getByRole("table").first().getByText(ownerEmail).first()).toBeVisible({ timeout: 10000 });

    // Step 10: Delete org
    await navigateTo(page, "Settings");
    await page.getByRole("heading", { name: "Danger Zone" }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Delete Organization" }).click();
    // Type org name to confirm
    await page.getByPlaceholder("Journey Corp").fill("Journey Corp");
    await page.getByRole("button", { name: "Delete Organization" }).click();
    await expect(page.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });
  });
});
