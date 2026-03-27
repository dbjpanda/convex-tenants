/**
 * Shared helpers for E2E tests.
 *
 * Provides reusable page-object-like functions so individual test files
 * stay concise and readable.
 */
import { type Page, expect } from "@playwright/test";

/** Generate a unique email for test isolation. */
export function uniqueEmail(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;
}

/** Sign up a brand-new user and wait for the app shell to load. */
export async function signUp(page: Page, email: string, password = "testpassword123") {
  await page.goto("/");
  // Switch to sign-up flow
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  // Wait for app shell (sidebar loads — use heading which is unique)
  await expect(page.getByRole("heading", { name: "Tenants Demo" })).toBeVisible({ timeout: 15000 });
}

/** Sign in an existing user. */
export async function signIn(page: Page, email: string, password = "testpassword123") {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Tenants Demo" })).toBeVisible({ timeout: 15000 });
}

/** Sign out from the app. */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Tenants Example" })).toBeVisible({ timeout: 10000 });
}

/** Create an organization via the dialog and wait for it to appear. */
export async function createOrganization(page: Page, name: string) {
  await page.getByRole("button", { name: "Create Organization" }).first().click();
  await page.getByRole("textbox", { name: "Organization Name" }).fill(name);
  // Wait for slug to auto-generate, then click create
  await expect(page.getByRole("textbox", { name: "URL Slug" })).not.toHaveValue("");
  await page.getByRole("button", { name: "Create Organization" }).last().click();
  // Wait for org to load — the heading in the org info bar is the reliable signal
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible({ timeout: 15000 });
  // Wait for members data to finish loading (skeleton placeholders disappear)
  await expect(page.getByText("Members & Invitations")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1500);
}

/** Invite a member via the Invite Member dialog. Returns when the invitation link is shown. */
export async function inviteMember(page: Page, email: string, role: "Member" | "Admin" = "Member") {
  await page.getByRole("button", { name: "Invite Member" }).click();
  await expect(page.getByRole("dialog", { name: "Invite Member" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("textbox", { name: "Email Address" }).fill(email);
  if (role !== "Member") {
    // Radix Select — click the trigger, then the option
    const roleSelect = page.getByRole("dialog").locator('[id="role"]');
    await roleSelect.click();
    await page.getByRole("option", { name: role }).click();
  }
  await page.getByRole("button", { name: "Create Invitation" }).click();
  // Wait for invitation link to appear
  await expect(page.getByText("Invitation Created!")).toBeVisible({ timeout: 15000 });
}

/** Close any open dialog by pressing Escape. */
export async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
}

/** Navigate to a page via the sidebar link. */
export async function navigateTo(page: Page, label: "Teams" | "Members" | "Permissions" | "Audit Log" | "Settings") {
  await page.getByRole("link", { name: label }).click();
  // Small wait for page transition
  await page.waitForTimeout(500);
}

/** Create a team on the Teams page via the Create Team dialog. */
export async function createTeam(page: Page, name: string) {
  await page.getByRole("button", { name: "Create Team" }).first().click();
  await page.getByRole("textbox", { name: "Team Name" }).fill(name);
  await page.getByRole("button", { name: /^Create Team$/ }).last().click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}
