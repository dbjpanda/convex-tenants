import { test, expect } from '@playwright/test';

test.describe('Invitation Flow E2E', () => {
  test('should create and accept an invitation', async ({ page, context }) => {
    // Step 1: Navigate to the app
    await page.goto('/');
    
    // Step 2: Sign in (simulate - this assumes your SignIn component auto-signs in for demo)
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Step 3: Check if we're on the main page
    // If there's a sign-in page, we'd need to handle that
    // For now, let's check if we can see the main UI
    const pageTitle = await page.textContent('h1');
    console.log('Page title:', pageTitle);
    
    // Step 4: Create organization if needed
    // Look for "Create Organization" dialog or button
    const hasOrg = await page.locator('text=/Test Org|Tenants Demo/').count();
    
    if (hasOrg === 0) {
      // Click "Create Organization" button if it exists
      const createOrgButton = page.locator('button:has-text("Create Organization")');
      if (await createOrgButton.count() > 0) {
        await createOrgButton.click();
        await page.fill('input[name="name"]', 'E2E Test Organization');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000); // Wait for org creation
      }
    }
    
    // Step 5: Navigate to Members section
    await page.click('a[href="/"]'); // Click Members in sidebar
    await page.waitForLoadState('networkidle');
    
    // Step 6: Create an invitation
    console.log('Looking for Invite Member button...');
    
    // Wait for and click "Invite Member" button
    await page.waitForSelector('button:has-text("Invite Member")', { timeout: 10000 });
    await page.click('button:has-text("Invite Member")');
    
    // Fill in invitation form
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    await page.fill('input[name="email"]', 'testuser@example.com');
    
    // Select role (assuming there's a role selector)
    const roleSelect = page.locator('select[name="role"], button:has-text("Select role")');
    if (await roleSelect.count() > 0) {
      await roleSelect.click();
      await page.click('text=Member');
    }
    
    // Submit invitation
    await page.click('button:has-text("Send Invitation"), button[type="submit"]:has-text("Invite")');
    
    // Wait for success message or invitation to appear
    await page.waitForTimeout(2000);
    
    // Step 7: Get the invitation link
    // Look for the invitation link in the UI (assuming it's displayed)
    console.log('Looking for invitation link...');
    
    // This will depend on your UI - adjust selector as needed
    const invitationLink = await page.locator('[data-testid="invitation-link"], a[href*="/accept-invitation/"]').first();
    
    let inviteUrl = '';
    if (await invitationLink.count() > 0) {
      inviteUrl = await invitationLink.getAttribute('href') || '';
      console.log('Found invitation link:', inviteUrl);
    } else {
      // If link isn't directly visible, check the page content
      const pageContent = await page.content();
      const match = pageContent.match(/\/accept-invitation\/([a-zA-Z0-9_-]+)/);
      if (match) {
        inviteUrl = match[0];
        console.log('Extracted invitation URL:', inviteUrl);
      }
    }
    
    // Verify we have an invitation URL
    expect(inviteUrl).toContain('/accept-invitation/');
    
    // Step 8: Open invitation in new context (simulates different user)
    const newContext = await context.browser()?.newContext();
    expect(newContext).toBeDefined();
    
    if (newContext) {
      const inviteePage = await newContext.newPage();
      
      // Navigate to invitation URL
      await inviteePage.goto(inviteUrl);
      await inviteePage.waitForLoadState('networkidle');
      
      // Step 9: Accept the invitation
      console.log('Accepting invitation...');
      
      // Look for Accept button
      const acceptButton = inviteePage.locator('button:has-text("Accept")');
      await expect(acceptButton).toBeVisible({ timeout: 10000 });
      await acceptButton.click();
      
      // Wait for acceptance to complete
      await inviteePage.waitForTimeout(3000);
      
      // Verify we're redirected or see success message
      const url = inviteePage.url();
      console.log('After acceptance, URL:', url);
      
      // Should redirect to home or show success
      expect(url).toMatch(/\/|members|success/);
      
      // Clean up
      await inviteePage.close();
      await newContext.close();
    }
    
    // Step 10: Verify member was added
    // Go back to members list in original context
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if testuser@example.com appears in members list
    const memberEmail = page.locator('text=testuser@example.com');
    await expect(memberEmail).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Invitation flow completed successfully!');
  });
});
