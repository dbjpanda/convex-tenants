import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - max limits enforcement", () => {
  test("maxOrganizations: second createOrganization throws", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
      name: "First Org",
      slug: "first-org",
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
        name: "Second Org",
        slug: "second-org",
      })
    ).rejects.toThrow(/maximum|Maximum/i);

    const orgs = await asAlice.query(api.testHelpers.strictListOrganizationsWithLimits, {});
    expect(orgs).toHaveLength(1);
  });

  test("maxMembers: adding beyond limit throws", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
      name: "Max Members Org",
      slug: "max-members",
    });
    await asAlice.mutation(api.testHelpers.strictAddMemberWithLimits, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictAddMemberWithLimits, {
        organizationId: orgId,
        memberUserId: "carol",
        role: "member",
      })
    ).rejects.toThrow(/maximum|Maximum/i);

    const count = await asAlice.query(api.testHelpers.strictCountMembers, {
      organizationId: orgId,
    });
    expect(count).toBe(2);
  });

  test("maxTeams: second createTeam throws", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganizationWithLimits, {
      name: "Max Teams Org",
      slug: "max-teams",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeamWithLimits, {
      organizationId: orgId,
      name: "First Team",
    });

    await expect(
      asAlice.mutation(api.testHelpers.strictCreateTeamWithLimits, {
        organizationId: orgId,
        name: "Second Team",
      })
    ).rejects.toThrow(/maximum|Maximum/i);

    const teams = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
    });
    expect(teams).toHaveLength(1);
  });
});
