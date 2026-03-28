# Known Limitations

This document describes known architectural limitations and tradeoffs in `@djpanda/convex-tenants`. These are not bugs — they are inherent to the component architecture and documented here so consumers can make informed decisions.

---

## 1. Cross-Component Transactions Are Atomic (Not a Limitation)

**Status:** Resolved — this was previously documented as a limitation but is NOT one.

Per [Convex docs](https://docs.convex.dev/components/understanding):

> Similar to a monolithic architecture, data changes commit transactionally across calls to components, without having to reason about complicated distributed commit protocols or data inconsistencies. You'll never have a component commit data but have the calling code roll back.

All operations in this library (e.g., `acceptInvitation` → `assignRole`) run within a single parent mutation. The tenants component mutation and authz component mutation are **sub-transactions** that commit or roll back together. If `authz.assignRole` throws, the entire mutation — including the invitation acceptance — rolls back.

This means the tenants DB and authz state **cannot get out of sync** during normal operation through `makeTenantsAPI`. The only way to create desync is:
- Direct component calls that bypass the wrapper
- Manual DB edits outside the mutation system
- Upgrading the component code without re-syncing existing data

---

## 2. Large-Tenant Transaction Limits

**Severity:** Medium
**Affects:** `deleteOrganization`, `bulkRemoveMembers`, and count queries

### The Problem

`deleteOrganization` cascade-deletes all members, teams, team members, and invitations in a single Convex mutation. Convex mutations have hard limits:

- **~16,384** document reads per transaction
- **~8,192** document writes per transaction
- **~30 seconds** execution time

For an organization with 500+ members, 50+ teams, and hundreds of invitations, the deletion can exceed these limits and fail entirely.

### Affected Operations

| Operation | Complexity | Safe Up To |
|---|---|---|
| `deleteOrganization` | O(2×members + 2×teams × teamMembers + invitations) | ~100 members, ~30 teams |
| `bulkRemoveMembers` | O(N × userTeams) per user | ~50 users at once |
| `countOrganizationMembers` | O(members) via `.collect().length` | ~10,000 members |
| `countTeams` | O(teams) via `.collect().length` | ~10,000 teams |
| `countInvitations` | O(invitations) via `.collect().length` | ~10,000 invitations |

### Why `.collect().length` for Counts

Convex's `.count()` API only supports full table counts, not indexed range queries. Since all count operations need to filter by organization (using an index), `.collect().length` is the only available pattern. For O(1) counts at scale, the [`@convex-dev/aggregate`](https://github.com/get-convex/convex-helpers) component can be used, but that requires schema changes and is beyond the scope of this library.

### Future Fix Direction

The proper fix for `deleteOrganization` at scale would be:

1. Mark org as `status: "deleting"` and return immediately
2. Schedule a background action that deletes resources in batches
3. Each batch processes a bounded number of documents and schedules the next batch
4. Final batch deletes the organization document itself

This changes the API contract (deletion becomes asynchronous) and requires careful handling of the intermediate `"deleting"` state. It is planned for a future version.

### Current Recommendation

For most SaaS applications, organizations have fewer than 100 members and 20 teams. The current synchronous approach works well within these bounds. If you expect larger tenants, consider:

- Implementing batch deletion as a consumer-level background action
- Using `@convex-dev/aggregate` for O(1) counts
- Rate-limiting bulk operations to stay within transaction limits

---

## 3. Component-Level vs Wrapper-Level Security

**Severity:** Low (if using `makeTenantsAPI`) / Medium (if calling components directly)
**Affects:** Direct component callers only

### The Problem

The library has two layers:

```
Consumer App → makeTenantsAPI (wrapper) → Tenants class → Component mutations
```

Security checks are distributed across both layers:

| Check | Wrapper (`makeTenantsAPI`) | Component |
|---|---|---|
| Authentication | ✅ `requireAuth` | ❌ Not checked |
| Active membership | ✅ `requireActiveMembership` | ❌ Not checked |
| Active organization | ✅ `requireActiveOrganization` | ❌ Not checked |
| Authz permissions | ✅ `authzRequireOperation` | ❌ Not checked |
| Owner-only delete | ✅ Owner role check | ✅ `ownerId` check |
| Invitation identity | ✅ Default exact match | ✅ Defense-in-depth check |

If consumers call `components.tenants.organizations.deleteOrganization` directly (bypassing the wrapper), they get only the component-level checks. The component enforces owner-only deletion and invitation identity matching, but does NOT enforce authentication, membership status, or authz permissions.

### Recommendation

Always use `makeTenantsAPI` as the public API surface. The component mutations are internal building blocks and should not be called directly from app code. If you must call them directly, implement your own authentication and authorization checks.

---

## 4. Invitation Identifier Matching

**Severity:** Low
**Affects:** Consumers who define custom `validateInvitationAccept` callbacks

### The Problem

By default, invitation acceptance enforces exact case-insensitive identifier matching (e.g., the email used to accept must match the email the invitation was sent to). If a consumer provides a custom `validateInvitationAccept` callback, the default check is replaced entirely. A weak custom validator could allow the wrong user to accept an invitation.

### Example of a Weak Validator

```typescript
// DON'T do this — allows any user with the same email domain to accept
validateInvitationAccept: async (_ctx, { invitation, acceptingUserIdentifier }) => {
  const invitedDomain = invitation.inviteeIdentifier.split("@")[1];
  const userDomain = acceptingUserIdentifier.split("@")[1];
  return { allowed: invitedDomain === userDomain };
}
```

### Recommendation

If you override `validateInvitationAccept`, always include an exact identifier match as part of your validation, or document why your looser policy is acceptable for your use case.

The component layer also enforces identifier matching as a defense-in-depth measure, but this check is bypassed when the wrapper signals that a custom validator was already used (`skipIdentifierCheck: true`).

---

## 5. Expired Invitations Accumulate — No Cleanup

**Severity:** Medium
**Affects:** `countInvitations`, `listInvitations`

### The Problem

Invitation expiry is checked lazily at read time via `isInvitationExpired()`. The `status` field is only updated to `"expired"` when a mutation encounters the invitation (e.g., `acceptInvitation` or `resendInvitation`). There is no background job or scheduled function to transition pending invitations to expired status.

This means:
- `countInvitations("pending")` includes logically-expired invitations that were never touched after expiry
- Stale invitation rows accumulate indefinitely
- The pending count is systematically over-reported

### Mitigation

Consumers can schedule a periodic cleanup action:

```typescript
// Run daily via ctx.scheduler or a cron
async function cleanupExpiredInvitations(ctx) {
  const pending = await ctx.runQuery(component.invitations.listInvitations, {
    organizationId,
  });
  for (const inv of pending) {
    if (inv.expiresAt < Date.now() && inv.status === "pending") {
      // Touch the invitation to trigger expiry
      await ctx.runMutation(component.invitations.resendInvitation, {
        userId: adminUserId,
        invitationId: inv._id,
      }); // This will throw "expired" and patch the status
    }
  }
}
```

---

## 6. Organization Store — No Cross-Tab Sync

**Severity:** Medium
**Affects:** Multi-tab usage

### The Problem

The organization store uses `localStorage` for persistence and `useSyncExternalStore` for React integration. It does NOT listen to the browser `storage` event. If a user switches organizations in Tab A, Tab B continues showing the old organization until the page is reloaded.

This means Convex queries in Tab B will continue fetching data for the stale org ID.

### Stale Org ID on Load

When the app first loads, the store restores `activeOrganizationId` from localStorage. During the initial query loading window, org-scoped queries may fire with this stale ID before the organizations query result is available. If the org was deleted or the user was removed, those queries will return errors or empty data briefly before the provider falls back to the first available org.

### Mitigation

- The provider already falls back to `organizations[0]` when the stored ID is not found in the query result
- For cross-tab sync, consumers can add a `storage` event listener in their app

---

## 7. `isTeamMember` — Authz vs DB Divergence

**Severity:** Medium
**Affects:** Any code path that checks team membership

### The Problem

The client-layer `Tenants.isTeamMember()` uses `authz.hasRelation()` (ReBAC graph). The component-layer `teams.isTeamMember` query uses the `teamMembers` DB table. The `makeTenantsAPI.isTeamMember` endpoint calls the **client-layer** version.

If the DB and authz get out of sync (e.g., via direct component calls bypassing the wrapper, or missing migration data), these return contradictory results:
- `isTeamMember` (via API) returns `false` (no authz relation)
- `listTeamMembers` returns the member row (DB has it)

This also means `cleanupTeamRelations` during member removal will skip the authz cleanup for any team membership that exists in the DB but not in authz.

### Migration Note

If upgrading from a version that used the DB-based `isTeamMember`, existing team memberships created before the switch may not have authz relations. A one-time migration script should bootstrap `authz.addRelation` for all existing `teamMembers` rows.

---

## 8. `getUser` Callback — Called Per Member, No Caching

**Severity:** Low
**Affects:** `listMembers`, `listTeamMembers` performance

### The Problem

When the `getUser` callback is provided, `listMembers` calls it once per member in the page via `Promise.all`. For a page of 50 members, this is 50 additional DB reads against the consumer's `users` table within a single query function. There is no memoization or batching.

If the same user appears across multiple queries (e.g., as both a direct member and in team member lists), they are fetched multiple times.

### Recommendation

Keep page sizes small (20-30) when `getUser` is configured. For larger pages, consider pre-loading user data in the consumer's app layer.

---

## 9. Slug Changes Are Silent

**Severity:** Low
**Affects:** `createOrganization`, `updateOrganization`

### The Problem

When a requested slug conflicts with an existing one, `ensureUniqueSlug` appends a random suffix (e.g., `acme` → `acme-x7k`). The mutation returns the organization ID, not the final slug. The consumer has no way to know the slug was modified without a separate query.

For `updateOrganization`, the mutation returns `null`. If the slug was changed to avoid a conflict, the consumer won't know the actual slug until they re-query.

### Recommendation

After creating or updating an org, query the org to get the final slug if slug accuracy matters for your UI.

---

## 10. Team Nesting — No Depth Limit

**Severity:** Low
**Affects:** `updateTeam` with `parentTeamId`, `listTeamsAsTree`

### The Problem

Cycle detection in `updateTeam` walks the ancestor chain via `getTeamAncestorIds`. This performs one `ctx.db.get` per level of nesting with no depth limit. A team hierarchy 100 levels deep would require 100 document reads just for the cycle check.

`listTeamsAsTree` collects all teams and builds the tree in memory, so depth doesn't affect it. But `updateTeam` cycle detection is O(depth) per call.

### Recommendation

Keep team hierarchies shallow (3-5 levels). There is no built-in enforcement of a maximum depth.
