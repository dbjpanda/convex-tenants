# Organization Lifecycle

> Tests the full org lifecycle via OrgSettingsPanel and OrganizationSwitcher: create, edit settings, multi-org switching, transfer ownership, leave, and delete. Verifies cross-org data isolation along the way.

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Use fresh test accounts (sign up during the test)

## Accounts
- **founder**: creates orgs, edits settings, transfers ownership, leaves
- **partner**: invited to first org, becomes owner via transfer
- **observer**: invited to second org only — used to verify cross-org isolation

## Steps

### 1. Founder signs up and creates first org
- **As**: founder
- **Action**: Sign up with a fresh email. Click "Create Organization", name it "Acme Co", slug "acme"
- **Expect**: Dashboard shows "Acme Co" with "Your role: Owner". Sidebar org switcher value is "Acme Co".

### 2. Founder creates a second org via the switcher
- **As**: founder
- **Action**: Click the org switcher in the sidebar → look for "Create Organization" (or equivalent option) → name it "Globex Corp", slug "globex"
- **Expect**: New org created. Switcher shows both orgs in the dropdown. Active org switches to (or remains at) one of them.

### 3. Multi-org switching is persistent
- **As**: founder
- **Action**: Switch to Acme Co. Refresh the page (F5). Switch to Globex. Refresh again.
- **Expect**: Each refresh reopens with the last-selected org active. The active-org id is persisted in localStorage (key `tenants-active-organization`).

### 4. Update org settings via Settings page
- **As**: founder (in Acme Co)
- **Action**: Navigate to Settings (sidebar link, owner-only). Change org name to "Acme Industries". Save.
- **Expect**: Toast confirms "Organization updated successfully". Sidebar org switcher updates to "Acme Industries". Slug remains "acme".

### 5. Founder invites partner to Acme Industries
- **As**: founder
- **Action**: Members page → Invite partner. Save invitation link.
- **Expect**: Pending row appears.

### 6. Partner accepts and joins Acme Industries (only)
- **As**: partner
- **Action**: Sign out as founder. Sign up as partner with the invited email. Navigate to invitation link. Click Accept.
- **Expect**: Partner dashboard shows Acme Industries with role Member. Globex is NOT in their org switcher (not a member).

### 7. Founder invites observer to Globex (only)
- **As**: founder → observer
- **Action**: Sign back in as founder. Switch to Globex. Invite observer. Sign up as observer, accept.
- **Expect**: Observer sees only Globex in their switcher. Acme Industries is NOT visible.

### 8. Cross-org isolation
- **As**: observer
- **Action**: Try to navigate directly to Acme's settings (URL hack, e.g., `/settings` while observer's active org is Globex)
- **Expect**: Settings render for Globex (observer's org), NOT for Acme. Observer never sees Acme data.

### 9. Founder transfers ownership of Acme to partner
- **As**: founder (in Acme Industries)
- **Action**: Settings page → "Transfer Ownership" section → select partner from the target dropdown → confirm
- **Expect**: Confirmation dialog. After confirming: founder's role becomes Member, partner's role becomes Owner. Toast confirms.

### 10. Founder can no longer access Settings (Acme)
- **As**: founder (still in Acme as a member now)
- **Action**: Try to click Settings in the sidebar
- **Expect**: Settings link is hidden (members can't see it) OR the page shows "Access Restricted". This validates the role downgrade actually took effect.

### 11. Founder leaves Acme Industries
- **As**: founder
- **Action**: Members page → "Leave Organization" action (or Settings → leave) → confirm dialog
- **Expect**: Founder removed from Acme. Sidebar drops Acme from switcher. Founder still sees Globex.

### 12. Partner is now sole owner of Acme
- **As**: partner
- **Action**: Sign in. Members page in Acme.
- **Expect**: Partner is the only member, role Owner. Settings/Audit/Permissions links visible in sidebar.

### 13. Partner deletes Acme Industries
- **As**: partner
- **Action**: Settings → "Danger Zone" → Delete Organization. Confirm by typing the org name (or the site's confirm pattern).
- **Expect**: Acme Industries removed. Partner sees "No Organization Yet" if they have no other orgs. Switcher empty.

### 14. Founder still has Globex intact
- **As**: founder
- **Action**: Sign in as founder. Verify only Globex remains.
- **Expect**: Globex is the sole org. Observer is still a member there. No trace of Acme remaining (org list, audit log mentioning Acme should not appear).
