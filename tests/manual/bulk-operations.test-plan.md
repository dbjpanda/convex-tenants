# Bulk Operations

> Tests BulkInviteSection (multi-email invite) and bulk member moderation (select-all + bulk remove). Edge cases: empty input, mixed valid/invalid emails, removing yourself, comma vs newline separators.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`

## Accounts
- **owner**: performs all bulk operations
- **bulk-N**: invitees / members for bulk add/remove flows

## Steps

### 1. Owner signs up and creates org
- **As**: owner
- **Action**: Sign up, create "Bulk QA Org"
- **Expect**: Dashboard with 1 active member (owner).

### 2. Bulk invite button is disabled when textarea is empty
- **As**: owner
- **Action**: Members page → scroll to "Bulk invite" section → leave textarea empty → check Bulk invite button state
- **Expect**: Button has the `disabled` attribute. Cannot be clicked.

### 3. Bulk invite — newline-separated emails
- **As**: owner
- **Action**: Bulk invite textarea: enter 4 emails one per line:
  ```
  bulk1@test.com
  bulk2@test.com
  bulk3@test.com
  bulk4@test.com
  ```
  Role: Member. Click Bulk invite.
- **Expect**: Toast confirms 4 invites created. Members header now reads "1 member, 4 pending invitations". 4 new pending rows in the unified table.

### 4. Bulk invite — comma-separated also works
- **As**: owner
- **Action**: Bulk invite: `extra1@test.com, extra2@test.com` (comma-separated, with spaces)
- **Expect**: 2 more invites created. Total pending = 6.

### 5. Bulk invite — invalid email handling
- **As**: owner
- **Action**: Bulk invite `valid-extra@test.com, not-an-email` and observe behavior
- **Expect**: Either (a) valid email goes through and invalid is skipped with a per-row toast, OR (b) the entire batch is rejected with a clear error toast naming the invalid entry. Should NOT be a generic Server Error / stack trace (verifies A3+A4's ConvexError surfacing for validation errors too if applicable).

### 6. Bulk invite — duplicate of an existing pending invite
- **As**: owner
- **Action**: Bulk invite `bulk1@test.com` again (already pending)
- **Expect**: Either ignored silently (idempotent) or rejected with a clear "already invited" message. Document actual behavior.

### 7. Two invitees accept
- **As**: bulk1, bulk2
- **Action**: Sign up as each, accept their respective invitation links
- **Expect**: Each becomes an active member. Owner's view: pending count drops by 2 as members convert.

### 8. Member moderation — owner row has no checkbox or remove action
- **As**: owner
- **Action**: Members page → scroll to "Member moderation" → look at owner's row
- **Expect**: Owner row has no select checkbox and shows "—" in the Actions column (you can't bulk-remove yourself).

### 9. Select-all checkbox toggles non-owner rows
- **As**: owner
- **Action**: Click "Select all" in moderation table header
- **Expect**: All non-owner member rows are checked. Bulk remove action becomes enabled.

### 10. Bulk remove members
- **As**: owner
- **Action**: With both members selected, click bulk remove → confirm in dialog
- **Expect**: Toast confirms count removed. Both members are gone from the table. Members table back to "1 member" (owner alone). Pending invitations remain unaffected.

### 11. Cancel a bulk-invite-created pending invitation
- **As**: owner
- **Action**: In the unified members table, find a pending row → click Cancel invitation
- **Expect**: Pending row disappears. Pending count decrements.
