# Flexible Roles

Roles in `@djpanda/convex-tenants` are **plain strings** — not a hardcoded enum. You define exactly which roles exist and what permissions each role has in your `authz.ts` file.

## Customizing Roles

The default `TENANTS_ROLES` provides `owner`, `admin`, and `member` roles. But you can:

### Add new roles

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

### Remove default roles

Define roles from scratch (without `TENANTS_ROLES`):

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

### Change the creator role

```typescript
makeTenantsAPI(components.tenants, {
  authz,
  creatorRole: "admin", // New orgs assign "admin" instead of "owner"
  // ...
});
```

## Structural Owner

Each organization has a structural `ownerId` field set to the user who created it. This is a **data integrity constraint**, not an authorization check:

- The structural owner cannot be removed from the organization
- The structural owner cannot leave unless another member holds the `creatorRole`
- Use `transferOwnership` to assign a new owner before the current owner leaves

This ensures every organization always has at least one member. All permission-based authorization (who can update, who can delete, etc.) is handled entirely by `@djpanda/convex-authz`.

## Role Hierarchy and checkMemberPermission

The `checkMemberPermission` query compares roles using a built-in hierarchy: `owner` (3) > `admin` (2) > `member` (1). Custom roles (e.g. `"viewer"`, `"billing_admin"`) are treated as having hierarchy level 0, so they will not satisfy a `minRole` check against any built-in role. For custom roles, use `@djpanda/convex-authz` permission checks (`checkPermission`) instead of role-level checks.
