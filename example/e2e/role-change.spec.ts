/**
 * E2E: Role change via combobox in member table
 *
 * Tests changing a member's role using the inline role dropdown,
 * verified from both the owner's and the affected member's perspective.
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

test.describe("Role Change", () => {
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

  test("owner promotes member to admin → member gains admin nav", async () => {
    const ownerEmail = uniqueEmail("owner");
    const memberEmail = uniqueEmail("member");

    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "Promote Corp");
    const memberUrl = await inviteAndGetLink(ownerPage, memberEmail);

    await signUpUser(memberPage, memberEmail);
    await acceptInvitation(memberPage, memberUrl);

    // Member should NOT see Settings (member role)
    await expect(memberPage.getByRole("link", { name: "Settings" })).not.toBeVisible();

    // Owner sees member row with "member" role — find the role combobox for the member
    const table = ownerPage.getByRole("table").first();
    await expect(table.getByText(memberEmail).first()).toBeVisible({ timeout: 10000 });

    // The member row's role combobox — find it by looking for the row containing the member email
    const memberRow = table.getByRole("row").filter({ hasText: memberEmail });
    const roleCombobox = memberRow.getByRole("combobox");

    // Change role to admin — this is a Radix Select trigger
    await roleCombobox.click();
    await ownerPage.waitForTimeout(500);

    // Select "admin" option from the dropdown
    const adminOption = ownerPage.getByRole("option", { name: /admin/i });
    if (await adminOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminOption.click();
    } else {
      // Might be a native select
      await roleCombobox.selectOption("admin");
    }
    await ownerPage.waitForTimeout(2000);

    // Member should now see admin nav items (Convex subscription auto-updates)
    await expect(memberPage.getByRole("link", { name: "Settings" })).toBeVisible({ timeout: 15000 });
    await expect(memberPage.getByRole("link", { name: "Permissions" })).toBeVisible();
  });

  test("owner demotes admin to member → admin loses admin nav", async () => {
    const ownerEmail = uniqueEmail("owner");
    const adminEmail = uniqueEmail("admin");

    await signUpUser(ownerPage, ownerEmail);
    await createOrg(ownerPage, "Demote Corp");
    const adminUrl = await inviteAndGetLink(ownerPage, adminEmail, "Admin");

    await signUpUser(memberPage, adminEmail);
    await acceptInvitation(memberPage, adminUrl);

    // Admin should see Settings
    await expect(memberPage.getByRole("link", { name: "Settings" })).toBeVisible({ timeout: 10000 });

    // Owner demotes admin to member
    const table = ownerPage.getByRole("table").first();
    await expect(table.getByText(adminEmail).first()).toBeVisible({ timeout: 10000 });

    const adminRow = table.getByRole("row").filter({ hasText: adminEmail });
    const roleCombobox = adminRow.getByRole("combobox");

    await roleCombobox.click();
    await ownerPage.waitForTimeout(500);

    const memberOption = ownerPage.getByRole("option", { name: /member/i });
    if (await memberOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await memberOption.click();
    } else {
      await roleCombobox.selectOption("member");
    }
    await ownerPage.waitForTimeout(2000);

    // Admin should lose Settings nav (real-time via Convex subscription)
    await expect(memberPage.getByRole("link", { name: "Settings" })).not.toBeVisible({ timeout: 15000 });
    await expect(memberPage.getByRole("link", { name: "Permissions" })).not.toBeVisible();
  });
});
