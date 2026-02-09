# @djpanda/convex-tenants

A multi-tenant organization and team management component for [Convex](https://convex.dev) with flexible, developer-defined authorization via [`@djpanda/convex-authz`](https://github.com/dbjpanda/convex-authz).

## Features

- **Organizations**: Create, update, delete organizations with unique slugs
- **Members**: Add, remove, update member roles — roles are fully flexible strings you define
- **Teams**: Create teams within organizations and manage team membership
- **Invitations**: Invite users by email with customizable expiration
- **Flexible Authorization**: Define your own roles and permissions in `authz.ts` using `@djpanda/convex-authz`
- **Permission Map**: Customize which permission guards each operation, or disable checks entirely
- **React Hooks**: Ready-to-use hooks for React applications
- **UI Components**: Pre-built React components for organization management

## Installation

```bash
npm install @djpanda/convex-tenants @djpanda/convex-authz
```

For React UI components, also install optional peer dependencies:

```bash
npm install clsx tailwind-merge
```

## Quick Start

### 1. Configure the components

In your `convex/convex.config.ts`, register **both** `tenants` and `authz` as sibling components:

```typescript
import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(tenants);
app.use(authz);

export default app;
```

> **Important:** `authz` is a separate, global component — not a child of `tenants`. This means other parts of your app can also use `authz` for permission checks outside of the tenants context.

### 2. Define your authorization config

Create `convex/authz.ts` to define the permissions and roles for your application. The tenants package exports `TENANTS_PERMISSIONS` and `TENANTS_ROLES` as convenient defaults you can extend:

```typescript
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";

// Step 1: Define permissions — include tenants defaults + your app-specific resources
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  // Add app-specific resources:
  // billing: { manage: true, view: true, export: true },
  // projects: { create: true, read: true, update: true, delete: true },
});

// Step 2: Define roles — include tenants defaults + your app-specific extensions
const roles = defineRoles(permissions, TENANTS_ROLES, {
  // Extend existing roles with app-specific permissions:
  // owner: { billing: ["manage", "view", "export"] },
  // admin: { billing: ["view"] },

  // Add completely new roles:
  // billing_admin: {
  //   organizations: ["read"],
  //   billing: ["manage", "view", "export"],
  // },
});

// Step 3: Create the Authz client
export const authz = new Authz(components.authz, { permissions, roles });
```

> **Tip:** You don't have to use `TENANTS_PERMISSIONS` and `TENANTS_ROLES`. You can define everything from scratch — just make sure your permissions cover the operations in the [Permission Map](#permission-map).

### 3. Create your tenants API

In your `convex/tenants.ts`:

```typescript
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { authz } from "./authz";

export const {
  // Organizations
  listOrganizations, getOrganization, getOrganizationBySlug,
  createOrganization, updateOrganization, deleteOrganization,
  // Members
  listMembers, getMember, getCurrentMember,
  addMember, removeMember, updateMemberRole, leaveOrganization,
  // Teams
  listTeams, getTeam, listTeamMembers, isTeamMember,
  createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
  // Invitations
  listInvitations, getInvitation, getPendingInvitations,
  inviteMember, acceptInvitation, resendInvitation, cancelInvitation,
  // Authorization
  checkPermission, getUserPermissions, getUserRoles,
  grantPermission, denyPermission, getAuditLog,
} = makeTenantsAPI(components.tenants, {
  authz,                  // Required: your Authz instance from authz.ts
  creatorRole: "owner",   // Role assigned when creating an org (must match authz.ts)

  auth: async (ctx) => {
    return await getAuthUserId(ctx) ?? null;
  },

  getUser: async (ctx, userId) => {
    const user = await ctx.db.get(userId);
    return user ? { name: user.name, email: user.email } : null;
  },

  onInvitationCreated: async (ctx, invitation) => {
    // Send invitation email
    await ctx.scheduler.runAfter(0, internal.emails.sendInvitation, {
      email: invitation.email,
      organizationName: invitation.organizationName,
    });
  },
});
```

> **Why the destructure?** Convex uses file-based routing — each named export
> becomes a callable function reference (e.g. `api.tenants.listOrganizations`).
> ES modules require static named exports, so we can't dynamically re-export.
> But with a single destructure, **one statement exports everything**.
>
> You can also selectively export only the functions you need:
>
> ```typescript
> export const { listOrganizations, createOrganization, inviteMember } =
>   makeTenantsAPI(components.tenants, { ... });
> ```

### 4. Use in your React app

```tsx
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function OrganizationList() {
  const orgs = useQuery(api.tenants.listOrganizations);
  const createOrg = useMutation(api.tenants.createOrganization);

  return (
    <div>
      {orgs?.map((org) => (
        <div key={org._id}>
          {org.name} - {org.role}
        </div>
      ))}
      <button onClick={() => createOrg({ name: "New Org" })}>
        Create Organization
      </button>
    </div>
  );
}
```

## API Reference

All functions below are returned by `makeTenantsAPI()`. Each becomes a Convex query or mutation that you export from your `convex/tenants.ts` file. Authentication is handled server-side — the client never passes `userId`.

### `makeTenantsAPI` Options

```typescript
makeTenantsAPI(components.tenants, {
  // Required: your Authz instance from authz.ts
  authz: Authz | IndexedAuthz,

  // Required: returns the authenticated user's ID, or null if unauthenticated
  auth: (ctx) => Promise<string | null>,

  // Optional: role assigned when a user creates an organization (default: "owner")
  // Must match a role defined in your authz.ts
  creatorRole: string,

  // Optional: override permission strings for each guarded operation
  // See the Permission Map section below
  permissionMap: Partial<TenantsPermissionMap>,

  // Optional: enrich member/team-member results with user details
  getUser: (ctx, userId) => Promise<{ name?: string; email?: string } | null>,

  // Optional: default invitation expiration in ms (default: 48 hours)
  defaultInvitationExpiration: number,

  // ---- Event Hook Callbacks (all optional) ----

  // Organization hooks
  onOrganizationCreated: (ctx, { organizationId, name, slug, ownerId }) => Promise<void>,
  onOrganizationDeleted: (ctx, { organizationId, name, deletedBy }) => Promise<void>,

  // Member hooks
  onMemberAdded: (ctx, { organizationId, userId, role, addedBy }) => Promise<void>,
  onMemberRemoved: (ctx, { organizationId, userId, removedBy }) => Promise<void>,
  onMemberRoleChanged: (ctx, { organizationId, userId, oldRole, newRole, changedBy }) => Promise<void>,
  onMemberLeft: (ctx, { organizationId, userId }) => Promise<void>,

  // Team hooks
  onTeamCreated: (ctx, { teamId, name, organizationId, createdBy }) => Promise<void>,
  onTeamDeleted: (ctx, { teamId, name, organizationId, deletedBy }) => Promise<void>,
  onTeamMemberAdded: (ctx, { teamId, userId, addedBy }) => Promise<void>,
  onTeamMemberRemoved: (ctx, { teamId, userId, removedBy }) => Promise<void>,

  // Invitation hooks
  onInvitationCreated: (ctx, { invitationId, email, organizationId, organizationName, role, inviterName, expiresAt }) => Promise<void>,
  onInvitationResent: (ctx, { invitationId, email, organizationId, organizationName, role, inviterName, expiresAt }) => Promise<void>,
  onInvitationAccepted: (ctx, { invitationId, organizationId, organizationName, userId, role, email }) => Promise<void>,
})
```

#### Event Hook Reference

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
| `onInvitationResent` | `resendInvitation` | `invitationId`, `email`, `organizationId`, `organizationName`, `role`, `inviterName?`, `expiresAt` |
| `onInvitationAccepted` | `acceptInvitation` | `invitationId`, `organizationId`, `organizationName`, `userId`, `role`, `email` |

All hooks receive `ctx` as the first argument (the mutation context), so you can use `ctx.db`, `ctx.scheduler`, etc. inside them.

**Auth behavior:**
- **Queries** — return safe defaults when unauthenticated (empty array, `null`, `false`)
- **Mutations** — throw `"Not authenticated"` when unauthenticated

---

### Organization Functions

#### `listOrganizations` (query)

List all organizations the current user belongs to, with their role.

| Arg | Type | Description |
|-----|------|-------------|
| *(none)* | | Auth is handled automatically |

**Returns:** `Array<{ _id, _creationTime, name, slug, logo, metadata, ownerId, role }>` — empty array if unauthenticated.

---

#### `getOrganization` (query)

Get a single organization by its ID. Requires membership.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization's ID |

**Returns:** `{ _id, _creationTime, name, slug, logo, metadata, ownerId } | null`

---

#### `getOrganizationBySlug` (query)

Get a single organization by its unique slug. Requires membership.

| Arg | Type | Description |
|-----|------|-------------|
| `slug` | `string` | The organization's slug |

**Returns:** `{ _id, _creationTime, name, slug, logo, metadata, ownerId } | null`

---

#### `createOrganization` (mutation)

Create a new organization. The authenticated user is assigned the `creatorRole` (default `"owner"`). Triggers `onOrganizationCreated` callback. The creator's role is synced to authz.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | `string` | Yes | Organization name |
| `slug` | `string` | No | URL-safe slug (auto-generated from name if omitted) |
| `logo` | `string` | No | Logo URL |
| `metadata` | `any` | No | Custom metadata |

**Returns:** `string` — the new organization's ID.

**Throws:** `"Not authenticated"` if unauthenticated.

---

#### `updateOrganization` (mutation)

Update an organization's details. Requires `organizations:update` permission (configurable via permission map).

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization to update |
| `name` | `string` | No | New name |
| `slug` | `string` | No | New slug |
| `logo` | `string \| null` | No | New logo URL, or `null` to remove |
| `metadata` | `any` | No | New metadata |

**Returns:** `void`

---

#### `deleteOrganization` (mutation)

Delete an organization and all its members, teams, and invitations. Requires `organizations:delete` permission (configurable via permission map). Triggers `onOrganizationDeleted` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization to delete |

**Returns:** `void`

---

### Member Functions

#### `listMembers` (query)

List all members of an organization. If `getUser` is configured, each member is enriched with `user: { name?, email? }`.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization to list members for |

**Returns:** `Array<{ _id, _creationTime, organizationId, userId, role, user? }>`

---

#### `getMember` (query)

Get a specific member by organization and user ID. Enriched with `user` if `getUser` is configured.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `userId` | `string` | The user ID to look up |

**Returns:** `{ _id, _creationTime, organizationId, userId, role, user? } | null`

---

#### `getCurrentMember` (query)

Get the authenticated user's membership in an organization.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |

**Returns:** `{ _id, _creationTime, organizationId, userId, role } | null` — `null` if unauthenticated or not a member.

---

#### `addMember` (mutation)

Add a user to an organization with a given role. Requires `members:add` permission (configurable via permission map). The role is synced to authz. Triggers `onMemberAdded` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to add |
| `role` | `string` | Role to assign (must match a role in your `authz.ts`) |

**Returns:** `void`

---

#### `removeMember` (mutation)

Remove a member from an organization. Requires `members:remove` permission. The structural owner (`ownerId`) cannot be removed. Role is revoked from authz. Triggers `onMemberRemoved` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to remove |

**Returns:** `void`

---

#### `updateMemberRole` (mutation)

Change a member's role. Requires `members:updateRole` permission (configurable via permission map). Old role is revoked and new role is assigned in authz. Triggers `onMemberRoleChanged` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to update |
| `role` | `string` | New role (must match a role in your `authz.ts`) |

**Returns:** `void`

---

#### `leaveOrganization` (mutation)

Leave an organization. The structural owner (`ownerId`) cannot leave unless another member holds the same `creatorRole`. Role is revoked from authz. Triggers `onMemberLeft` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization to leave |

**Returns:** `void`

---

### Team Functions

#### `listTeams` (query)

List all teams in an organization.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |

**Returns:** `Array<{ _id, _creationTime, name, organizationId, description }>`

---

#### `getTeam` (query)

Get a team by its ID.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |

**Returns:** `{ _id, _creationTime, name, organizationId, description } | null`

---

#### `listTeamMembers` (query)

List all members of a team. If `getUser` is configured, each member is enriched with `user: { name?, email? }`.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |

**Returns:** `Array<{ _id, _creationTime, teamId, userId, user? }>`

---

#### `isTeamMember` (query)

Check if the authenticated user is a member of a team.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |

**Returns:** `boolean` — `false` if unauthenticated.

---

#### `createTeam` (mutation)

Create a new team in an organization. Requires `teams:create` permission (configurable via permission map). Triggers `onTeamCreated` callback.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID |
| `name` | `string` | Yes | Team name |
| `description` | `string` | No | Team description |

**Returns:** `string` — the new team's ID.

---

#### `updateTeam` (mutation)

Update a team's name or description. Requires `teams:update` permission (configurable via permission map).

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `teamId` | `string` | Yes | The team ID |
| `name` | `string` | No | New name |
| `description` | `string \| null` | No | New description, or `null` to remove |

**Returns:** `void`

---

#### `deleteTeam` (mutation)

Delete a team and all its memberships. Requires `teams:delete` permission (configurable via permission map). Triggers `onTeamDeleted` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team to delete |

**Returns:** `void`

---

#### `addTeamMember` (mutation)

Add a member to a team. The user must already be a member of the organization. Requires `teams:addMember` permission (configurable via permission map). Triggers `onTeamMemberAdded` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |
| `memberUserId` | `string` | The user ID to add |

**Returns:** `void`

---

#### `removeTeamMember` (mutation)

Remove a member from a team. Requires `teams:removeMember` permission (configurable via permission map). Triggers `onTeamMemberRemoved` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |
| `memberUserId` | `string` | The user ID to remove |

**Returns:** `void`

---

### Invitation Functions

#### `listInvitations` (query)

List all invitations for an organization (all statuses).

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |

**Returns:** `Array<{ _id, _creationTime, organizationId, email, role, teamId, inviterId, status, expiresAt, isExpired }>`

---

#### `getInvitation` (query)

Get a single invitation by its ID.

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation ID |

**Returns:** `{ _id, _creationTime, organizationId, email, role, teamId, inviterId, status, expiresAt, isExpired } | null`

---

#### `getPendingInvitations` (query)

Get all pending (non-expired) invitations for an email address.

| Arg | Type | Description |
|-----|------|-------------|
| `email` | `string` | The email address |

**Returns:** `Array<{ _id, _creationTime, organizationId, email, role, teamId, inviterId, expiresAt, isExpired }>`

---

#### `inviteMember` (mutation)

Create an invitation to join an organization. Requires `invitations:create` permission (configurable via permission map). Triggers `onInvitationCreated` callback if configured.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID |
| `email` | `string` | Yes | Email to invite |
| `role` | `string` | Yes | Role to assign upon acceptance (must match a role in `authz.ts`) |
| `teamId` | `string` | No | Team to add the user to upon acceptance |

**Returns:** `{ invitationId: string, email: string, expiresAt: number }`

---

#### `acceptInvitation` (mutation)

Accept a pending invitation. The authenticated user is added to the organization with the invited role. Triggers `onInvitationAccepted` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation to accept |

**Returns:** `void`

---

#### `resendInvitation` (mutation)

Resend an invitation (resets expiration). Requires `invitations:resend` permission (configurable via permission map). Triggers `onInvitationResent` callback if configured.

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation to resend |

**Returns:** `{ invitationId: string, email: string }`

---

#### `cancelInvitation` (mutation)

Cancel a pending invitation. Requires `invitations:cancel` permission (configurable via permission map).

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation to cancel |

**Returns:** `void`

---

### Authorization Functions

These functions are powered by `@djpanda/convex-authz` and are automatically included in the `makeTenantsAPI()` return value.

#### `checkPermission` (query)

Check if the authenticated user has a specific permission in an organization.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `permission` | `string` | Permission to check (e.g. `"organizations:update"`) |

**Returns:** `{ allowed: boolean, reason: string }`

---

#### `getUserPermissions` (query)

Get all effective permissions for the authenticated user in an organization.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |

**Returns:** Effective permission set from `@djpanda/convex-authz`.

---

#### `getUserRoles` (query)

Get all roles assigned to the authenticated user, optionally scoped to an organization.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | No | Scope to a specific organization |

**Returns:** Role assignments from `@djpanda/convex-authz`.

---

#### `grantPermission` (mutation)

Grant a direct permission override to a user. Requires `permissions:grant` permission (configurable via permission map).

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID (used for authorization check) |
| `targetUserId` | `string` | Yes | User to grant the permission to |
| `permission` | `string` | Yes | Permission to grant |
| `scope` | `{ type, id }` | No | Optional scope (defaults to organization scope) |
| `reason` | `string` | No | Audit reason |
| `expiresAt` | `number` | No | Expiration timestamp |

**Returns:** `string` — the permission override ID.

---

#### `denyPermission` (mutation)

Deny a permission for a user (explicit override). Requires `permissions:deny` permission (configurable via permission map).

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID (used for authorization check) |
| `targetUserId` | `string` | Yes | User to deny the permission for |
| `permission` | `string` | Yes | Permission to deny |
| `scope` | `{ type, id }` | No | Optional scope (defaults to organization scope) |
| `reason` | `string` | No | Audit reason |
| `expiresAt` | `number` | No | Expiration timestamp |

**Returns:** `string` — the permission override ID.

---

#### `getAuditLog` (query)

Get audit log entries from the authz component.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `userId` | `string` | No | Filter by user |
| `action` | `string` | No | Filter by action type |
| `limit` | `number` | No | Max entries to return |

**Returns:** Audit log entries from `@djpanda/convex-authz`.

---

## Permission Map

Every guarded mutation checks a permission string via `@djpanda/convex-authz` before executing. The default mapping is:

| Operation | Default Permission |
|-----------|-------------------|
| `updateOrganization` | `organizations:update` |
| `deleteOrganization` | `organizations:delete` |
| `addMember` | `members:add` |
| `removeMember` | `members:remove` |
| `updateMemberRole` | `members:updateRole` |
| `createTeam` | `teams:create` |
| `updateTeam` | `teams:update` |
| `deleteTeam` | `teams:delete` |
| `addTeamMember` | `teams:addMember` |
| `removeTeamMember` | `teams:removeMember` |
| `inviteMember` | `invitations:create` |
| `resendInvitation` | `invitations:resend` |
| `cancelInvitation` | `invitations:cancel` |
| `grantPermission` | `permissions:grant` |
| `denyPermission` | `permissions:deny` |

You can override any of these in the `permissionMap` option:

```typescript
makeTenantsAPI(components.tenants, {
  authz,
  auth: ...,
  permissionMap: {
    // Use a coarser permission for all team mutations
    createTeam: "teams:manage",
    updateTeam: "teams:manage",
    deleteTeam: "teams:manage",
    addTeamMember: "teams:manage",
    removeTeamMember: "teams:manage",

    // Skip the permission check entirely for this operation
    updateOrganization: false,
  },
});
```

The `TENANTS_PERMISSIONS` and `TENANTS_ROLES` exports provide a set of permissions and roles that cover all default operations. You can import and extend them in your `authz.ts`, or define your own from scratch.

---

## Flexible Roles

Roles in `@djpanda/convex-tenants` are **plain strings** — not a hardcoded enum. You define exactly which roles exist and what permissions each role has in your `authz.ts` file.

### Customizing Roles

The default `TENANTS_ROLES` provides `owner`, `admin`, and `member` roles. But you can:

**Add new roles:**

```typescript
const roles = defineRoles(permissions, TENANTS_ROLES, {
  billing_admin: {
    organizations: ["read"],
    billing: ["manage", "view", "export"],
  },
  viewer: {
    organizations: ["read"],
    members: ["list"],
  },
});
```

**Remove default roles** by defining roles from scratch (without `TENANTS_ROLES`):

```typescript
const roles = defineRoles(permissions, {
  admin: {
    organizations: ["create", "read", "update", "delete"],
    members: ["add", "remove", "updateRole", "list"],
    teams: ["create", "update", "delete", "addMember", "removeMember", "list"],
    invitations: ["create", "cancel", "resend", "list"],
  },
  member: {
    organizations: ["read"],
    members: ["list"],
    teams: ["list"],
    invitations: ["list"],
  },
});
```

**Change the creator role:**

```typescript
makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: "admin", // New orgs assign "admin" instead of "owner"
  // ...
});
```

### Structural Owner

Each organization has a structural `ownerId` field set to the user who created it. This is a **data integrity constraint**, not an authorization check:

- The structural owner cannot be removed from the organization
- The structural owner cannot leave unless another member holds the `creatorRole`

This ensures every organization always has at least one member. All permission-based authorization (who can update, who can delete, etc.) is handled entirely by `@djpanda/convex-authz`.

---

## React UI Components

The package includes pre-built React components for common tenant management UI patterns. These components are built with [shadcn/ui](https://ui.shadcn.com) (Radix UI + Tailwind CSS) and ship with default `lucide-react` icons. They are fully accessible, support dark mode via CSS variables, and automatically adopt your app's theme.

### Theming

The components use shadcn/ui CSS variables for theming. If your app already uses shadcn/ui, the tenant components will automatically match your theme. If not, add the CSS variables to your root stylesheet:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
  }
}
```

> **Tip:** If you use `npx shadcn@latest init` in your project, these variables are set up for you automatically.

### Import

```tsx
import {
  // Components
  OrganizationSwitcher,
  InviteMemberDialog,
  CreateOrganizationDialog,
  CreateTeamDialog,
  MembersTable,
  MembersSection,
  TeamsGrid,
  TeamsSection,
  AcceptInvitation,
  // Hooks
  useOrganization,
  useMembers,
  useInvitations,
  useTeams,
  useInvitation,
  // Store
  useOrganizationStore,
  // Utilities
  cn,
  generateSlugFromName,
} from "@djpanda/convex-tenants/react";
```

### OrganizationSwitcher

A Popover-based dropdown for switching between organizations with the ability to create new ones. Icons are included by default.

```tsx
import { OrganizationSwitcher } from "@djpanda/convex-tenants/react";

