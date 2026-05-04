# Changelog

## 0.3.0

### Upgrade action required
- **Existing deployments must run `authz.syncRoles()` after upgrading.** The default `member` role now grants `members:["list"]` and `teams:["list", "listMembers"]`. Without a sync, existing members will see stale permissions and be unable to view the org member or team lists.

### Added
- **Invitation decline flow.** New `"declined"` status on the `invitations` schema, `declineInvitation` component mutation, `Tenants` class + `makeTenantsAPI` passthrough, `useAcceptInvitation` hook now exposes `isDeclining`, `declined`, and a `declineInvitation` callback, and `invitation-accept` UI renders a Declining... state and a declined-success card.
- **Members table status filter.** Replaces the old "members | invitations" toggle with active/suspended/pending. Suspended members render with a red badge. Non-pending invitations are suppressed from the unified view (the member record is the source of truth once accepted).
- **Optional `syncRole` / `syncRoles` on `AuthzClient` interface** for post-deploy permission rebuild. Documented in `CLAUDE.md` and `example/convex/authz.ts`.

### Changed
- **Default `member` role broadened** to include `members:["list"]` and `teams:["list", "listMembers"]` so new members can see the org member and team lists out of the box. See "Upgrade action required" above.
- **Peer dependency:** `@djpanda/convex-authz` bumped from `^2.1.1` to `^2.3.0` (required for `syncRole` / `syncRoles`).

### Fixed
- `TenantsProvider` was passing no `status` arg to `api.listMembers`, so the server-side default of `"active"` filtered suspended members out before they reached the table. Provider now passes `status: "all"` and the table partitions client-side.
- Members table filter now correctly partitions active / suspended / pending in the unified view.

## 0.2.0

### Breaking changes
- **`generateLogoUploadUrl` now requires `organizationId`.** Previously optional; upload URLs are now always scoped to an org membership check.
- **`listUserOrganizations` defaults to `status: "active"`.** Previously returned all memberships regardless of status. Pass `status: "all"` to get the legacy behavior. Legacy rows where `status === undefined` are still treated as active.
- **React: `TenantsContext` export removed** from the providers barrel. Consumers must switch to `useTenants()` / `useTenantsData()` / `useTenantsActions()`, or import `TenantsDataContext` / `TenantsActionsContext` directly.

### Security
- **SEC-CRIT-1** Component `updateMemberRole` rejects self-escalation, non-admin/non-owner callers, suspended callers, and any attempt to grant the `owner` role (must use `transferOwnership`).
- **SEC-CRIT-3** `getAuditLog` now requires active membership and an active org.
- **SEC-HIGH-1** All team mutations (`updateTeam`, `deleteTeam`, `addTeamMember`, `updateTeamMemberRole`, `removeTeamMember`) require caller role `admin` or `owner` at the component layer.
- **SEC-HIGH-2** `getPendingInvitations` and `acceptInvitation` honor `identifierType: "email" | "phone" | "username"` with type-appropriate normalization. `getUser` callback signature widened to return `phoneNumber?` / `username?`.
- **SEC-HIGH-3** `checkMemberPermission` restricts inspection to self unless the caller holds `members:list`.
- **SEC-HIGH-4** (in progress) `acceptInvitation` now accepts a `trustedSkipToken` arg as a preparation for a future wrapper-only skip path. The legacy `skipIdentifierCheck: boolean` arg is still honored and marked `@deprecated`. Security posture is unchanged until the wrapper is migrated and the boolean is removed — this release does NOT close the direct-caller bypass.
- **SEC-MED-1** `getInvitationById` strips `inviterId`, `inviterName`, and `inviteeIdentifier` for unauthenticated callers.
- **SEC-MED-2** `resendInvitation` and `cancelInvitation` verify active-member status of the caller at the component layer.
- **SEC-MED-3** `createOrganization` and `updateOrganization` reject metadata larger than 10KB.
- **SEC-LOW-1** New `makeTenantsAPI` option `validRoles?: readonly string[]` enforces a role-string allowlist at the wrapper boundary on all role-setting mutations. Throws `ConvexError({ code: "FORBIDDEN" })` on mismatch.
- **SEC-LOW-2** `generateLogoUploadUrl` now takes a required `organizationId` and always runs `requireActiveMembership`.

