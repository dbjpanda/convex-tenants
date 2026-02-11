import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - team roles", () => {
  test("addTeamMember with role stores role and listTeamMembers returns it", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Team Roles Org",
      slug: "team-roles",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Eng",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
      role: "lead",
    });

    const members = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId,
    });
    const bob = members.find((m) => m.userId === "bob");
    expect(bob).toBeDefined();
    expect(bob?.role).toBe("lead");
  });

  test("updateTeamMemberRole changes role", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Update Team Role Org",
      slug: "update-team-role",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Team",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
      role: "member",
    });

    await asAlice.mutation(api.testHelpers.strictUpdateTeamMemberRole, {
      teamId,
      memberUserId: "bob",
      role: "lead",
    });

    const members = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId,
    });
    const bob = members.find((m) => m.userId === "bob");
    expect(bob?.role).toBe("lead");
  });

  test("addTeamMember without role leaves role undefined", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "No Role Org",
      slug: "no-role",
    });
    const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Team",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
    });

    const members = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId,
    });
    const bob = members.find((m) => m.userId === "bob");
    expect(bob).toBeDefined();
    expect(bob?.role).toBeUndefined();
  });
});
