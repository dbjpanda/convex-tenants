/**
 * E2E: Multi-org journey — complete flow with multiple orgs
 *
 * Creates 2 orgs, sets up teams in each, invites members,
 * switches between them verifying data isolation.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember, navigateTo } from "./helpers";

test.describe("Multi-Org Journey", () => {
  test("two orgs with different teams — data stays isolated", async ({ page }) => {
    const email = uniqueEmail("multi");
    await signUp(page, email);

    // === Create Org A ===
    await createOrganization(page, "Org Alpha");
    await expect(page.getByRole("heading", { name: "Org Alpha", level: 2 })).toBeVisible();

    // Create a team in Org A
    await navigateTo(page, "Teams");
    await page.getByPlaceholder("Team name").fill("Alpha Team");
    await page.locator("button", { hasText: "Create team" }).last().click();
    await expect(page.getByText("Alpha Team").first()).toBeVisible({ timeout: 10000 });

    // Invite someone to Org A
    await navigateTo(page, "Members");
    await inviteMember(page, "alice-friend@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    // === Create Org B via switcher ===
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "Create Organization" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole("textbox").first().fill("Org Beta");
    await page.waitForTimeout(500);
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(page.getByRole("heading", { name: "Org Beta", level: 2 })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Verify Org B has no teams
    await navigateTo(page, "Teams");
    await expect(page.getByText("No teams yet")).toBeVisible({ timeout: 10000 });

    // Verify Org B has only 1 member (owner), no pending invitations
    await navigateTo(page, "Members");
    await expect(page.getByText("1 member, 0 pending").first()).toBeVisible({ timeout: 10000 });
    // alice-friend should NOT be visible in Org B
    await expect(page.getByText("alice-friend@e2e.test")).not.toBeVisible();

    // Create a team in Org B
    await navigateTo(page, "Teams");
    await page.getByPlaceholder("Team name").fill("Beta Team");
    await page.locator("button", { hasText: "Create team" }).last().click();
    await expect(page.getByText("Beta Team").first()).toBeVisible({ timeout: 10000 });

    // === Switch back to Org A ===
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "Org Alpha" }).click();
    await expect(page.getByRole("heading", { name: "Org Alpha", level: 2 })).toBeVisible({ timeout: 10000 });

    // Verify Org A teams — should have "Alpha Team", NOT "Beta Team"
    await navigateTo(page, "Teams");
    await expect(page.getByText("Alpha Team").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Beta Team")).not.toBeVisible();

    // Verify Org A members — should still have pending invitation
    await navigateTo(page, "Members");
    await expect(page.getByText("alice-friend@e2e.test").first()).toBeVisible({ timeout: 10000 });
  });

  test("settings are per-org — changing one doesn't affect other", async ({ page }) => {
    const email = uniqueEmail("setiso");
    await signUp(page, email);

    // Create two orgs
    await createOrganization(page, "Org One");
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "Create Organization" }).click();
    const dlg = page.getByRole("dialog");
    await expect(dlg).toBeVisible({ timeout: 5000 });
    await dlg.getByRole("textbox").first().fill("Org Two");
    await page.waitForTimeout(500);
    await dlg.getByRole("button", { name: "Create Organization" }).click();
    await expect(page.getByRole("heading", { name: "Org Two", level: 2 })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // Update Org Two's name via settings
    await navigateTo(page, "Settings");
    await expect(page.getByText("Organization Details")).toBeVisible({ timeout: 10000 });
    const nameInput = page.getByRole("textbox").first();
    await nameInput.clear();
    await nameInput.fill("Org Two Updated");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("heading", { name: "Org Two Updated", level: 2 })).toBeVisible({ timeout: 10000 });

    // Switch to Org One
    await page.getByRole("combobox", { name: "Select organization" }).click();
    await page.getByRole("button", { name: "Org One" }).click();
    await expect(page.getByRole("heading", { name: "Org One", level: 2 })).toBeVisible({ timeout: 10000 });

    // Org One name should be unchanged
    await navigateTo(page, "Settings");
    await expect(page.getByRole("textbox").first()).toHaveValue("Org One");
  });
});