### Performance / architecture
- **ARCH-CRIT-1** `deleteOrganization` now uses a two-phase soft-mark + async batch drain to avoid Convex transaction limits (~100 members / ~30 teams previously; now scales to whatever the cumulative drain tolerates).
- **ARCH-HIGH-2** New compound index `members.by_user_and_status`. `listUserOrganizations` accepts an optional `status` filter and uses the index for `"suspended"`; `"active"` and `"all"` use `by_user` + in-memory filtering so legacy rows with `status === undefined` remain visible.
- **ARCH-HIGH-3** Bulk operations (`bulkAddMembers`, `bulkRemoveMembers`, `bulkInviteMembers`) enforce a 100-item cap.
- **ARCH-HIGH-4** Component `updateOrganization` requires caller role `admin` or `owner`.
- **ARCH-MED-1** `returns` validators added to the majority of `makeTenantsAPI` query/mutation definitions (23 still use `v.any()` with `// TODO: tighten return validator`).
- **ARCH-MED-2** Non-paginated `listTeams` uses the `by_organization_and_parent` index when filtering by `parentTeamId` (was in-memory filter).
- **ARCH-MED-3** `listInvitations` accepts a `status` filter and uses the `by_organization_and_status` index.
- **ARCH-MED-4** `requireActiveOrganization` throws on missing org instead of silently returning (fail-closed).
- Dropped unused indexes: `organizations.by_status`, `invitations.by_status`, `invitations.by_invitee_identifier`.

### Features
- **New internal mutation** `pruneExpiredInvitations({ organizationId?, limit? })` — component `internalMutation` that marks pending invitations with `expiresAt < now` as `"expired"`. Consumers wire it into their own cron (see `docs/known-limitations.md` §6). The org-scoped path uses the `by_organization_and_status` index; the global path is a bounded `.take(limit)` scan and is best-effort (it can starve if older non-pending rows dominate the head).

### Deferred
- **ARCH-CRIT-1** Async batch `deleteOrganization` was attempted but reverted due to `convex-test@0.0.40` incompatibility with `ctx.scheduler.runAfter` from mutations. The synchronous cascade remains, with a scale ceiling of ~100 members / ~30 teams per transaction. Implement an async wrapper in the consumer app for larger orgs.

### React
- **REACT-5** `TenantsContextValue` split into `TenantsDataContextValue` + `TenantsActionsContextValue` with separate memoization. `useTenants()` is retained as a thin aggregator for back-compat; prefer `useTenantsData()` / `useTenantsActions()` for new code.
- **REACT-6** New `features?: { members?; invitations?; teams? }` prop on `TenantsProvider` gates the corresponding `useQuery` subscriptions.
- **REACT-7** Memoization added in `TeamsSection` (transforms + `onCreateTeam`) and `MembersTable` (description + unified list).
- **REACT-9** `TeamsGrid` cards are now keyboard accessible (`role="button"`, `tabIndex`, Enter/Space handlers).
- **REACT-10** Added `htmlFor` / `id` linkage in `section-nested-teams.tsx`, `org-settings-panel.tsx`, `section-bulk-invite.tsx`.
- **REACT-11** Delete-org, leave-org, and transfer-ownership confirms in `OrgSettingsPanel` migrated to Radix `Dialog` primitives (focus trap, Escape-to-close, `role="dialog"`).
- **REACT-12** `TenantsContextValue.api` typed as `Record<string, FunctionReference<"query" | "mutation", "public"> | undefined>` (was `unknown`).
- **REACT-13** `metadata?: any` replaced with `metadata?: Record<string, unknown>` across React types.
- **REACT-14** `OrgSettingsPanel`, `BulkInviteSection`, and `NestedTeamsSection` now use shared `Button` / `Input` / `Select` / `Textarea` primitives from `src/react/ui/` instead of raw form elements.
- Fix: `useOrganization` auto-selects the first org regardless of count, matching `TenantsProvider` behavior.
- Fix: `section-members` correctly distinguishes `owner` vs `admin` vs member for invite-button and moderation gating (previously all members were treated as owner-equivalent).
- Fix: `section-members` removed the fabricated `${userId}@example.com` fallback.
- Fix: `organization-store` now syncs across tabs via a `storage` event listener, with listener re-attach on `configureOrganizationStore()` key rotation.

