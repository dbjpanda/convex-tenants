# API Reference

All functions below are returned by `makeTenantsAPI()`. Each becomes a Convex query or mutation that you export from your `convex/tenants.ts` file. Authentication is handled server-side — the client never passes `userId`.

## makeTenantsAPI options

```typescript
makeTenantsAPI(components.tenants, {
  authz: Authz,                           // Required — pass your Authz instance from authz.ts
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
| `onInvitationCreated` | `inviteMember` | `invitationId`, `inviteeIdentifier`, `identifierType?`, `organizationId`, `organizationName`, `role`, `inviterName?`, `expiresAt` |
| `onInvitationResent` | `resendInvitation` | same shape as created |
| `onInvitationAccepted` | `acceptInvitation` | `invitationId`, `organizationId`, `organizationName`, `userId`, `role`, `inviteeIdentifier`, `identifierType?` |

All hooks receive `ctx` as the first argument.

---

## Organization functions

| Function | Type | Description |
|----------|------|-------------|
| `listOrganizations` | query | List orgs the current user belongs to. Optional args: `status` (`"active" \| "suspended" \| "archived"`), `sortBy` (`"name" \| "createdAt" \| "slug"`), `sortOrder` (`"asc" \| "desc"`). Returns `{ _id, name, slug, logo, metadata, settings?, ownerId, role, status? }[]`. |
| `getOrganization` | query | Get org by ID. Returns `{ _id, name, slug, logo, metadata, settings?, ownerId, status? } \| null`. Requires membership. |
| `getOrganizationBySlug` | query | Get org by slug. Same return shape. Requires membership. |
| `createOrganization` | mutation | Create org. Args: `name`, optional `slug`, `logo`, `metadata`, `settings` (`{ allowPublicSignup?, requireInvitationToJoin? }`). Returns org ID. |
| `updateOrganization` | mutation | Update org. Args: `organizationId`, optional `name`, `slug`, `logo`, `metadata`, `settings`, `status` (`"active" \| "suspended" \| "archived"`). Setting `status: "active"` reactivates. |
| `transferOwnership` | mutation | Transfer owner to another member. Args: `organizationId`, `newOwnerUserId`, optional `previousOwnerRole` (default `"admin"`). Only current owner. |
| `deleteOrganization` | mutation | Delete org and all related data. Requires permission. |
| `generateLogoUploadUrl` | mutation | **Only present when `generateUploadUrl` option is set.** Returns an upload URL for logo files. Args: none. After uploading, pass the returned storage ID to `updateOrganization` as `logo`. |

**Organization status:** When an organization is `suspended` or `archived`, all mutations that modify that org are rejected. Only `updateOrganization` with `status: "active"` is allowed to reactivate. Queries still work.

**Structured settings:** `settings` is optional and typed as `{ allowPublicSignup?: boolean, requireInvitationToJoin?: boolean }`. Use `metadata` for custom key-value data.

---

## Member functions

| Function | Type | Description |
|----------|------|-------------|
| `listMembers` | query | List members. Optional args: `status` (`"active" \| "suspended" \| "all"`), `sortBy` (`"role" \| "joinedAt" \| "createdAt" \| "userId"`), `sortOrder` (`"asc" \| "desc"`), `paginationOpts` (`{ numItems, cursor }`). Without `paginationOpts` returns `Member[]`; with `paginationOpts` returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination) when passing `paginationOpts`. Enriched with `user` if `getUser` is set. |
| `countMembers` | query | Count members in org. Args: `organizationId`, optional `status`. Returns `number`. Requires membership. |
| `getMember` | query | Get member by org + userId. Returns include `status?`, `suspendedAt?`, `joinedAt?`. |
| `getCurrentMember` | query | Current user’s membership in org. |
| `getCurrentUserEmail` | query | Current user's email from `auth` + `getUser`. Args: none. Returns `string \| null`. Use for "join by domain" UI so the app does not need a separate auth query. Only returns a value when `getUser` is provided. |
| `checkMemberPermission` | query | Check if a user meets a minimum role level. Args: `organizationId`, `userId`, `minRole` (string — works with built-in `"member"`, `"admin"`, `"owner"` and custom roles). Returns `{ hasPermission, currentRole, isSuspended? }`. Unknown roles are treated as having no hierarchy level. |
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
| `listTeams` | query | List teams. Optional args: `parentTeamId` (string or `null` for root-only), `sortBy` (`"name" \| "createdAt" \| "slug"`), `sortOrder` (`"asc" \| "desc"`), `paginationOpts` (`{ numItems, cursor }`). Without `paginationOpts` returns `Team[]`; with `paginationOpts` returns `{ page, isDone, continueCursor }`. Returns include `slug?`, `metadata?`, `parentTeamId?`. |
| `listTeamsAsTree` | query | List teams as a tree. Args: `organizationId`. Returns `{ team, children }[]` (children are same shape recursively). |
| `countTeams` | query | Count teams in org. Args: `organizationId`. Returns `number`. Requires membership. |
| `getTeam` | query | Get team by ID. Returns `name`, `description`, `slug?`, `metadata?`, `parentTeamId?`. |
| `listTeamMembers` | query | List team members. Optional args: `sortBy` (`"userId" \| "role" \| "createdAt"`), `sortOrder`, `paginationOpts` (`{ numItems, cursor }`). Without `paginationOpts` returns array; with `paginationOpts` returns `{ page, isDone, continueCursor }`. Use with [usePaginatedQuery](https://docs.convex.dev/database/pagination) when passing `paginationOpts`. Returns include `role?`. Enriched with `user` if `getUser` set. |
| `isTeamMember` | query | Whether current user is in team. |
| `createTeam` | mutation | Args: `organizationId`, `name`, optional `description`, `slug`, `metadata`, `parentTeamId`. Slug derived from name if omitted. |
| `updateTeam` | mutation | Args: `teamId`, optional `name`, `description`, `slug`, `metadata`, `parentTeamId` (string or `null`). Cycle validation applied when setting parent. |
| `deleteTeam` | mutation | Delete team. Child teams are reparented to the deleted team's parent. Pending invitations referencing the team are cancelled. |
| `addTeamMember` | mutation | Add org member to team. Args: `teamId`, `memberUserId`, optional `role`. |
| `updateTeamMemberRole` | mutation | Change a team member's role. Args: `teamId`, `memberUserId`, `role`. |
| `removeTeamMember` | mutation | Remove from team. |

**Nested teams:** Use `parentTeamId` to build a hierarchy. `listTeamsAsTree` returns the tree; `listTeams({ parentTeamId: null })` returns only root teams.

---

## Invitation functions

| Function | Type | Description |
|----------|------|-------------|
| `listInvitations` | query | List invitations for org. Optional args: `sortBy` (`"inviteeIdentifier" \| "expiresAt" \| "createdAt"`), `sortOrder` (`"asc" \| "desc"`), `paginationOpts` (`{ numItems, cursor }`). Without `paginationOpts` returns `Invitation[]`; with `paginationOpts` returns `{ page, isDone, continueCursor }`. Returns include `message?`, `inviterName?` (stored at invite time from `getUser`). |
| `countInvitations` | query | Count invitations for org. Args: `organizationId`, optional `status` (`"pending" \| "accepted" \| "cancelled" \| "expired" \| "all"`, defaults to `"pending"`). Returns `number`. Requires membership. |
| `getInvitation` | query | Get invitation by ID. Returns include `message?`, `inviterName?`. |
| `getPendingInvitations` | query | Pending invitations for an identifier. |
| `inviteMember` | mutation | Args: `organizationId`, `inviteeIdentifier`, `role`, optional `identifierType`, `teamId`, `message`. Returns `{ invitationId, inviteeIdentifier, expiresAt }`. |
| `bulkInviteMembers` | mutation | Send multiple invitations. Args: `organizationId`, `invitations` (`{ inviteeIdentifier, identifierType?, role, message?, teamId? }[]`). Returns `{ success: { invitationId, inviteeIdentifier, expiresAt }[], errors: { inviteeIdentifier, code, message }[] }`. When `validateInvitationCreate` is set, invalid entries are skipped (not fail-fast) and their errors are merged into the `errors` array. |
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
