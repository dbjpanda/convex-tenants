import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts")
  )
);

function createTestInstance() {
  return convexTest(schema, modules);
}

describe("teams", () => {
  it("should create a team", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
      description: "Engineering team",
    });

    expect(teamId).toBeDefined();

    const team = await t.query(api.teams.getTeam, { teamId });
    expect(team?.name).toBe("Engineering");
    expect(team?.description).toBe("Engineering team");
  });

  it("should list teams in organization", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Sales",
    });

    const teams = await t.query(api.teams.listTeams, {
      organizationId: orgId,
    });

    expect(teams).toHaveLength(2);
    expect(teams.map((t: any) => t.name)).toContain("Engineering");
    expect(teams.map((t: any) => t.name)).toContain("Sales");
  });

  it("should add member to team", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "user_456",
    });

    const isTeamMember = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "user_456",
    });

    expect(isTeamMember).toBe(true);
  });

  it("should require org membership before team membership", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await expect(
      t.mutation(api.teams.addTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "user_456",
      })
    ).rejects.toThrow();
  });

  it("should remove member from team", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "user_456",
      role: "member",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "user_456",
    });

    await t.mutation(api.teams.removeTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "user_456",
    });

    const isTeamMember = await t.query(api.teams.isTeamMember, {
      teamId,
      userId: "user_456",
    });

    expect(isTeamMember).toBe(false);
  });

  it("should delete team and all memberships", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.teams.deleteTeam, {
      userId: "user_123",
      teamId,
    });

    const team = await t.query(api.teams.getTeam, { teamId });
    expect(team).toBeNull();
  });

  it("should update team details", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Original",
    });

    await t.mutation(api.teams.updateTeam, {
      userId: "user_123",
      teamId,
      name: "Updated",
      description: "New description",
    });

    const team = await t.query(api.teams.getTeam, { teamId });
    expect(team?.name).toBe("Updated");
    expect(team?.description).toBe("New description");
  });

  it("updateTeam throws for nonexistent team", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.teams.updateTeam, {
        userId: "user_123",
        teamId: "nonexistent" as any,
        name: "New Name",
      })
    ).rejects.toThrow("Team not found");
  });

  it("deleteTeam throws for nonexistent team", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.teams.deleteTeam, {
        userId: "user_123",
        teamId: "nonexistent" as any,
      })
    ).rejects.toThrow("Team not found");
  });

  it("addTeamMember throws for nonexistent team", async () => {
    const t = createTestInstance();

    await expect(
      t.mutation(api.teams.addTeamMember, {
        userId: "user_123",
        teamId: "nonexistent" as any,
        memberUserId: "bob",
      })
    ).rejects.toThrow("Team not found");
  });

  it("addTeamMember throws for duplicate team member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await t.mutation(api.members.addMember, {
      userId: "user_123",
      organizationId: orgId,
      memberUserId: "bob",
      role: "member",
    });

    await t.mutation(api.teams.addTeamMember, {
      userId: "user_123",
      teamId,
      memberUserId: "bob",
    });

    await expect(
      t.mutation(api.teams.addTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "bob",
      })
    ).rejects.toThrow("User is already a member of this team");
  });

  it("removeTeamMember throws for non-team-member", async () => {
    const t = createTestInstance();

    const orgId = await t.mutation(api.organizations.createOrganization, {
      userId: "user_123",
      name: "Test Org",
      slug: "test-org",
    });

    const teamId = await t.mutation(api.teams.createTeam, {
      userId: "user_123",
      organizationId: orgId,
      name: "Engineering",
    });

    await expect(
      t.mutation(api.teams.removeTeamMember, {
        userId: "user_123",
        teamId,
        memberUserId: "nonexistent",
      })
    ).rejects.toThrow("User is not a member of this team");
  });
});