### Migration
- **Consumers of `generateLogoUploadUrl`:** pass `organizationId` on every call.
- **Consumers of `TenantsContext`:** switch to `useTenants()` / `useTenantsData()` / `useTenantsActions()`.
- **Consumers of `listUserOrganizations`:** pass `status: "all"` if you want the legacy behavior of listing suspended memberships alongside active ones.
- **Schema:** `members.by_user_and_status` index is additive. No data migration required.

## 0.1.7

### Security
- **Breaking:** `deleteOrganization` now enforces owner-only invariant even when `permissionMap.deleteOrganization` is `false`
- **Breaking:** `acceptInvitation` now enforces exact identifier matching by default (previously no-op without `validateInvitationAccept`)
- `checkPermission`, `getUserPermissions`, `getUserRoles` now require org membership
- `listInvitations`, `countInvitations` now enforce `invitations:list` permission
- Component-level `deleteOrganization` enforces `ownerId` check
- Component-level `acceptInvitation` enforces identifier matching (defense in depth)

### Features
- Add `hasRole` query (O(1) role check with fallback to `getUserRoles`)
- Add `checkAnyPermission` query (batch permission check with fallback)
- Add `recomputeUser` mutation (admin API for rebuilding authz state)
- Add `listUserTeamMemberships` component query (efficient per-user team lookup)
- Add configurable `roleHierarchy` option to `makeTenantsAPI`

### Performance
- `removeMember`, `leaveOrganization`, `bulkRemoveMembers`: use `teamMembers.by_user` index — O(userTeams) instead of O(allTeams)
- `deleteTeam`: use `by_org_and_team` index for invitation cleanup instead of collecting all org invitations
- `countInvitations`: use `by_organization_and_status` index for direct status query
- `cleanupTeamRelations`: single `listUserTeamMemberships` query instead of O(T) `isTeamMember` checks
- Add `by_organization_and_status`, `by_org_and_team` indexes on invitations table
- List queries (`listMembers`, `listTeams`, `listTeamMembers`, `listTeamsAsTree`) return empty instead of throwing on permission denied (subscription safety)
- `getAuditLog` forwards `scope` to authz, eliminates 3x over-fetch
- `offboardUser` passes `removeOverrides: true` for clean permission override cleanup
- `deleteOrganization` fetches all members (including suspended) for authz cleanup

### Authz Integration
- `isTeamMember` now uses `authz.hasRelation()` instead of component DB query
- `cleanupMemberAuthz` helper: prefers `offboardUser` > `revokeAllRoles` > `revokeRole`
- `checkMemberPermission` moved to client layer with configurable hierarchy (component version deprecated)

### Documentation
- Add error handling guide, hooks guide, testing guide, known limitations
- Add complete prop tables for all React components
- Add pagination and bulk operation return type documentation
- Populate CHANGELOG with all version history

## 0.1.6

- Add `countMembers`, `countTeams`, `countInvitations` queries
- Add `checkMemberPermission` query with configurable `roleHierarchy` option
- Add `getCurrentUserEmail` query for invitation-accept flows
- Documentation improvements: pagination guide, bulk operation return types, component prop tables

## 0.1.5

- Add `suspendMember` / `unsuspendMember` mutations for member moderation
- Add `updateTeamMemberRole` mutation
- Add `listTeamsAsTree` query for nested team hierarchies
- Add `OrgSettingsPanel`, `BulkInviteSection`, `MemberModerationSection`, `NestedTeamsSection` React components

## 0.1.4

- Add `bulkAddMembers`, `bulkRemoveMembers`, `bulkInviteMembers` mutations with partial-success semantics
- Add `validateInvitationCreate` and `validateInvitationAccept` callbacks
- Add organization status (`active` / `suspended` / `archived`) with mutation blocking

## 0.1.3

- Add `transferOwnership` mutation
- Add `generateLogoUploadUrl` mutation (opt-in via `generateUploadUrl` option)
- Add `maxOrganizations`, `maxMembers`, `maxTeams` limit options

## 0.1.2

- Add nested teams support (`parentTeamId`, cycle validation)
- Add invitation `message` and `teamId` fields
- Add team `slug` and `metadata` fields

## 0.1.1

- Add `onBefore*` validation hooks
- Add 13 event hook callbacks (organization, member, team, invitation lifecycle)

## 0.0.0

- Initial release
