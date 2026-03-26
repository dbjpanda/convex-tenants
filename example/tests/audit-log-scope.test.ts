import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("audit log scope isolation", () => {
  test("returns only entries scoped to the requested organization", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Create two separate organizations
    const orgA = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org A",
    });
    const orgB = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Org B",
    });

    // Generate activity in org A (adds bob)
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgA,
      memberUserId: "bob",
      role: "member",
    });

    // Generate activity in org B (adds charlie)
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgB,
      memberUserId: "charlie",
      role: "member",
    });

    // Get audit log scoped to org A only
    const logA = await asAlice.query(api.testHelpers.strictGetAuditLog, {
      organizationId: orgA,
    });

    // The result should be an array (the tenants-class normalizes it)
    expect(Array.isArray(logA)).toBe(true);

    // Every returned entry must be scoped to org A — none from org B
    for (const entry of logA as Array<{ scope?: { type?: string; id?: string } }>) {
      if (entry.scope) {
        expect(entry.scope.type).toBe("organization");
        expect(entry.scope.id).toBe(orgA);
        // Explicitly verify no org B entries leaked
        expect(entry.scope.id).not.toBe(orgB);
      }
    }

    // Get audit log scoped to org B only
    const logB = await asAlice.query(api.testHelpers.strictGetAuditLog, {
      organizationId: orgB,
    });

    expect(Array.isArray(logB)).toBe(true);

    // Every returned entry must be scoped to org B — none from org A
    for (const entry of logB as Array<{ scope?: { type?: string; id?: string } }>) {
      if (entry.scope) {
        expect(entry.scope.type).toBe("organization");
        expect(entry.scope.id).toBe(orgB);
        expect(entry.scope.id).not.toBe(orgA);
      }
    }
  });

  test("getAuditLog respects limit parameter", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    // Create org and generate several operations to produce audit entries
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Limit Test Org",
    });

    // Add 3 members to generate audit activity
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "user1",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "user2",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "user3",
      role: "member",
    });

    // Request with limit: 2
    const limitedLog = await asAlice.query(api.testHelpers.strictGetAuditLog, {
      organizationId: orgId,
      limit: 2,
    });

    expect(Array.isArray(limitedLog)).toBe(true);
    expect((limitedLog as unknown[]).length).toBeLessThanOrEqual(2);
  });
});
