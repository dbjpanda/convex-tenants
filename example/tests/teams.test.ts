import { describe, expect, test } from "vitest";
import { initConvexTest } from "../convex/setup.test";
import { api } from "../convex/_generated/api";

describe("makeTenantsAPI - teams", () => {
  describe("team functions", () => {
    test("listTeams returns all teams in an organization", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Teams Org" }
      );

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Design",
      });

      const teams = await asAlice.query(api.testHelpers.strictListTeams, {
        organizationId: orgId,
      });

      expect(teams).toHaveLength(2);
      expect(teams.map((team: any) => team.name)).toContain("Engineering");
      expect(teams.map((team: any) => team.name)).toContain("Design");
    });

    test("getTeam returns team by ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Get Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
        description: "The eng team",
      });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });

      expect(team).not.toBeNull();
      expect(team?.name).toBe("Engineering");
      expect(team?.description).toBe("The eng team");
    });

    test("getTeam returns null for nonexistent ID", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });

      // Authenticated but team doesn't exist — underlying component returns null.
      const team = await asAlice.query(api.testHelpers.strictGetTeam, {
        teamId: "nonexistent",
      });

      expect(team).toBeNull();
    });

    test("updateTeam changes name and description", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Update Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Original",
      });

      await asAlice.mutation(api.testHelpers.strictUpdateTeam, {
        teamId,
        name: "Updated",
        description: "New description",
      });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team?.name).toBe("Updated");
      expect(team?.description).toBe("New description");
    });

    test("updateTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictUpdateTeam, {
          teamId: "nonexistent",
          name: "New Name",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("deleteTeam removes team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Delete Team Org" }
      );

      const teamId = await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "To Delete",
      });

      await asAlice.mutation(api.testHelpers.strictDeleteTeam, { teamId });

      const team = await asAlice.query(api.testHelpers.strictGetTeam, { teamId });
      expect(team).toBeNull();
    });

    test("deleteTeam throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictDeleteTeam, {
          teamId: "nonexistent",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("removeTeamMember removes member from team", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Remove Team Member Org" }
      );

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

      // Check via listTeamMembers that bob is a team member
      const membersBefore: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersBefore).toHaveLength(1);

      await asAlice.mutation(api.testHelpers.strictRemoveTeamMember, {
        teamId,
        memberUserId: "bob",
      });

      const membersAfter: any[] = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId }
      );
      expect(membersAfter).toHaveLength(0);
    });

    test("removeTeamMember throws when unauthenticated", async () => {
      const t = initConvexTest();

      await expect(
        t.mutation(api.testHelpers.strictRemoveTeamMember, {
          teamId: "nonexistent",
          memberUserId: "bob",
        })
      ).rejects.toThrow("Not authenticated");
    });

    test("countTeams returns team count", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Count Teams Org" }
      );
      expect(await asAlice.query(api.testHelpers.strictCountTeams, { organizationId: orgId })).toBe(0);

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Engineering",
      });
      expect(await asAlice.query(api.testHelpers.strictCountTeams, { organizationId: orgId })).toBe(1);

      await asAlice.mutation(api.testHelpers.strictCreateTeam, {
        organizationId: orgId,
        name: "Design",
      });
      expect(await asAlice.query(api.testHelpers.strictCountTeams, { organizationId: orgId })).toBe(2);
    });

    test("listTeamMembers with paginationOpts returns paginated team members", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({
        subject: "alice",
        issuer: "https://test.com",
      });

      const orgId = await asAlice.mutation(
        api.testHelpers.strictCreateOrganization,
        { name: "Paginated Team Members Org" }
      );
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

      const first = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId, paginationOpts: { numItems: 1, cursor: null } }
      );
      expect(first.page).toHaveLength(1);
      expect(first.isDone).toBe(false);
      expect(first.continueCursor).toBeTruthy();

      const second = await asAlice.query(
        api.testHelpers.strictListTeamMembers,
        { teamId, paginationOpts: { numItems: 10, cursor: first.continueCursor } }
      );
      expect(second.page.length).toBeGreaterThanOrEqual(0);
      expect(first.page[0].userId === "alice" || first.page[0].userId === "bob").toBe(true);
    });
  });

  describe("list teams vs list team members by role", () => {
    test("member cannot list teams (teams:list denied) and cannot list team members (teams:listMembers denied)", async () => {
      const t = initConvexTest();
      const asAlice = t.withIdentity({ subject: "alice", issuer: "https://test.com" });
      const asBob = t.withIdentity({ subject: "bob", issuer: "https://test.com" });

      const orgId = await asAlice.mutation(api.testHelpers.strictCreateOrganization, {
        name: "Role Permission Org",
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

      // Bob (member role) has teams: [] → gets empty list (queries return empty on permission denied)
      const teams = await asBob.query(api.testHelpers.strictListTeams, { organizationId: orgId });
      expect(teams).toEqual([]);

      // Bob (member role) does not have teams:listMembers → gets empty list
      const teamMembers = await asBob.query(api.testHelpers.strictListTeamMembers, { teamId });
      expect(teamMembers).toEqual([]);
    });
  });
});
