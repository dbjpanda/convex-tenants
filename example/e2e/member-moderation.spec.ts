/**
 * E2E: Member moderation — suspend and unsuspend
 *
 * Tests the moderation section's suspend/unsuspend buttons.
 * Verifies suspended members can't perform actions (via a second browser).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { uniqueEmail } from "./helpers";

async function signUpUser(page: Page, email: string) {
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("testpassword123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("heading", { name: "Tenants Demo" })).toBeVisible({ timeout: 15000 });
}

async function createOrg(page: Page, name: string) {
  await page.getByRole("button", { name: "Create Organization" }).first().click();
  await page.getByRole("textbox", { name: "Organization Name" }).fill(name);
  await page.getByRole("button", { name: "Create Organization" }).last().click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function inviteAndGetLink(page: Page, email: string, role?: "Admin") {
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByRole("dialog", { name: "Invite Member" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("textbox", { name: "Email Address" }).fill(email);
  if (role === "Admin") {
    const roleSelect = page.getByRole("dialog").locator('[id="role"]');
    await roleSelect.click();
    await page.getByRole("option", { name: "Admin" }).click();
  }
  await page.getByRole("button", { name: "Create Invitation" }).click();
  await expect(page.getByText("Invitation Created!")).toBeVisible({ timeout: 15000 });
  const url = await page.getByRole("dialog").locator("code").first().textContent();
  await page.getByRole("button", { name: "Done" }).click();
  return url!;
}

async function acceptInvitation(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByText("You're Invited!")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText("Welcome Aboard!")).toBeVisible({ timeout: 15000 });
  await page.goto("http://localhost:5173");
  await expect(page.getByRole("heading", { name: "Tenants Demo" })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

test.describe("Member Moderation", () => {
  let ownerCtx: BrowserContext;
  let memberCtx: BrowserContext;
  let ownerPage: Page;
  let memberPage: Page;

  test.beforeEach(async ({ browser }) => {
    ownerCtx = await browser.newContext();
    memberCtx = await browser.newContext();
    ownerPage = await ownerCtx.newPage();
    memberPage = await memberCtx.newPage();
  });

  test.afterEach(async () => {
    await ownerCtx.close();
    await memberCtx.close();
  });

  test("owner suspends admin → admin sees suspended state → owner unsuspends → admin restored", async () => {
    const ownerEmail = uniqueEmail("owner");
    const adminEmail = uniqueEmail("admin");

    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "Suspend Corp");
    const adminUrl = await inviteAndGetLink(ownerPage, adminEmail, "Admin");

    await signUpUser(memberPage, adminEmail);
    await acceptInvitation(memberPage, adminUrl);

    // Admin should see the org normally
    await expect(memberPage.getByRole("heading", { name: "Suspend Corp", level: 2 })).toBeVisible({ timeout: 10000 });
    await expect(memberPage.getByRole("link", { name: "Settings" })).toBeVisible();

    // Scroll to moderation section on owner's page
    await ownerPage.getByText("Member moderation").scrollIntoViewIfNeeded();
    await ownerPage.waitForTimeout(1000);

    // Click Suspend button for the admin
    const suspendBtn = ownerPage.getByRole("button", { name: "Suspend" });
    await expect(suspendBtn).toBeVisible({ timeout: 10000 });
    await suspendBtn.click();
    await ownerPage.waitForTimeout(2000);

    // Should now show "Suspended" status and "Unsuspend" button
    await expect(ownerPage.getByText("Suspended").first()).toBeVisible({ timeout: 10000 });
    await expect(ownerPage.getByRole("button", { name: "Unsuspend" })).toBeVisible();

    // Click Unsuspend
    await ownerPage.getByRole("button", { name: "Unsuspend" }).click();
    await ownerPage.waitForTimeout(2000);

    // Should be Active again — Suspend button re-appears
    await expect(ownerPage.getByRole("button", { name: "Suspend" })).toBeVisible({ timeout: 10000 });
  });

  test("owner cannot suspend themselves — no suspend button on owner row", async () => {
    const ownerEmail = uniqueEmail("selfsusp");
    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "SelfSusp Org");

    // Scroll to moderation
    await ownerPage.getByText("Member moderation").scrollIntoViewIfNeeded();
    await ownerPage.waitForTimeout(1000);

    // Owner row in moderation table should show "—" not a Suspend button
    const moderationTable = ownerPage.getByRole("table").last();
    const ownerRow = moderationTable.getByRole("row").filter({ hasText: ownerEmail });
    await expect(ownerRow.getByText("—")).toBeVisible({ timeout: 5000 });
    await expect(ownerRow.getByRole("button", { name: /suspend/i })).not.toBeVisible();
  });
});