// With TenantsProvider (recommended) — no props needed
<TenantsProvider api={api.tenants}>
  <OrganizationSwitcher />
</TenantsProvider>

// Standalone
<OrganizationSwitcher
  organizations={organizations}
  currentOrganization={currentOrganization}
  onSwitchOrganization={handleSwitch}
  onCreateOrganization={handleCreate}
/>
```

### InviteMemberDialog

A dialog for inviting new members to an organization. Uses shadcn Dialog, Input, Select, and Label.

```tsx
import { InviteMemberDialog } from "@djpanda/convex-tenants/react";

<InviteMemberDialog
  organizationName="Acme Inc"
  teams={teams}
  onInvite={handleInvite}
  onToast={(msg, type) => toast(msg)}
/>
```

### MembersTable

A table for displaying and managing organization members and invitations. Uses shadcn Table, DropdownMenu, Select, and Badge.

```tsx
import { MembersTable } from "@djpanda/convex-tenants/react";

<MembersTable
  members={members}
  invitations={invitations}
  teams={teams}
  isOwner={isOwner}
  isOwnerOrAdmin={isOwnerOrAdmin}
  onRemoveMember={handleRemoveMember}
  onUpdateMemberRole={handleUpdateRole}
  onResendInvitation={handleResend}
  onCancelInvitation={handleCancel}
