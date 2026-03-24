/**
 * Integration tests for permissionMap overrides.
 * Verifies that `false` skips authz checks and custom strings use different permissions.
 */
import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("permissionMap overrides", () => {
  test("permissionMap false skips authz check — member can delete org", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Create org using the permMap variant (deleteOrganization: false)
    const orgId = await asAlice.mutation(api.testHelpers.permMapCreateOrg, {
      name: "PermMap False Org",
    });
    await asAlice.mutation(api.testHelpers.permMapAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });

    // Member normally can't delete — but permissionMap: false skips the check
    await asBob.mutation(api.testHelpers.permMapDeleteOrg, {
      organizationId: orgId,
    });

    // Verify org is gone
    const org = await asAlice.query(api.testHelpers.strictGetOrganizationBySlug, {
      slug: "permmap-false-org",
    });
    expect(org).toBeNull();
  });

  test("permissionMap custom string uses different permission — member with organizations:read can create team", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Create org using permMap variant (createTeam: "organizations:read")
    const orgId = await asAlice.mutation(api.testHelpers.permMapCreateOrg, {
      name: "PermMap Custom Org",
    });
    await asAlice.mutation(api.testHelpers.permMapAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });

    // Member has organizations:read but not teams:create
    // With the custom permMap, createTeam checks organizations:read instead
    const teamId = await asBob.mutation(api.testHelpers.permMapCreateTeam, {
      organizationId: orgId, name: "Member Created Team",
    });
    expect(teamId).toBeDefined();
  });

  test("default permissionMap denies member from creating team (teams:create required)", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
    const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

    // Use the standard strict API (default permissionMap)
    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Default PermMap Org",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId, memberUserId: "bob", role: "member",
    });

    // Member doesn't have teams:create in the default roles
    await expect(
      asBob.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId, name: "Should Fail",
      })
    ).rejects.toThrow(/Permission denied.*teams:create/);
  });
});
