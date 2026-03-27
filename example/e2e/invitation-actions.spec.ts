/**
 * E2E: Invitation row actions — resend, copy link, cancel
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, inviteMember } from "./helpers";

test.describe("Invitation Actions", () => {
  test("resend invitation button works", async ({ page }) => {
    const email = uniqueEmail("resend");
    await signUp(page, email);
    await createOrganization(page, "Resend Org");

    await inviteMember(page, "target@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    // Find the pending invitation row
    await expect(page.getByText("target@e2e.test")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Resend invitation" })).toBeVisible();

    // Click resend
    await page.getByRole("button", { name: "Resend invitation" }).click();
    await page.waitForTimeout(2000);

    // Invitation should still be in table as Pending (resend doesn't change status)
    await expect(page.getByText("target@e2e.test")).toBeVisible();
    await expect(page.getByText("Pending").first()).toBeVisible();
  });

  test("copy invitation link button works", async ({ page }) => {
    const email = uniqueEmail("copy");
    await signUp(page, email);
    await createOrganization(page, "Copy Link Org");

    await inviteMember(page, "copytest@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText("copytest@e2e.test")).toBeVisible({ timeout: 10000 });

    // Click copy link button
    await page.getByRole("button", { name: "Copy invitation link" }).click();
    await page.waitForTimeout(500);

    // Can't easily verify clipboard content in E2E, but button should not throw
    // The invitation should still be there
    await expect(page.getByText("copytest@e2e.test")).toBeVisible();
  });

  test("cancel invitation → removes from table", async ({ page }) => {
    const email = uniqueEmail("cancel");
    await signUp(page, email);
    await createOrganization(page, "Cancel Org");

    await inviteMember(page, "cancelme@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText("cancelme@e2e.test")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("1 pending").first()).toBeVisible();

    // Cancel the invitation
    await page.getByRole("button", { name: "Cancel invitation" }).click();
    await page.waitForTimeout(2000);

    // Invitation status should change to "Cancelled"
    await expect(page.getByText("Cancelled").first()).toBeVisible({ timeout: 10000 });
  });

  test("cancel then re-invite same email works", async ({ page }) => {
    const email = uniqueEmail("reinvite");
    await signUp(page, email);
    await createOrganization(page, "ReInvite Org");

    // First invite
    await inviteMember(page, "repeat@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("repeat@e2e.test")).toBeVisible({ timeout: 10000 });

    // Cancel it
    await page.getByRole("button", { name: "Cancel invitation" }).click();
    await page.waitForTimeout(2000);
    await expect(page.getByText("Cancelled").first()).toBeVisible({ timeout: 10000 });

    // Re-invite the same email
    await inviteMember(page, "repeat@e2e.test");
    await page.getByRole("button", { name: "Done" }).click();

    // Should have a new Pending invitation alongside the Cancelled one
    await expect(page.getByText("Pending").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Cancelled").first()).toBeVisible();
  });
});
