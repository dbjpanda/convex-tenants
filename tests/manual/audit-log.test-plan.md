# Audit Log

> Verifies that org-level mutations (member add/remove/role change/suspend) produce visible audit log entries. Pins the fix from f32bba3 where Tenants.getAuditLog was filtering on `entry.scope` while authz stores scope under `entry.details.scope`, causing the page to always be empty.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Use fresh test accounts (sign up during the test)

## Accounts
- **owner**: org owner — performs all mutations
- **member**: gets added, role-changed, suspended

## Steps

### 1. Owner signs up and creates org
- **As**: owner
- **Action**: Sign up, click "Create Organization", name it "Audit QA Org"
- **Expect**: Dashboard shows org. Navigate to Audit Log page (sidebar link "Audit Log" — owner role only).

### 2. Audit log shows the role assignment for org creation
- **As**: owner
- **Action**: Click "Audit Log" in the sidebar
- **Expect**: Page shows at least one entry — `role_assigned` for the owner role (assigned to owner during createOrganization). Entries should show timestamp, action, userId. NOT "No audit entries yet".

### 3. Invite member and check audit log
- **As**: owner
- **Action**: Go to Members page. Invite a member. Save the invitation link.
- **Expect**: Members table shows pending invitation.

### 4. Member accepts, audit log gains role_assigned entry
- **As**: member
- **Action**: Sign up as member with the invited email. Navigate to the invitation link. Click "Accept Invitation".
- **Expect**: Member dashboard shows org.

### 5. Owner verifies acceptance shows in audit log
- **As**: owner
- **Action**: Sign out, sign in as owner. Navigate to Audit Log.
- **Expect**: Audit log now shows additional entries: at minimum a `role_assigned` for the member role assigned to the new member.

### 6. Owner changes member role to admin, verify audit
- **As**: owner
- **Action**: Go to Members page. In the member's row, change role from "member" to "admin" via the role dropdown.
- **Expect**: Role updated in table.

### 7. Audit log shows role change
- **As**: owner
- **Action**: Navigate to Audit Log
- **Expect**: New entries appear: `role_revoked` (member) and `role_assigned` (admin), or a single `role_changed` action — whichever the underlying authz mutation emits. The total entry count has grown from step 5.

### 8. Owner suspends member, verify audit
- **As**: owner
- **Action**: Members page → Member moderation → Suspend. Then navigate to Audit Log.
- **Expect**: Audit log shows a new entry from the suspend mutation. (May be `attribute_set` if status is stored as an attribute, or a custom action; in either case there should be a NEW row that wasn't there before suspending.)

### 9. Empty state never returns once entries exist
- **As**: owner
- **Action**: Refresh the Audit Log page (F5)
- **Expect**: Same entries still visible after refresh. Page does NOT briefly flash "No audit entries yet" then load — entries should be present immediately or after a normal loading skeleton.
