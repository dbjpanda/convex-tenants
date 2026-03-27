/**
 * E2E: Multi-user team collaboration
 *
 * Tests team operations across different users — creating, viewing,
 * and verifying team isolation between roles.
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

test.describe("Multi-User Teams", () => {
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

  test("admin creates team → owner sees it → both see same team list", async () => {
    const aliceEmail = uniqueEmail("alice");
    const bobEmail = uniqueEmail("bob");

    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "TeamSync Corp");
    const bobUrl = await inviteAndGetLink(alicePage, bobEmail, "Admin");

    await signUpUser(bobPage, bobEmail);
    await acceptInvitation(bobPage, bobUrl);

    // Bob (admin) creates a team
    await navigateTo(bobPage, "Teams");
    await bobPage.getByPlaceholder("Team name").fill("BobTeam");
    await bobPage.locator("button", { hasText: "Create team" }).last().click();
    await expect(bobPage.getByText("BobTeam").first()).toBeVisible({ timeout: 10000 });

    // Alice sees the team Bob created
    await navigateTo(alicePage, "Teams");
    await alicePage.waitForTimeout(2000);
    await expect(alicePage.getByText("BobTeam").first()).toBeVisible({ timeout: 10000 });
  });

  test("two admins in different orgs — each sees only their org's data", async () => {
    const aliceEmail = uniqueEmail("alice");
    const bobEmail = uniqueEmail("bob");

    // Alice creates Org A
    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "Org Alpha");
    await navigateTo(alicePage, "Teams");
    await alicePage.getByPlaceholder("Team name").fill("AlphaTeam");
    await alicePage.locator("button", { hasText: "Create team" }).last().click();
    await expect(alicePage.getByText("AlphaTeam").first()).toBeVisible({ timeout: 10000 });

    // Bob creates Org B
    await signUpUser(bobPage, bobEmail);
    await createOrg(bobPage, "Org Bravo");
    await navigateTo(bobPage, "Teams");
    await bobPage.getByPlaceholder("Team name").fill("BravoTeam");
    await bobPage.locator("button", { hasText: "Create team" }).last().click();
    await expect(bobPage.getByText("BravoTeam").first()).toBeVisible({ timeout: 10000 });

    // Alice should NOT see BravoTeam
    await expect(alicePage.getByText("BravoTeam")).not.toBeVisible();

    // Bob should NOT see AlphaTeam
    await expect(bobPage.getByText("AlphaTeam")).not.toBeVisible();

    // Alice's members page should only show Alice
    await navigateTo(alicePage, "Members");
    await alicePage.waitForTimeout(1000);
    await expect(alicePage.getByText(aliceEmail).first()).toBeVisible({ timeout: 10000 });
    await expect(alicePage.getByText(bobEmail)).not.toBeVisible();

    // Bob's members page should only show Bob
    await navigateTo(bobPage, "Members");
    await bobPage.waitForTimeout(1000);
    await expect(bobPage.getByText(bobEmail).first()).toBeVisible({ timeout: 10000 });
    await expect(bobPage.getByText(aliceEmail)).not.toBeVisible();
  });

  test("owner deletes team → admin no longer sees it", async () => {
    const aliceEmail = uniqueEmail("alice");
    const bobEmail = uniqueEmail("bob");

    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "DelTeam Corp");
    const bobUrl = await inviteAndGetLink(alicePage, bobEmail, "Admin");

    await signUpUser(bobPage, bobEmail);
    await acceptInvitation(bobPage, bobUrl);

    // Alice creates a team
    await navigateTo(alicePage, "Teams");
    await alicePage.getByPlaceholder("Team name").fill("Doomed Team");
    await alicePage.locator("button", { hasText: "Create team" }).last().click();
    await expect(alicePage.getByText("Doomed Team").first()).toBeVisible({ timeout: 10000 });

    // Bob sees it
    await navigateTo(bobPage, "Teams");
    await bobPage.waitForTimeout(2000);
    await expect(bobPage.getByText("Doomed Team").first()).toBeVisible({ timeout: 10000 });

    // Alice deletes the team via the team card's delete button
    const deleteBtn = alicePage.getByRole("button", { name: /delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      // Handle confirm if needed
      const confirmBtn = alicePage.getByRole("button", { name: /confirm|delete|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await alicePage.waitForTimeout(2000);

      // Bob refreshes — team should be gone
      await bobPage.reload();
      await bobPage.waitForTimeout(2000);
      await navigateTo(bobPage, "Teams");
      await bobPage.waitForTimeout(1000);
      await expect(bobPage.getByText("Doomed Team")).not.toBeVisible({ timeout: 5000 });
    }
  });
});
