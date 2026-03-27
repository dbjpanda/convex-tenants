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

The `checkMemberPermission` query compares roles using a numeric hierarchy. The built-in default is:

```typescript
{ owner: 3, admin: 2, member: 1 }
```

A role's level determines whether it satisfies a `minRole` check: a member's role must have a level greater than or equal to the `minRole` level. Custom roles that are not listed in the hierarchy default to level **0**, meaning they will fail all `minRole` checks against any built-in role.

### Providing a custom roleHierarchy

You can override the hierarchy via the `roleHierarchy` option on `makeTenantsAPI` (which passes it to the underlying `Tenants` class):

```typescript
makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => await getAuthUserId(ctx),
  roleHierarchy: {
    superadmin: 10,
    owner: 5,
    admin: 3,
    member: 1,
    viewer: 0,
  },
});
```

When a custom `roleHierarchy` is provided, it **replaces** the default hierarchy entirely. Make sure to include every role you want to participate in role-level checks.

### Example: adding "superadmin" and "viewer"

```typescript
// In authz.ts — define the roles with permissions
const roles = defineRoles(permissions, TENANTS_ROLES, {
  superadmin: {
    organizations: ["create", "read", "update", "delete"],
    members: ["add", "remove", "updateRole", "list"],
    teams: ["create", "update", "delete", "addMember", "removeMember", "list"],
    invitations: ["create", "cancel", "resend", "list"],
  },
  viewer: {
    organizations: ["read"],
    members: ["list"],
    teams: ["list"],
  },
});

// In tenants.ts — set the hierarchy
makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => await getAuthUserId(ctx),
  roleHierarchy: {
    superadmin: 10,
    owner: 5,
    admin: 3,
    member: 1,
    viewer: 0,
  },
});
```

With this configuration, `checkMemberPermission({ minRole: "admin" })` would pass for `superadmin` (10 >= 3) and `owner` (5 >= 3), but fail for `member` (1 < 3) and `viewer` (0 < 3).

### Recommendation: prefer checkPermission over checkMemberPermission

`checkMemberPermission` is a simple numeric comparison that does not account for fine-grained permission grants or denials. For custom roles, **use `checkPermission` (powered by `@djpanda/convex-authz`) instead of `checkMemberPermission`**. The authz-based approach:

- Respects per-user permission overrides (`grantPermission` / `denyPermission`)
- Works with any role defined in your `authz.ts`, regardless of hierarchy level
- Supports scoped permissions (per-organization, per-team)

Reserve `checkMemberPermission` for simple "is this user at least an admin?" guards where the built-in hierarchy is sufficient.
