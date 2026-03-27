/**
 * E2E: Authentication flows
 *
 * Tests sign-up, sign-in, sign-out, and invalid credentials.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, signIn, signOut } from "./helpers";

test.describe("Authentication", () => {
  test("sign up → see empty state → sign out → sign back in", async ({ page }) => {
    const email = uniqueEmail("auth");

    // Sign up
    await signUp(page, email);

    // Should see empty state (no org yet)
    await expect(page.getByText("No Organization Yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Organization" })).toBeVisible();

    // Sign out
    await signOut(page);

    // Should be back on sign-in page
    await expect(page.getByText("Sign in to manage your organizations")).toBeVisible();

    // Sign back in
    await signIn(page, email);

    // Should see the app shell again
    await expect(page.getByText("No Organization Yet")).toBeVisible();
  });

  test("sign in with wrong password shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@e2e.test");
    await page.getByRole("textbox", { name: "Password" }).fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should show error message
    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 10000 });

    // Should still be on sign-in page
    await expect(page.getByRole("heading", { name: "Tenants Example" })).toBeVisible();
  });
});
