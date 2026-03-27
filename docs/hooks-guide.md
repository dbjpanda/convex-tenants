# Hooks Guide

`makeTenantsAPI` supports two categories of hooks: **onBefore\*** hooks that run before the mutation and can block it, and **on\*** event hooks that run after the mutation succeeds. Both run inside the same Convex mutation transaction.

---

## Complete hook list

### onBefore hooks (validation gates)

| Hook | Fires Before | Callback Signature |
|------|-------------|-------------------|
| `onBeforeCreateOrganization` | `createOrganization` | `(ctx, data: { name: string; slug: string; logo?: string; metadata?: any }) => Promise<void>` |
| `onBeforeUpdateOrganization` | `updateOrganization` | `(ctx, data: { organizationId: string; name?: string; slug?: string; logo?: string \| null; metadata?: any; status?: "active" \| "suspended" \| "archived" }) => Promise<void>` |
| `onBeforeDeleteOrganization` | `deleteOrganization` | `(ctx, data: { organizationId: string }) => Promise<void>` |
| `onBeforeAddMember` | `addMember` | `(ctx, data: { organizationId: string; memberUserId: string; role: string }) => Promise<void>` |
| `onBeforeRemoveMember` | `removeMember` | `(ctx, data: { organizationId: string; memberUserId: string }) => Promise<void>` |
| `onBeforeUpdateMemberRole` | `updateMemberRole` | `(ctx, data: { organizationId: string; memberUserId: string; role: string }) => Promise<void>` |
| `onBeforeLeaveOrganization` | `leaveOrganization` | `(ctx, data: { organizationId: string }) => Promise<void>` |
| `onBeforeCreateTeam` | `createTeam` | `(ctx, data: { organizationId: string; name: string; description?: string; slug?: string; metadata?: any }) => Promise<void>` |
| `onBeforeUpdateTeam` | `updateTeam` | `(ctx, data: { teamId: string; name?: string; description?: string \| null; slug?: string; metadata?: any }) => Promise<void>` |
| `onBeforeDeleteTeam` | `deleteTeam` | `(ctx, data: { teamId: string }) => Promise<void>` |
| `onBeforeInviteMember` | `inviteMember` | `(ctx, data: { organizationId: string; inviteeIdentifier: string; identifierType?: string; role: string; teamId?: string; message?: string }) => Promise<void>` |

### Validation callbacks (return-value-based gates)

These are similar to `onBefore` hooks but use a return value instead of throwing:

| Callback | Fires Before | Callback Signature |
|----------|-------------|-------------------|
| `validateInvitationCreate` | `inviteMember`, `bulkInviteMembers` | `(ctx, data: { organizationId: string; inviterUserId: string; inviteeIdentifier: string; identifierType?: string; role: string; teamId?: string }) => Promise<{ allowed: boolean; reason?: string }>` |
| `validateInvitationAccept` | `acceptInvitation` | `(ctx, data: { invitation: { _id: string; organizationId: string; inviteeIdentifier: string; identifierType?: string; role: string }; acceptingUserId: string; acceptingUserIdentifier: string }) => Promise<{ allowed: boolean; reason?: string }>` |

### on\* event hooks (post-success)

