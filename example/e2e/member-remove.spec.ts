/**
 * E2E: Member removal via actions menu
 *
 * Tests removing a member via the row dropdown menu,
 * verified from both users' perspectives.
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

test.describe("Member Removal", () => {
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

  test("owner removes member via actions menu → member loses access", async () => {
    const ownerEmail = uniqueEmail("owner");
    const memberEmail = uniqueEmail("member");

    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "Remove Corp");
    const memberUrl = await inviteAndGetLink(ownerPage, memberEmail);

    await signUpUser(memberPage, memberEmail);
    await acceptInvitation(memberPage, memberUrl);

    // Both see the org
    await expect(memberPage.getByRole("heading", { name: "Remove Corp", level: 2 })).toBeVisible({ timeout: 10000 });

    // Owner sees 2 members
    await expect(ownerPage.getByText("2 members").first()).toBeVisible({ timeout: 10000 });

    // Find the member's Active row (not the Accepted invitation row or the owner row)
    const table = ownerPage.getByRole("table").first();
    // The member has an "Open menu" button — find the row with memberEmail that has the menu
    const memberRows = table.getByRole("row").filter({ hasText: memberEmail });
    // Click the actions menu on the first member row (the Active one has the ··· menu)
    const menuButton = memberRows.first().getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    await ownerPage.waitForTimeout(500);

    // Click Remove Member
    await ownerPage.getByRole("menuitem", { name: "Remove Member" }).click();
    await ownerPage.waitForTimeout(3000);

    // Owner should now see 1 member
    await expect(ownerPage.getByText("1 member,").first()).toBeVisible({ timeout: 10000 });

    // Member refreshes → should see "No Organization Yet"
    await memberPage.reload();
    await memberPage.waitForTimeout(3000);
    await expect(memberPage.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });
  });

  test("owner cannot remove themselves — Remove Member is disabled", async () => {
    const ownerEmail = uniqueEmail("selfrem");
    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "SelfRemove Org");

    // Click the owner's actions menu
    const table = ownerPage.getByRole("table").first();
    const ownerRow = table.getByRole("row").filter({ hasText: ownerEmail });
    await ownerRow.getByRole("button", { name: "Open menu" }).click();
    await ownerPage.waitForTimeout(500);

    // Remove Member should be disabled
    const removeItem = ownerPage.getByRole("menuitem", { name: "Remove Member" });
    await expect(removeItem).toBeVisible();
    await expect(removeItem).toBeDisabled();

    // Close menu
    await ownerPage.keyboard.press("Escape");
  });
});
