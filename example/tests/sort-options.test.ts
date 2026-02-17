import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - sort options", () => {
  test("listOrganizations with sortBy name sortOrder asc returns names A-Z", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Zebra",
      slug: "zebra",
    });
    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Alpha",
      slug: "alpha",
    });
    await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Middle",
      slug: "middle",
    });

    const asc = await asAlice.query(api.testHelpers.strictListOrganizations, {
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(asc.map((o) => o.name)).toEqual(["Alpha", "Middle", "Zebra"]);

    const desc = await asAlice.query(api.testHelpers.strictListOrganizations, {
      sortBy: "name",
      sortOrder: "desc",
    });
    expect(desc.map((o) => o.name)).toEqual(["Zebra", "Middle", "Alpha"]);
  });

  test("listMembers with sortBy role and sortOrder", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Sort Members Org",
      slug: "sort-members",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "carol",
      role: "admin",
    });

    const byRoleAsc = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      sortBy: "role",
      sortOrder: "asc",
    });
    expect(byRoleAsc.map((m) => m.role)).toEqual(["admin", "member", "owner"]);

    const byRoleDesc = await asAlice.query(api.testHelpers.strictListMembers, {
      organizationId: orgId,
      sortBy: "role",
      sortOrder: "desc",
    });
    expect(byRoleDesc.map((m) => m.role)).toEqual(["owner", "member", "admin"]);
  });

  test("listTeams with sortBy name sortOrder desc", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Sort Teams Org",
      slug: "sort-teams",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Alpha Team",
    });
    await asAlice.mutation(api.testHelpers.strictCreateTeam, {
      organizationId: orgId,
      name: "Zebra Team",
    });

    const desc = await asAlice.query(api.testHelpers.strictListTeams, {
      organizationId: orgId,
      sortBy: "name",
      sortOrder: "desc",
    });
    expect(desc.map((t) => t.name)).toEqual(["Zebra Team", "Alpha Team"]);
  });

  test("listInvitations with sortBy inviteeIdentifier", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Sort Invites Org",
      slug: "sort-invites",
    });
    await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "z@test.com",
      identifierType: "email",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictInviteMember, {
      organizationId: orgId,
      inviteeIdentifier: "a@test.com",
      identifierType: "email",
      role: "member",
    });

    const asc = await asAlice.query(api.testHelpers.strictListInvitations, {
      organizationId: orgId,
      sortBy: "inviteeIdentifier",
      sortOrder: "asc",
    });
    expect(asc.map((i) => i.inviteeIdentifier)).toEqual(["a@test.com", "z@test.com"]);
  });

  test("listTeamMembers with sortBy role", async () => {
    const t = initConvexTest();
    const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

    const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
      name: "Sort TM Org",
      slug: "sort-tm",
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
    await asAlice.mutation(api.testHelpers.strictAddMember, {
      organizationId: orgId,
      memberUserId: "carol",
      role: "member",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "bob",
      role: "lead",
    });
    await asAlice.mutation(api.testHelpers.strictAddTeamMember, {
      teamId,
      memberUserId: "carol",
      role: "member",
    });

    const byRole = await asAlice.query(api.testHelpers.strictListTeamMembers, {
      teamId,
      sortBy: "role",
      sortOrder: "asc",
    });
    const roles = byRole.map((m) => m.role ?? "");
    expect(roles.sort()).toEqual(["lead", "member"]);
  });
});
