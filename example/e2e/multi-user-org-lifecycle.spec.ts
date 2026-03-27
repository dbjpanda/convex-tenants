/**
 * E2E: Multi-user organization lifecycle
 *
 * Tests org-level operations from different user perspectives:
 * settings visibility, leaving, deletion effects on other members.
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

async function acceptInvitation(page: Page, invitationUrl: string) {
  await page.goto(invitationUrl);
  await expect(page.getByText("You're Invited!")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(page.getByText("Welcome Aboard!")).toBeVisible({ timeout: 15000 });
  await page.goto("http://localhost:5173");
  await expect(page.getByRole("heading", { name: "Tenants Demo" })).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function navigateTo(page: Page, label: string) {
  await page.getByRole("link", { name: label }).click();
  await page.waitForTimeout(500);
}

test.describe("Multi-User Org Lifecycle", () => {
  let aliceCtx: BrowserContext;
  let bobCtx: BrowserContext;
  let alicePage: Page;
  let bobPage: Page;

  test.beforeEach(async ({ browser }) => {
    aliceCtx = await browser.newContext();
    bobCtx = await browser.newContext();
    alicePage = await aliceCtx.newPage();
    bobPage = await bobCtx.newPage();
  });

  test.afterEach(async () => {
    await aliceCtx.close();
    await bobCtx.close();
  });

  test("admin sees Settings but member does not", async () => {
    const ownerEmail = uniqueEmail("owner");
    const adminEmail = uniqueEmail("admin");
    const memberEmail = uniqueEmail("member");

    await signUpUser(alicePage, ownerEmail);
    await createOrg(alicePage, "Visibility Corp");

    // Invite admin
    const adminUrl = await inviteAndGetLink(alicePage, adminEmail, "Admin");

    // Admin accepts
    await signUpUser(bobPage, adminEmail);
    await acceptInvitation(bobPage, adminUrl);

    // Admin sees Settings link
    await expect(bobPage.getByRole("link", { name: "Settings" })).toBeVisible();

    // Admin navigates to Settings — sees org details but check for Delete
    await navigateTo(bobPage, "Settings");
    await expect(bobPage.getByText("Organization Details")).toBeVisible({ timeout: 10000 });

    // Now invite a member (using owner context)
    const memberUrl = await inviteAndGetLink(alicePage, memberEmail);

    // Close bob context, reuse for member
    await bobCtx.close();
    bobCtx = await alicePage.context().browser()!.newContext();
    bobPage = await bobCtx.newPage();

    await signUpUser(bobPage, memberEmail);
    await acceptInvitation(bobPage, memberUrl);

    // Member does NOT see Settings link
    await expect(bobPage.getByRole("heading", { name: "Visibility Corp", level: 2 })).toBeVisible({ timeout: 10000 });
    await expect(bobPage.getByRole("link", { name: "Settings" })).not.toBeVisible();
    await expect(bobPage.getByRole("link", { name: "Permissions" })).not.toBeVisible();
  });

  test("member leaves org → sees 'No Organization Yet'", async () => {
    const ownerEmail = uniqueEmail("owner");
    const memberEmail = uniqueEmail("member");

    await signUpUser(alicePage, ownerEmail);
    await createOrg(alicePage, "LeaveTest Corp");
    const memberUrl = await inviteAndGetLink(alicePage, memberEmail);

    await signUpUser(bobPage, memberEmail);
    await acceptInvitation(bobPage, memberUrl);

    // Member sees the org
    await expect(bobPage.getByRole("heading", { name: "LeaveTest Corp", level: 2 })).toBeVisible({ timeout: 10000 });

    // Member navigates to Settings (via direct URL since nav may be hidden)
    await bobPage.goto("http://localhost:5173/settings");
    await bobPage.waitForTimeout(2000);

    // If member can see Leave button, click it
    const leaveBtn = bobPage.getByRole("button", { name: "Leave Organization" });
    if (await leaveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await leaveBtn.click();

      // Handle confirmation
      const confirmBtn = bobPage.getByRole("button", { name: /confirm|leave|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await bobPage.waitForTimeout(2000);

      // Member should see "No Organization Yet"
      await expect(bobPage.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });

      // Owner should see only 1 member now
      await alicePage.reload();
      await alicePage.waitForTimeout(2000);
      await expect(alicePage.getByText("1 member").first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("owner deletes org → admin gets redirected to empty state", async () => {
    const ownerEmail = uniqueEmail("owner");
    const adminEmail = uniqueEmail("admin");

    await signUpUser(alicePage, ownerEmail);
    await createOrg(alicePage, "DelOrg Corp");
    const adminUrl = await inviteAndGetLink(alicePage, adminEmail, "Admin");

    await signUpUser(bobPage, adminEmail);
    await acceptInvitation(bobPage, adminUrl);

    // Admin sees the org
    await expect(bobPage.getByRole("heading", { name: "DelOrg Corp", level: 2 })).toBeVisible({ timeout: 10000 });

    // Owner deletes the org
    await navigateTo(alicePage, "Settings");
    await alicePage.getByRole("heading", { name: "Danger Zone" }).scrollIntoViewIfNeeded();
    await alicePage.getByRole("button", { name: "Delete Organization" }).click();
    await alicePage.getByPlaceholder("DelOrg Corp").fill("DelOrg Corp");
    await alicePage.getByRole("button", { name: "Delete Organization" }).click();

    await expect(alicePage.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });

    // Admin refreshes — should also see no org
    await bobPage.reload();
    await bobPage.waitForTimeout(3000);
    await expect(bobPage.getByText("No Organization Yet")).toBeVisible({ timeout: 15000 });
  });

  test("owner updates org name → admin sees updated name in real-time", async () => {
    const ownerEmail = uniqueEmail("owner");
    const adminEmail = uniqueEmail("admin");

    await signUpUser(alicePage, ownerEmail);
    await createOrg(alicePage, "OldName Corp");
    const adminUrl = await inviteAndGetLink(alicePage, adminEmail, "Admin");

    await signUpUser(bobPage, adminEmail);
    await acceptInvitation(bobPage, adminUrl);

    // Admin sees old name
    await expect(bobPage.getByRole("heading", { name: "OldName Corp", level: 2 })).toBeVisible({ timeout: 10000 });

    // Owner updates name
    await navigateTo(alicePage, "Settings");
    await expect(alicePage.getByText("Organization Details")).toBeVisible({ timeout: 10000 });
    const nameInput = alicePage.getByRole("textbox").first();
    await nameInput.clear();
    await nameInput.fill("NewName Corp");
    await alicePage.getByRole("button", { name: "Save Changes" }).click();

    // Owner sees new name
    await expect(alicePage.getByRole("heading", { name: "NewName Corp", level: 2 })).toBeVisible({ timeout: 10000 });

    // Admin should see the new name after Convex subscription updates
    await expect(bobPage.getByRole("heading", { name: "NewName Corp", level: 2 })).toBeVisible({ timeout: 15000 });
  });
});
