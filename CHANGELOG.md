# Changelog

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
