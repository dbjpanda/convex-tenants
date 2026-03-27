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
  useOrganizationInvitations,
  useTeams,
  useAcceptInvitation,
  useOrganizationStore,
  configureOrganizationStore,
  cn,
  generateSlugFromName,
} from "@djpanda/convex-tenants/react";
```

For active-organization persistence and a custom storage key, see [Organization Store](organization-store.md).

## Pagination

For large lists, pass `pagination: { initialNumItems?: number }` to `useMembers`, `useTeams`, or `useOrganizationInvitations`. The hook uses `usePaginatedQuery` and returns `status`, `loadMore`, and the same mutations.

- **`useMembers({ ..., pagination: { initialNumItems: 20 } })`** — Returns `{ members, status, loadMore, isLoading, removeMember, updateMemberRole }`.
- **`useTeams({ ..., pagination: { initialNumItems: 20 } })`** — Returns `{ teams, status, loadMore, isLoading, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember }`.
- **`useOrganizationInvitations({ ..., pagination: { initialNumItems: 20 } })`** — Returns `{ invitations, status, loadMore, isLoading, inviteMember, resendInvitation, cancelInvitation }`.

Use `status === "CanLoadMore"` to show a “Load more” button and call `loadMore(n)` to fetch the next page. See [Convex pagination](https://docs.convex.dev/database/pagination).

## TenantsProvider and context

When using the pre-built sections, wrap your app (or tenant area) in `TenantsProvider` so components receive the API and current org from context. The provider also exposes **organization actions** on the context: `updateOrganization`, `deleteOrganization`, `leaveOrganization`, plus member, team, and invitation actions.

If your API includes `getCurrentUserEmail`, the provider calls it and exposes **`currentUserEmail`** on the context (`string | null | undefined`). Components like `JoinByDomainSection` use this so you do not need to pass the current user's email from a separate auth query.

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

Page component for accepting an invitation. Use with `useAcceptInvitation`:

```tsx
function AcceptInvitationPage({ invitationId }) {
  const { invitation, organization, isLoading, isAccepting, accepted, error, acceptInvitation } =
    useAcceptInvitation({
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

---

## Component prop reference

### OrganizationSwitcher

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `organizations` | `Organization[]` | from context | List of organizations. Optional when inside `TenantsProvider`. |
| `currentOrganization` | `Organization \| null` | from context | Currently active organization. Optional when inside `TenantsProvider`. |
| `isLoading` | `boolean` | from context | Loading state. |
| `onSwitchOrganization` | `(organizationId: string) => void` | from context | Callback when switching organization. |
| `onCreateOrganization` | `(data: { name: string; slug: string }) => Promise<void>` | from context | Callback when creating a new organization. |
| `className` | `string` | — | Custom class name for the root trigger button. |
| `buildingIcon` | `ReactNode` | `<Building2 />` | Custom building/organization icon. |
| `checkIcon` | `ReactNode` | `<Check />` | Custom check mark icon. |
| `chevronsIcon` | `ReactNode` | `<ChevronsUpDown />` | Custom chevrons icon. |
| `plusIcon` | `ReactNode` | `<Plus />` | Custom plus icon. |

### AcceptInvitation

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `invitation` | `Invitation \| null` | **required** | The invitation data. When `null`, shows "not found" state. |
| `organizationName` | `string` | — | Organization name to display. |
| `isLoading` | `boolean` | `false` | Whether the invitation data is loading. |
| `isAuthenticated` | `boolean` | `false` | Whether the user is signed in. When `false`, shows "sign in" prompt. |
| `isAccepting` | `boolean` | `false` | Whether the accept action is in progress. |
| `accepted` | `boolean` | `false` | Whether the invitation was accepted. Shows success state. |
| `error` | `string \| null` | — | Error message to display. Shows error state with retry button. |
| `onAccept` | `() => Promise<void>` | **required** | Callback when the user clicks Accept. |
| `onDecline` | `() => void` | **required** | Callback when the user clicks Decline. |
| `onNavigateToLogin` | `() => void` | **required** | Callback to navigate to login page (shown when unauthenticated). |
| `onNavigateHome` | `() => void` | **required** | Callback to navigate home (shown on not-found and error states). |
| `className` | `string` | — | Custom class name for the outer wrapper. |
| `loadingIcon` | `ReactNode` | `<Loader2 />` | Custom loading spinner icon. |
| `checkIcon` | `ReactNode` | `<CheckCircle />` | Custom success check icon. |
| `errorIcon` | `ReactNode` | `<XCircle />` | Custom error icon. |
| `buildingIcon` | `ReactNode` | `<Building2 />` | Custom building icon for org details. |

### MembersTable

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `members` | `Member[]` | **required** | List of organization members. |
| `invitations` | `Invitation[]` | **required** | List of organization invitations. |
| `teams` | `Team[]` | — | List of teams (enables "Add to Team" dropdown). |
| `isLoading` | `boolean` | `false` | Shows skeleton loading state. |
| `isOwner` | `boolean` | `false` | Enables role selector dropdown for members. |
| `isOwnerOrAdmin` | `boolean` | `false` | Shows actions column (remove, resend, cancel). |
| `baseUrl` | `string` | `window.location.origin` | Base URL for invitation link generation. |
| `invitationPath` | `string` | `"/accept-invitation/:id"` | URL path pattern for invitation links. `:id` is replaced with the invitation ID. |
| `onRemoveMember` | `(memberUserId: string) => Promise<void>` | — | Callback to remove a member. |
| `onUpdateMemberRole` | `(memberUserId: string, role: string) => Promise<void>` | — | Callback to update a member's role. |
| `onAddToTeam` | `(userId: string, teamId: string) => Promise<void>` | — | Callback to add a member to a team. |
| `onResendInvitation` | `(invitationId: string) => Promise<void>` | — | Callback to resend a pending invitation. |
| `onCopyInvitationLink` | `(invitationId: string) => void` | built-in copy | Custom handler for copying invitation links. Overrides the default clipboard copy. |
| `onCancelInvitation` | `(invitationId: string) => Promise<void>` | — | Callback to cancel an invitation. |
| `onToast` | `(message: string, type: "success" \| "error") => void` | — | Toast notification callback. |
| `roles` | `string[]` | `["member", "admin", "owner"]` | Available roles for the role selector dropdown. |
| `className` | `string` | — | Custom class name. |
| `moreIcon` | `ReactNode` | `<MoreHorizontal />` | Custom "more" menu icon. |
| `userMinusIcon` | `ReactNode` | `<UserMinus />` | Custom remove-member icon. |
| `copyIcon` | `ReactNode` | `<Copy />` | Custom copy icon. |
| `checkIcon` | `ReactNode` | `<Check />` | Custom check icon (shown after copy). |
| `refreshIcon` | `ReactNode` | `<RefreshCw />` | Custom resend icon. |
| `cancelIcon` | `ReactNode` | `<XCircle />` | Custom cancel icon. |

### TeamsGrid

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `teams` | `Team[]` | **required** | List of teams to display. |
| `isLoading` | `boolean` | `false` | Shows skeleton loading state. |
| `isOwnerOrAdmin` | `boolean` | `false` | Enables delete button and empty-state action. |
| `onTeamClick` | `(team: Team) => void` | — | Callback when clicking a team card. Adds pointer cursor. |
| `onDeleteTeam` | `(teamId: string) => Promise<void>` | — | Callback to delete a team. |
| `emptyAction` | `ReactNode` | — | Custom element to show in empty state (e.g., a Create Team button). |
| `onToast` | `(message: string, type: "success" \| "error") => void` | — | Toast notification callback. |
| `className` | `string` | — | Custom class name for the grid container. |
| `usersIcon` | `ReactNode` | `<Users />` | Custom team/users icon. |
| `trashIcon` | `ReactNode` | `<Trash2 />` | Custom delete icon. |

### MembersSection

Full section component (header + table + invite dialog). Must be used inside `TenantsProvider`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Custom class name for the card. |
| `title` | `string` | `"Members & Invitations"` | Section heading text. |
| `showInviteButton` | `boolean` | `true` for owner/admin | Whether to show the "Invite Member" button. |
| `showTeamSelection` | `boolean` | `true` | Whether to show team selection in the invite dialog. |
| `showInvitationLink` | `boolean` | `true` | Whether to show the invitation link after creating an invitation. |
| `invitationPath` | `string` | `"/accept-invitation/:id"` | Custom invitation URL path pattern. `:id` is replaced with the invitation ID. |
| `expirationText` | `string` | `"48 hours"` | Text displayed for invitation expiration (informational only). |
| `usersIcon` | `ReactNode` | `<Users />` | Custom header icon. |
| `plusIcon` | `ReactNode` | `<Plus />` | Custom invite button icon. |
| `moreIcon` | `ReactNode` | — | Passed to inner `MembersTable`. |
| `userMinusIcon` | `ReactNode` | — | Passed to inner `MembersTable`. |
| `copyIcon` | `ReactNode` | — | Passed to inner `MembersTable` and `InviteMemberDialog`. |
| `checkIcon` | `ReactNode` | — | Passed to inner `MembersTable` and `InviteMemberDialog`. |
| `refreshIcon` | `ReactNode` | — | Passed to inner `MembersTable`. |
| `cancelIcon` | `ReactNode` | — | Passed to inner `MembersTable`. |
| `mailIcon` | `ReactNode` | — | Passed to inner `InviteMemberDialog`. |
| `linkIcon` | `ReactNode` | — | Passed to inner `InviteMemberDialog`. |

### TeamsSection

Full section component (header + grid + create dialog). Must be used inside `TenantsProvider`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Custom class name for the card. |
| `title` | `string` | `"Teams"` | Section heading text. |
| `showCreateButton` | `boolean` | `true` for owner/admin | Whether to show the "Create Team" button. |
| `onTeamClick` | `(team: Team) => void` | — | Callback when clicking a team card. |
| `usersIcon` | `ReactNode` | `<Users />` | Custom header icon. |
| `plusIcon` | `ReactNode` | `<Plus />` | Custom create button icon. |
| `trashIcon` | `ReactNode` | — | Passed to inner `TeamsGrid`. |

### BulkInviteSection

Renders a bulk invite form. Only visible when `bulkInviteMembers` is available on the API. Must be used inside `TenantsProvider`. This component accepts **no props** — it reads everything from `TenantsProvider` context.

### MemberModerationSection

Renders suspend/unsuspend controls and bulk-remove checkboxes. Only visible when `suspendMember` and `unsuspendMember` are available on the API. Must be used inside `TenantsProvider`. This component accepts **no props** — it reads everything from `TenantsProvider` context.

### NestedTeamsSection

Renders a tree view of nested teams and a form to create teams with optional parent. Only visible when `listTeamsAsTree` is available on the API. Must be used inside `TenantsProvider`. This component accepts **no props** — it reads everything from `TenantsProvider` context.

### OrgSettingsPanel

Renders organization settings: logo upload, name/slug/status editing, transfer ownership, leave, and delete (danger zone). Features are shown conditionally based on available API functions (`generateLogoUploadUrl`, `transferOwnership`, `getCurrentMember`). Must be used inside `TenantsProvider`. This component accepts **no props** — it reads everything from `TenantsProvider` context.

---

## Customizing icons

Override default `lucide-react` icons via props:

```tsx
<OrganizationSwitcher
  buildingIcon={<CustomIcon name="building" />}
  plusIcon={<CustomIcon name="plus" />}
/>
```
