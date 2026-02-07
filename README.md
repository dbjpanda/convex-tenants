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
npm install zustand clsx tailwind-merge
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

## React UI Components

The package includes pre-built React components for common tenant management UI patterns. These components are styled with Tailwind CSS and designed to be customizable.

### Import

```tsx
import {
  // Components
  OrganizationSwitcher,
  InviteMemberDialog,
  CreateTeamDialog,
  MembersTable,
  TeamsGrid,
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

A dropdown component for switching between organizations with the ability to create new ones.

```tsx
import { OrganizationSwitcher } from "@djpanda/convex-tenants/react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

function Header() {
  // ... your state and handlers

  return (
    <OrganizationSwitcher
      organizations={organizations}
      currentOrganization={currentOrganization}
      onSwitchOrganization={handleSwitch}
      onCreateOrganization={handleCreate}
      buildingIcon={<Building2 className="h-5 w-5" />}
      checkIcon={<Check className="h-4 w-4" />}
      chevronsIcon={<ChevronsUpDown className="h-4 w-4" />}
      plusIcon={<Plus className="h-4 w-4" />}
    />
  );
}
```

### InviteMemberDialog

A dialog for inviting new members to an organization.

```tsx
import { InviteMemberDialog } from "@djpanda/convex-tenants/react";
import { Mail, Copy, Link } from "lucide-react";

function MembersPage() {
  return (
    <InviteMemberDialog
      organizationName="Acme Inc"
      teams={teams}
      onInvite={handleInvite}
      onToast={(msg, type) => toast(msg)}
      mailIcon={<Mail className="h-4 w-4" />}
      copyIcon={<Copy className="h-4 w-4" />}
      linkIcon={<Link className="h-4 w-4" />}
    />
  );
}
```

### MembersTable

A table for displaying and managing organization members and invitations.

```tsx
import { MembersTable } from "@djpanda/convex-tenants/react";
import { MoreHorizontal, UserMinus, Copy, RefreshCw, XCircle } from "lucide-react";

function MembersPage() {
  return (
    <MembersTable
      members={members}
      invitations={invitations}
      teams={teams}
      isOwner={isOwner}
      isOwnerOrAdmin={isOwnerOrAdmin}
      onRemoveMember={handleRemoveMember}
      onUpdateMemberRole={handleUpdateRole}
      onAddToTeam={handleAddToTeam}
      onResendInvitation={handleResend}
      onCopyInvitationLink={handleCopyLink}
      onCancelInvitation={handleCancel}
      moreIcon={<MoreHorizontal className="h-4 w-4" />}
      userMinusIcon={<UserMinus className="h-4 w-4" />}
      copyIcon={<Copy className="h-4 w-4" />}
      refreshIcon={<RefreshCw className="h-4 w-4" />}
      cancelIcon={<XCircle className="h-4 w-4" />}
    />
  );
}
```

### TeamsGrid

A grid component for displaying teams in an organization.

```tsx
import { TeamsGrid, CreateTeamDialog } from "@djpanda/convex-tenants/react";
import { Users, Trash2, Plus } from "lucide-react";

function TeamsPage() {
  return (
    <TeamsGrid
      teams={teams}
      isOwnerOrAdmin={isOwnerOrAdmin}
      onDeleteTeam={handleDeleteTeam}
      usersIcon={<Users className="h-4 w-4" />}
      trashIcon={<Trash2 className="h-4 w-4" />}
      emptyAction={
        <CreateTeamDialog
          organizationName="Acme Inc"
          onCreateTeam={handleCreateTeam}
          plusIcon={<Plus className="h-4 w-4" />}
        />
      }
    />
  );
}
```

### AcceptInvitation

A page component for accepting organization invitations.

```tsx
import { AcceptInvitation, useInvitation } from "@djpanda/convex-tenants/react";
import { Loader2, CheckCircle, XCircle, Building2 } from "lucide-react";

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
      loadingIcon={<Loader2 className="h-8 w-8 animate-spin" />}
      checkIcon={<CheckCircle className="h-6 w-6" />}
      errorIcon={<XCircle className="h-6 w-6" />}
      buildingIcon={<Building2 className="h-8 w-8" />}
    />
  );
}
```

### Organization Store

A Zustand store for managing the active organization state (persisted in localStorage):

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

## API Reference

### Organization Functions

- `listOrganizations` - List all organizations the user belongs to
- `getOrganization` - Get organization by ID
- `getOrganizationBySlug` - Get organization by slug
- `createOrganization` - Create a new organization
- `updateOrganization` - Update organization name, slug, logo, metadata
- `deleteOrganization` - Delete an organization (owner only)

### Member Functions

- `listMembers` - List all members of an organization
- `getMember` - Get a specific member
- `getCurrentMember` - Get current user's membership
- `checkPermission` - Check if user has at least a certain role
- `addMember` - Add a member to an organization
- `removeMember` - Remove a member (cannot remove owners)
- `updateMemberRole` - Change a member's role (owner only)
- `leaveOrganization` - Leave an organization

### Team Functions

- `listTeams` - List all teams in an organization
- `getTeam` - Get team by ID
- `listTeamMembers` - List all members of a team
- `isTeamMember` - Check if current user is a team member
- `createTeam` - Create a new team
- `updateTeam` - Update team name and description
- `deleteTeam` - Delete a team
- `addTeamMember` - Add a member to a team
- `removeTeamMember` - Remove a member from a team

### Invitation Functions

- `listInvitations` - List all invitations for an organization
- `getInvitation` - Get invitation by ID
- `getPendingInvitations` - Get pending invitations for an email
- `inviteMember` - Create a new invitation
- `acceptInvitation` - Accept an invitation
- `resendInvitation` - Resend an invitation
- `cancelInvitation` - Cancel an invitation

## License

MIT
