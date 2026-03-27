# Testing Guide

How to test your app's integration with `@djpanda/convex-tenants` using `convex-test`.

---

## Setup

### 1. Install dependencies

```bash
npm install -D convex-test vitest @edge-runtime/vm
```

### 2. Configure Vitest

Create or update `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex", "convex-test"] } },
  },
});
```

### 3. Create test setup

Create a test setup file (e.g., `convex/setup.test.ts`) that initializes `convex-test` with both the tenants and authz components:

```typescript
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema.js";
import tenantsTest from "@djpanda/convex-tenants/test";
import authzTest from "@djpanda/convex-authz/test";

const modules = import.meta.glob("./**/*.*s");

export function initConvexTest() {
  const t = convexTest(schema, modules);
  tenantsTest.register(t);          // registers the "tenants" component
  authzTest.register(t, "authz");   // registers the "authz" component
  return t;
}
```

The `modules` glob imports all files in your `convex/` directory. The `register` calls wire up the component schemas and internal functions that `convex-test` needs.

> **Important:** The component names passed to `register` must match the names in your `convex/convex.config.ts`. The defaults are `"tenants"` and `"authz"`.

---

## Authentication in tests

`convex-test` does not use Convex Auth's full session flow. Instead, it provides `withIdentity()` to simulate an authenticated user:

```typescript
const t = initConvexTest();
const asAlice = t.withIdentity({
  subject: "alice",
  issuer: "https://test.com",
});
```

Because of this, your test helper functions should use `ctx.auth.getUserIdentity()` instead of `getAuthUserId()` from `@convex-dev/auth`. The standard pattern is to create a dedicated `testHelpers.ts` file alongside your `tenants.ts`:

```typescript
// convex/testHelpers.ts
import { components } from "./_generated/api.js";
import { makeTenantsAPI } from "@djpanda/convex-tenants";
import { authz } from "./authz.js";

const testApi = makeTenantsAPI(components.tenants, {
  authz,
  auth: async (ctx) => {
    // Use ctx.auth instead of Convex Auth for test compatibility
    const identity = await ctx.auth.getUserIdentity();
    return identity?.subject ?? null;
  },
  getUser: async (_ctx, userId) => ({
    name: `User ${userId}`,
    email: `${userId}@test.com`,
  }),
});

// Re-export individual functions for test usage
export const strictCreateOrganization = testApi.createOrganization;
export const strictListOrganizations = testApi.listOrganizations;
export const strictAddMember = testApi.addMember;
// ... export all functions you need in tests
```

Then import these in your tests via the generated API:

```typescript
import { api } from "../convex/_generated/api";

// Use api.testHelpers.strictCreateOrganization instead of api.tenants.createOrganization
```

---

## Basic test patterns

### Create an organization

```typescript
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

test("create and list organizations", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Acme Corp",
  });

  expect(orgId).toBeDefined();

  const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
  expect(orgs).toHaveLength(1);
  expect(orgs[0].name).toBe("Acme Corp");
  expect(orgs[0].role).toBe("owner");
});
```

### Add a member and verify

```typescript
test("add member and verify membership", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Test Org",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "member",
  });

  const members = await asAlice.query(api.testHelpers.strictListMembers, {
    organizationId: orgId,
  });

  expect(members).toHaveLength(2); // alice (owner) + bob (member)

  const bob = members.find((m: any) => m.userId === "bob");
  expect(bob).toBeDefined();
  expect(bob.role).toBe("member");
});
```

### Create a team and add members

```typescript
test("team lifecycle", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Team Org",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "member",
  });

  const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
    organizationId: orgId,
    name: "Engineering",
  });

  await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
    teamId,
    memberUserId: "bob",
  });

  const teamMembers = await asAlice.query(api.testHelpers.strictListTeamMembers, {
    teamId,
  });

  expect(teamMembers).toHaveLength(1);
  expect(teamMembers[0].userId).toBe("bob");
});
```

---

## Testing with different roles and permissions

