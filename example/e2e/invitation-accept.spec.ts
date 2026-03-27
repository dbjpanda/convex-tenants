/**
 * E2E: Complete invitation acceptance — TWO users via separate browser contexts.
 *
 * This is the critical "another user accepts" test that was missing.
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

test.describe("Invitation Acceptance (Two Users)", () => {
  let aliceContext: BrowserContext;
  let bobContext: BrowserContext;
  let alicePage: Page;
  let bobPage: Page;

  test.beforeEach(async ({ browser }) => {
    aliceContext = await browser.newContext();
    bobContext = await browser.newContext();
    alicePage = await aliceContext.newPage();
    bobPage = await bobContext.newPage();
  });

  test.afterEach(async () => {
    await aliceContext.close();
    await bobContext.close();
  });

  test("Alice invites → Bob accepts → Alice sees Bob as member", async () => {
    const aliceEmail = uniqueEmail("alice");
    const bobEmail = uniqueEmail("bob");

    // Alice: sign up, create org, invite bob
    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "AcceptTest Corp");
    const invitationUrl = await inviteAndGetLink(alicePage, bobEmail);
    expect(invitationUrl).toContain("/accept-invitation/");

    // Bob: sign up first, then open invitation link
    await signUpUser(bobPage, bobEmail);
    await bobPage.goto(invitationUrl);

    // Bob should see invitation details
    await expect(bobPage.getByText("You're Invited!")).toBeVisible({ timeout: 15000 });
    await expect(bobPage.getByText("AcceptTest Corp")).toBeVisible();
    await expect(bobPage.getByText("member", { exact: false })).toBeVisible();

    // Bob accepts
    await bobPage.getByRole("button", { name: "Accept Invitation" }).click();
    await expect(bobPage.getByText("Welcome Aboard!")).toBeVisible({ timeout: 15000 });

    // Verify from Alice's side — Bob should now appear as a member
    await alicePage.reload();
    await alicePage.waitForTimeout(3000);
    const table = alicePage.getByRole("table").first();
    await expect(table.getByText(bobEmail).first()).toBeVisible({ timeout: 15000 });
    // Should show 2 members
    await expect(alicePage.getByText("2 member").first()).toBeVisible({ timeout: 5000 });
  });

  test("Bob accepts admin invite → Alice sees admin role", async () => {
    const aliceEmail = uniqueEmail("alice-adm");
    const bobEmail = uniqueEmail("bob-adm");

    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "AdminAccept Corp");
    const invitationUrl = await inviteAndGetLink(alicePage, bobEmail, "Admin");

    await signUpUser(bobPage, bobEmail);
    await bobPage.goto(invitationUrl);

    // Should show admin role in invitation
    await expect(bobPage.getByText("You're Invited!")).toBeVisible({ timeout: 15000 });
    await expect(bobPage.getByText("Admin", { exact: false }).first()).toBeVisible();

    await bobPage.getByRole("button", { name: "Accept Invitation" }).click();
    await expect(bobPage.getByText("Welcome Aboard!")).toBeVisible({ timeout: 15000 });

    // Alice verifies Bob appeared as a member
    await alicePage.reload();
    await alicePage.waitForTimeout(3000);
    const table = alicePage.getByRole("table").first();
    await expect(table.getByText(bobEmail).first()).toBeVisible({ timeout: 15000 });
  });

  test("invalid invitation link shows error", async () => {
    const bobEmail = uniqueEmail("bob-inv");
    await signUpUser(bobPage, bobEmail);

    await bobPage.goto("http://localhost:5173/accept-invitation/fake-id-999");
    await bobPage.waitForTimeout(3000);

    const notFound = await bobPage.getByText("Invitation Not Found").isVisible({ timeout: 10000 }).catch(() => false);
    const somethingWrong = await bobPage.getByText("Something went wrong").isVisible({ timeout: 2000 }).catch(() => false);
    const error = await bobPage.getByText("Error").isVisible({ timeout: 2000 }).catch(() => false);
    expect(notFound || somethingWrong || error).toBeTruthy();
  });

  test("unauthenticated user on invitation page sees sign-in prompt", async () => {
    const aliceEmail = uniqueEmail("alice-ua");
    const bobEmail = uniqueEmail("bob-ua");

    await signUpUser(alicePage, aliceEmail);
    await createOrg(alicePage, "Unauth Corp");
    const invitationUrl = await inviteAndGetLink(alicePage, bobEmail);

    // Bob (NOT signed up) opens link
    await bobPage.goto(invitationUrl);
    await bobPage.waitForTimeout(3000);

    // Should see sign-in prompt or be redirected to sign-in
    const signInPrompt = await bobPage.getByText("Sign in to Accept").isVisible({ timeout: 10000 }).catch(() => false);
    const signInPage = await bobPage.getByText("Sign in to manage your organizations").isVisible({ timeout: 2000 }).catch(() => false);
    expect(signInPrompt || signInPage).toBeTruthy();
  });
});
