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
  maxOrganizations: number,  // Optional; max orgs per user (createOrganization)
  maxMembers: number,       // Optional; max members per org (addMember / bulkAddMembers)
  maxTeams: number,        // Optional; max teams per org (createTeam)

  // Validation hooks — run before the mutation; if they throw, the mutation is skipped
  onBeforeCreateOrganization, onBeforeUpdateOrganization, onBeforeDeleteOrganization,
  onBeforeAddMember, onBeforeRemoveMember, onBeforeUpdateMemberRole, onBeforeLeaveOrganization,
  onBeforeCreateTeam, onBeforeUpdateTeam, onBeforeDeleteTeam, onBeforeInviteMember,

  // Event hooks (all optional, fire after success)
  onOrganizationCreated, onOrganizationDeleted,
  onMemberAdded, onMemberRemoved, onMemberRoleChanged, onMemberLeft,
  onTeamCreated, onTeamDeleted, onTeamMemberAdded, onTeamMemberRemoved,
  onInvitationCreated, onInvitationResent, onInvitationAccepted,

  // Logo upload: when provided, exposes generateLogoUploadUrl mutation
  generateUploadUrl: (ctx) => Promise<string>,
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
| `listOrganizations` | query | List orgs the current user belongs to. Optional args: `status` (`"active" \| "suspended" \| "archived"`), `sortBy` (`"name" \| "createdAt" \| "slug"`), `sortOrder` (`"asc" \| "desc"`). Returns `{ _id, name, slug, logo, metadata, settings?, allowedDomains?, ownerId, role, status? }[]`. |
| `getOrganization` | query | Get org by ID. Returns `{ _id, name, slug, logo, metadata, settings?, allowedDomains?, ownerId, status? } \| null`. Requires membership. |
| `getOrganizationBySlug` | query | Get org by slug. Same return shape. Requires membership. |
| `createOrganization` | mutation | Create org. Args: `name`, optional `slug`, `logo`, `metadata`, `settings` (`{ allowPublicSignup?, requireInvitationToJoin? }`), `allowedDomains` (string[]). Returns org ID. |
| `updateOrganization` | mutation | Update org. Args: `organizationId`, optional `name`, `slug`, `logo`, `metadata`, `settings`, `allowedDomains` (array or `null` to clear), `status` (`"active" \| "suspended" \| "archived"`). Setting `status: "active"` reactivates. |
| `transferOwnership` | mutation | Transfer owner to another member. Args: `organizationId`, `newOwnerUserId`. Only current owner. |
| `deleteOrganization` | mutation | Delete org and all related data. Requires permission. |
| `listOrganizationsJoinableByDomain` | query | List orgs the current user can join by email domain. Args: `email`. Returns `{ _id, name, slug }[]`. No membership required for the list. |
| `joinByDomain` | mutation | Join an org when the user's email domain is in the org's `allowedDomains`. Args: `organizationId`, `userEmail`, optional `role`. Caller is the joining user. |
| `generateLogoUploadUrl` | mutation | **Only present when `generateUploadUrl` option is set.** Returns an upload URL for logo files. Args: none. After uploading, pass the returned storage ID to `updateOrganization` as `logo`. |

**Organization status:** When an organization is `suspended` or `archived`, all mutations that modify that org are rejected. Only `updateOrganization` with `status: "active"` is allowed to reactivate. Queries still work.

**Structured settings:** `settings` is optional and typed as `{ allowPublicSignup?: boolean, requireInvitationToJoin?: boolean }`. Use `metadata` for custom key-value data.

---

## Member functions

