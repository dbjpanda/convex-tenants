# Permission Map

Every guarded mutation checks a permission string via `@djpanda/convex-authz` before executing. The default mapping is:

| Operation | Default Permission |
|-----------|-------------------|
| `createOrganization` | `false` (not gated). Set to a permission string (e.g. `organizations:create`) to require that permission before creating an org (checked without an org scope). |
| `updateOrganization` | `organizations:update` |
| `deleteOrganization` | `organizations:delete` |
| `addMember` | `members:add` |
| `removeMember` | `members:remove` |
| `updateMemberRole` | `members:updateRole` |
| `suspendMember` | `members:suspend` |
| `unsuspendMember` | `members:unsuspend` |
| `createTeam` | `teams:create` |
| `updateTeam` | `teams:update` |
| `deleteTeam` | `teams:delete` |
| `addTeamMember` | `teams:addMember` |
| `updateTeamMemberRole` | `teams:updateMemberRole` |
| `removeTeamMember` | `teams:removeMember` |
| `inviteMember` | `invitations:create` |
| `bulkInviteMembers` | `invitations:create` |
| `bulkAddMembers` | `members:add` |
| `bulkRemoveMembers` | `members:remove` |
| `resendInvitation` | `invitations:resend` |
| `cancelInvitation` | `invitations:cancel` |
| `grantPermission` | `permissions:grant` |
| `denyPermission` | `permissions:deny` |
| `getAuditLog` | `permissions:grant` (query; requires grant to read audit log) |

## Overriding the map

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