### Verify permission enforcement

```typescript
test("member cannot delete organization", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
  const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Permission Test",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "member",
  });

  // Bob is a "member" -- should not have organizations:delete permission
  await expect(
    asBob.mutation(api.testHelpers.strictDeleteOrganization, {
      organizationId: orgId,
    })
  ).rejects.toThrow(); // Authz blocks the operation
});
```

### Check permissions via the API

```typescript
test("checkPermission returns correct results by role", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
  const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Check Perm Org",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "member",
  });

  // Owner has update permission
  const ownerResult = await asAlice.query(api.testHelpers.strictCheckPermission, {
    organizationId: orgId,
    permission: "organizations:update",
  });
  expect(ownerResult.allowed).toBe(true);

  // Member does not have delete permission
  const memberResult = await asBob.query(api.testHelpers.strictCheckPermission, {
    organizationId: orgId,
    permission: "organizations:delete",
  });
  expect(memberResult.allowed).toBe(false);
});
```

### Test cross-org isolation

```typescript
test("user cannot access another user's organization", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
  const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

  const aliceOrgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Alice's Org",
  });

  await expect(
    asBob.query(api.testHelpers.strictGetOrganization, {
      organizationId: aliceOrgId,
    })
  ).rejects.toThrow("Not a member of this organization");
});
```

---

## Testing hooks and callbacks

### Verifying event hooks fire

The example app uses a `callbackLog` table to capture hook invocations. Set up your test helpers to log hook calls:

```typescript
// convex/testHelpers.ts
const testApi = makeTenantsAPI(components.tenants, {
  // ...
  onOrganizationCreated: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "organizationCreated", data });
  },
  onMemberAdded: async (ctx, data) => {
    await ctx.db.insert("callbackLog", { type: "memberAdded", data });
  },
  // ... register other hooks similarly
});

// Export a query to read the logs
export const getCallbackLogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("callbackLog").collect();
  },
});
```

Then in tests:

```typescript
test("onMemberAdded fires with correct data", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Hook Test Org",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "admin",
  });

  const logs = await t.query(api.testHelpers.getCallbackLogs, {});
  const memberAddedLogs = logs.filter((l: any) => l.type === "memberAdded");

  expect(memberAddedLogs).toHaveLength(1);
  expect(memberAddedLogs[0].data.organizationId).toBe(orgId);
  expect(memberAddedLogs[0].data.userId).toBe("bob");
  expect(memberAddedLogs[0].data.role).toBe("admin");
  expect(memberAddedLogs[0].data.addedBy).toBe("alice");
});
```

### Testing onBefore validation hooks

Create a separate API instance with a throwing onBefore hook:

```typescript
// convex/testHelpers.ts
const apiWithBlockingHook = makeTenantsAPI(components.tenants, {
  // ...
  onBeforeCreateOrganization: async () => {
    throw new Error("Blocked by onBeforeCreateOrganization");
  },
});

export const blockedCreateOrganization = apiWithBlockingHook.createOrganization;
```

```typescript
test("onBefore hook blocks the mutation", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  await expect(
    asAlice.mutation(api.testHelpers.blockedCreateOrganization, {
      name: "Should Not Exist",
    })
  ).rejects.toThrow("Blocked by onBeforeCreateOrganization");

  // Verify the org was never created
  const orgs = await asAlice.query(api.testHelpers.strictListOrganizations, {});
  expect(orgs.find((o: any) => o.name === "Should Not Exist")).toBeUndefined();
});
```

---

## Testing invitation flows

```typescript
test("invitation flow: invite, accept, verify membership", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
  const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Invitation Org",
  });

  // Alice invites Bob
  const { invitationId } = await asAlice.mutation(api.testHelpers.strictInviteMember, {
    organizationId: orgId,
    inviteeIdentifier: "bob@test.com",
    role: "member",
  });

  expect(invitationId).toBeDefined();

  // Bob accepts the invitation
  await asBob.mutation(api.testHelpers.strictAcceptInvitation, {
    invitationId,
  });

  // Verify Bob is now a member
  const members = await asAlice.query(api.testHelpers.strictListMembers, {
    organizationId: orgId,
  });
  const bob = members.find((m: any) => m.userId === "bob");
  expect(bob).toBeDefined();
  expect(bob.role).toBe("member");
});
```

