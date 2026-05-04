# Invitation Flow

> Tests invite, accept, decline, re-invite, and permission visibility for organization invitations.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Use fresh test accounts (sign up during the test)

## Accounts
- **owner**: creates the org, sends invitations
- **member**: accepts an invitation
- **decliner**: declines an invitation

## Steps

### 1. Owner signs up and creates organization
- **As**: owner
- **Action**: Sign up with a fresh email, click "Create Organization", name it "QA Test Org"
- **Expect**: Dashboard shows org with "Your role: Owner", Members table shows 1 active member (the owner)

### 2. Owner invites member
- **As**: owner
- **Action**: Click "Invite Member", enter member's email, role "member", click "Create Invitation"
- **Expect**: Dialog shows "Invitation Created!" with a link. Save the invitation link.

### 3. Owner sees pending invitation in table
- **As**: owner
- **Action**: Close the invite dialog, check the members table
- **Expect**: Header shows "1 member, 1 pending invitation". Table shows "2 people (1 active, 1 pending)". Pending row has Pending badge and resend/copy/cancel actions.

### 4. Member signs up and accepts invitation
- **As**: member
- **Action**: Sign out. Sign up with the invited email. Navigate to the invitation link. Click "Accept Invitation".
- **Expect**: Page shows "Welcome Aboard!" then redirects to dashboard. Member sees the org with "Your role: Member".

### 5. Member can see members list
- **As**: member
- **Action**: Check the members table on the dashboard
- **Expect**: Table shows "2 people (2 active)" — both owner and member visible. No Actions column (member role). No pending invitation rows.

### 6. Owner sees no duplicate after accept
- **As**: owner
- **Action**: Sign out, sign in as owner, check members table
- **Expect**: "2 members" header (no pending count). Table shows "2 people (2 active)". No "Accepted" invitation row — only active member rows.

### 7. Owner invites decliner
- **As**: owner
- **Action**: Click "Invite Member", enter decliner's email, click "Create Invitation". Save the link.
- **Expect**: Table now shows "3 people (2 active, 1 pending)"

### 8. Decliner signs up and declines
- **As**: decliner
- **Action**: Sign out. Sign up with the invited email. Navigate to the invitation link. Click "Decline".
- **Expect**: Page briefly shows "Invitation Declined" then redirects to home. Decliner sees "No Organization Yet".

### 9. Owner sees declined invitation filtered out
- **As**: owner
- **Action**: Sign out, sign in as owner, check members table
- **Expect**: "2 members" header. Table shows "2 people (2 active)". Declined invitation is NOT shown.

### 10. Owner can re-invite after decline
- **As**: owner
- **Action**: Click "Invite Member", enter the same email that declined, click "Create Invitation"
- **Expect**: New invitation created successfully (no "already exists" error since the old one was declined, not pending)

### 11. Cancel invitation
- **As**: owner
- **Action**: Cancel the re-invite by clicking the cancel (X) button in the actions column
- **Expect**: Pending row disappears. Back to "2 people (2 active)".