/>
```

### MembersSection / TeamsSection

Complete section components that combine headers, tables/grids, and dialogs. Must be used within a `TenantsProvider`.

```tsx
import { MembersSection, TeamsSection } from "@djpanda/convex-tenants/react";

<TenantsProvider api={api.tenants}>
  <MembersSection />
  <TeamsSection onTeamClick={(team) => navigate(`/teams/${team._id}`)} />
</TenantsProvider>
```

### TeamsGrid

A card grid for displaying teams in an organization. Uses shadcn Card and Badge.

```tsx
import { TeamsGrid, CreateTeamDialog } from "@djpanda/convex-tenants/react";

<TeamsGrid
  teams={teams}
  isOwnerOrAdmin={isOwnerOrAdmin}
  onDeleteTeam={handleDeleteTeam}
  emptyAction={
    <CreateTeamDialog
      organizationName="Acme Inc"
      onCreateTeam={handleCreateTeam}
    />
  }
/>
```

### AcceptInvitation

A page component for accepting organization invitations. Uses shadcn Card and Button, with default lucide-react icons.

```tsx
import { AcceptInvitation, useInvitation } from "@djpanda/convex-tenants/react";

function AcceptInvitationPage({ invitationId }) {
  const {
    invitation,
    organization,
    isLoading,
    isAccepting,
    accepted,
    error,
    acceptInvitation,
  } = useInvitation({
    invitationId,
    getInvitationQuery: api.tenants.getInvitation,
    getOrganizationQuery: api.tenants.getOrganization,
    acceptInvitationMutation: api.tenants.acceptInvitation,
  });

  return (
    <AcceptInvitation
      invitation={invitation}
      organizationName={organization?.name}
      isLoading={isLoading}
      isAuthenticated={!!currentUser}
      isAccepting={isAccepting}
      accepted={accepted}
      error={error}
      onAccept={acceptInvitation}
      onDecline={() => navigate("/")}
      onNavigateToLogin={() => navigate("/login")}
      onNavigateHome={() => navigate("/")}
    />
  );
}
```

### Customizing Icons

All components include default icons from `lucide-react`. You can override any icon via props:

```tsx
import { CustomIcon } from "my-icon-library";

