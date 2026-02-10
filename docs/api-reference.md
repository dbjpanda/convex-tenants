# API Reference

All functions below are returned by `makeTenantsAPI()`. Each becomes a Convex query or mutation that you export from your `convex/tenants.ts` file. Authentication is handled server-side — the client never passes `userId`.

## makeTenantsAPI options

```typescript
makeTenantsAPI(components.tenants, {
  authz: Authz | IndexedAuthz,           // Required
  auth: (ctx) => Promise<string | null>, // Required
  creatorRole: string,                   // Optional, default "owner"
  permissionMap: Partial<TenantsPermissionMap>,
  getUser: (ctx, userId) => Promise<{ name?: string; email?: string } | null>,
  defaultInvitationExpiration: number,

  // Event hooks (all optional)
  onOrganizationCreated, onOrganizationDeleted,
  onMemberAdded, onMemberRemoved, onMemberRoleChanged, onMemberLeft,
  onTeamCreated, onTeamDeleted, onTeamMemberAdded, onTeamMemberRemoved,
  onInvitationCreated, onInvitationResent, onInvitationAccepted,
})
```

See [Quick Start](quick-start.md) for a full example. The table below lists each hook’s payload.

**Auth behavior:** Queries return safe defaults when unauthenticated (empty array, `null`, `false`). Mutations throw `"Not authenticated"` when unauthenticated.

---

## Event Hook Reference

| Hook | Fires After | Callback Data |
|------|-------------|---------------|
| `onOrganizationCreated` | `createOrganization` | `organizationId`, `name`, `slug`, `ownerId` |
| `onOrganizationDeleted` | `deleteOrganization` | `organizationId`, `name`, `deletedBy` |
| `onMemberAdded` | `addMember` | `organizationId`, `userId`, `role`, `addedBy` |
| `onMemberRemoved` | `removeMember` | `organizationId`, `userId`, `removedBy` |
| `onMemberRoleChanged` | `updateMemberRole` | `organizationId`, `userId`, `oldRole`, `newRole`, `changedBy` |
| `onMemberLeft` | `leaveOrganization` | `organizationId`, `userId` |
| `onTeamCreated` | `createTeam` | `teamId`, `name`, `organizationId`, `createdBy` |
| `onTeamDeleted` | `deleteTeam` | `teamId`, `name`, `organizationId`, `deletedBy` |
| `onTeamMemberAdded` | `addTeamMember` | `teamId`, `userId`, `addedBy` |
| `onTeamMemberRemoved` | `removeTeamMember` | `teamId`, `userId`, `removedBy` |
| `onInvitationCreated` | `inviteMember` | `invitationId`, `email`, `organizationId`, `organizationName`, `role`, `inviterName?`, `expiresAt` |
| `onInvitationResent` | `resendInvitation` | same shape as created |
| `onInvitationAccepted` | `acceptInvitation` | `invitationId`, `organizationId`, `organizationName`, `userId`, `role`, `email` |

All hooks receive `ctx` as the first argument.

---

## Organization functions

| Function | Type | Description |
|----------|------|-------------|
| `listOrganizations` | query | List orgs the current user belongs to. Optional arg: `status` (`"active" \| "suspended" \| "archived"`) to filter. Returns `{ _id, name, slug, logo, metadata, ownerId, role, status? }[]`. |
| `getOrganization` | query | Get org by ID. Returns `{ _id, name, slug, logo, metadata, ownerId, status? } \| null`. Requires membership. |
| `getOrganizationBySlug` | query | Get org by slug. Same return shape. Requires membership. |
| `createOrganization` | mutation | Create org. Args: `name`, optional `slug`, `logo`, `metadata`. Returns org ID. |
| `updateOrganization` | mutation | Update org. Args: `organizationId`, optional `name`, `slug`, `logo`, `metadata`, `status` (`"active" \| "suspended" \| "archived"`). Setting `status: "active"` reactivates a suspended/archived org. |
| `transferOwnership` | mutation | Transfer owner to another member. Args: `organizationId`, `newOwnerUserId`. Only current owner. |
| `deleteOrganization` | mutation | Delete org and all related data. Requires permission. |

**Organization status:** When an organization is `suspended` or `archived`, all mutations that modify that org (members, teams, invitations, permissions, etc.) are rejected with "Organization is suspended" or "Organization is archived". Only `updateOrganization` with `status: "active"` is allowed on a suspended/archived org (to reactivate it). Queries (list, get) still work.

---

## Member functions

| Function | Type | Description |
|----------|------|-------------|
| `listMembers` | query | List members; enriched with `user` if `getUser` is set. |
| `listMembersPaginated` | query | Cursor-based pagination. Args: `organizationId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination). |
| `countMembers` | query | Count members in org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getMember` | query | Get member by org + userId. |
| `getCurrentMember` | query | Current user’s membership in org. |
| `addMember` | mutation | Add user with role. |
| `removeMember` | mutation | Remove member (not structural owner). |
| `updateMemberRole` | mutation | Change member role. |
| `leaveOrganization` | mutation | Leave org (structural owner can only leave if another has creatorRole). |

---

## Team functions

| Function | Type | Description |
|----------|------|-------------|
| `listTeams` | query | List teams. Returns include `slug?`, `metadata?`. |
| `listTeamsPaginated` | query | Same as `listTeams` with cursor-based pagination. Args: `organizationId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. |
| `countTeams` | query | Count teams in org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getTeam` | query | Get team by ID. Returns `name`, `description`, `slug?`, `metadata?`. |
| `listTeamMembers` | query | List team members; enriched with `user` if `getUser` set. |
| `listTeamMembersPaginated` | query | Cursor-based pagination for team members. Args: `teamId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination). |
| `isTeamMember` | query | Whether current user is in team. |
| `createTeam` | mutation | Args: `organizationId`, `name`, optional `description`, `slug`, `metadata`. Slug derived from name if omitted. |
| `updateTeam` | mutation | Args: `teamId`, optional `name`, `description`, `slug`, `metadata`. |
| `deleteTeam` | mutation | Delete team. |
| `addTeamMember` | mutation | Add org member to team. |
| `removeTeamMember` | mutation | Remove from team. |

---

## Invitation functions

| Function | Type | Description |
|----------|------|-------------|
| `listInvitations` | query | List invitations for org. Returns include `message?`. |
| `listInvitationsPaginated` | query | Same as `listInvitations` with cursor-based pagination. Args: `organizationId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. |
| `countInvitations` | query | Count invitations for org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getInvitation` | query | Get invitation by ID. Returns include `message?`. |
| `getPendingInvitations` | query | Pending invitations for an email. |
| `inviteMember` | mutation | Args: `organizationId`, `email`, `role`, optional `teamId`, `message`. Returns `{ invitationId, email, expiresAt }`. |
| `acceptInvitation` | mutation | Accept by ID. |
| `resendInvitation` | mutation | Resend (resets expiration). |
| `cancelInvitation` | mutation | Cancel invitation. |

---

## Authorization functions

Powered by `@djpanda/convex-authz`:

| Function | Type | Description |
|----------|------|-------------|
| `checkPermission` | query | Check permission for current user. Args: `organizationId`, `permission`. Returns `{ allowed, reason }`. |
| `getUserPermissions` | query | Effective permissions in org. |
| `getUserRoles` | query | Roles for current user, optional org scope. |
| `grantPermission` | mutation | Grant override to user. |
| `denyPermission` | mutation | Deny override for user. |
| `getAuditLog` | query | Audit log from authz. |

See [Permission Map](permission-map.md) for which permission guards each mutation.
