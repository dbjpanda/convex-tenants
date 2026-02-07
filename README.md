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
