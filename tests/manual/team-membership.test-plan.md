# Team Membership

> Tests team member add/remove, team-member listing for non-admins (member-role broadening from v0.3.0), and the nested team hierarchy via NestedTeamsSection (parent/child teams with `listTeamsAsTree`).

## Prerequisites
- Dev server running (`npm run dev`) on `localhost:5173`
- Fresh org (the broadened `member` role applies to new memberships; existing deployments need `authz.syncRoles()`)

## Accounts
- **owner**: creates teams, manages team membership
- **memberA, memberB**: org members assigned to teams

## Steps

### 1. Owner signs up, creates org, invites + accepts both members
- **As**: owner → memberA → memberB
- **Action**: Sign up as owner, create "Team Membership QA". Invite memberA + memberB. Both sign up + accept.
- **Expect**: 3 active members (owner + memberA + memberB).

### 2. Owner creates a parent team "Engineering"
- **As**: owner
- **Action**: Teams page → Create Team → name "Engineering"
- **Expect**: 1 team in the grid. Tree view (NestedTeamsSection) shows "Engineering" at the root.

### 3. Owner creates a child team "Frontend" under Engineering
- **As**: owner
- **Action**: NestedTeamsSection → Name "Frontend", Parent dropdown: select "Engineering" → Create
- **Expect**: 2 teams total. Tree view shows Engineering containing Frontend (indented).

### 4. Owner creates a sibling child "Backend"
- **As**: owner
- **Action**: NestedTeamsSection → Name "Backend", Parent: "Engineering" → Create
- **Expect**: Tree shows Engineering → [Frontend, Backend].

### 5. Owner adds memberA to Engineering
- **As**: owner
- **Action**: Teams page → click "Engineering" team card → "Add Member" or equivalent → select memberA from dropdown
- **Expect**: Engineering team's member count goes to 1. memberA appears in the team's member list.

### 6. Owner adds memberB to Frontend
- **As**: owner
- **Action**: Click Frontend → Add Member → select memberB
- **Expect**: Frontend has 1 member (memberB). Engineering still has 1 (memberA).

### 7. memberA can list team members for Engineering (v0.3.0 broadening)
- **As**: memberA
- **Action**: Sign in as memberA. Teams page → click Engineering.
- **Expect**: Team detail panel shows the member list (memberA visible). Does NOT show "Permission denied: teams:listMembers". This validates the v0.3.0 default member role grant of `teams:["list", "listMembers"]`.

### 8. memberA cannot remove team members (role-gated UI + backend)
- **As**: memberA
- **Action**: In Engineering's member list, look for a Remove or kick action on memberA's own row or others
- **Expect**: Action is hidden in the UI (A1 gating). If somehow surfaced and clicked, backend rejects with a clean ConvexError "Permission denied: teams:removeMember" (A3+A4) — surfaces as a toast (A2), not a `window.alert`.

### 9. memberB sees only Frontend membership
- **As**: memberB
- **Action**: Sign in as memberB. Teams page → click Frontend → check member list
- **Expect**: memberB visible as a member. memberA is NOT (different team). Confirms scoping.

### 10. Owner removes memberA from Engineering
- **As**: owner
- **Action**: Sign in as owner. Engineering team → memberA's row → Remove
- **Expect**: memberA no longer in Engineering's member list. Still an active org member (not removed from org).

### 11. Owner deletes Frontend (child team)
- **As**: owner
- **Action**: Teams page → Frontend card → Delete team button → confirm
- **Expect**: Frontend removed from grid and tree. Engineering remains with Backend as its only child. memberB no longer in any team but still an org member.

### 12. Deleting parent with children — observed behavior
- **As**: owner
- **Action**: Teams page → Engineering card → Delete team → confirm
- **Expect**: Document what actually happens — likely either:
  - Cascading delete: Backend goes too (single confirmation)
  - Rejected: error message saying "delete child teams first"
  - Reparented: Backend becomes a root team
  Whichever it is, it should be deterministic and the audit log should reflect it.

### 13. Audit log captures team operations (or document the gap)
- **As**: owner
- **Action**: Audit Log page
- **Expect**: Team create/delete and team-member add/remove events should appear (similar in spirit to the suspendMember audit emission from C1). If they don't, document the gap — that's a follow-up similar to what C1 fixed for suspend.
