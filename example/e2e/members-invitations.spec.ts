/**
 * E2E: Members & Invitations
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember } from "./helpers";

test.describe("Members & Invitations", () => {
  test("invite member → invitation link shown → appears in table", async ({ page }) => {
    const ownerEmail = uniqueEmail("owner");
    await signUp(page, ownerEmail);
    await createOrganization(page, "Invite Test Org");

    const inviteeEmail = "invitee@e2e.test";
    await inviteMember(page, inviteeEmail);

    // Should see success with invitation link
    await expect(page.getByText("Invitation Created!")).toBeVisible();
    await expect(page.getByText(inviteeEmail).first()).toBeVisible();
    await expect(page.getByText("Share this link")).toBeVisible();

    // Close dialog
    await page.getByRole("button", { name: "Done" }).click();

    // Invitation should appear in table as pending
    await expect(page.getByText(inviteeEmail).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Pending").first()).toBeVisible();
  });

  test("invite another resets the dialog", async ({ page }) => {
    const ownerEmail = uniqueEmail("reinv");
    await signUp(page, ownerEmail);
    await createOrganization(page, "Re-Invite Org");

    await inviteMember(page, "first@e2e.test");
    await expect(page.getByText("Invitation Created!")).toBeVisible();

    // Click "Invite Another"
    await page.getByRole("button", { name: "Invite Another" }).click();

    // Dialog should reset
    await expect(page.getByRole("textbox", { name: "Email Address" })).toHaveValue("");
    await expect(page.getByText("Invitation Created!")).not.toBeVisible();
  });

  test("bulk invite multiple emails", async ({ page }) => {
    const ownerEmail = uniqueEmail("bulk");
    await signUp(page, ownerEmail);
    await createOrganization(page, "Bulk Invite Org");

    // Fill bulk invite textarea
    const bulkTextarea = page.getByPlaceholder("alice@example.com, bob@example.com");
    await bulkTextarea.fill("user1@e2e.test, user2@e2e.test, user3@e2e.test");
    await page.getByRole("button", { name: "Bulk invite" }).click();

    // Wait for invitations to appear
    await expect(page.getByText("user1@e2e.test")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("user2@e2e.test")).toBeVisible();
    await expect(page.getByText("user3@e2e.test")).toBeVisible();
  });

  test("members table shows owner with correct info", async ({ page }) => {
    const ownerEmail = uniqueEmail("tbl");
    await signUp(page, ownerEmail);
    await createOrganization(page, "Table Org");

    // Table should be visible with owner data
    const table = page.getByRole("table").first();
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(table.getByText(ownerEmail).first()).toBeVisible({ timeout: 10000 });
    await expect(table.getByText("Active")).toBeVisible();
    await expect(table.getByText("owner")).toBeVisible();
  });
});
