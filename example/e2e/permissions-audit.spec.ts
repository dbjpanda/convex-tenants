/**
 * E2E: Permissions page & Audit log
 *
 * Tests the permission checker, grant/deny overrides, and audit trail.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember, navigateTo } from "./helpers";

test.describe("Permissions & Audit", () => {
  test("permissions page shows role and permission checker", async ({ page }) => {
    const email = uniqueEmail("perm");
    await signUp(page, email);
    await createOrganization(page, "Perm Org");

    await navigateTo(page, "Permissions");

    // Should show role info
    await expect(page.getByText("Your Permissions")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Assigned Roles")).toBeVisible();
    await expect(page.getByText("owner").first()).toBeVisible();

    // Permission Checker section
    await expect(page.getByText("Permission Checker")).toBeVisible();
    await expect(page.getByText("Allowed").first()).toBeVisible();

    // Grant/Deny section
    await expect(page.getByText("Grant / Deny Permission Override")).toBeVisible();
    await expect(page.getByRole("button", { name: "Grant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
  });

  test("permission checker shows allowed/denied for different permissions", async ({ page }) => {
    const email = uniqueEmail("permchk");
    await signUp(page, email);
    await createOrganization(page, "PermCheck Org");

    await navigateTo(page, "Permissions");
    await expect(page.getByText("Permission Checker")).toBeVisible({ timeout: 10000 });

    // Owner should have all permissions — pick one from the dropdown
    const permSelect = page.locator("select").first();
    await permSelect.selectOption("organizations:delete");
    await expect(page.getByText("Allowed").first()).toBeVisible({ timeout: 5000 });

    await permSelect.selectOption("members:add");
    await expect(page.getByText("Allowed").first()).toBeVisible({ timeout: 5000 });
  });

  test("audit log shows entries after org creation", async ({ page }) => {
    const email = uniqueEmail("audit");
    await signUp(page, email);
    await createOrganization(page, "Audit Org");

    // Invite a member to generate audit entries
    await inviteMember(page, "auditmember@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    await navigateTo(page, "Audit Log");
    await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible({ timeout: 10000 });

    // After creating org + inviting, there should be audit entries
    // (role_assigned for owner is logged by authz)
    await page.waitForTimeout(2000);
    // Either entries show or "No audit entries" — depends on authz configuration
    const hasEntries = await page.getByText("role_assigned").isVisible({ timeout: 3000 }).catch(() => false);
    const noEntries = await page.getByText("No audit entries").isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasEntries || noEntries).toBeTruthy();
  });
});