---

## Testing with limits

Create a separate API instance with max limits configured:

```typescript
// convex/testHelpers.ts
const apiWithLimits = makeTenantsAPI(components.tenants, {
  // ...
  maxOrganizations: 1,
  maxMembers: 2,
  maxTeams: 1,
});

export const limitedCreateOrganization = apiWithLimits.createOrganization;
```

```typescript
test("maxOrganizations prevents creating beyond limit", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  await asAlice.mutation(api.testHelpers.limitedCreateOrganization, {
    name: "First Org",
  });

  await expect(
    asAlice.mutation(api.testHelpers.limitedCreateOrganization, {
      name: "Second Org",
    })
  ).rejects.toThrow("Maximum number of organizations (1) reached.");
});
```

---

## Testing error conditions

```typescript
test("unauthenticated user cannot create organization", async () => {
  const t = initConvexTest();

  await expect(
    t.mutation(api.testHelpers.strictCreateOrganization, {
      name: "No Auth Org",
    })
  ).rejects.toThrow("Not authenticated");
});

test("cannot remove organization owner", async () => {
  const t = initConvexTest();
  const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

  const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
    name: "Owner Removal Test",
  });

  await asAlice.mutation(api.testHelpers.strictAddMember, {
    organizationId: orgId,
    memberUserId: "bob",
    role: "admin",
  });

  const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

  // Bob (admin) tries to remove Alice (owner)
  await expect(
    asBob.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "alice",
    })
  ).rejects.toThrow();
});
```

---

## Reference: example test files

The library ships with 45+ test files in `example/tests/` that cover every feature. Use these as reference patterns:

| Test File | Coverage |
|-----------|----------|
| `organizations.test.ts` | CRUD, slug lookup, cross-org isolation, getUser enrichment |
| `members.test.ts` | Add, remove, role changes, getUser enrichment |
| `teams.test.ts` | Team CRUD, team members, team member roles |
| `invitations.test.ts` | Invite, accept, resend, cancel, expiration |
| `authorization.test.ts` | checkPermission, getUserPermissions, getUserRoles |
| `callbacks.test.ts` | All on* event hooks with data verification |
| `onbefore-hooks.test.ts` | onBefore hooks blocking mutations |
| `onbefore-all-hooks.test.ts` | Comprehensive onBefore hook coverage |
| `errors.test.ts` | Error conditions and messages |
| `auth-enforcement.test.ts` | Unauthenticated access rejection |
| `max-limits.test.ts` | maxOrganizations, maxMembers, maxTeams enforcement |
| `bulk-operations.test.ts` | bulkAddMembers, bulkRemoveMembers, bulkInviteMembers |
| `transfer-ownership.test.ts` | Ownership transfer flows |
| `leave-organization.test.ts` | Leave org, last-owner guard |
| `organization-status.test.ts` | Active, suspended, archived status |
| `org-status-enforcement.test.ts` | Mutations blocked on non-active orgs |
| `nested-teams.test.ts` | Parent/child team hierarchy |
| `team-slug-metadata.test.ts` | Team slugs and metadata |
| `team-roles.test.ts` | Team member roles |
| `permission-map-overrides.test.ts` | Custom permission map |
| `validate-invitation-callbacks.test.ts` | validateInvitationCreate, validateInvitationAccept |
| `cascading.test.ts` | Cascading deletes (org delete cleans teams, members, invitations) |
| `rebac-relations.test.ts` | Team ReBAC relation cleanup |
| `sort-options.test.ts` | Sorting by various fields |
| `journey-*.test.ts` | End-to-end multi-step workflow tests |
