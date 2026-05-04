# Teams

> Tests team creation, team member assignment, and the role-broadening change in v0.3.0 where the default `member` role gained `teams:["list", "listMembers"]`. Verifies a member-role user can see teams and team members (would have been blocked under pre-0.3.0 defaults).

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Use fresh test accounts (sign up during the test)
- Fresh org (default member role now includes teams:list — pre-0.3.0 deployments need authz syncRoles)

## Accounts
- **owner**: creates org, creates teams, adds team members
- **member**: a member of the org and one team — used to verify the broadened role permissions

## Steps

### 1. Owner signs up and creates org
- **As**: owner
- **Action**: Sign up, create org "Teams QA Org"
- **Expect**: Dashboard shown. "Teams" link visible in sidebar.

### 2. Owner creates first team
- **As**: owner
- **Action**: Click "Teams" in sidebar. Click "Create Team". Name "Engineering". Submit.
- **Expect**: Team grid shows the new "Engineering" team with 0 members. Owner is shown as creator.

### 3. Owner creates second team
- **As**: owner
- **Action**: Click "Create Team" again. Name "Design". Submit.
- **Expect**: Team grid shows two teams: Engineering, Design.

### 4. Owner invites a member to the org
- **As**: owner
- **Action**: Navigate to Members. Invite a fresh email as "member". Save the invitation link.
- **Expect**: Pending invitation row appears.

### 5. Member accepts invitation
- **As**: member
- **Action**: Sign up with the invited email. Navigate to invitation link. Click "Accept Invitation".
- **Expect**: Member dashboard shows org with role "Member".

### 6. Member can list teams (role-broadening verification)
- **As**: member
- **Action**: Click "Teams" in sidebar
- **Expect**: Teams page renders showing both Engineering and Design teams. NOT a permission-denied error. NOT an empty list. (Pre-0.3.0, this would have failed with "FORBIDDEN: requires teams:list".)

### 7. Owner adds member to Engineering team
- **As**: owner
- **Action**: Sign out, sign in as owner. Teams page → Engineering → "Add Member" or open team details → add the member.
- **Expect**: Engineering team now shows 1 member.

### 8. Member can see team members for their team
- **As**: member
- **Action**: Sign in as member. Teams page → click "Engineering" to view details.
- **Expect**: Team detail panel shows the team member list including themselves. NOT a permission-denied error. (Pre-0.3.0, this would have failed with "FORBIDDEN: requires teams:listMembers".)

### 9. Member cannot create teams
- **As**: member
- **Action**: Look for a "Create Team" button on the Teams page
- **Expect**: Button is hidden OR clicking it produces a permission-denied error. Member role does NOT grant teams:create.

### 10. Owner deletes a team
- **As**: owner
- **Action**: Sign in as owner. Teams page → Design team → delete (via menu / dropdown / dedicated button).
- **Expect**: Design team removed from grid. Teams count drops to 1 (Engineering remains with 1 member).
