---
name: convex-tenants
description: Multi-tenant organization and team management for Convex with @djpanda/convex-tenants and @djpanda/convex-authz. Use when (1) setting up or integrating multi-tenant SaaS with Convex, (2) working with organizations, teams, members, or invitations, (3) configuring authz permissions for tenants, (4) using TenantsProvider, OrganizationSwitcher, or related React components, or (5) the user mentions convex-tenants, @djpanda/convex-tenants, or multi-tenant Convex.
---

# Convex Tenants

Multi-tenant organization and team management for [Convex](https://convex.dev) with flexible authorization via `@djpanda/convex-authz`.

## Quick Start

1. **Register components** in `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(tenants);
app.use(authz);

export default app;
```

2. **Define authz** in `convex/authz.ts` — use `TENANTS_PERMISSIONS` and `TENANTS_ROLES` from the package. See `node_modules/@djpanda/convex-tenants/docs/quick-start.md`.

3. **Create tenants API** in `convex/tenants.ts`:

```typescript
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";
import { authz } from "./authz";

export const { listOrganizations, createOrganization, inviteMember, ... } =
  makeTenantsAPI(components.tenants, {
    authz,
    creatorRole: "owner",
    auth: async (ctx) => (await getAuthUserId(ctx)) ?? null,
    getUser: async (ctx, userId) => {
      const user = await ctx.db.get(userId);
      return user ? { name: user.name, email: user.email } : null;
    },
  });
```

4. **Use in React** — `useQuery(api.tenants.listOrganizations)`, or use pre-built components with `TenantsProvider`. See `node_modules/@djpanda/convex-tenants/docs/react-components.md`.

## Key Concepts

- **authz is a sibling component** — Register `authz` alongside `tenants`, not as a child. Other parts of your app can use authz outside tenants.
- **Roles are plain strings** — Define them in authz.ts. Default roles: `owner`, `admin`, `member`. See `node_modules/@djpanda/convex-tenants/docs/flexible-roles.md`.
- **Structural owner** — Each org has an `ownerId`. Use `transferOwnership` before owner leaves. All permission checks go through authz.
- **Organization status** — `suspended` or `archived` blocks mutations; only `updateOrganization` with `status: "active"` can reactivate.

## Exports

| Export | Description |
|--------|-------------|
| `TENANTS_PERMISSIONS` | Default permissions for `definePermissions()` |
| `TENANTS_ROLES` | Default roles (owner, admin, member) for `defineRoles()` |
| `DEFAULT_TENANTS_PERMISSION_MAP` | Operation → permission mapping |
| `TENANTS_REQUIRED_PERMISSIONS` | Flat list of permission strings |

## Documentation (read from package)

Base path: `node_modules/@djpanda/convex-tenants/docs/`. **Select the doc that matches the user's keywords or task** — load only what's needed:

| Doc | Path | Load when user asks about… |
|-----|------|----------------------------|
| **quick-start** | `docs/quick-start.md` | Setup, install, first-time integration, convex.config, authz.ts, tenants.ts, getting started, initial setup |
| **api-reference** | `docs/api-reference.md` | Function names (listOrganizations, createOrganization, addMember, inviteMember, etc.), makeTenantsAPI options, event hooks, mutation/query args, pagination (listMembersPaginated, listTeamsPaginated), API signatures |
| **permission-map** | `docs/permission-map.md` | Permissions, permissionMap, who can do what, operation permissions, overriding permissions, guards, access control per operation |
| **flexible-roles** | `docs/flexible-roles.md` | Roles, custom roles, owner/admin/member, creatorRole, defineRoles, structural owner, transferOwnership, add/remove roles |
| **invitation-system** | `docs/invitation-system.md` | Invitations, inviteMember, acceptInvitation, validateInvitationCreate, validateInvitationAccept, identifier type, email/phone/username, domain whitelist, rate limiting invitations |
| **react-components** | `docs/react-components.md` | TenantsProvider, OrganizationSwitcher, MembersSection, TeamsSection, InviteMemberDialog, useOrganization, useMembers, useTeams, useInvitations, MembersTable, TeamsGrid, AcceptInvitation, JoinByDomainSection, paginated hooks |
| **organization-store** | `docs/organization-store.md` | Active organization, switching orgs, useOrganizationStore, setActiveOrganizationId, localStorage, storageKey, configureOrganizationStore |

## Installation

```bash
npm install @djpanda/convex-tenants @djpanda/convex-authz
```

For React UI: `npm install clsx tailwind-merge` (optional peer deps).
