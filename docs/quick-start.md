# Quick Start

Get `@djpanda/convex-tenants` running in four steps.

## 1. Configure the components

In your `convex/convex.config.ts`, register **both** `tenants` and `authz` as sibling components:

```typescript
import { defineApp } from "convex/server";
import tenants from "@djpanda/convex-tenants/convex.config";
import authz from "@djpanda/convex-authz/convex.config";

const app = defineApp();
app.use(tenants);
app.use(authz);

export default app;
```

> **Important:** `authz` is a separate, global component — not a child of `tenants`. This means other parts of your app can also use `authz` for permission checks outside of the tenants context.

## 2. Define your authorization config

Create `convex/authz.ts` to define the permissions and roles for your application. The tenants package exports `TENANTS_PERMISSIONS` and `TENANTS_ROLES` as convenient defaults you can extend:

```typescript
import { Authz, definePermissions, defineRoles } from "@djpanda/convex-authz";
import { TENANTS_PERMISSIONS, TENANTS_ROLES } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";

// Step 1: Define permissions — include tenants defaults + your app-specific resources
const permissions = definePermissions(TENANTS_PERMISSIONS, {
  // Add app-specific resources:
  // billing: { manage: true, view: true, export: true },
  // projects: { create: true, read: true, update: true, delete: true },
});

// Step 2: Define roles — include tenants defaults + your app-specific extensions
const roles = defineRoles(permissions, TENANTS_ROLES, {
  // Extend existing roles with app-specific permissions:
  // owner: { billing: ["manage", "view", "export"] },
  // admin: { billing: ["view"] },

  // Add completely new roles:
  // billing_admin: {
  //   organizations: ["read"],
  //   billing: ["manage", "view", "export"],
  // },
});

// Step 3: Create the Authz client
export const authz = new Authz(components.authz, { permissions, roles });
```

> **Tip:** You don't have to use `TENANTS_PERMISSIONS` and `TENANTS_ROLES`. You can define everything from scratch — just make sure your permissions cover the operations in the [Permission Map](permission-map.md).

## 3. Create your tenants API

In your `convex/tenants.ts`:

```typescript
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { components } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { authz } from "./authz";

export const {
  // Organizations
  listOrganizations, getOrganization, getOrganizationBySlug,
  createOrganization, updateOrganization, transferOwnership, deleteOrganization,
  // Members
  listMembers, listMembersPaginated, getMember, getCurrentMember,
  addMember, removeMember, updateMemberRole, leaveOrganization,
  // Teams
  listTeams, listTeamsPaginated, getTeam, listTeamMembers, listTeamMembersPaginated, isTeamMember,
  createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember,
  // Invitations
  listInvitations, listInvitationsPaginated, getInvitation, getPendingInvitations,
  inviteMember, acceptInvitation, resendInvitation, cancelInvitation,
  // Authorization
  checkPermission, getUserPermissions, getUserRoles,
  grantPermission, denyPermission, getAuditLog,
} = makeTenantsAPI(components.tenants, {
  authz,                  // Required: your Authz instance from authz.ts
  creatorRole: "owner",   // Role assigned when creating an org (must match authz.ts)

  auth: async (ctx) => {
    return await getAuthUserId(ctx) ?? null;
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

> **Why the destructure?** Convex uses file-based routing — each named export becomes a callable function reference (e.g. `api.tenants.listOrganizations`). ES modules require static named exports, so we can't dynamically re-export. But with a single destructure, **one statement exports everything**.
>
> You can also selectively export only the functions you need:
>
> ```typescript
> export const { listOrganizations, createOrganization, inviteMember } =
>   makeTenantsAPI(components.tenants, { ... });
> ```

## 4. Use in your React app

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

For pre-built React components and the `TenantsProvider`, see [React components](react-components.md).
