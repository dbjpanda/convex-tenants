import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("permission override cleanup", () => {
  test("removeMember cleans up direct permission overrides", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Alice creates org (becomes owner)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Override Cleanup Org",
    });

    // Alice adds bob as member
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Verify bob does NOT have teams:create by default (member role lacks it)
    const baseline = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(baseline.allowed).toBe(false);

    // Alice grants bob a direct permission override for teams:create
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "teams:create",
    });

    // Verify the override works — bob now has teams:create
    const before = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(before.allowed).toBe(true);

    // Alice removes bob from org
    await asAlice.mutation(api.testHelpers.strictRemoveMember, {
      organizationId: orgId,
      memberUserId: "bob",
    });

    // Re-add bob as member (which doesn't have teams:create)
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    // Override should be gone — bob is back to base member permissions
    const after = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "teams:create",
    });
    expect(after.allowed).toBe(false);
  });

  test("leaveOrganization cleans up direct permission overrides", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Alice creates org (becomes owner)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Leave Override Cleanup Org",
    });

    // Alice adds bob as admin
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Admin does NOT have organizations:delete — verify baseline
    const baseline = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(baseline.allowed).toBe(false);

    // Alice grants bob a direct override for organizations:delete
    await asAlice.mutation(api.testHelpers.strictGrantPermission, {
      organizationId: orgId,
      targetUserId: "bob",
      permission: "organizations:delete",
    });

    // Verify the override works
    const before = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(before.allowed).toBe(true);

    // Bob leaves the org
    await asBob.mutation(api.testHelpers.strictLeaveOrganization, {
      organizationId: orgId,
    });

    // Alice re-adds bob as admin
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "admin",
    });

    // Override should be gone — bob is back to base admin permissions
    const after = await asBob.query(api.testHelpers.strictCheckPermission, {
      organizationId: orgId,
      permission: "organizations:delete",
    });
    expect(after.allowed).toBe(false);
  });
});
