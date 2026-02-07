# @djpanda/convex-tenants

A multi-tenant organization and team management component for [Convex](https://convex.dev) with built-in authorization via `@djpanda/convex-authz`.

## Features

- **Organizations**: Create, update, delete organizations with unique slugs
- **Members**: Add, remove, update member roles (owner, admin, member)
- **Teams**: Create teams within organizations and manage team membership
- **Invitations**: Invite users by email with customizable expiration
- **Built-in Authorization**: Automatic role and permission sync via the authz child component
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

### 1. Configure the component

In your `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config";

const app = defineApp();
app.use(tenants);
// Note: authz is automatically included as a child of tenants

export default app;
```

### 2. Create your tenants API

In your `convex/tenants.ts`:

```typescript
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// All APIs are auto-exported in a single destructure — no userId passed from client!
export const {
  // Organizations
  listOrganizations, getOrganization, getOrganizationBySlug,
  createOrganization, updateOrganization, deleteOrganization,
  // Members
  listMembers, getMember, getCurrentMember, checkPermission,
  addMember, removeMember, updateMemberRole, leaveOrganization,
  // Teams
  listTeams, getTeam, listTeamMembers, isTeamMember,
  createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
  // Invitations
  listInvitations, getInvitation, getPendingInvitations,
  inviteMember, acceptInvitation, resendInvitation, cancelInvitation,
} = makeTenantsAPI(components.tenants, {
  auth: async (ctx) => {
    return await getAuthUserId(ctx);
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

### 3. Use in your React app

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
  // Required: returns the authenticated user's ID, or null if unauthenticated
  auth: (ctx) => Promise<string | null>,

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

Get a single organization by its ID.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization's ID |

**Returns:** `{ _id, _creationTime, name, slug, logo, metadata, ownerId } | null`

---

#### `getOrganizationBySlug` (query)

Get a single organization by its unique slug.

| Arg | Type | Description |
|-----|------|-------------|
| `slug` | `string` | The organization's slug |

**Returns:** `{ _id, _creationTime, name, slug, logo, metadata, ownerId } | null`

---

#### `createOrganization` (mutation)

Create a new organization. The authenticated user becomes the owner. Triggers `onOrganizationCreated` callback.

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

Update an organization's details. Requires admin or owner role.

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

Delete an organization and all its members, teams, and invitations. Owner only. Triggers `onOrganizationDeleted` callback.

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

#### `checkPermission` (query)

Check if the authenticated user has at least a certain role in an organization.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `minRole` | `"member" \| "admin" \| "owner"` | Minimum required role |

**Returns:** `{ hasPermission: boolean, currentRole: "owner" | "admin" | "member" | null }`

---

#### `addMember` (mutation)

Add a user to an organization. Requires admin or owner role. Triggers `onMemberAdded` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to add |
| `role` | `"admin" \| "member"` | Role to assign |

**Returns:** `void`

---

#### `removeMember` (mutation)

Remove a member from an organization. Cannot remove owners. Triggers `onMemberRemoved` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to remove |

**Returns:** `void`

---

#### `updateMemberRole` (mutation)

Change a member's role. Owner only. Triggers `onMemberRoleChanged` callback (includes `oldRole` and `newRole`).

| Arg | Type | Description |
|-----|------|-------------|
| `organizationId` | `string` | The organization ID |
| `memberUserId` | `string` | The user ID to update |
| `role` | `"owner" \| "admin" \| "member"` | New role |

**Returns:** `void`

---

#### `leaveOrganization` (mutation)

Leave an organization. Owners cannot leave (must transfer ownership first). Triggers `onMemberLeft` callback.

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

Create a new team in an organization. Requires admin or owner role. Triggers `onTeamCreated` callback.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID |
| `name` | `string` | Yes | Team name |
| `description` | `string` | No | Team description |

**Returns:** `string` — the new team's ID.

---

#### `updateTeam` (mutation)

Update a team's name or description. Requires admin or owner role.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `teamId` | `string` | Yes | The team ID |
| `name` | `string` | No | New name |
| `description` | `string \| null` | No | New description, or `null` to remove |

**Returns:** `void`

---

#### `deleteTeam` (mutation)

Delete a team and all its memberships. Requires admin or owner role. Triggers `onTeamDeleted` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team to delete |

**Returns:** `void`

---

#### `addTeamMember` (mutation)

Add a member to a team. The user must already be a member of the organization. Triggers `onTeamMemberAdded` callback.

| Arg | Type | Description |
|-----|------|-------------|
| `teamId` | `string` | The team ID |
| `memberUserId` | `string` | The user ID to add |

**Returns:** `void`

---

#### `removeTeamMember` (mutation)

Remove a member from a team. Triggers `onTeamMemberRemoved` callback.

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

Create an invitation to join an organization. Requires admin or owner role. Triggers `onInvitationCreated` callback if configured.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `organizationId` | `string` | Yes | The organization ID |
| `email` | `string` | Yes | Email to invite |
| `role` | `"admin" \| "member"` | Yes | Role to assign upon acceptance |
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

Resend an invitation (resets expiration). Requires admin or owner role. Triggers `onInvitationResent` callback if configured.

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation to resend |

**Returns:** `{ invitationId: string, email: string }`

---

#### `cancelInvitation` (mutation)

Cancel a pending invitation. Requires admin or owner role.

| Arg | Type | Description |
|-----|------|-------------|
| `invitationId` | `string` | The invitation to cancel |

**Returns:** `void`

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
<TenantsProvider api={api.example}>
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

<TenantsProvider api={api.example}>
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

## Role Hierarchy

The tenants component uses a role hierarchy for permission checks:

- **owner**: Full control, can delete organization, transfer ownership
- **admin**: Can manage members, teams, invitations, and settings
- **member**: Basic read access to organization resources

## Authorization Integration

The tenants component automatically syncs roles and team memberships to the authz child component:

- When a user joins an organization, their role is assigned in authz with organization scope
- When a user's role changes, the authz role is updated
- When a user joins/leaves a team, the team membership is synced as a ReBAC relationship

This means you can use the authz component for fine-grained permission checks:

```typescript
// Check via the authz child component
const isAdmin = await ctx.runQuery(
  components.tenants.authz.rebac.hasDirectRelation,
  {
    subjectType: "user",
    subjectId: userId,
    relation: "admin",
    objectType: "organization",
    objectId: organizationId,
  }
);
```

## License

MIT