| Hook | Fires After | Callback Signature |
|------|-------------|-------------------|
| `onOrganizationCreated` | `createOrganization` | `(ctx, data: { organizationId: string; name: string; slug: string; ownerId: string }) => Promise<void>` |
| `onOrganizationDeleted` | `deleteOrganization` | `(ctx, data: { organizationId: string; name: string; deletedBy: string }) => Promise<void>` |
| `onMemberAdded` | `addMember`, `bulkAddMembers` (per member) | `(ctx, data: { organizationId: string; userId: string; role: string; addedBy: string }) => Promise<void>` |
| `onMemberRemoved` | `removeMember`, `bulkRemoveMembers` (per member) | `(ctx, data: { organizationId: string; userId: string; removedBy: string }) => Promise<void>` |
| `onMemberRoleChanged` | `updateMemberRole` | `(ctx, data: { organizationId: string; userId: string; oldRole: string; newRole: string; changedBy: string }) => Promise<void>` |
| `onMemberLeft` | `leaveOrganization` | `(ctx, data: { organizationId: string; userId: string }) => Promise<void>` |
| `onTeamCreated` | `createTeam` | `(ctx, data: { teamId: string; name: string; organizationId: string; createdBy: string }) => Promise<void>` |
| `onTeamDeleted` | `deleteTeam` | `(ctx, data: { teamId: string; name: string; organizationId: string; deletedBy: string }) => Promise<void>` |
| `onTeamMemberAdded` | `addTeamMember` | `(ctx, data: { teamId: string; userId: string; addedBy: string }) => Promise<void>` |
| `onTeamMemberRemoved` | `removeTeamMember` | `(ctx, data: { teamId: string; userId: string; removedBy: string }) => Promise<void>` |
| `onInvitationCreated` | `inviteMember`, `bulkInviteMembers` (per invitation) | `(ctx, data: { invitationId: string; inviteeIdentifier: string; identifierType?: string; organizationId: string; organizationName: string; role: string; inviterName?: string; expiresAt: number }) => Promise<void>` |
| `onInvitationResent` | `resendInvitation` | `(ctx, data: { invitationId: string; inviteeIdentifier: string; identifierType?: string; organizationId: string; organizationName: string; role: string; inviterName?: string; expiresAt: number }) => Promise<void>` |
| `onInvitationAccepted` | `acceptInvitation` | `(ctx, data: { invitationId: string; organizationId: string; organizationName: string; userId: string; role: string; inviteeIdentifier: string; identifierType?: string }) => Promise<void>` |

---

## Execution order

Every mutation that supports hooks follows this order:

```
1. requireAuth          -- verify the caller is authenticated
2. requireActiveMembership -- verify the caller is an active org member
3. requireActiveOrganization -- verify the org is not suspended/archived
4. onBefore* hook       -- (if configured) run the onBefore validation
5. Limit checks         -- (if configured) maxOrganizations / maxMembers / maxTeams
6. Core mutation        -- the actual database operation + authz sync
7. on* event hook       -- (if configured) run the post-success callback
```

For invitation creation, `validateInvitationCreate` runs between steps 3 and 4, before `onBeforeInviteMember`.

For invitation acceptance, `validateInvitationAccept` runs after loading the invitation but before the component-level `acceptInvitation` call.

---

## Transaction boundaries

All hooks run inside the same Convex mutation transaction as the core operation. This has important implications:

- **Atomicity:** If an `on*` event hook throws, the entire mutation rolls back -- including the core database operation. The mutation did not "half succeed."
- **Consistency:** Inside a hook, `ctx.db` reads reflect all writes made by the mutation so far. For example, `onMemberAdded` can query the members table and see the just-added member.
- **No partial state:** If `onBeforeCreateOrganization` throws, no organization is created, no member is added, and no authz role is assigned.

### What happens when onBefore throws

When an `onBefore*` hook throws an error:

1. The mutation is aborted -- the core database operation never runs.
2. No `on*` event hook fires.
3. The error propagates to the client as a standard mutation error.
4. The database is unchanged (nothing was written).

```typescript
// Example: Block org creation based on a business rule
makeTenantsAPI(components.tenants, {
  // ...
  onBeforeCreateOrganization: async (ctx, data) => {
    if (data.name.toLowerCase().includes("test")) {
      throw new Error("Organization names cannot contain 'test'");
    }
  },
});
```

### What happens when on\* throws

When a post-success `on*` hook throws:

1. The core mutation has already written to the database, **but** the transaction has not committed yet.
2. Because Convex mutations are transactional, the entire mutation rolls back -- the core operation's writes are undone.
3. The error propagates to the client.

This means `on*` hooks are safe for required side effects (like sending notifications via `ctx.scheduler`). If the hook fails, the triggering operation is also rolled back.

```typescript
// Example: Required audit log -- if this fails, the member add is rolled back
makeTenantsAPI(components.tenants, {
  // ...
  onMemberAdded: async (ctx, data) => {
    await ctx.db.insert("auditLog", {
      action: "member_added",
      organizationId: data.organizationId,
      targetUserId: data.userId,
      performedBy: data.addedBy,
      timestamp: Date.now(),
    });
  },
});
```

