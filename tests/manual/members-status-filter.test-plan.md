# Members Status Filter

> Tests the active/suspended/pending filter dropdown, suspend/unsuspend mutations, and the conditional rendering of filter tabs based on data presence. Pins the regression fixed in dd802aa where the provider passed no `status` arg and suspended members never reached the table.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Use fresh test accounts (sign up during the test)

## Accounts
- **owner**: org owner — performs suspend/unsuspend
- **member**: gets suspended and unsuspended

## Steps

### 1. Owner signs up and creates org
- **As**: owner
- **Action**: Sign up with a fresh email, click "Create Organization", name it "Status Filter QA"
- **Expect**: Dashboard shows org. Members table description reads "1 people (1 active)". Filter dropdown shows ONLY "All" and "Active" options (no Suspended, no Pending — both are conditionally rendered when count > 0).

### 2. Owner invites and accepts as member
- **As**: owner
- **Action**: Click "Invite Member", enter member's email, role "member", click "Create Invitation". Save the invitation link.
- **Expect**: "Invitation Created!" dialog with the link.

### 3. Member accepts
- **As**: member
- **Action**: Sign out. Sign up with the invited email. Navigate to the invitation link. Click "Accept Invitation".
- **Expect**: Dashboard shows org with role "Member".

### 4. Owner suspends member
- **As**: owner
- **Action**: Sign out, sign in as owner. Scroll to "Member moderation" section. Click "Suspend" next to the member's row.
- **Expect**: Member moderation table shows member as "Suspended" with "Unsuspend" action. Top "Members & Invitations" table description updates to "2 people (1 active, 1 suspended)". Suspended member's row shows the red Suspended badge.

### 5. Filter dropdown adds Suspended option
- **As**: owner
- **Action**: Open the filter dropdown next to "All"
- **Expect**: Dropdown shows three options: "All", "Active", "Suspended" (Suspended is now visible because count > 0). No Pending option (no pending invitations exist).

### 6. Filter to Suspended-only
- **As**: owner
- **Action**: Select "Suspended" from the dropdown
- **Expect**: Description reads "1 suspended member". Table shows ONLY the member row with red Suspended badge. Owner row is filtered out.

### 7. Filter back to Active
- **As**: owner
- **Action**: Select "Active" from the dropdown
- **Expect**: Description reads "1 active member". Table shows ONLY the owner row. Suspended member row is filtered out.

### 8. Owner unsuspends member
- **As**: owner
- **Action**: Switch filter back to "All". Scroll to Member moderation. Click "Unsuspend".
- **Expect**: Member moderation row shows member as "Active" again. Top table description reverts to "2 people (2 active)". Filter dropdown drops the "Suspended" option (count back to 0).

### 9. Pending tab appears when invitation exists
- **As**: owner
- **Action**: Click "Invite Member", enter a fresh email, click "Create Invitation", close the dialog
- **Expect**: Description reads "3 people (2 active, 1 pending)". Filter dropdown shows "All", "Active", "Pending" (no Suspended).

### 10. Filter to Pending shows only the invitation
- **As**: owner
- **Action**: Select "Pending" from the dropdown
- **Expect**: Description reads "1 pending invitation". Table shows ONLY the pending invitation row with yellow Pending badge and resend/copy/cancel actions. No member rows.