<OrganizationSwitcher
  buildingIcon={<CustomIcon name="building" />}
  plusIcon={<CustomIcon name="plus" />}
/>
```

### Organization Store

A hook for managing the active organization state, persisted in a cookie (`tenants-active-org`) for SSR compatibility. Uses React's built-in `useSyncExternalStore` — no external dependencies.

```tsx
import { useOrganizationStore } from "@djpanda/convex-tenants/react";

function MyComponent() {
  const { activeOrganizationId, setActiveOrganizationId, clearActiveOrganization } = useOrganizationStore();

  return (
    <button onClick={() => setActiveOrganizationId("org_123")}>
      Switch to Org
    </button>
  );
}
```

Reading the cookie server-side (e.g. Next.js middleware):

```ts
const activeOrgId = request.cookies.get("tenants-active-org")?.value;
```

## Exported Constants

The package exports several constants to help you set up authorization:

| Export | Description |
|--------|-------------|
| `TENANTS_PERMISSIONS` | Default permissions for all tenants operations. Pass to `definePermissions()` from `@djpanda/convex-authz`. |
| `TENANTS_ROLES` | Default roles (`owner`, `admin`, `member`) with appropriate permissions. Pass to `defineRoles()` from `@djpanda/convex-authz`. |
| `DEFAULT_TENANTS_PERMISSION_MAP` | Maps operation names to permission strings. Use to inspect or extend the default mapping. |
| `TENANTS_REQUIRED_PERMISSIONS` | Flat list of all permission strings used by default operations. Useful for validation. |

## License

MIT