---

## The `ctx` argument

Every hook receives `ctx` as its first argument. This is the same Convex mutation context that the enclosing mutation handler receives, giving you full access to:

- `ctx.db` -- read and write to your app's tables
- `ctx.scheduler` -- schedule background actions
- `ctx.auth` -- access the authentication state
- `ctx.storage` -- access file storage

Since hooks run inside the mutation transaction, all `ctx.db` writes are atomic with the core operation.

---

## Common patterns

### Validation gate

Block an operation based on custom business logic:

```typescript
onBeforeAddMember: async (ctx, data) => {
  // Only allow adding members with specific email domains
  const user = await ctx.db.get(data.memberUserId);
  if (!user?.email?.endsWith("@company.com")) {
    throw new Error("Only @company.com emails can be added to this organization");
  }
},
```

### Audit logging

Record every significant action to your own audit table:

```typescript
onMemberRoleChanged: async (ctx, data) => {
  await ctx.db.insert("auditLog", {
    action: "role_changed",
    organizationId: data.organizationId,
    targetUserId: data.userId,
    performedBy: data.changedBy,
    details: { oldRole: data.oldRole, newRole: data.newRole },
    timestamp: Date.now(),
  });
},
```

### Sending notifications

Schedule a background action to send an email or push notification:

```typescript
onInvitationCreated: async (ctx, data) => {
  await ctx.scheduler.runAfter(0, internal.notifications.sendInvitationEmail, {
    inviteeIdentifier: data.inviteeIdentifier,
    organizationName: data.organizationName,
    inviterName: data.inviterName ?? "Someone",
    invitationId: data.invitationId,
    expiresAt: data.expiresAt,
  });
},
```

### Conditional logic based on organization

Use `ctx.db` to look up organization-specific settings:

```typescript
onBeforeCreateTeam: async (ctx, data) => {
  const org = await ctx.db.get(data.organizationId);
  if (org?.metadata?.teamCreationLocked) {
    throw new Error("Team creation is currently disabled for this organization");
  }
},
```

### Cascading side effects

Clean up related resources when a member is removed:

```typescript
onMemberRemoved: async (ctx, data) => {
  // Unassign all tasks belonging to the removed member in this org
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_assignee", (q) => q.eq("assigneeId", data.userId))
    .collect();

  for (const task of tasks) {
    if (task.organizationId === data.organizationId) {
      await ctx.db.patch(task._id, { assigneeId: null });
    }
  }
},
```

### Domain-based invitation validation

Use `validateInvitationCreate` to enforce invitation policies:

```typescript
validateInvitationCreate: async (ctx, data) => {
  // Only allow email-type invitations
  if (!data.inviteeIdentifier.includes("@")) {
    return { allowed: false, reason: "Only email invitations are supported" };
  }

  // Check org-specific allowed domains
  const org = await ctx.db.get(data.organizationId);
  const allowedDomains = org?.metadata?.allowedDomains as string[] | undefined;

  if (allowedDomains?.length) {
    const domain = data.inviteeIdentifier.split("@")[1]?.toLowerCase();
    if (!allowedDomains.includes(domain)) {
      return { allowed: false, reason: `Only emails from ${allowedDomains.join(", ")} can be invited` };
    }
  }

  return { allowed: true };
},
```

---

## Bulk operations and hooks

For bulk operations (`bulkAddMembers`, `bulkRemoveMembers`, `bulkInviteMembers`), event hooks fire **per successful item**, not once for the batch:

- `bulkAddMembers` fires `onMemberAdded` once for each successfully added member.
- `bulkRemoveMembers` fires `onMemberRemoved` once for each successfully removed member.
- `bulkInviteMembers` fires `onInvitationCreated` once for each successfully created invitation.

The `onBefore*` hooks are **not** called for bulk operations -- only single-item mutations (`addMember`, `removeMember`, `inviteMember`) call their corresponding `onBefore*` hook. For bulk invitations, use `validateInvitationCreate` which is called per-item and skips invalid entries rather than aborting the batch.
