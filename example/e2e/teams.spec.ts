/**
 * E2E: Teams management
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUp, createOrganization, navigateTo } from "./helpers";

test.describe("Teams", () => {
  test("create team via dialog → appears in list", async ({ page }) => {
    const email = uniqueEmail("team");
    await signUp(page, email);
    await createOrganization(page, "Team Org");

    await navigateTo(page, "Teams");
    await expect(page.getByText("No teams yet")).toBeVisible({ timeout: 10000 });

    // Use "Create your first team" to avoid ambiguity
    await page.getByRole("button", { name: "Create your first team" }).click();
    await page.getByRole("textbox", { name: "Team Name" }).fill("Backend");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Create Team/ }).click();

    // Wait for dialog to close and team to appear
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Backend" }).or(page.locator("text=Backend").first())).toBeVisible({ timeout: 10000 });
  });

  test("create team via nested section form", async ({ page }) => {
    const email = uniqueEmail("nested");
    await signUp(page, email);
    await createOrganization(page, "Nested Org");

    await navigateTo(page, "Teams");

    // Scroll to nested section and use the inline form
    const nestedSection = page.getByText("Nested teams (tree)");
    await nestedSection.scrollIntoViewIfNeeded();
    await expect(nestedSection).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("Team name").fill("Frontend");
    // Use .last() since there may be multiple "Create team" buttons
    await page.locator("button", { hasText: "Create team" }).last().click();
    await page.waitForTimeout(2000);
    // Verify team appears somewhere on the page
    await expect(page.getByText("Frontend").first()).toBeVisible({ timeout: 10000 });
  });
});
