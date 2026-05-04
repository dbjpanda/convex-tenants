# Permissions Overrides

> Tests the Permissions page (owner/admin only): view own roles + effective permissions, the Permission Checker tool, and granting/denying direct permission overrides on members. Verifies overrides actually take effect in the UI and that audit log records them.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`

## Accounts
- **owner**: org owner — sees the Permissions page
- **target**: a regular member — receives grant/deny overrides

## Steps

### 1. Owner signs up, creates org, invites + accepts target as member
- **As**: owner → target
- **Action**: Sign up as owner, create "Permissions QA Org", invite target. Sign up as target, accept invite.
- **Expect**: 2 active members. Target's role is Member.

### 2. Owner navigates to Permissions page
- **As**: owner
- **Action**: Sign in as owner. Click "Permissions" in sidebar.
- **Expect**: Page renders three sections: "Your Permissions", "Permission Checker", "Grant / Deny Permission Override".

### 3. Own roles and effective permissions visible
- **As**: owner
- **Action**: Read the "Your Permissions" section
- **Expect**: "Assigned Roles" shows an "owner" badge. "Effective Permissions" shows multiple green permission chips (organizations:*, members:*, teams:*, etc.).

### 4. Permission Checker — owner has organizations:update
- **As**: owner
- **Action**: Permission Checker → select "organizations:update" → wait for result
- **Expect**: Result chip shows "Allowed" in green.

### 5. Permission Checker — owner has members:remove
- **As**: owner
- **Action**: Select "members:remove" in the checker
- **Expect**: Result: Allowed.

### 6. Member sidebar does NOT show Permissions link
- **As**: target
- **Action**: Sign in as target. Look at the sidebar.
- **Expect**: Sidebar shows Teams + Members only. NO Permissions, Audit Log, or Settings links.

### 7. Member cannot deep-link to /permissions
- **As**: target
- **Action**: Navigate to `/permissions` via direct URL
- **Expect**: Page shows "Access Restricted: You need to be an owner or admin to view permissions" (validates B1's loader-then-gate behavior — should NOT briefly flash the permissions UI).

### 8. Owner grants target the `teams:create` permission
- **As**: owner
- **Action**: Sign back in as owner. Permissions page → Grant section → select target from "Target Member" dropdown → select "teams:create" from "Permission" dropdown → click Grant.
- **Expect**: Status text: "Granted teams:create for user".

### 9. Target can now create teams (override works end-to-end)
- **As**: target
- **Action**: Sign in as target. Navigate to Teams.
- **Expect**: "Create Team" button is now visible (A1's gating reads the override-aware permission state). Click it, create a team named "Override Test" — succeeds without error.

### 10. Owner denies target the `members:list` permission
- **As**: owner
- **Action**: Permissions page → Grant section → select target → select "members:list" → click Deny.
- **Expect**: Status: "Denied members:list for user".

### 11. Target can no longer see other members
- **As**: target
- **Action**: Sign in as target. Members page.
- **Expect**: Either the members list is empty / shows only target's own row, OR an inline message indicates the list isn't available. Confirms the explicit deny overrides the member role's `members:list` grant from v0.3.0.

### 12. Audit log records grants and denies with scope
- **As**: owner
- **Action**: Audit Log page
- **Expect**: New entries appear: `permission_granted` (teams:create) and `permission_denied` (members:list). Each has the org scope in `details.scope`. They're filtered into the org-scoped view (validates the audit-log scope filter from `f32bba3`).