| Function | Type | Description |
|----------|------|-------------|
| `listMembers` | query | List members. Optional args: `status` (`"active" \| "suspended" \| "all"`), `sortBy` (`"role" \| "joinedAt" \| "createdAt" \| "userId"`), `sortOrder` (`"asc" \| "desc"`). Returns include `status?`, `suspendedAt?`, `joinedAt?`. Enriched with `user` if `getUser` is set. |
| `listMembersPaginated` | query | Cursor-based pagination. Args: `organizationId`, `paginationOpts`, optional `status`. Returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination). |
| `countMembers` | query | Count members in org. Args: `organizationId`, optional `status`. Returns `number`. Requires membership. |
| `getMember` | query | Get member by org + userId. Returns include `status?`, `suspendedAt?`, `joinedAt?`. |
| `getCurrentMember` | query | Current user’s membership in org. |
| `getCurrentUserEmail` | query | Current user's email from `auth` + `getUser`. Args: none. Returns `string \| null`. Use for "join by domain" UI so the app does not need a separate auth query. Only returns a value when `getUser` is provided. |
| `addMember` | mutation | Add user with role. |
| `bulkAddMembers` | mutation | Add multiple members. Args: `organizationId`, `members` (`{ memberUserId, role }[]`). Returns `{ success: string[], errors: { userId, code, message }[] }`. |
| `removeMember` | mutation | Remove member (not structural owner). |
| `bulkRemoveMembers` | mutation | Remove multiple members. Args: `organizationId`, `memberUserIds` (string[]). Returns `{ success, errors }`. |
| `updateMemberRole` | mutation | Change member role. |
| `suspendMember` | mutation | Soft-disable member (suspended members cannot perform mutations). |
| `unsuspendMember` | mutation | Re-enable a suspended member. |
| `leaveOrganization` | mutation | Leave org (structural owner can only leave if another has creatorRole). |

---

## Team functions

| Function | Type | Description |
|----------|------|-------------|
| `listTeams` | query | List teams. Optional args: `parentTeamId` (string or `null` for root-only), `sortBy` (`"name" \| "createdAt" \| "slug"`), `sortOrder` (`"asc" \| "desc"`). Returns include `slug?`, `metadata?`, `parentTeamId?`. |
| `listTeamsAsTree` | query | List teams as a tree. Args: `organizationId`. Returns `{ team, children }[]` (children are same shape recursively). |
| `listTeamsPaginated` | query | Same as `listTeams` with cursor-based pagination. Args: `organizationId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. |
| `countTeams` | query | Count teams in org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getTeam` | query | Get team by ID. Returns `name`, `description`, `slug?`, `metadata?`, `parentTeamId?`. |
| `listTeamMembers` | query | List team members. Optional args: `sortBy` (`"userId" \| "role" \| "createdAt"`), `sortOrder`. Returns include `role?`. Enriched with `user` if `getUser` set. |
| `listTeamMembersPaginated` | query | Cursor-based pagination for team members. Args: `teamId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination). |
| `isTeamMember` | query | Whether current user is in team. |
| `createTeam` | mutation | Args: `organizationId`, `name`, optional `description`, `slug`, `metadata`, `parentTeamId`. Slug derived from name if omitted. |
| `updateTeam` | mutation | Args: `teamId`, optional `name`, `description`, `slug`, `metadata`, `parentTeamId` (string or `null`). Cycle validation applied when setting parent. |
| `deleteTeam` | mutation | Delete team. Child teams are reparented to the deleted team's parent. |
| `addTeamMember` | mutation | Add org member to team. Args: `teamId`, `memberUserId`, optional `role`. |
| `updateTeamMemberRole` | mutation | Change a team member's role. Args: `teamId`, `memberUserId`, `role`. |
| `removeTeamMember` | mutation | Remove from team. |

**Nested teams:** Use `parentTeamId` to build a hierarchy. `listTeamsAsTree` returns the tree; `listTeams({ parentTeamId: null })` returns only root teams.

---

## Invitation functions

| Function | Type | Description |
|----------|------|-------------|
| `listInvitations` | query | List invitations for org. Optional args: `sortBy` (`"email" \| "expiresAt" \| "createdAt"`), `sortOrder` (`"asc" \| "desc"`). Returns include `message?`, `inviterName?` (stored at invite time from `getUser`). |
| `listInvitationsPaginated` | query | Same as `listInvitations` with cursor-based pagination. Args: `organizationId`, `paginationOpts`. Returns `{ page, isDone, continueCursor }`. |
| `countInvitations` | query | Count invitations for org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getInvitation` | query | Get invitation by ID. Returns include `message?`, `inviterName?`. |
| `getPendingInvitations` | query | Pending invitations for an email. |
| `inviteMember` | mutation | Args: `organizationId`, `email`, `role`, optional `teamId`, `message`. Returns `{ invitationId, email, expiresAt }`. |
| `bulkInviteMembers` | mutation | Send multiple invitations. Args: `organizationId`, `invitations` (`{ email, role, message?, teamId? }[]`). Returns `{ success: { invitationId, email, expiresAt }[], errors: { email, code, message }[] }`. |
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
| `getAuditLog` | query | Audit log from authz, **scoped to the given organization**. Args: `organizationId`, optional `userId`, `action`, `limit`. Returns only entries whose scope matches the organization. |

See [Permission Map](permission-map.md) for which permission guards each mutation.
