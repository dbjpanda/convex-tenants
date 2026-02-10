# React UI Components

The package includes pre-built React components for common tenant management UI patterns. They are built with [shadcn/ui](https://ui.shadcn.com) (Radix UI + Tailwind CSS) and ship with default `lucide-react` icons. They are fully accessible, support dark mode via CSS variables, and adopt your app's theme.

## Theming

Components use shadcn/ui CSS variables. If your app already uses shadcn/ui, tenant components will match. Otherwise add the CSS variables to your root stylesheet (see [shadcn theming](https://ui.shadcn.com/docs/theming)). If you use `npx shadcn@latest init`, variables are set up automatically.

## Import

```tsx
import {
  OrganizationSwitcher,
  InviteMemberDialog,
  CreateOrganizationDialog,
  CreateTeamDialog,
  MembersTable,
  MembersSection,
  TeamsGrid,
  TeamsSection,
  AcceptInvitation,
  useOrganization,
  useMembers,
  useMembersPaginated,
  useInvitations,
  useInvitationsPaginated,
  useTeams,
  useTeamsPaginated,
  useInvitation,
  useOrganizationStore,
  configureOrganizationStore,
  cn,
  generateSlugFromName,
} from "@djpanda/convex-tenants/react";
```

For active-organization persistence and a custom storage key, see [Organization Store](organization-store.md).

## Paginated hooks

For large lists, use the paginated hooks with Convex’s cursor-based pagination. They wrap `usePaginatedQuery` and expose `results`, `status`, `loadMore`, and `isLoading`, plus the same mutations as the non-paginated hooks.

- **`useMembersPaginated`** — Pass `listMembersPaginatedQuery` (e.g. `api.tenants.listMembersPaginated`), `organizationId`, optional `initialNumItems`, and the same member mutations as `useMembers`. Returns `{ members, status, loadMore, isLoading, removeMember, updateMemberRole }`.
- **`useTeamsPaginated`** — Same pattern with `listTeamsPaginatedQuery` and team mutations. Returns `{ teams, status, loadMore, isLoading, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember }`.
- **`useInvitationsPaginated`** — Same pattern with `listInvitationsPaginatedQuery`. Returns `{ invitations, status, loadMore, isLoading, inviteMember, resendInvitation, cancelInvitation }`.

Use `status === "CanLoadMore"` to show a “Load more” button and call `loadMore(n)` to fetch the next page. See [Convex pagination](https://docs.convex.dev/database/pagination).

## TenantsProvider and context

When using the pre-built sections, wrap your app (or tenant area) in `TenantsProvider` so components receive the API and current org from context. The provider also exposes **organization actions** on the context: `updateOrganization`, `deleteOrganization`, `leaveOrganization`, plus member, team, and invitation actions.

```tsx
<TenantsProvider api={api.tenants}>
  <MembersSection />
  <TeamsSection />
</TenantsProvider>
```

## OrganizationSwitcher

Popover dropdown for switching organizations and creating new ones.

```tsx
// With TenantsProvider — no props needed
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

## InviteMemberDialog

Dialog for inviting members. Supports optional `message` and `teamId`.

```tsx
<InviteMemberDialog
  organizationName="Acme Inc"
  teams={teams}
  onInvite={handleInvite}
  onToast={(msg, type) => toast(msg)}
/>
```

## MembersTable

Table for members and invitations with role updates, remove, resend, cancel.

```tsx
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

## MembersSection / TeamsSection

Full sections (header + table/grid + dialogs). Use inside `TenantsProvider`.

```tsx
<TenantsProvider api={api.tenants}>
  <MembersSection />
  <TeamsSection onTeamClick={(team) => navigate(`/teams/${team._id}`)} />
</TenantsProvider>
```

## TeamsGrid

Card grid for teams with optional create/delete.

```tsx
<TeamsGrid
  teams={teams}
  isOwnerOrAdmin={isOwnerOrAdmin}
  onDeleteTeam={handleDeleteTeam}
  emptyAction={<CreateTeamDialog organizationName="Acme Inc" onCreateTeam={handleCreateTeam} />}
/>
```

## AcceptInvitation

Page component for accepting an invitation. Use with `useInvitation`:

```tsx
function AcceptInvitationPage({ invitationId }) {
  const { invitation, organization, isLoading, isAccepting, accepted, error, acceptInvitation } =
    useInvitation({
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

## Customizing icons

Override default `lucide-react` icons via props:

```tsx
<OrganizationSwitcher
  buildingIcon={<CustomIcon name="building" />}
  plusIcon={<CustomIcon name="plus" />}
/>
```
