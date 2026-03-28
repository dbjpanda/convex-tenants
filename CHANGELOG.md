# Changelog

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
